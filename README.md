# Varejista Online — B2B Food Auction & Stock Liquidity Marketplace

Plataforma profissional de compra, venda, ofertas, leilões eletrônicos industriais e negociação de produtos alimentícios com custódia fiduciária segregada (Escrow D+0), motor dinâmico de comissões (Take-Rate parametrizável de 6% a 20%) e suporte à inteligência artificial preditiva via Google AI Studio (Gemini).

---

## 🏛️ 1. Arquitetura do Sistema

- **Frontend & Full-stack Framework:** Next.js 14+ (App Router) com React 18 e TypeScript.
- **Estilização & Design System:** Tailwind CSS compilado nativamente, preservando rigorosamente a identidade visual corporativa do Stitch (`DESIGN.md`), fontes Google (*Plus Jakarta Sans*) e ícones vetoriais (*Material Symbols Outlined*).
- **Banco de Dados & Autenticação:** Supabase PostgreSQL com Row Level Security (RLS), triggers e tipagem de enums.
- **Inteligência Artificial:** Google AI Studio (Gemini 1.5 Flash) via Route Handlers no backend seguro (`/api/ai`), protegendo credenciais.
- **Motor de Comissões:** Cálculo de Take-Rate dinâmico (6%, 20%, regras customizadas) com liquidação D+0 via SPI/PIX.
- **Hospedagem & Deploy:** Preparado para Vercel e versionamento Git/GitHub.

---

## 🚀 2. Módulos e Rotas da Aplicação

| Rota | Descrição |
| :--- | :--- |
| `/` | Portal público principal com vitrine de lotes, filtros por raio logístico e métricas em tempo real |
| `/catalogo` | Catálogo geral com filtros avançados de EAN-13, DUN-14, categorias e status de Shelf Life |
| `/leiloes` | Pregões ao vivo com contagem regressiva e status de disputa |
| `/leiloes/[id]` | Sala de leilão eletrônico ao vivo com lances em tempo real e arremate imediato |
| `/negociacoes` | Central de ofertas comerciais, contrapropostas e mensagens diretas entre indústrias e varejistas |
| `/produtos/novo` | Cadastro técnico de produtos, paletização, laudo sanitário ANVISA e criação de lotes |
| `/carrinho` | Carrinho de compras com resumo de arremates e simulação de custos |
| `/checkout` | Checkout fiduciário com custódia escrow segregada e split de pagamento D+0 |
| `/pedidos` | Histórico de pedidos e agendamento de doca FOB no Centro de Distribuição |
| `/login` | Acesso seguro com seleção de perfil (Comprador, Fornecedor ou Admin) |
| `/cadastro` | Onboarding com validação de CNPJ em tempo real na Receita Federal e liberação de limite escrow |
| `/recuperar-senha`| Fluxo de recuperação de senha |
| `/painel/comprador` | Cockpit do Varejista com monitoramento de lances e limite de crédito |
| `/painel/fornecedor`| Cockpit da Indústria com controle de lotes, expedição e repasses |
| `/painel/admin` | Painel Administrativo Master com auditoria forense WORM e prevenção a fraudes |
| `/painel/comissoes` | Central de gestão de comissões e simulador de split fiduciário |
| `/api/ai` | Endpoint backend para o Assistente Comercial Gemini (Google AI Studio) |
| `/api/comissoes` | API para parametrização dinâmica de regras e cálculo de comissões |
| `/api/lances` | API do pregão eletrônico com cálculo de preço unitário e anti-sniping |
| `/api/propostas` | API de negociação comercial direta (propostas e contrapropostas) |
| `/api/docas` | API de agendamento de docas FOB e validação de placas (WMS) |

---

## ⚙️ 3. Como Rodar Localmente

### Pré-requisitos
- Node.js 18+ (testado e homologado no Node v24.21.0)
- npm ou yarn

### Instalação
```bash
# Instalar dependências
npm install

# Copiar arquivo de variáveis de ambiente
cp .env.example .env.local

# Iniciar servidor de desenvolvimento
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000) no seu navegador.

### Build de Produção
```bash
npm run build
npm start
```

---

## 🗄️ 4. Integração com Supabase

O projeto possui migrations SQL completas e dados iniciais na pasta `supabase/`:
- `supabase/migrations/20261114000000_initial_schema.sql` (Estrutura, tabelas, enums, triggers e RLS)
- `supabase/seed.sql` (Categorias oficiais de alimentos e regras de comissão parametrizáveis)

### Como aplicar no Supabase:
1. Acesse o [Supabase Dashboard](https://supabase.com).
2. Crie ou selecione seu projeto.
3. Vá em **SQL Editor** e execute primeiro o conteúdo do arquivo `supabase/migrations/20261114000000_initial_schema.sql`.
4. Em seguida, execute o script de sementes `supabase/seed.sql` para carregar as categorias de alimentos e as alíquotas de comissão.
4. Copie a **URL do Projeto** e a **chave Anon** em *Project Settings > API*.
5. Cole as variáveis no seu `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anonima
   ```

---

## 🤖 5. Integração com Google AI Studio (Gemini)

1. Obtenha sua chave de API gratuita no [Google AI Studio](https://aistudio.google.com/).
2. Insira a variável no `.env.local`:
   ```env
   GEMINI_API_KEY=sua-chave-gemini-aqui
   ```
3. As requisições são processadas com total segurança pelo servidor Next.js em `src/app/api/ai/route.ts`, garantindo que nenhuma chave secreta seja exposta ao navegador do usuário.

---

## ☁️ 6. Implantação na Vercel

1. Suba o código para o seu repositório no **GitHub**.
2. Acesse a [Vercel](https://vercel.com/) e clique em **Add New > Project**.
3. Importe o repositório do GitHub.
4. Adicione as variáveis de ambiente (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GEMINI_API_KEY`).
5. Clique em **Deploy**. A plataforma estará online com SSL e CDN global instantaneamente.

---

## 🛡️ 7. Governança e Segurança

- Conformidade com a Resolução BACEN nº 4.656 para custódia segregada e split de pagamento.
- Políticas RLS ativas em todas as tabelas do PostgreSQL.
- Verificação de códigos GS1 oficiais (EAN-13 para unidade consumidora e DUN-14 para caixas de transporte).
