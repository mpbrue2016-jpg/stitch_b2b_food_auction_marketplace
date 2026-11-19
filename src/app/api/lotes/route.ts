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
import { DEMO_CATEGORIES, DEMO_SUPPLIER_ID, getDemoLots } from '@/lib/demo-data';
import type { AuctionLot } from '@/lib/types';

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

function isRowDemoRecord(row: Record<string, unknown>): boolean {
  if (typeof row.is_demo === 'boolean') return row.is_demo;
  const prod = (row.products || {}) as Record<string, unknown>;
  if (typeof prod.is_demo === 'boolean') return prod.is_demo;
  const idStr = String(row.id || '');
  const prodIdStr = String(prod.id || '');
  const supplierStr = String(prod.fornecedor_id || '');
  return (
    idStr.startsWith('a1000000-') ||
    prodIdStr.startsWith('p1000000-') ||
    supplierStr === DEMO_SUPPLIER_ID
  );
}

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

  if (firstCat) {
    return { id: String(firstCat.id), slug: String(firstCat.slug) };
  }

  // Se o banco estiver com categories vazia, tenta semear automaticamente (quando houver permissão admin/service_role)
  const seedPayload = DEMO_CATEGORIES.map((c) => ({
    nome: c.nome,
    slug: c.slug,
    icone: c.icone,
    descricao: c.descricao,
    ativo: true,
  }));
  const { data: seeded } = await supabase
    .from('categories')
    .upsert(seedPayload, { onConflict: 'slug' })
    .select('id, slug');

  if (Array.isArray(seeded) && seeded.length > 0) {
    const matched =
      seeded.find((c) => c.slug === mappedSlug) ||
      seeded.find((c) => c.id === value) ||
      seeded[0];
    return { id: String(matched.id), slug: String(matched.slug) };
  }

  return null;
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

