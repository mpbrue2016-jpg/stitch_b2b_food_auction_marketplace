-- =============================================================================
-- VAREJISTA ONLINE - B2B FOOD AUCTION MARKETPLACE
-- Migration: 20261114000004_demo_data.sql
-- Descrição: Dados de demonstração completos (usuários, perfis, produtos,
-- leilões, lances, pedidos e notificações) para ambiente de homologação
-- ATENÇÃO: Senhas de demonstração - NÃO usar em produção
-- =============================================================================

-- 1. Usuários de demonstração (inserção direta em auth.users)
DO $$
DECLARE
    v_instance_id UUID;
    v_admin_id UUID := '11111111-1111-1111-1111-111111111111';
    v_comprador_id UUID := '22222222-2222-2222-2222-222222222222';
    v_fornecedor_id UUID := '33333333-3333-3333-3333-333333333333';
BEGIN
    SELECT i.id INTO v_instance_id FROM auth.instances i LIMIT 1;
    IF v_instance_id IS NULL THEN
        v_instance_id := gen_random_uuid();
    END IF;

    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
    SELECT v_admin_id, v_instance_id, 'admin@varejistaonline.com.br', crypt('Admin@123', gen_salt('bf')), now(), now(), now(),
        '{"provider":"email","providers":["email"]}'::jsonb, '{"nome":"Administrador"}'::jsonb, 'authenticated', 'authenticated'
    WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@varejistaonline.com.br');

    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
    SELECT v_comprador_id, v_instance_id, 'comprador@varejistaonline.com.br', crypt('Comprador@123', gen_salt('bf')), now(), now(), now(),
        '{"provider":"email","providers":["email"]}'::jsonb, '{"nome":"Comprador Demo"}'::jsonb, 'authenticated', 'authenticated'
    WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'comprador@varejistaonline.com.br');

    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
    SELECT v_fornecedor_id, v_instance_id, 'fornecedor@varejistaonline.com.br', crypt('Fornecedor@123', gen_salt('bf')), now(), now(), now(),
        '{"provider":"email","providers":["email"]}'::jsonb, '{"nome":"Fornecedor Demo"}'::jsonb, 'authenticated', 'authenticated'
    WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'fornecedor@varejistaonline.com.br');

    -- Perfis dos usuários
    INSERT INTO public.profiles (id, email, role, cnpj, razao_social, nome_fantasia, telefone, cidade, uf, cep, logradouro, limite_credito_escrow, status_aprovacao)
    SELECT v_admin_id, 'admin@varejistaonline.com.br', 'admin', '00.000.000/0001-00', 'Varejista Online S.A.', 'Varejista Online', '(11) 4002-8922', 'São Paulo', 'SP', '01000-000', 'Av. Paulista, 1000', 1000000, 'aprovado'
    WHERE NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_admin_id);

    INSERT INTO public.profiles (id, email, role, cnpj, razao_social, nome_fantasia, telefone, cidade, uf, cep, logradouro, limite_credito_escrow, status_aprovacao)
    SELECT v_comprador_id, 'comprador@varejistaonline.com.br', 'comprador', '12.345.678/0001-90', 'Supermercado Demo Ltda.', 'Supermercado Demo', '(11) 3333-4444', 'São Paulo', 'SP', '01310-100', 'Rua Augusta, 1200', 500000, 'aprovado'
    WHERE NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_comprador_id);

    INSERT INTO public.profiles (id, email, role, cnpj, razao_social, nome_fantasia, telefone, cidade, uf, cep, logradouro, limite_credito_escrow, status_aprovacao)
    SELECT v_fornecedor_id, 'fornecedor@varejistaonline.com.br', 'fornecedor', '98.765.432/0001-10', 'Alimentos Demo Indústria S.A.', 'Alimentos Demo', '(11) 5555-6666', 'Jundiaí', 'SP', '13200-000', 'Rod. Anhanguera, km 50', 2000000, 'aprovado'
    WHERE NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_fornecedor_id);
END $$;

