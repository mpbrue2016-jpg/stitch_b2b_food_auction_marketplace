-- ==============================================================================
-- VAREJISTA ONLINE - B2B FOOD AUCTION MARKETPLACE
-- Migration: 20261116000000_escrow_dispute_fields.sql
-- Descrição: Paridade do schema SQL com ciclo completo de disputa e estorno Escrow
-- ==============================================================================

-- 1. Adiciona estado 'em_disputa' ao enum de status de pagamento Escrow
DO $$ BEGIN
    ALTER TYPE public.payment_status_type ADD VALUE IF NOT EXISTS 'em_disputa';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Campo motivo_disputa na tabela de pedidos Escrow
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS motivo_disputa TEXT;

-- 3. Índice parcial para triagem rápida de disputas abertas no painel Admin Master
CREATE INDEX IF NOT EXISTS idx_orders_em_disputa
    ON public.orders(created_at DESC)
    WHERE status_pagamento = 'em_disputa';

-- 4. Atualiza view executiva para excluir pedidos estornados dos totais financeiros
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
        COALESCE(SUM(valor_total_arremate) FILTER (WHERE status_pagamento != 'estornado'), 0) AS valor_total_pedidos,
        COALESCE(SUM(valor_comissao_plataforma) FILTER (WHERE status_pagamento != 'estornado'), 0) AS comissao_total_plataforma,
        COALESCE(SUM(valor_repasse_liquido) FILTER (WHERE status_pagamento != 'estornado'), 0) AS repasse_total_liquido,
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
