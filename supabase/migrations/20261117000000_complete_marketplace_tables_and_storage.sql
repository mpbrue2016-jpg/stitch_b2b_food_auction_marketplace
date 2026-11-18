-- ==============================================================================
-- VAREJISTA ONLINE - B2B FOOD AUCTION MARKETPLACE
-- Migration: 20261117000000_complete_marketplace_tables_and_storage.sql
-- Descrição: Tabelas complementares (negociações, docas, banners, KYC, pagamentos),
-- trigger auth.users -> profiles, colunas extras, Storage buckets e RLS
-- ==============================================================================

-- 1. Colunas complementares em products, auctions e orders
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS embalagem VARCHAR(160);

ALTER TABLE public.auctions
    ADD COLUMN IF NOT EXISTS raio_km INT NOT NULL DEFAULT 45;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS taxa_escrow_bancaria NUMERIC(15, 2) NOT NULL DEFAULT 3.85;

-- Preencher embalagem padrão onde nulo
UPDATE public.products
SET embalagem = 'Caixa c/ ' || GREATEST(unidades_por_embalagem, 1)::TEXT || ' un'
WHERE embalagem IS NULL;

-- 2. Trigger de sincronização automática auth.users -> public.profiles
-- IMPORTANTE: Nunca permite auto-cadastro como 'admin'. Apenas 'comprador' ou 'fornecedor'.
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
    v_cnpj VARCHAR(18);
    v_razao VARCHAR(255);
    v_fantasia VARCHAR(255);
