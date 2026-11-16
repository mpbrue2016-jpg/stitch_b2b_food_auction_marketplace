import { CommissionRule, EscrowOrder } from './types';

// Regras padrão iniciais que podem ser atualizadas dinamicamente pelo Painel Administrativo
export const DEFAULT_COMMISSION_RULES: CommissionRule[] = [
  {
    id: 'rule-leilao-padrao',
    nomeModalidade: 'Leilões Industriais Padrão (Pregão)',
    slug: 'leilao',
    percentualPadrao: 6.0, // 6% configurável
    descricao: 'Comissão padrão aplicada sobre pregões eletrônicos de grande volume.',
    ativo: true,
    atualizadoEm: new Date().toISOString(),
  },
  {
    id: 'rule-giro-rapido',
    nomeModalidade: 'Giro Rápido & Validade Próxima (FEFO)',
    slug: 'giro_rapido',
    percentualPadrao: 8.5,
    descricao: 'Taxa para liquidação acelerada de lotes com validade inferior a 60 dias.',
    ativo: true,
    atualizadoEm: new Date().toISOString(),
  },
  {
    id: 'rule-venda-direta',
    nomeModalidade: 'Venda Direta & Cargas Fechadas (FOB)',
    slug: 'venda_direta',
    percentualPadrao: 5.0,
    descricao: 'Negociação direta de pallets fechados direto da fábrica.',
    ativo: true,
    atualizadoEm: new Date().toISOString(),
  },
  {
    id: 'rule-operacao-especial',
    nomeModalidade: 'Intermediação & Arbitragem Especial B2B',
    slug: 'operacao_especial',
    percentualPadrao: 20.0, // 20% configurável
    descricao: 'Operações com garantia integral de recompra ou lotes de alto valor agregado.',
    ativo: true,
    atualizadoEm: new Date().toISOString(),
  },
];

let dynamicRules: CommissionRule[] = [...DEFAULT_COMMISSION_RULES];

export function getCommissionRules(): CommissionRule[] {
  return dynamicRules;
}

export function updateCommissionRule(id: string, newPercentage: number, active?: boolean): CommissionRule | null {
  const index = dynamicRules.findIndex((r) => r.id === id);
  if (index === -1) return null;
  dynamicRules[index] = {
    ...dynamicRules[index],
    percentualPadrao: newPercentage,
    ativo: active !== undefined ? active : dynamicRules[index].ativo,
    atualizadoEm: new Date().toISOString(),
  };
  return dynamicRules[index];
}

export interface SplitCalculationResult {
  valorBrutoTotal: number;
  percentualComissao: number;
  valorComissaoPlataforma: number;
  valorRepasseLiquidoFornecedor: number;
  taxaEscrowBancaria: number; // Ex: custo de liquidação D+0
  valorDisponivelCustodia: number;
}

/**
 * Calcula o split fiduciário com taxa dinâmica configurável.
 * NUNCA fixa percentuais estáticos em código fechado.
 */
export function calculateSplit(
  valorTotalArremate: number,
  tipoNegociacaoSlug: string = 'leilao',
  taxaCustomizada?: number
): SplitCalculationResult {
  let percentual = taxaCustomizada;

  if (percentual === undefined) {
    const rule = dynamicRules.find((r) => r.slug === tipoNegociacaoSlug && r.ativo);
    percentual = rule ? rule.percentualPadrao : 6.0;
  }

  // Respeita limites percentuais razoáveis (0 a 100%)
  percentual = Math.max(0, Math.min(100, percentual));

  const valorComissaoPlataforma = Number(((valorTotalArremate * percentual) / 100).toFixed(2));
  // Taxa operacional bancária STR/SPI D+0 (R$ 3,85 padrão fixo ou 0 se zero)
  const taxaEscrowBancaria = valorTotalArremate > 0 ? 3.85 : 0;
  const valorRepasseLiquidoFornecedor = Number(
    (valorTotalArremate - valorComissaoPlataforma).toFixed(2)
  );

  return {
    valorBrutoTotal: valorTotalArremate,
    percentualComissao: percentual,
    valorComissaoPlataforma,
    valorRepasseLiquidoFornecedor,
    taxaEscrowBancaria,
    valorDisponivelCustodia: valorTotalArremate,
  };
}

export interface FinancialReportSummary {
  gmvTotalTransacionado: number;
  receitaTotalComissoes: number;
  totalRepassesFornecedores: number;
  totalEmCustodiaEscrow: number;
  takeRateMedioEfetivo: number;
  quantidadeTransacoes: number;
}

export function generateFinancialSummary(orders: EscrowOrder[]): FinancialReportSummary {
  const activeOrders = orders.filter((o) => o.statusPagamento !== 'estornado');
  const gmv = activeOrders.reduce((acc, o) => acc + o.valorTotalArremate, 0);
  const receita = activeOrders.reduce((acc, o) => acc + o.valorComissaoPlataforma, 0);
  const repasses = activeOrders.reduce((acc, o) => acc + o.valorRepasseLiquidoFornecedor, 0);
  const emCustodia = activeOrders
    .filter((o) => o.statusPagamento === 'em_custodia_escrow' || o.statusPagamento === 'em_disputa')
    .reduce((acc, o) => acc + o.valorTotalArremate, 0);

  const takeRateMedio = gmv > 0 ? Number(((receita / gmv) * 100).toFixed(2)) : 0;

  return {
    gmvTotalTransacionado: gmv,
    receitaTotalComissoes: receita,
    totalRepassesFornecedores: repasses,
    totalEmCustodiaEscrow: emCustodia,
    takeRateMedioEfetivo: takeRateMedio,
    quantidadeTransacoes: activeOrders.length,
  };
}
