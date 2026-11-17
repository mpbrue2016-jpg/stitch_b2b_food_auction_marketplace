import { NextRequest, NextResponse } from 'next/server';
import { marketplaceStore } from '@/lib/marketplace-store';
import { NegotiationProposal } from '@/lib/types';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const loteId = searchParams.get('loteId');

  if (loteId) {
    return NextResponse.json({
      proposals: marketplaceStore.proposals.filter((p) => p.loteId === loteId),
    });
  }

  return NextResponse.json({ proposals: marketplaceStore.proposals });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, proposalId, counterPrice, newProposal } = body;

    // Ação 1: Enviar contraproposta
    if (action === 'counter') {
      const parsedCounter = Number(counterPrice);
      if (!proposalId || !Number.isFinite(parsedCounter) || parsedCounter <= 0) {
        return NextResponse.json(
          { error: 'Informe proposalId e um valor de contraproposta positivo.' },
          { status: 400 }
        );
      }
      const idx = marketplaceStore.proposals.findIndex((p) => p.id === proposalId);
      if (idx === -1) {
        return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 });
      }
      if (
        marketplaceStore.proposals[idx].status === 'aceita' ||
        marketplaceStore.proposals[idx].status === 'recusada'
      ) {
        return NextResponse.json(
          { error: 'Proposta já finalizada não pode receber contraproposta.' },
          { status: 409 }
        );
      }
      marketplaceStore.proposals[idx] = {
        ...marketplaceStore.proposals[idx],
        status: 'contraproposta',
        contrapropostaPrecoUnitario: Number(parsedCounter.toFixed(2)),
      };
      return NextResponse.json({
        message: 'Contraproposta enviada com sucesso',
        proposal: marketplaceStore.proposals[idx],
      });
    }

    // Ação 2: Aceitar proposta
    if (action === 'accept') {
      const idx = marketplaceStore.proposals.findIndex((p) => p.id === proposalId);
      if (idx === -1) {
        return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 });
      }
      if (marketplaceStore.proposals[idx].status === 'recusada') {
        return NextResponse.json(
          { error: 'Não é possível aceitar uma proposta já recusada.' },
          { status: 409 }
        );
      }
      marketplaceStore.proposals[idx] = {
        ...marketplaceStore.proposals[idx],
        status: 'aceita',
      };
      return NextResponse.json({
        message: 'Proposta aceita! O lote foi reservado para checkout escrow.',
        proposal: marketplaceStore.proposals[idx],
      });
    }

    // Ação 2b: Recusar proposta
    if (action === 'reject') {
      const idx = marketplaceStore.proposals.findIndex((p) => p.id === proposalId);
      if (idx === -1) {
        return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 });
      }
      if (marketplaceStore.proposals[idx].status === 'aceita') {
        return NextResponse.json(
          { error: 'Não é possível recusar uma proposta já aceita.' },
          { status: 409 }
        );
      }
      marketplaceStore.proposals[idx] = {
        ...marketplaceStore.proposals[idx],
        status: 'recusada',
      };
      return NextResponse.json({
        message: 'Proposta comercial recusada na mesa de negociação.',
        proposal: marketplaceStore.proposals[idx],
      });
    }

    // Ação 3: Criar nova proposta
    if (newProposal) {
      const boxes = Number(newProposal.quantidadeCaixas);
      const unitPrice = Number(newProposal.precoUnitarioOfertado);
      if (
        !newProposal.loteId ||
        !newProposal.tituloProduto ||
        !Number.isFinite(boxes) ||
        boxes <= 0 ||
        !Number.isFinite(unitPrice) ||
        unitPrice <= 0
      ) {
        return NextResponse.json(
          { error: 'Parâmetros inválidos na proposta: informe lote, produto, caixas e preço unitário positivos.' },
          { status: 400 }
        );
      }
      const created: NegotiationProposal = {
        id: `prop-${Date.now()}`,
        loteId: newProposal.loteId,
        tituloProduto: newProposal.tituloProduto,
        compradorId: newProposal.compradorId || 'user-varejista-01',
        compradorNome: newProposal.compradorNome || 'Supermercado Central Ltda',
        fornecedorId: newProposal.fornecedorId || 'user-ind-01',
        fornecedorNome: newProposal.fornecedorNome || 'Indústria Fabricante',
        quantidadeCaixas: boxes,
        precoUnitarioOfertado: Number(unitPrice.toFixed(2)),
        valorTotalProposta: Number(
          (boxes * unitPrice * (Number(newProposal.unidadesPorCaixa) || 10)).toFixed(2)
        ),
        status: 'pendente',
        mensagem: newProposal.mensagem || 'Proposta de compra com retirada FOB agendada.',
        criadaEm: new Date().toISOString(),
      };
      marketplaceStore.proposals.unshift(created);
      return NextResponse.json(
        {
          message: 'Proposta comercial enviada à indústria',
          proposal: created,
        },
        { status: 201 }
      );
    }

    return NextResponse.json({ error: 'Ação não reconhecida' }, { status: 400 });
  } catch (err) {
    console.error('Erro na API de propostas:', err);
    return NextResponse.json({ error: 'Erro interno ao processar proposta' }, { status: 500 });
  }
}
