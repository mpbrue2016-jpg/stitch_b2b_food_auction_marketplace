'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowDown,
  ArrowUp,
  Edit3,
  ExternalLink,
  ImagePlus,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import { HomeBanner } from '@/lib/types';

const PRESET_BANNER_MODELS = [
  {
    label: 'Modelo 1 · Pequenos Mercados (Estoque Parado)',
    url: '/images/banners/banner-pequenos-mercados.jpg',
  },
  {
    label: 'Modelo 2 · Centro de Distribuição & Paletes',
    url: '/images/banners/banner-atacado-pallets.jpg',
  },
  {
    label: 'Modelo 3 · Alimentos, Cafés & Óleos',
    url: '/images/banners/banner-safra-alimentos.jpg',
  },
  {
    label: 'Modelo 4 · Docas & Logística FOB',
    url: '/images/banners/banner-logistica-docas.jpg',
  },
];

const CTA_ROUTE_PRESETS = [
  { label: 'Leilões ao Vivo (/leiloes)', value: '/leiloes' },
  { label: 'Pregões · Cerealista & Grãos', value: '/leiloes?categoria=cerealista' },
  { label: 'Pregões · Hortifruti & Frescos', value: '/leiloes?categoria=hortifruti' },
  { label: 'Pregões · Higiene e Limpeza', value: '/leiloes?categoria=higiene-limpeza' },
  { label: 'Catálogo de Lotes (/catalogo)', value: '/catalogo' },
  { label: 'Liquidar Estoque · Pequeno Mercado', value: '/produtos/novo?modelo=pequeno_mercado' },
  { label: 'Anunciar Novo Lote (/produtos/novo)', value: '/produtos/novo' },
  { label: 'Mesa de Negociações (/negociacoes)', value: '/negociacoes' },
  { label: 'Cadastro B2B (/cadastro)', value: '/cadastro' },
];

interface BannerFormState {
  eyebrow: string;
  titulo: string;
  subtitulo: string;
  ctaLabel: string;
  ctaHref: string;
  imagemUrl: string;
  intervaloSegundos: number;
  ativo: boolean;
}

const EMPTY_FORM: BannerFormState = {
  eyebrow: 'Pequenos Mercados & Minimercados · Estoque Parado',
  titulo: '',
  subtitulo: '',
  ctaLabel: 'Liquidar Meu Estoque',
  ctaHref: '/produtos/novo',
  imagemUrl: '/images/banners/banner-pequenos-mercados.jpg',
  intervaloSegundos: 6,
  ativo: true,
};