-- 2. Produtos de demonstração (8 itens em categorias reais)
INSERT INTO public.products (id, fornecedor_id, categoria_id, sku, titulo, descricao, marca, fabricante, origem_cd, gtin_ean, dun14, imagem_url, unidades_por_embalagem, total_caixas, total_unidades, paletes_pbr, data_fabricacao, data_validade, status_shelf_life, laudo_sanitario_anvisa, status_fiscal, preco_referencia_mercado)
SELECT 'p1000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', c.id, 'ARROZ-INT-5KG-001', 'Arroz Integral Tio João 5kg', 'Arroz integral tipo 1, embalagem 5kg', 'Tio João', 'Arroz Tio João S.A.', 'CD Jundiaí', '7896001234567', '17896001234564', '/images/banners/banner-safra-alimentos.jpg', 20, 500, 10000, 10, CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE + INTERVAL '300 days', 'longa', TRUE, 'homologado', 28.90
FROM public.categories c WHERE c.slug = 'alimentos-secos'
AND NOT EXISTS (SELECT 1 FROM public.products WHERE sku = 'ARROZ-INT-5KG-001');

INSERT INTO public.products (id, fornecedor_id, categoria_id, sku, titulo, descricao, marca, fabricante, origem_cd, gtin_ean, dun14, imagem_url, unidades_por_embalagem, total_caixas, total_unidades, paletes_pbr, data_fabricacao, data_validade, status_shelf_life, laudo_sanitario_anvisa, status_fiscal, preco_referencia_mercado)
SELECT 'p1000000-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', c.id, 'LEITE-UHT-1L-002', 'Leite Integral UHT Italac 1L', 'Leite integral UHT, caixa com 12 unidades de 1L', 'Italac', 'Laticínios Italac S.A.', 'CD Jundiaí', '7891000100412', '17891000100419', '/images/banners/banner-atacado-pallets.jpg', 12, 800, 9600, 8, CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE + INTERVAL '120 days', 'atencao', TRUE, 'homologado', 6.50
FROM public.categories c WHERE c.slug = 'laticinios-frios'
AND NOT EXISTS (SELECT 1 FROM public.products WHERE sku = 'LEITE-UHT-1L-002');

INSERT INTO public.products (id, fornecedor_id, categoria_id, sku, titulo, descricao, marca, fabricante, origem_cd, gtin_ean, dun14, imagem_url, unidades_por_embalagem, total_caixas, total_unidades, paletes_pbr, data_fabricacao, data_validade, status_shelf_life, laudo_sanitario_anvisa, status_fiscal, preco_referencia_mercado)
SELECT 'p1000000-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', c.id, 'FEIJAO-PRETO-1KG-003', 'Feijão Preto Camil 1kg', 'Feijão preto tipo 1, pacote 1kg', 'Camil', 'Camil Alimentos S.A.', 'CD Vinhedo', '7896001234574', '17896001234571', '/images/banners/banner-safra-alimentos.jpg', 20, 600, 12000, 12, CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE + INTERVAL '365 days', 'longa', TRUE, 'homologado', 8.90
FROM public.categories c WHERE c.slug = 'alimentos-secos'
AND NOT EXISTS (SELECT 1 FROM public.products WHERE sku = 'FEIJAO-PRETO-1KG-003');

INSERT INTO public.products (id, fornecedor_id, categoria_id, sku, titulo, descricao, marca, fabricante, origem_cd, gtin_ean, dun14, imagem_url, unidades_por_embalagem, total_caixas, total_unidades, paletes_pbr, data_fabricacao, data_validade, status_shelf_life, laudo_sanitario_anvisa, status_fiscal, preco_referencia_mercado)
SELECT 'p1000000-0000-0000-0000-000000000004', '33333333-3333-3333-3333-333333333333', c.id, 'OLEO-SOYA-900ML-004', 'Óleo de Soja Soya 900ml', 'Óleo de soja refinado, fardo com 12 garrafas', 'Soya', 'Soya Alimentos Ltda.', 'CD Vinhedo', '7896001234581', '17896001234588', '/images/banners/banner-atacado-pallets.jpg', 12, 400, 4800, 4, CURRENT_DATE - INTERVAL '20 days', CURRENT_DATE + INTERVAL '240 days', 'longa', TRUE, 'homologado', 7.20
FROM public.categories c WHERE c.slug = 'mercearia-basica'
AND NOT EXISTS (SELECT 1 FROM public.products WHERE sku = 'OLEO-SOYA-900ML-004');