BEGIN
    v_safe_role := CASE
        WHEN v_requested_role = 'fornecedor' THEN 'fornecedor'::public.user_role_type
        ELSE 'comprador'::public.user_role_type
    END;

    v_cnpj := NULLIF(TRIM(COALESCE(v_meta->>'cnpj', '')), '');
    IF v_cnpj IS NULL THEN
        v_cnpj := 'PEND-' || UPPER(SUBSTRING(REPLACE(NEW.id::TEXT, '-', ''), 1, 13));
    END IF;

    v_razao := COALESCE(NULLIF(TRIM(COALESCE(v_meta->>'razao_social', '')), ''), 'Empresa em Homologação B2B');
    v_fantasia := COALESCE(NULLIF(TRIM(COALESCE(v_meta->>'nome_fantasia', '')), ''), v_razao);

    INSERT INTO public.profiles (
        id,
        email,
        role,
        cnpj,
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
        v_cnpj,
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Tabela de Negociações B2B Diretas (Propostas e Contrapropostas)
CREATE TABLE IF NOT EXISTS public.negotiation_proposals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auction_id UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
    comprador_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    fornecedor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    quantidade_caixas INT NOT NULL CHECK (quantidade_caixas > 0),
    preco_unitario_ofertado NUMERIC(15, 2) NOT NULL CHECK (preco_unitario_ofertado > 0),
    valor_total_proposta NUMERIC(15, 2) NOT NULL CHECK (valor_total_proposta > 0),
    contraproposta_preco_unitario NUMERIC(15, 2),
    status VARCHAR(30) NOT NULL DEFAULT 'pendente'
        CHECK (status IN ('pendente', 'aceita', 'recusada', 'contraproposta')),
    mensagem TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_proposals_auction ON public.negotiation_proposals(auction_id);
CREATE INDEX IF NOT EXISTS idx_proposals_comprador ON public.negotiation_proposals(comprador_id);
CREATE INDEX IF NOT EXISTS idx_proposals_fornecedor ON public.negotiation_proposals(fornecedor_id);

-- 4. Tabela de Agendamento de Docas (Logística FOB)
CREATE TABLE IF NOT EXISTS public.dock_appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    comprador_id UUID NOT NULL REFERENCES public.profiles(id),
    fornecedor_id UUID NOT NULL REFERENCES public.profiles(id),
    cd_origem VARCHAR(255) NOT NULL,
    doca_numero VARCHAR(60) NOT NULL,
    janela_horaria VARCHAR(60) NOT NULL,
    data_agendada DATE NOT NULL,
    placa_veiculo VARCHAR(12) NOT NULL,
    motorista_nome VARCHAR(120) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'agendado'
        CHECK (status IN ('agendado', 'em_doca', 'conferido_cega', 'liberado')),
    passe_entrada_hash VARCHAR(128) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Previne conflito simultâneo na mesma doca/data/janela enquanto não liberada
CREATE UNIQUE INDEX IF NOT EXISTS uq_dock_slot_active
    ON public.dock_appointments(cd_origem, doca_numero, data_agendada, janela_horaria)
    WHERE status != 'liberado';

CREATE INDEX IF NOT EXISTS idx_dock_order ON public.dock_appointments(order_id);

-- 5. Tabela de Banners Rotativos da Home
CREATE TABLE IF NOT EXISTS public.home_banners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    titulo VARCHAR(120) NOT NULL,
    subtitulo VARCHAR(220) NOT NULL DEFAULT '',
    eyebrow VARCHAR(90) NOT NULL DEFAULT 'Campanha Oficial Varejista Online',
    cta_label VARCHAR(40) NOT NULL DEFAULT 'Explorar Lotes',
    cta_href VARCHAR(255) NOT NULL DEFAULT '/catalogo',
    imagem_url TEXT NOT NULL,
    ordem INT NOT NULL DEFAULT 1,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    intervalo_segundos INT NOT NULL DEFAULT 6 CHECK (intervalo_segundos BETWEEN 3 AND 30),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 6. Tabela de Documentos KYC & Compliance Sanitário
CREATE TABLE IF NOT EXISTS public.user_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    tipo_documento VARCHAR(60) NOT NULL
        CHECK (tipo_documento IN ('contrato_social', 'alvara_sanitario', 'cartao_cnpj', 'laudo_anvisa', 'outro')),
    nome_arquivo VARCHAR(255) NOT NULL,
    storage_path TEXT NOT NULL,
    mime_type VARCHAR(100),
    tamanho_bytes INT,
    status_validacao VARCHAR(30) NOT NULL DEFAULT 'em_analise'
        CHECK (status_validacao IN ('em_analise', 'aprovado', 'rejeitado')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_user_documents_user ON public.user_documents(user_id);

-- 7. Tabela de Transações de Pagamento PIX / Escrow
CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    txid VARCHAR(64) NOT NULL UNIQUE,
    metodo VARCHAR(30) NOT NULL DEFAULT 'pix_escrow',
    valor NUMERIC(15, 2) NOT NULL,
    pix_copia_cola TEXT NOT NULL,
    e2e_id VARCHAR(80),
    status VARCHAR(30) NOT NULL DEFAULT 'pendente'
        CHECK (status IN ('pendente', 'pago', 'liquidado_d0', 'em_disputa', 'estornado')),
    paid_at TIMESTAMP WITH TIME ZONE,
    webhook_payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_payment_tx_order ON public.payment_transactions(order_id);

-- 8. Triggers de updated_at e Auditoria WORM nas novas tabelas
CREATE TRIGGER trigger_proposals_updated_at
    BEFORE UPDATE ON public.negotiation_proposals
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_dock_updated_at
    BEFORE UPDATE ON public.dock_appointments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_banners_updated_at
    BEFORE UPDATE ON public.home_banners
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_user_docs_updated_at
    BEFORE UPDATE ON public.user_documents
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_payment_tx_updated_at
    BEFORE UPDATE ON public.payment_transactions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_audit_proposals
    AFTER INSERT OR UPDATE OR DELETE ON public.negotiation_proposals
    FOR EACH ROW EXECUTE FUNCTION public.audit_worm_trigger();

CREATE TRIGGER trigger_audit_dock
    AFTER INSERT OR UPDATE OR DELETE ON public.dock_appointments
    FOR EACH ROW EXECUTE FUNCTION public.audit_worm_trigger();

CREATE TRIGGER trigger_audit_commission_rules
    AFTER INSERT OR UPDATE OR DELETE ON public.commission_rules
    FOR EACH ROW EXECUTE FUNCTION public.audit_worm_trigger();

-- 9. RLS nas novas tabelas
ALTER TABLE public.negotiation_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dock_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- Propostas: comprador, fornecedor envolvido ou admin
CREATE POLICY "Partes veem suas negociações" ON public.negotiation_proposals
    FOR SELECT USING (
        auth.uid() = comprador_id
        OR auth.uid() = fornecedor_id
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    );

CREATE POLICY "Comprador ou admin cria proposta" ON public.negotiation_proposals
    FOR INSERT WITH CHECK (
        auth.uid() = comprador_id
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    );

CREATE POLICY "Partes ou admin respondem proposta" ON public.negotiation_proposals
    FOR UPDATE USING (
        auth.uid() = comprador_id
        OR auth.uid() = fornecedor_id
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    );

-- Docas: comprador, fornecedor envolvido ou admin
CREATE POLICY "Partes veem agendamentos de doca" ON public.dock_appointments
    FOR SELECT USING (
        auth.uid() = comprador_id
        OR auth.uid() = fornecedor_id
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    );

CREATE POLICY "Comprador ou admin agenda doca" ON public.dock_appointments
    FOR INSERT WITH CHECK (
        auth.uid() = comprador_id
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    );

CREATE POLICY "Fornecedor ou admin atualiza status doca" ON public.dock_appointments
    FOR UPDATE USING (
        auth.uid() = fornecedor_id
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    );

-- Banners: leitura pública; gestão exclusiva admin
CREATE POLICY "Banners visíveis publicamente" ON public.home_banners
    FOR SELECT USING (true);

CREATE POLICY "Admin gerencia banners" ON public.home_banners
    FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Documentos KYC: dono ou admin
CREATE POLICY "Usuário vê próprios documentos KYC" ON public.user_documents
    FOR SELECT USING (
        auth.uid() = user_id
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    );

CREATE POLICY "Usuário envia próprios documentos KYC" ON public.user_documents
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin valida documentos KYC" ON public.user_documents
    FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Transações PIX: comprador, fornecedor do pedido ou admin
CREATE POLICY "Partes veem transações PIX do pedido" ON public.payment_transactions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = payment_transactions.order_id
            AND (o.comprador_id = auth.uid() OR o.fornecedor_id = auth.uid())
        )
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    );

