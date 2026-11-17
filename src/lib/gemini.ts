import { GoogleGenAI } from '@google/genai';
import { marketplaceStore } from '@/lib/marketplace-store';
import { getCommissionRules } from '@/lib/commission-engine';

const apiKey = process.env.GEMINI_API_KEY || '';

export const genAI = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

export async function askGeminiB2B(prompt: string): Promise<string> {
  const activeLots = marketplaceStore.auctions.filter(
    (l) => l.status !== 'encerrado' && l.status !== 'homologado' && new Date(l.terminaEm).getTime() > Date.now()
  );
  const lotsPool = activeLots.length > 0 ? activeLots : marketplaceStore.auctions;
  const topMarginLot = [...lotsPool].sort((a, b) => b.margemEstimadaRevenda - a.margemEstimadaRevenda)[0];
  const urgentFefoLot = [...lotsPool].sort(
    (a, b) => a.produto.diasRestantesValidade - b.produto.diasRestantesValidade
  )[0];
  const longestShelfLot = [...lotsPool].sort(
    (a, b) => b.produto.diasRestantesValidade - a.produto.diasRestantesValidade
  )[0];

  if (genAI) {
    try {
      const liveCatalogContext = lotsPool
        .slice(0, 8)
        .map(
          (l) =>
            `${l.codigoLote} (${l.produto.titulo} | Lance R$ ${l.lanceAtual.toLocaleString('pt-BR')} | R$ ${l.precoUnitarioAtual.toFixed(2)}/un | Validade ${l.produto.diasRestantesValidade}d | Margem ${l.margemEstimadaRevenda}%)`
        )
        .join('\n- ');

      const response = await genAI.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction: `Você é o Assistente Especialista B2B em Alimentos, Cerealista, Hortifruti e Higiene e Limpeza do Varejista Online.
Sua função é orientar compradores (supermercados, minimercados, atacadistas) e fornecedores sobre:
- Análise de margem de lucro de revenda (preço por unidade vs preço de gôndola).
- Avaliação de risco de Shelf Life e curva FEFO (validade longa >90d, atenção 60-90d, giro rápido 30-60d, crítico <30d).
- Sugestão de lances e estratégia de disputa em pregões, inclusive liquidação de estoque parado de pequenos mercados.
- Recomendações fiscais (ICMS-ST, PIS/COFINS monofásico) e conformidade sanitária ANVISA/MAPA.
Lotes ativos no pregão neste momento:
- ${liveCatalogContext}
Responda sempre em Português do Brasil com dados objetivos, tom executivo e profissional.`,
        },
      });

      const text = response.text;
      if (text) return text;
    } catch (err) {
      console.warn('Erro ao chamar provedor analítico:', err);
    }
  }

  const pLower = prompt.toLowerCase();

  if (pLower.includes('descrição') || pLower.includes('descricao') || pLower.includes('especificações de paletização')) {
    const titleMatch = prompt.match(/Produto\s+"([^"]+)"/i) || prompt.match(/produto:\s*"([^"]+)"/i);
    const productName = titleMatch?.[1] || 'Lote Comercial Homologado';
    return `${productName} acondicionado em embalagem lacrada e paletização padrão PBR, com laudo sanitário ANVISA/MAPA e rastreabilidade GS1 integral. Estoque armazenado com controle documental para retirada FOB imediata ou faturamento direto para supermercados, minimercados e atacadistas.`;
  }

  if (pLower.includes('cerealista') || pLower.includes('feijão') || pLower.includes('feijao') || pLower.includes('arroz') || pLower.includes('grão')) {
    const cerealLot = lotsPool.find((l) => l.produto.categoriaId === 'cat-7') || topMarginLot;
    if (cerealLot) {
      return `Análise Cerealista & Grãos (${cerealLot.codigoLote}): "${cerealLot.produto.titulo}" está com lance atual de R$ ${cerealLot.lanceAtual.toLocaleString('pt-BR')} (R$ ${cerealLot.precoUnitarioAtual.toFixed(2)}/un), margem estimada de ${cerealLot.margemEstimadaRevenda}% e ${cerealLot.produto.diasRestantesValidade} dias de validade (Shelf Life seguro para giro de gôndola).`;
    }
  }

  if (pLower.includes('hortifruti') || pLower.includes('verdura') || pLower.includes('fruta') || pLower.includes('batata') || pLower.includes('cebola') || pLower.includes('ceasa')) {
    const hfLot = lotsPool.find((l) => l.produto.categoriaId === 'cat-8') || urgentFefoLot;
    if (hfLot) {
      return `Diagnóstico Hortifruti & Frescos (${hfLot.codigoLote}): "${hfLot.produto.titulo}" com giro rápido FEFO (${hfLot.produto.diasRestantesValidade} dias recomendados para venda), lance atual de R$ ${hfLot.lanceAtual.toLocaleString('pt-BR')} (R$ ${hfLot.precoUnitarioAtual.toFixed(2)}/un) e margem projetada de ${hfLot.margemEstimadaRevenda}%. Priorize retirada FOB imediata para preservar frescor.`;
    }
  }

  if (pLower.includes('higiene') || pLower.includes('limpeza') || pLower.includes('detergente') || pLower.includes('sabão') || pLower.includes('sabao')) {
    const cleanLot = lotsPool.find((l) => l.produto.categoriaId === 'cat-6') || topMarginLot;
    if (cleanLot) {
      return `Análise Higiene & Limpeza (${cleanLot.codigoLote}): "${cleanLot.produto.titulo}" opera com ${cleanLot.produto.diasRestantesValidade} dias de validade (risco zero de perecibilidade), lance atual de R$ ${cleanLot.lanceAtual.toLocaleString('pt-BR')} (R$ ${cleanLot.precoUnitarioAtual.toFixed(2)}/un) e margem estimada de ${cleanLot.margemEstimadaRevenda}% para o varejo.`;
    }
  }

  if (pLower.includes('margem') || pLower.includes('lucro')) {
    if (topMarginLot) {
      return `Análise Preditiva de Margem: O lote com maior potencial de retorno no pregão é o ${topMarginLot.codigoLote} (${topMarginLot.produto.titulo}), com lance atual de R$ ${topMarginLot.lanceAtual.toLocaleString('pt-BR')} (R$ ${topMarginLot.precoUnitarioAtual.toFixed(2)}/un) e margem projetada de ${topMarginLot.margemEstimadaRevenda}% na revenda varejista.`;
    }
  }

  if (pLower.includes('validade') || pLower.includes('shelf') || pLower.includes('fefo')) {
    if (urgentFefoLot && longestShelfLot) {
      return `Diagnóstico de Shelf Life FEFO: O lote de giro mais urgente é o ${urgentFefoLot.codigoLote} (${urgentFefoLot.produto.titulo}) com ${urgentFefoLot.produto.diasRestantesValidade} dias restantes — indicado para redes com escoamento rápido. Já o ${longestShelfLot.codigoLote} (${longestShelfLot.produto.titulo}) oferece ${longestShelfLot.produto.diasRestantesValidade} dias de validade longa.`;
    }
  }

  if (pLower.includes('lance') || pLower.includes('proposta') || pLower.includes('preço') || pLower.includes('preco')) {
    if (topMarginLot) {
      const nextBid = topMarginLot.lanceAtual + topMarginLot.incrementoMinimo;
      return `Recomendação de Lance: No lote ${topMarginLot.codigoLote} (${topMarginLot.produto.titulo}), o próximo lance mínimo é R$ ${nextBid.toLocaleString('pt-BR')} (incremento de R$ ${topMarginLot.incrementoMinimo.toLocaleString('pt-BR')}), mantendo margem estimada próxima a ${topMarginLot.margemEstimadaRevenda}% sob custódia Escrow BACEN.`;
    }
  }

  const defaultRule = getCommissionRules().find((r) => r.slug === 'leilao');
  const ratePct = defaultRule?.percentualPadrao ?? 6;

  return `Assistente Comercial B2B: Analisei os ${activeLots.length} pregões ativos nas categorias Alimentos, Bebidas, Cerealista & Grãos, Hortifruti & Frescos e Higiene e Limpeza. O take-rate padrão dos leilões está parametrizado em ${ratePct}% com liquidação D+0 em custódia Escrow.`;
}

export async function analyzeLotPricing(lotTitle: string, currentBid: number, marketRef: number): Promise<string> {
  const discount = Math.round(((marketRef - currentBid) / marketRef) * 100);
  const prompt = `Analise a viabilidade comercial do lote B2B: "${lotTitle}". Valor do lance atual: R$ ${currentBid}, Valor de mercado de referência: R$ ${marketRef} (${discount}% de desconto). Destaque a margem de retorno para o varejista.`;
  return askGeminiB2B(prompt);
}

export async function generateProductDescription(productName: string, brand: string, packaging: string): Promise<string> {
  const prompt = `Gere uma descrição técnica e comercial profissional B2B para o produto: "${productName}", marca: "${brand}", embalagem: "${packaging}". Inclua especificações de paletização, armazenamento e conformidade ANVISA/MAPA.`;
  return askGeminiB2B(prompt);
}
