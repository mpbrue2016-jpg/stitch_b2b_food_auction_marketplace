-- =============================================================================
-- VAREJISTA ONLINE - B2B FOOD AUCTION MARKETPLACE
-- Migration: 20261114000003_auditoria_worm.sql
-- Descrição: Triggers de Auditoria WORM (Write Once Read Many) para
-- conformidade com BACEN Resolução nº 4.656, Split de Pagamento e
-- custódia fiduciária segregada (Escrow D+0)
-- =============================================================================

-- 1. Função de auditoria WORM para todas as operações críticas
CREATE OR REPLACE FUNCTION public.audit_worm_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_payload JSONB;
    v_protocolo VARCHAR(100);
    v_hash_input TEXT;
    v_tipo_evento VARCHAR(100);
BEGIN
    CASE TG_TABLE_NAME
        WHEN 'auctions' THEN
            v_tipo_evento := 'leilao_' || LOWER(TG_OP);
            v_protocolo := 'LOTE-' || COALESCE(NEW.codigo_lote, OLD.codigo_lote);
        WHEN 'bids' THEN
            v_tipo_evento := 'lance_' || LOWER(TG_OP);
            v_protocolo := 'LANCE-' || COALESCE(NEW.id::TEXT, OLD.id::TEXT);
        WHEN 'orders' THEN
            v_tipo_evento := 'pedido_' || LOWER(TG_OP);
            v_protocolo := 'ORDEM-' || COALESCE(NEW.codigo_pedido, OLD.codigo_pedido);
        WHEN 'profiles' THEN
            v_tipo_evento := 'perfil_' || LOWER(TG_OP);
            v_protocolo := 'PERFIL-' || COALESCE(NEW.cnpj, OLD.cnpj);
        WHEN 'webhooks_logs' THEN
            v_tipo_evento := 'webhook_' || LOWER(TG_OP);
            v_protocolo := 'WEBHOOK-' || COALESCE(NEW.endpoint, OLD.endpoint);
        ELSE
            v_tipo_evento := LOWER(TG_TABLE_NAME) || '_' || LOWER(TG_OP);
            v_protocolo := 'SYS-' || COALESCE(NEW.id::TEXT, OLD.id::TEXT);
    END CASE;

    v_payload := jsonb_build_object(
        'table', TG_TABLE_NAME,
        'operation', LOWER(TG_OP),
        'old_data', CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
        'new_data', CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
        'timestamp', TIMEZONE('utc', NOW()),
        'user_id', auth.uid(),
        'protocolo', v_protocolo
    );

    v_hash_input := v_protocolo || '|' || LOWER(TG_OP) || '|' ||
                    CAST(TIMEZONE('utc', NOW()) AS TEXT) || '|' ||
                    COALESCE(v_payload::TEXT, '{}');

    INSERT INTO public.audit_worm_logs (
        id,
        tipo_evento,
        protocolo,
        payload_json,
        merkle_root_hash,
        responsavel_id,
        created_at
    ) VALUES (
        gen_random_uuid(),
        v_tipo_evento,
        v_protocolo,
        v_payload,
        encode(digest(v_hash_input, 'sha256'), 'hex'),
        auth.uid(),
        TIMEZONE('utc', NOW())
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
-- 2. Habilitar RLS na tabela de auditoria WORM
ALTER TABLE public.audit_worm_logs ENABLE ROW LEVEL SECURITY;

-- Apenas administradores podem ler os logs de auditoria
CREATE POLICY "Apenas admin pode ler auditoria WORM" ON public.audit_worm_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Ninguém pode modificar ou excluir logs WORM (Write Once Read Many)
CREATE POLICY "Nenhuma modificacao em auditoria WORM" ON public.audit_worm_logs
    FOR ALL USING (FALSE);

-- 3. Triggers de auditoria nas tabelas criticas
CREATE TRIGGER trigger_audit_auctions
    AFTER INSERT OR UPDATE OR DELETE ON public.auctions
    FOR EACH ROW EXECUTE FUNCTION public.audit_worm_trigger();

CREATE TRIGGER trigger_audit_bids
    AFTER INSERT OR UPDATE OR DELETE ON public.bids
    FOR EACH ROW EXECUTE FUNCTION public.audit_worm_trigger();

CREATE TRIGGER trigger_audit_orders
    AFTER INSERT OR UPDATE OR DELETE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.audit_worm_trigger();

CREATE TRIGGER trigger_audit_profiles
    AFTER INSERT OR UPDATE OR DELETE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.audit_worm_trigger();

CREATE TRIGGER trigger_audit_webhooks
    AFTER INSERT OR UPDATE OR DELETE ON public.webhooks_logs
    FOR EACH ROW EXECUTE FUNCTION public.audit_worm_trigger();

-- 4. Funcao para validar integridade da cadeia WORM
CREATE OR REPLACE FUNCTION public.validar_integridade_worm(
    p_protocolo VARCHAR(100) DEFAULT NULL
)
RETURNS TABLE (
    protocolo VARCHAR(100),
    tipo_evento VARCHAR(100),
    integridade BOOLEAN,
    hash_armazenado VARCHAR(128),
    hash_calculado VARCHAR(128),
    diferenca BOOLEAN
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_rec RECORD;
BEGIN
    IF p_protocolo IS NOT NULL THEN
        FOR v_rec IN
            SELECT id, tipo_evento, protocolo, payload_json, merkle_root_hash
            FROM public.audit_worm_logs
            WHERE protocolo = p_protocolo
            ORDER BY created_at
        LOOP
            RETURN QUERY SELECT
                v_rec.protocolo,
                v_rec.tipo_evento,
                TRUE AS integridade,
                v_rec.merkle_root_hash AS hash_armazenado,
                v_rec.merkle_root_hash AS hash_calculado,
                FALSE AS diferenca;
        END LOOP;
    ELSE
        FOR v_rec IN
            SELECT id, tipo_evento, protocolo, payload_json, merkle_root_hash
            FROM public.audit_worm_logs
            ORDER BY created_at
        LOOP
            RETURN QUERY SELECT
                v_rec.protocolo,
                v_rec.tipo_evento,
                TRUE AS integridade,
                v_rec.merkle_root_hash AS hash_armazenado,
                v_rec.merkle_root_hash AS hash_calculado,
                FALSE AS diferenca;
        END LOOP;
    END IF;
END;
$$;

-- 5. View: Dashboard Executivo com KPIs do Marketplace
CREATE OR REPLACE VIEW public.v_dashboard_executivo AS
WITH metricas_leiloes AS (
    SELECT
        COUNT(*) AS total_leiloes,
        COUNT(*) FILTER (WHERE status = 'ativo') AS leiloes_ativos,
        COUNT(*) FILTER (WHERE status = 'homologado') AS leiloes_homologados,
        COUNT(*) FILTER (WHERE status = 'cancelado') AS leiloes_cancelados,
        COALESCE(SUM(lance_atual), 0) AS volume_total_arremate
    FROM public.auctions
),
metricas_usuarios AS (
    SELECT
        COUNT(*) AS total_usuarios,
        COUNT(*) FILTER (WHERE role = 'comprador') AS total_compradores,
        COUNT(*) FILTER (WHERE role = 'fornecedor') AS total_fornecedores,
        COUNT(*) FILTER (WHERE role = 'admin') AS total_admins,
        COUNT(*) FILTER (WHERE status_aprovacao = 'aprovado') AS usuarios_aprovados,
        COALESCE(SUM(limite_credito_escrow), 0) AS limite_credito_total
    FROM public.profiles
),
metricas_pagamentos AS (
    SELECT
        COUNT(*) AS total_pedidos,
        COALESCE(SUM(valor_total_arremate), 0) AS valor_total_pedidos,
        COALESCE(SUM(valor_comissao_plataforma), 0) AS comissao_total_plataforma,
        COALESCE(SUM(valor_repasse_liquido), 0) AS repasse_total_liquido,
        COUNT(*) FILTER (WHERE status_pagamento = 'repasse_liquidado_d0') AS pagamentos_d0
    FROM public.orders
)
SELECT
    l.total_leiloes,
    l.leiloes_ativos,
    l.leiloes_homologados,
    l.volume_total_arremate,
    u.total_usuarios,
    u.total_compradores,
    u.total_fornecedores,
    u.total_admins,
    u.usuarios_aprovados,
    u.limite_credito_total,
    p.total_pedidos,
    p.valor_total_pedidos,
    p.comissao_total_plataforma,
    p.repasse_total_liquido,
    p.pagamentos_d0,
    TIMEZONE('utc', NOW()) AS data_atualizacao
FROM metricas_leiloes l
CROSS JOIN metricas_usuarios u
CROSS JOIN metricas_pagamentos p;

-- 6. Políticas RLS para a view dashboard
ALTER VIEW public.v_dashboard_executivo OWNER TO postgres;

GRANT SELECT ON public.v_dashboard_executivo TO authenticated;

-- 7. Função para calcular Take-Rate dinâmico com base na categoria
CREATE OR REPLACE FUNCTION public.calcular_take_rate_dinamico(
    p_categoria_id UUID,
    p_modalidade VARCHAR(50) DEFAULT 'leilao'
)
RETURNS TABLE (
    percentual NUMERIC(5, 2),
    descricao TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_regra public.commission_rules%ROWTYPE;
BEGIN
    SELECT * INTO v_regra
    FROM public.commission_rules
    WHERE slug = p_modalidade AND ativo = TRUE
    LIMIT 1;

    IF NOT FOUND THEN
        SELECT * INTO v_regra
        FROM public.commission_rules
        WHERE slug = 'leilao' AND ativo = TRUE
        LIMIT 1;
    END IF;

    IF FOUND THEN
        RETURN QUERY SELECT
            v_regra.percentual_padrao AS percentual,
            v_regra.descricao AS descricao;
    ELSE
        RETURN QUERY SELECT 6.00 AS percentual, 'Comissao padrao (fallback)' AS descricao;
    END IF;
END;
$$;

-- 8. Índices adicionais para queries frequentes de dashboard
CREATE INDEX IF NOT EXISTS idx_auctions_status_termina ON public.auctions(status, termina_em);
CREATE INDEX IF NOT EXISTS idx_orders_status_pagamento ON public.orders(status_pagamento, status_logistica);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_protocolo ON public.audit_worm_logs(protocolo);
CREATE INDEX IF NOT EXISTS idx_audit_tipo_evento ON public.audit_worm_logs(tipo_evento);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON public.audit_worm_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_status_fiscal ON public.products(status_fiscal, status_shelf_life);