async function resizeFileTo16x9Webp(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = new window.Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Falha ao ler imagem'));
      img.src = objectUrl;
    });

    const targetWidth = 1280;
    const targetHeight = 720;
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas indisponível');

    const imgRatio = img.naturalWidth / Math.max(1, img.naturalHeight);
    const targetRatio = targetWidth / targetHeight;
    let sx = 0;
    let sy = 0;
    let sw = img.naturalWidth;
    let sh = img.naturalHeight;

    if (imgRatio > targetRatio) {
      sw = img.naturalHeight * targetRatio;
      sx = (img.naturalWidth - sw) / 2;
    } else {
      sh = img.naturalWidth / targetRatio;
      sy = (img.naturalHeight - sh) / 2;
    }

    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);
    return canvas.toDataURL('image/webp', 0.86);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export const AdminBannerManager: React.FC = () => {
  const [banners, setBanners] = useState<HomeBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BannerFormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadBanners = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/banners', { cache: 'no-store' });
      const data = res.ok ? await res.json() : null;
      if (Array.isArray(data?.banners)) {
        setBanners(data.banners);
      }
    } catch {
      setErrorMsg('Não foi possível carregar a lista de banners.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBanners();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrorMsg(null);
  };

  const handleEditClick = (banner: HomeBanner) => {
    setEditingId(banner.id);
    setForm({
      eyebrow: banner.eyebrow,
      titulo: banner.titulo,
      subtitulo: banner.subtitulo,
      ctaLabel: banner.ctaLabel,
      ctaHref: banner.ctaHref,
      imagemUrl: banner.imagemUrl,
      intervaloSegundos: banner.intervaloSegundos,
      ativo: banner.ativo,
    });
    setNotice(null);
    setErrorMsg(null);
  };

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    try {
      const dataUrl = await resizeFileTo16x9Webp(file);
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bucket: 'banners',
          dataUrl,
          fileName: file.name.replace(/\.[^.]+$/, '') + '.webp',
        }),
      });
      const uploadData = await uploadRes.json().catch(() => null);
      if (uploadRes.ok && uploadData?.url) {
        setForm((prev) => ({ ...prev, imagemUrl: uploadData.url }));
      } else {
        setErrorMsg(uploadData?.error || 'Não foi possível enviar a imagem para o Storage.');
      }
    } catch {
      setErrorMsg('Formato de imagem inválido. Utilize JPG, PNG ou WEBP.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setNotice(null);
    setSubmitting(true);

    try {
      const isEdit = Boolean(editingId);
      const res = await fetch('/api/banners', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEdit ? { id: editingId, ...form } : form),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data?.error || 'Falha ao salvar o banner.');
        setSubmitting(false);
        return;
      }

      if (Array.isArray(data?.banners)) {
        setBanners(data.banners);
      }
      setNotice(
        isEdit
          ? 'Banner atualizado na série rotativa da Home.'
          : 'Novo banner publicado na série rotativa da Home.'
      );
      resetForm();
    } catch {
      setErrorMsg('Erro de conexão ao salvar o banner.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (banner: HomeBanner) => {
    setErrorMsg(null);
    try {
      const res = await fetch('/api/banners', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: banner.id, ativo: !banner.ativo }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data?.banners)) {
        setBanners(data.banners);
        setNotice(
          `Banner "${banner.titulo}" ${!banner.ativo ? 'ativado' : 'pausado'} na Home.`
        );
      } else {
        setErrorMsg(data?.error || 'Não foi possível alterar a visibilidade do banner.');
      }
    } catch {
      setErrorMsg('Falha ao alterar visibilidade do banner.');
    }
  };

  const handleMove = async (id: string, direction: 'move_up' | 'move_down') => {
    setErrorMsg(null);
    try {
      const res = await fetch('/api/banners', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: direction }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data?.banners)) {
        setBanners(data.banners);
      } else {
        setErrorMsg(data?.error || 'Não foi possível reordenar o banner.');
      }
    } catch {
      setErrorMsg('Falha ao reordenar banners.');
    }
  };

  const handleDelete = async (id: string) => {
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/banners?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data?.banners)) {
        setBanners(data.banners);
        setConfirmDeleteId(null);
        if (editingId === id) resetForm();
        setNotice('Banner removido da série rotativa.');
      } else {
        setErrorMsg(data?.error || 'Não foi possível excluir o banner.');
      }
    } catch {
      setErrorMsg('Falha ao excluir banner.');
    }
  };

  const handleRestoreDefaults = async () => {
    setErrorMsg(null);
    try {
      const res = await fetch('/api/banners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore_defaults' }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data?.banners)) {
        setBanners(data.banners);
        resetForm();
        setNotice('Série de banners modelo restaurada na Home.');
      } else {
        setErrorMsg(data?.error || 'Não foi possível restaurar os banners modelo.');
      }
    } catch {
      setErrorMsg('Falha ao restaurar os banners modelo.');
    }
  };

  const activeCount = banners.filter((b) => b.ativo).length;

  return (
    <section
      id="gestao-banners"
      className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 shadow-sm space-y-6 text-xs"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-container pb-4">
        <div>
          <span className="text-[10px] uppercase font-bold text-primary tracking-wider block">
            Vitrine Editorial da Página Inicial
          </span>
          <h2 className="font-extrabold text-base sm:text-lg text-on-surface flex items-center gap-2">
            <ImagePlus className="w-5 h-5 text-primary" />
            <span>Gestão de Banners Rotativos da Home</span>
          </h2>
          <p className="text-on-surface-variant mt-0.5">
            Adicione, ordene, ative ou substitua a série de banners responsivos exibidos no topo da Home ({activeCount}{' '}
            {activeCount === 1 ? 'ativo' : 'ativos'} de {banners.length}).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleRestoreDefaults}
            className="px-3.5 py-2 rounded-xl border border-outline-variant/50 hover:bg-surface-container text-on-surface font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restaurar Modelos</span>
          </button>
          <Link
            href="/"
            className="px-3.5 py-2 rounded-xl bg-primary hover:bg-primary-container text-white font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <span>Visualizar na Home</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {notice && (
        <div className="p-3 bg-secondary-container/30 border border-secondary text-secondary font-bold rounded-xl flex items-center justify-between gap-2">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="underline text-[11px]">
            Fechar
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-error-container text-on-error-container font-bold rounded-xl flex items-center justify-between gap-2">
          <span>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg(null)} className="underline text-[11px]">
            Fechar
          </button>
        </div>
      )}

      {activeCount === 0 && !loading && (
        <div className="p-3 bg-tertiary-fixed/40 border border-tertiary/30 text-on-tertiary-fixed font-semibold rounded-xl">
          Nenhum banner está ativo no momento. O carrossel ficará oculto na Home até que pelo menos 1 banner seja ativado ou restaurado.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Banner Queue List */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-sm text-on-surface">
              Série de Banners Cadastrados
            </h3>
            <span className="text-[11px] text-on-surface-variant font-mono tabular-nums">
              Ordem de exibição (1 → {banners.length})
            </span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-on-surface-variant bg-surface-container-low rounded-xl">
              Carregando série de banners...
            </div>
          ) : banners.length === 0 ? (
            <div className="p-8 text-center bg-surface-container-low rounded-xl space-y-2 border border-surface-container">
              <p className="font-bold text-on-surface">Nenhum banner cadastrado.</p>
              <p className="text-on-surface-variant">
                Use o formulário ao lado para publicar um banner ou clique em &ldquo;Restaurar Modelos&rdquo;.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {banners.map((banner, idx) => (
                <div
                  key={banner.id}
                  className={`p-3.5 rounded-xl border transition-colors flex flex-col sm:flex-row gap-3.5 items-start sm:items-center ${
                    editingId === banner.id
                      ? 'border-primary bg-primary-fixed/15'
                      : 'border-outline-variant/30 bg-surface-container-low/60'
                  }`}
                >
                  {/* Thumbnail 16:9 */}
                  <div className="relative w-full sm:w-36 aspect-[16/9] rounded-lg overflow-hidden bg-slate-900 shrink-0">
                    <Image
                      src={banner.imagemUrl}
                      alt={banner.titulo}
                      fill
                      sizes="(max-width: 640px) 100vw, 144px"
                      referrerPolicy="no-referrer"
                      className="object-cover"
                    />
                    <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/75 text-white font-mono text-[10px] tabular-nums font-bold">
                      #{String(banner.ordem).padStart(2, '0')}
                    </span>
                  </div>

                  {/* Metadata */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-on-surface-variant">
                      <span
                        className={`font-bold ${
                          banner.ativo ? 'text-secondary' : 'text-error'
                        }`}
                      >
                        {banner.ativo ? 'Ativo na Home' : 'Inativo'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{banner.intervaloSegundos}s</span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{banner.ctaHref}</span>
                    </div>
                    <h4 className="font-extrabold text-sm text-on-surface truncate">
                      {banner.titulo}
                    </h4>
                    <p className="text-[11px] text-on-surface-variant line-clamp-1">
                      {banner.subtitulo || banner.eyebrow}
                    </p>
                  </div>

                  {/* Controls */}
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 self-end sm:self-center shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMove(banner.id, 'move_up')}
                      title="Mover para cima"
                      aria-label={`Mover banner ${banner.titulo} para cima`}
                      className="w-8 h-8 rounded-lg border border-outline-variant/40 bg-white hover:bg-surface-container flex items-center justify-center disabled:opacity-35"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === banners.length - 1}
                      onClick={() => handleMove(banner.id, 'move_down')}
                      title="Mover para baixo"
                      aria-label={`Mover banner ${banner.titulo} para baixo`}
                      className="w-8 h-8 rounded-lg border border-outline-variant/40 bg-white hover:bg-surface-container flex items-center justify-center disabled:opacity-35"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(banner)}
                      className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] transition-colors whitespace-nowrap ${
                        banner.ativo
                          ? 'bg-secondary-container/40 text-secondary hover:bg-secondary-container'
                          : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                      }`}
                    >
                      {banner.ativo ? 'Desativar' : 'Ativar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEditClick(banner)}
                      className="p-2 rounded-lg border border-outline-variant/40 bg-white hover:bg-surface-container text-primary"
                      title="Editar banner"
                      aria-label={`Editar banner ${banner.titulo}`}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    {confirmDeleteId === banner.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDelete(banner.id)}
                          className="px-2 py-1 rounded bg-error text-white font-bold text-[10px]"
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1 rounded bg-surface-container text-on-surface font-bold text-[10px]"
                        >
                          Não
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(banner.id)}
                        className="p-2 rounded-lg border border-outline-variant/40 bg-white hover:bg-error-container text-error"
                        title="Excluir banner"
                        aria-label={`Excluir banner ${banner.titulo}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Create / Edit Banner Form & Live Preview */}
        <form
          onSubmit={handleSaveBanner}
          className="lg:col-span-5 p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30 space-y-3.5"
        >
          <div className="flex items-center justify-between border-b border-surface-container pb-2">
            <h3 className="font-extrabold text-sm text-on-surface flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-primary" />
              <span>{editingId ? 'Editar Banner Selecionado' : 'Adicionar Novo Banner'}</span>
            </h3>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-[11px] font-bold text-primary hover:underline"
              >
                Cancelar edição
              </button>
            )}
          </div>

          {/* Mini Live Responsive Preview */}
          <div className="relative aspect-[16/9] w-full rounded-xl overflow-hidden bg-slate-900 border border-outline-variant/30">
            <Image
              src={form.imagemUrl || '/images/banners/banner-atacado-pallets.jpg'}
              alt={form.titulo || 'Pré-visualização do banner'}
              fill
              sizes="(max-width: 1024px) 100vw, 480px"
              referrerPolicy="no-referrer"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/15 p-4 flex flex-col justify-end">
              <span className="text-[10px] font-semibold text-white/85 truncate">
                {form.eyebrow || 'Texto superior'}
              </span>
              <strong className="text-sm font-extrabold text-white leading-tight line-clamp-2">
                {form.titulo || 'Título da campanha na Home'}
              </strong>
              <span className="mt-2 inline-block self-start px-2.5 py-1 rounded-lg bg-secondary text-white text-[10px] font-bold">
                {form.ctaLabel || 'Ver Ofertas'}
              </span>
            </div>
          </div>

          {/* Preset Images + Upload */}
          <div className="space-y-1.5">
            <label className="block font-bold text-on-surface">Imagem do Banner (16:9 Responsivo)</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {PRESET_BANNER_MODELS.map((preset) => (
                <button
                  key={preset.url}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, imagemUrl: preset.url }))}
                  className={`relative aspect-[16/9] rounded-lg overflow-hidden border-2 transition-all ${
                    form.imagemUrl === preset.url
                      ? 'border-primary ring-2 ring-primary/20'
                      : 'border-outline-variant/40 opacity-80 hover:opacity-100'
                  }`}
                  title={preset.label}
                >
                  <Image
                    src={preset.url}
                    alt={preset.label}
                    fill
                    sizes="120px"
                    className="object-cover"
                  />
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleImageFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-surface-container border border-outline-variant/50 font-bold text-[11px] text-primary flex items-center gap-1.5 shrink-0"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Enviar Imagem</span>
              </button>
              <input
                type="text"
                value={form.imagemUrl.startsWith('data:') ? 'Imagem enviada localmente (16:9 WebP)' : form.imagemUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, imagemUrl: e.target.value }))}
                readOnly={form.imagemUrl.startsWith('data:')}
                placeholder="/images/banners/banner-atacado-pallets.jpg"
                className="flex-1 bg-white px-2.5 py-1.5 rounded-lg border border-outline-variant/40 text-[11px] font-mono min-w-0"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-on-surface mb-1">Texto Superior (Eyebrow)</label>
            <input
              type="text"
              value={form.eyebrow}
              onChange={(e) => setForm((prev) => ({ ...prev, eyebrow: e.target.value }))}
              placeholder="Ex: Rodada Industrial SP · Custódia Escrow"
              className="w-full bg-white px-3 py-2 rounded-xl border border-outline-variant/40"
              required
            />
          </div>

          <div>
            <label className="block font-bold text-on-surface mb-1">Título Principal *</label>
            <input
              type="text"
              value={form.titulo}
              onChange={(e) => setForm((prev) => ({ ...prev, titulo: e.target.value }))}
              placeholder="Ex: Lotes de Laticínios e Café com até 60% OFF"
              minLength={4}
              maxLength={120}
              className="w-full bg-white px-3 py-2 rounded-xl border border-outline-variant/40 font-bold"
              required
            />
          </div>

          <div>
            <label className="block font-bold text-on-surface mb-1">Subtítulo / Descrição</label>
            <textarea
              rows={2}
              value={form.subtitulo}
              onChange={(e) => setForm((prev) => ({ ...prev, subtitulo: e.target.value }))}
              placeholder="Descrição objetiva da oportunidade B2B..."
              maxLength={220}
              className="w-full bg-white px-3 py-2 rounded-xl border border-outline-variant/40"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block font-bold text-on-surface mb-1">Texto do Botão (CTA)</label>
              <input
                type="text"
                value={form.ctaLabel}
                onChange={(e) => setForm((prev) => ({ ...prev, ctaLabel: e.target.value }))}
                placeholder="Explorar Lotes"
                maxLength={40}
                className="w-full bg-white px-3 py-2 rounded-xl border border-outline-variant/40 font-bold"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-on-surface mb-1">Rota de Destino</label>
              <select
                value={
                  CTA_ROUTE_PRESETS.some((r) => r.value === form.ctaHref) ? form.ctaHref : 'custom'
                }
                onChange={(e) => {
                  if (e.target.value !== 'custom') {
                    setForm((prev) => ({ ...prev, ctaHref: e.target.value }));
                  }
                }}
                className="w-full bg-white px-3 py-2 rounded-xl border border-outline-variant/40 cursor-pointer"
              >
                {CTA_ROUTE_PRESETS.map((route) => (
                  <option key={route.value} value={route.value}>
                    {route.label}
                  </option>
                ))}
                <option value="custom">Outra rota interna (/...)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 items-end">
            <div>
              <label className="block font-bold text-on-surface mb-1">Caminho do Link</label>
              <input
                type="text"
                value={form.ctaHref}
                onChange={(e) => setForm((prev) => ({ ...prev, ctaHref: e.target.value }))}
                placeholder="/catalogo"
                className="w-full bg-white px-3 py-2 rounded-xl border border-outline-variant/40 font-mono"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-on-surface mb-1">Rotação (segundos)</label>
              <input
                type="number"
                min={3}
                max={30}
                value={form.intervaloSegundos}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    intervaloSegundos: Math.min(30, Math.max(3, Number(e.target.value) || 6)),
                  }))
                }
                className="w-full bg-white px-3 py-2 rounded-xl border border-outline-variant/40 font-mono tabular-nums"
                required
              />
            </div>
          </div>

          <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => setForm((prev) => ({ ...prev, ativo: e.target.checked }))}
              className="w-4 h-4 rounded border-outline-variant accent-primary"
            />
            <span className="font-bold text-on-surface">Exibir imediatamente na Home</span>
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 rounded-xl bg-primary hover:bg-primary-container text-white font-extrabold text-xs shadow-sm transition-colors disabled:opacity-50"
          >
            {submitting
              ? 'Salvando Banner...'
              : editingId
              ? 'Salvar Alterações no Banner'
              : 'Publicar Banner na Home'}
          </button>
        </form>
      </div>
    </section>
  );
};
