import { GoogleGenAI } from '@google/genai';
import { createServerSupabaseClient, isSupabaseServerConfigured } from '@/lib/supabase/server';
import { mapDbAuctionToAuctionLot } from '@/lib/supabase/mappers';

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

async function fetchLiveMarketContext(): Promise<{
  catalogSummary: string;
  takeRateSummary: string;
}> {
  if (!isSupabaseServerConfigured) {
    return {
      catalogSummary: 'Banco de dados Supabase ainda não configurado neste ambiente.',
      takeRateSummary: 'Consulte o painel de comissões após configurar o banco de dados.',
    };
  }

  try {
    const supabase = createServerSupabaseClient();
    const [{ data: auctionsData }, { data: rulesData }] = await Promise.all([
      supabase
        .from('auctions')
        .select('*, products(*)')
        .in('status', ['ativo', 'reta_final'])
        .order('termina_em', { ascending: true })
        .limit(10),
      supabase
        .from('commission_rules')
        .select('nome_modalidade, slug, percentual_padrao, ativo')
        .eq('ativo', true),
    ]);

    const lots = (auctionsData || []).map((row) =>
      mapDbAuctionToAuctionLot(row as Record<string, unknown>)
    );

    const catalogSummary =
      lots.length > 0
        ? lots
            .map(
              (l) =>
                `${l.codigoLote} (${l.produto.titulo} | Lance R$ ${l.lanceAtual.toLocaleString('pt-BR')} | R$ ${l.precoUnitarioAtual.toFixed(2)}/un | Validade ${l.produto.diasRestantesValidade}d | Margem ${l.margemEstimadaRevenda}%)`
            )
            .join('\n- ')
        : 'Nenhum pregão ativo no momento.';

    const takeRateSummary =
      rulesData && rulesData.length > 0
        ? rulesData
            .map((r) => `${r.nome_modalidade}: ${Number(r.percentual_padrao).toFixed(2)}%`)
            .join(' | ')
        : 'Padrão leilão: 6.00%';

    return { catalogSummary, takeRateSummary };
  } catch (err) {
    console.warn('Falha ao buscar contexto de mercado para Gemini:', err);
    return {
      catalogSummary: 'Catálogo indisponível momentaneamente.',
      takeRateSummary: 'Regras de comissão indisponíveis.',
    };
  }
}

export async function askGeminiB2B(prompt: string): Promise<string> {
  if (!genAI) {
    throw new Error(
      'GEMINI_API_KEY não configurada no servidor. Configure a chave de API do Gemini no ambiente.'
    );
  }

  const { catalogSummary, takeRateSummary } = await fetchLiveMarketContext();

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
Taxas administrativas vigentes: ${takeRateSummary}
Lotes ativos no pregão neste momento:
- ${catalogSummary}
Responda sempre em Português do Brasil com dados objetivos, tom executivo e profissional.`,
    },
  });

  if (!response.text) {
    throw new Error('O provedor analítico retornou resposta vazia.');
  }

  return response.text;
}

export async function analyzeLotPricing(
  lotTitle: string,
  currentBid: number,
  marketRef: number
): Promise<string> {
  const discount = marketRef > 0 ? Math.round(((marketRef - currentBid) / marketRef) * 100) : 0;
  const prompt = `Analise a viabilidade comercial do lote B2B: "${lotTitle}". Valor do lance atual: R$ ${currentBid}, Valor de mercado de referência: R$ ${marketRef} (${discount}% de desconto). Destaque a margem de retorno para o varejista.`;
  return askGeminiB2B(prompt);
}

export async function generateProductDescription(
  productName: string,
  brand: string,
  packaging: string
): Promise<string> {
  const prompt = `Gere uma descrição técnica e comercial profissional B2B para o produto: "${productName}", marca: "${brand}", embalagem: "${packaging}". Inclua especificações de paletização, armazenamento e conformidade ANVISA/MAPA.`;
  return askGeminiB2B(prompt);
}