INSERT INTO public.products (id, fornecedor_id, categoria_id, sku, titulo, descricao, marca, fabricante, origem_cd, gtin_ean, dun14, imagem_url, unidades_por_embalagem, total_caixas, total_unidades, paletes_pbr, data_fabricacao, data_validade, status_shelf_life, laudo_sanitario_anvisa, status_fiscal, preco_referencia_mercado)
SELECT 'p1000000-0000-0000-0000-000000000005', '33333333-3333-3333-3333-333333333333', c.id, 'ACUCAR-UNIAO-5KG-005', 'Açúcar Refinado União 5kg', 'Açúcar refinado cristal, pacote 5kg', 'União', 'União S.A.', 'CD Jundiaí', '7896001234598', '17896001234595', '/images/banners/banner-safra-alimentos.jpg', 20, 350, 7000, 7, CURRENT_DATE - INTERVAL '8 days', CURRENT_DATE + INTERVAL '720 days', 'longa', TRUE, 'homologado', 14.50
FROM public.categories c WHERE c.slug = 'mercearia-basica'
AND NOT EXISTS (SELECT 1 FROM public.products WHERE sku = 'ACUCAR-UNIAO-5KG-005');

INSERT INTO public.products (id, fornecedor_id, categoria_id, sku, titulo, descricao, marca, fabricante, origem_cd, gtin_ean, dun14, imagem_url, unidades_por_embalagem, total_caixas, total_unidades, paletes_pbr, data_fabricacao, data_validade, status_shelf_life, laudo_sanitario_anvisa, status_fiscal, preco_referencia_mercado)
SELECT 'p1000000-0000-0000-0000-000000000006', '33333333-3333-3333-3333-333333333333', c.id, 'CAFE-MELITTA-500G-006', 'Café Torrado Melitta 500g', 'Café torrado e moído, pacote 500g', 'Melitta', 'Melitta do Brasil S.A.', 'CD Vinhedo', '7896001234604', '17896001234601', '/images/banners/banner-safra-alimentos.jpg', 24, 300, 7200, 6, CURRENT_DATE - INTERVAL '3 days', CURRENT_DATE + INTERVAL '180 days', 'atencao', TRUE, 'homologado', 12.90
FROM public.categories c WHERE c.slug = 'mercearia-basica'
AND NOT EXISTS (SELECT 1 FROM public.products WHERE sku = 'CAFE-MELITTA-500G-006');

INSERT INTO public.products (id, fornecedor_id, categoria_id, sku, titulo, descricao, marca, fabricante, origem_cd, gtin_ean, dun14, imagem_url, unidades_por_embalagem, total_caixas, total_unidades, paletes_pbr, data_fabricacao, data_validade, status_shelf_life, laudo_sanitario_anvisa, status_fiscal, preco_referencia_mercado)
SELECT 'p1000000-0000-0000-0000-000000000007', '33333333-3333-3333-3333-333333333333', c.id, 'CHOCOLATE-LACTA-100G-007', 'Chocolate ao Leite Lacta 100g', 'Chocolate ao leite, barra 100g', 'Lacta', 'Lacta Brasil S.A.', 'CD Jundiaí', '7622100100418', '17622100100415', '/images/banners/banner-pequenos-mercados.jpg', 48, 200, 9600, 4, CURRENT_DATE - INTERVAL '25 days', CURRENT_DATE + INTERVAL '200 days', 'atencao', TRUE, 'homologado', 5.50
FROM public.categories c WHERE c.slug = 'mercearia-doce'
AND NOT EXISTS (SELECT 1 FROM public.products WHERE sku = 'CHOCOLATE-LACTA-100G-007');

