-- ==============================================================================
-- VAREJISTA ONLINE - B2B FOOD AUCTION MARKETPLACE
-- Migration: 20261120000000_demo_vs_real_separation.sql
-- Descrição: Separação estrutural e de segurança entre AMBIENTE MODELO (is_demo = TRUE)
-- e AMBIENTE ORIGINAL (is_demo = FALSE), suporte a Pessoa Física (CPF) e Jurídica (CNPJ),
-- políticas RLS endurecidas e triggers bloqueando mutação/conversão de dados modelo.
-- ==============================================================================

-- 1. Colunas de separação de ambiente e perfil cadastral em public.profiles
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS tipo_pessoa VARCHAR(2) NOT NULL DEFAULT 'PJ',
    ADD COLUMN IF NOT EXISTS perfil_comercial VARCHAR(40) NOT NULL DEFAULT 'comprador';

DO $$ BEGIN
    ALTER TABLE public.profiles
        DROP CONSTRAINT IF EXISTS profiles_tipo_pessoa_chk;
    ALTER TABLE public.profiles
        ADD CONSTRAINT profiles_tipo_pessoa_chk CHECK (tipo_pessoa IN ('PF', 'PJ'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_doc_required_chk;

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_doc_required_chk
    CHECK (
        role = 'admin'
        OR (tipo_pessoa = 'PF' AND cpf IS NOT NULL AND LENGTH(TRIM(cpf)) > 0)
        OR (tipo_pessoa = 'PJ' AND cnpj IS NOT NULL AND LENGTH(TRIM(cnpj)) > 0)
    );

-- 2. Coluna is_demo nas demais tabelas transacionais e de catálogo
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.auctions
    ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.bids
    ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.negotiation_proposals
    ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.dock_appointments
    ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.home_banners
    ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Backfill seguro dos registros demonstrativos pré-semeados (20261114000004 & 20261117000000)
UPDATE public.profiles
SET is_demo = TRUE,
    perfil_comercial = CASE WHEN role = 'admin' THEN 'admin' ELSE role::TEXT END
WHERE id IN (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333'
);

UPDATE public.products
SET is_demo = TRUE
WHERE id::TEXT LIKE 'p1000000-%'
   OR fornecedor_id = '33333333-3333-3333-3333-333333333333';

UPDATE public.auctions
SET is_demo = TRUE
WHERE id::TEXT LIKE 'a1000000-%'
   OR EXISTS (
       SELECT 1 FROM public.products p
       WHERE p.id = auctions.produto_id AND p.is_demo = TRUE
   );

UPDATE public.bids
SET is_demo = TRUE
WHERE id::TEXT LIKE 'b1000000-%'
   OR EXISTS (
       SELECT 1 FROM public.auctions a
       WHERE a.id = bids.auction_id AND a.is_demo = TRUE
   );

UPDATE public.orders
SET is_demo = TRUE
WHERE id::TEXT LIKE 'o1000000-%'
   OR codigo_pedido = 'PED-2026-0001';

UPDATE public.notifications
SET is_demo = TRUE
WHERE id::TEXT LIKE 'n1000000-%';

UPDATE public.home_banners
SET is_demo = TRUE
WHERE id::TEXT LIKE 'd1000000-%';

-- 4. Índices para filtragem rápida por ambiente (Modelo vs Original)
CREATE INDEX IF NOT EXISTS idx_profiles_is_demo ON public.profiles(is_demo);
CREATE INDEX IF NOT EXISTS idx_products_is_demo ON public.products(is_demo);
CREATE INDEX IF NOT EXISTS idx_auctions_is_demo ON public.auctions(is_demo, status);
CREATE INDEX IF NOT EXISTS idx_bids_is_demo ON public.bids(is_demo, auction_id);
CREATE INDEX IF NOT EXISTS idx_orders_is_demo ON public.orders(is_demo, comprador_id, fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_proposals_is_demo ON public.negotiation_proposals(is_demo);
CREATE INDEX IF NOT EXISTS idx_banners_is_demo ON public.home_banners(is_demo, ativo, ordem);

-- 5. Atualizar trigger handle_new_user(): usuários reais SEMPRE nascem com is_demo = FALSE
-- Suporta Pessoa Física (CPF) e Pessoa Jurídica (CNPJ), bloqueando auto-promoção para admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_meta JSONB := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
    v_requested_role TEXT := COALESCE(v_meta->>'role', 'comprador');
    v_safe_role public.user_role_type;
    v_tipo_pessoa VARCHAR(2);
    v_perfil_comercial VARCHAR(40);
    v_cnpj VARCHAR(18);
    v_cpf VARCHAR(14);
    v_razao VARCHAR(255);
    v_fantasia VARCHAR(255);
BEGIN
    v_safe_role := CASE
        WHEN v_requested_role = 'fornecedor' THEN 'fornecedor'::public.user_role_type
        ELSE 'comprador'::public.user_role_type
    END;

    v_tipo_pessoa := CASE
        WHEN UPPER(COALESCE(v_meta->>'tipo_pessoa', 'PJ')) = 'PF' THEN 'PF'
        ELSE 'PJ'
    END;

    v_perfil_comercial := COALESCE(
        NULLIF(TRIM(COALESCE(v_meta->>'perfil_comercial', '')), ''),
        v_safe_role::TEXT
    );
    IF v_perfil_comercial = 'admin' THEN
        v_perfil_comercial := v_safe_role::TEXT;
    END IF;

    v_cpf := NULLIF(TRIM(COALESCE(v_meta->>'cpf', '')), '');
    v_cnpj := NULLIF(TRIM(COALESCE(v_meta->>'cnpj', '')), '');

    IF v_tipo_pessoa = 'PF' THEN
        IF v_cpf IS NULL THEN
            v_cpf := 'PEND-' || UPPER(SUBSTRING(REPLACE(NEW.id::TEXT, '-', ''), 1, 9));
        END IF;
        -- Pessoa física não exige CNPJ
    ELSE
        IF v_cnpj IS NULL THEN
            v_cnpj := 'PEND-' || UPPER(SUBSTRING(REPLACE(NEW.id::TEXT, '-', ''), 1, 13));
        END IF;
    END IF;

    v_razao := COALESCE(
        NULLIF(TRIM(COALESCE(v_meta->>'razao_social', '')), ''),
        CASE WHEN v_tipo_pessoa = 'PF' THEN 'Operador Pessoa Física' ELSE 'Empresa em Homologação B2B' END
    );
    v_fantasia := COALESCE(NULLIF(TRIM(COALESCE(v_meta->>'nome_fantasia', '')), ''), v_razao);

    INSERT INTO public.profiles (
        id,
        email,
        role,
        tipo_pessoa,
        perfil_comercial,
        is_demo,
        cnpj,
        cpf,
        razao_social,
        nome_fantasia,
        inscricao_estadual,
        cnae,
        telefone,
        cidade,
        uf,
        cep,
        logradouro,
        limite_credito_escrow,
        status_aprovacao
    ) VALUES (
        NEW.id,
        COALESCE(NEW.email, NEW.id::TEXT || '@placeholder.local'),
        v_safe_role,
        v_tipo_pessoa,
        v_perfil_comercial,
        FALSE,
        v_cnpj,
        v_cpf,
        v_razao,
        v_fantasia,
        NULLIF(v_meta->>'inscricao_estadual', ''),
        NULLIF(v_meta->>'cnae', ''),
        NULLIF(v_meta->>'telefone', ''),
        COALESCE(NULLIF(v_meta->>'cidade', ''), 'São Paulo'),
        COALESCE(NULLIF(UPPER(SUBSTRING(v_meta->>'uf', 1, 2)), ''), 'SP'),
        NULLIF(v_meta->>'cep', ''),
        NULLIF(v_meta->>'logradouro', ''),
        CASE WHEN v_safe_role = 'comprador' THEN 100000.00 ELSE 0.00 END,
        'em_analise'
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;

-- 6. Função de blindagem no banco de dados contra alteração/conversão de dados modelo
CREATE OR REPLACE FUNCTION public.enforce_demo_separation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_jwt_role TEXT := COALESCE(auth.role(), '');
    v_is_admin BOOLEAN := FALSE;
    v_target_demo BOOLEAN := FALSE;
BEGIN
    IF v_jwt_role = 'service_role' OR current_user IN ('postgres', 'supabase_admin') THEN
        v_is_admin := TRUE;
    ELSIF v_uid IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = v_uid AND p.role = 'admin' AND p.is_demo = FALSE
        ) INTO v_is_admin;
    END IF;

    IF v_is_admin THEN
        IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF NEW.is_demo = TRUE THEN
            RAISE EXCEPTION 'Operação negada: apenas administradores autorizados podem criar registros demonstrativos (is_demo).';
        END IF;

        IF TG_TABLE_NAME = 'bids' THEN
            SELECT COALESCE(a.is_demo, FALSE) INTO v_target_demo
            FROM public.auctions a WHERE a.id = NEW.auction_id;
            IF v_target_demo THEN
                RAISE EXCEPTION 'Operação negada: não é permitido enviar lances reais em lotes demonstrativos.';
            END IF;
        ELSIF TG_TABLE_NAME = 'negotiation_proposals' THEN
            SELECT COALESCE(a.is_demo, FALSE) INTO v_target_demo
            FROM public.auctions a WHERE a.id = NEW.auction_id;
            IF v_target_demo THEN
                RAISE EXCEPTION 'Operação negada: não é permitido enviar propostas reais em lotes demonstrativos.';
            END IF;
        ELSIF TG_TABLE_NAME = 'orders' AND NEW.auction_id IS NOT NULL THEN
            SELECT COALESCE(a.is_demo, FALSE) INTO v_target_demo
            FROM public.auctions a WHERE a.id = NEW.auction_id;
            IF v_target_demo THEN
                RAISE EXCEPTION 'Operação negada: não é permitido fechar pedidos reais em lotes demonstrativos.';
            END IF;
        ELSIF TG_TABLE_NAME = 'auctions' THEN
            SELECT COALESCE(pr.is_demo, FALSE) INTO v_target_demo
            FROM public.products pr WHERE pr.id = NEW.produto_id;
            IF v_target_demo THEN
                RAISE EXCEPTION 'Operação negada: não é permitido vincular leilões reais a produtos demonstrativos.';
            END IF;
        END IF;

        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD.is_demo = TRUE OR NEW.is_demo IS DISTINCT FROM OLD.is_demo THEN
            RAISE EXCEPTION 'Operação negada: registros demonstrativos são imutáveis para usuários comuns e não podem ser convertidos em dados reais.';
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' THEN
        IF OLD.is_demo = TRUE THEN
            RAISE EXCEPTION 'Operação negada: registros demonstrativos não podem ser removidos por usuários comuns.';
        END IF;
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$;

-- Trigger específico de proteção em profiles (usuário comum não muda is_demo/role/status_aprovacao/limite)
CREATE OR REPLACE FUNCTION public.protect_profile_governance_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_jwt_role TEXT := COALESCE(auth.role(), '');
    v_is_admin BOOLEAN := FALSE;
BEGIN
    IF v_jwt_role = 'service_role' OR current_user IN ('postgres', 'supabase_admin') THEN
        RETURN NEW;
    END IF;

    IF auth.uid() IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'admin' AND p.is_demo = FALSE
        ) INTO v_is_admin;
    END IF;

    IF NOT v_is_admin THEN
        IF OLD.is_demo = TRUE OR NEW.is_demo IS DISTINCT FROM OLD.is_demo THEN
            RAISE EXCEPTION 'Perfis modelo não podem ser modificados nem convertidos.';
        END IF;
        IF NEW.role IS DISTINCT FROM OLD.role
           OR NEW.status_aprovacao IS DISTINCT FROM OLD.status_aprovacao
           OR NEW.limite_credito_escrow IS DISTINCT FROM OLD.limite_credito_escrow THEN
            RAISE EXCEPTION 'Alteração de perfil/aprovação/limite requer autorização administrativa.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_protect_profile_governance ON public.profiles;
CREATE TRIGGER trigger_protect_profile_governance
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.protect_profile_governance_fields();

DROP TRIGGER IF EXISTS trigger_demo_sep_products ON public.products;
CREATE TRIGGER trigger_demo_sep_products
    BEFORE INSERT OR UPDATE OR DELETE ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.enforce_demo_separation();

DROP TRIGGER IF EXISTS trigger_demo_sep_auctions ON public.auctions;
CREATE TRIGGER trigger_demo_sep_auctions
    BEFORE INSERT OR UPDATE OR DELETE ON public.auctions
    FOR EACH ROW EXECUTE FUNCTION public.enforce_demo_separation();

DROP TRIGGER IF EXISTS trigger_demo_sep_bids ON public.bids;
CREATE TRIGGER trigger_demo_sep_bids
    BEFORE INSERT OR UPDATE OR DELETE ON public.bids
    FOR EACH ROW EXECUTE FUNCTION public.enforce_demo_separation();

DROP TRIGGER IF EXISTS trigger_demo_sep_orders ON public.orders;
CREATE TRIGGER trigger_demo_sep_orders
    BEFORE INSERT OR UPDATE OR DELETE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.enforce_demo_separation();

DROP TRIGGER IF EXISTS trigger_demo_sep_proposals ON public.negotiation_proposals;
CREATE TRIGGER trigger_demo_sep_proposals
    BEFORE INSERT OR UPDATE OR DELETE ON public.negotiation_proposals
    FOR EACH ROW EXECUTE FUNCTION public.enforce_demo_separation();

DROP TRIGGER IF EXISTS trigger_demo_sep_docks ON public.dock_appointments;
CREATE TRIGGER trigger_demo_sep_docks
    BEFORE INSERT OR UPDATE OR DELETE ON public.dock_appointments
    FOR EACH ROW EXECUTE FUNCTION public.enforce_demo_separation();

DROP TRIGGER IF EXISTS trigger_demo_sep_banners ON public.home_banners;
CREATE TRIGGER trigger_demo_sep_banners
    BEFORE INSERT OR UPDATE OR DELETE ON public.home_banners
    FOR EACH ROW EXECUTE FUNCTION public.enforce_demo_separation();

-- 7. Reforço de RLS para impedir mutações em registros is_demo por não-admins
DROP POLICY IF EXISTS "Fornecedor ou admin gerencia seus produtos" ON public.products;
CREATE POLICY "Fornecedor ou admin gerencia seus produtos" ON public.products
    FOR ALL USING (
        (fornecedor_id = auth.uid() AND is_demo = FALSE)
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin' AND p.is_demo = FALSE)
    )
    WITH CHECK (
        (fornecedor_id = auth.uid() AND is_demo = FALSE)
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin' AND p.is_demo = FALSE)
    );

DROP POLICY IF EXISTS "Fornecedor ou admin cria e atualiza leilões" ON public.auctions;
CREATE POLICY "Fornecedor ou admin cria e atualiza leilões" ON public.auctions
    FOR ALL USING (
        (
            is_demo = FALSE
            AND EXISTS (
                SELECT 1 FROM public.products prod
                WHERE prod.id = auctions.produto_id AND prod.fornecedor_id = auth.uid() AND prod.is_demo = FALSE
            )
        )
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin' AND p.is_demo = FALSE)
    )
    WITH CHECK (
        (
            is_demo = FALSE
            AND EXISTS (
                SELECT 1 FROM public.products prod
                WHERE prod.id = auctions.produto_id AND prod.fornecedor_id = auth.uid() AND prod.is_demo = FALSE
            )
        )
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin' AND p.is_demo = FALSE)
    );

DROP POLICY IF EXISTS "Compradores autenticados podem enviar lances" ON public.bids;
CREATE POLICY "Compradores autenticados podem enviar lances" ON public.bids
    FOR INSERT WITH CHECK (
        auth.uid() = comprador_id
        AND is_demo = FALSE
        AND EXISTS (
            SELECT 1 FROM public.auctions a
            WHERE a.id = bids.auction_id AND a.is_demo = FALSE
        )
    );

DROP POLICY IF EXISTS "Compradores autenticados ou admin criam pedidos" ON public.orders;
CREATE POLICY "Compradores autenticados ou admin criam pedidos" ON public.orders
    FOR INSERT WITH CHECK (
        (auth.uid() = comprador_id AND is_demo = FALSE)
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin' AND p.is_demo = FALSE)
    );

DROP POLICY IF EXISTS "Partes envolvidas ou admin atualizam pedidos" ON public.orders;
CREATE POLICY "Partes envolvidas ou admin atualizam pedidos" ON public.orders
    FOR UPDATE USING (
        ((auth.uid() = comprador_id OR auth.uid() = fornecedor_id) AND is_demo = FALSE)
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin' AND p.is_demo = FALSE)
    )
    WITH CHECK (
        ((auth.uid() = comprador_id OR auth.uid() = fornecedor_id) AND is_demo = FALSE)
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin' AND p.is_demo = FALSE)
    );

DROP POLICY IF EXISTS "Comprador ou admin cria proposta" ON public.negotiation_proposals;
CREATE POLICY "Comprador ou admin cria proposta" ON public.negotiation_proposals
    FOR INSERT WITH CHECK (
        (
            auth.uid() = comprador_id
            AND is_demo = FALSE
            AND EXISTS (
                SELECT 1 FROM public.auctions a
                WHERE a.id = negotiation_proposals.auction_id AND a.is_demo = FALSE
            )
        )
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin' AND p.is_demo = FALSE)
    );

DROP POLICY IF EXISTS "Partes ou admin respondem proposta" ON public.negotiation_proposals;
CREATE POLICY "Partes ou admin respondem proposta" ON public.negotiation_proposals
    FOR UPDATE USING (
        ((auth.uid() = comprador_id OR auth.uid() = fornecedor_id) AND is_demo = FALSE)
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin' AND p.is_demo = FALSE)
    )
    WITH CHECK (
        ((auth.uid() = comprador_id OR auth.uid() = fornecedor_id) AND is_demo = FALSE)
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin' AND p.is_demo = FALSE)
    );