-- 10. Garantir categorias completas (incluindo Cerealista & Grãos) e Regras de Comissão
INSERT INTO public.categories (id, nome, slug, icone, descricao) VALUES
('c1000000-0000-0000-0000-000000000001', 'Alimentos Secos & Mercearia', 'alimentos-secos', 'inventory_2', 'Arroz, feijão, farinhas, massas e mercearia seca em fardos'),
('c1000000-0000-0000-0000-000000000002', 'Laticínios & Frios', 'laticinios-frios', 'egg_alt', 'Leites UHT, queijos, manteigas e iogurtes com cadeia fria'),
('c1000000-0000-0000-0000-000000000003', 'Bebidas & Sucos', 'bebidas-sucos', 'local_drink', 'Sucos integrais, refrigerantes, águas minerais e cervejas'),
('c1000000-0000-0000-0000-000000000004', 'Óleos, Azeites & Gorduras', 'mercearia-basica', 'kitchen', 'Óleos vegetais de soja, milho, azeites, açúcar e sal'),
('c1000000-0000-0000-0000-000000000005', 'Doces, Biscoitos & Bomboniere', 'mercearia-doce', 'cookie', 'Biscoitos recheados, chocolates, leite condensado e doces'),
('c1000000-0000-0000-0000-000000000006', 'Higiene & Limpeza', 'higiene-limpeza', 'cleaning_services', 'Desinfetantes, detergentes e descartáveis industriais'),
('c1000000-0000-0000-0000-000000000007', 'Cerealista & Grãos', 'cerealista', 'grain', 'Sacaria de arroz, feijão, milho, soja, aveia e grãos beneficiados'),
('c1000000-0000-0000-0000-000000000008', 'Hortifruti & Frescos', 'hortifruti', 'eco', 'Produtos frescos, orgânicos e processados minimamente')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.commission_rules (id, nome_modalidade, slug, percentual_padrao, taxa_minima, descricao, ativo) VALUES
('r1000000-0000-0000-0000-000000000001', 'Leilões Industriais Padrão (Pregão)', 'leilao', 6.00, 150.00, 'Comissão padrão aplicada sobre pregões eletrônicos de grande volume.', TRUE),
('r1000000-0000-0000-0000-000000000002', 'Giro Rápido & Validade Próxima (FEFO)', 'giro_rapido', 8.50, 100.00, 'Taxa para liquidação acelerada de lotes com validade inferior a 60 dias.', TRUE),
('r1000000-0000-0000-0000-000000000003', 'Venda Direta & Cargas Fechadas (FOB)', 'venda_direta', 5.00, 200.00, 'Negociação direta de pallets fechados direto da fábrica.', TRUE),
('r1000000-0000-0000-0000-000000000004', 'Intermediação & Arbitragem Especial B2B', 'operacao_especial', 20.00, 500.00, 'Operações com garantia integral de recompra ou lotes de alto valor agregado.', TRUE)
ON CONFLICT (slug) DO NOTHING;

