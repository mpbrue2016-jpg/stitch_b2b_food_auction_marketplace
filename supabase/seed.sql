-- ==============================================================================
-- VAREJISTA ONLINE - B2B FOOD AUCTION MARKETPLACE
-- Seed Data: supabase/seed.sql
-- Dados iniciais do marketplace B2B alinhados ao projeto Stitch
-- ==============================================================================

-- 1. Categorias Oficiais
INSERT INTO public.categories (id, nome, slug, icone, descricao) VALUES
('c1000000-0000-0000-0000-000000000001', 'Alimentos Secos & Grãos', 'alimentos-secos', 'grain', 'Arroz, feijão, farinhas, massas e cereais em fardos e sacarias'),
('c1000000-0000-0000-0000-000000000002', 'Laticínios & Refrigerados', 'laticinios-frios', 'egg_alt', 'Leites UHT, queijos, manteigas e iogurtes com cadeia fria'),
('c1000000-0000-0000-0000-000000000003', 'Bebidas & Sucos', 'bebidas-sucos', 'local_drink', 'Sucos integrais, refrigerantes, águas minerais e cervejas'),
('c1000000-0000-0000-0000-000000000004', 'Mercearia Básica & Óleos', 'mercearia-basica', 'kitchen', 'Óleos vegetais de soja, milho, azeites, açúcar e sal'),
('c1000000-0000-0000-0000-000000000005', 'Doces, Biscoitos & Chocolates', 'mercearia-doce', 'cookie', 'Biscoitos recheados, chocolates, leite condensado e doces'),
('c1000000-0000-0000-0000-000000000006', 'Higiene & Conservação', 'higiene-limpeza', 'cleaning_services', 'Desinfetantes, detergentes e descartáveis industriais'),
('c1000000-0000-0000-0000-000000000007', 'Carnes & Embutidos', 'carnes-embutidos', 'kebab_dining', 'Carnes bovinas, suínas, aves e embutidos congelados'),
('c1000000-0000-0000-0000-000000000008', 'Frutas, Verduras & Legumes', 'hortifruti', 'eco', 'Produtos frescos, orgânicos e processados minimamente'),
('c1000000-0000-0000-0000-000000000009', 'Congelados & Prontos', 'congelados-prontos', 'ac_unit', 'Pratos prontos, pizzas, batatas, vegetais congelados'),
('c1000000-0000-0000-0000-000000000010', 'Pet Food & Acessórios', 'pet-food', 'pets', 'Ração, petiscos e acessórios para animais de estimação')
ON CONFLICT (slug) DO NOTHING;

