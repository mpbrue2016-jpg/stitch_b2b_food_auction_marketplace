---
name: Mercado B2B & Leilões
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#434652'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#737783'
  outline-variant: '#c3c6d4'
  surface-tint: '#2b5bb5'
  primary: '#003178'
  on-primary: '#ffffff'
  primary-container: '#0d47a1'
  on-primary-container: '#a1bbff'
  inverse-primary: '#b0c6ff'
  secondary: '#1b6d24'
  on-secondary: '#ffffff'
  secondary-container: '#a0f399'
  on-secondary-container: '#217128'
  tertiary: '#720009'
  on-tertiary: '#ffffff'
  tertiary-container: '#9d0011'
  on-tertiary-container: '#ffa59d'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d9e2ff'
  primary-fixed-dim: '#b0c6ff'
  on-primary-fixed: '#001945'
  on-primary-fixed-variant: '#00429c'
  secondary-fixed: '#a3f69c'
  secondary-fixed-dim: '#88d982'
  on-secondary-fixed: '#002204'
  on-secondary-fixed-variant: '#005312'
  tertiary-fixed: '#ffdad6'
  tertiary-fixed-dim: '#ffb3ac'
  on-tertiary-fixed: '#410003'
  on-tertiary-fixed-variant: '#930010'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 40px
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '800'
    lineHeight: 32px
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 28px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '700'
    lineHeight: 24px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.05em
  numeric-timer:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '800'
    lineHeight: 24px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-mobile: 0.75rem
  margin: 1.5rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 2rem
---

## Brand & Style

O design system estabelece a fundação visual para uma plataforma marketplace B2B de alta rotação, focada no atacado de alimentos e bebidas, ponta de estoque e leilões industriais em tempo real.

### Personalidade da Marca
- **Operacional e Confiável:** Comunica a robustez financeira e institucional de transações de alto valor entre atacado, distribuidores e varejistas.
- **Ágil e Dinâmica:** Estimula a tomada de decisão rápida e a urgência comercial através de gatilhos visuais de tempo, cronômetros de leilão ao vivo e margens de lucro imediatas.
- **Focada em Dados:** Prioriza clareza absoluta de especificações técnicas críticas (EAN/GTIN, shelf life/validade, volume em pallets/caixas e custo unitário vs. lote fechado).

### Estilo de Design
A estética adota uma fusão entre **Corporate / Modern** e **Data-Dense Utility**:
- Superfícies limpas e brancas contrastam com dados organizados em grades modulares e tabelas de alta densidade.
- A paleta extraída da marca traduz autoridade (azul profundo), liquidez e margem de lucro (verde vibrante) e urgência de oportunidade/tempo esgotando (vermelho ativo).
- Elementos táteis mínimos: foco em hierarquia tipográfica, contraste de badges semânticos e estados de alerta visual que aceleram a leitura sem poluição visual.

## Colors

A estrutura de cores do design system reflete diretamente o ecossistema de negociação, cotações e leilões B2B da marca.

### Cores Principais
- **Primary (`#0D47A1` - Azul Profundo Corporativo):** Representa governança, segurança nas transações e elementos estruturais (headers, botões primários de ação negocial, navegação e dados contratuais). Variação de apoio: `#1565C0`.
- **Secondary (`#2E7D32` - Verde Oportunidade / Lucratividade):** Destinado a badges de economia/desconto, preços por unidade altamente competitivos, confirmações de lance vencedor e validade longa de estoque. Variações de apoio: `#43A047` e `#66BB6A`.
- **Tertiary (`#D32F2F` - Vermelho Alerta / Leilão Online):** Canaliza a urgência comercial. Utilizado em cronômetros regressivos de leilões ao vivo, badges de status crítico de vencimento e lances concorrentes superados. Variação de apoio: `#E53935`.
- **Neutral Base (`#F8FAFC` - Slate Crisp):** Fundo arquitetônico asséptico que dá suporte a visualização contínua de planilhas e catálogos densos.

