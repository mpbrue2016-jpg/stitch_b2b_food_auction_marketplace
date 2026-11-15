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
    v_anti_sniping_minutes INTEGER := 5;
    v_result NUMERIC(15, 2);
BEGIN
    SELECT * INTO v_auction
    FROM public.auctions
    WHERE id = p_auction_id AND status = 'ativo';

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0.00, FALSE,
            'Leilão não encontrado ou não está ativo';
    END IF;

    SELECT COALESCE(MAX(valor_lance), v_auction.lance_inicial)
    INTO v_current_highest_bid
    FROM public.bids
    WHERE auction_id = p_auction_id;

    IF EXISTS (
        SELECT 1 FROM public.bids
        WHERE auction_id = p_auction_id AND comprador_id = p_user_id
    ) THEN
        RETURN QUERY SELECT FALSE, 0.00, FALSE,
            'Usuário já enviou lance neste leilão';
    END IF;

    SELECT incremento_minimo INTO v_minimum_increment
    FROM public.auctions
    WHERE id = p_auction_id;

    v_minimum_increment := COALESCE(v_minimum_increment, 500.00);

    IF v_current_highest_bid IS NULL OR v_current_highest_bid = 0 THEN
        v_current_highest_bid := v_auction.lance_inicial;
    END IF;

    IF p_proposed_bid <= v_current_highest_bid THEN
        RETURN QUERY SELECT FALSE, v_minimum_increment, FALSE,
            'Lance deve ser maior que o atual (R$ ' || v_current_highest_bid::text || ')';
    END IF;

    v_result := GREATEST(p_proposed_bid, v_current_highest_bid + v_minimum_increment);

    RETURN QUERY SELECT TRUE, v_minimum_increment, FALSE,
        'Lance válido: R$ ' || v_result::text;
END;
$$;

-- 2. Stored Procedure: Enviar Lance (com validações completas)
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
STABLE
AS $$
DECLARE
    v_auction public.auctions%ROWTYPE;
    v_bid_value_result RECORD;
    v_commission_rule public.commission_rules%ROWTYPE;
    v_rate NUMERIC(5, 2);
    v_calculated_commission NUMERIC(15, 2);
BEGIN
    p_success := FALSE;
    p_message := 'Erro desconhecido';

    SELECT * INTO v_auction
    FROM public.auctions
    WHERE id = p_auction_id;

    IF NOT FOUND THEN
        p_message := 'Leilão não encontrado';
        RETURN;
    END IF;

    IF v_auction.status != 'ativo' THEN
        p_message := 'Leilão não está ativo (status: ' || v_auction.status || ')';
        RETURN;
    END IF;

    IF NOW() > v_auction.termina_em THEN
        p_message := 'Leilão já terminou';
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
    WHERE slug = v_auction.tipo_venda OR slug = 'leilao'
    LIMIT 1;

    IF FOUND THEN
        v_rate := COALESCE(v_commission_rule.percentual_padrao, 6.00);
        v_calculated_commission := (v_bid_value_result.minimum_bid * v_rate / 100);
    ELSE
        v_rate := 6.00;
        v_calculated_commission := (v_bid_value_result.minimum_bid * 6.00 / 100);
    END IF;

    INSERT INTO public.bids (
        id,
        auction_id,
        comprador_id,
        valor_lance,
        valor_unitario,
        ip_origem,
        created_at
    ) VALUES (
        gen_random_uuid(),
        p_auction_id,
        p_comprador_id,
        v_bid_value_result.minimum_bid,
        v_bid_value_result.minimum_bid,
        p_ip_origem,
        NOW()
    )
    RETURNING id INTO p_bid_id;

    p_success := TRUE;
    p_message := 'Lance enviado com sucesso';
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
BEGIN
    p_success := FALSE;

    SELECT * INTO v_auction
    FROM public.auctions
    WHERE id = p_auction_id;

    IF NOT FOUND THEN
        p_message := 'Leilão não encontrado';
        RETURN;
    END IF;

    IF v_auction.status NOT IN ('ativo', 'reta_final') THEN
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
    WHERE slug = 'leilao'
    LIMIT 1;

    v_commission_rate := COALESCE(v_commission_rule.percentual_padrao, 6.00);
    v_commission := (v_total_arremate * v_commission_rate / 100);
    v_liquid := v_total_arremate - v_commission;

    v_codigo_pedido := 'LOTE-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
        UPPER(SUBSTRING(REPLACE(CAST(p_auction_id AS TEXT), '-', ''), 1, 8));

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
        md5(CAST(NOW() AS TEXT) || CAST(p_auction_id AS TEXT)),
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
DECLARE
    v_current_date TIMESTAMPTZ := NOW();
BEGIN
    RETURN QUERY
    SELECT
        p.id AS product_id,
        p.titulo AS product_title,
        100 AS available_units,
        p.status_shelf_life,
        CASE
            WHEN p.data_validade IS NOT NULL THEN
                EXTRACT(DAY FROM (p.data_validade - v_current_date))
            ELSE
                NULL
        END AS days_until_validade,
        CASE
            WHEN p.data_validade IS NOT NULL AND p.data_validade < v_current_date THEN
                ' vencido'
            WHEN p.status_shelf_life = 'critica' THEN
                ' atenção necessária'
            ELSE
                ' disponível'
        END AS message
    FROM public.products p
    WHERE p.categoria_id = p_category_id
      AND p.status_fiscal = 'homologado'
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
        (SELECT COUNT(*) FROM public.subcategories sc WHERE sc.category_id = c.id AND sc.ativo = TRUE) AS subcategory_count,
        (SELECT COUNT(*) FROM public.subcategories sc WHERE sc.category_id = c.id AND sc.ativo = TRUE) AS active_subcategories
    FROM public.categories c
    WHERE c.ativo = TRUE
    ORDER BY c.nome;
END;
$$;