INSERT INTO public.products (id, fornecedor_id, categoria_id, sku, titulo, descricao, marca, fabricante, origem_cd, gtin_ean, dun14, imagem_url, unidades_por_embalagem, total_caixas, total_unidades, paletes_pbr, data_fabricacao, data_validade, status_shelf_life, laudo_sanitario_anvisa, status_fiscal, preco_referencia_mercado)
SELECT 'p1000000-0000-0000-0000-000000000008', '33333333-3333-3333-3333-333333333333', c.id, 'BISCOITO-PIRAQUE-400G-008', 'Biscoito Cream Cracker Piraquê 400g', 'Biscoito cream cracker, pacote 400g', 'Piraquê', 'Piraquê Alimentos S.A.', 'CD Vinhedo', '7896001234611', '17896001234618', '/images/banners/banner-pequenos-mercados.jpg', 12, 450, 5400, 5, CURRENT_DATE - INTERVAL '12 days', CURRENT_DATE + INTERVAL '90 days', 'giro_rapido', TRUE, 'homologado', 6.80
FROM public.categories c WHERE c.slug = 'mercearia-basica'
AND NOT EXISTS (SELECT 1 FROM public.products WHERE sku = 'BISCOITO-PIRAQUE-400G-008');

-- 3. Leilões de demonstração (5 lotes em diferentes status)
INSERT INTO public.auctions (id, codigo_lote, produto_id, tipo_venda, lance_inicial, lance_atual, incremento_minimo, preco_arremate_imediato, margem_estimada_revenda, total_lances, ultimo_lance_empresa, vencedor_id, termina_em, status, tipo_frete, created_at, updated_at)
SELECT 'a1000000-0000-0000-0000-000000000001', 'LOTE-418', p.id, 'leilao', 15000.00, 18500.00, 500.00, 25000.00, 25, 3, 'Supermercado Demo', NULL, CURRENT_TIMESTAMP + INTERVAL '2 days', 'ativo', 'FOB', now(), now()
FROM public.products p WHERE p.sku = 'CAFE-MELITTA-500G-006'
AND NOT EXISTS (SELECT 1 FROM public.auctions WHERE codigo_lote = 'LOTE-418');

INSERT INTO public.auctions (id, codigo_lote, produto_id, tipo_venda, lance_inicial, lance_atual, incremento_minimo, preco_arremate_imediato, margem_estimada_revenda, total_lances, ultimo_lance_empresa, vencedor_id, termina_em, status, tipo_frete, created_at, updated_at)
SELECT 'a1000000-0000-0000-0000-000000000002', 'LOTE-419', p.id, 'leilao', 8000.00, 9200.00, 200.00, 12000.00, 22, 2, 'Supermercado Demo', NULL, CURRENT_TIMESTAMP + INTERVAL '5 days', 'ativo', 'CIF', now(), now()
FROM public.products p WHERE p.sku = 'ARROZ-INT-5KG-001'
AND NOT EXISTS (SELECT 1 FROM public.auctions WHERE codigo_lote = 'LOTE-419');

INSERT INTO public.auctions (id, codigo_lote, produto_id, tipo_venda, lance_inicial, lance_atual, incremento_minimo, preco_arremate_imediato, margem_estimada_revenda, total_lances, ultimo_lance_empresa, vencedor_id, termina_em, status, tipo_frete, created_at, updated_at)
SELECT 'a1000000-0000-0000-0000-000000000003', 'LOTE-420', p.id, 'giro_rapido', 5000.00, 5000.00, 100.00, 7500.00, 18, 0, NULL, NULL, CURRENT_TIMESTAMP + INTERVAL '6 hours', 'reta_final', 'FOB', now(), now()
FROM public.products p WHERE p.sku = 'LEITE-UHT-1L-002'
AND NOT EXISTS (SELECT 1 FROM public.auctions WHERE codigo_lote = 'LOTE-420');

INSERT INTO public.auctions (id, codigo_lote, produto_id, tipo_venda, lance_inicial, lance_atual, incremento_minimo, preco_arremate_imediato, margem_estimada_revenda, total_lances, ultimo_lance_empresa, vencedor_id, termina_em, status, tipo_frete, created_at, updated_at)
SELECT 'a1000000-0000-0000-0000-000000000004', 'LOTE-421', p.id, 'venda_direta', 3000.00, 3500.00, 100.00, NULL, 20, 1, 'Supermercado Demo', '22222222-2222-2222-2222-222222222222', CURRENT_TIMESTAMP - INTERVAL '1 day', 'homologado', 'CIF', now(), now()
FROM public.products p WHERE p.sku = 'OLEO-SOYA-900ML-004'
AND NOT EXISTS (SELECT 1 FROM public.auctions WHERE codigo_lote = 'LOTE-421');