function applyLotFilters(
  items: Array<{ lot: AuctionLot; categorySlug: string }>,
  params: { q: string; categoria: string; filtro: string; fornecedorId: string }
): AuctionLot[] {
  let filtered = items;

  if (params.fornecedorId) {
    filtered = filtered.filter((item) => item.lot.produto.fornecedorId === params.fornecedorId);
  }

  if (params.categoria && params.categoria !== 'todas') {
    const legacySlug = LEGACY_CATEGORY_SLUG_MAP[params.categoria] || '';
    filtered = filtered.filter(
      (item) =>
        item.lot.produto.categoriaId.toLowerCase() === params.categoria ||
        item.categorySlug === params.categoria ||
        (legacySlug && (item.categorySlug === legacySlug || item.lot.produto.categoriaId.toLowerCase() === legacySlug))
    );
  }

  if (params.filtro === 'validade_proxima') {
    filtered = filtered.filter((item) => item.lot.produto.diasRestantesValidade <= 90);
  } else if (params.filtro === 'giro_rapido') {
    filtered = filtered.filter(
      (item) =>
        item.lot.tipoVenda === 'giro_rapido' ||
        item.lot.produto.statusShelfLife === 'giro_rapido' ||
        item.lot.produto.statusShelfLife === 'critica'
    );
  } else if (params.filtro === 'pequenos_mercados') {
    filtered = filtered.filter(
      (item) => item.lot.lanceAtual <= 10000 || item.lot.produto.paletes <= 6
    );
  }

  if (params.q) {
    filtered = filtered.filter(
      (item) =>
        item.lot.produto.titulo.toLowerCase().includes(params.q) ||
        item.lot.produto.marca.toLowerCase().includes(params.q) ||
        item.lot.produto.gtinEan.includes(params.q) ||
        item.lot.codigoLote.toLowerCase().includes(params.q) ||
        item.lot.produto.origem.toLowerCase().includes(params.q)
    );
  }

  return filtered.map((item) => item.lot);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const envParam = searchParams.get('env') || 'modelo';
  const q = searchParams.get('q')?.trim().toLowerCase() || '';
  const categoria = searchParams.get('categoria')?.trim().toLowerCase() || '';
  const filtro = searchParams.get('filtro')?.trim().toLowerCase() || '';
  const fornecedorId = searchParams.get('fornecedorId')?.trim() || '';

  // Se id for de lote demonstrativo estático, retorna imediatamente em modo modelo
  if (id && envParam !== 'original') {
    const staticDemo = getDemoLots().find((l) => l.id === id || l.codigoLote === id);
    if (staticDemo && id.startsWith('demo-')) {
      return NextResponse.json({ lot: staticDemo, lots: [staticDemo], env: 'modelo' });
    }
  }

  if (!isSupabaseServerConfigured) {
    if (envParam === 'original') {
      return NextResponse.json({ lots: [], env: 'original' });
    }
    const demoItems = getDemoLots().map((lot) => ({
      lot,
      categorySlug: lot.produto.categoriaId.toLowerCase(),
    }));
    const result = applyLotFilters(demoItems, { q, categoria, filtro, fornecedorId });
    if (id) {
      const found = getDemoLots().find((l) => l.id === id || l.codigoLote === id);
      if (!found) return NextResponse.json({ error: 'Lote não encontrado.' }, { status: 404 });
      return NextResponse.json({ lot: found, lots: [found], env: 'modelo' });
    }
    return NextResponse.json({ lots: result, env: 'modelo' });
  }

  try {
    const supabase = createServerSupabaseClient();
    let query = supabase
      .from('auctions')
      .select('*, products(*, categories(id, slug, nome))')
      .order('created_at', { ascending: false });

    if (id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      query = query.eq('id', id);
    } else if (id) {
      query = query.eq('codigo_lote', id);
    }

    const { data, error } = await query;
    const dbRows = !error && Array.isArray(data) ? (data as Record<string, unknown>[]) : [];

    const mappedDb = dbRows.map((row) => {
      const demoFlag = isRowDemoRecord(row);
      const lot = mapDbAuctionToAuctionLot({ ...row, is_demo: demoFlag });
      const rawProduct = (row.products || {}) as Record<string, unknown>;
      const catSlug = String(
        ((rawProduct.categories as Record<string, unknown> | undefined)?.slug as string | undefined) ||
          lot.produto.categoriaId ||
          ''
      ).toLowerCase();
      return { lot, categorySlug: catSlug, demoFlag };
    });

    if (id) {
      const dbMatch = mappedDb[0];
      if (dbMatch) {
        if (envParam === 'original' && dbMatch.demoFlag) {
          return NextResponse.json(
            { error: 'Este lote pertence exclusivamente ao Ambiente Modelo.' },
            { status: 404 }
          );
        }
        return NextResponse.json({
          lot: dbMatch.lot,
          lots: [dbMatch.lot],
          env: dbMatch.demoFlag ? 'modelo' : 'original',
        });
      }
      if (envParam !== 'original') {
        const staticMatch = getDemoLots().find((l) => l.id === id || l.codigoLote === id);
        if (staticMatch) {
          return NextResponse.json({ lot: staticMatch, lots: [staticMatch], env: 'modelo' });
        }
      }
      return NextResponse.json({ error: 'Lote não encontrado.' }, { status: 404 });
    }

    if (envParam === 'original') {
      const realOnly = mappedDb
        .filter((item) => !item.demoFlag)
        .map(({ lot, categorySlug }) => ({ lot, categorySlug }));
      return NextResponse.json({
        lots: applyLotFilters(realOnly, { q, categoria, filtro, fornecedorId }),
        env: 'original',
      });
    }

    if (envParam === 'all') {
      const realItems = mappedDb.filter((item) => !item.demoFlag);
      const dbDemoItems = mappedDb.filter((item) => item.demoFlag);
      const existingCodes = new Set(mappedDb.map((m) => m.lot.codigoLote));
      const fallbackDemo = getDemoLots()
        .filter((l) => !existingCodes.has(l.codigoLote))
        .map((lot) => ({ lot, categorySlug: lot.produto.categoriaId.toLowerCase() }));

      const combined = [
        ...realItems.map(({ lot, categorySlug }) => ({ lot, categorySlug })),
        ...dbDemoItems.map(({ lot, categorySlug }) => ({ lot, categorySlug })),
        ...fallbackDemo,
      ];
      return NextResponse.json({
        lots: applyLotFilters(combined, { q, categoria, filtro, fornecedorId }),
        env: 'all',
      });
    }

    // Ambiente Modelo: combina lotes is_demo do banco + catálogo modelo do Stitch
    const dbDemoItems = mappedDb.filter((item) => item.demoFlag);
    const dbCodes = new Set(dbDemoItems.map((m) => m.lot.codigoLote));
    const curatedDemo = getDemoLots()
      .filter((l) => !dbCodes.has(l.codigoLote))
      .map((lot) => ({ lot, categorySlug: lot.produto.categoriaId.toLowerCase() }));

    const modeloCombined = [
      ...dbDemoItems.map(({ lot, categorySlug }) => ({
        lot: { ...lot, isDemo: true, produto: { ...lot.produto, isDemo: true } },
        categorySlug,
      })),
      ...curatedDemo,
    ];

    return NextResponse.json({
      lots: applyLotFilters(modeloCombined, { q, categoria, filtro, fornecedorId }),
      env: 'modelo',
    });
  } catch (err) {
    console.error('Erro ao buscar lotes no Supabase:', err);
    if (envParam === 'original') {
      return NextResponse.json({ error: 'Erro interno ao consultar lotes.', lots: [] }, { status: 500 });
    }
    const demoItems = getDemoLots().map((lot) => ({
      lot,
      categorySlug: lot.produto.categoriaId.toLowerCase(),
    }));
    return NextResponse.json({
      lots: applyLotFilters(demoItems, { q, categoria, filtro, fornecedorId }),
      env: 'modelo',
    });
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
        { error: 'Apenas fornecedores, anunciantes ou administradores podem publicar lotes de estoque.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    // Usuários comuns NUNCA podem criar lotes demonstrativos nem converter reais em modelo
    const isDemoRecord = Boolean(body.isDemo) && ctx.profile.role === 'admin';
    if (Boolean(body.isDemo) && ctx.profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Somente administradores podem publicar lotes demonstrativos (MODELO).' },
        { status: 403 }
      );
    }

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

    const productPayload: Record<string, unknown> = {
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
      is_demo: isDemoRecord,
    };

    let { data: productRow, error: prodErr } = await dbClient
      .from('products')
      .insert(productPayload)
      .select('*')
      .single();

    if (prodErr && (prodErr.code === '42703' || prodErr.message?.includes('is_demo') || prodErr.message?.includes('embalagem'))) {
      delete productPayload.is_demo;
      delete productPayload.embalagem;
      const retry = await dbClient.from('products').insert(productPayload).select('*').single();
      productRow = retry.data;
      prodErr = retry.error;
    }

    if (prodErr || !productRow) {
      return NextResponse.json(
        { error: prodErr?.message || 'Erro ao gravar produto do lote.' },
        { status: 500 }
      );
    }

    const auctionPayload: Record<string, unknown> = {
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
      is_demo: isDemoRecord,
    };

    let { data: auctionRow, error: aucErr } = await dbClient
      .from('auctions')
      .insert(auctionPayload)
      .select('*, products(*)')
      .single();

    if (aucErr && (aucErr.code === '42703' || aucErr.message?.includes('is_demo') || aucErr.message?.includes('raio_km'))) {
      delete auctionPayload.is_demo;
      delete auctionPayload.raio_km;
      const retryAuc = await dbClient
        .from('auctions')
        .insert(auctionPayload)
        .select('*, products(*)')
        .single();
      auctionRow = retryAuc.data;
      aucErr = retryAuc.error;
    }

    if (aucErr || !auctionRow) {
      return NextResponse.json(
        { error: aucErr?.message || 'Erro ao ativar pregão do lote.' },
        { status: 500 }
      );
    }

    await dbClient.from('audit_worm_logs').insert({
      tipo_evento: isDemoRecord ? 'lote_modelo_publicado' : 'lote_publicado',
      protocolo: codigoLote,
      payload_json: {
        auctionId: auctionRow.id,
        productId: productRow.id,
        fornecedorId: ctx.user.id,
        lanceInicial: baseBid,
        isDemo: isDemoRecord,
      },
      merkle_root_hash: buildAuditHash(codigoLote, 'lote_publicado', {
        auctionId: auctionRow.id,
        baseBid,
        isDemo: isDemoRecord,
      }),
      responsavel_id: ctx.user.id,
    });

    const mappedLot = mapDbAuctionToAuctionLot({ ...auctionRow, is_demo: isDemoRecord } as Record<string, unknown>);

    return NextResponse.json(
      {
        message: isDemoRecord
          ? 'Lote modelo adicionado ao Ambiente Modelo com sucesso'
          : 'Lote verdadeiro cadastrado e pregão ativado no Ambiente Original',
        lot: mappedLot,
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

    if (String(loteId).startsWith('demo-') && ctx.profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Registros do Ambiente Modelo não podem ser modificados por usuários comuns.' },
        { status: 403 }
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

    const isDemo = isRowDemoRecord(existingAuction as Record<string, unknown>);
    const product = existingAuction.products as Record<string, unknown>;
    const isOwner = String(product.fornecedor_id) === ctx.user.id;
    const isAdmin = ctx.profile.role === 'admin';

    if (isDemo && !isAdmin) {
      return NextResponse.json(
        { error: 'Apenas administradores autorizados podem editar lotes demonstrativos.' },
        { status: 403 }
      );
    }

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