-- 2. Subcategorias
INSERT INTO public.subcategories (category_id, nome, slug, icone, descricao) VALUES
('c1000000-0000-0000-0000-000000000001', 'Arroz & Derivados', 'arroz-derivados', 'grain', 'Arroz branco, integral, parboilizado, arbóreo'),
('c1000000-0000-0000-0000-000000000001', 'Feijão & Leguminosas', 'feijao-leguminosas', 'grain', 'Feijão preto, carioca, branco, lentilha, grão-de-bico'),
('c1000000-0000-0000-0000-000000000001', 'Farinhas & Massas', 'farinhas-massas', 'bakery', 'Farinhas de trigo, milho, mandioca, massas secas'),
('c1000000-0000-0000-0000-000000000001', 'Cereais Matinais', 'cereais-matinais', 'bowl', 'Aveia, corn flakes, granola, muesli'),
('c1000000-0000-0000-0000-000000000002', 'Leites UHT', 'leites-uht', 'water_drop', 'Leite integral, desnatado, semidesnatado, A2, vegetais'),
('c1000000-0000-0000-0000-000000000002', 'Queijos', 'queijos', 'cheese', 'Muçarela, prato, cheddar, minas, parmesão, cottage'),
('c1000000-0000-0000-0000-000000000002', 'Iogurtes & Fermentados', 'iogurtes-fermentados', 'yogurt', 'Iogurte natural, grego, bebidas lácteas, kefir'),
('c1000000-0000-0000-0000-000000000002', 'Manteigas & Cremes', 'manteigas-cremes', 'butter', 'Manteiga com/sem sal, creme de leite, requeijão'),
('c1000000-0000-0000-0000-000000000003', 'Sucos Integrais & Néctar', 'sucos-integrais', 'local_drink', 'Sucos 100% fruta, néctares, polpas congeladas'),
('c1000000-0000-0000-0000-000000000003', 'Refrigerantes', 'refrigerantes', 'sports_bar', 'Colas, guaraná, citrus, zero açúcar'),
('c1000000-0000-0000-0000-000000000003', 'Águas Minerais', 'aguas-minerais', 'water', 'Com/sem gás, aromatizadas, alcalinas'),
('c1000000-0000-0000-0000-000000000003', 'Cervejas & Alcoólicos', 'cervejas-alcoolicos', 'sports_bar', 'Cervejas pilsen, artesanais, vinhos, destilados'),
('c1000000-0000-0000-0000-000000000004', 'Óleos Vegetais', 'oleos-vegetais', 'oil_barrel', 'Óleo de soja, milho, girassol, canola, coco'),
('c1000000-0000-0000-0000-000000000004', 'Azeites & Vinagres', 'azeites-vinagres', 'wine_bar', 'Azeite extra virgem, balsâmico, vinagre de maçã/álcool'),
('c1000000-0000-0000-0000-000000000004', 'Açúcares & Adoçantes', 'acucares-adocantes', 'cake', 'Açúcar refinado, cristal, demerara, xilitol, stevia'),
('c1000000-0000-0000-0000-000000000004', 'Sal & Temperos', 'sal-temperos', 'salt', 'Sal grosso, refinado, rosa, temperos prontos'),
('c1000000-0000-0000-0000-000000000005', 'Biscoitos Salgados', 'biscoitos-salgados', 'cracker', 'Cream cracker, água e sal, integrais, club social'),
('c1000000-0000-0000-0000-000000000005', 'Biscoitos Doces & Recheados', 'biscoitos-doces', 'cookie', 'Recheados, maria, maisena, champanhe, wafers'),
('c1000000-0000-0000-0000-000000000005', 'Chocolates & Bombons', 'chocolates-bombons', 'cake', 'Barras, bombons, trufas, ovos de páscoa'),
('c1000000-0000-0000-0000-000000000005', 'Leite Condensado & Doces de Leite', 'leite-condensado-doces', 'icecream', 'Latas, sachês, doce de leite pastoso'),
('c1000000-0000-0000-0000-000000000006', 'Desinfetantes & Limpadores', 'desinfetantes-limpadores', 'cleaning_services', 'Multiuso, banheiro, cozinha, cloro, álcool'),
('c1000000-0000-0000-0000-000000000006', 'Detergentes & Sabões', 'detergentes-saboes', 'local_laundry_service', 'Lava-louças, lava-roupas, amaciantes, sabão em pó'),
('c1000000-0000-0000-0000-000000000006', 'Descartáveis Industriais', 'descartaveis-industriais', 'inventory', 'Luvas, toucas, aventais, papel toalha, sacos lixo'),
('c1000000-0000-0000-0000-000000000007', 'Carnes Bovinas', 'carnes-bovinas', 'kebab_dining', 'Cortes nobres, traseiro, dianteiro, moída'),
('c1000000-0000-0000-0000-000000000007', 'Carnes Suínas', 'carnes-suinas', 'kebab_dining', 'Lombo, pernil, costela, bacon, toucinho'),
('c1000000-0000-0000-0000-000000000007', 'Aves & Ovos', 'aves-ovos', 'egg', 'Frango inteiro, cortes, ovos brancos/vermelhos'),
('c1000000-0000-0000-0000-000000000007', 'Embutidos & Frios', 'embutidos-frios', 'kebab_dining', 'Presunto, mortadela, salame, salsicha, linguiça'),
('c1000000-0000-0000-0000-000000000008', 'Frutas Frescas', 'frutas-frescas', 'apple', 'Tropicais, cítricas, vermelhas, de época'),
('c1000000-0000-0000-0000-000000000008', 'Verduras & Folhosas', 'verduras-folhosas', 'eco', 'Alface, rúcula, espinafre, couve, agrião'),
('c1000000-0000-0000-0000-000000000008', 'Legumes & Raízes', 'legumes-raizes', 'carrot', 'Batata, cebola, cenoura, tomate, abóbora'),
('c1000000-0000-0000-0000-000000000008', 'Processados Mínimos', 'processados-minimos', 'cut', 'Cortados, higienizados, ralados, porcionados'),
('c1000000-0000-0000-0000-000000000009', 'Pratos Prontos', 'pratos-prontos', 'restaurant', 'Lasanha, escondidinho, strogonoff, feijoada'),
('c1000000-0000-0000-0000-000000000009', 'Pizzas & Salgados', 'pizzas-salgados', 'pizza', 'Pizzas congeladas, coxinhas, empadas, pastéis'),
('c1000000-0000-0000-0000-000000000009', 'Vegetais Congelados', 'vegetais-congelados', 'ac_unit', 'Ervilha, milho, brócolis, mix de legumes'),
('c1000000-0000-0000-0000-000000000009', 'Batatas & Pré-fritos', 'batatas-pre-fritos', 'fries', 'Batata frita, smile, palito, rústica, mandioca'),
('c1000000-0000-0000-0000-000000000010', 'Ração Seca Cães', 'racao-seca-caes', 'pets', 'Premium, super premium, filhote, adulto, sênior'),
('c1000000-0000-0000-0000-000000000010', 'Ração Seca Gatos', 'racao-seca-gatos', 'pets', 'Premium, super premium, filhote, adulto, sênior'),
('c1000000-0000-0000-0000-000000000010', 'Ração Úmida & Sachês', 'racao-umida-sache', 'pets', 'Pates, tiras, pedaços em molho/gelatina'),
('c1000000-0000-0000-0000-000000000010', 'Petiscos & Acessórios', 'petiscos-acessorios', 'toys', 'Biscoitos, ossos, brinquedos, camas, comedouros')
ON CONFLICT (category_id, slug) DO NOTHING;

