import { NextRequest, NextResponse } from 'next/server';
import { askGeminiB2B, analyzeLotPricing, generateProductDescription } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, mode, lotTitle, currentBid, marketRef, productName, brand, packaging } = body;

    let reply: string;

    if (mode === 'description' && productName) {
      reply = await generateProductDescription(
        String(productName),
        String(brand || ''),
        String(packaging || '')
      );
    } else if (mode === 'pricing' && lotTitle) {
      reply = await analyzeLotPricing(
        String(lotTitle),
        Number(currentBid || 0),
        Number(marketRef || 0)
      );
    } else {
      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        return NextResponse.json({ error: 'Prompt não informado.' }, { status: 400 });
      }
      reply = await askGeminiB2B(prompt.trim());
    }

    return NextResponse.json({ reply });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Falha ao processar requisição analítica.';
    const status = message.includes('GEMINI_API_KEY') ? 503 : 502;
    console.error('Erro na rota /api/ai:', error);
    return NextResponse.json({ error: message }, { status });
  }
}
