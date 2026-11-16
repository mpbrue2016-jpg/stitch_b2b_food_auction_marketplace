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
    if (!Number.isFinite(amount) || amount < 0) {
      return NextResponse.json({ error: 'Valor inválido para cálculo de split' }, { status: 400 });
    }
    const customRate = customRateParam ? Number(customRateParam) : undefined;
    if (customRate !== undefined && (!Number.isFinite(customRate) || customRate < 0 || customRate > 100)) {
      return NextResponse.json({ error: 'Alíquota deve estar entre 0% e 100%' }, { status: 400 });
    }
    const split = calculateSplit(amount, modalidadeParam, customRate);
    return NextResponse.json({ split });
  }

  return NextResponse.json({ rules: getCommissionRules() });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ruleId, newPercentage, active } = body;

    const parsedPct = Number(newPercentage);
    if (!ruleId || newPercentage === undefined || !Number.isFinite(parsedPct) || parsedPct < 0 || parsedPct > 100) {
      return NextResponse.json(
        { error: 'ruleId e newPercentage numérico (0% a 100%) são obrigatórios' },
        { status: 400 }
      );
    }

    const updated = updateCommissionRule(ruleId, Number(parsedPct.toFixed(2)), active);
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
