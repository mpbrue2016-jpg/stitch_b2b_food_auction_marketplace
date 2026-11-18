import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { buildAuditHash, extractClientIp, safeCompareSecrets } from '@/lib/security';

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  if (!isSupabaseAdminConfigured) {
    return NextResponse.json(
      { error: 'Supabase Admin não configurado para processar webhook.' },
      { status: 503 }
    );
  }

  const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET || '';
  if (!webhookSecret) {
    return NextResponse.json(
      { error: 'PAYMENT_WEBHOOK_SECRET não configurado no servidor.' },
      { status: 503 }
    );
  }

  const providedSecret =
    req.headers.get('x-webhook-secret') ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ||
    '';

  if (!providedSecret || !safeCompareSecrets(providedSecret, webhookSecret)) {
    return NextResponse.json({ error: 'Assinatura de webhook inválida.' }, { status: 401 });
  }

  const admin = createAdminSupabaseClient();
  const originIp = extractClientIp(req);

  try {
    const payload = await req.json();
    const txid = String(payload.txid || '').trim();
    const e2eId = String(payload.e2eId || payload.endToEndId || '').trim();
    const event = String(payload.event || 'pix.confirmed').trim();

    if (!txid) {
      return NextResponse.json({ error: 'Parâmetro obrigatório: txid.' }, { status: 400 });
    }

    const { data: txRow } = await admin
      .from('payment_transactions')
      .select('*, orders(*)')
      .eq('txid', txid)
      .maybeSingle();

    if (!txRow) {
      await admin.from('webhooks_logs').insert({
        endpoint: '/api/webhooks/pagamento',
        metodo: 'POST',
        status_code: 404,
        payload_request: payload,
        erro: 'Transação PIX não encontrada',
        tempo_resposta_ms: Date.now() - startedAt,
        origem_ip: originIp,
      });
      return NextResponse.json({ error: 'Transação não localizada.' }, { status: 404 });
    }

    // Idempotência: se já liquidada/paga para o mesmo evento
    if (event === 'pix.confirmed' && txRow.status === 'pago') {
      return NextResponse.json({
        message: 'Evento já processado anteriormente (idempotente).',
        orderId: txRow.order_id,
      });
    }

    const order = (txRow.orders || {}) as Record<string, unknown>;
    let nextOrderStatus: string = String(order.status_pagamento || 'aguardando_pagamento');
    let nextTxStatus: string = String(txRow.status || 'pendente');

    if (event === 'pix.confirmed') {
      nextOrderStatus = 'em_custodia_escrow';
      nextTxStatus = 'pago';
    } else if (event === 'pix.refunded') {
      nextOrderStatus = 'estornado';
      nextTxStatus = 'estornado';
    } else if (event === 'escrow.released') {
      nextOrderStatus = 'repasse_liquidado_d0';
      nextTxStatus = 'liquidado_d0';
    }

    await admin
      .from('payment_transactions')
      .update({
        status: nextTxStatus,
        e2e_id: e2eId || txRow.e2e_id,
        paid_at: nextTxStatus === 'pago' ? new Date().toISOString() : txRow.paid_at,
        webhook_payload: payload,
      })
      .eq('id', txRow.id);

    await admin
      .from('orders')
      .update({
        status_pagamento: nextOrderStatus,
        comprovante_pix_spi: e2eId || txRow.txid,
      })
      .eq('id', txRow.order_id);

    if (nextOrderStatus === 'em_custodia_escrow' && order.auction_id) {
      await admin
        .from('auctions')
        .update({ status: 'homologado', vencedor_id: order.comprador_id })
        .eq('id', order.auction_id);
    }

    await admin.from('audit_worm_logs').insert({
      tipo_evento: `webhook_${event}`,
      protocolo: String(order.codigo_pedido || txid),
      payload_json: { txid, e2eId, event, nextOrderStatus },
      merkle_root_hash: buildAuditHash(txid, `webhook_${event}`, payload),
    });

    const responseBody = { ok: true, txid, status: nextOrderStatus };
    await admin.from('webhooks_logs').insert({
      endpoint: '/api/webhooks/pagamento',
      metodo: 'POST',
      status_code: 200,
      payload_request: payload,
      payload_response: responseBody,
      tempo_resposta_ms: Date.now() - startedAt,
      origem_ip: originIp,
    });

    return NextResponse.json(responseBody);
  } catch (err) {
    console.error('Erro em POST /api/webhooks/pagamento:', err);
    return NextResponse.json({ error: 'Erro interno no webhook de pagamento.' }, { status: 500 });
  }
}
