# =============================================================================
# VAREJISTA ONLINE - B2B FOOD AUCTION MARKETPLACE
# Script de Setup Automatizado do Supabase
# Uso: ./scripts/setup-supabase.sh
# =============================================================================

#!/bin/bash

set -e  # Para em caso de erro

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # Sem cor

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}  VAREJISTA ONLINE - Setup do Supabase${NC}"
echo -e "${BLUE}============================================================${NC}"

# Verificar se Supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}Erro: Supabase CLI não encontrada.${NC}"
    echo "Instale com: npm install -g supabase"
    exit 1
fi

echo -e "${GREEN}✓ Supabase CLI encontrada${NC}"

# Verificar se Docker está rodando (necessário para desenvolvimento local)
if ! docker info &> /dev/null; then
    echo -e "${RED}Erro: Docker não está rodando.${NC}"
    echo "Inicie o Docker Desktop e tente novamente."
    exit 1
fi

echo -e "${GREEN}✓ Docker está rodando${NC}"

# Verificar se .env.local existe
if [ ! -f .env.local ]; then
    echo -e "${YELLOW}⚠ .env.local não encontrado. Criando a partir de .env.example...${NC}"
    cp .env.example .env.local
    echo -e "${GREEN}✓ .env.local criado. Edite com suas credenciais reais.${NC}"
else
    echo -e "${GREEN}✓ .env.local encontrado${NC}"
fi

# Iniciar Supabase local (opcional)
echo -e "${BLUE}Iniciando Supabase local...${NC}"
supabase start

echo -e "${GREEN}✓ Supabase local iniciado${NC}"

# Aplicar migrações
echo -e "${BLUE}Aplicando migrações...${NC}"

MIGRATIONS_DIR="supabase/migrations"
MIGRATION_FILES=(
    "20261114000000_initial_schema.sql"
    "20261114000001_complete_database.sql"
    "20261114000002_advanced_features.sql"
    "20261114000003_auditoria_worm.sql"
    "20261114000004_demo_data.sql"
)

for migration in "${MIGRATION_FILES[@]}"; do
    MIGRATION_PATH="$MIGRATIONS_DIR/$migration"
    if [ -f "$MIGRATION_PATH" ]; then
        echo -e "${BLUE}  Aplicando: $migration${NC}"
        psql -f "$MIGRATION_PATH" $(supabase db url) || {
            echo -e "${RED}Erro ao aplicar $migration${NC}"
            exit 1
        }
        echo -e "${GREEN}  ✓ $migration aplicada${NC}"
    else
        echo -e "${YELLOW}  ⚠ $migration não encontrada, pulando...${NC}"
    fi
done

# Aplicar seed
echo -e "${BLUE}Aplicando seed data...${NC}"
if [ -f "supabase/seed.sql" ]; then
    psql -f supabase/seed.sql $(supabase db url) || {
        echo -e "${RED}Erro ao aplicar seed${NC}"
        exit 1
    }
    echo -e "${GREEN}✓ Seed aplicado${NC}"
else
    echo -e "${YELLOW}⚠ seed.sql não encontrado${NC}"
fi

# Resetar RLS (garantir que está habilitado)
echo -e "${BLUE}Verificando RLS...${NC}"
psql -c "
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.auctions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.webhooks_logs ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.fiscal_documents ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.audit_worm_logs ENABLE ROW LEVEL SECURITY;
" $(supabase db url)

echo -e "${GREEN}✓ RLS habilitado em todas as tabelas${NC}"

echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}  Setup concluído com sucesso!${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo "Próximos passos:"
echo "  1. Acesse http://localhost:54323 (Supabase Studio)"
echo "  2. Configure .env.local com as credenciais do projeto"
echo "  3. Execute: npm run dev"
echo "  4. Acesse http://localhost:3000"
echo ""
echo -e "${BLUE}Documentação:${NC} https://github.com/mpbrue2016-jpg/stitch_b2b_food_auction_marketplace"