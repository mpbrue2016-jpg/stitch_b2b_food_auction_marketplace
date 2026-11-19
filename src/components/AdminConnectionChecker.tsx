'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

interface ConnectionCheckResult {
  status: 'checking' | 'connected' | 'degraded' | 'disconnected';
  clientConfigured: boolean;
  authReachable: boolean;
  authLabel: string;
  dbReachable: boolean;
  dbCount: number | null;
  dbLatencyMs: number | null;
  serverHealthy: boolean | null;
  adminKeyConfigured: boolean | null;
  schemaReady: boolean | null;
  schemaNote: string | null;
  errorMessage: string | null;
  checkedAt: string | null;
}

const INITIAL_STATE: ConnectionCheckResult = {
  status: 'checking',
  clientConfigured: isSupabaseConfigured,
  authReachable: false,
  authLabel: 'Verificando sessão...',
  dbReachable: false,
  dbCount: null,
  dbLatencyMs: null,
  serverHealthy: null,
  adminKeyConfigured: null,
  schemaReady: null,
  schemaNote: null,
  errorMessage: null,
  checkedAt: null,
};

export function AdminConnectionChecker() {
  const [result, setResult] = useState<ConnectionCheckResult>(INITIAL_STATE);
  const [refreshing, setRefreshing] = useState(false);

  const runCheck = useCallback(async () => {
    setRefreshing(true);
    setResult((prev) => ({ ...prev, status: 'checking', errorMessage: null }));

    if (!isSupabaseConfigured) {
      setResult({
        ...INITIAL_STATE,
        status: 'disconnected',
        clientConfigured: false,
        authLabel: 'Cliente não configurado',
        errorMessage:
          'NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY não estão configuradas.',
        checkedAt: new Date().toLocaleTimeString('pt-BR'),
      });
      setRefreshing(false);
      return;
    }

    try {
      const t0 = performance.now();
      const [sessionRes, dbRes, healthRes] = await Promise.all([
        supabase.auth.getSession(),
        supabase.from('categories').select('*', { count: 'exact', head: true }),
        fetch('/api/admin/health', { cache: 'no-store' }).catch(() => null),
      ]);
      const dbLatencyMs = Math.round(performance.now() - t0);

      const authOk = !sessionRes.error;
      const authLabel = sessionRes.error
        ? `Erro Auth: ${sessionRes.error.message}`
        : sessionRes.data.session
        ? `Sessão ativa (${sessionRes.data.session.user.email || 'autenticada'})`
        : 'Cliente GoTrue ativo (sem sessão local)';

      const dbOk = !dbRes.error;
      let serverHealthy: boolean | null = null;
      let adminKeyConfigured: boolean | null = null;
      let schemaReady: boolean | null = null;
      let schemaNote: string | null = null;

      if (healthRes && healthRes.ok) {
        const hJson = await healthRes.json().catch(() => null);
        if (hJson) {
          serverHealthy = Boolean(hJson.ok);
          adminKeyConfigured = Boolean(hJson.adminKeyConfigured);
          schemaReady = Boolean(hJson.schemaReady);
          schemaNote = typeof hJson.schemaMessage === 'string' ? hJson.schemaMessage : null;
        }
      }

      let nextStatus: ConnectionCheckResult['status'] = 'disconnected';
      if (authOk && dbOk && schemaReady !== false && adminKeyConfigured !== false) {
        nextStatus = 'connected';
      } else if (authOk && dbOk) {
        nextStatus = 'degraded';
      }

      setResult({
        status: nextStatus,
        clientConfigured: true,
        authReachable: authOk,
        authLabel,
        dbReachable: dbOk,
        dbCount: dbRes.count ?? 0,
        dbLatencyMs,
        serverHealthy,
        adminKeyConfigured,
        schemaReady,
        schemaNote,
        errorMessage: dbRes.error ? dbRes.error.message : null,
        checkedAt: new Date().toLocaleTimeString('pt-BR'),
      });
    } catch (err) {
      setResult({
        ...INITIAL_STATE,
        status: 'disconnected',
        clientConfigured: isSupabaseConfigured,
        authLabel: 'Falha de comunicação',
        errorMessage: err instanceof Error ? err.message : 'Erro desconhecido ao testar conexão.',
        checkedAt: new Date().toLocaleTimeString('pt-BR'),
      });
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void runCheck();
  }, [runCheck]);

  const statusMeta = {
    checking: {
      label: 'Verificando...',
      badgeClass: 'bg-surface-container text-on-surface-variant border-outline-variant/40',
      Icon: RefreshCw,
    },
    connected: {
      label: 'Conectado',
      badgeClass: 'bg-secondary-fixed text-on-secondary-fixed border-secondary/30',
      Icon: CheckCircle2,
    },
    degraded: {
      label: 'Conectado (Pendência de Setup)',
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
      Icon: AlertTriangle,
    },
    disconnected: {
      label: 'Desconectado',
      badgeClass: 'bg-error-container text-on-error-container border-error/30',
      Icon: XCircle,
    },
  }[result.status];

  const StatusIcon = statusMeta.Icon;

  return (
    <section className="bg-surface-container-lowest p-5 sm:p-6 rounded-2xl border border-outline-variant/30 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-container pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Activity className="w-4 h-4 text-primary" />
            <h2 className="text-sm sm:text-base font-extrabold text-on-surface">
              Diagnóstico de Conexão Supabase (@/lib/supabase)
            </h2>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${statusMeta.badgeClass}`}
            >
              <StatusIcon
                className={`w-3.5 h-3.5 ${result.status === 'checking' ? 'animate-spin' : ''}`}
              />
              <span>{statusMeta.label}</span>
            </span>
          </div>
          <p className="text-xs text-on-surface-variant">
            Verifica resposta do cliente de autenticação, consulta head na tabela{' '}
            <code className="font-mono text-[11px] bg-surface-container px-1 py-0.5 rounded">
              categories
            </code>{' '}
            e heartbeat administrativo.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void runCheck()}
          disabled={refreshing}
          className="px-3.5 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Verificando...' : 'Testar Conexão'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/20 space-y-1">
          <div className="flex items-center justify-between text-on-surface-variant font-bold">
            <span>Autenticação (GoTrue)</span>
            <ShieldCheck
              className={`w-4 h-4 ${result.authReachable ? 'text-secondary' : 'text-error'}`}
            />
          </div>
          <p className="font-bold text-on-surface">
            {result.authReachable ? 'Respondendo normalmente' : 'Indisponível'}
          </p>
          <p className="text-[11px] text-on-surface-variant truncate" title={result.authLabel}>
            {result.authLabel}
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/20 space-y-1">
          <div className="flex items-center justify-between text-on-surface-variant font-bold">
            <span>Banco de Dados (PostgREST)</span>
            <Database
              className={`w-4 h-4 ${result.dbReachable ? 'text-secondary' : 'text-error'}`}
            />
          </div>
          <p className="font-bold text-on-surface">
            {result.dbReachable
              ? `Online${result.dbLatencyMs !== null ? ` • ${result.dbLatencyMs} ms` : ''}`
              : 'Falha na consulta'}
          </p>
          <p className="text-[11px] text-on-surface-variant">
            {result.dbReachable
              ? `Tabela categories acessível (${result.dbCount ?? 0} registros)`
              : result.errorMessage || 'Sem resposta do servidor'}
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/20 space-y-1">
          <div className="flex items-center justify-between text-on-surface-variant font-bold">
            <span>Backend Admin &amp; Schema</span>
            {result.serverHealthy && result.schemaReady && result.adminKeyConfigured ? (
              <CheckCircle2 className="w-4 h-4 text-secondary" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            )}
          </div>
          <p className="font-bold text-on-surface">
            {result.serverHealthy === null
              ? 'Aguardando sessão Admin'
              : result.schemaReady && result.adminKeyConfigured
              ? 'Pronto para produção'
              : 'Configuração complementar pendente'}
          </p>
          <p className="text-[11px] text-on-surface-variant">
            {result.schemaNote
              ? `${result.schemaNote}${
                  result.adminKeyConfigured === false ? ' • Service Role ausente.' : ''
                }`
              : result.checkedAt
              ? `Última verificação: ${result.checkedAt}`
              : 'Executando diagnóstico...'}
          </p>
        </div>
      </div>
    </section>
  );
}
