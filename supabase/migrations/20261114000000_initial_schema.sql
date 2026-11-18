-- ==============================================================================
-- VAREJISTA ONLINE - B2B FOOD AUCTION MARKETPLACE
-- Migration: 20261114000000_initial_schema.sql
-- Descrição: Estrutura completa de tabelas, relacionamentos, índices e RLS
-- ==============================================================================

-- 1. Extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Enums
DO $$ BEGIN
    CREATE TYPE user_role_type AS ENUM ('comprador', 'fornecedor', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE auction_status_type AS ENUM ('ativo', 'reta_final', 'encerrado', 'homologado', 'cancelado');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE shelf_life_status_type AS ENUM ('longa', 'atencao', 'giro_rapido', 'critica');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status_type AS ENUM ('aguardando_pagamento', 'em_custodia_escrow', 'repasse_liquidado_d0', 'estornado');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE logistics_status_type AS ENUM ('agendamento_doca', 'em_transito_fob', 'conferido_doca', 'entregue', 'divergencia');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Tabela de Perfis de Usuário (Integrada ao Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    role user_role_type NOT NULL DEFAULT 'comprador',
    cnpj VARCHAR(18) NOT NULL UNIQUE,
    razao_social VARCHAR(255) NOT NULL,
    nome_fantasia VARCHAR(255) NOT NULL,
    inscricao_estadual VARCHAR(50),
    cnae VARCHAR(100),
    telefone VARCHAR(30),
    cidade VARCHAR(100) DEFAULT 'São Paulo',
    uf VARCHAR(2) DEFAULT 'SP',
    cep VARCHAR(10),
    logradouro VARCHAR(255),
    limite_credito_escrow NUMERIC(15, 2) DEFAULT 100000.00,
    status_aprovacao VARCHAR(30) DEFAULT 'aprovado',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 4. Tabela de Categorias
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    icone VARCHAR(50) DEFAULT 'category',
    descricao TEXT,
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 5. Tabela de Produtos / Lotes Físicos
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fornecedor_id UUID NOT NULL REFERENCES public.profiles(id),
    categoria_id UUID NOT NULL REFERENCES public.categories(id),
    sku VARCHAR(100) NOT NULL UNIQUE,
    titulo VARCHAR(255) NOT NULL,
    descricao TEXT,
    marca VARCHAR(100) NOT NULL,
    fabricante VARCHAR(255) NOT NULL,
    origem_cd VARCHAR(255) NOT NULL,
    gtin_ean VARCHAR(14) NOT NULL,
    dun14 VARCHAR(14),
    imagem_url TEXT,
    unidades_por_embalagem INT NOT NULL DEFAULT 1,
    total_caixas INT NOT NULL DEFAULT 1,
    total_unidades INT NOT NULL DEFAULT 1,
    paletes_pbr INT NOT NULL DEFAULT 1,
    data_fabricacao DATE,
    data_validade DATE NOT NULL,
    status_shelf_life shelf_life_status_type DEFAULT 'longa',
    laudo_sanitario_anvisa BOOLEAN DEFAULT TRUE,
    status_fiscal VARCHAR(30) DEFAULT 'homologado',
    preco_referencia_mercado NUMERIC(15, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 6. Tabela de Leilões / Pregões
CREATE TABLE IF NOT EXISTS public.auctions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo_lote VARCHAR(50) NOT NULL UNIQUE,
    produto_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    tipo_venda VARCHAR(30) DEFAULT 'leilao',
    lance_inicial NUMERIC(15, 2) NOT NULL,
    lance_atual NUMERIC(15, 2) NOT NULL,
    incremento_minimo NUMERIC(15, 2) NOT NULL DEFAULT 500.00,
    preco_arremate_imediato NUMERIC(15, 2),
    margem_estimada_revenda INT DEFAULT 40,
    total_lances INT DEFAULT 0,
    ultimo_lance_empresa VARCHAR(255),
    vencedor_id UUID REFERENCES public.profiles(id),
    termina_em TIMESTAMP WITH TIME ZONE NOT NULL,
    status auction_status_type DEFAULT 'ativo',
    tipo_frete VARCHAR(10) DEFAULT 'FOB',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 7. Tabela de Lances (Bids)
CREATE TABLE IF NOT EXISTS public.bids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auction_id UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
    comprador_id UUID NOT NULL REFERENCES public.profiles(id),
    valor_lance NUMERIC(15, 2) NOT NULL,
    valor_unitario NUMERIC(15, 2) NOT NULL,
    ip_origem VARCHAR(45),
    hash_transacao_worm TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 8. Tabela de Regras de Comissões Administrativas (Take-Rate)
CREATE TABLE IF NOT EXISTS public.commission_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome_modalidade VARCHAR(100) NOT NULL,
    slug VARCHAR(50) NOT NULL UNIQUE,
    percentual_padrao NUMERIC(5, 2) NOT NULL DEFAULT 6.00,
    descricao TEXT,
    taxa_minima NUMERIC(15, 2) DEFAULT 0.00,
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 9. Tabela de Pedidos & Custódia Escrow
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo_pedido VARCHAR(50) NOT NULL UNIQUE,
    auction_id UUID REFERENCES public.auctions(id),
    comprador_id UUID NOT NULL REFERENCES public.profiles(id),
    fornecedor_id UUID NOT NULL REFERENCES public.profiles(id),
    valor_total_arremate NUMERIC(15, 2) NOT NULL,
    percentual_comissao NUMERIC(5, 2) NOT NULL,
    valor_comissao_plataforma NUMERIC(15, 2) NOT NULL,
    valor_repasse_liquido NUMERIC(15, 2) NOT NULL,
    status_pagamento payment_status_type DEFAULT 'aguardando_pagamento',
    status_logistica logistics_status_type DEFAULT 'agendamento_doca',
    doca_agendada VARCHAR(255),
    termo_arremate_hash TEXT,
    comprovante_pix_spi TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 10. Tabela de Notificações Multicanal
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    titulo VARCHAR(255) NOT NULL,
    mensagem TEXT NOT NULL,
    canal VARCHAR(30) DEFAULT 'push',
    lido BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 11. Tabela de Auditoria WORM & Trilha de Governança Criptográfica
CREATE TABLE IF NOT EXISTS public.audit_worm_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo_evento VARCHAR(100) NOT NULL,
    protocolo VARCHAR(100) NOT NULL,
    payload_json JSONB NOT NULL,
    merkle_root_hash VARCHAR(128) NOT NULL,
    responsavel_id UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 12. Índices para Otimização de Consultas de Alta Frequência
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(categoria_id);
CREATE INDEX IF NOT EXISTS idx_products_validade ON public.products(data_validade);
CREATE INDEX IF NOT EXISTS idx_products_ean ON public.products(gtin_ean);
CREATE INDEX IF NOT EXISTS idx_auctions_status ON public.auctions(status);
CREATE INDEX IF NOT EXISTS idx_auctions_termina_em ON public.auctions(termina_em);
CREATE INDEX IF NOT EXISTS idx_bids_auction ON public.bids(auction_id);
CREATE INDEX IF NOT EXISTS idx_orders_comprador ON public.orders(comprador_id);
CREATE INDEX IF NOT EXISTS idx_orders_fornecedor ON public.orders(fornecedor_id);

-- 13. Políticas de Segurança RLS (Row Level Security)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Perfis: usuário vê/edita próprio perfil; admin vê/gerencia todos
CREATE POLICY "Usuário visualiza próprio perfil" ON public.profiles
    FOR SELECT USING (auth.uid() = id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Usuário atualiza próprio perfil" ON public.profiles
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Admin gerencia perfis" ON public.profiles
    FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Regras de Leitura Pública
CREATE POLICY "Leilões públicos visíveis para todos" ON public.auctions
    FOR SELECT USING (true);

CREATE POLICY "Fornecedor ou admin cria e atualiza leilões" ON public.auctions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.products prod
            WHERE prod.id = auctions.produto_id AND prod.fornecedor_id = auth.uid()
        )
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    );

CREATE POLICY "Produtos do catálogo visíveis para todos" ON public.products
    FOR SELECT USING (true);

CREATE POLICY "Fornecedor ou admin gerencia seus produtos" ON public.products
    FOR ALL USING (
        fornecedor_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    );

CREATE POLICY "Categorias visíveis para todos" ON public.categories
    FOR SELECT USING (true);

CREATE POLICY "Admin gerencia categorias" ON public.categories
    FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Regras de comissão visíveis para todos" ON public.commission_rules
    FOR SELECT USING (true);

CREATE POLICY "Admin gerencia regras de comissão" ON public.commission_rules
    FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Regras de Criação e Gestão de Lances
CREATE POLICY "Compradores autenticados podem enviar lances" ON public.bids
    FOR INSERT WITH CHECK (auth.uid() = comprador_id);

CREATE POLICY "Lances de leilões visíveis para todos" ON public.bids
    FOR SELECT USING (true);

-- Regras de Pedidos
CREATE POLICY "Compradores, fornecedores e admin veem pedidos pertinentes" ON public.orders
    FOR SELECT USING (
        auth.uid() = comprador_id
        OR auth.uid() = fornecedor_id
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    );

CREATE POLICY "Compradores autenticados ou admin criam pedidos" ON public.orders
    FOR INSERT WITH CHECK (
        auth.uid() = comprador_id
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    );

CREATE POLICY "Partes envolvidas ou admin atualizam pedidos" ON public.orders
    FOR UPDATE USING (
        auth.uid() = comprador_id
        OR auth.uid() = fornecedor_id
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    );

-- Notificações
CREATE POLICY "Usuário visualiza e marca suas notificações" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Usuário atualiza suas notificações" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admin gerencia notificações" ON public.notifications
    FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
