import { NextRequest, NextResponse } from 'next/server';
import { calculateSplit } from '@/lib/commission-engine';
import {
  createServerSupabaseClient,
  getAuthenticatedUserAndProfile,
  isSupabaseServerConfigured,
} from '@/lib/supabase/server';
import { createAdminSupabaseClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { mapDbCommissionRule } from '@/lib/supabase/mappers';
import { buildAuditHash } from '@/lib/security';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const amountParam = searchParams.get('amount');
  const modalidadeParam = searchParams.get('modalidade') || 'leilao';
  const customRateParam = searchParams.get('rate');

  if (!isSupabaseServerConfigured) {
    return NextResponse.json(
      { error: 'Supabase não configurado no ambiente.', rules: [] },
      { status: 503 }
    );
  }

  try {
    const supabase = createServerSupabaseClient();
    const { data: rows, error } = await supabase
      .from('commission_rules')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message, rules: [] }, { status: 500 });
    }

    const rules = (rows || []).map((r) => mapDbCommissionRule(r as Record<string, unknown>));

    if (amountParam) {
      const amount = Number(amountParam);
      if (!Number.isFinite(amount) || amount < 0) {
        return NextResponse.json(
          { error: 'Valor inválido para cálculo de split' },
          { status: 400 }
        );
      }
      const customRate = customRateParam ? Number(customRateParam) : undefined;
      if (
        customRate !== undefined &&
        (!Number.isFinite(customRate) || customRate < 0 || customRate > 100)
      ) {
        return NextResponse.json(
          { error: 'Alíquota deve estar entre 0% e 100%' },
          { status: 400 }
        );
      }

      const activeRule = rules.find((r) => r.slug === modalidadeParam && r.ativo);
      const effectiveRate = customRate ?? activeRule?.percentualPadrao;
      if (effectiveRate === undefined) {
        return NextResponse.json(
          { error: 'Não há regra ativa de comissão para esta modalidade.' },
          { status: 409 }
        );
      }
      const split = calculateSplit(amount, effectiveRate);
      return NextResponse.json({ split, rules });
    }

    return NextResponse.json({ rules });
  } catch (err) {
    console.error('Erro em GET /api/comissoes:', err);
    return NextResponse.json({ error: 'Erro interno ao consultar comissões.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: 'Supabase não configurado no ambiente.' }, { status: 503 });
  }

  try {
    const ctx = await getAuthenticatedUserAndProfile();
    if (!ctx?.user || !ctx.profile) {
      return NextResponse.json({ error: 'Autenticação obrigatória.' }, { status: 401 });
    }
    if (ctx.profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Apenas administradores podem alterar alíquotas de comissão.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { ruleId, newPercentage, active } = body;

    const parsedPct = Number(newPercentage);
    if (
      !ruleId ||
      newPercentage === undefined ||
      !Number.isFinite(parsedPct) ||
      parsedPct < 0 ||
      parsedPct > 100
    ) {
      return NextResponse.json(
        { error: 'ruleId e newPercentage numérico (0% a 100%) são obrigatórios' },
        { status: 400 }
      );
    }

    const dbClient = isSupabaseAdminConfigured ? createAdminSupabaseClient() : ctx.supabase;
    const updates: Record<string, unknown> = {
      percentual_padrao: Number(parsedPct.toFixed(2)),
    };
    if (typeof active === 'boolean') {
      updates.ativo = active;
    }

    const { data: updatedRow, error } = await dbClient
      .from('commission_rules')
      .update(updates)
      .eq('id', ruleId)
      .select('*')
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!updatedRow) {
      return NextResponse.json({ error: 'Regra de comissão não encontrada' }, { status: 404 });
    }

    await dbClient.from('audit_worm_logs').insert({
      tipo_evento: 'comissao_atualizada',
      protocolo: `TAXA-${String(updatedRow.slug)}`,
      payload_json: { ruleId, updates, adminId: ctx.user.id },
      merkle_root_hash: buildAuditHash(String(ruleId), 'comissao_atualizada', updates),
      responsavel_id: ctx.user.id,
    });

    return NextResponse.json({
      message: 'Regra de comissão administrativa atualizada no banco com sucesso',
      rule: mapDbCommissionRule(updatedRow as Record<string, unknown>),
    });
  } catch (err) {
    console.error('Erro ao atualizar regra de comissão:', err);
    return NextResponse.json({ error: 'Erro interno ao processar comissão' }, { status: 500 });
  }
}
