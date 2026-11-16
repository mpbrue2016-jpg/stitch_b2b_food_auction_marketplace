import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_HOME_BANNERS, marketplaceStore } from '@/lib/marketplace-store';
import { HomeBanner } from '@/lib/types';

function getSortedBanners(): HomeBanner[] {
  return [...marketplaceStore.banners].sort((a, b) => a.ordem - b.ordem);
}

function normalizeOrders(): void {
  const sorted = getSortedBanners();
  marketplaceStore.banners = sorted.map((banner, index) => ({
    ...banner,
    ordem: index + 1,
  }));
}

function isValidImageUrl(url: string): boolean {
  const trimmed = url.trim();
  return (
    trimmed.startsWith('/images/') ||
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('https://lh3.googleusercontent.com/') ||
    trimmed.startsWith('https://images.unsplash.com/')
  );
}

function isValidCtaHref(href: string): boolean {
  const trimmed = href.trim();
  return trimmed.startsWith('/');
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const activeOnly = searchParams.get('activeOnly') === '1';
  const sorted = getSortedBanners();
  const banners = activeOnly ? sorted.filter((b) => b.ativo) : sorted;

  return NextResponse.json({ banners });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.action === 'restore_defaults') {
      marketplaceStore.banners = [...DEFAULT_HOME_BANNERS];
      return NextResponse.json({
        message: 'Série de banners modelo restaurada com sucesso.',
        banners: getSortedBanners(),
      });
    }

    const titulo = typeof body.titulo === 'string' ? body.titulo.trim() : '';
    const subtitulo = typeof body.subtitulo === 'string' ? body.subtitulo.trim() : '';
    const eyebrow = typeof body.eyebrow === 'string' ? body.eyebrow.trim() : '';
    const ctaLabel = typeof body.ctaLabel === 'string' ? body.ctaLabel.trim() : 'Explorar Lotes';
    const ctaHref = typeof body.ctaHref === 'string' ? body.ctaHref.trim() : '/catalogo';
    const imagemUrl =
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

    if (!isValidImageUrl(imagemUrl)) {
      return NextResponse.json(
        {
          error:
            'Imagem inválida. Envie um arquivo de imagem do dispositivo ou selecione um caminho local (/images/...).',
        },
        { status: 400 }
      );
    }

    if (!isValidCtaHref(ctaHref)) {
      return NextResponse.json(
        { error: 'O link de destino do CTA deve iniciar com "/" (ex: /leiloes ou /catalogo).' },
        { status: 400 }
      );
    }

    const nextOrder =
      marketplaceStore.banners.length > 0
        ? Math.max(...marketplaceStore.banners.map((b) => b.ordem)) + 1
        : 1;

    const newBanner: HomeBanner = {
      id: `banner-${Date.now()}`,
      titulo: titulo.slice(0, 120),
      subtitulo: subtitulo.slice(0, 220),
      eyebrow: (eyebrow || 'Campanha Oficial Varejista Online').slice(0, 90),
      ctaLabel: (ctaLabel || 'Ver Ofertas').slice(0, 40),
      ctaHref,
      imagemUrl,
      ordem: Number(body.ordem) > 0 ? Number(body.ordem) : nextOrder,
      ativo,
      intervaloSegundos,
      criadoEm: new Date().toISOString(),
    };

    marketplaceStore.banners.push(newBanner);
    normalizeOrders();

    return NextResponse.json(
      {
        message: 'Banner adicionado à série rotativa da Home com sucesso.',
        banner: newBanner,
        banners: getSortedBanners(),
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('Erro ao criar banner:', err);
    return NextResponse.json({ error: 'Erro interno ao salvar banner.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, action } = body;

    if (!id) {
      return NextResponse.json({ error: 'Parâmetro obrigatório: id do banner.' }, { status: 400 });
    }

    normalizeOrders();
    const sorted = getSortedBanners();
    const idx = sorted.findIndex((b) => b.id === id);
    if (idx === -1) {
      return NextResponse.json({ error: 'Banner não encontrado.' }, { status: 404 });
    }

    if (action === 'move_up' && idx > 0) {
      const current = sorted[idx];
      const prev = sorted[idx - 1];
      sorted[idx] = { ...prev, ordem: idx + 1 };
      sorted[idx - 1] = { ...current, ordem: idx };
      marketplaceStore.banners = sorted;
      return NextResponse.json({
        message: 'Ordem de exibição atualizada.',
        banners: getSortedBanners(),
      });
    }

    if (action === 'move_down' && idx < sorted.length - 1) {
      const current = sorted[idx];
      const next = sorted[idx + 1];
      sorted[idx] = { ...next, ordem: idx + 1 };
      sorted[idx + 1] = { ...current, ordem: idx + 2 };
      marketplaceStore.banners = sorted;
      return NextResponse.json({
        message: 'Ordem de exibição atualizada.',
        banners: getSortedBanners(),
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
    const nextImagemUrl =
      typeof body.imagemUrl === 'string' && body.imagemUrl.trim()
        ? body.imagemUrl.trim()
        : current.imagemUrl;

    if (nextTitulo.length < 4) {
      return NextResponse.json(
        { error: 'O título do banner deve conter pelo menos 4 caracteres.' },
        { status: 400 }
      );
    }

    if (!isValidImageUrl(nextImagemUrl)) {
      return NextResponse.json(
        { error: 'URL ou arquivo de imagem inválido para o banner.' },
        { status: 400 }
      );
    }

    if (!isValidCtaHref(nextCtaHref)) {
      return NextResponse.json(
        { error: 'O link de destino do CTA deve iniciar com "/".' },
        { status: 400 }
      );
    }

    const updated: HomeBanner = {
      ...current,
      titulo: nextTitulo,
      subtitulo: nextSubtitulo,
      eyebrow: nextEyebrow || current.eyebrow,
      ctaLabel: nextCtaLabel || current.ctaLabel,
      ctaHref: nextCtaHref,
      imagemUrl: nextImagemUrl,
      ativo: typeof body.ativo === 'boolean' ? body.ativo : current.ativo,
      intervaloSegundos:
        body.intervaloSegundos !== undefined
          ? Math.min(30, Math.max(3, Number(body.intervaloSegundos) || 6))
          : current.intervaloSegundos,
    };

    marketplaceStore.banners = sorted.map((b) => (b.id === id ? updated : b));

    return NextResponse.json({
      message: 'Banner atualizado com sucesso.',
      banner: updated,
      banners: getSortedBanners(),
    });
  } catch (err) {
    console.error('Erro ao atualizar banner:', err);
    return NextResponse.json({ error: 'Erro interno ao atualizar banner.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Parâmetro obrigatório: id.' }, { status: 400 });
  }

  const exists = marketplaceStore.banners.some((b) => b.id === id);
  if (!exists) {
    return NextResponse.json({ error: 'Banner não encontrado.' }, { status: 404 });
  }

  marketplaceStore.banners = marketplaceStore.banners.filter((b) => b.id !== id);
  normalizeOrders();

  return NextResponse.json({
    message: 'Banner removido da rotação.',
    banners: getSortedBanners(),
  });
}