INSERT INTO public.auctions (id, codigo_lote, produto_id, tipo_venda, lance_inicial, lance_atual, incremento_minimo, preco_arremate_imediato, margem_estimada_revenda, total_lances, ultimo_lance_empresa, vencedor_id, termina_em, status, tipo_frete, created_at, updated_at)
SELECT 'a1000000-0000-0000-0000-000000000005', 'LOTE-422', p.id, 'leilao', 2000.00, 2400.00, 100.00, 3500.00, 30, 1, 'Supermercado Demo', NULL, CURRENT_TIMESTAMP + INTERVAL '3 days', 'ativo', 'FOB', now(), now()
FROM public.products p WHERE p.sku = 'CHOCOLATE-LACTA-100G-007'
AND NOT EXISTS (SELECT 1 FROM public.auctions WHERE codigo_lote = 'LOTE-422');

-- 4. Lances de demonstração (histórico de lances nos leilões ativos)
INSERT INTO public.bids (id, auction_id, comprador_id, valor_lance, valor_unitario, ip_origem, hash_transacao_worm, created_at)
SELECT 'b1000000-0000-0000-0000-000000000001', a.id, '22222222-2222-2222-2222-222222222222', 15000.00, 1.50, '127.0.0.1', encode(digest('lance-418-1', 'sha256'), 'hex'), CURRENT_TIMESTAMP - INTERVAL '3 hours'
FROM public.auctions a WHERE a.codigo_lote = 'LOTE-418'
AND NOT EXISTS (SELECT 1 FROM public.bids WHERE id = 'b1000000-0000-0000-0000-000000000001');

INSERT INTO public.bids (id, auction_id, comprador_id, valor_lance, valor_unitario, ip_origem, hash_transacao_worm, created_at)
SELECT 'b1000000-0000-0000-0000-000000000002', a.id, '22222222-2222-2222-2222-222222222222', 16500.00, 1.65, '127.0.0.1', encode(digest('lance-418-2', 'sha256'), 'hex'), CURRENT_TIMESTAMP - INTERVAL '2 hours'
FROM public.auctions a WHERE a.codigo_lote = 'LOTE-418'
AND NOT EXISTS (SELECT 1 FROM public.bids WHERE id = 'b1000000-0000-0000-0000-000000000002');

INSERT INTO public.bids (id, auction_id, comprador_id, valor_lance, valor_unitario, ip_origem, hash_transacao_worm, created_at)
SELECT 'b1000000-0000-0000-0000-000000000003', a.id, '22222222-2222-2222-2222-222222222222', 18500.00, 1.85, '127.0.0.1', encode(digest('lance-418-3', 'sha256'), 'hex'), CURRENT_TIMESTAMP - INTERVAL '30 minutes'
FROM public.auctions a WHERE a.codigo_lote = 'LOTE-418'
AND NOT EXISTS (SELECT 1 FROM public.bids WHERE id = 'b1000000-0000-0000-0000-000000000003');

INSERT INTO public.bids (id, auction_id, comprador_id, valor_lance, valor_unitario, ip_origem, hash_transacao_worm, created_at)
SELECT 'b1000000-0000-0000-0000-000000000004', a.id, '22222222-2222-2222-2222-222222222222', 8000.00, 0.80, '127.0.0.1', encode(digest('lance-419-1', 'sha256'), 'hex'), CURRENT_TIMESTAMP - INTERVAL '1 day'
FROM public.auctions a WHERE a.codigo_lote = 'LOTE-419'
AND NOT EXISTS (SELECT 1 FROM public.bids WHERE id = 'b1000000-0000-0000-0000-000000000004');

