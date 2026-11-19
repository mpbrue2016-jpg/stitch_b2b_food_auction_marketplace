import { NextRequest, NextResponse } from 'next/server';
import {
  createServerSupabaseClient,
  getAuthenticatedUserAndProfile,
  isSupabaseServerConfigured,
} from '@/lib/supabase/server';
import { createAdminSupabaseClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { mapDbAuctionToAuctionLot, mapDbBidToAuctionBid } from '@/lib/supabase/mappers';
import { buildSha256Hash, extractClientIp } from '@/lib/security';
import { DEMO_SUPPLIER_ID, getDemoBidsByLot, getDemoLots } from '@/lib/demo-data';

function isDemoAuctionRow(row: Record<string, unknown>): boolean {
  if (typeof row.is_demo === 'boolean') return row.is_demo;
  const prod = (row.products || {}) as Record<string, unknown>;
  if (typeof prod.is_demo === 'boolean') return prod.is_demo;
  return (
    String(row.id || '').startsWith('a1000000-') ||
    String(prod.fornecedor_id || '') === DEMO_SUPPLIER_ID
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const loteId = searchParams.get('loteId');
  const envParam = searchParams.get('env') || 'modelo';

  if (loteId && envParam !== 'original' && loteId.startsWith('demo-')) {
    const demoLot = getDemoLots().find((l) => l.id === loteId);
    if (!demoLot) {
      return NextResponse.json({ error: 'Lote modelo não encontrado' }, { status: 404 });
    }
    return NextResponse.json({
      lot: demoLot,
      bids: getDemoBidsByLot(loteId),
      env: 'modelo',
    });
  }

  if (!isSupabaseServerConfigured) {
    if (envParam === 'original') {
      return NextResponse.json({ auctions: [], bids: [], env: 'original' });
    }
    if (loteId) {
      const demoLot = getDemoLots().find((l) => l.id === loteId);
      if (!demoLot) return NextResponse.json({ error: 'Lote não encontrado' }, { status: 404 });
      return NextResponse.json({ lot: demoLot, bids: getDemoBidsByLot(loteId), env: 'modelo' });
    }
    return NextResponse.json({ auctions: getDemoLots(), env: 'modelo' });
  }

  try {
    const supabase = createServerSupabaseClient();

    if (loteId) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(loteId);
      const [{ data: auctionRow }, { data: bidsRows }] = isUuid
        ? await Promise.all([
            supabase.from('auctions').select('*, products(*)').eq('id', loteId).maybeSingle(),
            supabase
              .from('bids')
              .select('*, profiles(nome_fantasia, cnpj)')
              .eq('auction_id', loteId)
              .order('valor_lance', { ascending: false })
              .order('created_at', { ascending: false }),
          ])
        : [{ data: null }, { data: [] }];

      if (auctionRow) {
        const isDemo = isDemoAuctionRow(auctionRow as Record<string, unknown>);
        if (envParam === 'original' && isDemo) {
          return NextResponse.json({ error: 'Lote modelo indisponível no ambiente original.' }, { status: 404 });
        }
        const lot = mapDbAuctionToAuctionLot({ ...auctionRow, is_demo: isDemo } as Record<string, unknown>);
        const winnerId = auctionRow.vencedor_id ? String(auctionRow.vencedor_id) : null;
        const bids = (bidsRows || []).map((b) =>
          mapDbBidToAuctionBid({ ...(b as Record<string, unknown>), is_demo: isDemo }, winnerId)
        );
        return NextResponse.json({ lot, bids, env: isDemo ? 'modelo' : 'original' });
      }

      if (envParam !== 'original') {
        const staticLot = getDemoLots().find((l) => l.id === loteId || l.codigoLote === loteId);
        if (staticLot) {
          return NextResponse.json({
            lot: staticLot,
            bids: getDemoBidsByLot(staticLot.id),
            env: 'modelo',
          });
        }
      }
      return NextResponse.json({ error: 'Lote não encontrado' }, { status: 404 });
    }

    const { data: auctionsRows, error } = await supabase
      .from('auctions')
      .select('*, products(*)')
      .order('termina_em', { ascending: true });

    const dbAuctions = !error && Array.isArray(auctionsRows)
      ? auctionsRows.map((r) => {
          const isDemo = isDemoAuctionRow(r as Record<string, unknown>);
          return {
            isDemo,
            lot: mapDbAuctionToAuctionLot({ ...(r as Record<string, unknown>), is_demo: isDemo }),
          };
        })
      : [];

    if (envParam === 'original') {
      return NextResponse.json({
        auctions: dbAuctions.filter((a) => !a.isDemo).map((a) => a.lot),
        env: 'original',
      });
    }

    const dbDemo = dbAuctions.filter((a) => a.isDemo).map((a) => a.lot);
    const dbCodes = new Set(dbDemo.map((l) => l.codigoLote));
    const curatedDemo = getDemoLots().filter((l) => !dbCodes.has(l.codigoLote));

    return NextResponse.json({
      auctions: [...dbDemo, ...curatedDemo],
      env: 'modelo',
    });
  } catch (err) {
    console.error('Erro em GET /api/lances:', err);
    if (envParam === 'original') {
      return NextResponse.json({ error: 'Erro interno ao consultar lances.' }, { status: 500 });
    }
    return NextResponse.json({ auctions: getDemoLots(), env: 'modelo' });
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
        { error: 'Autenticação obrigatória para registrar lances.' },
        { status: 401 }
      );
    }

    if (ctx.profile.role === 'fornecedor') {
      return NextResponse.json(
        { error: 'Apenas compradores homologados podem enviar lances em pregões.' },
        { status: 403 }
      );
    }

    if (ctx.profile.statusAprovacao !== 'aprovado') {
      return NextResponse.json(
        {
          error:
            'Seu cadastro ainda está em validação KYC. Aguarde homologação para enviar lances reais.',
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { loteId, valorLance } = body;
    const parsedBid = Number(valorLance);

    if (!loteId || !Number.isFinite(parsedBid) || parsedBid <= 0) {
      return NextResponse.json(
        { error: 'Parâmetros obrigatórios: loteId e valorLance positivo.' },
        { status: 400 }
      );
    }

    // Bloqueia terminantemente lances reais em lotes do Ambiente Modelo
    if (String(loteId).startsWith('demo-') || String(loteId).startsWith('a1000000-')) {
      return NextResponse.json(
        {
          error:
            'Ambiente Modelo é apenas demonstrativo. Lances reais não são permitidos em lotes modelo.',
        },
        { status: 403 }
      );
    }

    const dbClient = isSupabaseAdminConfigured ? createAdminSupabaseClient() : ctx.supabase;

    const { data: auctionRow, error: fetchErr } = await dbClient
      .from('auctions')
      .select('*, products(*)')
      .eq('id', loteId)
      .maybeSingle();

    if (fetchErr || !auctionRow) {
      return NextResponse.json({ error: 'Lote de pregão não localizado.' }, { status: 404 });
    }

    if (isDemoAuctionRow(auctionRow as Record<string, unknown>)) {
      return NextResponse.json(
        {
          error:
            'Ambiente Modelo é apenas demonstrativo. Lances reais não são permitidos em lotes modelo.',
        },
        { status: 403 }
      );
    }

    const product = (auctionRow.products || {}) as Record<string, unknown>;
    if (String(product.fornecedor_id) === ctx.user.id) {
      return NextResponse.json(
        { error: 'O fornecedor anunciante não pode dar lance no próprio lote.' },
        { status: 403 }
      );
    }

    const now = Date.now();
    const endsAt = new Date(String(auctionRow.termina_em)).getTime();
    if (
      auctionRow.status === 'encerrado' ||
      auctionRow.status === 'homologado' ||
      auctionRow.status === 'cancelado' ||
      now >= endsAt
    ) {
      return NextResponse.json(
        { error: 'Pregão eletrônico encerrado. Não são aceitos novos lances.' },
        { status: 422 }
      );
    }

    if (parsedBid > ctx.profile.limiteCreditoEscrow) {
      return NextResponse.json(
        {
          error: `Lance excede seu limite de crédito Escrow aprovado (R$ ${ctx.profile.limiteCreditoEscrow.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).`,
        },
        { status: 403 }
      );
    }

    const currentBid = Number(auctionRow.lance_atual ?? auctionRow.lance_inicial ?? 0);
    const increment = Number(auctionRow.incremento_minimo ?? 500);
    const totalLances = Number(auctionRow.total_lances ?? 0);
    const minRequired =
      totalLances === 0
        ? Math.max(Number(auctionRow.lance_inicial ?? 0), currentBid)
        : currentBid + increment;

    if (parsedBid < minRequired) {
      return NextResponse.json(
        {
          error: `Lance inválido. O valor mínimo aceito é R$ ${minRequired.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          minRequired,
        },
        { status: 400 }
      );
    }

    const diffMinutes = (endsAt - now) / (1000 * 60);
    const extendedDueToAntiSniping = diffMinutes <= 3;
    const updatedEndsAt = extendedDueToAntiSniping
      ? new Date(endsAt + 3 * 60 * 1000).toISOString()
      : String(auctionRow.termina_em);

    const totalUnidades = Math.max(1, Number(product.total_unidades ?? 1));
    const unitPrice = Number((parsedBid / totalUnidades).toFixed(2));
    const clientIp = extractClientIp(req);
    const transactionHash = buildSha256Hash(
      `${loteId}|${ctx.user.id}|${parsedBid.toFixed(2)}|${new Date().toISOString()}`
    );

    const previousWinnerId = auctionRow.vencedor_id ? String(auctionRow.vencedor_id) : null;

    const bidPayload: Record<string, unknown> = {
      auction_id: loteId,
      comprador_id: ctx.user.id,
      valor_lance: parsedBid,
      valor_unitario: unitPrice,
      ip_origem: clientIp,
      hash_transacao_worm: transactionHash,
      is_demo: false,
    };

    let { data: insertedBid, error: bidErr } = await dbClient
      .from('bids')
      .insert(bidPayload)
      .select('*, profiles(nome_fantasia, cnpj)')
      .single();

    if (bidErr && bidErr.message?.includes('is_demo')) {
      delete bidPayload.is_demo;
      const retry = await dbClient
        .from('bids')
        .insert(bidPayload)
        .select('*, profiles(nome_fantasia, cnpj)')
        .single();
      insertedBid = retry.data;
      bidErr = retry.error;
    }

    if (bidErr || !insertedBid) {
      return NextResponse.json(
        { error: bidErr?.message || 'Erro ao registrar lance no banco de dados.' },
        { status: 500 }
      );
    }

    const nextStatus = extendedDueToAntiSniping ? 'reta_final' : auctionRow.status;

    const { data: updatedAuction, error: updErr } = await dbClient
      .from('auctions')
      .update({
        lance_atual: parsedBid,
        total_lances: totalLances + 1,
        ultimo_lance_empresa: ctx.profile.nomeFantasia,
        vencedor_id: ctx.user.id,
        termina_em: updatedEndsAt,
        status: nextStatus,
      })
      .eq('id', loteId)
      .select('*, products(*)')
      .single();

    if (updErr || !updatedAuction) {
      return NextResponse.json(
        { error: updErr?.message || 'Erro ao atualizar lote do pregão.' },
        { status: 500 }
      );
    }

    if (previousWinnerId && previousWinnerId !== ctx.user.id) {
      await dbClient.from('notifications').insert({
        user_id: previousWinnerId,
        titulo: `Seu lance no lote ${auctionRow.codigo_lote} foi superado`,
        mensagem: `Novo lance líder de R$ ${parsedBid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} registrado no lote ${auctionRow.codigo_lote}.`,
        canal: 'in_app',
      });
    }

    await dbClient.from('audit_worm_logs').insert({
      tipo_evento: 'lance_homologado',
      protocolo: `LANCE-${auctionRow.codigo_lote}`,
      payload_json: {
        auctionId: loteId,
        bidId: insertedBid.id,
        compradorId: ctx.user.id,
        valorLance: parsedBid,
        antiSniping: extendedDueToAntiSniping,
      },
      merkle_root_hash: transactionHash,
      responsavel_id: ctx.user.id,
    });

    return NextResponse.json({
      message: extendedDueToAntiSniping
        ? 'Lance homologado! Proteção Anti-Sniping prorrogou o pregão em +3 min.'
        : 'Lance homologado com sucesso no livro de ofertas do pregão',
      bid: mapDbBidToAuctionBid(insertedBid as Record<string, unknown>, ctx.user.id),
      lot: mapDbAuctionToAuctionLot(updatedAuction as Record<string, unknown>),
      transactionHash: `SHA256:${transactionHash}`,
      extendedDueToAntiSniping,
    });
  } catch (err) {
    console.error('Erro na API de lances:', err);
    return NextResponse.json({ error: 'Erro interno ao processar lance' }, { status: 500 });
  }
}
