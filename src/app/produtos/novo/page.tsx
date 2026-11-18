'use client';

import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  Factory,
  ImagePlus,
  Sparkles,
  Store,
  Upload,
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { ProductCategory } from '@/lib/types';

type LotPresetType = 'industria' | 'pequeno_mercado' | 'cerealista' | 'hortifruti' | 'higiene_limpeza';

const LOT_IMAGE_PRESETS = [
  { label: 'Mercado & Estoque Parado', url: '/images/banners/banner-pequenos-mercados.jpg' },
  { label: 'Cerealista & Grãos (Sacaria)', url: '/images/lotes/lote-cerealista-feijao.jpg' },
  { label: 'Hortifruti CEASA (Caixas)', url: '/images/lotes/lote-hortifruti-caixas.jpg' },
  { label: 'Higiene e Limpeza (Combo)', url: '/images/lotes/lote-higiene-limpeza.jpg' },
  { label: 'Arroz & Grãos (Fardos)', url: '/images/lotes/lote-arroz-5kg.webp' },
  { label: 'Cafés & Mercearia Seca', url: '/images/lotes/lote-418-cafe.webp' },
  { label: 'Óleos & Condimentos', url: '/images/lotes/lote-8492-oleo.webp' },
  { label: 'Detergentes & Conservação', url: '/images/lotes/lote-detergente-500ml.webp' },
];

