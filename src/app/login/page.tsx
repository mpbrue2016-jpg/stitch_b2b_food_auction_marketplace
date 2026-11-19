'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { formatCnpj, formatCpf } from '@/lib/format';
import { useAuth } from '@/components/AuthProvider';
import { useEnvironment } from '@/components/EnvironmentProvider';

export default function LoginPage() {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const { setEnvMode } = useEnvironment();
  const [role, setRole] = useState<'comprador' | 'fornecedor' | 'admin'>('comprador');
  const [docInput, setDocInput] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [exclusivePassword, setExclusivePassword] = useState('');
  const [exclusiveKeyRequired, setExclusiveKeyRequired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const tab = new URLSearchParams(window.location.search).get('tab');
      if (tab === 'admin' || tab === 'fornecedor' || tab === 'comprador') {
        setRole(tab);
      }
    }

    let active = true;
    fetch('/api/auth/admin-login', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && typeof data?.exclusiveKeyRequired === 'boolean') {
          setExclusiveKeyRequired(data.exclusiveKeyRequired);
        }
      })
      .catch(() => {
        // Ignora erro transitório de verificação de política do servidor
      });
    return () => {
      active = false;
    };
  }, []);

  const redirectAfterLogin = (actualRole: 'comprador' | 'fornecedor' | 'admin') => {
    setEnvMode('original');
    const redirectParam =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('redirect')
        : null;

    if (redirectParam && redirectParam.startsWith('/')) {
      router.push(redirectParam);
    } else if (actualRole === 'admin') {
      router.push('/painel/admin?env=original');
    } else if (actualRole === 'fornecedor') {
      router.push('/painel/fornecedor?env=original');
    } else {
      router.push('/painel/comprador?env=original');
    }
    router.refresh();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!isSupabaseConfigured) {
      setAuthError(
        'Ambiente Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY para autenticar.'
      );
      return;
    }

    if (role === 'admin') {
      const cleanCpf = cpf.replace(/\D/g, '');
      if (cleanCpf.length !== 11) {
        setAuthError('Informe um CPF válido com 11 dígitos (000.000.000-00).');
        return;
      }

      if (exclusiveKeyRequired && !exclusivePassword.trim()) {
        setAuthError('Informe a senha exclusiva de cofre administrativo.');
        return;
      }

      setLoading(true);
      try {
        const res = await fetch('/api/auth/admin-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cpf,
            email,
            password,
            exclusivePassword,
          }),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setAuthError(
            data?.error || 'Não foi possível validar as credenciais exclusivas do Administrador.'
          );
          setLoading(false);
          return;
        }

        await refreshProfile();
        redirectAfterLogin('admin');
      } catch {
        setAuthError('Falha de conexão ao autenticar Administrador Master.');
      } finally {
        setLoading(false);
      }
      return;
    }

    const cleanDoc = docInput.replace(/\D/g, '');
    if (cleanDoc.length !== 11 && cleanDoc.length !== 14) {
      setAuthError('Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setAuthError(error.message || 'Credenciais inválidas. Verifique e-mail e senha.');
        setLoading(false);
        return;
      }

      const perfilRes = await fetch('/api/auth/perfil', { cache: 'no-store' });
      const perfilData = await perfilRes.json().catch(() => null);
      const dbProfile = perfilData?.profile;

      if (!perfilRes.ok || !dbProfile) {
        await supabase.auth.signOut();
        setAuthError(
          'Perfil não localizado no banco de dados. Contate o suporte ou conclua seu cadastro.'
        );
        setLoading(false);
        return;
      }

      const actualRole = dbProfile.role as 'comprador' | 'fornecedor' | 'admin';
      if (actualRole === 'admin') {
        await supabase.auth.signOut();
        setAuthError(
          'Conta administrativa detectada. Selecione a aba Admin Master e informe seu CPF (sem CNPJ).'
        );
        setLoading(false);
        return;
      }

      const dbCnpj = String(dbProfile.cnpj || '').replace(/\D/g, '');
      const dbCpf = String(dbProfile.cpf || '').replace(/\D/g, '');
      if (cleanDoc.length === 14 && dbCnpj && !String(dbProfile.cnpj).startsWith('PEND-') && dbCnpj !== cleanDoc) {
        await supabase.auth.signOut();
        setAuthError('O CNPJ informado não corresponde ao titular desta conta.');
        setLoading(false);
        return;
      }
      if (cleanDoc.length === 11 && dbCpf && dbCpf !== cleanDoc) {
        await supabase.auth.signOut();
        setAuthError('O CPF informado não corresponde ao titular desta conta.');
        setLoading(false);
        return;
      }

      await refreshProfile();
      redirectAfterLogin(actualRole);
    } catch {
      setAuthError('Falha de conexão ao autenticar no servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-surface-container-lowest p-8 rounded-2xl shadow-xl border border-outline-variant/30 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex w-12 h-12 rounded-xl bg-primary items-center justify-center text-on-primary font-extrabold text-xl shadow-sm">
            VO
          </div>
          <h1 className="text-2xl font-extrabold text-on-surface">
            {role === 'admin' ? 'Acesso Admin Master' : 'Acesso Oficial • Ambiente Original'}
          </h1>
          <p className="text-xs text-on-surface-variant">
            {role === 'admin'
              ? 'Acesso exclusivo do administrador autenticado por CPF (sem CNPJ)'
              : 'Entre com seu CPF ou CNPJ cadastrado para acessar seu ambiente real'}
          </p>
        </div>

        <div className="flex bg-surface-container-low p-1 rounded-xl">
          <button
            type="button"
            onClick={() => {
              setRole('comprador');
              setAuthError(null);
            }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
              role === 'comprador'
                ? 'bg-surface-container-lowest text-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Comprador
          </button>
          <button
            type="button"
            onClick={() => {
              setRole('fornecedor');
              setAuthError(null);
            }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
              role === 'fornecedor'
                ? 'bg-surface-container-lowest text-secondary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Fornecedor
          </button>
          <button
            type="button"
            onClick={() => {
              setRole('admin');
              setAuthError(null);
            }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
              role === 'admin'
                ? 'bg-surface-container-lowest text-tertiary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Admin Master
          </button>
        </div>

        <form onSubmit={handleLogin} className="space-y-4 text-xs">
          {role === 'admin' ? (
            <div>
              <label className="block font-bold text-on-surface uppercase mb-1">
                CPF do Administrador (sem CNPJ):
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={14}
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(e) => setCpf(formatCpf(e.target.value))}
                className="w-full bg-surface-container-low px-3 py-2.5 rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-tertiary text-sm font-mono"
                required
              />
            </div>
          ) : (
            <div>
              <label className="block font-bold text-on-surface uppercase mb-1">
                CPF ou CNPJ Cadastrado:
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={18}
                placeholder="000.000.000-00 ou 00.000.000/0001-00"
                value={docInput}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '');
                  setDocInput(digits.length > 11 ? formatCnpj(digits) : formatCpf(digits));
                }}
                className="w-full bg-surface-container-low px-3 py-2.5 rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary text-sm font-mono"
                required
              />
            </div>
          )}

          <div>
            <label className="block font-bold text-on-surface uppercase mb-1">
              {role === 'admin' ? 'E-mail do Administrador:' : 'E-mail de Acesso:'}
            </label>
            <input
              type="email"
              placeholder={
                role === 'admin'
                  ? 'admin@varejistaonline.com.br'
                  : 'contato@suaempresa.com.br'
              }
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface-container-low px-3 py-2.5 rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              required
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="font-bold text-on-surface uppercase">
                {role === 'admin' ? 'Senha Exclusiva do Administrador:' : 'Senha de Acesso:'}
              </label>
              <Link href="/recuperar-senha" className="text-primary hover:underline font-semibold">
                Esqueceu a senha?
              </Link>
            </div>
            <input
              type="password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface-container-low px-3 py-2.5 rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              required
            />
          </div>

          {role === 'admin' && exclusiveKeyRequired && (
            <div>
              <label className="block font-bold text-on-surface uppercase mb-1">
                Chave Exclusiva de Cofre Admin:
              </label>
              <input
                type="password"
                placeholder="Senha mestra exclusiva do servidor"
                value={exclusivePassword}
                onChange={(e) => setExclusivePassword(e.target.value)}
                className="w-full bg-surface-container-low px-3 py-2.5 rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-tertiary text-sm"
                required
              />
            </div>
          )}

          {authError && (
            <div className="p-2.5 bg-error-container text-on-error-container rounded-xl text-xs font-bold">
              {authError}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 text-white ${
              role === 'admin'
                ? 'bg-tertiary hover:opacity-90'
                : 'bg-primary hover:bg-primary-container'
            }`}
          >
            {loading ? (
              <span>Validando credenciais...</span>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">
                  {role === 'admin' ? 'shield_person' : 'login'}
                </span>
                <span>
                  {role === 'admin' ? 'Entrar como Admin Master' : 'Entrar no Ambiente Original'}
                </span>
              </>
            )}
          </button>
        </form>

        <div className="pt-4 border-t border-surface-container text-center text-xs text-on-surface-variant space-y-2">
          {role === 'admin' ? (
            <span>
              Acesso administrativo restrito via CPF e senha exclusiva (sem vínculo de CNPJ)
            </span>
          ) : (
            <>
              <div>
                <span>Ainda não possui conta oficial? </span>
                <Link href="/cadastro" className="text-primary font-bold hover:underline">
                  Cadastrar agora gratuitamente
                </Link>
              </div>
              <div>
                <Link href="/" className="text-amber-700 font-bold hover:underline">
                  Explorar Ambiente Modelo sem cadastro →
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
