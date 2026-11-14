import { NextRequest, NextResponse } from 'next/server';
import {
  getCommissionRules,
  updateCommissionRule,
  calculateSplit,
} from '@/lib/commission-engine';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const amountParam = searchParams.get('amount');
  const modalidadeParam = searchParams.get('modalidade') || 'leilao';
  const customRateParam = searchParams.get('rate');

  if (amountParam) {
    const amount = Number(amountParam);
    const customRate = customRateParam ? Number(customRateParam) : undefined;
    const split = calculateSplit(amount, modalidadeParam, customRate);
    return NextResponse.json({ split });
  }

  return NextResponse.json({ rules: getCommissionRules() });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ruleId, newPercentage, active } = body;

    if (!ruleId || newPercentage === undefined) {
      return NextResponse.json(
        { error: 'ruleId e newPercentage são obrigatórios' },
        { status: 400 }
      );
    }

    const updated = updateCommissionRule(ruleId, Number(newPercentage), active);
    if (!updated) {
      return NextResponse.json({ error: 'Regra de comissão não encontrada' }, { status: 404 });
    }

    return NextResponse.json({
      message: 'Regra de comissão administrativa atualizada com sucesso',
      rule: updated,
    });
  } catch (err) {
    console.error('Erro ao atualizar regra de comissão:', err);
    return NextResponse.json({ error: 'Erro interno ao processar comissão' }, { status: 500 });
  }
}