### Cores Semânticas de Estoque e Validade (Shelf Life)
- **Validade Saudável (> 90 dias):** Fundo `#E8F5E9`, texto `#2E7D32`, borda `#A5D6A7`.
- **Atenção (60-90 dias):** Fundo `#FFFDE7`, texto `#F57F17`, borda `#FFF59D`.
- **Validade Curta / Giro Rápido (30-60 dias):** Fundo `#FFF3E0`, texto `#E65100`, borda `#FFCC80`.
- **Crítico / Vencimento Iminente (< 30 dias):** Fundo `#FFEBEE`, texto `#C62828`, borda `#EF9A9A`.

### Tons de Cinza Estruturais
- **Border / Divider:** `#E2E8F0` para linhas de grade e bordas de containers.
- **Muted Text / Metadata:** `#64748B` para códigos GTIN, lotes e labels auxiliares.
- **Headings & Primary Text:** `#0F172A` para legibilidade máxima em tela.

## Typography

Para responder à exigência de alta densidade de informação operacional B2B e leitura imediata de preços fracionados, **Plus Jakarta Sans** atua como família tipográfica unificada. 

### Diretrizes de Uso
- **Valores Monetários e Lances:** Empregue pesos `700` e `800` para destaque numérico de R$ e percentuais de desconto.
- **Números Tabulares:** Sempre configure `font-feature-settings: "tnum"` em colunas de tabelas, contadores de lotes e cronômetros de leilão, evitando saltos visuais nos layouts com atualização em tempo real via WebSocket.
- **Metadados (GTIN/EAN, Lote, DUN):** Utilize `label-sm` em caixa alta (`uppercase`) com espaçamento de letra (`letterSpacing: 0.05em`) e peso semibold para identificação ágil em scanners e telas de armazém.

## Layout & Spacing

A plataforma utiliza um modelo de **Grid Fluido de 12 colunas** no Desktop e Tablet, e **4 colunas** no Mobile, desenhado especificamente para suportar grades densas de produtos (SKUs), cards de lotes e consoles de arremate.

### Breakpoints e Estrutura
- **Desktop (> 1200px):** 12 colunas, margens laterais de `2rem`, gutters de `1rem`. Ideal para visualizações de tabela de pedidos em lote e monitor de múltiplos pregões simultâneos.
- **Tablet (768px – 1199px):** 8 colunas, margens de `1.5rem`, gutters de `1rem`.
- **Mobile (< 768px):** 4 colunas, margens de `1rem`, gutters de `0.75rem`. Cards de lote convertem-se em listas verticais consolidadas com ações fixas no rodapé.

### Ritmo Espacial de Informação
- O layout rejeita espaços ociosos em favor da visualização de múltiplos itens por dobra. 
- Módulos internos de dados (como divisão entre preço por unidade e valor do palete) usam `space-xs` (4px) e `space-sm` (8px) para criar agrupamento por proximidade gestáltica.

## Elevation & Depth

Para sustentar um fluxo de trabalho profissional, livre de distrações e com alta precisão técnica, o design system prioriza **Tonal Layers e Low-contrast Outlines** em vez de sombras pronunciadas.

### Estratégia de Profundidade
1. **Nível 0 (Canvas Base):** Superfície `#F8FAFC`, background neutro que demarca o espaço de trabalho.
2. **Nível 1 (Cards de Produto e Lote):** Fundo `#FFFFFF` delimitado por borda nítida de 1px em `#E2E8F0`. Sem projeção de sombra em repouso.
3. **Nível 2 (Hover & Estado Ativo de Leilão):** Aplicação de sombra sutil e difusa: `0 4px 12px rgba(13, 71, 161, 0.08)` combinada com realce de borda no tom primário `#1565C0`.
4. **Nível 3 (Overlays, Modais de Arremate e Drawers de Filtro):** Sombra firme `0 12px 32px rgba(15, 23, 42, 0.14)` sobre backdrop escurecido (`rgba(15, 23, 42, 0.5)`).
5. **Destaque de Urgência (Leilão Encerrando):** Linha perimetral pulsante de 1.5px em `#D32F2F` sem desfoque lateral, mantendo a geometria pura da grade.

