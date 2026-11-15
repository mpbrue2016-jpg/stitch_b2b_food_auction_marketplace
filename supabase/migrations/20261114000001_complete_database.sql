-- ==============================================================================
-- VAREJISTA ONLINE - B2B FOOD AUCTION MARKETPLACE
-- Migration: 20261114000001_complete_database.sql
-- Descrição: Tabelas adicionais, triggers de auditoria, documentos fiscais,
-- configurações do sistema e subcategorias completas
-- ==============================================================================

-- 1. Tabela de Subcategorias
CREATE TABLE IF NOT EXISTS public.subcategories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    icone VARCHAR(50) DEFAULT 'category',
    descricao TEXT,
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(category_id, slug)
);

-- 2. Tabela de Logs de Webhooks ERP
CREATE TABLE IF NOT EXISTS public.webhooks_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    endpoint VARCHAR(255) NOT NULL,
    metodo VARCHAR(10) NOT NULL DEFAULT 'POST',
    status_code INT,
    payload_request JSONB,
    payload_response JSONB,
    erro TEXT,
    tempo_resposta_ms INT,
    origem_ip VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 3. Tabela de Documentos Fiscais (NF-e, MDF-e, DAMDFE)
CREATE TABLE IF NOT EXISTS public.fiscal_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    tipo_documento VARCHAR(20) NOT NULL CHECK (tipo_documento IN ('nfe', 'danfe', 'mdf', 'damdf_cte', 'cte')),
    chave_acesso VARCHAR(44) NOT NULL UNIQUE,
    numero_nf INT,
    serie VARCHAR(10),
    cnpj_emitente VARCHAR(18),
    cnpj_destinatario VARCHAR(18),
    valor_total NUMERIC(15, 2),
    status VARCHAR(30) DEFAULT 'processando',
    xml_url TEXT,
    danfe_url TEXT,
    protocolo_autorizacao VARCHAR(50),
    motivo_rejeicao TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 4. Tabela de Configurações do Sistema
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chave VARCHAR(100) NOT NULL UNIQUE,
    valor TEXT,
    descricao TEXT,
    tipo VARCHAR(30) DEFAULT 'string',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 5. Tabela de Carrinho de Compras (sessão)
CREATE TABLE IF NOT EXISTS public.carts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id),
    status VARCHAR(30) DEFAULT 'aberto',
    total_itens INT DEFAULT 0,
    valor_total NUMERIC(15, 2) DEFAULT 0.00,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (TIMEZONE('utc', NOW()) + INTERVAL '7 days'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 6. Tabela de Itens do Carrinho
CREATE TABLE IF NOT EXISTS public.cart_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cart_id UUID NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id),
    quantidade INT NOT NULL DEFAULT 1,
    valor_unitario NUMERIC(15, 2) NOT NULL,
    valor_total NUMERIC(15, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 7. Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Triggers de updated_at nas tabelas principais
CREATE TRIGGER trigger_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_categories_updated_at
    BEFORE UPDATE ON public.categories
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_subcategories_updated_at
    BEFORE UPDATE ON public.subcategories
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_auctions_updated_at
    BEFORE UPDATE ON public.auctions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_bids_updated_at
    BEFORE UPDATE ON public.bids
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_system_settings_updated_at
    BEFORE UPDATE ON public.system_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_carts_updated_at
    BEFORE UPDATE ON public.carts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_cart_items_updated_at
    BEFORE UPDATE ON public.cart_items
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_fiscal_documents_updated_at
    BEFORE UPDATE ON public.fiscal_documents
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. Índices adicionais para performance
CREATE INDEX IF NOT EXISTS idx_subcategories_category ON public.subcategories(category_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_logs_endpoint ON public.webhooks_logs(endpoint);
CREATE INDEX IF NOT EXISTS idx_webhooks_logs_created_at ON public.webhooks_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_order ON public.fiscal_documents(order_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_chave ON public.fiscal_documents(chave_acesso);
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_status ON public.fiscal_documents(status);
CREATE INDEX IF NOT EXISTS idx_system_settings_chave ON public.system_settings(chave);
CREATE INDEX IF NOT EXISTS idx_carts_user ON public.carts(user_id);
CREATE INDEX IF NOT EXISTS idx_carts_status ON public.carts(status);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON public.cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product ON public.cart_items(product_id);

-- 10. Políticas RLS para novas tabelas
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhooks_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

-- Leitura pública de subcategorias ativas
CREATE POLICY "Subcategorias ativas visíveis para todos" ON public.subcategories
    FOR SELECT USING (ativo = TRUE);

-- Webhooks: apenas administradores veem
CREATE POLICY "Apenas admin acessa webhooks" ON public.webhooks_logs
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Documentos fiscais: comprador e fornecedor veem os próprios
CREATE POLICY "Partes veem documentos fiscais próprios" ON public.fiscal_documents
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = fiscal_documents.order_id
            AND (o.comprador_id = auth.uid() OR o.fornecedor_id = auth.uid())
        )
    );

-- Configurações do sistema: apenas leitura para todos
CREATE POLICY "Configurações públicas de leitura" ON public.system_settings
    FOR SELECT USING (true);

-- Carrinho: usuário vê apenas seus próprios carrinhos
CREATE POLICY "Usuário gerencia seu próprio carrinho" ON public.carts
    FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Usuário gerencia itens do próprio carrinho" ON public.cart_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.carts c WHERE c.id = cart_items.cart_id
            AND (c.user_id = auth.uid() OR c.user_id IS NULL)
        )
    );