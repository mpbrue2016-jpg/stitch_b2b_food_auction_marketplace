import React from 'react';
import Link from 'next/link';

export default function GovernancaPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Header */}
      <div className="space-y-2 border-b border-surface-container pb-5">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed text-xs font-bold">
          <span className="material-symbols-outlined text-[16px]">verified_user</span>
          Governança Fiduciária, Compliance Sanitário &amp; Auditoria B2B
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface">
          Centro de Governança, Compliance &amp; Suporte Operacional
        </h1>
        <p className="text-xs sm:text-sm text-on-surface-variant max-w-3xl">
          Regras regulatórias aplicadas às operações entre indústrias alimentícias, distribuidores e varejistas no ambiente Varejista Online.
        </p>
      </div>

      {/* Sections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section
          id="anvisa"
          className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 shadow-sm space-y-3 scroll-mt-24"
        >
          <div className="flex items-center gap-2 text-secondary">
            <span className="material-symbols-outlined text-[24px]">health_and_safety</span>
            <h2 className="text-lg font-extrabold text-on-surface">Compliance Sanitário ANVISA &amp; MAPA</h2>
          </div>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Todos os lotes publicados passam por validação de GTIN/EAN-13, DUN-14, data limite de validade (Shelf Life / FEFO) e exigência de alvará sanitário e documentação KYC dos participantes no Storage privado.
          </p>
          <ul className="text-xs text-on-surface space-y-1.5 list-disc pl-4">
            <li>Classificação automática FEFO: Longa, Atenção (&le; 90d), Giro Rápido (&lt; 60d) e Crítica (&lt; 30d).</li>
            <li>Bloqueio de comercialização sem dados fiscais e sanitários completos do fornecedor.</li>
            <li>Homologação de documentos pelo Compliance Master antes da liberação de grandes limites Escrow.</li>
          </ul>
          <div className="pt-2">
            <Link href="/painel/fornecedor" className="text-xs font-bold text-primary hover:underline">
              Enviar ou revisar documentos sanitários no painel →
            </Link>
          </div>
        </section>

        <section
          id="worm"
          className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 shadow-sm space-y-3 scroll-mt-24"
        >
          <div className="flex items-center gap-2 text-primary">
            <span className="material-symbols-outlined text-[24px]">fingerprint</span>
            <h2 className="text-lg font-extrabold text-on-surface">Auditoria Forense WORM (SHA-256)</h2>
          </div>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Cada lance, alteração de lote, confirmação de depósito PIX Escrow, agendamento de doca FOB, abertura de disputa e revisão de compliance gera um registro criptográfico imutável com hash SHA-256 em <code>audit_worm_logs</code>.
          </p>
          <ul className="text-xs text-on-surface space-y-1.5 list-disc pl-4">
            <li>Trilha append-only protegida contra edição ou exclusão após gravação.</li>
            <li>Termos de Arremate com código de protocolo verificável e hash criptográfico único.</li>
            <li>Monitoramento contínuo de webhooks bancários SPI e alertas de integridade.</li>
          </ul>
          <div className="pt-2">
            <Link href="/painel/admin" className="text-xs font-bold text-primary hover:underline">
              Acessar Console de Auditoria WORM →
            </Link>
          </div>
        </section>

        <section
          id="termos"
          className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 shadow-sm space-y-3 scroll-mt-24"
        >
          <div className="flex items-center gap-2 text-primary">
            <span className="material-symbols-outlined text-[24px]">account_balance</span>
            <h2 className="text-lg font-extrabold text-on-surface">Termos de Arremate &amp; Custódia Escrow</h2>
          </div>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Os pagamentos via PIX SPI ou TED são segregados em conta de custódia fiduciária até a conferência cega da carga na doca FOB. O split automático deduz a taxa vigente configurada pelo administrador e liquida o saldo líquido ao fornecedor em D+0.
          </p>
          <ul className="text-xs text-on-surface space-y-1.5 list-disc pl-4">
            <li>Anti-sniping automático de +2 minutos para lances realizados nos últimos segundos do pregão.</li>
            <li>Direito de abertura de divergência na doca com bloqueio preventivo imediato do repasse.</li>
            <li>Conciliação verificada por assinatura HMAC no callback de pagamento SPI.</li>
          </ul>
          <div className="pt-2">
            <Link href="/pedidos" className="text-xs font-bold text-primary hover:underline">
              Consultar Termos de Arremate &amp; Pedidos →
            </Link>
          </div>
        </section>

        <section
          id="suporte"
          className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 shadow-sm space-y-3 scroll-mt-24"
        >
          <div className="flex items-center gap-2 text-secondary">
            <span className="material-symbols-outlined text-[24px]">support_agent</span>
            <h2 className="text-lg font-extrabold text-on-surface">Central de Ajuda &amp; Mediação B2B 24/7</h2>
          </div>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Precisa destravar agendamento de doca, revisar limite de crédito Escrow, auditar divergência de paletização ou homologar sua conta corporativa? Utilize os canais oficiais integrados diretamente à sua conta.
          </p>
          <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Mesa Fiduciária &amp; Disputas:</span>
              <strong className="font-mono text-on-surface">compliance@varejistaonline.com.br</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Torre de Controle Logístico (WMS):</span>
              <strong className="font-mono text-on-surface">docas@varejistaonline.com.br</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Horário de Mediação Ativa:</span>
              <strong className="text-secondary">Segunda a Domingo • 24h</strong>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/painel/comprador"
              className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-container transition-colors"
            >
              Painel Comprador
            </Link>
            <Link
              href="/painel/fornecedor"
              className="px-4 py-2 rounded-xl bg-surface-container text-on-surface text-xs font-bold hover:bg-surface-container-high transition-colors"
            >
              Painel Fornecedor
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
