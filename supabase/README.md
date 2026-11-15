# Supabase - Banco de Dados B2B Food Auction Marketplace

Este diretório contém todas as migrações, seeds e configurações do banco de dados Supabase para o projeto **Varejista Online - B2B Food Auction Marketplace**.

## Estrutura

```
supabase/
├── migrations/
│   ├── 20261114000000_initial_schema.sql    # Schema base (tabelas, enums, índices, RLS)
│   ├── 20261114000001_complete_database.sql  # Tabelas complementares + triggers
│   ├── 20261114000002_advanced_features.sql  # Stored procedures e funções
│   └── 20261114000003_auditoria_worm.sql     # Auditoria WORM, dashboard view, take-rate
└── seed.sql                                  # Dados iniciais (categorias, configurações, comissões)
```

## Ordem de Aplicação

Execute as migrações nesta ordem exata no **Supabase SQL Editor**:

```bash
# 1. Schema base
\i supabase/migrations/20261114000000_initial_schema.sql

# 2. Tabelas complementares e triggers
\i supabase/migrations/20261114000001_complete_database.sql

# 3. Stored procedures avançadas
\i supabase/migrations/20261114000002_advanced_features.sql

# 4. Auditoria WORM e dashboard
\i supabase/migrations/20261114000003_auditoria_worm.sql

# 5. Dados iniciais
\i supabase/seed.sql
```

## Tabelas Principais

| Tabela | Descrição |
|--------|-----------|
| `profiles` | Perfis de usuário (comprador, fornecedor, admin) |
| `categories` | Categorias de produtos (10 oficiais) |
| `subcategories` | Subcategorias detalhadas (40 registros) |
| `products` | Produtos e lotes físicos |
| `auctions` | Leilões e pregões eletrônicos |
| `bids` | Lances dos compradores |
| `orders` | Pedidos com custódia escrow D+0 |
| `commission_rules` | Regras de take-rate (6% a 20%) |
| `notifications` | Notificações multicanal |
| `fiscal_documents` | NF-e, MDF-e, DAMDF-e |
| `carts` / `cart_items` | Carrinho de compras |
| `webhooks_logs` | Logs de webhooks ERP |
| `system_settings` | Configurações do sistema (21 chaves) |
| `audit_worm_logs` | Auditoria WORM imutável (BACEN 4.656) |

## Stored Procedures

- `calculate_bid_value()` - Calcula lance com proteção anti-sniping
- `place_bid()` - Envia lance com validações e comissão automática
- `finalize_auction()` - Finaliza leilão, cria ordem escrow e auditoria WORM
- `check_product_availability()` - Verifica estoque por categoria
- `get_categories_with_subcategories()` - Lista categorias ativas
- `validar_integridade_worm()` - Valida integridade da cadeia WORM
- `calcular_take_rate_dinamico()` - Calcula comissão por modalidade

## Views

- `v_dashboard_executivo` - KPIs consolidados (leilões, usuários, pagamentos)

## Segurança (RLS)

Todas as tabelas possuem Row Level Security ativo:
- Leitura pública de leilões, produtos e categorias
- Lances apenas para compradores autenticados
- Pedidos visíveis apenas para comprador e fornecedor
- Auditoria WORM apenas para administradores (somente leitura)
- Logs WORM são imutáveis (não podem ser alterados nem excluídos)

## Variáveis de Ambiente

Copie `.env.example` para `.env.local` e preencha:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anonima
SUPABASE_SERVICE_ROLE_KEY=sua-chave-service-role
GEMINI_API_KEY=sua-chave-gemini
```

## Conformidade

- **BACEN Resolução nº 4.656**: Custódia segregada e split de pagamento
- **Auditoria WORM**: Hash SHA-256 para integridade criptográfica
- **LGPD**: RLS em todas as tabelas com dados sensíveis
- **ANVISA**: Laudo sanitário obrigatório para alimentos
- **GS1**: Validação de EAN-13 e DUN-14