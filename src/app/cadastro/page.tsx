'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { formatCnpj, formatCpf, formatPhoneBr } from '@/lib/format';
import { useAuth } from '@/components/AuthProvider';
import { useEnvironment } from '@/components/EnvironmentProvider';
import type { PerfilComercial, TipoPessoa } from '@/lib/types';

type ProfileCardOption = {
  id: PerfilComercial;
  titulo: string;
  subtitulo: string;
  icon: string;
  defaultPessoa: TipoPessoa;
};

const PROFILE_OPTIONS: ProfileCardOption[] = [
  {
    id: 'comprador',
    titulo: 'Comprador',
    subtitulo: 'Supermercados, mercearias, atacarejos e compradores individuais.',
    icon: 'storefront',
    defaultPessoa: 'PJ',
  },
  {
    id: 'fornecedor',
    titulo: 'Fornecedor',
    subtitulo: 'Indústrias, cerealistas, produtores e distribuidoras atacadistas.',
    icon: 'factory',
    defaultPessoa: 'PJ',
  },
  {
    id: 'anunciante',
    titulo: 'Vendedor / Anunciante',
    subtitulo: 'Pequenos mercados ou lojistas liquidando estoque parado e fardos.',
    icon: 'sell',
    defaultPessoa: 'PJ',
  },
  {
    id: 'empresa',
    titulo: 'Empresa (CNPJ)',
    subtitulo: 'Conta corporativa completa para comprar e vender sob o mesmo CNPJ.',
    icon: 'apartment',
    defaultPessoa: 'PJ',
  },
  {
    id: 'pessoa_fisica',
    titulo: 'Pessoa Física (CPF)',
    subtitulo: 'Produtor rural, comprador autônomo ou comerciante sem CNPJ.',
    icon: 'person',
    defaultPessoa: 'PF',
  },
];

