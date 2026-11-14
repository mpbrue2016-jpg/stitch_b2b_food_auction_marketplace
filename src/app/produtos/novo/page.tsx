'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MOCK_CATEGORIES } from '@/lib/mock-data';

export default function NovoProdutoPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Form states
  const [titulo, setTitulo] = useState('');
  const [marca, setMarca] = useState('');
  const [fabricante, setFabricante] = useState('');
  const [categoriaId, setCategoriaId] = useState(MOCK_CATEGORIES[0].id);
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

  const totalUnidades = unidadesPorEmbalagem * totalCaixas;
  const precoUnitarioEstimado = totalUnidades > 0 ? (lanceInicial / totalUnidades).toFixed(2) : '0.00';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    setTimeout(() => {
      setSubmitting(false);
      setSuccess(true);
      setTimeout(() => {
        router.push('/leiloes');
      }, 1500);
    }, 800);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Breadcrumb */}
      <nav className="text-xs text-on-surface-variant flex items-center gap-1.5">
        <Link href="/" className="hover:text-primary">Início</Link>
        <span>/</span>
        <Link href="/painel/fornecedor" className="hover:text-primary">Painel da Indústria</Link>
        <span>/</span>
        <span className="font-bold text-primary">Cadastro Técnico de Produtos & Lotes B2B</span>
      </nav>

      {/* Title */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface">
          Cadastro de Lote & Parametrização de Pregão
        </h1>
        <p className="text-xs sm:text-sm text-on-surface-variant">
          Cadastre produtos com códigos GS1 oficiais (EAN/DUN-14), controle de shelf life e regras de arremate.
        </p>
      </div>

      {success ? (
        <div className="p-8 bg-secondary-container/20 rounded-2xl border border-secondary/30 text-center space-y-3">
          <span className="material-symbols-outlined text-secondary text-5xl">check_circle</span>
          <h3 className="font-bold text-xl text-secondary">Lote Cadastrado e Pregão Ativado!</h3>
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
              1. Identificação Técnica do Produto
            </h3>

            <div>
              <label className="block font-bold text-on-surface uppercase mb-1">Título Comercial do Lote:</label>
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex: Arroz Branco Tipo 1 5kg • Lote 1.500 Fardos (30.000 kg)"
                className="w-full bg-surface-container-low px-3 py-2.5 rounded-xl border border-outline-variant/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-bold text-on-surface uppercase mb-1">Marca / Linha:</label>
                <input
                  type="text"
                  value={marca}
                  onChange={(e) => setMarca(e.target.value)}
                  placeholder="Ex: Camil, Tio João..."
                  className="w-full bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/30 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-on-surface uppercase mb-1">Indústria Fabricante:</label>
                <input
                  type="text"
                  value={fabricante}
                  onChange={(e) => setFabricante(e.target.value)}
                  placeholder="Razão Social ou Fábrica"
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
                >
                  {MOCK_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* GS1 Barcodes */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-surface-container-low rounded-xl border border-outline-variant/20">
              <div>
                <label className="block font-bold text-on-surface uppercase mb-1">GTIN / EAN-13 (Unidade):</label>
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
                <label className="block font-bold text-on-surface uppercase mb-1">DUN-14 (Caixa Coletiva):</label>
                <input
                  type="text"
                  value={dun14}
                  onChange={(e) => setDun14(e.target.value)}
                  placeholder="17890000000007"
                  className="w-full bg-white px-3 py-2 rounded-lg border border-outline-variant/40 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-on-surface uppercase mb-1">Hub Logístico de Origem:</label>
                <input
                  type="text"
                  value={origem}
                  onChange={(e) => setOrigem(e.target.value)}
                  placeholder="Ex: CD Jundiaí - SP"
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
              2. Especificações de Paletização e Volume
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
                <label className="block font-bold text-on-surface uppercase mb-1">Total de Caixas:</label>
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
                <label className="block font-bold text-on-surface uppercase mb-1">Paletes PBR:</label>
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
                  Atesto conformidade sanitária ANVISA / MAPA com laudo de qualidade emitido.
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
                  onChange={(e) => setTipoVenda(e.target.value as any)}
                  className="w-full bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/30 text-xs cursor-pointer"
                >
                  <option value="leilao">Leilão Aberto (Pregão)</option>
                  <option value="giro_rapido">Giro Rápido FEFO (Desconto Agressivo)</option>
                  <option value="venda_direta">Venda Direta / Preço Fixo</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-on-surface uppercase mb-1">Tipo de Frete:</label>
                <select
                  value={tipoFrete}
                  onChange={(e) => setTipoFrete(e.target.value as any)}
                  className="w-full bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/30 text-xs cursor-pointer"
                >
                  <option value="FOB">FOB (Comprador retira na Doca do CD)</option>
                  <option value="CIF">CIF (Indústria entrega no destino)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-on-surface uppercase mb-1">Lance Inicial (R$):</label>
                <input
                  type="number"
                  step="500"
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
                  step="100"
                  value={incrementoMinimo}
                  onChange={(e) => setIncrementoMinimo(Number(e.target.value))}
                  className="w-full bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/30 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-on-surface uppercase mb-1">Preço de Arremate Imediato (R$):</label>
                <input
                  type="number"
                  step="500"
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
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-container text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5"
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