## Shapes

A geometria do design system é estritamente **Soft (nível 1)**.

### Aplicação Sistemática
- **Raio Base (0.25rem / 4px):** Aplicado a inputs de quantidade, botões operacionais, badges de shelf life, chips de filtro e contêineres de dados tabulares. Transmite precisão industrial e aproveitamento integral de pixels.
- **Raio Médio (0.5rem / 8px):** Reservado para os cartões de lote de leilão, painéis de sumário financeiro e modais de confirmação de lance.
- **Pills e Círculos Excepcionais:** Usados exclusivamente em indicadores de status ao vivo (pulsing dot de "AO VIVO") e contadores numéricos de notificações.

## Components

Instruções para implementação dos componentes centrais do ecossistema:

### 1. Cards de Lote & Leilão
- **Cabeçalho do Card:** Badge de tempo restante no canto superior direito (vermelho `#D32F2F` se < 15 min, neutro se > 24h). Tag do tipo de venda (Leilão vs. Venda Direta) no canto esquerdo.
- **Corpo:** Foto do produto em proporção 4:3 com overlay discreto do GTIN/EAN. Bloco de tipografia com título técnico do SKU (ex.: "Óleo de Soja 900ml - Caixa c/ 20 un").
- **Grid de Informações B2B:** Mini-tabela interna contendo:
  - Quantidade total (ex.: "14 Paletes / 1.400 Cxs")
  - Validade color-coded (verde/amarelo/laranja/vermelho)
  - Preço por unidade (destaque secundário verde `#2E7D32`) vs. Valor Total do Lote.
- **Rodapé do Card:** Botão de lance rápido ou input numérico de proposta.

### 2. Badges de Shelf Life / Validade
- Estrutura: Ícone de ampulheta/calendário + Data DD/MM/AAAA + "(X dias restantes)".
- Cantos com 4px de raio, altura fixa de 24px, tipografia `label-sm`.
- Contraste sempre aprovado por WCAG AA com cores de texto escuras sobre fundos de alerta pastel.

### 3. Cronômetro de Leilão ao Vivo
- Fundo vermelho escuro `#D32F2F` ou container neutro com borda vermelha quando o leilão entra nos últimos minutos ("Reta Final").
- Caracteres numéricos tabulares em `numeric-timer` para evitar tremor durante o tick regressivo de segundos e centésimos.

### 4. Botões e Ações
- **Primário (Fazer Lance / Comprar):** Fundo `#0D47A1`, texto `#FFFFFF`, hover `#1565C0`.
- **Ação Rápida de Oportunidade (Arremate Imediato):** Fundo `#2E7D32`, texto `#FFFFFF`, hover `#1B5E20`.
- **Secundário / Neutro:** Fundo transparente, borda `#CBD5E1`, texto `#0F172A`.

### 5. Tabela de Lotes e Listas Densas
- Altura de linha compacta (44px) com divisores horizontais finos `#E2E8F0`.
- Linhas zebradas suaves opcionais (`#F8FAFC`) para catálogos com mais de 50 itens.
- Colunas fixas para Checkbox de seleção em lote, SKU/EAN, Fabricante, Volume, Shelf-life, Preço Unitário e CTA.

### 6. Inputs de Negociação
- Campos de lance com prefixo fixo monetário "R$" e incremento rápido via botões `+` e `-` com passos pré-configurados (ex.: incrementos de R$ 500,00).
- Estado de foco destacado com anel sólido de 2px em tom azul `#0D47A1`.