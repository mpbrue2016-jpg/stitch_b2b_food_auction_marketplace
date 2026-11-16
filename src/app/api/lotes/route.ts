import { NextRequest, NextResponse } from 'next/server';
import { marketplaceStore } from '@/lib/marketplace-store';
import { AuctionLot, ShelfLifeStatus } from '@/lib/types';

const CATEGORY_IMAGE_MAP: Record<string, string> = {
  'cat-1': '/images/lotes/lote-418-cafe.webp',
  'cat-2': '/images/lotes/lote-8501-leite.webp',
  'cat-3': '/images/lotes/lote-guarana-2l.webp',
  'cat-4': '/images/lotes/lote-8492-oleo.webp',
  'cat-5': '/images/lotes/lote-bombons-250g.webp',
  'cat-6': '/images/lotes/lote-detergente-500ml.webp',
};

function computeShelfLifeStatus(diasRestantes: number): ShelfLifeStatus {
  if (diasRestantes < 30) return 'critica';
  if (diasRestantes <= 60) return 'giro_rapido';
  if (diasRestantes <= 90) return 'atencao';
  return 'longa';
}

export async function GET() {
  return NextResponse.json({ lots: marketplaceStore.auctions });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      titulo,
      descricao,
      marca,
      fabricante,
      categoriaId,
      gtinEan,
      dun14,
      origem,
      unidadesPorEmbalagem,
      totalCaixas,
      paletes,
      dataValidade,
      lanceInicial,
      incrementoMinimo,
      precoArremateImediato,
      tipoVenda,
      tipoFrete,
      laudoSanitarioAnvisa,
    } = body;

    if (!titulo || !marca || !fabricante || !gtinEan || !lanceInicial) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: título, marca, fabricante, GTIN/EAN-13 e lance inicial.' },
        { status: 400 }
      );
    }

    const unitsPerBox = Math.max(1, Number(unidadesPorEmbalagem) || 1);
    const boxes = Math.max(1, Number(totalCaixas) || 1);
    const totalUnidades = unitsPerBox * boxes;
    const baseBid = Math.max(100, Number(lanceInicial));
    const unitPrice = Number((baseBid / totalUnidades).toFixed(2));
    const refMarketPrice = Number((baseBid * 1.65).toFixed(2));
    const estimatedMargin = Math.max(
      1,
      Math.round(((refMarketPrice - baseBid) / refMarketPrice) * 100)
    );

    const validadeDate = dataValidade ? new Date(dataValidade) : new Date(Date.now() + 90 * 86400000);
    const diasRestantes = Math.max(
      5,
      Math.ceil((validadeDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    );
    const statusShelfLife = computeShelfLifeStatus(diasRestantes);

    const nextNum = 8600 + marketplaceStore.auctions.length + 1;
    const id = `lote-${nextNum}`;

    const newLot: AuctionLot = {
      id,
      codigoLote: `LOTE #${nextNum}`,
      tipoVenda: tipoVenda || 'leilao',
      lanceInicial: baseBid,
      lanceAtual: baseBid,
      incrementoMinimo: Math.max(50, Number(incrementoMinimo) || 500),
      precoArremateImediato: precoArremateImediato ? Number(precoArremateImediato) : undefined,
      precoUnitarioAtual: unitPrice,
      margemEstimadaRevenda: estimatedMargin,
      totalLances: 0,
      ultimoLanceEmpresa: 'Aguardando primeiro lance',
      terminaEm: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
      status: 'ativo',
      raioKm: 45,
      tipoFrete: tipoFrete || 'FOB',
      produto: {
        id: `prod-${nextNum}`,
        sku: `SKU-${nextNum}`,
        titulo: String(titulo).trim(),
        descricao:
          String(descricao || '').trim() ||
          `Lote fechado direto da indústria ${fabricante}. Carga paletizada (${paletes || 4} paletes PBR) com rastreabilidade GS1 e laudo sanitário homologado.`,
        marca: String(marca).trim(),
        fabricante: String(fabricante).trim(),
        origem: String(origem || 'CD Jundiaí - SP').trim(),
        categoriaId: categoriaId || 'cat-1',
        gtinEan: String(gtinEan).trim(),
        dun14: String(dun14 || `1${String(gtinEan).trim()}`).trim(),
        imagemUrl: CATEGORY_IMAGE_MAP[categoriaId] || '/images/lotes/lote-arroz-5kg.webp',
        embalagem: `Caixa c/ ${unitsPerBox} un`,
        unidadesPorEmbalagem: unitsPerBox,
        totalCaixas: boxes,
        totalUnidades,
        paletes: Math.max(1, Number(paletes) || 1),
        dataValidade: validadeDate.toISOString().split('T')[0],
        diasRestantesValidade: diasRestantes,
        statusShelfLife,
        laudoSanitarioAnvisa: Boolean(laudoSanitarioAnvisa ?? true),
        statusFiscal: 'homologado',
        precoReferenciaMercado: refMarketPrice,
      },
    };

    marketplaceStore.auctions.unshift(newLot);

    return NextResponse.json(
      {
        message: 'Lote cadastrado e pregão ativado no marketplace B2B',
        lot: newLot,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('Erro ao cadastrar novo lote:', err);
    return NextResponse.json({ error: 'Erro interno ao publicar lote' }, { status: 500 });
  }
}