export default function CadastroPage() {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const { setEnvMode, openTutorial } = useEnvironment();

  const [perfilComercial, setPerfilComercial] = useState<PerfilComercial>('comprador');
  const [tipoPessoa, setTipoPessoa] = useState<TipoPessoa>('PJ');
  const [rolePreferida, setRolePreferida] = useState<'comprador' | 'fornecedor'>('comprador');

  const [cpf, setCpf] = useState('');
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
  const [cnpjError, setCnpjError] = useState<string | null>(null);
  const [situacaoReceita, setSituacaoReceita] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [approvedModal, setApprovedModal] = useState(false);
  const [redirectRoute, setRedirectRoute] = useState('/painel/comprador?env=original&welcome=1');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [kycUploadWarning, setKycUploadWarning] = useState<string | null>(null);
  const docInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleSelectProfileOption = (opt: ProfileCardOption) => {
    setPerfilComercial(opt.id);
    setTipoPessoa(opt.defaultPessoa);
    if (opt.id === 'fornecedor' || opt.id === 'anunciante') {
      setRolePreferida('fornecedor');
    } else if (opt.id === 'comprador' || opt.id === 'pessoa_fisica') {
      setRolePreferida('comprador');
    }
    setSubmitError(null);
  };

  const handleConsultCnpj = async () => {
    if (!cnpj.trim()) return;
    setValidatingCnpj(true);
    setCnpjError(null);
    setCnpjVerified(false);

    try {
      const res = await fetch(
        `/api/cnpj?cnpj=${encodeURIComponent(cnpj)}&role=${encodeURIComponent(rolePreferida)}`
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

    if (tipoPessoa === 'PF') {
      if (cpf.replace(/\D/g, '').length !== 11) {
        setSubmitError('Informe um CPF válido com 11 dígitos (000.000.000-00).');
        return;
      }
    } else {
      if (cnpj.replace(/\D/g, '').length !== 14) {
        setSubmitError('Informe um CNPJ válido com 14 dígitos (00.000.000/0001-00).');
        return;
      }
    }

    if (!password || password.length < 6) {
      setSubmitError('A senha deve conter pelo menos 6 caracteres.');
      return;
    }

    if (!isSupabaseConfigured) {
      setSubmitError(
        'Ambiente Supabase não configurado. Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.'
      );
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/auth/cadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipoPessoa,
          perfilComercial,
          rolePreferida,
          email,
          password,
          razaoSocial,
          nomeFantasia: nomeFantasia || razaoSocial,
          cpf: cpf || undefined,
          cnpj: tipoPessoa === 'PJ' ? cnpj : undefined,
          telefone,
          cidade,
          uf,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setSubmitError(data?.error || 'Não foi possível concluir seu cadastro oficial.');
        setSubmitting(false);
        return;
      }

      // Efetua login automático na conta recém-criada no Supabase Auth
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (!signInErr) {
        await refreshProfile();
        setEnvMode('original');

        if (selectedFiles.length > 0) {
          let failedCount = 0;
          for (const file of selectedFiles) {
            try {
              const fd = new FormData();
              fd.append('file', file);
              fd.append('bucket', 'kyc-docs');
              fd.append('tipoDocumento', 'contrato_social');
              const upRes = await fetch('/api/upload', { method: 'POST', body: fd });
              if (!upRes.ok) failedCount += 1;
            } catch {
              failedCount += 1;
            }
          }
          if (failedCount > 0) {
            setKycUploadWarning(
              `${failedCount} arquivo(s) não pôde(ram) ser anexado(s) agora. Você pode reenviá-los no seu painel.`
            );
          }
        }
      }

      setRedirectRoute(data?.redirectTo || '/painel/comprador?env=original&welcome=1');
      setApprovedModal(true);
    } catch {
      setSubmitError('Falha inesperada ao finalizar cadastro oficial.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      {/* Header */}
      <div className="space-y-1.5">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 text-xs font-extrabold">
          <span className="material-symbols-outlined text-[16px]">verified_user</span>
          Ambiente Original • Cadastro Oficial Real (Sem Dados Demonstrativos)
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface">
          Crie Sua Conta Oficial no Varejista Online
        </h1>
        <p className="text-xs sm:text-sm text-on-surface-variant max-w-3xl">
          Gostou de conhecer o Varejista Online? Escolha abaixo o perfil mais adequado e informe apenas os dados necessários. Você iniciará com seu próprio painel limpo e seguro, sem herdar registros fictícios.
        </p>
      </div>

      {/* Seletor Multiperfil (PF, Empresa, Comprador, Fornecedor, Vendedor/Anunciante) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {PROFILE_OPTIONS.map((opt) => {
          const active = perfilComercial === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleSelectProfileOption(opt)}
              className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2 ${
                active
                  ? 'border-primary bg-primary-fixed/25 shadow-md ring-2 ring-primary'
                  : 'border-outline-variant/40 bg-surface-container-low hover:border-primary/50'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">{opt.icon}</span>
                <span className="font-extrabold text-xs text-on-surface">{opt.titulo}</span>
              </div>
              <p className="text-[11px] text-on-surface-variant leading-snug">{opt.subtitulo}</p>
            </button>
          );
        })}
      </div>

      {/* Bloco de Acesso Exclusivo Administrador */}
      <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-tertiary text-[22px]">shield_person</span>
          <div>
            <strong className="text-on-surface block">
              Cadastro de Administrador (Acesso Exclusivo e Controlado)
            </strong>
            <span className="text-on-surface-variant">
              Administradores autenticam exclusivamente via CPF (sem CNPJ) e chave exclusiva em rota controlada.
            </span>
          </div>
        </div>
        <Link
          href="/login?tab=admin"
          className="px-4 py-2 rounded-xl bg-tertiary text-white font-bold text-xs shrink-0 text-center hover:opacity-90 transition-opacity"
        >
          Acessar Login Admin (CPF)
        </Link>
      </div>

      {/* Formulário Oficial */}
      <div className="bg-surface-container-lowest p-6 sm:p-8 rounded-2xl border border-outline-variant/30 shadow-sm space-y-6">
        <form onSubmit={handleSubmit} className="space-y-5 text-xs">
          {/* Tipo de Pessoa + Atuação Comercial quando aplicável */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-2 border-b border-surface-container">
            <div>
              <label className="block font-bold text-on-surface uppercase mb-1.5">
                Modalidade Documental:
              </label>
              <div className="flex bg-surface-container-low p-1 rounded-xl border border-outline-variant/30">
                <button
                  type="button"
                  onClick={() => {
                    setTipoPessoa('PF');
                    setCnpjError(null);
                  }}
                  className={`flex-1 py-2 rounded-lg font-bold transition-all ${
                    tipoPessoa === 'PF'
                      ? 'bg-surface-container-lowest text-primary shadow-sm'
                      : 'text-on-surface-variant'
                  }`}
                >
                  Pessoa Física (CPF)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTipoPessoa('PJ');
                    setCnpjError(null);
                  }}
                  className={`flex-1 py-2 rounded-lg font-bold transition-all ${
                    tipoPessoa === 'PJ'
                      ? 'bg-surface-container-lowest text-primary shadow-sm'
                      : 'text-on-surface-variant'
                  }`}
                >
                  Empresa (CNPJ)
                </button>
              </div>
            </div>

            {(perfilComercial === 'empresa' || perfilComercial === 'pessoa_fisica') && (
              <div>
                <label className="block font-bold text-on-surface uppercase mb-1.5">
                  Objetivo Principal Inicial:
                </label>
                <div className="flex bg-surface-container-low p-1 rounded-xl border border-outline-variant/30">
                  <button
                    type="button"
                    onClick={() => setRolePreferida('comprador')}
                    className={`flex-1 py-2 rounded-lg font-bold transition-all ${
                      rolePreferida === 'comprador'
                        ? 'bg-surface-container-lowest text-primary shadow-sm'
                        : 'text-on-surface-variant'
                    }`}
                  >
                    Comprar Lotes
                  </button>
                  <button
                    type="button"
                    onClick={() => setRolePreferida('fornecedor')}
                    className={`flex-1 py-2 rounded-lg font-bold transition-all ${
                      rolePreferida === 'fornecedor'
                        ? 'bg-surface-container-lowest text-secondary shadow-sm'
                        : 'text-on-surface-variant'
                    }`}
                  >
                    Vender / Anunciar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Documento Principal (CPF ou CNPJ) */}
          {tipoPessoa === 'PF' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-on-surface uppercase tracking-wide mb-1">
                  1. CPF do Titular (obrigatório):
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={14}
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  className="w-full bg-surface-container-low px-4 py-2.5 rounded-xl border border-outline-variant/40 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-on-surface uppercase mb-1">
                  Nome Completo:
                </label>
                <input
                  type="text"
                  value={razaoSocial}
                  onChange={(e) => setRazaoSocial(e.target.value)}
                  placeholder="Seu nome completo"
                  className="w-full bg-surface-container-low px-3 py-2.5 rounded-xl border border-outline-variant/30 text-sm"
                  required
                />
              </div>
            </div>
          ) : (
            <>
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

              {cnpjVerified && (
                <div className="p-3 bg-secondary-container/20 rounded-xl border border-secondary/30 flex items-center gap-2 text-secondary font-bold">
                  <span className="material-symbols-outlined text-[20px]">check_circle</span>
                  <span>
                    CNPJ Regularizado ({situacaoReceita || 'ATIVA'}) • Receita Federal
                  </span>
                </div>
              )}

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
                    placeholder="Nome da loja, mercado ou indústria"
                    className="w-full bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/30 text-xs"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-on-surface uppercase mb-1">CNAE Principal (opcional):</label>
                <input
                  type="text"
                  value={cnae}
                  onChange={(e) => setCnae(e.target.value)}
                  placeholder="Atividade econômica principal"
                  className="w-full bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/30 text-xs"
                />
              </div>
            </>
          )}

          {/* Contato, Localização e Nome Fantasia/Apelido quando PF */}
          {tipoPessoa === 'PF' && (
            <div>
              <label className="block font-bold text-on-surface uppercase mb-1">
                Nome Comercial / Como deseja aparecer (opcional):
              </label>
              <input
                type="text"
                value={nomeFantasia}
                onChange={(e) => setNomeFantasia(e.target.value)}
                placeholder="Ex: Sítio Boa Vista, Comércio João Silva..."
                className="w-full bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/30 text-xs"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-bold text-on-surface uppercase mb-1">E-mail de Acesso:</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contato@suaempresa.com.br"
                className="w-full bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/30 text-xs"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-on-surface uppercase mb-1">Telefone / WhatsApp:</label>
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
              <label className="block font-bold text-on-surface uppercase mb-1">Cidade / UF:</label>
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
            <label className="block font-bold text-on-surface uppercase mb-1">
              Senha de Acesso Oficial (mínimo 6 caracteres):
            </label>
            <input
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Crie uma senha segura"
              className="w-full sm:w-1/2 bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/30 text-xs"
              required
            />
          </div>

          {/* Documentação Opcional para PJ */}
          {tipoPessoa === 'PJ' && (
            <div className="p-4 bg-surface-container-low rounded-xl border border-dashed border-outline-variant space-y-2">
              <span className="font-bold text-on-surface block uppercase">
                Documentação de Habilitação Sanitária &amp; Fiscal (Opcional neste momento):
              </span>
              <p className="text-[11px] text-on-surface-variant">
                Anexe cópia do Contrato Social ou Licença Sanitária para ampliar seu limite Escrow corporativo.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <input
                  ref={docInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setSelectedFiles(files);
                    setSelectedDocs(files.map((f) => f.name));
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
          )}

          {submitError && (
            <div className="p-3 bg-error-container text-on-error-container rounded-xl text-xs font-bold">
              {submitError}
            </div>
          )}

          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-primary hover:bg-primary-container text-white font-extrabold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <span>Criando Perfil Oficial no Supabase...</span>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[20px]">how_to_reg</span>
                  <span>Criar Minha Conta Oficial no Ambiente Original</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Modal de Conta Oficial Criada */}
      {approvedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-6 shadow-2xl border border-outline-variant/30 space-y-5 text-center animate-in fade-in zoom-in-95">
            <div className="w-16 h-16 rounded-full bg-secondary-container text-secondary flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-4xl">verified</span>
            </div>
            <div>
              <h3 className="font-extrabold text-xl text-on-surface">
                Conta Oficial Criada com Sucesso!
              </h3>
              <p className="text-xs text-on-surface-variant mt-1">
                Seu perfil verdadeiro foi vinculado exclusivamente à sua conta no Ambiente Original, com tutorial inicial pronto para orientar seus primeiros passos.
              </p>
            </div>
            <div className="p-3 bg-surface-container-low rounded-xl text-xs text-left space-y-1">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Titular:</span>
                <span className="font-bold text-on-surface">{nomeFantasia || razaoSocial}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Perfil:</span>
                <span className="font-bold text-secondary uppercase">{perfilComercial}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Ambiente Ativo:</span>
                <span className="text-emerald-700 font-extrabold">ORIGINAL (Dados Reais)</span>
              </div>
            </div>
            {kycUploadWarning && (
              <div className="p-2.5 bg-tertiary-fixed/40 border border-tertiary/30 rounded-xl text-[11px] text-on-tertiary-fixed font-semibold text-left">
                {kycUploadWarning}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setApprovedModal(false);
                setEnvMode('original');
                openTutorial(0);
                router.push(redirectRoute);
              }}
              className="w-full py-3 bg-primary hover:bg-primary-container text-white font-bold text-xs rounded-xl shadow-md transition-all"
            >
              Acessar Meu Painel com Tutorial Inicial
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
