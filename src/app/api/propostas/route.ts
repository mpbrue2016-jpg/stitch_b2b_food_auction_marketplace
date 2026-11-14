import { NextRequest, NextResponse } from 'next/server';
import { MOCK_PROPOSALS } from '@/lib/mock-data';
import { NegotiationProposal } from '@/lib/types';

let currentProposals: NegotiationProposal[] = [...MOCK_PROPOSALS];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const loteId = searchParams.get('loteId');

  if (loteId) {
    return NextResponse.json({
      proposals: currentProposals.filter((p) => p.loteId === loteId),
    });
  }

  return NextResponse.json({ proposals: currentProposals });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, proposalId, counterPrice, newProposal } = body;

    // Ação 1: Enviar contraproposta
    if (action === 'counter') {
      const idx = currentProposals.findIndex((p) => p.id === proposalId);
      if (idx === -1) {
        return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 });
      }
      currentProposals[idx] = {
        ...currentProposals[idx],
        status: 'contraproposta',
        contrapropostaPrecoUnitario: Number(counterPrice),
      };
      return NextResponse.json({
        message: 'Contraproposta enviada com sucesso',
        proposal: currentProposals[idx],
      });
    }

    // Ação 2: Aceitar proposta
    if (action === 'accept') {
      const idx = currentProposals.findIndex((p) => p.id === proposalId);
      if (idx === -1) {
        return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 });
      }
      currentProposals[idx] = {
        ...currentProposals[idx],
        status: 'aceita',
      };
      return NextResponse.json({
        message: 'Proposta aceita! O lote foi reservado para checkout escrow.',
        proposal: currentProposals[idx],
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
      currentProposals.unshift(created);
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
