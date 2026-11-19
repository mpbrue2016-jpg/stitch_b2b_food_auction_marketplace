import { NextRequest, NextResponse } from 'next/server';
import {
  createServerSupabaseClient,
  getAuthenticatedUserAndProfile,
  isSupabaseServerConfigured,
} from '@/lib/supabase/server';
import { createAdminSupabaseClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { mapDbBannerToHomeBanner } from '@/lib/supabase/mappers';
import { buildAuditHash } from '@/lib/security';
import { DEMO_BANNERS } from '@/lib/demo-data';

function isValidImageUrl(url: string): boolean {
  const trimmed = url.trim();
  if (trimmed.startsWith('data:image/')) {
    return (
      trimmed.length <= 750_000 &&
      /^data:image\/(webp|png|jpeg|jpg);base64,[A-Za-z0-9+/=]+$/.test(trimmed)
    );
  }
  return trimmed.startsWith('/images/') || trimmed.startsWith('https://');
}

async function persistBannerImageToStorage(
  dataUrlOrPath: string,
  userId: string
): Promise<string> {
  if (!dataUrlOrPath.startsWith('data:image/')) {
    return dataUrlOrPath;
  }
  const match = dataUrlOrPath.match(
    /^data:(image\/(?:webp|png|jpeg|jpg));base64,([A-Za-z0-9+/=]+)$/
  );
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

async function fetchSortedBanners(activeOnly = false, envMode: 'modelo' | 'original' = 'modelo') {
  const supabase = createServerSupabaseClient();
  let query = supabase.from('home_banners').select('*').order('ordem', { ascending: true });
  if (activeOnly) {
    query = query.eq('ativo', true);
  }
  const { data, error } = await query;
  if (error) throw error;

  const mapped = (data || []).map((r) => mapDbBannerToHomeBanner(r as Record<string, unknown>));

  if (envMode === 'original') {
    return mapped.filter((b) => !b.isDemo);
  }

  const demoRows = mapped.filter((b) => b.isDemo);
  if (demoRows.length > 0) return demoRows;
  return activeOnly ? DEMO_BANNERS.filter((b) => b.ativo) : DEMO_BANNERS;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const activeOnly = searchParams.get('activeOnly') === '1';
  const envParam = searchParams.get('env');
  const envMode: 'modelo' | 'original' = envParam === 'original' ? 'original' : 'modelo';

  if (!isSupabaseServerConfigured) {
    if (envMode === 'modelo') {
      return NextResponse.json({
        banners: activeOnly ? DEMO_BANNERS.filter((b) => b.ativo) : DEMO_BANNERS,
        source: 'demo_local',
      });
    }
    return NextResponse.json({ banners: [], source: 'original_offline' });
  }

  try {
    const banners = await fetchSortedBanners(activeOnly, envMode);
    return NextResponse.json({ banners, env: envMode });
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code === 'PGRST205' || code === '42703') {
      return NextResponse.json({
        banners:
          envMode === 'modelo'
            ? activeOnly
              ? DEMO_BANNERS.filter((b) => b.ativo)
              : DEMO_BANNERS
            : [],
        pendingMigration: true,
      });
    }
    console.error('Erro ao consultar banners:', err);
    return NextResponse.json(
      {
        error: 'Erro ao carregar banners.',
        banners:
          envMode === 'modelo'
            ? activeOnly
              ? DEMO_BANNERS.filter((b) => b.ativo)
              : DEMO_BANNERS
            : [],
      },
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
      await dbClient
        .from('home_banners')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      const defaultsPayload = DEMO_BANNERS.map((b, idx) => ({
        titulo: b.titulo,
        subtitulo: b.subtitulo,
        eyebrow: b.eyebrow,
        cta_label: b.ctaLabel,
        cta_href: b.ctaHref,
        imagem_url: b.imagemUrl,
        ordem: idx + 1,
        ativo: b.ativo,
        intervalo_segundos: b.intervaloSegundos,
        is_demo: true,
      }));
      let { error: restoreErr } = await dbClient.from('home_banners').insert(defaultsPayload);
      if (restoreErr && restoreErr.code === '42703') {
        const legacyPayload = defaultsPayload.map((item) => {
          const copy = { ...item } as Record<string, unknown>;
          delete copy.is_demo;
          return copy;
        });
        const retry = await dbClient.from('home_banners').insert(legacyPayload);
        restoreErr = retry.error;
      }
      if (restoreErr) {
        return NextResponse.json({ error: restoreErr.message }, { status: 500 });
      }
      const banners = await fetchSortedBanners(false, 'modelo');
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
    const isDemo = body.isDemo === true;

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
    const current = await fetchSortedBanners(false, isDemo ? 'modelo' : 'original');
    const nextOrder = current.length > 0 ? Math.max(...current.map((b) => b.ordem)) + 1 : 1;

    const insertObj: Record<string, unknown> = {
      titulo: titulo.slice(0, 120),
      subtitulo: subtitulo.slice(0, 220),
      eyebrow: (eyebrow || 'Campanha Oficial Varejista Online').slice(0, 90),
      cta_label: (ctaLabel || 'Ver Ofertas').slice(0, 40),
      cta_href: ctaHref,
      imagem_url: imagemUrl,
      ordem: Number(body.ordem) > 0 ? Number(body.ordem) : nextOrder,
      ativo,
      intervalo_segundos: intervaloSegundos,
      is_demo: isDemo,
    };

    let { data: inserted, error: insertErr } = await dbClient
      .from('home_banners')
      .insert(insertObj)
      .select('*')
      .single();

    if (insertErr && insertErr.code === '42703') {
      delete insertObj.is_demo;
      const retry = await dbClient.from('home_banners').insert(insertObj).select('*').single();
      inserted = retry.data;
      insertErr = retry.error;
    }

    if (insertErr || !inserted) {
      return NextResponse.json(
        { error: insertErr?.message || 'Erro ao gravar banner no banco.' },
        { status: 500 }
      );
    }

    await dbClient.from('audit_worm_logs').insert({
      tipo_evento: 'banner_criado',
      protocolo: `BANNER-${inserted.id}`,
      payload_json: { bannerId: inserted.id, titulo, isDemo, adminId: ctx.user.id },
      merkle_root_hash: buildAuditHash(String(inserted.id), 'banner_criado', { titulo, isDemo }),
      responsavel_id: ctx.user.id,
    });

    const banners = await fetchSortedBanners(false, isDemo ? 'modelo' : 'original');
    return NextResponse.json(
      {
        message: 'Banner adicionado com sucesso.',
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

    const { data: allRows } = await dbClient
      .from('home_banners')
      .select('*')
      .order('ordem', { ascending: true });
    const sorted = (allRows || []).map((r) =>
      mapDbBannerToHomeBanner(r as Record<string, unknown>)
    );
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
        banners: await fetchSortedBanners(false, current.isDemo ? 'modelo' : 'original'),
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
        banners: await fetchSortedBanners(false, current.isDemo ? 'modelo' : 'original'),
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
      return NextResponse.json(
        { error: updErr?.message || 'Erro ao atualizar banner.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Banner atualizado com sucesso.',
      banner: mapDbBannerToHomeBanner(updatedRow as Record<string, unknown>),
      banners: await fetchSortedBanners(false, current.isDemo ? 'modelo' : 'original'),
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

    const remaining = await fetchSortedBanners(false, 'modelo');
    await Promise.all(
      remaining.map((b, i) =>
        dbClient.from('home_banners').update({ ordem: i + 1 }).eq('id', b.id)
      )
    );

    return NextResponse.json({
      message: 'Banner removido da rotação.',
      banners: await fetchSortedBanners(false, 'modelo'),
    });
  } catch (err) {
    console.error('Erro ao excluir banner:', err);
    return NextResponse.json({ error: 'Erro interno ao excluir banner.' }, { status: 500 });
  }
}
