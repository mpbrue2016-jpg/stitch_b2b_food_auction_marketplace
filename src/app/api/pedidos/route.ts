import { NextRequest, NextResponse } from 'next/server';
import { calculateSplit, generateFinancialSummary } from '@/lib/commission-engine';
import {
  getAuthenticatedUserAndProfile,
  isSupabaseServerConfigured,
} from '@/lib/supabase/server';
import { createAdminSupabaseClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { mapDbOrderToEscrowOrder } from '@/lib/supabase/mappers';
import { buildAuditHash, buildSha256Hash } from '@/lib/security';
import { generatePixEmvPayload } from '@/lib/pix-emv';
import { DEMO_ORDERS, DEMO_SUPPLIER_ID } from '@/lib/demo-data';

const ORDER_SELECT = `
  *,
  auctions(id, codigo_lote, tipo_venda, products(id, titulo, fornecedor_id)),
  comprador:profiles!orders_comprador_id_fkey(id, nome_fantasia, razao_social),
  fornecedor:profiles!orders_fornecedor_id_fkey(id, nome_fantasia, razao_social)
`;

function isDemoOrderRow(row: Record<string, unknown>): boolean {
  if (typeof row.is_demo === 'boolean') return row.is_demo;
  return (
    String(row.id || '').startsWith('o1000000-') ||
    String(row.fornecedor_id || '') === DEMO_SUPPLIER_ID
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const envParam = searchParams.get('env');
  const orderIdParam = searchParams.get('orderId') || searchParams.get('id');

  if (envParam === 'modelo') {
    if (orderIdParam) {
      const demoOrd = DEMO_ORDERS.find(
        (o) => o.id === orderIdParam || o.codigoPedido === orderIdParam
      );
      if (!demoOrd) {
        return NextResponse.json({ error: 'Pedido modelo não encontrado.' }, { status: 404 });
      }
      return NextResponse.json({ order: demoOrd, pix: null, env: 'modelo' });
    }
    return NextResponse.json({
      orders: DEMO_ORDERS,
      summary: generateFinancialSummary(DEMO_ORDERS),
      env: 'modelo',
    });
  }

  if (!isSupabaseServerConfigured) {
    return NextResponse.json(
      { error: 'Supabase não configurado no ambiente.', orders: [] },
      { status: 503 }
    );
  }

  try {
    const ctx = await getAuthenticatedUserAndProfile();
    if (!ctx?.user || !ctx.profile) {
      return NextResponse.json(
        { error: 'Autenticação obrigatória para acessar pedidos.', orders: [] },
        { status: 401 }
      );
    }

    const dbClient = isSupabaseAdminConfigured ? createAdminSupabaseClient() : ctx.supabase;

    if (orderIdParam) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        orderIdParam
      );
      const { data: singleOrder, error: singleErr } = await dbClient
        .from('orders')
        .select(ORDER_SELECT)
        .eq(isUuid ? 'id' : 'codigo_pedido', orderIdParam)
        .maybeSingle();

      if (singleErr || !singleOrder) {
        return NextResponse.json({ error: 'Pedido não localizado.' }, { status: 404 });
      }

      if (isDemoOrderRow(singleOrder as Record<string, unknown>) && ctx.profile.role !== 'admin') {
        return NextResponse.json({ error: 'Pedido pertence ao Ambiente Modelo.' }, { status: 404 });
      }

      const isOwner =
        String(singleOrder.comprador_id) === ctx.user.id ||
        String(singleOrder.fornecedor_id) === ctx.user.id ||
        ctx.profile.role === 'admin';

      if (!isOwner) {
        return NextResponse.json({ error: 'Acesso negado a este pedido.' }, { status: 403 });
      }

      const { data: txRow } = await dbClient
        .from('payment_transactions')
        .select('txid, pix_copia_cola, valor, status')
        .eq('order_id', singleOrder.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return NextResponse.json({
        order: mapDbOrderToEscrowOrder(singleOrder as Record<string, unknown>),
        pix: txRow
          ? {
              txid: txRow.txid,
              pixCopiaCola: txRow.pix_copia_cola,
              valor: Number(txRow.valor ?? singleOrder.valor_total_arremate),
            }
          : null,
        env: 'original',
      });
    }

    let query = dbClient
      .from('orders')
      .select(ORDER_SELECT)
      .order('created_at', { ascending: false });

    if (ctx.profile.role === 'comprador') {
      query = query.eq('comprador_id', ctx.user.id);
    } else if (ctx.profile.role === 'fornecedor') {
      query = query.eq('fornecedor_id', ctx.user.id);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message, orders: [] }, { status: 500 });
    }

    // Garante que pedidos demonstrativos não sejam misturados com os pedidos reais do usuário
    const realOrders = (data || [])
      .filter((r) => !isDemoOrderRow(r as Record<string, unknown>))
      .map((r) => mapDbOrderToEscrowOrder(r as Record<string, unknown>));

    return NextResponse.json({
      orders: realOrders,
      summary: generateFinancialSummary(realOrders),
      env: 'original',
    });
  } catch (err) {
    console.error('Erro em GET /api/pedidos:', err);
    return NextResponse.json({ error: 'Erro ao consultar pedidos.' }, { status: 500 });
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
        { error: 'Autenticação obrigatória para fechar arremate Escrow.' },
        { status: 401 }
      );
    }

    if (ctx.profile.role === 'fornecedor') {
      return NextResponse.json(
        { error: 'Apenas compradores homologados podem gerar ordens Escrow.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      loteId,
      sourceType = 'buy_now',
      proposalId,
      pixComprovanteCodigo,
      orderIdToConfirm,
    } = body;

    const dbClient = isSupabaseAdminConfigured ? createAdminSupabaseClient() : ctx.supabase;

    if (orderIdToConfirm) {
      if (String(orderIdToConfirm).startsWith('demo-') || String(orderIdToConfirm).startsWith('o1000000-')) {
        return NextResponse.json(
          { error: 'Ambiente Modelo não permite liquidação financeira real.' },
          { status: 403 }
        );
      }

      const { data: existingOrder, error: exErr } = await dbClient
        .from('orders')
        .select(ORDER_SELECT)
        .eq('id', orderIdToConfirm)
        .maybeSingle();

      if (exErr || !existingOrder) {
        return NextResponse.json({ error: 'Pedido não localizado.' }, { status: 404 });
      }
      if (isDemoOrderRow(existingOrder as Record<string, unknown>)) {
        return NextResponse.json(
          { error: 'Ambiente Modelo não permite liquidação financeira real.' },
          { status: 403 }
        );
      }
      if (String(existingOrder.comprador_id) !== ctx.user.id && ctx.profile.role !== 'admin') {
        return NextResponse.json({ error: 'Acesso negado a este pedido.' }, { status: 403 });
      }

      const { data: updatedOrder, error: updErr } = await dbClient
        .from('orders')
        .update({
          status_pagamento: 'em_custodia_escrow',
          comprovante_pix_spi:
            typeof pixComprovanteCodigo === 'string' && pixComprovanteCodigo.trim()
              ? pixComprovanteCodigo.trim().slice(0, 180)
              : existingOrder.comprovante_pix_spi,
        })
        .eq('id', orderIdToConfirm)
        .select(ORDER_SELECT)
        .single();

      if (updErr || !updatedOrder) {
        return NextResponse.json({ error: updErr?.message || 'Erro ao confirmar depósito.' }, { status: 500 });
      }

      if (existingOrder.auction_id) {
        await dbClient
          .from('auctions')
          .update({ status: 'homologado', vencedor_id: existingOrder.comprador_id })
          .eq('id', existingOrder.auction_id);
      }

      await dbClient
        .from('payment_transactions')
        .update({
          status: 'pago',
          paid_at: new Date().toISOString(),
          e2e_id:
            typeof pixComprovanteCodigo === 'string' && pixComprovanteCodigo.trim()
              ? pixComprovanteCodigo.trim().slice(0, 80)
              : null,
        })
        .eq('order_id', existingOrder.id);

      return NextResponse.json({
        message: 'Depósito Escrow homologado e pedido gerado com sucesso',
        order: mapDbOrderToEscrowOrder(updatedOrder as Record<string, unknown>),
      });
    }

    if (!loteId) {
      return NextResponse.json(
        { error: 'Parâmetro obrigatório: loteId.' },
        { status: 400 }
      );
    }

    if (String(loteId).startsWith('demo-') || String(loteId).startsWith('a1000000-')) {
      return NextResponse.json(
        {
          error:
            'Ambiente Modelo é apenas demonstrativo. Não é permitido criar ordens de pagamento reais para lotes modelo.',
        },
        { status: 403 }
      );
    }

    const { data: auctionRow, error: aucErr } = await dbClient
      .from('auctions')
      .select('*, products(*)')
      .eq('id', loteId)
      .maybeSingle();

    if (aucErr || !auctionRow || !auctionRow.products) {
      return NextResponse.json({ error: 'Lote não encontrado no banco de dados.' }, { status: 404 });
    }

    const product = auctionRow.products as Record<string, unknown>;
    if (
      (auctionRow as Record<string, unknown>).is_demo === true ||
      product.is_demo === true ||
      String(product.fornecedor_id || '') === DEMO_SUPPLIER_ID
    ) {
      return NextResponse.json(
        {
          error:
            'Ambiente Modelo é apenas demonstrativo. Não é permitido realizar transações reais em lotes modelo.',
        },
        { status: 403 }
      );
    }

    if (
      (auctionRow.status === 'homologado' || auctionRow.status === 'cancelado') &&
      sourceType !== 'proposal'
    ) {
      return NextResponse.json(
        { error: 'Este lote já foi arrematado e homologado em custódia Escrow.' },
        { status: 409 }
      );
    }

    const supplierId = String(product.fornecedor_id || '');
    if (!supplierId) {
      return NextResponse.json({ error: 'Fornecedor do lote não identificado.' }, { status: 400 });
    }
    if (supplierId === ctx.user.id) {
      return NextResponse.json(
        { error: 'Fornecedor não pode arrematar o próprio lote.' },
        { status: 403 }
      );
    }

    let authoritativeAmount = 0;
    const modalidadeSlug = String(auctionRow.tipo_venda || 'leilao');

    if (sourceType === 'proposal' && proposalId) {
      const { data: propRow } = await dbClient
        .from('negotiation_proposals')
        .select('*')
        .eq('id', proposalId)
        .eq('comprador_id', ctx.user.id)
        .eq('status', 'aceita')
        .maybeSingle();

      if (!propRow) {
        return NextResponse.json(
          { error: 'Proposta aceita não encontrada para este comprador.' },
          { status: 404 }
        );
      }
      authoritativeAmount = Number(propRow.valor_total_proposta);
    } else if (sourceType === 'auction') {
      if (
        auctionRow.vencedor_id &&
        String(auctionRow.vencedor_id) !== ctx.user.id &&
        ctx.profile.role !== 'admin'
      ) {
        return NextResponse.json(
          { error: 'Apenas o detentor do maior lance vencedor pode liquidar este arremate.' },
          { status: 403 }
        );
      }
      authoritativeAmount = Number(auctionRow.lance_atual ?? auctionRow.lance_inicial);
    } else {
      authoritativeAmount = Number(
        auctionRow.preco_arremate_imediato ?? auctionRow.lance_atual ?? auctionRow.lance_inicial
      );
    }

    if (!Number.isFinite(authoritativeAmount) || authoritativeAmount <= 0) {
      return NextResponse.json(
        { error: 'Valor do lote inválido para liquidação Escrow.' },
        { status: 400 }
      );
    }

    const { data: ruleRow } = await dbClient
      .from('commission_rules')
      .select('percentual_padrao')
      .eq('slug', modalidadeSlug)
      .eq('ativo', true)
      .maybeSingle();

    const { data: fallbackRule } = !ruleRow
      ? await dbClient
          .from('commission_rules')
          .select('percentual_padrao')
          .eq('slug', 'leilao')
          .eq('ativo', true)
          .maybeSingle()
      : { data: null };

    const commissionRate = Number(
      ruleRow?.percentual_padrao ?? fallbackRule?.percentual_padrao ?? 6.0
    );
    const split = calculateSplit(authoritativeAmount, modalidadeSlug, commissionRate);

    const suffix = Date.now().toString().slice(-6);
    const codigoPedido = `PED-${new Date().getFullYear()}-${suffix}`;
    const txid = `VO${Date.now()}${suffix}`.slice(0, 25);
    const termoArremateHash = buildSha256Hash(
      `${codigoPedido}|${loteId}|${ctx.user.id}|${supplierId}|${split.valorBrutoTotal.toFixed(2)}`
    );

    const pixCopiaCola = generatePixEmvPayload({
      amount: split.valorBrutoTotal,
      txid,
      description: `${codigoPedido} ${auctionRow.codigo_lote}`,
    });

    const hasPixReceipt =
      typeof pixComprovanteCodigo === 'string' && pixComprovanteCodigo.trim().length > 0;
    const initialPaymentStatus =
      body.mode === 'charge_only' ? 'aguardando_pagamento' : 'em_custodia_escrow';

    const orderPayload: Record<string, unknown> = {
      codigo_pedido: codigoPedido,
      auction_id: loteId,
      comprador_id: ctx.user.id,
      fornecedor_id: supplierId,
      valor_total_arremate: split.valorBrutoTotal,
      percentual_comissao: split.percentualComissao,
      valor_comissao_plataforma: split.valorComissaoPlataforma,
      valor_repasse_liquido: split.valorRepasseLiquidoFornecedor,
      taxa_escrow_bancaria: split.taxaEscrowBancaria,
      status_pagamento: initialPaymentStatus,
      status_logistica: 'agendamento_doca',
      doca_agendada: 'Aguardando agendamento de Doca FOB no CD',
      termo_arremate_hash: termoArremateHash,
      comprovante_pix_spi: hasPixReceipt ? pixComprovanteCodigo.trim().slice(0, 180) : txid,
      is_demo: false,
    };

    let { data: insertedOrder, error: ordErr } = await dbClient
      .from('orders')
      .insert(orderPayload)
      .select(ORDER_SELECT)
      .single();

    if (ordErr && ordErr.message?.includes('is_demo')) {
      delete orderPayload.is_demo;
      const retry = await dbClient.from('orders').insert(orderPayload).select(ORDER_SELECT).single();
      insertedOrder = retry.data;
      ordErr = retry.error;
    }

    if (ordErr || !insertedOrder) {
      return NextResponse.json(
        { error: ordErr?.message || 'Erro ao criar ordem Escrow.' },
        { status: 500 }
      );
    }

    await dbClient.from('payment_transactions').insert({
      order_id: insertedOrder.id,
      txid,
      metodo: 'pix_escrow',
      valor: split.valorBrutoTotal,
      pix_copia_cola: pixCopiaCola,
      e2e_id: hasPixReceipt ? pixComprovanteCodigo.trim().slice(0, 80) : null,
      status: initialPaymentStatus === 'em_custodia_escrow' ? 'pago' : 'pendente',
      paid_at: initialPaymentStatus === 'em_custodia_escrow' ? new Date().toISOString() : null,
    });

    if (initialPaymentStatus === 'em_custodia_escrow') {
      await dbClient
        .from('auctions')
        .update({ status: 'homologado', vencedor_id: ctx.user.id })
        .eq('id', loteId);
    }

    await dbClient.from('notifications').insert([
      {
        user_id: supplierId,
        titulo: `Pedido Escrow Gerado • ${codigoPedido}`,
        mensagem: `Lote ${auctionRow.codigo_lote} reservado por ${ctx.profile.nomeFantasia} (Valor líquido previsto: R$ ${split.valorRepasseLiquidoFornecedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).`,
        canal: 'in_app',
      },
      {
        user_id: ctx.user.id,
        titulo: `Custódia Escrow Ativada • ${codigoPedido}`,
        mensagem: `Prossiga com o agendamento de doca FOB para retirada da carga.`,
        canal: 'in_app',
      },
    ]);

    await dbClient.from('audit_worm_logs').insert({
      tipo_evento: 'pedido_escrow_criado',
      protocolo: codigoPedido,
      payload_json: {
        orderId: insertedOrder.id,
        loteId,
        sourceType,
        split,
        txid,
      },
      merkle_root_hash: termoArremateHash,
      responsavel_id: ctx.user.id,
    });

    return NextResponse.json(
      {
        message:
          initialPaymentStatus === 'em_custodia_escrow'
            ? 'Depósito Escrow homologado e pedido gerado com sucesso'
            : 'Cobrança PIX Escrow gerada com sucesso',
        order: mapDbOrderToEscrowOrder(insertedOrder as Record<string, unknown>),
        pix: {
          txid,
          pixCopiaCola,
          valor: split.valorBrutoTotal,
        },
        split,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('Erro ao registrar pedido escrow:', err);
    return NextResponse.json({ error: 'Erro interno ao homologar pedido escrow' }, { status: 500 });
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
    const { orderId, action, reason } = body;

    if (!orderId || !action) {
      return NextResponse.json(
        { error: 'Parâmetros obrigatórios: orderId e action.' },
        { status: 400 }
      );
    }

    if (String(orderId).startsWith('demo-') || String(orderId).startsWith('o1000000-')) {
      return NextResponse.json(
        { error: 'Pedidos do Ambiente Modelo não podem ser alterados no banco real.' },
        { status: 403 }
      );
    }

    const dbClient = isSupabaseAdminConfigured ? createAdminSupabaseClient() : ctx.supabase;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      String(orderId)
    );

    const { data: currentRow, error: fetchErr } = await dbClient
      .from('orders')
      .select(ORDER_SELECT)
      .eq(isUuid ? 'id' : 'codigo_pedido', orderId)
      .maybeSingle();

    if (fetchErr || !currentRow) {
      return NextResponse.json({ error: 'Pedido escrow não encontrado' }, { status: 404 });
    }

    if (isDemoOrderRow(currentRow as Record<string, unknown>) && ctx.profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Pedidos demonstrativos não podem ser modificados por usuários comuns.' },
        { status: 403 }
      );
    }

    const isBuyer = String(currentRow.comprador_id) === ctx.user.id;
    const isAdmin = ctx.profile.role === 'admin';

    if (action === 'confirm_delivery' || action === 'release_escrow') {
      if (action === 'confirm_delivery' && !isBuyer && !isAdmin) {
        return NextResponse.json(
          { error: 'Apenas o comprador titular ou administrador pode confirmar o recebimento.' },
          { status: 403 }
        );
      }
      if (action === 'release_escrow' && !isAdmin) {
        return NextResponse.json(
          { error: 'Apenas administradores podem forçar liquidação D+0 de custódia.' },
          { status: 403 }
        );
      }
      if (currentRow.status_pagamento === 'estornado') {
        return NextResponse.json(
          { error: 'Pedido já estornado não pode ser liquidado.' },
          { status: 400 }
        );
      }
      if (currentRow.status_pagamento === 'aguardando_pagamento') {
        return NextResponse.json(
          { error: 'Não é possível liquidar D+0 antes da confirmação do pagamento PIX em Escrow.' },
          { status: 409 }
        );
      }

      const { data: updatedRow, error: updErr } = await dbClient
        .from('orders')
        .update({
          status_pagamento: 'repasse_liquidado_d0',
          status_logistica: action === 'confirm_delivery' ? 'entregue' : currentRow.status_logistica,
          motivo_disputa: null,
        })
        .eq('id', currentRow.id)
        .select(ORDER_SELECT)
        .single();

      if (updErr || !updatedRow) {
        return NextResponse.json({ error: updErr?.message || 'Erro ao liquidar pedido.' }, { status: 500 });
      }

      if (action === 'confirm_delivery') {
        await dbClient
          .from('dock_appointments')
          .update({ status: 'liberado' })
          .eq('order_id', currentRow.id);
      }

      await dbClient
        .from('payment_transactions')
        .update({ status: 'liquidado_d0' })
        .eq('order_id', currentRow.id);

      await dbClient.from('notifications').insert({
        user_id: currentRow.fornecedor_id,
        titulo: `Repasse D+0 Liquidado • ${currentRow.codigo_pedido}`,
        mensagem: `Valor líquido de R$ ${Number(currentRow.valor_repasse_liquido).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} liberado via SPI.`,
        canal: 'in_app',
      });

      await dbClient.from('audit_worm_logs').insert({
        tipo_evento: `escrow_${action}`,
        protocolo: String(currentRow.codigo_pedido),
        payload_json: { orderId: currentRow.id, actorId: ctx.user.id },
        merkle_root_hash: buildAuditHash(String(currentRow.codigo_pedido), action, {
          actorId: ctx.user.id,
        }),
        responsavel_id: ctx.user.id,
      });

      return NextResponse.json({
        message: 'Custódia Escrow liquidada D+0 com sucesso via SPI Bancário',
        order: mapDbOrderToEscrowOrder(updatedRow as Record<string, unknown>),
      });
    }

    if (action === 'open_dispute') {
      if (!isBuyer && !isAdmin) {
        return NextResponse.json(
          { error: 'Apenas o comprador titular ou administrador pode abrir disputa.' },
          { status: 403 }
        );
      }
      if (currentRow.status_pagamento !== 'em_custodia_escrow') {
        return NextResponse.json(
          { error: 'Apenas pedidos em custódia Escrow ativa podem abrir divergência.' },
          { status: 400 }
        );
      }

      const motivo =
        typeof reason === 'string' && reason.trim().length >= 5
          ? reason.trim().slice(0, 220)
          : 'Divergência de conferência na doca FOB (bloqueio preventivo de custódia)';

      const { data: updatedRow, error: updErr } = await dbClient
        .from('orders')
        .update({
          status_pagamento: 'em_disputa',
          motivo_disputa: motivo,
        })
        .eq('id', currentRow.id)
        .select(ORDER_SELECT)
        .single();

      if (updErr || !updatedRow) {
        return NextResponse.json({ error: updErr?.message || 'Erro ao registrar disputa.' }, { status: 500 });
      }

      await dbClient
        .from('payment_transactions')
        .update({ status: 'em_disputa' })
        .eq('order_id', currentRow.id);

      await dbClient.from('audit_worm_logs').insert({
        tipo_evento: 'escrow_disputa_aberta',
        protocolo: String(currentRow.codigo_pedido),
        payload_json: { orderId: currentRow.id, motivo, actorId: ctx.user.id },
        merkle_root_hash: buildAuditHash(String(currentRow.codigo_pedido), 'open_dispute', {
          motivo,
        }),
        responsavel_id: ctx.user.id,
      });

      return NextResponse.json({
        message: 'Divergência registrada e saldo Escrow bloqueado para mediação',
        order: mapDbOrderToEscrowOrder(updatedRow as Record<string, unknown>),
      });
    }

    if (action === 'refund_escrow') {
      if (!isAdmin) {
        return NextResponse.json(
          { error: 'Apenas administradores podem autorizar estorno integral Escrow.' },
          { status: 403 }
        );
      }
      if (currentRow.status_pagamento === 'estornado') {
        return NextResponse.json(
          { error: 'Este pedido já foi estornado anteriormente.' },
          { status: 409 }
        );
      }
      if (currentRow.status_pagamento === 'repasse_liquidado_d0') {
        return NextResponse.json(
          { error: 'Repasse já liquidado D+0 não pode ser estornado automaticamente.' },
          { status: 400 }
        );
      }

      const motivoEstorno =
        typeof reason === 'string' && reason.trim()
          ? reason.trim().slice(0, 220)
          : String(
              currentRow.motivo_disputa || 'Custódia estornada ao comprador via moderação Escrow'
            );

      const { data: updatedRow, error: updErr } = await dbClient
        .from('orders')
        .update({
          status_pagamento: 'estornado',
          motivo_disputa: motivoEstorno,
        })
        .eq('id', currentRow.id)
        .select(ORDER_SELECT)
        .single();

      if (updErr || !updatedRow) {
        return NextResponse.json({ error: updErr?.message || 'Erro ao estornar pedido.' }, { status: 500 });
      }

      await dbClient
        .from('dock_appointments')
        .update({ status: 'liberado' })
        .eq('order_id', currentRow.id);

      await dbClient
        .from('payment_transactions')
        .update({ status: 'estornado' })
        .eq('order_id', currentRow.id);

      await dbClient.from('audit_worm_logs').insert({
        tipo_evento: 'escrow_estornado',
        protocolo: String(currentRow.codigo_pedido),
        payload_json: { orderId: currentRow.id, motivoEstorno, adminId: ctx.user.id },
        merkle_root_hash: buildAuditHash(String(currentRow.codigo_pedido), 'refund_escrow', {
          motivoEstorno,
        }),
        responsavel_id: ctx.user.id,
      });

      return NextResponse.json({
        message: 'Custódia Escrow estornada integralmente ao comprador via PIX SPI',
        order: mapDbOrderToEscrowOrder(updatedRow as Record<string, unknown>),
      });
    }

    return NextResponse.json({ error: 'Ação desconhecida' }, { status: 400 });
  } catch (err) {
    console.error('Erro ao atualizar pedido escrow:', err);
    return NextResponse.json({ error: 'Erro interno ao atualizar pedido' }, { status: 500 });
  }
}
