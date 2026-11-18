'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { formatPhoneBr } from '@/lib/format';

export const NotificationsInboxCard: React.FC = () => {
  const { user, notifications, markNotificationRead } = useAuth();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!user) return null;

  const unreadCount = notifications.filter((n) => !n.lido).length;

  const handleMarkOne = async (id: string) => {
    setBusyId(id);
    await markNotificationRead(id);
    setBusyId(null);
  };

  const handleMarkAll = async () => {
    setBusyId('all');
    await markNotificationRead();
    setBusyId(null);
  };

  return (
    <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-container pb-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">notifications</span>
          <h3 className="font-extrabold text-base text-on-surface">
            Central de Alertas &amp; Notificações em Tempo Real
          </h3>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed text-[10px] font-extrabold">
              {unreadCount} {unreadCount === 1 ? 'nova' : 'novas'}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            disabled={busyId === 'all'}
            onClick={() => void handleMarkAll()}
            className="text-xs font-bold text-primary hover:underline disabled:opacity-50"
          >
            {busyId === 'all' ? 'Atualizando...' : 'Marcar todas como lidas'}
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <p className="text-xs text-on-surface-variant py-4 text-center">
          Nenhuma notificação operacional registrada até o momento.
        </p>
      ) : (
        <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1 text-xs">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                notif.lido
                  ? 'bg-surface-container-low/60 border-surface-container text-on-surface-variant'
                  : 'bg-primary-fixed/20 border-primary/25 text-on-surface'
              }`}
            >
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  {!notif.lido && <span className="w-2 h-2 rounded-full bg-tertiary shrink-0" />}
                  <strong className="font-bold text-on-surface">{notif.titulo}</strong>
                  <span className="text-[10px] text-outline font-mono">
                    {new Date(notif.created_at).toLocaleString('pt-BR')}
                  </span>
                </div>
                <p className="text-on-surface-variant">{notif.mensagem}</p>
              </div>
              {!notif.lido && (
                <button
                  type="button"
                  disabled={busyId === notif.id}
                  onClick={() => void handleMarkOne(notif.id)}
                  className="px-3 py-1 rounded-lg bg-surface-container-lowest border border-outline-variant/40 text-[11px] font-bold text-primary hover:bg-surface-container shrink-0 disabled:opacity-50"
                >
                  {busyId === notif.id ? '...' : 'Marcar lida'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const CompanyProfileAndKycCard: React.FC = () => {
  const { user, profile, documents, refreshProfile } = useAuth();
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('SP');
  const [logradouro, setLogradouro] = useState('');
  const [cep, setCep] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [openingDocId, setOpeningDocId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setNomeFantasia(profile.nomeFantasia || '');
    setTelefone(profile.telefone || '');
    setCidade(profile.endereco?.cidade || '');
    setUf(profile.endereco?.uf || 'SP');
    setLogradouro(profile.endereco?.logradouro || '');
    setCep(profile.endereco?.cep || '');
  }, [profile]);

  if (!user || !profile) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/auth/perfil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nomeFantasia,
          telefone,
          cidade,
          uf,
          logradouro,
          cep,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        await refreshProfile();
        setNotice('Dados cadastrais e endereço logístico atualizados no Supabase.');
      } else {
        setErrorMsg(data?.error || 'Não foi possível atualizar os dados cadastrais.');
      }
    } catch {
      setErrorMsg('Erro de comunicação ao atualizar perfil.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenDocument = async (docId: string) => {
    setOpeningDocId(docId);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/admin/documentos?id=${encodeURIComponent(docId)}`, {
        cache: 'no-store',
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.signedUrl) {
        const link = document.createElement('a');
        link.href = data.signedUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        setErrorMsg(data?.error || 'Não foi possível gerar link seguro para este documento.');
      }
    } catch {
      setErrorMsg('Erro ao acessar arquivo no Storage.');
    } finally {
      setOpeningDocId(null);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Dados Cadastrais & Endereço */}
      <form
        onSubmit={handleSaveProfile}
        className="lg:col-span-7 bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 shadow-sm space-y-4 text-xs"
      >
        <div className="flex items-center justify-between border-b border-surface-container pb-3">
          <h3 className="font-extrabold text-base text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">apartment</span>
            Dados Cadastrais &amp; Endereço Logístico B2B
          </h3>
          <span className="text-[10px] font-mono text-on-surface-variant">{profile.cnpj}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-bold text-on-surface uppercase mb-1">Nome Fantasia:</label>
            <input
              type="text"
              value={nomeFantasia}
              onChange={(e) => setNomeFantasia(e.target.value)}
              className="w-full bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/30"
              required
            />
          </div>
          <div>
            <label className="block font-bold text-on-surface uppercase mb-1">Telefone / WhatsApp:</label>
            <input
              type="tel"
              maxLength={15}
              value={telefone}
              onChange={(e) => setTelefone(formatPhoneBr(e.target.value))}
              className="w-full bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/30"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block font-bold text-on-surface uppercase mb-1">Logradouro / CD:</label>
            <input
              type="text"
              value={logradouro}
              onChange={(e) => setLogradouro(e.target.value)}
              placeholder="Av. / Rodovia, número e complemento"
              className="w-full bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/30"
            />
          </div>
          <div>
            <label className="block font-bold text-on-surface uppercase mb-1">Cidade:</label>
            <input
              type="text"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              className="w-full bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/30"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-bold text-on-surface uppercase mb-1">UF:</label>
              <input
                type="text"
                maxLength={2}
                value={uf}
                onChange={(e) => setUf(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                className="w-full bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/30 uppercase text-center"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-on-surface uppercase mb-1">CEP:</label>
              <input
                type="text"
                maxLength={10}
                value={cep}
                onChange={(e) => setCep(e.target.value)}
                placeholder="00000-000"
                className="w-full bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/30 font-mono"
              />
            </div>
          </div>
        </div>

        {notice && (
          <div className="p-2.5 bg-secondary-container/30 border border-secondary text-secondary rounded-xl font-bold">
            {notice}
          </div>
        )}
        {errorMsg && (
          <div className="p-2.5 bg-error-container text-on-error-container rounded-xl font-bold">
            {errorMsg}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-primary hover:bg-primary-container text-white font-bold rounded-xl shadow-sm transition-colors disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Atualizar Cadastro B2B'}
          </button>
        </div>
      </form>

      {/* Documentos KYC Enviados */}
      <div className="lg:col-span-5 bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 shadow-sm space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-surface-container pb-3">
          <h3 className="font-extrabold text-base text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[20px]">folder_shared</span>
            Dossiê KYC &amp; Licenças Sanitárias
          </h3>
          <span className="text-[10px] font-bold text-on-surface-variant">
            {documents.length} arquivo(s)
          </span>
        </div>

        {documents.length === 0 ? (
          <p className="text-on-surface-variant py-6 text-center">
            Nenhum documento KYC anexado ainda. Utilize o botão de envio no topo do painel para anexar Cartão CNPJ, Contrato Social ou Alvará ANVISA.
          </p>
        ) : (
          <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="p-3 rounded-xl bg-surface-container-low border border-surface-container flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <strong className="text-on-surface block truncate">{doc.nome_arquivo}</strong>
                  <span className="text-[10px] text-on-surface-variant uppercase font-mono">
                    {doc.tipo_documento} • {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase ${
                      doc.status_validacao === 'aprovado'
                        ? 'bg-secondary-fixed text-on-secondary-fixed'
                        : doc.status_validacao === 'rejeitado'
                        ? 'bg-error-container text-on-error-container'
                        : 'bg-primary-fixed text-on-primary-fixed'
                    }`}
                  >
                    {doc.status_validacao}
                  </span>
                  <button
                    type="button"
                    disabled={openingDocId === doc.id}
                    onClick={() => void handleOpenDocument(doc.id)}
                    className="px-2.5 py-1 rounded-lg bg-white border border-outline-variant/40 text-primary font-bold text-[11px] hover:bg-surface-container disabled:opacity-50"
                  >
                    {openingDocId === doc.id ? '...' : 'Abrir'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
