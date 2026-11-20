import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedUserAndProfile,
  isSupabaseServerConfigured,
} from '@/lib/supabase/server';
import { createAdminSupabaseClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { mapDbAuctionToAuctionLot } from '@/lib/supabase/mappers';
import { DEMO_CATEGORIES, getDemoLots } from '@/lib/demo-data';
import { isAuthorizedAdminProfile } from '@/lib/auth-admin';
import { buildAuditHash } from '@/lib/security';

export async function GET() {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: 'Supabase não configurado.' }, { status: 503 });
  }

  try {
    const ctx = await getAuthenticatedUserAndProfile();
    if (!ctx?.user || !ctx.profile) {
      return NextResponse.json({ error: 'Autenticação obrigatória.' }, { status: 401 });
    }
    if (!isAuthorizedAdminProfile(ctx.profile)) {
      return NextResponse.json(
        { error: 'Somente o Administrador Master autorizado pode gerenciar os modelos demonstrativos.' },
        { status: 403 }
      );
    }

    const dbClient = isSupabaseAdminConfigured ? createAdminSupabaseClient() : ctx.supabase;
    const { data: rows, error } = await dbClient
      .from('auctions')
      .select('*, products(*, categories(slug, nome))')
      .eq('is_demo', true)
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === '42703' || error.code === 'PGRST205') {
        return NextResponse.json({
          lots: getDemoLots(),
          source: 'curated_fallback',
          pendingMigration: true,
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const dbDemoLots = (rows || [])
      .filter((r) => Boolean(r.products))
      .map((r) => mapDbAuctionToAuctionLot(r as Record<string, unknown>));

    return NextResponse.json({
      lots: dbDemoLots.length > 0 ? dbDemoLots : getDemoLots(),
      dbCount: dbDemoLots.length,
      curatedCount: getDemoLots().length,
      source: dbDemoLots.length > 0 ? 'supabase' : 'curated_fallback',
    });
  } catch (err) {
    console.error('Erro em GET /api/admin/modelos:', err);
    return NextResponse.json({ error: 'Erro interno ao consultar modelos.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: 'Supabase não configurado.' }, { status: 503 });
  }

  try {
    const ctx = await getAuthenticatedUserAndProfile();
    if (!ctx?.user || !ctx.profile) {
      return NextResponse.json({ error: 'Autenticação obrigatória.' }, { status: 401 });
    }
    if (!isAuthorizedAdminProfile(ctx.profile)) {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas o Administrador Master autorizado pode publicar ou editar modelos.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const dbClient = isSupabaseAdminConfigured ? createAdminSupabaseClient() : ctx.supabase;

    if (body.action === 'seed_stitch_demos') {
      const demoLots = getDemoLots();
      const { data: dbCategories } = await dbClient.from('categories').select('id, slug');
      const slugToUuid = new Map<string, string>();
      for (const c of dbCategories || []) {
        slugToUuid.set(String(c.slug), String(c.id));
      }

      let synced = 0;
      for (const lot of demoLots) {
        const categoryId =
          slugToUuid.get(lot.produto.categoriaId) ||
          slugToUuid.get('alimentos-secos') ||
          DEMO_CATEGORIES[0].id;

        const { data: prodRow, error: prodErr } = await dbClient
          .from('products')
          .upsert(
            {
              fornecedor_id: ctx.user.id,
              categoria_id: categoryId,
              sku: lot.produto.sku,
              titulo: lot.produto.titulo,
              descricao: lot.produto.descricao,
              marca: lot.produto.marca,
              fabricante: lot.produto.fabricante,
              origem_cd: lot.produto.origem,
              gtin_ean: lot.produto.gtinEan,
              dun14: lot.produto.dun14,
              imagem_url: lot.produto.imagemUrl,
              embalagem: lot.produto.embalagem,
              unidades_por_embalagem: lot.produto.unidadesPorEmbalagem,
              total_caixas: lot.produto.totalCaixas,
              total_unidades: lot.produto.totalUnidades,
              paletes_pbr: lot.produto.paletes,
              data_validade: lot.produto.dataValidade,
              status_shelf_life: lot.produto.statusShelfLife,
              laudo_sanitario_anvisa: true,
              status_fiscal: 'homologado',
              preco_referencia_mercado: lot.produto.precoReferenciaMercado,
              is_demo: true,
            },
            { onConflict: 'sku' }
          )
          .select('id')
          .single();

        if (prodErr || !prodRow) continue;

        const { error: aucErr } = await dbClient.from('auctions').upsert(
          {
            codigo_lote: lot.codigoLote,
            produto_id: prodRow.id,
            tipo_venda: lot.tipoVenda,
            lance_inicial: lot.lanceInicial,
            lance_atual: lot.lanceAtual,
            incremento_minimo: lot.incrementoMinimo,
            preco_arremate_imediato: lot.precoArremateImediato,
            total_lances: lot.totalLances,
            ultimo_lance_empresa: lot.ultimoLanceEmpresa,
            termina_em: lot.terminaEm,
            status: lot.status,
            raio_km: lot.raioKm,
            tipo_frete: lot.tipoFrete,
            is_demo: true,
          },
          { onConflict: 'codigo_lote' }
        );
        if (!aucErr) synced++;
      }

      return NextResponse.json({
        message: `${synced} lotes demonstrativos do Stitch sincronizados no Supabase com is_demo = true.`,
        synced,
      });
    }

    const {
      titulo,
      marca,
      categoriaSlug,
      lanceInicial,
      precoArremateImediato,
      totalCaixas,
      unidadesPorEmbalagem,
      imagemUrl,
      tipoVenda,
      tipoFrete,
      diasValidade,
    } = body;

    if (!titulo || !lanceInicial) {
      return NextResponse.json(
        { error: 'Informe título e lance inicial para criar um lote modelo.' },
        { status: 400 }
      );
    }

    const { data: catRow } = await dbClient
      .from('categories')
      .select('id')
      .eq('slug', categoriaSlug || 'alimentos-secos')
      .maybeSingle();

    const safeCatId = catRow?.id || DEMO_CATEGORIES[0].id;
    const boxes = Math.max(1, Number(totalCaixas || 100));
    const unitsPerBox = Math.max(1, Number(unidadesPorEmbalagem || 12));
    const daysVal = Math.max(5, Number(diasValidade || 120));
    const valDate = new Date(Date.now() + daysVal * 86400 * 1000).toISOString().split('T')[0];

    const { data: prodInserted, error: prodInsertErr } = await dbClient
      .from('products')
      .insert({
        fornecedor_id: ctx.user.id,
        categoria_id: safeCatId,
        sku: `MOD-${Date.now().toString().slice(-6)}`,
        titulo: String(titulo).trim().slice(0, 200),
        descricao: String(
          body.descricao ||
            'Lote demonstrativo criado no Painel Administrativo para ensinar compradores e fornecedores.'
        ),
        marca: String(marca || 'Marca Modelo B2B').trim(),
        fabricante: String(body.fabricante || 'Indústria Modelo S.A.').trim(),
        origem_cd: String(body.origem || 'CD Jundiaí - SP').trim(),
        gtin_ean: '7891000999001',
        dun14: '17891000999008',
        imagem_url: String(imagemUrl || '/images/lotes/lote-418-cafe.webp'),
        embalagem: `Caixa c/ ${unitsPerBox} un`,
        unidades_por_embalagem: unitsPerBox,
        total_caixas: boxes,
        total_unidades: boxes * unitsPerBox,
        paletes_pbr: Math.max(1, Math.ceil(boxes / 60)),
        data_validade: valDate,
        status_shelf_life: daysVal <= 30 ? 'critica' : daysVal <= 90 ? 'atencao' : 'longa',
        laudo_sanitario_anvisa: true,
        status_fiscal: 'homologado',
        preco_referencia_mercado: Number(body.precoReferenciaMercado || 12.5),
        is_demo: true,
      })
      .select('id')
      .single();

    if (prodInsertErr || !prodInserted) {
      return NextResponse.json(
        { error: prodInsertErr?.message || 'Erro ao gravar produto modelo.' },
        { status: 500 }
      );
    }

    const startPrice = Math.max(100, Number(lanceInicial));
    const buyNowPrice = Math.max(startPrice, Number(precoArremateImediato || startPrice * 1.35));

    const { data: aucInserted, error: aucInsertErr } = await dbClient
      .from('auctions')
      .insert({
        codigo_lote: `MODELO-${Math.floor(1000 + Math.random() * 8999)}`,
        produto_id: prodInserted.id,
        tipo_venda: ['leilao', 'giro_rapido', 'venda_direta'].includes(tipoVenda)
          ? tipoVenda
          : 'leilao',
        lance_inicial: startPrice,
        lance_atual: startPrice,
        incremento_minimo: 100,
        preco_arremate_imediato: buyNowPrice,
        total_lances: 0,
        ultimo_lance_empresa: 'Ambiente Modelo',
        termina_em: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
        status: 'ativo',
        raio_km: 35,
        tipo_frete: tipoFrete === 'CIF' ? 'CIF' : 'FOB',
        is_demo: true,
      })
      .select('*, products(*, categories(slug, nome))')
      .single();

    if (aucInsertErr || !aucInserted) {
      return NextResponse.json(
        { error: aucInsertErr?.message || 'Erro ao publicar lote modelo.' },
        { status: 500 }
      );
    }

    await dbClient.from('audit_worm_logs').insert({
      tipo_evento: 'modelo_demo_criado',
      protocolo: String(aucInserted.codigo_lote),
      payload_json: { loteId: aucInserted.id, titulo, adminId: ctx.user.id },
      merkle_root_hash: buildAuditHash(String(aucInserted.id), 'modelo_demo_criado', { titulo }),
      responsavel_id: ctx.user.id,
    });

    return NextResponse.json(
      {
        message: 'Novo lote demonstrativo (MODELO) publicado com sucesso.',
        lot: mapDbAuctionToAuctionLot(aucInserted as Record<string, unknown>),
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('Erro em POST /api/admin/modelos:', err);
    return NextResponse.json({ error: 'Erro interno ao criar modelo.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: 'Supabase não configurado.' }, { status: 503 });
  }

  try {
    const ctx = await getAuthenticatedUserAndProfile();
    if (!ctx?.user || !ctx.profile) {
      return NextResponse.json({ error: 'Autenticação obrigatória.' }, { status: 401 });
    }
    if (!isAuthorizedAdminProfile(ctx.profile)) {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas o Administrador Master autorizado pode editar modelos.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { id, status, lanceAtual, precoArremateImediato } = body;
    if (!id) {
      return NextResponse.json({ error: 'Parâmetro obrigatório: id.' }, { status: 400 });
    }

    const dbClient = isSupabaseAdminConfigured ? createAdminSupabaseClient() : ctx.supabase;
    const { data: existing } = await dbClient
      .from('auctions')
      .select('id, is_demo')
      .eq('id', id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: 'Lote modelo não encontrado no Supabase.' }, { status: 404 });
    }
    if (!existing.is_demo) {
      return NextResponse.json(
        { error: 'Operação permitida somente para registros marcados como is_demo = true.' },
        { status: 403 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (status && ['ativo', 'reta_final', 'homologado', 'encerrado', 'cancelado'].includes(status)) {
      updates.status = status;
    }
    if (lanceAtual !== undefined && Number(lanceAtual) > 0) {
      updates.lance_atual = Number(lanceAtual);
    }
    if (precoArremateImediato !== undefined && Number(precoArremateImediato) > 0) {
      updates.preco_arremate_imediato = Number(precoArremateImediato);
    }

    const { data: updated, error } = await dbClient
      .from('auctions')
      .update(updates)
      .eq('id', id)
      .select('*, products(*, categories(slug, nome))')
      .single();

    if (error || !updated) {
      return NextResponse.json({ error: error?.message || 'Erro ao atualizar modelo.' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Registro demonstrativo atualizado com sucesso.',
      lot: mapDbAuctionToAuctionLot(updated as Record<string, unknown>),
    });
  } catch (err) {
    console.error('Erro em PATCH /api/admin/modelos:', err);
    return NextResponse.json({ error: 'Erro interno ao atualizar modelo.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: 'Supabase não configurado.' }, { status: 503 });
  }

  try {
    const ctx = await getAuthenticatedUserAndProfile();
    if (!ctx?.user || !ctx.profile) {
      return NextResponse.json({ error: 'Autenticação obrigatória.' }, { status: 401 });
    }
    if (!isAuthorizedAdminProfile(ctx.profile)) {
      return NextResponse.json(
        { error: 'Apenas o Administrador Master autorizado pode excluir registros demonstrativos.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Parâmetro obrigatório: id.' }, { status: 400 });
    }

    const dbClient = isSupabaseAdminConfigured ? createAdminSupabaseClient() : ctx.supabase;
    const { data: existing } = await dbClient
      .from('auctions')
      .select('id, is_demo, produto_id')
      .eq('id', id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: 'Modelo não encontrado.' }, { status: 404 });
    }
    if (!existing.is_demo) {
      return NextResponse.json(
        { error: 'Registros reais de usuários não podem ser excluídos pelo gerenciador de modelos.' },
        { status: 403 }
      );
    }

    await dbClient.from('auctions').delete().eq('id', id);
    if (existing.produto_id) {
      await dbClient.from('products').delete().eq('id', existing.produto_id).eq('is_demo', true);
    }

    return NextResponse.json({ message: 'Lote demonstrativo removido com segurança.' });
  } catch (err) {
    console.error('Erro em DELETE /api/admin/modelos:', err);
    return NextResponse.json({ error: 'Erro interno ao excluir modelo.' }, { status: 500 });
  }
}
