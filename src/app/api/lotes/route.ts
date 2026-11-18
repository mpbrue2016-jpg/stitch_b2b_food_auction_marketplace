import { NextRequest, NextResponse } from 'next/server';
import {
  createServerSupabaseClient,
  getAuthenticatedUserAndProfile,
  isSupabaseServerConfigured,
} from '@/lib/supabase/server';
import { createAdminSupabaseClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import {
  computeDaysUntilValidity,
  computeShelfLifeStatus,
  mapDbAuctionToAuctionLot,
} from '@/lib/supabase/mappers';
import { buildAuditHash } from '@/lib/security';

const LEGACY_CATEGORY_SLUG_MAP: Record<string, string> = {
  'cat-1': 'alimentos-secos',
  'cat-2': 'laticinios-frios',
  'cat-3': 'bebidas-sucos',
  'cat-4': 'mercearia-basica',
  'cat-5': 'mercearia-doce',
  'cat-6': 'higiene-limpeza',
  'cat-7': 'cerealista',
  'cat-8': 'hortifruti',
};

const CATEGORY_DEFAULT_IMAGE: Record<string, string> = {
  'alimentos-secos': '/images/lotes/lote-418-cafe.webp',
  'laticinios-frios': '/images/lotes/lote-8501-leite.webp',
  'bebidas-sucos': '/images/lotes/lote-guarana-2l.webp',
  'mercearia-basica': '/images/lotes/lote-8492-oleo.webp',
  'mercearia-doce': '/images/lotes/lote-bombons-250g.webp',
  'higiene-limpeza': '/images/lotes/lote-higiene-limpeza.jpg',
  cerealista: '/images/lotes/lote-cerealista-feijao.jpg',
  hortifruti: '/images/lotes/lote-hortifruti-caixas.jpg',
};

function isValidLotImageUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/images/') && !trimmed.includes('..')) {
    return /^\/images\/[a-zA-Z0-9/_.-]+$/.test(trimmed);
  }
  if (trimmed.startsWith('https://')) {
    return true;
  }
  if (/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(trimmed)) {
    return trimmed.length <= 750_000;
  }
  return false;
}

async function resolveCategoryRow(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  rawCategory: unknown
): Promise<{ id: string; slug: string } | null> {
  const value = typeof rawCategory === 'string' ? rawCategory.trim() : '';
  const mappedSlug = LEGACY_CATEGORY_SLUG_MAP[value] || value;

  if (value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    const { data } = await supabase
      .from('categories')
      .select('id, slug')
      .eq('id', value)
      .maybeSingle();
    if (data) return { id: String(data.id), slug: String(data.slug) };
  }

  if (mappedSlug) {
    const { data } = await supabase
      .from('categories')
      .select('id, slug')
      .eq('slug', mappedSlug)
      .maybeSingle();
    if (data) return { id: String(data.id), slug: String(data.slug) };
  }

  const { data: firstCat } = await supabase
    .from('categories')
    .select('id, slug')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  return firstCat ? { id: String(firstCat.id), slug: String(firstCat.slug) } : null;
}

async function persistLotImageToStorage(
  dataUrlOrPath: string,
  userId: string
): Promise<string> {
  if (!dataUrlOrPath.startsWith('data:image/')) {
    return dataUrlOrPath;
  }
  const match = dataUrlOrPath.match(/^data:(image\/(?:webp|png|jpeg|jpg));base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) {
    throw new Error('Formato de imagem inválido.');
  }
  const mimeType = match[1].toLowerCase();
  const ext = mimeType.split('/')[1] === 'jpeg' ? 'jpg' : mimeType.split('/')[1];
  const buffer = Buffer.from(match[2], 'base64');
  const client = isSupabaseAdminConfigured
    ? createAdminSupabaseClient()
    : createServerSupabaseClient();
  const path = `${userId}/lote-${Date.now()}.${ext}`;
  const { error } = await client.storage.from('lot-images').upload(path, buffer, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) {
    throw new Error(`Falha ao salvar foto do lote: ${error.message}`);
  }
  const { data: pub } = client.storage.from('lot-images').getPublicUrl(path);
  return pub.publicUrl;
}

