import { NextRequest, NextResponse } from 'next/server';
import {
  createServerSupabaseClient,
  getAuthenticatedUserAndProfile,
  isSupabaseServerConfigured,
} from '@/lib/supabase/server';
import { createAdminSupabaseClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { mapDbBannerToHomeBanner } from '@/lib/supabase/mappers';
import { buildAuditHash } from '@/lib/security';

const DEFAULT_HOME_BANNERS = [
  {
    eyebrow: 'Pequenos Mercados & Minimercados · Estoque Parado',
    titulo: 'Tem Estoque Parado no Seu Mercado? Transforme em Dinheiro Hoje',
    subtitulo:
      'Liquide fardos encalhados, sobras de compra ou itens perto do vencimento para mais de 3.140 compradores com custódia Escrow D+0.',
    ctaLabel: 'Liquidar Meu Estoque Parado',
    ctaHref: '/produtos/novo?modelo=pequeno_mercado',
    imagemUrl: '/images/banners/banner-pequenos-mercados.jpg',
    ativo: true,
    intervaloSegundos: 6,
  },
  {
    eyebrow: 'Rodada Industrial SP · Custódia Escrow BACEN',
    titulo: 'Cargas Fechadas direto da Indústria com até 70% OFF',
    subtitulo:
      'Negocie paletes PBR homologados ANVISA/MAPA com repasse D+0 garantido e retirada FOB agendada em 48 horas.',
    ctaLabel: 'Explorar Leilões ao Vivo',
    ctaHref: '/leiloes',
    imagemUrl: '/images/banners/banner-atacado-pallets.jpg',
    ativo: true,
    intervaloSegundos: 6,
  },
  {
    eyebrow: 'Pregões Multi-Setor · Cerealista, Hortifruti & Limpeza',
    titulo: 'Cerealista, Hortifruti CEASA e Higiene e Limpeza em Lotes',
    subtitulo:
      'Arroz, feijão em sacaria, caixas frescas de hortifruti e combos de limpeza com deságio imediato para mercados e atacarejos.',
    ctaLabel: 'Filtrar Pregões por Segmento',
    ctaHref: '/leiloes',
    imagemUrl: '/images/banners/banner-safra-alimentos.jpg',
    ativo: true,
    intervaloSegundos: 6,
  },
  {
    eyebrow: 'Liquidez Imediata · Escoamento B2B',
    titulo: 'Transforme Estoque Parado em Liquidez em até 48 Horas',
    subtitulo:
      'Publique pontas de lote com NF-e integrada, agendamento de doca no CD e pagamento protegido via PIX SPI.',
    ctaLabel: 'Anunciar Lote Agora',
    ctaHref: '/produtos/novo',
    imagemUrl: '/images/banners/banner-logistica-docas.jpg',
    ativo: true,
    intervaloSegundos: 6,
  },
];

function isValidImageUrl(url: string): boolean {
  const trimmed = url.trim();
  if (trimmed.startsWith('data:image/')) {
    return (
      trimmed.length <= 750_000 &&
      /^data:image\/(webp|png|jpeg|jpg);base64,[A-Za-z0-9+/=]+$/.test(trimmed)
    );
  }
  return (
    trimmed.startsWith('/images/') ||
    trimmed.startsWith('https://')
  );
}

async function persistBannerImageToStorage(
  dataUrlOrPath: string,
  userId: string
): Promise<string> {
  if (!dataUrlOrPath.startsWith('data:image/')) {
    return dataUrlOrPath;
  }
  const match = dataUrlOrPath.match(/^data:(image\/(?:webp|png|jpeg|jpg));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    throw new Error('Formato de imagem inválido.');
  }
  const mimeType = match[1];
  const ext = mimeType.split('/')[1] === 'jpeg' ? 'jpg' : mimeType.split('/')[1];
  const buffer = Buffer.from(match[2], 'base64');
  const client = isSupabaseAdminConfigured
    ? createAdminSupabaseClient()
    : createServerSupabaseClient();
  const path = `${userId}/banner-${Date.now()}.${ext}`;
  const { error } = await client.storage.from('banners').upload(path, buffer, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) {
    throw new Error(`Falha ao salvar imagem do banner no Storage: ${error.message}`);
  }
  const { data: pub } = client.storage.from('banners').getPublicUrl(path);
  return pub.publicUrl;
}

async function fetchSortedBanners(activeOnly = false) {
  const supabase = createServerSupabaseClient();
  let query = supabase.from('home_banners').select('*').order('ordem', { ascending: true });
  if (activeOnly) {
    query = query.eq('ativo', true);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((r) => mapDbBannerToHomeBanner(r as Record<string, unknown>));
}

export async function GET(req: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json(
      { error: 'Supabase não configurado no ambiente.', banners: [] },
      { status: 503 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get('activeOnly') === '1';
    const banners = await fetchSortedBanners(activeOnly);
    return NextResponse.json({ banners });
  } catch (err) {
    console.error('Erro ao consultar banners:', err);
    return NextResponse.json({ error: 'Erro ao carregar banners.', banners: [] }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: 'Supabase não configurado no ambiente.' }, { status: 503 });
  }

  try {
    const ctx = await getAuthenticatedUserAndProfile();
    if (!ctx?.user || !ctx.profile) {
      return NextResponse.json({ error: 'Autenticação obrigatória.' }, { status: 401 });
    }
    if (ctx.profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Apenas administradores podem gerenciar banners da Home.' },
        { status: 403 }
      );
    }

    const dbClient = isSupabaseAdminConfigured ? createAdminSupabaseClient() : ctx.supabase;
    const body = await req.json();

    if (body.action === 'restore_defaults') {
      await dbClient.from('home_banners').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      const defaultsPayload = DEFAULT_HOME_BANNERS.map((b, idx) => ({
        titulo: b.titulo,
        subtitulo: b.subtitulo,
        eyebrow: b.eyebrow,
        cta_label: b.ctaLabel,
        cta_href: b.ctaHref,
        imagem_url: b.imagemUrl,
        ordem: idx + 1,
        ativo: b.ativo,
        intervalo_segundos: b.intervaloSegundos,
      }));
      const { error: restoreErr } = await dbClient.from('home_banners').insert(defaultsPayload);
      if (restoreErr) {
        return NextResponse.json({ error: restoreErr.message }, { status: 500 });
      }
      const banners = await fetchSortedBanners(false);
      return NextResponse.json({
        message: 'Série de banners modelo restaurada com sucesso no Supabase.',
        banners,
      });
    }

    const titulo = typeof body.titulo === 'string' ? body.titulo.trim() : '';
    const subtitulo = typeof body.subtitulo === 'string' ? body.subtitulo.trim() : '';
    const eyebrow = typeof body.eyebrow === 'string' ? body.eyebrow.trim() : '';
    const ctaLabel = typeof body.ctaLabel === 'string' ? body.ctaLabel.trim() : 'Explorar Lotes';
    const ctaHref = typeof body.ctaHref === 'string' ? body.ctaHref.trim() : '/catalogo';
    const rawImagemUrl =
      typeof body.imagemUrl === 'string' && body.imagemUrl.trim()
        ? body.imagemUrl.trim()
        : '/images/banners/banner-atacado-pallets.jpg';
    const intervaloSegundos = Math.min(30, Math.max(3, Number(body.intervaloSegundos) || 6));
    const ativo = body.ativo !== false;

    if (titulo.length < 4) {
      return NextResponse.json(
        { error: 'O título do banner deve conter pelo menos 4 caracteres.' },
        { status: 400 }
      );
    }

    if (!isValidImageUrl(rawImagemUrl)) {
      return NextResponse.json(
        { error: 'Imagem inválida. Envie um arquivo de imagem ou URL válida.' },
        { status: 400 }
      );
    }

    if (!ctaHref.startsWith('/')) {
      return NextResponse.json(
        { error: 'O link de destino do CTA deve iniciar com "/" (ex: /leiloes ou /catalogo).' },
        { status: 400 }
      );
    }

    const imagemUrl = await persistBannerImageToStorage(rawImagemUrl, ctx.user.id);
    const current = await fetchSortedBanners(false);
    const nextOrder = current.length > 0 ? Math.max(...current.map((b) => b.ordem)) + 1 : 1;

    const { data: inserted, error: insertErr } = await dbClient
      .from('home_banners')
      .insert({
        titulo: titulo.slice(0, 120),
        subtitulo: subtitulo.slice(0, 220),
        eyebrow: (eyebrow || 'Campanha Oficial Varejista Online').slice(0, 90),
        cta_label: (ctaLabel || 'Ver Ofertas').slice(0, 40),
        cta_href: ctaHref,
        imagem_url: imagemUrl,
        ordem: Number(body.ordem) > 0 ? Number(body.ordem) : nextOrder,
        ativo,
        intervalo_segundos: intervaloSegundos,
      })
      .select('*')
      .single();

    if (insertErr || !inserted) {
      return NextResponse.json(
        { error: insertErr?.message || 'Erro ao gravar banner no banco.' },
        { status: 500 }
      );
    }

    await dbClient.from('audit_worm_logs').insert({
      tipo_evento: 'banner_criado',
      protocolo: `BANNER-${inserted.id}`,
      payload_json: { bannerId: inserted.id, titulo, adminId: ctx.user.id },
      merkle_root_hash: buildAuditHash(String(inserted.id), 'banner_criado', { titulo }),
      responsavel_id: ctx.user.id,
    });

    const banners = await fetchSortedBanners(false);
    return NextResponse.json(
      {
        message: 'Banner adicionado à série rotativa da Home com sucesso.',
        banner: mapDbBannerToHomeBanner(inserted as Record<string, unknown>),
        banners,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('Erro ao criar banner:', err);
    return NextResponse.json({ error: 'Erro interno ao salvar banner.' }, { status: 500 });
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
    if (ctx.profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Apenas administradores podem editar banners.' },
        { status: 403 }
      );
    }

    const dbClient = isSupabaseAdminConfigured ? createAdminSupabaseClient() : ctx.supabase;
    const body = await req.json();
    const { id, action } = body;

    if (!id) {
      return NextResponse.json({ error: 'Parâmetro obrigatório: id do banner.' }, { status: 400 });
    }

    const sorted = await fetchSortedBanners(false);
    const idx = sorted.findIndex((b) => b.id === id);
    if (idx === -1) {
      return NextResponse.json({ error: 'Banner não encontrado.' }, { status: 404 });
    }

    if (action === 'move_up' && idx > 0) {
      const current = sorted[idx];
      const prev = sorted[idx - 1];
      await Promise.all([
        dbClient.from('home_banners').update({ ordem: prev.ordem }).eq('id', current.id),
        dbClient.from('home_banners').update({ ordem: current.ordem }).eq('id', prev.id),
      ]);
      return NextResponse.json({
        message: 'Ordem de exibição atualizada.',
        banners: await fetchSortedBanners(false),
      });
    }

    if (action === 'move_down' && idx < sorted.length - 1) {
      const current = sorted[idx];
      const next = sorted[idx + 1];
      await Promise.all([
        dbClient.from('home_banners').update({ ordem: next.ordem }).eq('id', current.id),
        dbClient.from('home_banners').update({ ordem: current.ordem }).eq('id', next.id),
      ]);
      return NextResponse.json({
        message: 'Ordem de exibição atualizada.',
        banners: await fetchSortedBanners(false),
      });
    }

    const current = sorted[idx];
    const nextTitulo =
      typeof body.titulo === 'string' ? body.titulo.trim().slice(0, 120) : current.titulo;
    const nextSubtitulo =
      typeof body.subtitulo === 'string' ? body.subtitulo.trim().slice(0, 220) : current.subtitulo;
    const nextEyebrow =
      typeof body.eyebrow === 'string' ? body.eyebrow.trim().slice(0, 90) : current.eyebrow;
    const nextCtaLabel =
      typeof body.ctaLabel === 'string' ? body.ctaLabel.trim().slice(0, 40) : current.ctaLabel;
    const nextCtaHref =
      typeof body.ctaHref === 'string' ? body.ctaHref.trim() : current.ctaHref;
    const rawNextImagem =
      typeof body.imagemUrl === 'string' && body.imagemUrl.trim()
        ? body.imagemUrl.trim()
        : current.imagemUrl;

    if (nextTitulo.length < 4) {
      return NextResponse.json(
        { error: 'O título do banner deve conter pelo menos 4 caracteres.' },
        { status: 400 }
      );
    }
    if (!isValidImageUrl(rawNextImagem)) {
      return NextResponse.json({ error: 'Imagem inválida para o banner.' }, { status: 400 });
    }
    if (!nextCtaHref.startsWith('/')) {
      return NextResponse.json(
        { error: 'O link de destino do CTA deve iniciar com "/".' },
        { status: 400 }
      );
    }

    const nextImagemUrl = await persistBannerImageToStorage(rawNextImagem, ctx.user.id);

    const { data: updatedRow, error: updErr } = await dbClient
      .from('home_banners')
      .update({
        titulo: nextTitulo,
        subtitulo: nextSubtitulo,
        eyebrow: nextEyebrow || current.eyebrow,
        cta_label: nextCtaLabel || current.ctaLabel,
        cta_href: nextCtaHref,
        imagem_url: nextImagemUrl,
        ativo: typeof body.ativo === 'boolean' ? body.ativo : current.ativo,
        intervalo_segundos:
          body.intervaloSegundos !== undefined
            ? Math.min(30, Math.max(3, Number(body.intervaloSegundos) || 6))
            : current.intervaloSegundos,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (updErr || !updatedRow) {
      return NextResponse.json({ error: updErr?.message || 'Erro ao atualizar banner.' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Banner atualizado com sucesso.',
      banner: mapDbBannerToHomeBanner(updatedRow as Record<string, unknown>),
      banners: await fetchSortedBanners(false),
    });
  } catch (err) {
    console.error('Erro ao atualizar banner:', err);
    return NextResponse.json({ error: 'Erro interno ao atualizar banner.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: 'Supabase não configurado no ambiente.' }, { status: 503 });
  }

  try {
    const ctx = await getAuthenticatedUserAndProfile();
    if (!ctx?.user || !ctx.profile) {
      return NextResponse.json({ error: 'Autenticação obrigatória.' }, { status: 401 });
    }
    if (ctx.profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Apenas administradores podem excluir banners.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Parâmetro obrigatório: id.' }, { status: 400 });
    }

    const dbClient = isSupabaseAdminConfigured ? createAdminSupabaseClient() : ctx.supabase;
    const { error } = await dbClient.from('home_banners').delete().eq('id', id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const remaining = await fetchSortedBanners(false);
    await Promise.all(
      remaining.map((b, i) =>
        dbClient.from('home_banners').update({ ordem: i + 1 }).eq('id', b.id)
      )
    );

    return NextResponse.json({
      message: 'Banner removido da rotação.',
      banners: await fetchSortedBanners(false),
    });
  } catch (err) {
    console.error('Erro ao excluir banner:', err);
    return NextResponse.json({ error: 'Erro interno ao excluir banner.' }, { status: 500 });
  }
}
