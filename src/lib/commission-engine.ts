import { EscrowOrder } from './types';

export interface SplitCalculationResult {
  valorBrutoTotal: number;
  percentualComissao: number;
  valorComissaoPlataforma: number;
  valorRepasseLiquidoFornecedor: number;
  taxaEscrowBancaria: number;
  valorDisponivelCustodia: number;
}

/**
 * Calculates an estimate using the commission rate loaded from the database.
 */
export function calculateSplit(
  valorTotalArremate: number,
  taxaCustomizada: number
): SplitCalculationResult {
  if (!Number.isFinite(taxaCustomizada) || taxaCustomizada < 0 || taxaCustomizada > 100) {
    throw new Error('A alíquota da comissão deve estar entre 0% e 100%.');
  }

  const percentual = taxaCustomizada;

  const valorComissaoPlataforma = Number(((valorTotalArremate * percentual) / 100).toFixed(2));
  const taxaEscrowBancaria = 0;
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
  const settledOrders = orders.filter((o) => o.statusPagamento === 'repasse_liquidado_d0');
  const gmv = settledOrders.reduce((acc, o) => acc + o.valorTotalArremate, 0);
  const receita = settledOrders.reduce((acc, o) => acc + o.valorComissaoPlataforma, 0);
  const repasses = settledOrders.reduce((acc, o) => acc + o.valorRepasseLiquidoFornecedor, 0);
  const emCustodia = orders
    .filter((o) => o.statusPagamento === 'em_custodia_escrow' || o.statusPagamento === 'em_disputa')
    .reduce((acc, o) => acc + o.valorTotalArremate, 0);

  const takeRateMedio = gmv > 0 ? Number(((receita / gmv) * 100).toFixed(2)) : 0;

  return {
    gmvTotalTransacionado: gmv,
    receitaTotalComissoes: receita,
    totalRepassesFornecedores: repasses,
    totalEmCustodiaEscrow: emCustodia,
    takeRateMedioEfetivo: takeRateMedio,
    quantidadeTransacoes: settledOrders.length,
  };
}