export async function GET(req: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json(
      { error: 'Supabase não configurado no ambiente.', lots: [] },
      { status: 503 }
    );
  }

  try {
    const supabase = createServerSupabaseClient();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const q = searchParams.get('q')?.trim().toLowerCase() || '';
    const categoria = searchParams.get('categoria')?.trim().toLowerCase() || '';
    const filtro = searchParams.get('filtro')?.trim().toLowerCase() || '';
    const fornecedorId = searchParams.get('fornecedorId')?.trim() || '';

    let query = supabase
      .from('auctions')
      .select('*, products(*, categories(id, slug, nome))')
      .order('created_at', { ascending: false });

    if (id) {
      query = query.eq('id', id);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message, lots: [] }, { status: 500 });
    }

    let lots = (data || []).map((row) => {
      const lot = mapDbAuctionToAuctionLot(row as Record<string, unknown>);
      return {
        lot,
        rawProduct: (row.products || {}) as Record<string, unknown>,
        categorySlug: String(
          ((row.products as Record<string, unknown> | undefined)?.categories as Record<string, unknown> | undefined)?.slug || ''
        ).toLowerCase(),
      };
    });

    if (fornecedorId) {
      lots = lots.filter((item) => String(item.rawProduct.fornecedor_id || '') === fornecedorId);
    }

    if (categoria && categoria !== 'todas') {
      lots = lots.filter(
        (item) =>
          item.lot.produto.categoriaId.toLowerCase() === categoria ||
          item.categorySlug === categoria ||
          item.categorySlug === (LEGACY_CATEGORY_SLUG_MAP[categoria] || '')
      );
    }

    if (filtro === 'validade_proxima') {
      lots = lots.filter((item) => item.lot.produto.diasRestantesValidade <= 90);
    } else if (filtro === 'giro_rapido') {
      lots = lots.filter(
        (item) =>
          item.lot.tipoVenda === 'giro_rapido' ||
          item.lot.produto.statusShelfLife === 'giro_rapido' ||
          item.lot.produto.statusShelfLife === 'critica'
      );
    } else if (filtro === 'pequenos_mercados') {
      lots = lots.filter(
        (item) => item.lot.lanceAtual <= 10000 || item.lot.produto.paletes <= 6
      );
    }

    if (q) {
      lots = lots.filter(
        (item) =>
          item.lot.produto.titulo.toLowerCase().includes(q) ||
          item.lot.produto.marca.toLowerCase().includes(q) ||
          item.lot.produto.gtinEan.includes(q) ||
          item.lot.codigoLote.toLowerCase().includes(q) ||
          item.lot.produto.origem.toLowerCase().includes(q)
      );
    }

    const resultLots = lots.map((item) => item.lot);
    if (id) {
      if (resultLots.length === 0) {
        return NextResponse.json({ error: 'Lote não encontrado.' }, { status: 404 });
      }
      return NextResponse.json({ lot: resultLots[0], lots: resultLots });
    }

    return NextResponse.json({ lots: resultLots });
  } catch (err) {
    console.error('Erro ao buscar lotes no Supabase:', err);
    return NextResponse.json(
      { error: 'Erro interno ao consultar lotes.', lots: [] },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: 'Supabase não configurado no ambiente.' }, { status: 503 });
  }

  try {
    const ctx = await getAuthenticatedUserAndProfile();
    if (!ctx?.user || !ctx.profile) {
      return NextResponse.json({ error: 'Autenticação obrigatória para publicar lotes.' }, { status: 401 });
    }
    if (ctx.profile.role !== 'fornecedor' && ctx.profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Apenas fornecedores ou administradores podem publicar lotes de estoque.' },
        { status: 403 }
      );
    }

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

    let parsedBuyNow: number | null = null;
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
      return NextResponse.json({ error: 'Data limite de validade inválida.' }, { status: 400 });
    }

    const dbClient = isSupabaseAdminConfigured ? createAdminSupabaseClient() : ctx.supabase;
    const catRow = await resolveCategoryRow(dbClient, categoriaId);
    if (!catRow) {
      return NextResponse.json(
        { error: 'Nenhuma categoria cadastrada no banco de dados.' },
        { status: 400 }
      );
    }

    const totalUnidades = Math.round(unitsPerBox) * Math.round(boxes);
    const refMarketPrice = Number((baseBid * 1.65).toFixed(2));
    const estimatedMargin = Math.max(
      1,
      Math.round(((refMarketPrice - baseBid) / refMarketPrice) * 100)
    );
    const validadeIso = validadeDate.toISOString().split('T')[0];
    const diasRestantes = computeDaysUntilValidity(validadeIso);
    const statusShelfLife = computeShelfLifeStatus(diasRestantes);

    const rawImg = isValidLotImageUrl(imagemUrl)
      ? imagemUrl.trim()
      : CATEGORY_DEFAULT_IMAGE[catRow.slug] || '/images/lotes/lote-arroz-5kg.webp';
    const resolvedImage = await persistLotImageToStorage(rawImg, ctx.user.id);

    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    const sku = `SKU-${Date.now().toString().slice(-5)}-${randSuffix}`;
    const codigoLote = `LOTE-${Date.now().toString().slice(-4)}${randSuffix.toString().slice(-2)}`;

    const { data: productRow, error: prodErr } = await dbClient
      .from('products')
      .insert({
        fornecedor_id: ctx.user.id,
        categoria_id: catRow.id,
        sku,
        titulo: String(titulo).trim(),
        descricao:
          String(descricao || '').trim() ||
          `Lote fechado disponibilizado por ${fabricante}. Carga conferida (${Math.round(boxes)} caixas / ${Math.round(paletesCount)} palete(s)) com rastreabilidade GS1 e procedência homologada.`,
        marca: String(marca).trim(),
        fabricante: String(fabricante).trim(),
        origem_cd: String(origem || 'CD Jundiaí - SP').trim(),
        gtin_ean: String(gtinEan).trim().slice(0, 14),
        dun14: String(dun14 || `1${String(gtinEan).trim()}`).trim().slice(0, 14),
        imagem_url: resolvedImage,
        embalagem: `Caixa c/ ${Math.round(unitsPerBox)} un`,
        unidades_por_embalagem: Math.round(unitsPerBox),
        total_caixas: Math.round(boxes),
        total_unidades: totalUnidades,
        paletes_pbr: Math.round(paletesCount),
        data_validade: validadeIso,
        status_shelf_life: statusShelfLife,
        laudo_sanitario_anvisa: Boolean(laudoSanitarioAnvisa ?? true),
        status_fiscal: 'homologado',
        preco_referencia_mercado: refMarketPrice,
      })
      .select('*')
      .single();

    if (prodErr || !productRow) {
      return NextResponse.json(
        { error: prodErr?.message || 'Erro ao gravar produto do lote.' },
        { status: 500 }
      );
    }

    const { data: auctionRow, error: aucErr } = await dbClient
      .from('auctions')
      .insert({
        codigo_lote: codigoLote,
        produto_id: productRow.id,
        tipo_venda: tipoVenda || 'leilao',
        lance_inicial: baseBid,
        lance_atual: baseBid,
        incremento_minimo: rawIncrement,
        preco_arremate_imediato: parsedBuyNow,
        margem_estimada_revenda: estimatedMargin,
        total_lances: 0,
        ultimo_lance_empresa: 'Aguardando primeiro lance',
        termina_em: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
        status: 'ativo',
        raio_km: 45,
        tipo_frete: tipoFrete || 'FOB',
      })
      .select('*, products(*)')
      .single();

    if (aucErr || !auctionRow) {
      return NextResponse.json(
        { error: aucErr?.message || 'Erro ao ativar pregão do lote.' },
        { status: 500 }
      );
    }

    await dbClient.from('audit_worm_logs').insert({
      tipo_evento: 'lote_publicado',
      protocolo: codigoLote,
      payload_json: {
        auctionId: auctionRow.id,
        productId: productRow.id,
        fornecedorId: ctx.user.id,
        lanceInicial: baseBid,
      },
      merkle_root_hash: buildAuditHash(codigoLote, 'lote_publicado', {
        auctionId: auctionRow.id,
        baseBid,
      }),
      responsavel_id: ctx.user.id,
    });

    return NextResponse.json(
      {
        message: 'Lote cadastrado e pregão ativado no marketplace B2B',
        lot: mapDbAuctionToAuctionLot(auctionRow as Record<string, unknown>),
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('Erro ao cadastrar novo lote:', err);
    return NextResponse.json({ error: 'Erro interno ao publicar lote' }, { status: 500 });
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
    const { loteId, action, extendHours } = body;

    if (!loteId || !action) {
      return NextResponse.json(
        { error: 'Parâmetros obrigatórios: loteId e action.' },
        { status: 400 }
      );
    }

    const dbClient = isSupabaseAdminConfigured ? createAdminSupabaseClient() : ctx.supabase;
    const { data: existingAuction, error: fetchErr } = await dbClient
      .from('auctions')
      .select('*, products(*)')
      .eq('id', loteId)
      .maybeSingle();

    if (fetchErr || !existingAuction || !existingAuction.products) {
      return NextResponse.json({ error: 'Lote não encontrado.' }, { status: 404 });
    }

    const product = existingAuction.products as Record<string, unknown>;
    const isOwner = String(product.fornecedor_id) === ctx.user.id;
    const isAdmin = ctx.profile.role === 'admin';

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'Apenas o fornecedor proprietário ou administrador pode gerenciar este lote.' },
        { status: 403 }
      );
    }

    if (existingAuction.status === 'homologado') {
      return NextResponse.json(
        { error: 'Lotes já arrematados e homologados em Escrow não podem ser alterados.' },
        { status: 409 }
      );
    }

    const updates: Record<string, unknown> = {};
    let eventLabel = '';

    if (action === 'close_auction') {
      updates.status = 'encerrado';
      eventLabel = 'Lote encerrado manualmente pelo fornecedor.';
    } else if (action === 'reactivate_auction') {
      updates.status = 'ativo';
      const currentEnd = new Date(String(existingAuction.termina_em)).getTime();
      if (Number.isNaN(currentEnd) || currentEnd <= Date.now()) {
        updates.termina_em = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
      }
      eventLabel = 'Pregão reativado com janela operacional aberta.';
    } else if (action === 'extend_auction') {
      const hours = Math.min(168, Math.max(1, Number(extendHours || 24)));
      const baseMs = Math.max(Date.now(), new Date(String(existingAuction.termina_em)).getTime() || Date.now());
      updates.termina_em = new Date(baseMs + hours * 3600 * 1000).toISOString();
      if (existingAuction.status === 'encerrado') {
        updates.status = 'ativo';
      }
      eventLabel = `Prazo do pregão prorrogado em +${hours} horas.`;
    } else {
      return NextResponse.json({ error: 'Ação não suportada para o lote.' }, { status: 400 });
    }

    const { data: updatedRow, error: updErr } = await dbClient
      .from('auctions')
      .update(updates)
      .eq('id', loteId)
      .select('*, products(*, categories(id, slug, nome))')
      .single();

    if (updErr || !updatedRow) {
      return NextResponse.json(
        { error: updErr?.message || 'Erro ao atualizar status do lote.' },
        { status: 500 }
      );
    }

    await dbClient.from('audit_worm_logs').insert({
      tipo_evento: `lote_${action}`,
      protocolo: String(existingAuction.codigo_lote),
      payload_json: { loteId, action, updates, actorId: ctx.user.id },
      merkle_root_hash: buildAuditHash(String(existingAuction.codigo_lote), action, updates),
      responsavel_id: ctx.user.id,
    });

    return NextResponse.json({
      message: eventLabel,
      lot: mapDbAuctionToAuctionLot(updatedRow as Record<string, unknown>),
    });
  } catch (err) {
    console.error('Erro em PATCH /api/lotes:', err);
    return NextResponse.json({ error: 'Erro interno ao atualizar lote.' }, { status: 500 });
  }
}
