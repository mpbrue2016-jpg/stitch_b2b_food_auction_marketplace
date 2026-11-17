import { NextRequest, NextResponse } from 'next/server';
import { marketplaceStore } from '@/lib/marketplace-store';
import { calculateSplit, generateFinancialSummary } from '@/lib/commission-engine';
import { EscrowOrder } from '@/lib/types';

export async function GET() {
  return NextResponse.json({
    orders: marketplaceStore.orders,
    summary: generateFinancialSummary(marketplaceStore.orders),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { loteId, valorTotalArremate, compradorNome, pixComprovanteCodigo } = body;

    const amount = Number(valorTotalArremate);
    if (!loteId || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'Parâmetros obrigatórios: loteId e valorTotalArremate numérico positivo.' },
        { status: 400 }
      );
    }

    const lot = marketplaceStore.auctions.find((l) => l.id === loteId);
    const modalidade = lot?.tipoVenda || 'leilao';
    const split = calculateSplit(amount, modalidade);

    const orderNum = 9045 + marketplaceStore.orders.length + 1;
    const codigoPedido = `PED-2026-${orderNum}`;
    const termoArremateHash = `SHA256:${Math.random().toString(36).substring(2, 14)}${Date.now().toString(36)}`;

    const newOrder: EscrowOrder = {
      id: `ord-${Date.now()}`,
      codigoPedido,
      loteId,
      tituloLote: lot
        ? `${lot.codigoLote} • ${lot.produto.titulo}`
        : `Lote ${loteId}`,
      compradorId: 'user-varejista-01',
      compradorNome: compradorNome || 'Supermercado Central Ltda',
      fornecedorId: 'user-ind-01',
      fornecedorNome: lot?.produto.fabricante || 'Indústria Fornecedora B2B',
      valorTotalArremate: split.valorBrutoTotal,
      percentualComissao: split.percentualComissao,
      valorComissaoPlataforma: split.valorComissaoPlataforma,
      valorRepasseLiquidoFornecedor: split.valorRepasseLiquidoFornecedor,
      statusPagamento: 'em_custodia_escrow',
      statusLogistica: 'agendamento_doca',
      docaAgendada: 'Aguardando agendamento de Doca FOB no CD',
      criadoEm: new Date().toISOString(),
      termoArremateHash,
      comprovantePix:
        typeof pixComprovanteCodigo === 'string' && pixComprovanteCodigo.trim()
          ? pixComprovanteCodigo.trim().slice(0, 180)
          : undefined,
    };

    marketplaceStore.orders.unshift(newOrder);

    return NextResponse.json(
      {
        message: 'Depósito Escrow homologado e pedido gerado com sucesso',
        order: newOrder,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('Erro ao registrar pedido escrow:', err);
    return NextResponse.json({ error: 'Erro interno ao homologar pedido escrow' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, action } = body;

    if (!orderId || !action) {
      return NextResponse.json(
        { error: 'Parâmetros obrigatórios: orderId e action.' },
        { status: 400 }
      );
    }

    const idx = marketplaceStore.orders.findIndex(
      (o) => o.id === orderId || o.codigoPedido === orderId
    );
    if (idx === -1) {
      return NextResponse.json({ error: 'Pedido escrow não encontrado' }, { status: 404 });
    }

    const current = marketplaceStore.orders[idx];

    if (action === 'confirm_delivery' || action === 'release_escrow') {
      if (current.statusPagamento === 'estornado') {
        return NextResponse.json(
          { error: 'Pedido já estornado não pode ser liquidado.' },
          { status: 400 }
        );
      }

      const updated: EscrowOrder = {
        ...current,
        statusPagamento: 'repasse_liquidado_d0',
        statusLogistica: action === 'confirm_delivery' ? 'entregue' : current.statusLogistica,
        motivoDisputa: undefined,
        termoArremateHash:
          current.termoArremateHash || `SHA256:${current.codigoPedido}-${Date.now().toString(36)}`,
      };
      marketplaceStore.orders[idx] = updated;

      const aptIdx = marketplaceStore.dockAppointments.findIndex(
        (a) => a.pedidoId === current.codigoPedido
      );
      if (aptIdx !== -1 && action === 'confirm_delivery') {
        marketplaceStore.dockAppointments[aptIdx] = {
          ...marketplaceStore.dockAppointments[aptIdx],
          status: 'liberado',
        };
      }

      return NextResponse.json({
        message: 'Custódia Escrow liquidada D+0 com sucesso via SPI Bancário',
        order: updated,
        summary: generateFinancialSummary(marketplaceStore.orders),
      });
    }

    if (action === 'open_dispute') {
      if (current.statusPagamento !== 'em_custodia_escrow') {
        return NextResponse.json(
          { error: 'Apenas pedidos em custódia Escrow ativa podem abrir divergência.' },
          { status: 400 }
        );
      }
      const motivo =
        typeof body.reason === 'string' && body.reason.trim().length >= 5
          ? body.reason.trim().slice(0, 220)
          : 'Divergência de conferência na doca FOB (bloqueio preventivo de custódia)';

      const updated: EscrowOrder = {
        ...current,
        statusPagamento: 'em_disputa',
        motivoDisputa: motivo,
      };
      marketplaceStore.orders[idx] = updated;

      return NextResponse.json({
        message: 'Divergência registrada e saldo Escrow bloqueado para mediação',
        order: updated,
        summary: generateFinancialSummary(marketplaceStore.orders),
      });
    }

    if (action === 'refund_escrow') {
      if (current.statusPagamento === 'estornado') {
        return NextResponse.json(
          { error: 'Este pedido já foi estornado anteriormente.' },
          { status: 409 }
        );
      }
      if (current.statusPagamento === 'repasse_liquidado_d0') {
        return NextResponse.json(
          { error: 'Repasse já liquidado D+0 não pode ser estornado automaticamente.' },
          { status: 400 }
        );
      }
      const updated: EscrowOrder = {
        ...current,
        statusPagamento: 'estornado',
        motivoDisputa:
          typeof body.reason === 'string' && body.reason.trim()
            ? body.reason.trim().slice(0, 220)
            : current.motivoDisputa || 'Custódia estornada ao comprador via moderação Escrow',
      };
      marketplaceStore.orders[idx] = updated;

      const aptIdx = marketplaceStore.dockAppointments.findIndex(
        (a) => a.pedidoId === current.codigoPedido
      );
      if (aptIdx !== -1) {
        marketplaceStore.dockAppointments[aptIdx] = {
          ...marketplaceStore.dockAppointments[aptIdx],
          status: 'liberado',
        };
      }

      return NextResponse.json({
        message: 'Custódia Escrow estornada integralmente ao comprador via PIX SPI',
        order: updated,
        summary: generateFinancialSummary(marketplaceStore.orders),
      });
    }

    return NextResponse.json({ error: 'Ação desconhecida' }, { status: 400 });
  } catch (err) {
    console.error('Erro ao atualizar pedido escrow:', err);
    return NextResponse.json({ error: 'Erro interno ao atualizar pedido' }, { status: 500 });
  }
}
