-- =============================================================================
-- VAREJISTA ONLINE - B2B FOOD AUCTION MARKETPLACE
-- Migration: 20261114000002_advanced_features.sql
-- Descrição: Stored Procedures avançadas para operações de marketplace
-- =============================================================================

-- 1. Função para calcular valor do lance com proteção anti-sniping
CREATE OR REPLACE FUNCTION public.calculate_bid_value(
    p_auction_id UUID,
    p_proposed_bid NUMERIC(15, 2),
    p_user_id UUID
)
RETURNS TABLE (
    success BOOLEAN,
    minimum_bid NUMERIC(15, 2),
    anti_sniping_protected BOOLEAN,
    message TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_auction public.auctions%ROWTYPE;
    v_current_highest_bid NUMERIC(15, 2);
    v_minimum_increment NUMERIC(15, 2);
    v_required_minimum NUMERIC(15, 2);
    v_is_anti_sniping BOOLEAN := FALSE;
BEGIN
    SELECT * INTO v_auction
    FROM public.auctions
    WHERE id = p_auction_id AND status IN ('ativo', 'reta_final');

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0.00::NUMERIC(15,2), FALSE,
            'Leilão não encontrado ou não está ativo'::TEXT;
        RETURN;
    END IF;

    IF NOW() > v_auction.termina_em THEN
        RETURN QUERY SELECT FALSE, 0.00::NUMERIC(15,2), FALSE,
            'Leilão já encerrado pelo prazo'::TEXT;
        RETURN;
    END IF;

    v_minimum_increment := COALESCE(v_auction.incremento_minimo, 500.00);
    v_current_highest_bid := COALESCE(v_auction.lance_atual, v_auction.lance_inicial);

    IF COALESCE(v_auction.total_lances, 0) = 0 THEN
        v_required_minimum := GREATEST(v_auction.lance_inicial, v_current_highest_bid + v_minimum_increment);
    ELSE
        v_required_minimum := v_current_highest_bid + v_minimum_increment;
    END IF;

    IF v_auction.vencedor_id = p_user_id THEN
        RETURN QUERY SELECT FALSE, v_required_minimum, FALSE,
            'Sua empresa já detém o maior lance atual neste lote'::TEXT;
        RETURN;
    END IF;

    IF p_proposed_bid < v_required_minimum THEN
        RETURN QUERY SELECT FALSE, v_required_minimum, FALSE,
            ('Lance mínimo exigido é R$ ' || v_required_minimum::TEXT)::TEXT;
        RETURN;
    END IF;

    v_is_anti_sniping := (v_auction.termina_em - NOW()) <= INTERVAL '3 minutes';

    RETURN QUERY SELECT TRUE, v_required_minimum, v_is_anti_sniping,
        ('Lance válido: R$ ' || p_proposed_bid::TEXT)::TEXT;
END;
$$;

-- 2. Stored Procedure: Enviar Lance (atômica, atualiza leilão, anti-sniping e WORM)
CREATE OR REPLACE PROCEDURE public.place_bid(
    p_auction_id UUID,
    p_comprador_id UUID,
    p_proposed_bid NUMERIC(15, 2),
    p_ip_origem VARCHAR(45),
    OUT p_bid_id UUID,
    OUT p_success BOOLEAN,
    OUT p_message TEXT,
    OUT p_commission_calculated NUMERIC(15, 2),
    OUT p_commission_rate NUMERIC(5, 2)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_auction public.auctions%ROWTYPE;
    v_product public.products%ROWTYPE;
    v_buyer public.profiles%ROWTYPE;
    v_bid_value_result RECORD;
    v_commission_rule public.commission_rules%ROWTYPE;
    v_rate NUMERIC(5, 2);
    v_calculated_commission NUMERIC(15, 2);
    v_valor_unitario NUMERIC(15, 2);
    v_new_end TIMESTAMP WITH TIME ZONE;
    v_new_status public.auction_status_type;
    v_worm_hash TEXT;
BEGIN
    p_success := FALSE;
    p_message := 'Erro desconhecido';

    SELECT * INTO v_auction
    FROM public.auctions
    WHERE id = p_auction_id
    FOR UPDATE;

    IF NOT FOUND THEN
        p_message := 'Leilão não encontrado';
        RETURN;
    END IF;

    SELECT * INTO v_buyer
    FROM public.profiles
    WHERE id = p_comprador_id;

    IF NOT FOUND OR v_buyer.status_aprovacao != 'aprovado' THEN
        p_message := 'Comprador não aprovado para operar pregões';
        RETURN;
    END IF;

    IF p_proposed_bid > COALESCE(v_buyer.limite_credito_escrow, 0) THEN
        p_message := 'Lance excede o limite de crédito Escrow aprovado';
        RETURN;
    END IF;

    SELECT * INTO v_product
    FROM public.products
    WHERE id = v_auction.produto_id;

    IF v_product.fornecedor_id = p_comprador_id THEN
        p_message := 'Fornecedor não pode enviar lance no próprio lote';
        RETURN;
    END IF;

    SELECT * INTO v_bid_value_result
    FROM public.calculate_bid_value(p_auction_id, p_proposed_bid, p_comprador_id);

    IF NOT v_bid_value_result.success THEN
        p_message := v_bid_value_result.message;
        RETURN;
    END IF;

    SELECT * INTO v_commission_rule
    FROM public.commission_rules
    WHERE (slug = v_auction.tipo_venda OR slug = 'leilao') AND ativo = TRUE
    ORDER BY (slug = v_auction.tipo_venda) DESC
    LIMIT 1;

    v_rate := COALESCE(v_commission_rule.percentual_padrao, 6.00);
    v_calculated_commission := ROUND((p_proposed_bid * v_rate / 100.0), 2);
    v_valor_unitario := ROUND((p_proposed_bid / GREATEST(COALESCE(v_product.total_unidades, 1), 1)), 2);

    v_new_end := v_auction.termina_em;
    v_new_status := v_auction.status;
    IF v_bid_value_result.anti_sniping_protected THEN
        v_new_end := v_auction.termina_em + INTERVAL '3 minutes';
        v_new_status := 'reta_final';
    END IF;

    v_worm_hash := encode(
        digest(
            p_auction_id::TEXT || '|' || p_comprador_id::TEXT || '|' || p_proposed_bid::TEXT || '|' || NOW()::TEXT,
            'sha256'
        ),
        'hex'
    );

    INSERT INTO public.bids (
        id,
        auction_id,
        comprador_id,
        valor_lance,
        valor_unitario,
        ip_origem,
        hash_transacao_worm,
        created_at
    ) VALUES (
        gen_random_uuid(),
        p_auction_id,
        p_comprador_id,
        p_proposed_bid,
        v_valor_unitario,
        p_ip_origem,
        v_worm_hash,
        NOW()
    )
    RETURNING id INTO p_bid_id;

    UPDATE public.auctions
    SET lance_atual = p_proposed_bid,
        total_lances = COALESCE(total_lances, 0) + 1,
        ultimo_lance_empresa = v_buyer.nome_fantasia,
        vencedor_id = p_comprador_id,
        termina_em = v_new_end,
        status = v_new_status,
        updated_at = NOW()
    WHERE id = p_auction_id;

    p_success := TRUE;
    p_message := CASE
        WHEN v_bid_value_result.anti_sniping_protected THEN 'Lance registrado! Proteção anti-sniping prorrogou o pregão em +3 min.'
        ELSE 'Lance enviado com sucesso'
    END;
    p_commission_calculated := v_calculated_commission;
    p_commission_rate := v_rate;
END;
$$;

-- 3. Stored Procedure: Finalizar Leilão e Gerar Ordem com Escrow
CREATE OR REPLACE PROCEDURE public.finalize_auction(
    p_auction_id UUID,
    p_winner_id UUID,
    OUT p_order_id UUID,
    OUT p_success BOOLEAN,
    OUT p_message TEXT,
    OUT p_total_arremate NUMERIC(15, 2),
    OUT p_commission_amount NUMERIC(15, 2),
    OUT p_liquid_amount NUMERIC(15, 2)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_auction public.auctions%ROWTYPE;
    v_winner_profile public.profiles%ROWTYPE;
    v_supplier_id UUID;
    v_commission_rule public.commission_rules%ROWTYPE;
    v_commission_rate NUMERIC(5, 2);
    v_total_arremate NUMERIC(15, 2);
    v_commission NUMERIC(15, 2);
    v_liquid NUMERIC(15, 2);
    v_codigo_pedido VARCHAR(50);
    v_worm_hash TEXT;
BEGIN
    p_success := FALSE;

    SELECT * INTO v_auction
    FROM public.auctions
    WHERE id = p_auction_id
    FOR UPDATE;

    IF NOT FOUND THEN
        p_message := 'Leilão não encontrado';
        RETURN;
    END IF;

    IF v_auction.status NOT IN ('ativo', 'reta_final', 'encerrado') THEN
        p_message := 'Leilão não pode ser finalizado (status: ' || v_auction.status || ')';
        RETURN;
    END IF;

    SELECT * INTO v_winner_profile
    FROM public.profiles
    WHERE id = p_winner_id;

    IF NOT FOUND THEN
        p_message := 'Vencedor não encontrado';
        RETURN;
    END IF;

    SELECT fornecedor_id INTO v_supplier_id
    FROM public.products
    WHERE id = v_auction.produto_id;

    v_total_arremate := v_auction.lance_atual;

    SELECT * INTO v_commission_rule
    FROM public.commission_rules
    WHERE (slug = v_auction.tipo_venda OR slug = 'leilao') AND ativo = TRUE
    ORDER BY (slug = v_auction.tipo_venda) DESC
    LIMIT 1;

    v_commission_rate := COALESCE(v_commission_rule.percentual_padrao, 6.00);
    v_commission := ROUND((v_total_arremate * v_commission_rate / 100.0), 2);
    v_liquid := ROUND((v_total_arremate - v_commission), 2);

    v_codigo_pedido := 'PED-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
        UPPER(SUBSTRING(REPLACE(CAST(gen_random_uuid() AS TEXT), '-', ''), 1, 6));

    v_worm_hash := encode(
        digest(v_codigo_pedido || '|' || p_auction_id::TEXT || '|' || p_winner_id::TEXT || '|' || v_total_arremate::TEXT, 'sha256'),
        'hex'
    );

    INSERT INTO public.orders (
        id,
        codigo_pedido,
        auction_id,
        comprador_id,
        fornecedor_id,
        valor_total_arremate,
        percentual_comissao,
        valor_comissao_plataforma,
        valor_repasse_liquido,
        status_pagamento,
        status_logistica,
        termo_arremate_hash,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        v_codigo_pedido,
        p_auction_id,
        p_winner_id,
        v_supplier_id,
        v_total_arremate,
        v_commission_rate,
        v_commission,
        v_liquid,
        'aguardando_pagamento',
        'agendamento_doca',
        v_worm_hash,
        NOW(),
        NOW()
    )
    RETURNING id INTO p_order_id;

    UPDATE public.auctions
    SET status = 'homologado',
        vencedor_id = p_winner_id,
        updated_at = NOW()
    WHERE id = p_auction_id;

    INSERT INTO public.audit_worm_logs (
        id, tipo_evento, protocolo, payload_json,
        merkle_root_hash, responsavel_id, created_at
    ) VALUES (
        gen_random_uuid(),
        'leilao_finalizado',
        v_codigo_pedido,
        jsonb_build_object(
            'auction_id', p_auction_id,
            'winner_id', p_winner_id,
            'total_arremate', v_total_arremate,
            'commission_rate', v_commission_rate,
            'commission_amount', v_commission
        ),
        v_worm_hash,
        p_winner_id,
        NOW()
    );

    p_success := TRUE;
    p_message := 'Leilão finalizado e ordem ' || v_codigo_pedido || ' criada';
    p_total_arremate := v_total_arremate;
    p_commission_amount := v_commission;
    p_liquid_amount := v_liquid;
END;
$$;

-- 4. Função: Verificar disponibilidade de estoque por categoria
CREATE OR REPLACE FUNCTION public.check_product_availability(
    p_category_id UUID,
    p_min_units INT DEFAULT 1
)
RETURNS TABLE (
    product_id UUID,
    product_title VARCHAR(255),
    available_units INT,
    status_shelf_life shelf_life_status_type,
    days_until_validade INT,
    message TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id AS product_id,
        p.titulo AS product_title,
        p.total_unidades AS available_units,
        p.status_shelf_life,
        CASE
            WHEN p.data_validade IS NOT NULL THEN
                (p.data_validade - CURRENT_DATE)::INT
            ELSE
                NULL::INT
        END AS days_until_validade,
        CASE
            WHEN p.data_validade IS NOT NULL AND p.data_validade < CURRENT_DATE THEN
                'vencido'
            WHEN p.status_shelf_life = 'critica' THEN
                'atenção necessária'
            ELSE
                'disponível'
        END AS message
    FROM public.products p
    WHERE p.categoria_id = p_category_id
      AND p.status_fiscal = 'homologado'
      AND p.total_unidades >= p_min_units
    ORDER BY p.data_validade ASC
    LIMIT 50;
END;
$$;

-- 5. Função: Buscar categorias com subcategorias ativas
CREATE OR REPLACE FUNCTION public.get_categories_with_subcategories()
RETURNS TABLE (
    category_id UUID,
    category_name VARCHAR(100),
    category_slug VARCHAR(100),
    category_icon VARCHAR(50),
    subcategory_count INTEGER,
    active_subcategories INTEGER
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id AS category_id,
        c.nome AS category_name,
        c.slug AS category_slug,
        c.icone AS category_icon,
        (SELECT COUNT(*)::INTEGER FROM public.subcategories sc WHERE sc.category_id = c.id AND sc.ativo = TRUE) AS subcategory_count,
        (SELECT COUNT(*)::INTEGER FROM public.subcategories sc WHERE sc.category_id = c.id AND sc.ativo = TRUE) AS active_subcategories
    FROM public.categories c
    WHERE c.ativo = TRUE
    ORDER BY c.nome;
END;
$$;