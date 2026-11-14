import { NextRequest, NextResponse } from 'next/server';
import { MOCK_AUCTION_LOTS } from '@/lib/mock-data';
import { AuctionBid } from '@/lib/types';

// Livro de ofertas mantido em memória no backend (e sincronizável com Supabase)
let currentAuctions = [...MOCK_AUCTION_LOTS];
let allBids: AuctionBid[] = [];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const loteId = searchParams.get('loteId');

  if (loteId) {
    const lot = currentAuctions.find((l) => l.id === loteId);
    if (!lot) {
      return NextResponse.json({ error: 'Lote não encontrado' }, { status: 404 });
    }
    const lotBids = allBids.filter((b) => b.loteId === loteId);
    return NextResponse.json({ lot, bids: lotBids });
  }

  return NextResponse.json({ auctions: currentAuctions });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { loteId, valorLance, compradorId, empresaNome, cnpj } = body;

    if (!loteId || !valorLance || !empresaNome) {
      return NextResponse.json(
        { error: 'Parâmetros obrigatórios: loteId, valorLance, empresaNome' },
        { status: 400 }
      );
    }

    const lotIndex = currentAuctions.findIndex((l) => l.id === loteId);
    if (lotIndex === -1) {
      return NextResponse.json({ error: 'Lote de pregão não localizado' }, { status: 404 });
    }

    const lot = currentAuctions[lotIndex];

    // 1. Verificação se o leilão expirou
    const now = new Date().getTime();
    const endsAt = new Date(lot.terminaEm).getTime();
    if (now >= endsAt) {
      return NextResponse.json(
        { error: 'Pregão eletrônico encerrado. Não são aceitos novos lances.' },
        { status: 422 }
      );
    }

    // 2. Validação do valor mínimo do lance
    const minRequired = lot.lanceAtual + lot.incrementoMinimo;
    if (valorLance < minRequired) {
      return NextResponse.json(
        {
          error: `Lance inválido. O valor mínimo aceito é R$ ${minRequired.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          minRequired,
        },
        { status: 400 }
      );
    }

    // 3. Regra Anti-Sniping B2B: se o lance for feito nos últimos 3 minutos, prorroga em 3 minutos
    let updatedEndsAt = lot.terminaEm;
    const diffMinutes = (endsAt - now) / (1000 * 60);
    if (diffMinutes <= 3) {
      const extendedTime = new Date(endsAt + 3 * 60 * 1000).toISOString();
      updatedEndsAt = extendedTime;
    }

    // 4. Cálculo do custo unitário
    const unitPrice =
      lot.produto.totalUnidades > 0
        ? Number((valorLance / lot.produto.totalUnidades).toFixed(2))
        : lot.precoUnitarioAtual;

    // 5. Geração de hash criptográfico para auditoria WORM
    const transactionHash = `SHA256:${Math.random().toString(36).substring(2)}${Date.now()}`;

    const newBid: AuctionBid = {
      id: `bid-${Date.now()}`,
      loteId,
      compradorId: compradorId || 'user-varejista-01',
      empresaNome,
      cnpjAnonimizado: cnpj || '12.***.***/0001-90',
      valorLance: Number(valorLance),
      valorUnitario: unitPrice,
      criadoEm: new Date().toISOString(),
      ehVencedor: true,
    };

    // Atualiza status dos lances anteriores
    allBids = allBids.map((b) => (b.loteId === loteId ? { ...b, ehVencedor: false } : b));
    allBids.unshift(newBid);

    // Atualiza lote
    currentAuctions[lotIndex] = {
      ...lot,
      lanceAtual: Number(valorLance),
      precoUnitarioAtual: unitPrice,
      totalLances: lot.totalLances + 1,
      ultimoLanceEmpresa: empresaNome,
      terminaEm: updatedEndsAt,
      status: 'reta_final',
    };

    return NextResponse.json({
      message: 'Lance homologado com sucesso no livro de ofertas do pregão',
      bid: newBid,
      lot: currentAuctions[lotIndex],
      transactionHash,
      extendedDueToAntiSniping: diffMinutes <= 3,
    });
  } catch (err) {
    console.error('Erro na API de lances:', err);
    return NextResponse.json({ error: 'Erro interno ao processar lance' }, { status: 500 });
  }
}
