-- ==============================================================================
-- VAREJISTA ONLINE - B2B FOOD AUCTION MARKETPLACE
-- Migration: 20261119000000_admin_cpf_support.sql
-- Descrição: Suporte a Administrador Master autenticado por CPF (sem CNPJ)
-- e senha exclusiva no backend (/api/auth/admin-login)
-- ==============================================================================

-- 1. Adicionar coluna CPF na tabela de perfis e permitir CNPJ nulo apenas para role = 'admin'
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS cpf VARCHAR(14) UNIQUE;

ALTER TABLE public.profiles
    ALTER COLUMN cnpj DROP NOT NULL;

ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_doc_required_chk;

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_doc_required_chk
    CHECK (
        role = 'admin'
        OR (cnpj IS NOT NULL AND LENGTH(TRIM(cnpj)) > 0)
    );

CREATE INDEX IF NOT EXISTS idx_profiles_cpf
    ON public.profiles (cpf)
    WHERE cpf IS NOT NULL;

-- 2. Atualizar trigger de auditoria WORM para usar CPF/ID como protocolo quando CNPJ for nulo (Admin)
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
            v_protocolo := 'PERFIL-' || COALESCE(NEW.cnpj, NEW.cpf, OLD.cnpj, OLD.cpf, NEW.id::TEXT, OLD.id::TEXT);
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
END;
$$;

-- ==============================================================================
-- EXEMPLO PARA PROMOVER SEU USUÁRIO ADMIN NO SUPABASE SQL EDITOR (SEM CNPJ, COM CPF):
-- 1. Crie o usuário Admin em Authentication -> Users (Add user) com e-mail e sua senha exclusiva.
-- 2. Execute o SQL abaixo substituindo o e-mail e o CPF reais do administrador:
--
-- INSERT INTO public.profiles (
--     id, email, role, cnpj, cpf, razao_social, nome_fantasia, status_aprovacao, limite_credito_escrow
-- )
-- SELECT
--     u.id,
--     u.email,
--     'admin'::public.user_role_type,
--     NULL,
--     '000.000.000-00',
--     'Administração Master Varejista Online',
--     'Admin Master',
--     'aprovado',
--     0
-- FROM auth.users u
-- WHERE u.email = 'seu-email-admin@dominio.com.br'
-- ON CONFLICT (id) DO UPDATE SET
--     role = 'admin'::public.user_role_type,
--     cnpj = NULL,
--     cpf = EXCLUDED.cpf,
--     status_aprovacao = 'aprovado';
-- ==============================================================================
