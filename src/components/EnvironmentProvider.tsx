'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import {
  DEMO_ORDERS,
  DEMO_PROPOSALS,
  getDemoBidsByLot,
  getDemoLots,
} from '@/lib/demo-data';
import type { DockAppointment } from '@/lib/supabase/mappers';
import type {
  AuctionBid,
  AuctionLot,
  EscrowOrder,
  NegotiationProposal,
  PlatformEnvironment,
} from '@/lib/types';

export interface TutorialStep {
  id: string;
  titulo: string;
  mensagem: string;
  dica: string;
  href: string;
  ctaLabel: string;
}

export const SMART_TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'fornecedores',
    titulo: 'Fornecedores & Indústrias',
    mensagem: 'Aqui você encontra fornecedores.',
    dica: 'Explore indústrias, cerealistas, distribuidores de hortifruti e pequenos mercados homologados em nosso catálogo.',
    href: '/catalogo',
    ctaLabel: 'Explorar Fornecedores e Lotes',
  },
  {
    id: 'oportunidades',
    titulo: 'Oportunidades Comerciais',
    mensagem: 'Nesta área você visualiza oportunidades comerciais.',
    dica: 'Acompanhe pregões ao vivo, lotes de validade próxima (FEFO) e ofertas com margem estimada acima de 30%.',
    href: '/leiloes',
    ctaLabel: 'Ver Pregões ao Vivo',
  },
  {
    id: 'cadastro-produtos',
    titulo: 'Publicação de Produtos & Lotes',
    mensagem: 'Aqui você cadastra seus produtos.',
    dica: 'Informe marca, GTIN/EAN-13, validade e valor do lote para anunciar seu estoque parado ou carga fechada.',
    href: '/produtos/novo',
    ctaLabel: 'Ver Cadastro de Produto',
  },
  {
    id: 'negociacoes',
    titulo: 'Mesa de Negociações Diretas',
    mensagem: 'Nesta seção você acompanha suas negociações.',
    dica: 'Envie propostas fracionadas, responda contrapropostas e acompanhe pedidos sob custódia Escrow.',
    href: '/negociacoes',
    ctaLabel: 'Abrir Negociações',
  },
  {
    id: 'administracao',
    titulo: 'Painel & Administração da Empresa',
    mensagem: 'Aqui você administra sua empresa.',
    dica: 'Monitore limite Escrow, agendamentos de doca FOB, pedidos e regras cadastrais no painel do seu perfil.',
    href: '/painel/comprador',
    ctaLabel: 'Conhecer Painel da Empresa',
  },
];

export interface SimulatedCartItem {
  lot: AuctionLot;
  quantidade: number;
  precoTotal: number;
}

interface SandboxState {
  simulatedLots: AuctionLot[];
  simulatedBidsByLot: Record<string, AuctionBid[]>;
  simulatedCart: SimulatedCartItem[];
  simulatedProposals: NegotiationProposal[];
  simulatedOrders: EscrowOrder[];
  simulatedDocks: DockAppointment[];
}

const SANDBOX_STORAGE_KEY = 'varejista_online_demo_sandbox_v1';
const ENV_STORAGE_KEY = 'varejista_online_env_mode_v1';
const TUTORIAL_DISMISSED_KEY = 'varejista_online_tutorial_dismissed_v1';

function createInitialSandbox(): SandboxState {
  const lots = getDemoLots();
  const bidsMap: Record<string, AuctionBid[]> = {};
  for (const lot of lots) {
    bidsMap[lot.id] = getDemoBidsByLot(lot.id);
  }
  return {
    simulatedLots: lots,
    simulatedBidsByLot: bidsMap,
    simulatedCart: [],
    simulatedProposals: DEMO_PROPOSALS,
    simulatedOrders: DEMO_ORDERS,
    simulatedDocks: [
      {
        id: 'demo-dock-1',
        pedidoId: 'PED-2026-0001',
        cdOrigem: 'CD Vinhedo - SP',
        docaNumero: 'Doca 02A',
        janelaHoraria: '08:00 - 10:00',
        dataAgendada: new Date(Date.now() + 86400 * 1000).toISOString().split('T')[0],
        placaVeiculo: 'DEMO1A2',
        motoristaNome: 'Motorista Exemplo (Modelo)',
        status: 'agendado',
        passeEntradaHash: 'PASSE-MODELO-DEMO-01',
      },
    ],
  };
}

