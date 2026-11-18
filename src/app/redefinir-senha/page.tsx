'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setErrorMsg('Supabase Auth não configurado neste ambiente.');
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setReady(true);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setReady(true);
        setErrorMsg(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (password.length < 6) {
      setErrorMsg('A nova senha deve conter no mínimo 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('As senhas informadas não coincidem.');
      return;
    }

    if (!isSupabaseConfigured) {
      setErrorMsg('Supabase Auth não configurado neste ambiente.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setErrorMsg(error.message || 'Não foi possível redefinir a senha. Solicite um novo link.');
      return;
    }

    setSuccessMsg('Senha atualizada com sucesso! Redirecionando para o login...');
    setTimeout(() => {
      router.push('/login');
    }, 1500);
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-surface-container-lowest p-8 rounded-2xl shadow-xl border border-outline-variant/30 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex w-12 h-12 rounded-xl bg-primary-fixed items-center justify-center text-primary font-bold text-xl">
            <span className="material-symbols-outlined text-[26px]">password</span>
          </div>
          <h1 className="text-2xl font-extrabold text-on-surface">Definir Nova Senha B2B</h1>
          <p className="text-xs text-on-surface-variant">
            Cadastre sua nova credencial corporativa para acessar o marketplace com custódia Escrow.
          </p>
        </div>

        {successMsg ? (
          <div className="p-6 bg-secondary-container/20 rounded-xl border border-secondary/30 text-center space-y-3">
            <span className="material-symbols-outlined text-secondary text-4xl">verified</span>
            <h4 className="font-bold text-sm text-secondary">{successMsg}</h4>
            <Link
              href="/login"
              className="inline-block px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg"
            >
              Ir para Login Agora
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {!ready && (
              <div className="p-3 bg-surface-container-low rounded-xl text-[11px] text-on-surface-variant">
                Valide este acesso através do link oficial enviado ao seu e-mail corporativo.
              </div>
            )}

            <div>
              <label className="block font-bold text-on-surface uppercase mb-1">
                Nova Senha Corporativa:
              </label>
              <input
                type="password"
                minLength={6}
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-surface-container-low px-3 py-2.5 rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-on-surface uppercase mb-1">
                Confirmar Nova Senha:
              </label>
              <input
                type="password"
                minLength={6}
                placeholder="Repita a nova senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-surface-container-low px-3 py-2.5 rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                required
              />
            </div>

            {errorMsg && (
              <div className="p-2.5 bg-error-container text-on-error-container rounded-xl text-xs font-bold">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-primary hover:bg-primary-container text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{loading ? 'Atualizando senha...' : 'Salvar Nova Senha'}</span>
            </button>
          </form>
        )}

        <div className="pt-2 text-center text-xs">
          <Link href="/login" className="text-primary font-bold hover:underline">
            ← Retornar à tela de login
          </Link>
        </div>
      </div>
    </div>
  );
}
