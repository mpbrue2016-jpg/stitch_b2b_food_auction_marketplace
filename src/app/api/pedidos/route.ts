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

const ORDER_SELECT = `
  *,
  auctions(id, codigo_lote, tipo_venda, products(id, titulo, fornecedor_id)),
  comprador:profiles!orders_comprador_id_fkey(id, nome_fantasia, razao_social),
  fornecedor:profiles!orders_fornecedor_id_fkey(id, nome_fantasia, razao_social)
`;

export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const orderIdParam = searchParams.get('orderId') || searchParams.get('id');

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

    const orders = (data || []).map((r) => mapDbOrderToEscrowOrder(r as Record<string, unknown>));
    return NextResponse.json({
      orders,
      summary: generateFinancialSummary(orders),
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
      orderIdToConfirm,
    } = body;

    const dbClient = isSupabaseAdminConfigured ? createAdminSupabaseClient() : ctx.supabase;

    if (orderIdToConfirm) {
      return NextResponse.json(
        { error: 'O pagamento só pode ser confirmado por um webhook autenticado do provedor.' },
        { status: 409 }
      );
    }

    // Caso 2: Criação de nova ordem com preço autoritativo derivado no servidor
    if (!loteId) {
      return NextResponse.json(
        { error: 'Parâmetro obrigatório: loteId.' },
        { status: 400 }
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

    if (
      (auctionRow.status === 'homologado' || auctionRow.status === 'cancelado') &&
      sourceType !== 'proposal'
    ) {
      return NextResponse.json(
        { error: 'Este lote já foi arrematado e homologado em custódia Escrow.' },
        { status: 409 }
      );
    }

    const product = auctionRow.products as Record<string, unknown>;
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
      // buy_now / venda direta
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

    // Buscar regra de comissão vigente no banco
    const { data: ruleRow, error: ruleError } = await dbClient
      .from('commission_rules')
      .select('percentual_padrao')
      .eq('slug', modalidadeSlug)
      .eq('ativo', true)
      .maybeSingle();

    if (ruleError) {
      console.error('Falha ao carregar regra de comissão:', ruleError);
      return NextResponse.json({ error: 'Não foi possível carregar a regra de comissão.' }, { status: 500 });
    }
    if (!ruleRow) {
      return NextResponse.json(
        { error: 'Não há regra ativa de comissão para esta modalidade.' },
        { status: 409 }
      );
    }
    const commissionRate = Number(ruleRow.percentual_padrao);
    const split = calculateSplit(authoritativeAmount, commissionRate);

    const suffix = Date.now().toString().slice(-6);
    const codigoPedido = `PED-${new Date().getFullYear()}-${suffix}`;
    const txid = `VO${Date.now()}${suffix}`.slice(0, 25);
    const termoArremateHash = buildSha256Hash(
      `${codigoPedido}|${loteId}|${ctx.user.id}|${supplierId}|${split.valorBrutoTotal.toFixed(2)}`
    );

    const pixKey = process.env.PIX_ESCROW_KEY?.trim();
    if (!pixKey || !process.env.PAYMENT_WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: 'A integração PIX e a chave de webhook do provedor não estão configuradas.' },
        { status: 503 }
      );
    }
    const pixCopiaCola = generatePixEmvPayload({
      amount: split.valorBrutoTotal,
      txid,
      description: `${codigoPedido} ${auctionRow.codigo_lote}`,
      pixKey,
    });

    const initialPaymentStatus = 'aguardando_pagamento';

    const { data: insertedOrder, error: ordErr } = await dbClient
      .from('orders')
      .insert({
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
        comprovante_pix_spi: null,
      })
      .select(ORDER_SELECT)
      .single();

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
      e2e_id: null,
      status: 'pendente',
      paid_at: null,
    });

    await dbClient.from('notifications').insert([
      {
        user_id: supplierId,
        titulo: `Pedido Escrow Gerado • ${codigoPedido}`,
        mensagem: `Pedido ${codigoPedido} criado e aguardando confirmação de pagamento pelo provedor.`,
        canal: 'in_app',
      },
      {
        user_id: ctx.user.id,
        titulo: `Pagamento pendente • ${codigoPedido}`,
        mensagem: `O pedido só será confirmado após a notificação autenticada do provedor de pagamentos.`,
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
        message: 'Pedido criado e aguardando confirmação do pagamento pelo provedor.',
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

    const isBuyer = String(currentRow.comprador_id) === ctx.user.id;
    const isAdmin = ctx.profile.role === 'admin';

    if (action === 'release_escrow') {
      return NextResponse.json(
        { error: 'A liquidação financeira deve ser confirmada pelo webhook autenticado do provedor.' },
        { status: 409 }
      );
    }

    if (action === 'confirm_delivery') {
      if (!isBuyer && !isAdmin) {
        return NextResponse.json(
          { error: 'Apenas o comprador titular ou administrador pode confirmar o recebimento.' },
          { status: 403 }
        );
      }
      if (currentRow.status_pagamento !== 'em_custodia_escrow') {
        return NextResponse.json(
          { error: 'A entrega só pode ser confirmada para um pedido com pagamento registrado pelo provedor.' },
          { status: 409 }
        );
      }

      const { data: updatedRow, error: updErr } = await dbClient
        .from('orders')
        .update({
          status_logistica: 'entregue',
          motivo_disputa: null,
        })
        .eq('id', currentRow.id)
        .select(ORDER_SELECT)
        .single();

      if (updErr || !updatedRow) {
        return NextResponse.json({ error: updErr?.message || 'Erro ao liquidar pedido.' }, { status: 500 });
      }

      await dbClient
        .from('dock_appointments')
        .update({ status: 'liberado' })
        .eq('order_id', currentRow.id);

      await dbClient
        .from('notifications')
        .insert({
          user_id: currentRow.fornecedor_id,
          titulo: `Entrega confirmada • ${currentRow.codigo_pedido}`,
          mensagem: 'A entrega foi registrada no sistema. Esta ação não inicia transferência bancária.',
          canal: 'in_app',
        });

      await dbClient.from('audit_worm_logs').insert({
        tipo_evento: 'escrow_confirm_delivery',
        protocolo: String(currentRow.codigo_pedido),
        payload_json: { orderId: currentRow.id, actorId: ctx.user.id },
        merkle_root_hash: buildAuditHash(String(currentRow.codigo_pedido), 'confirm_delivery', {
          actorId: ctx.user.id,
        }),
        responsavel_id: ctx.user.id,
      });

      return NextResponse.json({
        message: 'Entrega registrada. A confirmação não inicia repasse bancário.',
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

      await dbClient.from('notifications').insert({
        user_id: currentRow.comprador_id,
        titulo: `Disputa aberta • ${currentRow.codigo_pedido}`,
        mensagem: `A disputa foi registrada: ${motivo}`,
        canal: 'in_app',
      });

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
        message: 'Disputa registrada; a ação não movimenta fundos.',
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
      return NextResponse.json(
        { error: 'O estorno deve ser confirmado pelo webhook autenticado do provedor.' },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: 'Ação desconhecida' }, { status: 400 });
  } catch (err) {
    console.error('Erro ao atualizar pedido escrow:', err);
    return NextResponse.json({ error: 'Erro interno ao atualizar pedido' }, { status: 500 });
  }
}
