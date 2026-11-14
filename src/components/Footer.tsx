import React from 'react';
import Link from 'next/link';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-inverse-surface text-inverse-on-surface border-t border-outline-variant/20 pt-12 pb-8 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 pb-10 border-b border-outline/30">
          {/* Brand & Governance */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary-fixed text-on-primary-fixed flex items-center justify-center font-extrabold text-sm">
                VO
              </div>
              <span className="font-extrabold text-xl text-white tracking-tight">
                Varejista<span className="text-secondary-fixed">Online</span>
              </span>
            </div>
            <p className="text-xs text-outline-variant leading-relaxed max-w-sm">
              Plataforma B2B para leilões industriais, giro rápido de estoque (FEFO) e negociação direta de alimentos e bebidas. Transações 100% integradas com custódia fiduciária auditada e conformidade fiscal/sanitária.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <span className="inline-flex items-center gap-1 text-[10px] bg-surface-container-high/20 px-2 py-1 rounded text-secondary-fixed font-semibold">
                <span className="material-symbols-outlined text-[14px]">verified</span>
                Auditado BACEN Res. 4.656
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] bg-surface-container-high/20 px-2 py-1 rounded text-primary-fixed font-semibold">
                <span className="material-symbols-outlined text-[14px]">lock</span>
                Custódia Escrow Segregada D+0
              </span>
            </div>
          </div>

          {/* Compradores */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-3">Para Varejistas</h4>
            <ul className="space-y-2 text-xs text-outline-variant">
              <li><Link href="/catalogo" className="hover:text-white transition-colors">Catálogo de Lotes</Link></li>
              <li><Link href="/leiloes" className="hover:text-white transition-colors">Pregões ao Vivo</Link></li>
              <li><Link href="/catalogo?filtro=validade_proxima" className="hover:text-white transition-colors">Oportunidades FEFO</Link></li>
              <li><Link href="/painel/comprador" className="hover:text-white transition-colors">Cockpit do Comprador</Link></li>
              <li><Link href="/cadastro" className="hover:text-white transition-colors">Homologação de CNPJ</Link></li>
            </ul>
          </div>

          {/* Indústrias */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-3">Para Indústrias</h4>
            <ul className="space-y-2 text-xs text-outline-variant">
              <li><Link href="/produtos/novo" className="hover:text-white transition-colors">Criar Novo Pregão</Link></li>
              <li><Link href="/painel/fornecedor" className="hover:text-white transition-colors">Cockpit do Fabricante</Link></li>
              <li><Link href="/negociacoes" className="hover:text-white transition-colors">Gestão de Propostas</Link></li>
              <li><Link href="/painel/comissoes" className="hover:text-white transition-colors">Tabela de Take-Rate</Link></li>
              <li><Link href="/pedidos" className="hover:text-white transition-colors">Agendamento de Docas FOB</Link></li>
            </ul>
          </div>

          {/* Governança & Suporte */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-3">Governança</h4>
            <ul className="space-y-2 text-xs text-outline-variant">
              <li><Link href="/painel/admin" className="hover:text-white transition-colors">Painel Administrativo Master</Link></li>
              <li><span className="text-outline-variant/80">Compliance Sanitário ANVISA</span></li>
              <li><span className="text-outline-variant/80">Auditoria Forense WORM</span></li>
              <li><span className="text-outline-variant/80">Termos de Arremate & Escrow</span></li>
              <li><span className="text-outline-variant/80">Central de Ajuda 24/7</span></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-outline-variant">
          <p>© {new Date().getFullYear()} Varejista Online Marketplace B2B Ltda. Todos os direitos reservados.</p>
          <div className="flex items-center gap-4">
            <span className="text-secondary-fixed">● Servidores Online • Latência 18ms</span>
            <span>Versão 2.4.0 (Stitch Pro)</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