-- 3. Configurações do Sistema
INSERT INTO public.system_settings (chave, valor, descricao, tipo) VALUES
('app_name', 'Varejista Online', 'Nome da aplicação', 'string'),
('app_version', '1.0.0', 'Versão atual da aplicação', 'string'),
('max_bid_increment', '500', 'Incremento mínimo padrão para lances (centavos)', 'number'),
('default_auction_duration_hours', '72', 'Duração padrão de leilões em horas', 'number'),
('escrow_default_limit', '100000', 'Limite de crédito escrow padrão (centavos)', 'number'),
('pix_timeout_minutes', '15', 'Timeout para confirmação PIX em minutos', 'number'),
('anti_sniping_extension_minutes', '5', 'Extensão anti-sniping em minutos', 'number'),
('max_commission_percentage', '20', 'Comissão máxima permitida (%)', 'number'),
('min_commission_percentage', '5', 'Comissão mínima permitida (%)', 'number'),
('enable_ai_assistant', 'true', 'Habilita assistente Gemini AI', 'boolean'),
('maintenance_mode', 'false', 'Modo de manutenção', 'boolean'),
('logistics_fob_only', 'true', 'Apenas frete FOB (origem)', 'boolean'),
('default_credit_limit', '10000000', 'Limite de crédito padrão para novos compradores (centavos)', 'number'),
('anvisa_required', 'true', 'Exige laudo sanitário ANVISA para alimentos', 'boolean'),
('gs1_validation_enabled', 'true', 'Validação de códigos GS1 (EAN/DUN) ativa', 'boolean'),
('webhook_retry_attempts', '3', 'Tentativas de retry para webhooks ERP', 'number'),
('webhook_retry_delay_seconds', '60', 'Delay entre retries de webhook (segundos)', 'number'),
('notification_channels', '["push", "email", "whatsapp"]', 'Canais de notificação disponíveis', 'json'),
('supported_document_types', '["nfe", "danfe", "mdf", "cte", "damdf_cte"]', 'Tipos de documentos fiscais suportados', 'json')
ON CONFLICT (chave) DO NOTHING;

-- 4. Regras de Comissões Parametrizáveis (Take-Rate)
INSERT INTO public.commission_rules (id, nome_modalidade, slug, percentual_padrao, taxa_minima, descricao, ativo) VALUES
('r1000000-0000-0000-0000-000000000001', 'Leilões Industriais Padrão (Pregão)', 'leilao', 6.00, 150.00, 'Comissão administrativa padrão sobre leilões eletrônicos de grande volume.', TRUE),
('r1000000-0000-0000-0000-000000000002', 'Giro Rápido & Validade Próxima (FEFO)', 'giro_rapido', 8.50, 100.00, 'Taxa para liquidação acelerada de lotes com validade inferior a 60 dias.', TRUE),
('r1000000-0000-0000-0000-000000000003', 'Venda Direta & Cargas Fechadas (FOB)', 'venda_direta', 5.00, 200.00, 'Negociação direta de pallets fechados direto da fábrica.', TRUE),
('r1000000-0000-0000-0000-000000000004', 'Intermediação & Arbitragem Especial B2B', 'operacao_especial', 20.00, 500.00, 'Operações especiais de alto risco ou garantia integral de recompra.', TRUE),
('r1000000-0000-0000-0000-000000000005', 'Marketplace Cross-Docking', 'cross_docking', 4.50, 100.00, 'Operações de cross-docking sem estoque próprio.', TRUE),
('r1000000-0000-0000-0000-000000000006', 'Liquidação de Estoque Sazonal', 'liquidacao_sazonal', 7.00, 50.00, 'Campanhas sazonais de liquidação (Black Friday, Natal, etc.).', TRUE)
ON CONFLICT (slug) DO NOTHING;