interface EnvironmentContextValue {
  envMode: PlatformEnvironment;
  isDemoMode: boolean;
  setEnvMode: (mode: PlatformEnvironment) => void;
  tutorialOpen: boolean;
  tutorialStepIndex: number;
  openTutorial: (stepIndex?: number) => void;
  closeTutorial: () => void;
  nextTutorialStep: () => void;
  prevTutorialStep: () => void;
  goToTutorialStep: (index: number) => void;
  sandbox: SandboxState;
  simulateBid: (
    lot: AuctionLot,
    amount: number
  ) => { ok: boolean; message: string; extended?: boolean };
  simulateAddToCart: (lot: AuctionLot, qty?: number) => void;
  simulateUpdateCartQty: (loteId: string, qty: number) => void;
  simulateRemoveFromCart: (loteId: string) => void;
  simulateClearCart: () => void;
  simulateCreateProposal: (input: {
    lot: AuctionLot;
    quantidadeCaixas: number;
    precoUnitarioOfertado: number;
    mensagem: string;
  }) => NegotiationProposal;
  simulateProposalAction: (
    proposalId: string,
    action: 'accept' | 'reject' | 'counter',
    counterPrice?: number
  ) => void;
  simulateCreateProduct: (input: Partial<AuctionLot> & { titulo: string; lanceInicial: number }) => AuctionLot;
  simulateCreateOrder: (lot: AuctionLot, amount: number) => EscrowOrder;
  simulateConfirmDelivery: (orderId: string) => void;
  simulateScheduleDock: (input: {
    pedidoId: string;
    janelaHoraria: string;
    placaVeiculo: string;
    motoristaNome: string;
    dataAgendada: string;
    docaNumero?: string;
  }) => DockAppointment;
  resetSandbox: () => void;
}

const EnvironmentContext = createContext<EnvironmentContextValue | null>(null);

