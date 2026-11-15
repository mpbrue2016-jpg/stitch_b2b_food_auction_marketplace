# =============================================================================
# VAREJISTA ONLINE - B2B FOOD AUCTION MARKETPLACE
# Script de Setup Automatizado do Supabase (PowerShell para Windows)
# Uso: .\scripts\setup-supabase.ps1
# =============================================================================

$ErrorActionPreference = "Stop"

function Write-ColorOutput($ForegroundColor) {
    $fc = [Console]::ForegroundColor
    [Console]::ForegroundColor = $ForegroundColor
    $input | ForEach-Object { Write-Host $_ }
    [Console]::ForegroundColor = $fc
}

Write-Host "============================================================" -ForegroundColor Blue
Write-Host "  VAREJISTA ONLINE - Setup do Supabase" -ForegroundColor Blue
Write-Host "============================================================" -ForegroundColor Blue

# Verificar se Supabase CLI está instalada
try {
    $null = Get-Command supabase -ErrorAction Stop
    Write-Host "✓ Supabase CLI encontrada" -ForegroundColor Green
} catch {
    Write-Host "Erro: Supabase CLI não encontrada." -ForegroundColor Red
    Write-Host "Instale com: npm install -g supabase"
    exit 1
}

# Verificar se Docker está rodando
try {
    docker info 2>&1 | Out-Null
    Write-Host "✓ Docker está rodando" -ForegroundColor Green
} catch {
    Write-Host "Erro: Docker não está rodando." -ForegroundColor Red
    Write-Host "Inicie o Docker Desktop e tente novamente."
    exit 1
}

# Verificar se .env.local existe
if (-not (Test-Path ".env.local")) {
    Write-Host "⚠ .env.local não encontrado. Criando a partir de .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env.local"
    Write-Host "✓ .env.local criado. Edite com suas credenciais reais." -ForegroundColor Green
} else {
    Write-Host "✓ .env.local encontrado" -ForegroundColor Green
}

# Iniciar Supabase local
Write-Host "Iniciando Supabase local..." -ForegroundColor Blue
supabase start
Write-Host "✓ Supabase local iniciado" -ForegroundColor Green

# Aplicar migrações
Write-Host "Aplicando migrações..." -ForegroundColor Blue

$MigrationsDir = "supabase/migrations"
$MigrationFiles = @(
    "20261114000000_initial_schema.sql",
    "20261114000001_complete_database.sql",
    "20261114000002_advanced_features.sql",
    "20261114000003_auditoria_worm.sql"
)

foreach ($migration in $MigrationFiles) {
    $MigrationPath = Join-Path $MigrationsDir $migration
    if (Test-Path $MigrationPath) {
        Write-Host "  Aplicando: $migration" -ForegroundColor Blue
        $DbUrl = supabase db url
        psql -f $MigrationPath $DbUrl
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✓ $migration aplicada" -ForegroundColor Green
        } else {
            Write-Host "  ✗ Erro ao aplicar $migration" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "  ⚠ $migration não encontrada, pulando..." -ForegroundColor Yellow
    }
}

# Aplicar seed
Write-Host "Aplicando seed data..." -ForegroundColor Blue
if (Test-Path "supabase/seed.sql") {
    $DbUrl = supabase db url
    psql -f "supabase/seed.sql" $DbUrl
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Seed aplicado" -ForegroundColor Green
    } else {
        Write-Host "Erro ao aplicar seed" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "⚠ seed.sql não encontrado" -ForegroundColor Yellow
}

# Resetar RLS
Write-Host "Verificando RLS..." -ForegroundColor Blue
$DbUrl = supabase db url
psql -c @"
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
"@ $DbUrl

Write-Host "✓ RLS habilitado em todas as tabelas" -ForegroundColor Green

Write-Host "============================================================" -ForegroundColor Green
Write-Host "  Setup concluído com sucesso!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Próximos passos:"
Write-Host "  1. Acesse http://localhost:54323 (Supabase Studio)"
Write-Host "  2. Configure .env.local com as credenciais do projeto"
Write-Host "  3. Execute: npm run dev"
Write-Host "  4. Acesse http://localhost:3000"
Write-Host ""
Write-Host "Documentação: https://github.com/mpbrue2016-jpg/stitch_b2b_food_auction_marketplace" -ForegroundColor Blue