-- 5. Perfis de Usuário de Exemplo (para testes)
-- Nota: Os IDs devem corresponder a usuários criados previamente no Supabase Auth.
-- Substitua os IDs abaixo pelos UUIDs reais de auth.users antes de descomentar.
-- INSERT INTO public.profiles (id, email, role, cnpj, razao_social, nome_fantasia, telefone, cidade, uf, cep, logradouro, limite_credito_escrow, status_aprovacao) VALUES
-- ('00000000-0000-0000-0000-000000000001', 'admin@varejistaonline.com.br', 'admin', '00.000.000/0001-00', 'Varejista Online Ltda', 'Varejista Online', '(11) 99999-9999', 'São Paulo', 'SP', '01310-100', 'Av. Paulista, 1000', 100000000.00, 'aprovado'),
-- ('00000000-0000-0000-0000-000000000002', 'comprador@supermercadoexemplo.com.br', 'comprador', '11.111.111/0001-11', 'Supermercado Exemplo Ltda', 'Supermercado Exemplo', '(11) 88888-8888', 'São Paulo', 'SP', '04547-000', 'Rua Funchal, 500', 5000000.00, 'aprovado'),
-- ('00000000-0000-0000-0000-000000000003', 'fornecedor@industrialimentos.com.br', 'fornecedor', '22.222.222/0001-22', 'Indústria de Alimentos S.A.', 'Indústria Alimentos', '(11) 77777-7777', 'Campinas', 'SP', '13087-700', 'Rod. Anhanguera, Km 100', 0.00, 'aprovado')
-- ON CONFLICT (cnpj) DO NOTHING;

-- 6. Produtos de Exemplo (para demonstração)
-- Nota: Requer fornecedor_id válido referenciando public.profiles.
-- Substitua o fornecedor_id pelo UUID real antes de descomentar.
-- INSERT INTO public.products (id, fornecedor_id, categoria_id, sku, titulo, descricao, marca, fabricante, origem_cd, gtin_ean, dun14, imagem_url, unidades_por_embalagem, total_caixas, total_unidades, paletes_pbr, data_fabricacao, data_validade, status_shelf_life, laudo_sanitario_anvisa, status_fiscal, preco_referencia_mercado) VALUES
-- ('a1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 'ARZ-INT-5KG-001', 'Arroz Integral Tipo 1 - 5kg', 'Arroz integral tipo 1, grãos longos, embalagem stand-up pouch', 'Tio João', 'Tio João Alimentos Ltda', 'CD Campinas', '7896001234567', '17896001234564', null, 1, 200, 200, 4, '2025-01-15', '2026-01-15', 'longa', TRUE, 'homologado', 28.90),
-- ('a1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000002', 'LEI-UHT-1L-001', 'Leite Integral UHT - 1L', 'Leite integral UHT, longa vida, caixa tetra pak 1 litro', 'Italac', 'Italac Laticínios S.A.', 'CD Jundiaí', '7891000100412', '17891000100419', null, 12, 100, 1200, 2, '2025-10-01', '2026-04-01', 'atencao', TRUE, 'homologado', 5.49),
-- ('a1000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000005', 'CHO-BAR-100G-001', 'Chocolate Ao Leite 100g', 'Tablete de chocolate ao leite 100g, embalagem flow pack', 'Lacta', 'Mondelez Brasil Ltda', 'CD São Paulo', '7622100100418', '17622100100415', null, 24, 50, 1200, 3, '2025-08-15', '2026-02-15', 'giro_rapido', TRUE, 'homologado', 8.90)
-- ON CONFLICT (sku) DO NOTHING;