-- 11. Seed inicial dos 4 Banners Oficiais
INSERT INTO public.home_banners (id, eyebrow, titulo, subtitulo, cta_label, cta_href, imagem_url, ordem, ativo, intervalo_segundos)
SELECT 'd1000000-0000-0000-0000-000000000001', 'Pequenos Mercados & Minimercados · Estoque Parado', 'Tem Estoque Parado no Seu Mercado? Transforme em Dinheiro Hoje', 'Liquide fardos encalhados, sobras de compra ou itens perto do vencimento para mais de 3.140 compradores com custódia Escrow D+0.', 'Liquidar Meu Estoque Parado', '/produtos/novo?modelo=pequeno_mercado', '/images/banners/banner-pequenos-mercados.jpg', 1, TRUE, 6
WHERE NOT EXISTS (SELECT 1 FROM public.home_banners WHERE id = 'd1000000-0000-0000-0000-000000000001');

INSERT INTO public.home_banners (id, eyebrow, titulo, subtitulo, cta_label, cta_href, imagem_url, ordem, ativo, intervalo_segundos)
SELECT 'd1000000-0000-0000-0000-000000000002', 'Rodada Industrial SP · Custódia Escrow BACEN', 'Cargas Fechadas direto da Indústria com até 70% OFF', 'Negocie paletes PBR homologados ANVISA/MAPA com repasse D+0 garantido e retirada FOB agendada em 48 horas.', 'Explorar Leilões ao Vivo', '/leiloes', '/images/banners/banner-atacado-pallets.jpg', 2, TRUE, 6
WHERE NOT EXISTS (SELECT 1 FROM public.home_banners WHERE id = 'd1000000-0000-0000-0000-000000000002');

INSERT INTO public.home_banners (id, eyebrow, titulo, subtitulo, cta_label, cta_href, imagem_url, ordem, ativo, intervalo_segundos)
SELECT 'd1000000-0000-0000-0000-000000000003', 'Pregões Multi-Setor · Cerealista, Hortifruti & Limpeza', 'Cerealista, Hortifruti CEASA e Higiene e Limpeza em Lotes', 'Arroz, feijão em sacaria, caixas frescas de hortifruti e combos de limpeza com deságio imediato para mercados e atacarejos.', 'Filtrar Pregões por Segmento', '/leiloes', '/images/banners/banner-safra-alimentos.jpg', 3, TRUE, 6
WHERE NOT EXISTS (SELECT 1 FROM public.home_banners WHERE id = 'd1000000-0000-0000-0000-000000000003');

INSERT INTO public.home_banners (id, eyebrow, titulo, subtitulo, cta_label, cta_href, imagem_url, ordem, ativo, intervalo_segundos)
SELECT 'd1000000-0000-0000-0000-000000000004', 'Liquidez Imediata · Escoamento B2B', 'Transforme Estoque Parado em Liquidez em até 48 Horas', 'Publique pontas de lote com NF-e integrada, agendamento de doca no CD e pagamento protegido via PIX SPI.', 'Anunciar Lote Agora', '/produtos/novo', '/images/banners/banner-logistica-docas.jpg', 4, TRUE, 6
WHERE NOT EXISTS (SELECT 1 FROM public.home_banners WHERE id = 'd1000000-0000-0000-0000-000000000004');

-- 12. Storage Buckets (kyc-docs privado, lot-images público leitura, banners público leitura)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    ('kyc-docs', 'kyc-docs', FALSE, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
    ('lot-images', 'lot-images', TRUE, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
    ('banners', 'banners', TRUE, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage
DO $$ BEGIN
    CREATE POLICY "Leitura pública de imagens de lotes" ON storage.objects
        FOR SELECT USING (bucket_id IN ('lot-images', 'banners'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Fornecedor e admin enviam imagens de lotes" ON storage.objects
        FOR INSERT WITH CHECK (
            bucket_id = 'lot-images'
            AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('fornecedor', 'admin'))
        );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Admin envia imagens de banners" ON storage.objects
        FOR INSERT WITH CHECK (
            bucket_id = 'banners'
            AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
        );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Usuário envia e lê próprios docs KYC" ON storage.objects
        FOR ALL USING (
            bucket_id = 'kyc-docs'
            AND (
                (storage.foldername(name))[1] = auth.uid()::TEXT
                OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
            )
        )
        WITH CHECK (
            bucket_id = 'kyc-docs'
            AND (
                (storage.foldername(name))[1] = auth.uid()::TEXT
                OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
            )
        );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 13. Habilitar Realtime nas tabelas de lances, leilões, negociações e pedidos
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.auctions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bids;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.negotiation_proposals;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