INSERT INTO public.bids (id, auction_id, comprador_id, valor_lance, valor_unitario, ip_origem, hash_transacao_worm, created_at)
SELECT 'b1000000-0000-0000-0000-000000000005', a.id, '22222222-2222-2222-2222-222222222222', 9200.00, 0.92, '127.0.0.1', encode(digest('lance-419-2', 'sha256'), 'hex'), CURRENT_TIMESTAMP - INTERVAL '12 hours'
FROM public.auctions a WHERE a.codigo_lote = 'LOTE-419'
AND NOT EXISTS (SELECT 1 FROM public.bids WHERE id = 'b1000000-0000-0000-0000-000000000005');

INSERT INTO public.bids (id, auction_id, comprador_id, valor_lance, valor_unitario, ip_origem, hash_transacao_worm, created_at)
SELECT 'b1000000-0000-0000-0000-000000000006', a.id, '22222222-2222-2222-2222-222222222222', 3500.00, 0.35, '127.0.0.1', encode(digest('lance-421-1', 'sha256'), 'hex'), CURRENT_TIMESTAMP - INTERVAL '2 days'
FROM public.auctions a WHERE a.codigo_lote = 'LOTE-421'
AND NOT EXISTS (SELECT 1 FROM public.bids WHERE id = 'b1000000-0000-0000-0000-000000000006');

-- 5. Pedido de demonstração (LOTE-421 homologado com escrow ativo)
INSERT INTO public.orders (id, codigo_pedido, auction_id, comprador_id, fornecedor_id, valor_total_arremate, percentual_comissao, valor_comissao_plataforma, valor_repasse_liquido, status_pagamento, status_logistica, doca_agendada, termo_arremate_hash, comprovante_pix_spi, created_at, updated_at)
SELECT 'o1000000-0000-0000-0000-000000000001', 'PED-2026-0001', a.id, '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', 3500.00, 6.00, 210.00, 3290.00, 'em_custodia_escrow', 'agendamento_doca', 'CD Vinhedo • Doca 02A', encode(digest('termo-arremate-421', 'sha256'), 'hex'), encode(digest('pix-spi-demo-001', 'sha256'), 'hex'), now(), now()
FROM public.auctions a WHERE a.codigo_lote = 'LOTE-421'
AND NOT EXISTS (SELECT 1 FROM public.orders WHERE codigo_pedido = 'PED-2026-0001');

-- 6. Notificações de demonstração
INSERT INTO public.notifications (id, user_id, titulo, mensagem, canal, lido, created_at)
SELECT 'n1000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Bem-vindo ao Varejista Online', 'Seu cadastro foi aprovado e seu limite de crédito escrow de R$ 500.000,00 está liberado para lances.', 'in_app', FALSE, now()
WHERE NOT EXISTS (SELECT 1 FROM public.notifications WHERE id = 'n1000000-0000-0000-0000-000000000001');

INSERT INTO public.notifications (id, user_id, titulo, mensagem, canal, lido, created_at)
SELECT 'n1000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'LOTE-418: Novo lance registrado', 'Seu lance de R$ 18.500,00 foi registrado no LOTE-418 (Café Torrado Melitta 500g).', 'in_app', FALSE, now()
WHERE NOT EXISTS (SELECT 1 FROM public.notifications WHERE id = 'n1000000-0000-0000-0000-000000000002');

INSERT INTO public.notifications (id, user_id, titulo, mensagem, canal, lido, created_at)
SELECT 'n1000000-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 'LOTE-421 homologado', 'O leilão LOTE-421 foi homologado. Pedido PED-2026-0001 criado com escrow D+0 ativo.', 'email', TRUE, now()
WHERE NOT EXISTS (SELECT 1 FROM public.notifications WHERE id = 'n1000000-0000-0000-0000-000000000003');

-- =============================================================================
-- Fim da migration 000004 - Dados de demonstração
-- Usuários criados:
--   admin@varejistaonline.com.br       (senha: Admin@123)
--   comprador@varejistaonline.com.br   (senha: Comprador@123)
--   fornecedor@varejistaonline.com.br  (senha: Fornecedor@123)
-- ATENÇÃO: Senhas de demonstração - NÃO usar em produção
-- =============================================================================