export const EnvironmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [envMode, setEnvModeState] = useState<PlatformEnvironment>('modelo');
  const [manualChoice, setManualChoice] = useState<boolean>(false);
  const [tutorialOpen, setTutorialOpen] = useState<boolean>(false);
  const [tutorialStepIndex, setTutorialStepIndex] = useState<number>(0);
  const [sandbox, setSandbox] = useState<SandboxState>(() => createInitialSandbox());

  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const envParam = urlParams.get('env');
      const welcomeParam = urlParams.get('welcome');
      const savedEnv = window.sessionStorage.getItem(ENV_STORAGE_KEY);

      if (envParam === 'modelo' || envParam === 'original') {
        setEnvModeState(envParam);
        setManualChoice(true);
        window.sessionStorage.setItem(ENV_STORAGE_KEY, envParam);
      } else if (savedEnv === 'modelo' || savedEnv === 'original') {
        setEnvModeState(savedEnv);
        setManualChoice(true);
      }

      if (welcomeParam === '1') {
        setTutorialStepIndex(0);
        setTutorialOpen(true);
      } else {
        const dismissed = window.sessionStorage.getItem(TUTORIAL_DISMISSED_KEY);
        if (!dismissed) {
          setTutorialOpen(true);
        }
      }

      const rawSandbox = window.sessionStorage.getItem(SANDBOX_STORAGE_KEY);
      if (rawSandbox) {
        const parsed = JSON.parse(rawSandbox) as SandboxState;
        if (Array.isArray(parsed?.simulatedLots) && parsed.simulatedLots.length > 0) {
          setSandbox(parsed);
        }
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      // Visitante sem cadastro explora sempre o Ambiente Modelo
      if (envMode !== 'modelo') {
        setEnvModeState('modelo');
      }
    } else if (!manualChoice) {
      // Usuário real autenticado inicia no Ambiente Original (dados verdadeiros)
      setEnvModeState('original');
    }
  }, [user, authLoading, manualChoice, envMode]);

  const persistSandbox = useCallback((next: SandboxState) => {
    setSandbox(next);
    try {
      window.sessionStorage.setItem(SANDBOX_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage quota errors
    }
  }, []);

  const setEnvMode = useCallback((mode: PlatformEnvironment) => {
    setManualChoice(true);
    setEnvModeState(mode);
    try {
      window.sessionStorage.setItem(ENV_STORAGE_KEY, mode);
    } catch {
      // ignore
    }
  }, []);

  const openTutorial = useCallback((stepIndex = 0) => {
    setTutorialStepIndex(Math.max(0, Math.min(SMART_TUTORIAL_STEPS.length - 1, stepIndex)));
    setTutorialOpen(true);
  }, []);

  const closeTutorial = useCallback(() => {
    setTutorialOpen(false);
    try {
      window.sessionStorage.setItem(TUTORIAL_DISMISSED_KEY, '1');
    } catch {
      // ignore
    }
  }, []);

  const nextTutorialStep = useCallback(() => {
    setTutorialStepIndex((prev) =>
      prev < SMART_TUTORIAL_STEPS.length - 1 ? prev + 1 : prev
    );
  }, []);

  const prevTutorialStep = useCallback(() => {
    setTutorialStepIndex((prev) => (prev > 0 ? prev - 1 : 0));
  }, []);

  const goToTutorialStep = useCallback((index: number) => {
    setTutorialStepIndex(Math.max(0, Math.min(SMART_TUTORIAL_STEPS.length - 1, index)));
  }, []);

  const simulateBid = useCallback(
    (lot: AuctionLot, amount: number) => {
      const currentLot = sandbox.simulatedLots.find((l) => l.id === lot.id) || lot;
      const minRequired = currentLot.lanceAtual + currentLot.incrementoMinimo;
      if (amount < minRequired) {
        return {
          ok: false,
          message: `Na simulação, o lance mínimo é R$ ${minRequired.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
        };
      }

      const diffMinutes = (new Date(currentLot.terminaEm).getTime() - Date.now()) / 60000;
      const extended = diffMinutes <= 3;
      const nextTerminaEm = extended
        ? new Date(new Date(currentLot.terminaEm).getTime() + 3 * 60000).toISOString()
        : currentLot.terminaEm;

      const updatedLot: AuctionLot = {
        ...currentLot,
        lanceAtual: amount,
        totalLances: currentLot.totalLances + 1,
        ultimoLanceEmpresa: 'Você (Simulação Modelo)',
        precoUnitarioAtual: Number((amount / Math.max(1, currentLot.produto.totalUnidades)).toFixed(2)),
        terminaEm: nextTerminaEm,
        status: extended ? 'reta_final' : currentLot.status,
        isDemo: true,
      };

      const newBid: AuctionBid = {
        id: `demo-bid-sim-${Date.now()}`,
        loteId: lot.id,
        compradorId: 'visitante-simulacao',
        empresaNome: 'Você (Visitante • Simulação)',
        cnpjAnonimizado: '**.000.000/0001-**',
        valorLance: amount,
        valorUnitario: updatedLot.precoUnitarioAtual,
        criadoEm: new Date().toISOString(),
        ehVencedor: true,
        isDemo: true,
      };

      const prevBids = (sandbox.simulatedBidsByLot[lot.id] || getDemoBidsByLot(lot.id)).map((b) => ({
        ...b,
        ehVencedor: false,
      }));

      const nextLots = sandbox.simulatedLots.some((l) => l.id === lot.id)
        ? sandbox.simulatedLots.map((l) => (l.id === lot.id ? updatedLot : l))
        : [updatedLot, ...sandbox.simulatedLots];

      persistSandbox({
        ...sandbox,
        simulatedLots: nextLots,
        simulatedBidsByLot: {
          ...sandbox.simulatedBidsByLot,
          [lot.id]: [newBid, ...prevBids],
        },
      });

      return {
        ok: true,
        message: 'Lance simulado registrado apenas no Ambiente Modelo (sem efeito comercial real).',
        extended,
      };
    },
    [sandbox, persistSandbox]
  );

  const simulateAddToCart = useCallback(
    (lot: AuctionLot, qty = 1) => {
      const unitLotPrice = lot.precoArremateImediato ?? lot.lanceAtual;
      const existing = sandbox.simulatedCart.find((item) => item.lot.id === lot.id);
      const nextCart = existing
        ? sandbox.simulatedCart.map((item) =>
            item.lot.id === lot.id
              ? {
                  ...item,
                  quantidade: item.quantidade + qty,
                  precoTotal: Number(((item.quantidade + qty) * unitLotPrice).toFixed(2)),
                }
              : item
          )
        : [
            ...sandbox.simulatedCart,
            {
              lot: { ...lot, isDemo: true },
              quantidade: qty,
              precoTotal: Number((qty * unitLotPrice).toFixed(2)),
            },
          ];

      persistSandbox({ ...sandbox, simulatedCart: nextCart });
    },
    [sandbox, persistSandbox]
  );

  const simulateUpdateCartQty = useCallback(
    (loteId: string, qty: number) => {
      const safeQty = Math.max(1, qty);
      const nextCart = sandbox.simulatedCart.map((item) => {
        if (item.lot.id !== loteId) return item;
        const unit = item.lot.precoArremateImediato ?? item.lot.lanceAtual;
        return {
          ...item,
          quantidade: safeQty,
          precoTotal: Number((safeQty * unit).toFixed(2)),
        };
      });
      persistSandbox({ ...sandbox, simulatedCart: nextCart });
    },
    [sandbox, persistSandbox]
  );

  const simulateRemoveFromCart = useCallback(
    (loteId: string) => {
      persistSandbox({
        ...sandbox,
        simulatedCart: sandbox.simulatedCart.filter((item) => item.lot.id !== loteId),
      });
    },
    [sandbox, persistSandbox]
  );

  const simulateClearCart = useCallback(() => {
    persistSandbox({ ...sandbox, simulatedCart: [] });
  }, [sandbox, persistSandbox]);

  const simulateCreateProposal = useCallback(
    (input: {
      lot: AuctionLot;
      quantidadeCaixas: number;
      precoUnitarioOfertado: number;
      mensagem: string;
    }) => {
      const total = Number(
        (
          input.quantidadeCaixas *
          Math.max(1, input.lot.produto.unidadesPorEmbalagem) *
          input.precoUnitarioOfertado
        ).toFixed(2)
      );
      const prop: NegotiationProposal = {
        id: `demo-prop-sim-${Date.now()}`,
        loteId: input.lot.id,
        tituloProduto: input.lot.produto.titulo,
        compradorId: 'visitante-simulacao',
        compradorNome: 'Você (Simulação Modelo)',
        fornecedorId: input.lot.produto.fornecedorId || 'demo-fornecedor',
        fornecedorNome: input.lot.produto.fabricante || 'Fornecedor Modelo',
        quantidadeCaixas: input.quantidadeCaixas,
        precoUnitarioOfertado: input.precoUnitarioOfertado,
        valorTotalProposta: total,
        status: 'pendente',
        mensagem: input.mensagem || 'Proposta simulada no Ambiente Modelo.',
        criadaEm: new Date().toISOString(),
        isDemo: true,
      };
      persistSandbox({
        ...sandbox,
        simulatedProposals: [prop, ...sandbox.simulatedProposals],
      });
      return prop;
    },
    [sandbox, persistSandbox]
  );

  const simulateProposalAction = useCallback(
    (proposalId: string, action: 'accept' | 'reject' | 'counter', counterPrice?: number) => {
      const next = sandbox.simulatedProposals.map((p) => {
        if (p.id !== proposalId) return p;
        if (action === 'accept') {
          return { ...p, status: 'aceita' as const };
        }
        if (action === 'reject') {
          return { ...p, status: 'recusada' as const };
        }
        return {
          ...p,
          status: 'contraproposta' as const,
          contrapropostaPrecoUnitario: counterPrice || p.precoUnitarioOfertado * 1.05,
        };
      });
      persistSandbox({ ...sandbox, simulatedProposals: next });
    },
    [sandbox, persistSandbox]
  );

  const simulateCreateProduct = useCallback(
    (input: Partial<AuctionLot> & { titulo: string; lanceInicial: number }) => {
      const boxes = Math.max(1, Number(input.produto?.totalCaixas || 50));
      const unitsPerBox = Math.max(1, Number(input.produto?.unidadesPorEmbalagem || 12));
      const totalUnits = boxes * unitsPerBox;
      const newLot: AuctionLot = {
        id: `demo-lote-sim-${Date.now()}`,
        codigoLote: `SIM-${String(Date.now()).slice(-4)}`,
        tipoVenda: input.tipoVenda || 'leilao',
        lanceInicial: input.lanceInicial,
        lanceAtual: input.lanceInicial,
        incrementoMinimo: input.incrementoMinimo || 150,
        precoArremateImediato: input.precoArremateImediato || Math.round(input.lanceInicial * 1.3),
        precoUnitarioAtual: Number((input.lanceInicial / totalUnits).toFixed(2)),
        margemEstimadaRevenda: 36,
        totalLances: 0,
        ultimoLanceEmpresa: 'Lote Simulado no Ambiente Modelo',
        terminaEm: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
        status: 'ativo',
        raioKm: 25,
        tipoFrete: input.tipoFrete || 'FOB',
        isDemo: true,
        produto: {
          id: `demo-prod-sim-${Date.now()}`,
          sku: `SIM-${String(Date.now()).slice(-5)}`,
          titulo: input.titulo,
          descricao: input.produto?.descricao || 'Produto criado apenas para demonstração interativa.',
          marca: input.produto?.marca || 'Marca Modelo',
          fabricante: input.produto?.fabricante || 'Empresa Demonstração',
          origem: input.produto?.origem || 'CD São Paulo - SP (Modelo)',
          categoriaId: input.produto?.categoriaId || 'alimentos-secos',
          gtinEan: input.produto?.gtinEan || '7890000000001',
          dun14: '17890000000008',
          imagemUrl: input.produto?.imagemUrl || '/images/lotes/lote-418-cafe.webp',
          embalagem: `Caixa c/ ${unitsPerBox} un`,
          unidadesPorEmbalagem: unitsPerBox,
          totalCaixas: boxes,
          totalUnidades: totalUnits,
          paletes: input.produto?.paletes || 2,
          dataValidade:
            input.produto?.dataValidade ||
            new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
          diasRestantesValidade: 90,
          statusShelfLife: 'atencao',
          laudoSanitarioAnvisa: true,
          statusFiscal: 'homologado',
          precoReferenciaMercado: Number(((input.lanceInicial / totalUnits) * 1.65).toFixed(2)),
          isDemo: true,
        },
      };
      persistSandbox({
        ...sandbox,
        simulatedLots: [newLot, ...sandbox.simulatedLots],
      });
      return newLot;
    },
    [sandbox, persistSandbox]
  );

  const simulateCreateOrder = useCallback(
    (lot: AuctionLot, amount: number) => {
      const rate = lot.tipoVenda === 'venda_direta' ? 5 : lot.tipoVenda === 'giro_rapido' ? 8.5 : 6;
      const commission = Number(((amount * rate) / 100).toFixed(2));
      const net = Number((amount - commission).toFixed(2));
      const order: EscrowOrder = {
        id: `demo-ord-sim-${Date.now()}`,
        codigoPedido: `PED-SIM-${String(Date.now()).slice(-4)}`,
        loteId: lot.id,
        tituloLote: lot.produto.titulo,
        compradorId: 'visitante-simulacao',
        compradorNome: 'Você (Simulação Modelo)',
        fornecedorId: lot.produto.fornecedorId || 'demo-fornecedor',
        fornecedorNome: lot.produto.fabricante || 'Fornecedor Modelo',
        valorTotalArremate: amount,
        percentualComissao: rate,
        valorComissaoPlataforma: commission,
        valorRepasseLiquidoFornecedor: net,
        statusPagamento: 'em_custodia_escrow',
        statusLogistica: 'agendamento_doca',
        docaAgendada: 'Simulação: Aguardando agendamento de doca modelo',
        criadoEm: new Date().toISOString(),
        termoArremateHash: `SIMULACAO-HASH-${Date.now()}`,
        comprovantePix: 'PIX-SIMULACAO-AMBIENTE-MODELO',
        isDemo: true,
      };
      persistSandbox({
        ...sandbox,
        simulatedOrders: [order, ...sandbox.simulatedOrders],
      });
      return order;
    },
    [sandbox, persistSandbox]
  );

  const simulateConfirmDelivery = useCallback(
    (orderId: string) => {
      const next = sandbox.simulatedOrders.map((o) =>
        o.id === orderId
          ? {
              ...o,
              statusPagamento: 'repasse_liquidado_d0' as const,
              statusLogistica: 'entregue' as const,
            }
          : o
      );
      persistSandbox({ ...sandbox, simulatedOrders: next });
    },
    [sandbox, persistSandbox]
  );

  const simulateScheduleDock = useCallback(
    (input: {
      pedidoId: string;
      janelaHoraria: string;
      placaVeiculo: string;
      motoristaNome: string;
      dataAgendada: string;
      docaNumero?: string;
    }) => {
      const apt: DockAppointment = {
        id: `demo-dock-sim-${Date.now()}`,
        pedidoId: input.pedidoId,
        cdOrigem: 'CD Modelo Jundiaí - SP',
        docaNumero: input.docaNumero || 'Doca 03A (Simulação)',
        janelaHoraria: input.janelaHoraria,
        dataAgendada: input.dataAgendada,
        placaVeiculo: input.placaVeiculo.toUpperCase(),
        motoristaNome: input.motoristaNome,
        status: 'agendado',
        passeEntradaHash: `PASSE-SIM-${String(Date.now()).slice(-5)}`,
      };
      const nextOrders = sandbox.simulatedOrders.map((o) =>
        o.codigoPedido === input.pedidoId || o.id === input.pedidoId
          ? {
              ...o,
              statusLogistica: 'em_transito_fob' as const,
              docaAgendada: `${apt.docaNumero} • ${apt.dataAgendada} (${apt.janelaHoraria})`,
            }
          : o
      );
      persistSandbox({
        ...sandbox,
        simulatedDocks: [apt, ...sandbox.simulatedDocks.filter((d) => d.pedidoId !== input.pedidoId)],
        simulatedOrders: nextOrders,
      });
      return apt;
    },
    [sandbox, persistSandbox]
  );

  const resetSandbox = useCallback(() => {
    const initial = createInitialSandbox();
    persistSandbox(initial);
  }, [persistSandbox]);

  const isDemoMode = !user || envMode === 'modelo';

  return (
    <EnvironmentContext.Provider
      value={{
        envMode: isDemoMode ? 'modelo' : 'original',
        isDemoMode,
        setEnvMode,
        tutorialOpen,
        tutorialStepIndex,
        openTutorial,
        closeTutorial,
        nextTutorialStep,
        prevTutorialStep,
        goToTutorialStep,
        sandbox,
        simulateBid,
        simulateAddToCart,
        simulateUpdateCartQty,
        simulateRemoveFromCart,
        simulateClearCart,
        simulateCreateProposal,
        simulateProposalAction,
        simulateCreateProduct,
        simulateCreateOrder,
        simulateConfirmDelivery,
        simulateScheduleDock,
        resetSandbox,
      }}
    >
      {children}
    </EnvironmentContext.Provider>
  );
};

export function useEnvironment(): EnvironmentContextValue {
  const ctx = useContext(EnvironmentContext);
  if (!ctx) {
    throw new Error('useEnvironment deve ser utilizado dentro de EnvironmentProvider.');
  }
  return ctx;
}
