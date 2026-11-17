import { NextRequest, NextResponse } from 'next/server';
import { marketplaceStore } from '@/lib/marketplace-store';
import { AuctionLot, ShelfLifeStatus } from '@/lib/types';

const CATEGORY_IMAGE_MAP: Record<string, string> = {
  'cat-1': '/images/lotes/lote-418-cafe.webp',
  'cat-2': '/images/lotes/lote-8501-leite.webp',
  'cat-3': '/images/lotes/lote-guarana-2l.webp',
  'cat-4': '/images/lotes/lote-8492-oleo.webp',
  'cat-5': '/images/lotes/lote-bombons-250g.webp',
  'cat-6': '/images/lotes/lote-higiene-limpeza.jpg',
  'cat-7': '/images/lotes/lote-cerealista-feijao.jpg',
  'cat-8': '/images/lotes/lote-hortifruti-caixas.jpg',
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

function isValidLotImageUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/images/') && !trimmed.includes('..')) {
    return /^\/images\/[a-zA-Z0-9/_.-]+$/.test(trimmed);
  }
  if (/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(trimmed)) {
    return trimmed.length <= 500_000;
  }
  return false;
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
      imagemUrl,
    } = body;

    if (!titulo || !marca || !fabricante || !gtinEan || lanceInicial === undefined || lanceInicial === null) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: título, marca, fabricante, GTIN/EAN-13 e lance inicial.' },
        { status: 400 }
      );
    }

    const baseBid = Number(lanceInicial);
    if (!Number.isFinite(baseBid) || baseBid < 100) {
      return NextResponse.json(
        { error: 'O lance inicial deve ser um valor válido de no mínimo R$ 100,00.' },
        { status: 400 }
      );
    }

    const rawIncrement = incrementoMinimo !== undefined ? Number(incrementoMinimo) : 100;
    if (!Number.isFinite(rawIncrement) || rawIncrement < 50) {
      return NextResponse.json(
        { error: 'O incremento mínimo deve ser de no mínimo R$ 50,00.' },
        { status: 400 }
      );
    }

    const unitsPerBox = Number(unidadesPorEmbalagem ?? 1);
    const boxes = Number(totalCaixas ?? 1);
    const paletesCount = Number(paletes ?? 1);
    if (
      !Number.isFinite(unitsPerBox) ||
      unitsPerBox < 1 ||
      !Number.isFinite(boxes) ||
      boxes < 1 ||
      !Number.isFinite(paletesCount) ||
      paletesCount < 1
    ) {
      return NextResponse.json(
        { error: 'Quantidade por caixa, total de caixas e paletes devem ser maiores ou iguais a 1.' },
        { status: 400 }
      );
    }

    let parsedBuyNow: number | undefined = undefined;
    if (
      precoArremateImediato !== undefined &&
      precoArremateImediato !== null &&
      precoArremateImediato !== '' &&
      Number(precoArremateImediato) > 0
    ) {
      const buyNowVal = Number(precoArremateImediato);
      if (!Number.isFinite(buyNowVal) || buyNowVal <= baseBid) {
        return NextResponse.json(
          { error: 'O preço de arremate imediato deve ser superior ao lance inicial.' },
          { status: 400 }
        );
      }
      parsedBuyNow = buyNowVal;
    }

    const validadeDate = dataValidade ? new Date(dataValidade) : new Date(Date.now() + 90 * 86400000);
    if (Number.isNaN(validadeDate.getTime())) {
      return NextResponse.json(
        { error: 'Data limite de validade inválida.' },
        { status: 400 }
      );
    }

    const totalUnidades = Math.round(unitsPerBox) * Math.round(boxes);
    const unitPrice = Number((baseBid / totalUnidades).toFixed(2));
    const refMarketPrice = Number((baseBid * 1.65).toFixed(2));
    const estimatedMargin = Math.max(
      1,
      Math.round(((refMarketPrice - baseBid) / refMarketPrice) * 100)
    );

    const diasRestantes = Math.max(
      5,
      Math.ceil((validadeDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    );
    const statusShelfLife = computeShelfLifeStatus(diasRestantes);

    const nextNum = 8600 + marketplaceStore.auctions.length + 1;
    const id = `lote-${nextNum}`;
    const resolvedImage = isValidLotImageUrl(imagemUrl)
      ? imagemUrl.trim()
      : CATEGORY_IMAGE_MAP[categoriaId] || '/images/lotes/lote-arroz-5kg.webp';

    const newLot: AuctionLot = {
      id,
      codigoLote: `LOTE #${nextNum}`,
      tipoVenda: tipoVenda || 'leilao',
      lanceInicial: baseBid,
      lanceAtual: baseBid,
      incrementoMinimo: rawIncrement,
      precoArremateImediato: parsedBuyNow,
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
          `Lote fechado disponibilizado por ${fabricante}. Carga conferida (${Math.round(boxes)} caixas / ${Math.round(paletesCount)} palete(s)) com rastreabilidade GS1 e procedência homologada.`,
        marca: String(marca).trim(),
        fabricante: String(fabricante).trim(),
        origem: String(origem || 'CD Jundiaí - SP').trim(),
        categoriaId: categoriaId || 'cat-1',
        gtinEan: String(gtinEan).trim(),
        dun14: String(dun14 || `1${String(gtinEan).trim()}`).trim(),
        imagemUrl: resolvedImage,
        embalagem: `Caixa c/ ${Math.round(unitsPerBox)} un`,
        unidadesPorEmbalagem: Math.round(unitsPerBox),
        totalCaixas: Math.round(boxes),
        totalUnidades,
        paletes: Math.round(paletesCount),
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
