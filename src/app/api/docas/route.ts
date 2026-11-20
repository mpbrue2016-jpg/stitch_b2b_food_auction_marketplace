import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedUserAndProfile,
  isSupabaseServerConfigured,
} from '@/lib/supabase/server';
import { createAdminSupabaseClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { mapDbDockToAppointment } from '@/lib/supabase/mappers';
import { buildAuditHash, buildSha256Hash } from '@/lib/security';
import { isAuthorizedAdminProfile } from '@/lib/auth-admin';

function isDemoIdentifier(id: string): boolean {
  return id.startsWith('demo-') || id.startsWith('o1000000-');
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const pedidoId = searchParams.get('pedidoId');
  const envParam = searchParams.get('env');

  if (envParam === 'modelo' || (pedidoId && isDemoIdentifier(pedidoId))) {
    return NextResponse.json({
      appointments: [],
      appointment: null,
      isDemo: true,
    });
  }

  if (!isSupabaseServerConfigured) {
    return NextResponse.json(
      { error: 'Supabase não configurado no ambiente.', appointments: [] },
      { status: 503 }
    );
  }

  try {
    const ctx = await getAuthenticatedUserAndProfile();
    if (!ctx?.user || !ctx.profile) {
      return NextResponse.json(
        { error: 'Autenticação obrigatória para consultar docas.', appointments: [] },
        { status: 401 }
      );
    }

    const dbClient = isSupabaseAdminConfigured ? createAdminSupabaseClient() : ctx.supabase;

    let query = dbClient
      .from('dock_appointments')
      .select('*, orders(codigo_pedido, is_demo)')
      .order('created_at', { ascending: false });

    if (!isAuthorizedAdminProfile(ctx.profile)) {
      query = query.or(`comprador_id.eq.${ctx.user.id},fornecedor_id.eq.${ctx.user.id}`);
    }

    const { data, error } = await query;
    if (error) {
      if (error.code === 'PGRST205' || error.code === '42703') {
        return NextResponse.json({ appointments: [], appointment: null, pendingMigration: true });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const realRows = (data || []).filter((row) => {
      const ord = (row.orders || {}) as { is_demo?: boolean };
      return !row.is_demo && !ord.is_demo;
    });

    const appointments = realRows.map((row) =>
      mapDbDockToAppointment(row as Record<string, unknown>)
    );

    if (pedidoId) {
      const apt = appointments.find((a) => a.pedidoId === pedidoId) || null;
      return NextResponse.json({ appointment: apt });
    }

    return NextResponse.json({ appointments });
  } catch (err) {
    console.error('Erro em GET /api/docas:', err);
    return NextResponse.json({ error: 'Erro ao consultar agendamentos.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: 'Supabase não configurado no ambiente.' }, { status: 503 });
  }

  try {
    const ctx = await getAuthenticatedUserAndProfile();
    if (!ctx?.user || !ctx.profile) {
      return NextResponse.json(
        { error: 'Autenticação obrigatória para agendar retirada FOB.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      pedidoId,
      janelaHoraria,
      placaVeiculo,
      motoristaNome,
      dataAgendada,
      docaNumero,
      cdOrigem,
    } = body;

    if (!pedidoId || !janelaHoraria || !placaVeiculo || !motoristaNome) {
      return NextResponse.json(
        { error: 'Parâmetros obrigatórios: pedidoId, janelaHoraria, placaVeiculo, motoristaNome' },
        { status: 400 }
      );
    }

    if (isDemoIdentifier(String(pedidoId))) {
      return NextResponse.json(
        {
          error:
            'Pedidos do Ambiente Modelo são demonstrativos. O agendamento de doca WMS real funciona apenas no Ambiente Original.',
        },
        { status: 403 }
      );
    }

    const cleanPlaca = String(placaVeiculo).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (cleanPlaca.length !== 7) {
      return NextResponse.json(
        { error: 'Placa inválida. Utilize o formato Mercosul ou padrão brasileiro (7 caracteres).' },
        { status: 400 }
      );
    }

    const dbClient = isSupabaseAdminConfigured ? createAdminSupabaseClient() : ctx.supabase;

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      String(pedidoId)
    );

    const { data: orderRow, error: orderErr } = await dbClient
      .from('orders')
      .select('*, auctions(products(origem_cd))')
      .eq(isUuid ? 'id' : 'codigo_pedido', pedidoId)
      .maybeSingle();

    if (orderErr || !orderRow) {
      return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });
    }

    const isAdmin = isAuthorizedAdminProfile(ctx.profile);
    if (orderRow.is_demo && !isAdmin) {
      return NextResponse.json(
        { error: 'Agendamentos reais são proibidos para pedidos de demonstração.' },
        { status: 403 }
      );
    }

    if (String(orderRow.comprador_id) !== ctx.user.id && !isAdmin) {
      return NextResponse.json(
        { error: 'Apenas o comprador titular deste pedido pode agendar a doca FOB.' },
        { status: 403 }
      );
    }

    if (
      orderRow.status_pagamento !== 'em_custodia_escrow' &&
      orderRow.status_pagamento !== 'repasse_liquidado_d0'
    ) {
      return NextResponse.json(
        { error: 'O agendamento de doca exige pagamento confirmado em custódia Escrow.' },
        { status: 409 }
      );
    }

    const auction = (orderRow.auctions || {}) as Record<string, unknown>;
    const product = (auction.products || {}) as Record<string, unknown>;
    const resolvedCd =
      typeof cdOrigem === 'string' && cdOrigem.trim()
        ? cdOrigem.trim()
        : String(product.origem_cd || 'CD Jundiaí - SP (Rod. Anhanguera, km 58)');
    const resolvedDoca =
      typeof docaNumero === 'string' && docaNumero.trim() ? docaNumero.trim() : 'Doca 03A';
    const resolvedDate =
      typeof dataAgendada === 'string' && dataAgendada.trim()
        ? dataAgendada.trim()
        : new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0];

    const { data: conflict } = await dbClient
      .from('dock_appointments')
      .select('id, order_id')
      .eq('cd_origem', resolvedCd)
      .eq('doca_numero', resolvedDoca)
      .eq('data_agendada', resolvedDate)
      .eq('janela_horaria', janelaHoraria)
      .neq('status', 'liberado')
      .neq('order_id', orderRow.id)
      .maybeSingle();

    if (conflict) {
      return NextResponse.json(
        {
          error:
            'Janela horária indisponível nesta doca e data. Selecione outro horário ou doca.',
        },
        { status: 409 }
      );
    }

    const passeEntradaHash = `PASSE-${buildSha256Hash(
      `${orderRow.codigo_pedido}|${resolvedDoca}|${resolvedDate}|${cleanPlaca}`
    )
      .slice(0, 12)
      .toUpperCase()}`;

    const { data: existingApt } = await dbClient
      .from('dock_appointments')
      .select('id')
      .eq('order_id', orderRow.id)
      .maybeSingle();

    const aptPayload: Record<string, unknown> = {
      order_id: orderRow.id,
      comprador_id: orderRow.comprador_id,
      fornecedor_id: orderRow.fornecedor_id,
      cd_origem: resolvedCd,
      doca_numero: resolvedDoca,
      janela_horaria: String(janelaHoraria).trim(),
      data_agendada: resolvedDate,
      placa_veiculo: cleanPlaca,
      motorista_nome: String(motoristaNome).trim().slice(0, 120),
      status: 'agendado',
      passe_entrada_hash: passeEntradaHash,
      is_demo: false,
    };

    let { data: savedApt, error: saveErr } = existingApt
      ? await dbClient
          .from('dock_appointments')
          .update(aptPayload)
          .eq('id', existingApt.id)
          .select('*, orders(codigo_pedido)')
          .single()
      : await dbClient
          .from('dock_appointments')
          .insert(aptPayload)
          .select('*, orders(codigo_pedido)')
          .single();

    if (saveErr && saveErr.code === '42703') {
      delete aptPayload.is_demo;
      const retry = existingApt
        ? await dbClient
            .from('dock_appointments')
            .update(aptPayload)
            .eq('id', existingApt.id)
            .select('*, orders(codigo_pedido)')
            .single()
        : await dbClient
            .from('dock_appointments')
            .insert(aptPayload)
            .select('*, orders(codigo_pedido)')
            .single();
      savedApt = retry.data;
      saveErr = retry.error;
    }

    if (saveErr || !savedApt) {
      return NextResponse.json(
        { error: saveErr?.message || 'Erro ao gravar agendamento WMS.' },
        { status: 500 }
      );
    }

    const docaSummary = `${resolvedDoca} • ${resolvedCd} (${resolvedDate} às ${janelaHoraria} • Placa ${cleanPlaca} • ${passeEntradaHash})`;
    await dbClient
      .from('orders')
      .update({
        doca_agendada: docaSummary,
        status_logistica: 'em_transito_fob',
      })
      .eq('id', orderRow.id);

    await dbClient.from('notifications').insert({
      user_id: orderRow.fornecedor_id,
      titulo: `Retirada FOB Agendada • ${orderRow.codigo_pedido}`,
      mensagem: `Veículo ${cleanPlaca} (${motoristaNome}) agendado para ${resolvedDate} (${janelaHoraria}) em ${resolvedDoca}.`,
      canal: 'in_app',
    });

    await dbClient.from('audit_worm_logs').insert({
      tipo_evento: 'doca_agendada',
      protocolo: String(orderRow.codigo_pedido),
      payload_json: aptPayload,
      merkle_root_hash: buildAuditHash(String(orderRow.codigo_pedido), 'doca_agendada', aptPayload),
      responsavel_id: ctx.user.id,
    });

    return NextResponse.json({
      message: 'Agendamento de Doca FOB homologado com sucesso no WMS',
      appointment: mapDbDockToAppointment(savedApt as Record<string, unknown>),
    });
  } catch (err) {
    console.error('Erro na API de agendamento de docas:', err);
    return NextResponse.json({ error: 'Erro interno ao processar agendamento' }, { status: 500 });
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
    const { appointmentId, status } = body;

    if (
      !appointmentId ||
      !['agendado', 'em_doca', 'conferido_cega', 'liberado'].includes(status)
    ) {
      return NextResponse.json(
        {
          error:
            'Parâmetros obrigatórios: appointmentId e status (agendado | em_doca | conferido_cega | liberado).',
        },
        { status: 400 }
      );
    }

    if (isDemoIdentifier(String(appointmentId))) {
      return NextResponse.json(
        { error: 'Agendamentos de demonstração não podem ser modificados no banco oficial.' },
        { status: 403 }
      );
    }

    const dbClient = isSupabaseAdminConfigured ? createAdminSupabaseClient() : ctx.supabase;
    const { data: aptRow, error: fetchErr } = await dbClient
      .from('dock_appointments')
      .select('*, orders(codigo_pedido)')
      .eq('id', appointmentId)
      .maybeSingle();

    if (fetchErr || !aptRow) {
      return NextResponse.json({ error: 'Agendamento de doca não localizado.' }, { status: 404 });
    }

    const isAdmin = isAuthorizedAdminProfile(ctx.profile);
    if (aptRow.is_demo && !isAdmin) {
      return NextResponse.json(
        { error: 'Agendamento demonstrativo protegido contra alterações.' },
        { status: 403 }
      );
    }

    const isSupplier = String(aptRow.fornecedor_id) === ctx.user.id;
    if (!isSupplier && !isAdmin) {
      return NextResponse.json(
        { error: 'Apenas o fornecedor proprietário do CD ou administrador pode atualizar a doca.' },
        { status: 403 }
      );
    }

    const { data: updatedApt, error: updErr } = await dbClient
      .from('dock_appointments')
      .update({ status })
      .eq('id', appointmentId)
      .select('*, orders(codigo_pedido)')
      .single();

    if (updErr || !updatedApt) {
      return NextResponse.json(
        { error: updErr?.message || 'Erro ao atualizar status da doca.' },
        { status: 500 }
      );
    }

    const orderLogisticsStatus =
      status === 'liberado'
        ? 'entregue'
        : status === 'conferido_cega'
        ? 'conferido_doca'
        : 'em_transito_fob';

    await dbClient
      .from('orders')
      .update({ status_logistica: orderLogisticsStatus })
      .eq('id', aptRow.order_id);

    const codigoPedido = String(
      ((aptRow.orders || {}) as Record<string, unknown>).codigo_pedido || aptRow.order_id
    );

    const statusLabelMap: Record<string, string> = {
      agendado: 'Agendado',
      em_doca: 'Veículo em Doca',
      conferido_cega: 'Conferência Cega Concluída',
      liberado: 'Carga Liberada na Portaria',
    };

    await dbClient.from('notifications').insert({
      user_id: aptRow.comprador_id,
      titulo: `WMS Doca Atualizada • ${codigoPedido}`,
      mensagem: `${aptRow.doca_numero} (${aptRow.placa_veiculo}) atualizada para: ${statusLabelMap[status] || status}.`,
      canal: 'in_app',
    });

    await dbClient.from('audit_worm_logs').insert({
      tipo_evento: `doca_${status}`,
      protocolo: codigoPedido,
      payload_json: {
        appointmentId,
        orderId: aptRow.order_id,
        status,
        orderLogisticsStatus,
        actorId: ctx.user.id,
      },
      merkle_root_hash: buildAuditHash(codigoPedido, `doca_${status}`, {
        appointmentId,
        status,
      }),
      responsavel_id: ctx.user.id,
    });

    return NextResponse.json({
      message: `Status da doca atualizado para "${statusLabelMap[status] || status}".`,
      appointment: mapDbDockToAppointment(updatedApt as Record<string, unknown>),
      orderLogisticsStatus,
    });
  } catch (err) {
    console.error('Erro em PATCH /api/docas:', err);
    return NextResponse.json({ error: 'Erro interno ao atualizar status da doca.' }, { status: 500 });
  }
}
