-- ==============================================================================
-- VAREJISTA ONLINE - B2B FOOD AUCTION MARKETPLACE
-- Migration: 20261121000000_sole_admin_restriction.sql
-- Descrição: Restrição fixa e exclusiva do perfil Administrador Master
-- exclusivamente para o e-mail 'mpbrue2016@gmail.com' e CPF '11567025854' (sem CNPJ).
-- ==============================================================================

-- 1. Despromover qualquer registro anterior com role = 'admin' que não corresponda ao titular fixo
UPDATE public.profiles
SET role = 'comprador'::public.user_role_type,
    perfil_comercial = CASE WHEN is_demo = TRUE THEN 'comprador' ELSE COALESCE(NULLIF(perfil_comercial, 'admin'), 'comprador') END
WHERE role = 'admin'::public.user_role_type
  AND (
    LOWER(TRIM(COALESCE(email, ''))) <> 'mpbrue2016@gmail.com'
    OR REGEXP_REPLACE(COALESCE(cpf, ''), '\D', '', 'g') <> '11567025854'
  );

-- Garantir que nenhum outro e-mail retenha o CPF reservado do Administrador Master único
UPDATE public.profiles
SET cpf = NULL
WHERE REGEXP_REPLACE(COALESCE(cpf, ''), '\D', '', 'g') = '11567025854'
  AND LOWER(TRIM(COALESCE(email, ''))) <> 'mpbrue2016@gmail.com';

-- 2. Se o titular autorizado já existir em auth.users / profiles, vincula e promove com segurança (sem CNPJ, com CPF fixo)
UPDATE public.profiles
SET role = 'admin'::public.user_role_type,
    cpf = '115.670.258-54',
    cnpj = NULL,
    tipo_pessoa = 'PF',
    perfil_comercial = 'admin',
    is_demo = FALSE,
    status_aprovacao = 'aprovado'
WHERE LOWER(TRIM(email)) = 'mpbrue2016@gmail.com';

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
    status_aprovacao,
    limite_credito_escrow
)
SELECT
    u.id,
    'mpbrue2016@gmail.com',
    'admin'::public.user_role_type,
    'PF',
    'admin',
    FALSE,
    NULL,
    '115.670.258-54',
    'Administração Master Varejista Online',
    'Admin Master',
    'aprovado',
    0
FROM auth.users u
WHERE LOWER(TRIM(u.email)) = 'mpbrue2016@gmail.com'
ON CONFLICT (id) DO UPDATE SET
    role = 'admin'::public.user_role_type,
    cnpj = NULL,
    cpf = '115.670.258-54',
    tipo_pessoa = 'PF',
    perfil_comercial = 'admin',
    is_demo = FALSE,
    status_aprovacao = 'aprovado';

-- 3. Restrição CHECK fixa na tabela public.profiles
ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_sole_admin_chk;

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_sole_admin_chk
    CHECK (
        role <> 'admin'::public.user_role_type
        OR (
            LOWER(TRIM(email)) = 'mpbrue2016@gmail.com'
            AND REGEXP_REPLACE(COALESCE(cpf, ''), '\D', '', 'g') = '11567025854'
            AND cnpj IS NULL
            AND is_demo = FALSE
        )
    );

-- 4. Trigger de blindagem no PostgreSQL impedindo qualquer criação/promoção de outro admin ou uso indevido do CPF reservado
CREATE OR REPLACE FUNCTION public.enforce_sole_admin_policy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_email TEXT := LOWER(TRIM(COALESCE(NEW.email, '')));
    v_cpf_digits TEXT := REGEXP_REPLACE(COALESCE(NEW.cpf, ''), '\D', '', 'g');
BEGIN
    IF NEW.role = 'admin'::public.user_role_type THEN
        IF v_email <> 'mpbrue2016@gmail.com' OR v_cpf_digits <> '11567025854' THEN
            RAISE EXCEPTION 'Acesso negado: apenas mpbrue2016@gmail.com com CPF 11567025854 pode assumir o perfil administrativo.';
        END IF;
        NEW.cnpj := NULL;
        NEW.cpf := '115.670.258-54';
        NEW.is_demo := FALSE;
        NEW.tipo_pessoa := 'PF';
        NEW.perfil_comercial := 'admin';
    ELSIF v_cpf_digits = '11567025854' AND v_email <> 'mpbrue2016@gmail.com' THEN
        RAISE EXCEPTION 'Operação negada: CPF reservado exclusivamente ao Administrador Master autorizado.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_enforce_sole_admin_policy ON public.profiles;
CREATE TRIGGER trigger_enforce_sole_admin_policy
    BEFORE INSERT OR UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.enforce_sole_admin_policy();

