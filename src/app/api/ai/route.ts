import { NextRequest, NextResponse } from 'next/server';
import { askGeminiB2B } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const prompt = body.prompt;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt não informado' }, { status: 400 });
    }

    const reply = await askGeminiB2B(prompt);
    return NextResponse.json({ reply });
  } catch (error) {
    console.error('Erro na rota /api/ai:', error);
    return NextResponse.json(
      { error: 'Falha ao processar requisição de inteligência artificial' },
      { status: 500 }
    );
  }
}
