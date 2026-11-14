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
('c1000000-0000-0000-0000-000000000006', 'Higiene & Conservação', 'higiene-limpeza', 'cleaning_services', 'Desinfetantes, detergentes e descartáveis industriais')
ON CONFLICT (slug) DO NOTHING;

-- 2. Regras de Comissões Parametrizáveis (Take-Rate)
INSERT INTO public.commission_rules (id, nome_modalidade, slug, percentual_padrao, descricao, ativo) VALUES
('r1000000-0000-0000-0000-000000000001', 'Leilões Industriais Padrão (Pregão)', 'leilao', 6.00, 'Comissão administrativa padrão sobre leilões eletrônicos de grande volume.', TRUE),
('r1000000-0000-0000-0000-000000000002', 'Giro Rápido & Validade Próxima (FEFO)', 'giro_rapido', 8.50, 'Taxa para liquidação acelerada de lotes com validade inferior a 60 dias.', TRUE),
('r1000000-0000-0000-0000-000000000003', 'Venda Direta & Cargas Fechadas (FOB)', 'venda_direta', 5.00, 'Negociação direta de pallets fechados direto da fábrica.', TRUE),
('r1000000-0000-0000-0000-000000000004', 'Intermediação & Arbitragem Especial B2B', 'operacao_especial', 20.00, 'Operações especiais de alto risco ou garantia integral de recompra.', TRUE)
ON CONFLICT (slug) DO NOTHING;
