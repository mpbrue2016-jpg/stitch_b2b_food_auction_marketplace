import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedUserAndProfile,
  isSupabaseServerConfigured,
  mapDbProfileToUserProfile,
} from '@/lib/supabase/server';
import { createAdminSupabaseClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { buildAuditHash, isValidCnpjDigits, isValidCpfDigits } from '@/lib/security';
import { formatCnpj, formatCpf } from '@/lib/format';

export async function GET() {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json(
      { error: 'Supabase não configurado no ambiente.', authenticated: false },
      { status: 503 }
    );
  }

  try {
    const ctx = await getAuthenticatedUserAndProfile();
    if (!ctx?.user) {
      return NextResponse.json({ authenticated: false, profile: null }, { status: 401 });
    }

    let profile = ctx.profile;
    if (!profile) {
      const writer = isSupabaseAdminConfigured ? createAdminSupabaseClient() : ctx.supabase;
      const meta = (ctx.user.user_metadata || {}) as Record<string, string | undefined>;
      const safeRole = meta.role === 'fornecedor' ? 'fornecedor' : 'comprador';
      const tipoPessoa = meta.tipo_pessoa === 'PF' ? 'PF' : 'PJ';
      const fallbackInsert: Record<string, unknown> = {
        id: ctx.user.id,
        email: ctx.user.email || `${ctx.user.id}@placeholder.local`,
        role: safeRole,
        tipo_pessoa: tipoPessoa,
        perfil_comercial: meta.perfil_comercial || safeRole,
        is_demo: false,
        cpf: meta.cpf || null,
        cnpj:
          tipoPessoa === 'PF'
            ? meta.cnpj || null
            : meta.cnpj || `PEND-${ctx.user.id.slice(0, 12).toUpperCase()}`,
        razao_social: meta.razao_social || 'Empresa B2B',
        nome_fantasia: meta.nome_fantasia || meta.razao_social || 'Empresa B2B',
        telefone: meta.telefone || null,
        cidade: meta.cidade || 'São Paulo',
        uf: (meta.uf || 'SP').slice(0, 2).toUpperCase(),
        limite_credito_escrow: safeRole === 'comprador' ? 50000 : 0,
        status_aprovacao: 'aprovado',
      };

      let { data: inserted, error: upsertErr } = await writer
        .from('profiles')
        .upsert(fallbackInsert, { onConflict: 'id' })
        .select('*')
        .single();

      if (upsertErr && upsertErr.code === '42703') {
        delete fallbackInsert.tipo_pessoa;
        delete fallbackInsert.perfil_comercial;
        delete fallbackInsert.is_demo;
        if (!fallbackInsert.cnpj) {
          fallbackInsert.cnpj = meta.cpf || `PF-${ctx.user.id.slice(0, 12).toUpperCase()}`;
        }
        const retry = await writer
          .from('profiles')
          .upsert(fallbackInsert, { onConflict: 'id' })
          .select('*')
          .single();
        inserted = retry.data;
      }

      if (inserted) {
        profile = mapDbProfileToUserProfile(inserted as Record<string, unknown>);
      }
    }

    const { data: docs } = await ctx.supabase
      .from('user_documents')
      .select('id, tipo_documento, nome_arquivo, storage_path, status_validacao, created_at')
      .eq('user_id', ctx.user.id)
      .order('created_at', { ascending: false });

    const { data: notifications } = await ctx.supabase
      .from('notifications')
      .select('*')
      .eq('user_id', ctx.user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    const realNotifications = (notifications || []).filter(
      (n) => !(n as Record<string, unknown>).is_demo
    );

    return NextResponse.json({
      authenticated: true,
      user: { id: ctx.user.id, email: ctx.user.email },
      profile,
      documents: docs || [],
      notifications: realNotifications,
    });
  } catch (err) {
    console.error('Erro ao carregar perfil autenticado:', err);
    return NextResponse.json({ error: 'Erro interno ao consultar perfil.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: 'Supabase não configurado no ambiente.' }, { status: 503 });
  }

  try {
    const ctx = await getAuthenticatedUserAndProfile();
    if (!ctx?.user || !ctx.profile) {
      return NextResponse.json({ error: 'Autenticação obrigatória.' }, { status: 401 });
    }

    const body = await req.json();

    if (body.targetUserId && body.targetUserId !== ctx.user.id) {
      if (ctx.profile.role !== 'admin') {
        return NextResponse.json(
          { error: 'Apenas administradores podem aprovar cadastros ou alterar limites.' },
          { status: 403 }
        );
      }
      if (!isSupabaseAdminConfigured) {
        return NextResponse.json(
          { error: 'SUPABASE_SERVICE_ROLE_KEY não configurada para operação administrativa.' },
          { status: 503 }
        );
      }

      const admin = createAdminSupabaseClient();
      const updates: Record<string, unknown> = {};
      if (
        body.statusAprovacao &&
        ['aprovado', 'em_analise', 'pendente'].includes(body.statusAprovacao)
      ) {
        updates.status_aprovacao = body.statusAprovacao;
      }
      if (body.limiteCreditoEscrow !== undefined) {
        const limitVal = Number(body.limiteCreditoEscrow);
        if (!Number.isFinite(limitVal) || limitVal < 0) {
          return NextResponse.json({ error: 'Limite de crédito inválido.' }, { status: 400 });
        }
        updates.limite_credito_escrow = limitVal;
      }

      if (Object.keys(updates).length === 0) {
        return NextResponse.json(
          { error: 'Informe statusAprovacao ou limiteCreditoEscrow válidos para atualização.' },
          { status: 400 }
        );
      }

      const { data: updatedTarget, error } = await admin
        .from('profiles')
        .update(updates)
        .eq('id', body.targetUserId)
        .select('*')
        .single();

      if (error || !updatedTarget) {
        return NextResponse.json(
          { error: error?.message || 'Perfil não encontrado.' },
          { status: 400 }
        );
      }

      await admin.from('audit_worm_logs').insert({
        tipo_evento: 'kyc_admin_decisao',
        protocolo: `KYC-${String(updatedTarget.cnpj || updatedTarget.cpf || body.targetUserId)}`,
        payload_json: { targetUserId: body.targetUserId, updates, adminId: ctx.user.id },
        merkle_root_hash: buildAuditHash(
          String(body.targetUserId),
          'kyc_admin_decisao',
          updates
        ),
        responsavel_id: ctx.user.id,
      });

      return NextResponse.json({
        message: 'Perfil corporativo atualizado pelo compliance administrativo.',
        profile: mapDbProfileToUserProfile(updatedTarget as Record<string, unknown>),
      });
    }

    if (ctx.profile.isDemo && ctx.profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Perfis de demonstração não podem ser alterados por usuários comuns.' },
        { status: 403 }
      );
    }

    const allowedUpdates: Record<string, unknown> = {};
    if (typeof body.nomeFantasia === 'string' && body.nomeFantasia.trim().length >= 2) {
      allowedUpdates.nome_fantasia = body.nomeFantasia.trim().slice(0, 255);
    }
    if (typeof body.telefone === 'string') {
      allowedUpdates.telefone = body.telefone.trim().slice(0, 30);
    }
    if (typeof body.cidade === 'string' && body.cidade.trim()) {
      allowedUpdates.cidade = body.cidade.trim().slice(0, 100);
    }
    if (typeof body.uf === 'string' && body.uf.trim().length === 2) {
      allowedUpdates.uf = body.uf.trim().toUpperCase();
    }
    if (typeof body.logradouro === 'string') {
      allowedUpdates.logradouro = body.logradouro.trim().slice(0, 255);
    }
    if (typeof body.cep === 'string') {
      allowedUpdates.cep = body.cep.trim().slice(0, 10);
    }
    if (typeof body.cnpj === 'string' && body.cnpj.trim()) {
      if (!isValidCnpjDigits(body.cnpj)) {
        return NextResponse.json(
          { error: 'CNPJ com dígitos verificadores inválidos.' },
          { status: 400 }
        );
      }
      allowedUpdates.cnpj = formatCnpj(body.cnpj);
    }
    if (typeof body.cpf === 'string' && body.cpf.trim()) {
      if (!isValidCpfDigits(body.cpf)) {
        return NextResponse.json(
          { error: 'CPF com dígitos verificadores inválidos.' },
          { status: 400 }
        );
      }
      allowedUpdates.cpf = formatCpf(body.cpf);
    }

    if (Object.keys(allowedUpdates).length === 0) {
      return NextResponse.json(
        { error: 'Nenhum campo cadastral válido informado para atualização.' },
        { status: 400 }
      );
    }

    const { data: updatedSelf, error: selfErr } = await ctx.supabase
      .from('profiles')
      .update(allowedUpdates)
      .eq('id', ctx.user.id)
      .select('*')
      .single();

    if (selfErr || !updatedSelf) {
      return NextResponse.json(
        { error: selfErr?.message || 'Erro ao atualizar dados cadastrais.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: 'Dados cadastrais atualizados com sucesso.',
      profile: mapDbProfileToUserProfile(updatedSelf as Record<string, unknown>),
    });
  } catch (err) {
    console.error('Erro em PATCH /api/auth/perfil:', err);
    return NextResponse.json({ error: 'Erro interno ao atualizar perfil.' }, { status: 500 });
  }
}