async function resizeFileTo4x3WebpBlob(file: File): Promise<Blob> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = new window.Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Falha ao ler imagem'));
      img.src = objectUrl;
    });

    const targetWidth = 800;
    const targetHeight = 600;
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
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((result) => resolve(result), 'image/webp', 0.85)
    );
    if (!blob) throw new Error('Falha ao codificar imagem WebP');
    return blob;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function NovoProdutoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modeloParam = searchParams.get('modelo');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { user, profile, loading: authLoading } = useAuth();

  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [presetMode, setPresetMode] = useState<LotPresetType>(
    modeloParam === 'pequeno_mercado' ? 'pequeno_mercado' : 'industria'
  );
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [aiDescError, setAiDescError] = useState<string | null>(null);
  const [createdLotCode, setCreatedLotCode] = useState<string | null>(null);

  // Form states
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [generatingDesc, setGeneratingDesc] = useState(false);
  const [marca, setMarca] = useState('');
  const [fabricante, setFabricante] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [gtinEan, setGtinEan] = useState('');
  const [dun14, setDun14] = useState('');
  const [origem, setOrigem] = useState('CD Jundiaí - SP');
  const [unidadesPorEmbalagem, setUnidadesPorEmbalagem] = useState(20);
  const [totalCaixas, setTotalCaixas] = useState(100);
  const [paletes, setPaletes] = useState(4);
  const [dataValidade, setDataValidade] = useState('2026-12-31');
  const [lanceInicial, setLanceInicial] = useState(25000);
  const [incrementoMinimo, setIncrementoMinimo] = useState(500);
  const [precoArremate, setPrecoArremate] = useState(32000);
  const [tipoVenda, setTipoVenda] = useState<'leilao' | 'venda_direta' | 'giro_rapido'>('leilao');
  const [tipoFrete, setTipoFrete] = useState<'FOB' | 'CIF'>('FOB');
  const [laudoAnvisa, setLaudoAnvisa] = useState(true);
  const [imagemUrl, setImagemUrl] = useState('/images/lotes/lote-arroz-5kg.webp');

  const resolveCategoryBySlug = useCallback(
    (slug: string, list: ProductCategory[] = categories) =>
      list.find((c) => c.slug === slug)?.id || list[0]?.id || slug,
    [categories]
  );

  useEffect(() => {
    fetch('/api/categorias', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data?.categories) && data.categories.length > 0) {
          const cats: ProductCategory[] = data.categories;
          setCategories(cats);
          setCategoriaId((prev) => {
            if (cats.some((c) => c.id === prev)) return prev;
            const bySlug = cats.find((c) => c.slug === prev);
            return bySlug ? bySlug.id : cats[0].id;
          });
        }
      })
      .catch(() => {});
  }, []);

  const applyPreset = useCallback(
    (mode: LotPresetType) => {
      setPresetMode(mode);
      setSubmitError(null);
      if (mode === 'pequeno_mercado') {
        setTitulo('Sobra de Estoque · Café Torrado e Moído 500g (25 Caixas Fechadas)');
        setMarca('Pilão / Três Corações');
        setFabricante('Minimercado Central Bairro (Liquidação)');
        setCategoriaId(resolveCategoryBySlug('alimentos-secos'));
        setGtinEan('7896089011358');
        setDun14('17896089011355');
        setOrigem('Depósito Local · Zona Leste - SP');
        setUnidadesPorEmbalagem(12);
        setTotalCaixas(25);
        setPaletes(1);
        setDataValidade('2027-02-28');
        setLanceInicial(1800);
        setIncrementoMinimo(100);
        setPrecoArremate(2400);
        setTipoVenda('giro_rapido');
        setTipoFrete('FOB');
        setLaudoAnvisa(true);
        setImagemUrl('/images/banners/banner-pequenos-mercados.jpg');
        setDescricao(
          'Lote excedente de loja física em caixas lacradas de fábrica, armazenadas em depósito seco e ventilado. Ideal para mercados de bairro e mercearias com retirada rápida no local e nota fiscal garantida.'
        );
      } else if (mode === 'cerealista') {
        setTitulo('Feijão Carioca Tipo 1 Extra · 200 Fardos (6.000 kg)');
        setMarca('Cerealista Sul / Kicaldo');
        setFabricante('Beneficiadora Cerealista Sul Ltda');
        setCategoriaId(resolveCategoryBySlug('cerealista'));
        setGtinEan('7896292001014');
        setDun14('17896292001011');
        setOrigem('Armazém Cerealista Campinas - SP');
        setUnidadesPorEmbalagem(30);
        setTotalCaixas(200);
        setPaletes(5);
        setDataValidade('2027-05-25');
        setLanceInicial(22000);
        setIncrementoMinimo(400);
        setPrecoArremate(29500);
        setTipoVenda('leilao');
        setTipoFrete('FOB');
        setLaudoAnvisa(true);
        setImagemUrl('/images/lotes/lote-cerealista-feijao.jpg');
        setDescricao(
          'Lote cerealista safra nova em fardos de 30x1kg sobre paletes PBR. Umidade controlada e classificação Tipo 1 oficial para atacado e redes supermercadistas.'
        );
      } else if (mode === 'hortifruti') {
        setTitulo('Hortifruti CEAGESP Mix · Tomate, Cebola & Batata (120 Caixas 20kg)');
        setMarca('AgroVale Hortifruti');
        setFabricante('Cooperativa Agrícola Vale Verde');
        setCategoriaId(resolveCategoryBySlug('hortifruti'));
        setGtinEan('7898990021048');
        setDun14('17898990021045');
        setOrigem('CEAGESP Vila Leopoldina - SP (Box 14)');
        setUnidadesPorEmbalagem(20);
        setTotalCaixas(120);
        setPaletes(2);
        setDataValidade('2026-12-03');
        setLanceInicial(5800);
        setIncrementoMinimo(200);
        setPrecoArremate(7900);
        setTipoVenda('giro_rapido');
        setTipoFrete('FOB');
        setLaudoAnvisa(true);
        setImagemUrl('/images/lotes/lote-hortifruti-caixas.jpg');
        setDescricao(
          'Caixas plásticas higienizadas de 20kg com colheita selecionada do dia. Retirada imediata em doca refrigerada para sacolões, hortifrutis e supermercados.'
        );
      } else if (mode === 'higiene_limpeza') {
        setTitulo('Combo Higiene e Limpeza · Sabão em Pó, Desinfetante & Papel (200 Fardos)');
        setMarca('LimpMais / Ypê');
        setFabricante('Distribuidora LimpMais Brasil Ltda');
        setCategoriaId(resolveCategoryBySlug('higiene-limpeza'));
        setGtinEan('7891150054127');
        setDun14('17891150054124');
        setOrigem('CD Osasco - SP (Galpão Higiene)');
        setUnidadesPorEmbalagem(12);
        setTotalCaixas(200);
        setPaletes(4);
        setDataValidade('2028-05-10');
        setLanceInicial(16400);
        setIncrementoMinimo(300);
        setPrecoArremate(21900);
        setTipoVenda('leilao');
        setTipoFrete('FOB');
        setLaudoAnvisa(true);
        setImagemUrl('/images/lotes/lote-higiene-limpeza.jpg');
        setDescricao(
          'Carga fechada de produtos de higiene e limpeza com embalagens originais termoencolhidas. Alta margem de revenda para varejo alimentar e perfumarias.'
        );
      } else {
        setTitulo('');
        setMarca('');
        setFabricante('');
        setCategoriaId(categories[0]?.id || 'alimentos-secos');
        setGtinEan('');
        setDun14('');
        setOrigem('CD Jundiaí - SP');
        setUnidadesPorEmbalagem(20);
        setTotalCaixas(100);
        setPaletes(4);
        setDataValidade('2026-12-31');
        setLanceInicial(25000);
        setIncrementoMinimo(500);
        setPrecoArremate(32000);
        setTipoVenda('leilao');
        setTipoFrete('FOB');
        setLaudoAnvisa(true);
        setImagemUrl('/images/lotes/lote-arroz-5kg.webp');
        setDescricao('');
      }
    },
    [categories, resolveCategoryBySlug]
  );

  useEffect(() => {
    if (
      modeloParam === 'pequeno_mercado' ||
      modeloParam === 'cerealista' ||
      modeloParam === 'hortifruti' ||
      modeloParam === 'higiene_limpeza'
    ) {
      applyPreset(modeloParam);
    }
  }, [modeloParam, applyPreset]);

  useEffect(() => {
    if (profile && !fabricante) {
      setFabricante(profile.razaoSocial || profile.nomeFantasia || '');
    }
  }, [profile, fabricante]);

  const totalUnidades = Math.max(0, unidadesPorEmbalagem) * Math.max(0, totalCaixas);
  const precoUnitarioEstimado = totalUnidades > 0 ? (lanceInicial / totalUnidades).toFixed(2) : '0.00';

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageError(null);
    setUploadingImage(true);
    try {
      const webpBlob = await resizeFileTo4x3WebpBlob(file);
      const formData = new FormData();
      formData.append('bucket', 'lot-images');
      formData.append(
        'file',
        new File([webpBlob], `lote-${Date.now()}.webp`, { type: 'image/webp' })
      );

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.url) {
        setImageError(data?.error || 'Não foi possível enviar a foto para o Storage.');
        return;
      }
      setImagemUrl(data.url);
    } catch {
      setImageError('Não foi possível processar a imagem. Use PNG, JPG ou WEBP.');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleGenerateDescription = async () => {
    if (!titulo.trim()) return;
    setGeneratingDesc(true);
    setAiDescError(null);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'description',
          productName: titulo,
          brand: marca || 'Linha Comercial',
          packaging: `${totalCaixas} caixas (${paletes} paletes), validade ${dataValidade}, frete ${tipoFrete} em ${origem}`,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.reply) {
        setAiDescError(
          data?.error || 'Serviço de IA indisponível no momento. Redija a descrição manualmente.'
        );
        return;
      }
      setDescricao(data.reply);
    } catch {
      setAiDescError('Falha de comunicação com o serviço de IA.');
    } finally {
      setGeneratingDesc(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!user) {
      setSubmitError('Faça login com uma conta fornecedora ou administrativa para publicar lotes.');
      return;
    }

    if (lanceInicial < 100) {
      setSubmitError('O lance inicial deve ser de no mínimo R$ 100,00.');
      return;
    }
    if (incrementoMinimo < 50) {
      setSubmitError('O incremento mínimo deve ser de no mínimo R$ 50,00.');
      return;
    }
    if (precoArremate > 0 && precoArremate <= lanceInicial) {
      setSubmitError('O preço de arremate imediato deve ser superior ao lance inicial (ou deixe 0 para desativar).');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/lotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
          precoArremateImediato: precoArremate > 0 ? precoArremate : undefined,
          tipoVenda,
          tipoFrete,
          laudoSanitarioAnvisa: laudoAnvisa,
          imagemUrl,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setSubmitError(data?.error || 'Erro ao publicar lote no marketplace.');
        setSubmitting(false);
        return;
      }

      setCreatedLotCode(data?.lot?.codigoLote || null);
      setSubmitting(false);
      setSuccess(true);
      setTimeout(() => {
        router.push('/leiloes');
      }, 1500);
    } catch {
      setSubmitError('Falha de comunicação ao cadastrar o lote. Tente novamente.');
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Breadcrumb */}
      <nav className="text-xs text-on-surface-variant flex items-center gap-1.5">
        <Link href="/" className="hover:text-primary">Início</Link>
        <span>/</span>
        <Link href="/painel/fornecedor" className="hover:text-primary">Painel do Vendedor</Link>
        <span>/</span>
        <span className="font-bold text-primary">Cadastro de Produtos &amp; Liquidação de Estoque</span>
      </nav>

      {/* Title */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface">
          Publicar Lote ou Liquidar Estoque Parado
        </h1>
        <p className="text-xs sm:text-sm text-on-surface-variant">
          Para indústrias, distribuidores e pequenos mercados: cadastre lotes fechados ou pontas de estoque com validação GS1 e custódia Escrow.
        </p>
      </div>

      {!authLoading && (!user || profile?.role === 'comprador') && (
        <div className="p-4 rounded-2xl bg-primary-fixed/40 border border-primary/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <span className="font-bold text-on-surface">
            {!user
              ? 'Entre com uma conta Fornecedor ou Admin para publicar lotes reais no Supabase.'
              : 'Seu perfil atual é Comprador. Apenas contas Fornecedor ou Admin publicam lotes.'}
          </span>
          {!user && (
            <Link
              href="/login?redirect=/produtos/novo"
              className="px-4 py-2 bg-primary text-white font-bold rounded-xl shrink-0 text-center"
            >
              Entrar como Fornecedor
            </Link>
          )}
        </div>
      )}

      {/* Quick Preset Switcher */}
      {!success && (
        <div className="space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => applyPreset('pequeno_mercado')}
              className={`text-left p-4 rounded-2xl border transition-all flex items-start gap-3 ${
                presetMode === 'pequeno_mercado'
                  ? 'bg-secondary-container/20 border-secondary shadow-sm ring-1 ring-secondary/30'
                  : 'bg-surface-container-lowest border-outline-variant/30 hover:border-secondary/50'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-secondary text-white flex items-center justify-center shrink-0">
                <Store className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <span className="text-xs font-extrabold text-on-surface block">
                  Modelo: Pequeno Mercado (Estoque Parado)
                </span>
                <span className="text-[11px] text-on-surface-variant block leading-snug">
                  Ideal para fardos encalhados ou sobras de compra (a partir de R$ 100 e 1 palete / poucas caixas).
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => applyPreset('industria')}
              className={`text-left p-4 rounded-2xl border transition-all flex items-start gap-3 ${
                presetMode === 'industria'
                  ? 'bg-primary-fixed/40 border-primary shadow-sm ring-1 ring-primary/30'
                  : 'bg-surface-container-lowest border-outline-variant/30 hover:border-primary/50'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shrink-0">
                <Factory className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <span className="text-xs font-extrabold text-on-surface block">
                  Modelo: Indústria / Atacado (Paletizado)
                </span>
                <span className="text-[11px] text-on-surface-variant block leading-snug">
                  Parametrização para cargas fechadas, múltiplos paletes PBR e pregão aberto no CD.
                </span>
              </div>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="font-bold text-on-surface-variant uppercase">Modelos por segmento:</span>
            <button
              type="button"
              onClick={() => applyPreset('cerealista')}
              className={`px-3 py-1.5 rounded-lg border font-bold transition-colors ${
                presetMode === 'cerealista'
                  ? 'bg-primary text-white border-primary'
                  : 'bg-surface-container-lowest border-outline-variant/30 text-on-surface hover:border-primary'
              }`}
            >
              Cerealista &amp; Grãos
            </button>
            <button
              type="button"
              onClick={() => applyPreset('hortifruti')}
              className={`px-3 py-1.5 rounded-lg border font-bold transition-colors ${
                presetMode === 'hortifruti'
                  ? 'bg-primary text-white border-primary'
                  : 'bg-surface-container-lowest border-outline-variant/30 text-on-surface hover:border-primary'
              }`}
            >
              Hortifruti &amp; CEASA
            </button>
            <button
              type="button"
              onClick={() => applyPreset('higiene_limpeza')}
              className={`px-3 py-1.5 rounded-lg border font-bold transition-colors ${
                presetMode === 'higiene_limpeza'
                  ? 'bg-primary text-white border-primary'
                  : 'bg-surface-container-lowest border-outline-variant/30 text-on-surface hover:border-primary'
              }`}
            >
              Higiene e Limpeza
            </button>
          </div>
        </div>
      )}

      {success ? (
        <div className="p-8 bg-secondary-container/20 rounded-2xl border border-secondary/30 text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 text-secondary mx-auto" />
          <h3 className="font-bold text-xl text-secondary">
            {createdLotCode ? `${createdLotCode} Cadastrado e Pregão Ativado!` : 'Lote Cadastrado e Pregão Ativado!'}
          </h3>
          <p className="text-xs text-on-surface-variant">
            O lote foi homologado e já está visível para os compradores cadastrados com custódia fiduciária garantida. Redirecionando...
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-surface-container-lowest p-6 sm:p-8 rounded-2xl border border-outline-variant/30 shadow-sm space-y-6 text-xs">
          {/* Seção 1: Dados do Produto & Barcodes */}
          <div className="space-y-4">
            <h3 className="text-sm font-extrabold text-primary uppercase tracking-wider flex items-center gap-1.5 border-b border-surface-container pb-2">
              <span className="material-symbols-outlined text-[18px]">inventory</span>
              1. Identificação do Produto &amp; Foto do Lote
            </h3>

            <div>
              <label className="block font-bold text-on-surface uppercase mb-1">Título Comercial do Lote:</label>
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex: Sobra de Estoque · Café 500g (25 Caixas) ou Arroz 5kg (1.500 Fardos)"
                className="w-full bg-surface-container-low px-3 py-2.5 rounded-xl border border-outline-variant/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            {/* Foto do Lote */}
            <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/20 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="font-bold text-on-surface uppercase flex items-center gap-1.5">
                  <ImagePlus className="w-4 h-4 text-primary" />
                  <span>Foto Real ou Modelo do Lote:</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={uploadingImage}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-surface-container border border-outline-variant/40 text-primary font-bold text-[11px] transition-colors disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingImage ? 'Enviando ao Storage...' : 'Enviar Foto do Depósito'}</span>
                  </button>
                </div>
              </div>

              {imageError && (
                <p className="text-[11px] font-bold text-error">{imageError}</p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                <div className="relative aspect-[4/3] w-full rounded-xl overflow-hidden border border-outline-variant/30 bg-surface-container">
                  <Image
                    src={imagemUrl}
                    alt={titulo || 'Prévia do lote'}
                    fill
                    sizes="(max-width: 640px) 100vw, 280px"
                    referrerPolicy="no-referrer"
                    className="object-cover"
                  />
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <span className="text-[11px] font-bold text-on-surface-variant block">
                    Ou selecione uma imagem rápida da categoria:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {LOT_IMAGE_PRESETS.map((preset) => (
                      <button
                        key={preset.url}
                        type="button"
                        onClick={() => {
                          setImagemUrl(preset.url);
                          setImageError(null);
                        }}
                        className={`p-1.5 rounded-lg border text-left transition-all ${
                          imagemUrl === preset.url
                            ? 'border-primary bg-primary-fixed/40 ring-1 ring-primary'
                            : 'border-outline-variant/30 bg-white hover:border-primary/50'
                        }`}
                      >
                        <div className="relative aspect-[4/3] w-full rounded overflow-hidden mb-1">
                          <Image
                            src={preset.url}
                            alt={preset.label}
                            fill
                            sizes="120px"
                            referrerPolicy="no-referrer"
                            className="object-cover"
                          />
                        </div>
                        <span className="text-[10px] font-bold text-on-surface line-clamp-1 block">
                          {preset.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-bold text-on-surface uppercase">Descrição Comercial / Técnica:</label>
                <button
                  type="button"
                  disabled={!titulo.trim() || generatingDesc}
                  onClick={handleGenerateDescription}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary-fixed/60 hover:bg-primary-fixed text-primary font-bold text-[11px] transition-colors disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{generatingDesc ? 'Redigindo com IA...' : 'Sugerir Descrição com IA'}</span>
                </button>
              </div>
              {aiDescError && (
                <p className="text-[11px] font-bold text-error mb-1">{aiDescError}</p>
              )}
              <textarea
                rows={3}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Condições de armazenagem, estado das caixas, embalagem e faturamento..."
                className="w-full bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/30 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-bold text-on-surface uppercase mb-1">Marca / Linha:</label>
                <input
                  type="text"
                  value={marca}
                  onChange={(e) => setMarca(e.target.value)}
                  placeholder="Ex: Camil, Pilão, Liza..."
                  className="w-full bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/30 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-on-surface uppercase mb-1">
                  {presetMode === 'pequeno_mercado' ? 'Mercado / Razão Social Vendedora:' : 'Indústria / Fabricante:'}
                </label>
                <input
                  type="text"
                  value={fabricante}
                  onChange={(e) => setFabricante(e.target.value)}
                  placeholder={presetMode === 'pequeno_mercado' ? 'Nome do Mercado ou CNPJ' : 'Razão Social ou Fábrica'}
                  className="w-full bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/30 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-on-surface uppercase mb-1">Categoria B2B:</label>
                <select
                  value={categoriaId}
                  onChange={(e) => setCategoriaId(e.target.value)}
                  className="w-full bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/30 text-xs cursor-pointer"
                  required
                >
                  {categories.length === 0 ? (
                    <option value="">Carregando categorias...</option>
                  ) : (
                    categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {/* GS1 Barcodes */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-surface-container-low rounded-xl border border-outline-variant/20">
              <div>
                <label className="block font-bold text-on-surface uppercase mb-1">GTIN / EAN-13 (Código de Barras):</label>
                <input
                  type="text"
                  value={gtinEan}
                  onChange={(e) => setGtinEan(e.target.value)}
                  placeholder="7890000000000"
                  className="w-full bg-white px-3 py-2 rounded-lg border border-outline-variant/40 font-mono text-xs"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-on-surface uppercase mb-1">DUN-14 (Caixa Coletiva - Opcional):</label>
                <input
                  type="text"
                  value={dun14}
                  onChange={(e) => setDun14(e.target.value)}
                  placeholder="17890000000007"
                  className="w-full bg-white px-3 py-2 rounded-lg border border-outline-variant/40 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-on-surface uppercase mb-1">Local de Retirada / Origem:</label>
                <input
                  type="text"
                  value={origem}
                  onChange={(e) => setOrigem(e.target.value)}
                  placeholder="Ex: Minimercado / CD Local - SP"
                  className="w-full bg-white px-3 py-2 rounded-lg border border-outline-variant/40 text-xs"
                  required
                />
              </div>
            </div>
          </div>

          {/* Seção 2: Embalagem & Volume */}
          <div className="space-y-4">
            <h3 className="text-sm font-extrabold text-primary uppercase tracking-wider flex items-center gap-1.5 border-b border-surface-container pb-2">
              <span className="material-symbols-outlined text-[18px]">package_2</span>
              2. Especificações de Embalagem e Volume
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block font-bold text-on-surface uppercase mb-1">Unidades por Caixa:</label>
                <input
                  type="number"
                  min="1"
                  value={unidadesPorEmbalagem}
                  onChange={(e) => setUnidadesPorEmbalagem(Number(e.target.value))}
                  className="w-full bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/30 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-on-surface uppercase mb-1">Total de Caixas / Fardos:</label>
                <input
                  type="number"
                  min="1"
                  value={totalCaixas}
                  onChange={(e) => setTotalCaixas(Number(e.target.value))}
                  className="w-full bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/30 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-on-surface uppercase mb-1">Paletes (ou Volumes):</label>
                <input
                  type="number"
                  min="1"
                  value={paletes}
                  onChange={(e) => setPaletes(Number(e.target.value))}
                  className="w-full bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/30 text-xs"
                  required
                />
              </div>

              <div className="bg-surface-container-low p-2 rounded-xl flex flex-col justify-center">
                <span className="text-[10px] text-on-surface-variant font-bold uppercase">Volume Total:</span>
                <span className="text-sm font-extrabold text-primary">
                  {totalUnidades.toLocaleString('pt-BR')} unidades
                </span>
              </div>
            </div>
          </div>

          {/* Seção 3: Shelf Life & Conformidade ANVISA */}
          <div className="space-y-4">
            <h3 className="text-sm font-extrabold text-primary uppercase tracking-wider flex items-center gap-1.5 border-b border-surface-container pb-2">
              <span className="material-symbols-outlined text-[18px]">verified</span>
              3. Shelf Life (Validade FEFO) e Compliance
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-on-surface uppercase mb-1">Data Limite de Validade:</label>
                <input
                  type="date"
                  value={dataValidade}
                  onChange={(e) => setDataValidade(e.target.value)}
                  className="w-full bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/30 text-xs"
                  required
                />
              </div>

              <div className="flex items-center gap-2 pt-4">
                <input
                  type="checkbox"
                  id="anvisa"
                  checked={laudoAnvisa}
                  onChange={(e) => setLaudoAnvisa(e.target.checked)}
                  className="w-4 h-4 text-primary rounded cursor-pointer"
                />
                <label htmlFor="anvisa" className="font-bold text-on-surface cursor-pointer">
                  Atesto embalagens íntegras, dentro da validade e conformidade sanitária ANVISA / MAPA.
                </label>
              </div>
            </div>
          </div>

          {/* Seção 4: Regras Comerciais & Pregão */}
          <div className="space-y-4">
            <h3 className="text-sm font-extrabold text-primary uppercase tracking-wider flex items-center gap-1.5 border-b border-surface-container pb-2">
              <span className="material-symbols-outlined text-[18px]">gavel</span>
              4. Parametrização Comercial do Pregão
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-bold text-on-surface uppercase mb-1">Modalidade de Venda:</label>
                <select
                  value={tipoVenda}
                  onChange={(e) => setTipoVenda(e.target.value as 'leilao' | 'venda_direta' | 'giro_rapido')}
                  className="w-full bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/30 text-xs cursor-pointer"
                >
                  <option value="leilao">Leilão Aberto (Pregão)</option>
                  <option value="giro_rapido">Giro Rápido FEFO (Liquidação)</option>
                  <option value="venda_direta">Venda Direta / Preço Fixo</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-on-surface uppercase mb-1">Tipo de Frete:</label>
                <select
                  value={tipoFrete}
                  onChange={(e) => setTipoFrete(e.target.value as 'FOB' | 'CIF')}
                  className="w-full bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/30 text-xs cursor-pointer"
                >
                  <option value="FOB">FOB (Comprador retira no local)</option>
                  <option value="CIF">CIF (Vendedor entrega no destino)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-on-surface uppercase mb-1">Lance Inicial (R$):</label>
                <input
                  type="number"
                  min="100"
                  step="10"
                  value={lanceInicial}
                  onChange={(e) => setLanceInicial(Number(e.target.value))}
                  className="w-full bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/30 text-xs font-bold text-primary"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-bold text-on-surface uppercase mb-1">Incremento Mínimo (R$):</label>
                <input
                  type="number"
                  min="50"
                  step="10"
                  value={incrementoMinimo}
                  onChange={(e) => setIncrementoMinimo(Number(e.target.value))}
                  className="w-full bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/30 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-on-surface uppercase mb-1">Arremate Imediato (R$ · opcional):</label>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={precoArremate}
                  onChange={(e) => setPrecoArremate(Number(e.target.value))}
                  className="w-full bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/30 text-xs font-bold text-secondary"
                />
              </div>

              <div className="bg-surface-container-low p-2 rounded-xl flex flex-col justify-center">
                <span className="text-[10px] text-on-surface-variant font-bold uppercase">Custo Unitário Base:</span>
                <span className="text-sm font-extrabold text-secondary">
                  R$ {precoUnitarioEstimado} / unidade
                </span>
              </div>
            </div>
          </div>

          {submitError && (
            <div className="p-3 bg-error-container text-on-error-container rounded-xl text-xs font-bold">
              {submitError}
            </div>
          )}

          {/* Submit CTA */}
          <div className="pt-4 border-t border-surface-container flex items-center justify-end gap-3">
            <Link
              href="/painel/fornecedor"
              className="px-4 py-2.5 rounded-xl border border-outline-variant text-xs font-bold text-on-surface hover:bg-surface-container transition-colors"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={submitting || !user}
              className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-container text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {submitting ? (
                <span>Publicando pregão...</span>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">publish</span>
                  <span>Publicar Lote no Marketplace</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function NovoProdutoPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs">Carregando formulário de lotes B2B...</div>}>
      <NovoProdutoContent />
    </Suspense>
  );
}
