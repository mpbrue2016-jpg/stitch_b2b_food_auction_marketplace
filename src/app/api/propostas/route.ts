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
      const idx = marketplaceStore.proposals.findIndex((p) => p.id === proposalId);
      if (idx === -1) {
        return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 });
      }
      marketplaceStore.proposals[idx] = {
        ...marketplaceStore.proposals[idx],
        status: 'contraproposta',
        contrapropostaPrecoUnitario: Number(counterPrice),
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
      marketplaceStore.proposals[idx] = {
        ...marketplaceStore.proposals[idx],
        status: 'aceita',
      };
      return NextResponse.json({
        message: 'Proposta aceita! O lote foi reservado para checkout escrow.',
        proposal: marketplaceStore.proposals[idx],
      });
    }

    // Ação 3: Criar nova proposta
    if (newProposal) {
      const created: NegotiationProposal = {
        id: `prop-${Date.now()}`,
        loteId: newProposal.loteId,
        tituloProduto: newProposal.tituloProduto,
        compradorId: newProposal.compradorId || 'user-varejista-01',
        compradorNome: newProposal.compradorNome || 'Supermercado Central Ltda',
        fornecedorId: newProposal.fornecedorId || 'user-ind-01',
        fornecedorNome: newProposal.fornecedorNome || 'Indústria Fabricante',
        quantidadeCaixas: Number(newProposal.quantidadeCaixas),
        precoUnitarioOfertado: Number(newProposal.precoUnitarioOfertado),
        valorTotalProposta:
          Number(newProposal.quantidadeCaixas) *
          Number(newProposal.precoUnitarioOfertado) *
          (newProposal.unidadesPorCaixa || 10),
        status: 'pendente',
        mensagem: newProposal.mensagem || 'Proposta de compra com retirada FOB agendada.',
        criadaEm: new Date().toISOString(),
      };
      marketplaceStore.proposals.unshift(created);
      return NextResponse.json({
        message: 'Proposta comercial enviada à indústria',
        proposal: created,
      });
    }

    return NextResponse.json({ error: 'Ação não reconhecida' }, { status: 400 });
  } catch (err) {
    console.error('Erro na API de propostas:', err);
    return NextResponse.json({ error: 'Erro interno ao processar proposta' }, { status: 500 });
  }
}
