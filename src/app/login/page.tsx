'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<'comprador' | 'fornecedor' | 'admin'>('comprador');
  const [cnpj, setCnpj] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setLoading(true);

    if (isSupabaseConfigured) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setAuthError(error.message || 'Credenciais inválidas. Verifique e-mail e senha.');
        setLoading(false);
        return;
      }
    } else {
      await new Promise((r) => setTimeout(r, 450));
    }

    if (role === 'comprador' || role === 'fornecedor') {
      window.localStorage.setItem('varejista_active_role', role);
    }

    setLoading(false);
    if (role === 'comprador') {
      router.push('/painel/comprador');
    } else if (role === 'fornecedor') {
      router.push('/painel/fornecedor');
    } else {
      router.push('/painel/admin');
    }
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-surface-container-lowest p-8 rounded-2xl shadow-xl border border-outline-variant/30 space-y-6">
        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-12 h-12 rounded-xl bg-primary items-center justify-center text-on-primary font-extrabold text-xl shadow-sm">
            VO
          </div>
          <h1 className="text-2xl font-extrabold text-on-surface">Acesso B2B Seguro</h1>
          <p className="text-xs text-on-surface-variant">
            Entre com suas credenciais homologadas com CNPJ verificado
          </p>
        </div>

        {/* Role Selector Tabs */}
        <div className="flex bg-surface-container-low p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setRole('comprador')}
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
            onClick={() => setRole('fornecedor')}
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
            onClick={() => setRole('admin')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
              role === 'admin'
                ? 'bg-surface-container-lowest text-tertiary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Admin Master
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-on-surface uppercase mb-1">
              CNPJ da Empresa:
            </label>
            <input
              type="text"
              placeholder="00.000.000/0001-00"
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              className="w-full bg-surface-container-low px-3 py-2.5 rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              required
            />
          </div>

          <div>
            <label className="block font-bold text-on-surface uppercase mb-1">
              E-mail Corporativo:
            </label>
            <input
              type="email"
              placeholder="compras@suaempresa.com.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface-container-low px-3 py-2.5 rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              required
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="font-bold text-on-surface uppercase">Senha de Acesso:</label>
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

          {authError && (
            <div className="p-2.5 bg-error-container text-on-error-container rounded-xl text-xs font-bold">
              {authError}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-primary hover:bg-primary-container text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <span>Validando credenciais...</span>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">login</span>
                <span>Entrar no Portal B2B</span>
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="pt-4 border-t border-surface-container text-center text-xs text-on-surface-variant">
          <span>Ainda não possui homologação? </span>
          <Link href="/cadastro" className="text-primary font-bold hover:underline">
            Cadastrar CNPJ gratuitamente
          </Link>
        </div>
      </div>
    </div>
  );
}