-- 5. Reforçar funções auxiliares de governança e RLS para exigirem explicitamente o titular único
CREATE OR REPLACE FUNCTION public.protect_profile_governance_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_jwt_role TEXT := COALESCE(auth.role(), '');
    v_auth_email TEXT := '';
    v_is_admin BOOLEAN := FALSE;
BEGIN
    IF v_jwt_role = 'service_role' OR current_user IN ('postgres', 'supabase_admin') THEN
        RETURN NEW;
    END IF;

    IF auth.uid() IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'
              AND p.is_demo = FALSE
              AND LOWER(TRIM(p.email)) = 'mpbrue2016@gmail.com'
              AND REGEXP_REPLACE(COALESCE(p.cpf, ''), '\D', '', 'g') = '11567025854'
        ) INTO v_is_admin;

        IF NOT v_is_admin AND NEW.id = auth.uid() THEN
            SELECT LOWER(TRIM(COALESCE(u.email, '')))
            INTO v_auth_email
            FROM auth.users u
            WHERE u.id = auth.uid();

            IF v_auth_email = 'mpbrue2016@gmail.com'
               AND REGEXP_REPLACE(COALESCE(NEW.cpf, ''), '\D', '', 'g') = '11567025854' THEN
                v_is_admin := TRUE;
            END IF;
        END IF;
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
            WHERE p.id = v_uid
              AND p.role = 'admin'
              AND p.is_demo = FALSE
              AND LOWER(TRIM(p.email)) = 'mpbrue2016@gmail.com'
              AND REGEXP_REPLACE(COALESCE(p.cpf, ''), '\D', '', 'g') = '11567025854'
        ) INTO v_is_admin;
    END IF;

    IF v_is_admin THEN
        IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF NEW.is_demo = TRUE THEN
            RAISE EXCEPTION 'Operação negada: apenas o administrador autorizado pode criar registros demonstrativos (is_demo).';
        END IF;

        IF TG_TABLE_NAME = 'bids' THEN
            SELECT COALESCE(a.is_demo, FALSE) INTO v_target_demo FROM public.auctions a WHERE a.id = NEW.auction_id;
            IF v_target_demo THEN
                RAISE EXCEPTION 'Operação negada: não é permitido enviar lances reais em lotes demonstrativos.';
            END IF;
        ELSIF TG_TABLE_NAME = 'negotiation_proposals' THEN
            SELECT COALESCE(a.is_demo, FALSE) INTO v_target_demo FROM public.auctions a WHERE a.id = NEW.auction_id;
            IF v_target_demo THEN
                RAISE EXCEPTION 'Operação negada: não é permitido enviar propostas reais em lotes demonstrativos.';
            END IF;
        ELSIF TG_TABLE_NAME = 'orders' AND NEW.auction_id IS NOT NULL THEN
            SELECT COALESCE(a.is_demo, FALSE) INTO v_target_demo FROM public.auctions a WHERE a.id = NEW.auction_id;
            IF v_target_demo THEN
                RAISE EXCEPTION 'Operação negada: não é permitido fechar pedidos reais em lotes demonstrativos.';
            END IF;
        ELSIF TG_TABLE_NAME = 'auctions' THEN
            SELECT COALESCE(pr.is_demo, FALSE) INTO v_target_demo FROM public.products pr WHERE pr.id = NEW.produto_id;
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

-- 6. Helper SECURITY DEFINER sem recursão para políticas RLS de public.profiles
CREATE OR REPLACE FUNCTION public.is_sole_master_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'admin'::public.user_role_type
          AND p.is_demo = FALSE
          AND LOWER(TRIM(COALESCE(p.email, ''))) = 'mpbrue2016@gmail.com'
          AND REGEXP_REPLACE(COALESCE(p.cpf, ''), '\D', '', 'g') = '11567025854'
    );
$$;

-- Substitui políticas auto-referenciais em profiles e libera INSERT do próprio auth.uid()
-- (o trigger enforce_sole_admin_policy e o CHECK impedem qualquer escalonamento para admin)
DROP POLICY IF EXISTS "Usuário visualiza próprio perfil" ON public.profiles;
CREATE POLICY "Usuário visualiza próprio perfil" ON public.profiles
    FOR SELECT USING (auth.uid() = id OR public.is_sole_master_admin());

DROP POLICY IF EXISTS "Usuário insere próprio perfil" ON public.profiles;
CREATE POLICY "Usuário insere próprio perfil" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Usuário atualiza próprio perfil" ON public.profiles;
CREATE POLICY "Usuário atualiza próprio perfil" ON public.profiles
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admin gerencia perfis" ON public.profiles;
CREATE POLICY "Admin gerencia perfis" ON public.profiles
    FOR ALL USING (public.is_sole_master_admin())
    WITH CHECK (public.is_sole_master_admin());

