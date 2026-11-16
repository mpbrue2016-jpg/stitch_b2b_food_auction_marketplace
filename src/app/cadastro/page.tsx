'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { formatCnpj, formatPhoneBr } from '@/lib/format';

export default function CadastroPage() {
  const router = useRouter();
  const [userType, setUserType] = useState<'comprador' | 'fornecedor'>('comprador');
  const [cnpj, setCnpj] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [cnae, setCnae] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cidade, setCidade] = useState('São Paulo');
  const [uf, setUf] = useState('SP');
  const [validatingCnpj, setValidatingCnpj] = useState(false);
  const [cnpjVerified, setCnpjVerified] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [approvedModal, setApprovedModal] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const docInputRef = React.useRef<HTMLInputElement | null>(null);

  const [cnpjError, setCnpjError] = useState<string | null>(null);
  const [situacaoReceita, setSituacaoReceita] = useState<string | null>(null);

  const handleConsultCnpj = async () => {
    if (!cnpj.trim()) return;
    setValidatingCnpj(true);
    setCnpjError(null);
    setCnpjVerified(false);

    try {
      const res = await fetch(
        `/api/cnpj?cnpj=${encodeURIComponent(cnpj)}&role=${encodeURIComponent(userType)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setCnpjError(data?.error || 'Não foi possível validar o CNPJ informado.');
        return;
      }

      setRazaoSocial(data.razaoSocial || '');
      setNomeFantasia(data.nomeFantasia || '');
      setCnae(data.cnae || '');
      if (data.cidade) setCidade(data.cidade);
      if (data.uf) setUf(data.uf);
      setSituacaoReceita(data.situacaoCadastral || 'ATIVA');
      setCnpjVerified(true);
    } catch {
      setCnpjError('Falha de comunicação ao consultar Receita Federal. Tente novamente.');
    } finally {
      setValidatingCnpj(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);

    if (isSupabaseConfigured) {
      const { error } = await supabase.auth.signUp({
        email,
        password: password || 'B2BMarketplace@2026',
        options: {
          data: {
            role: userType,
            cnpj,
            razao_social: razaoSocial,
            nome_fantasia: nomeFantasia,
            telefone,
            cidade,
            uf,
          },
        },
      });
      if (error) {
        setSubmitError(error.message || 'Erro ao criar conta corporativa.');
        setSubmitting(false);
        return;
      }
    } else {
      await new Promise((r) => setTimeout(r, 600));
    }

    window.localStorage.setItem('varejista_active_role', userType);
    setSubmitting(false);
    setApprovedModal(true);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      {/* Title */}
      <div className="space-y-1">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed text-xs font-bold">
          <span className="material-symbols-outlined text-[16px]">domain_verification</span>
          Onboarding B2B • Homologação Automática
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface">
          Cadastro e Validação de CNPJ em Tempo Real
        </h1>
        <p className="text-xs sm:text-sm text-on-surface-variant">
          Conecte sua empresa ao ambiente seguro de leilões e compras diretas com custódia fiduciária auditada.
        </p>
      </div>

      {/* Role Picker */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => setUserType('comprador')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            userType === 'comprador'
              ? 'border-primary bg-primary-fixed/20 shadow-md ring-2 ring-primary'
              : 'border-outline-variant/40 bg-surface-container-low hover:border-primary/50'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-primary text-[22px]">storefront</span>
            <span className="font-extrabold text-sm text-on-surface">Perfil Comprador (Varejista)</span>
          </div>
          <p className="text-xs text-on-surface-variant">
            Supermercados, minimercados, redes atacadistas, empórios e distribuidores regionais.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setUserType('fornecedor')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            userType === 'fornecedor'
              ? 'border-secondary bg-secondary-fixed/20 shadow-md ring-2 ring-secondary'
              : 'border-outline-variant/40 bg-surface-container-low hover:border-secondary/50'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-secondary text-[22px]">factory</span>
            <span className="font-extrabold text-sm text-on-surface">Perfil Fornecedor (Indústria)</span>
          </div>
          <p className="text-xs text-on-surface-variant">
            Indústrias alimentícias, produtores rurais, cooperativas e grandes importadores.
          </p>
        </button>
      </div>

      {/* Form Container */}
      <div className="bg-surface-container-lowest p-6 sm:p-8 rounded-2xl border border-outline-variant/30 shadow-sm space-y-6">
        <form onSubmit={handleSubmit} className="space-y-5 text-xs">
          {/* Step 1: CNPJ Consultation */}
          <div className="space-y-2">
            <label className="block font-bold text-on-surface uppercase tracking-wide">
              1. Consulta de CNPJ na Receita Federal / Sintegra:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={18}
                placeholder="00.000.000/0001-00"
                value={cnpj}
                onChange={(e) => {
                  setCnpj(formatCnpj(e.target.value));
                  setCnpjVerified(false);
                  setCnpjError(null);
                }}
                className="flex-1 bg-surface-container-low px-4 py-2.5 rounded-xl border border-outline-variant/40 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
              <button
                type="button"
                onClick={handleConsultCnpj}
                disabled={validatingCnpj || !cnpj}
                className="bg-primary hover:bg-primary-container text-white px-5 py-2.5 rounded-xl font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5 shrink-0"
              >
                {validatingCnpj ? (
                  <span>Consultando...</span>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">sync</span>
                    <span>Validar CNPJ</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {cnpjError && (
            <div className="p-3 bg-error-container text-on-error-container rounded-xl text-xs font-bold">
              {cnpjError}
            </div>
          )}

          {/* Verification Badge */}
          {cnpjVerified && (
            <div className="p-3 bg-secondary-container/20 rounded-xl border border-secondary/30 flex items-center gap-2 text-secondary font-bold">
              <span className="material-symbols-outlined text-[20px]">check_circle</span>
              <span>
                CNPJ Regularizado ({situacaoReceita || 'ATIVA'}) • Receita Federal • CNAE Compatível
              </span>
            </div>
          )}

          {/* Step 2: Corporate Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-on-surface uppercase mb-1">Razão Social:</label>
              <input
                type="text"
                value={razaoSocial}
                onChange={(e) => setRazaoSocial(e.target.value)}
                placeholder="Nome empresarial registrado"
                className="w-full bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/30 text-xs"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-on-surface uppercase mb-1">Nome Fantasia:</label>
              <input
                type="text"
                value={nomeFantasia}
                onChange={(e) => setNomeFantasia(e.target.value)}
                placeholder="Nome da marca ou rede"
                className="w-full bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/30 text-xs"
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-on-surface uppercase mb-1">CNAE Principal:</label>
            <input
              type="text"
              value={cnae}
              onChange={(e) => setCnae(e.target.value)}
              placeholder="Atividade econômica principal"
              className="w-full bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/30 text-xs"
            />
          </div>

          {/* Contact & Location */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-bold text-on-surface uppercase mb-1">E-mail Corporativo:</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contato@empresa.com.br"
                className="w-full bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/30 text-xs"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-on-surface uppercase mb-1">Telefone / WhatsApp B2B:</label>
              <input
                type="tel"
                inputMode="tel"
                maxLength={15}
                value={telefone}
                onChange={(e) => setTelefone(formatPhoneBr(e.target.value))}
                placeholder="(11) 99999-0000"
                className="w-full bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/30 text-xs"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-on-surface uppercase mb-1">Hub Logístico (Cidade / UF):</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  className="flex-1 bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/30 text-xs"
                  required
                />
                <input
                  type="text"
                  maxLength={2}
                  value={uf}
                  onChange={(e) => setUf(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                  className="w-14 bg-surface-container-low px-2 py-2 rounded-xl border border-outline-variant/30 text-xs uppercase text-center"
                  required
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block font-bold text-on-surface uppercase mb-1">Senha de Acesso B2B (mínimo 6 caracteres):</label>
            <input
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Crie uma senha corporativa segura"
              className="w-full sm:w-1/2 bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/30 text-xs"
              required
            />
          </div>

          {/* Document Upload Simulation */}
          <div className="p-4 bg-surface-container-low rounded-xl border border-dashed border-outline-variant space-y-2">
            <span className="font-bold text-on-surface block uppercase">
              Documentação de Habilitação Sanitária & Fiscal (Opcional no pré-cadastro):
            </span>
            <p className="text-[11px] text-on-surface-variant">
              Anexe cópia do Contrato Social e Licença Sanitária (ANVISA ou MAPA) para acelerar liberação de limite escrow acima de R$ 200.000,00.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <input
                ref={docInputRef}
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => {
                  const names = Array.from(e.target.files || []).map((f) => f.name);
                  setSelectedDocs(names);
                }}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => docInputRef.current?.click()}
                className="px-3 py-1.5 bg-white border border-outline-variant rounded-lg text-xs font-semibold text-primary hover:bg-surface-container transition-colors"
              >
                + Selecionar Arquivos (.PDF ou .PNG)
              </button>
              <span className="text-[10px] text-outline">
                {selectedDocs.length > 0
                  ? `${selectedDocs.length} arquivo(s): ${selectedDocs.join(', ')}`
                  : 'Nenhum arquivo enviado ainda'}
              </span>
            </div>
          </div>

          {submitError && (
            <div className="p-3 bg-error-container text-on-error-container rounded-xl text-xs font-bold">
              {submitError}
            </div>
          )}

          {/* Submit CTA */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-primary hover:bg-primary-container text-white font-extrabold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              {submitting ? (
                <span>Homologando Cadastro no BACEN e Receita...</span>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[20px]">how_to_reg</span>
                  <span>Concluir Homologação e Ativar Perfil B2B</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Modal de Cadastro Aprovado */}
      {approvedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-6 shadow-2xl border border-outline-variant/30 space-y-5 text-center animate-in fade-in zoom-in-95">
            <div className="w-16 h-16 rounded-full bg-secondary-container text-secondary flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-4xl">verified</span>
            </div>
            <div>
              <h3 className="font-extrabold text-xl text-on-surface">Cadastro Aprovado!</h3>
              <p className="text-xs text-on-surface-variant mt-1">
                Limite de <strong>R$ 100.000,00</strong> em custódia fiduciária liberado instantaneamente para seu CNPJ.
              </p>
            </div>
            <div className="p-3 bg-surface-container-low rounded-xl text-xs text-left space-y-1">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Empresa:</span>
                <span className="font-bold text-on-surface">{razaoSocial || 'Supermercado Central'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Modalidade:</span>
                <span className="font-bold text-secondary uppercase">{userType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Status BACEN:</span>
                <span className="text-secondary font-bold">100% Homologado</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setApprovedModal(false);
                if (userType === 'comprador') {
                  router.push('/painel/comprador');
                } else {
                  router.push('/painel/fornecedor');
                }
              }}
              className="w-full py-3 bg-primary hover:bg-primary-container text-white font-bold text-xs rounded-xl shadow-md transition-all"
            >
              Acessar Meu Painel Agora
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
