'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-surface-container-lowest p-8 rounded-2xl shadow-xl border border-outline-variant/30 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex w-12 h-12 rounded-xl bg-primary-fixed items-center justify-center text-primary font-bold text-xl">
            <span className="material-symbols-outlined text-[26px]">lock_reset</span>
          </div>
          <h1 className="text-2xl font-extrabold text-on-surface">Recuperação de Senha</h1>
          <p className="text-xs text-on-surface-variant">
            Informe seu e-mail corporativo cadastrado para receber instruções seguras de redefinição de acesso.
          </p>
        </div>

        {submitted ? (
          <div className="p-6 bg-secondary-container/20 rounded-xl border border-secondary/30 text-center space-y-3">
            <span className="material-symbols-outlined text-secondary text-4xl">mark_email_read</span>
            <h4 className="font-bold text-sm text-secondary">E-mail de Recuperação Enviado!</h4>
            <p className="text-xs text-on-surface-variant">
              Enviamos um link com token de segurança de validade de 15 minutos para <strong>{email}</strong>.
            </p>
            <div className="pt-2">
              <Link
                href="/login"
                className="inline-block px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg"
              >
                Voltar ao Login
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
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

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-primary hover:bg-primary-container text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
            >
              <span>Enviar Link de Recuperação</span>
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
