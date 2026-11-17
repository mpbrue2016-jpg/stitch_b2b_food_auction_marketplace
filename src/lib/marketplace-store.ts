import { MOCK_AUCTION_LOTS, MOCK_ORDERS, MOCK_PROPOSALS } from './mock-data';
import { AuctionBid, AuctionLot, EscrowOrder, HomeBanner, NegotiationProposal } from './types';

export interface DockAppointment {
  id: string;
  pedidoId: string;
  cdOrigem: string;
  docaNumero: string;
  janelaHoraria: string;
  dataAgendada: string;
  placaVeiculo: string;
  motoristaNome: string;
  status: 'agendado' | 'em_doca' | 'conferido_cega' | 'liberado';
  passeEntradaHash: string;
}

interface MarketplaceStoreState {
  auctions: AuctionLot[];
  bids: AuctionBid[];
  orders: EscrowOrder[];
  proposals: NegotiationProposal[];
  dockAppointments: DockAppointment[];
  banners: HomeBanner[];
}

const globalForStore = globalThis as unknown as {
  __varejistaMarketplaceStore?: MarketplaceStoreState;
};

export const DEFAULT_HOME_BANNERS: HomeBanner[] = [
  {
    id: 'banner-pequenos-mercados',
    eyebrow: 'Pequenos Mercados & Minimercados · Estoque Parado',
    titulo: 'Tem Estoque Parado no Seu Mercado? Transforme em Dinheiro Hoje',
    subtitulo:
      'Liquide fardos encalhados, sobras de compra ou itens perto do vencimento para mais de 3.140 compradores com custódia Escrow D+0.',
    ctaLabel: 'Liquidar Meu Estoque Parado',
    ctaHref: '/produtos/novo?modelo=pequeno_mercado',
    imagemUrl: '/images/banners/banner-pequenos-mercados.jpg',
    ordem: 1,
    ativo: true,
    intervaloSegundos: 6,
    criadoEm: '2026-11-17T08:00:00.000Z',
  },
  {
    id: 'banner-modelo-01',
    eyebrow: 'Rodada Industrial SP · Custódia Escrow BACEN',
    titulo: 'Cargas Fechadas direto da Indústria com até 70% OFF',
    subtitulo:
      'Negocie paletes PBR homologados ANVISA/MAPA com repasse D+0 garantido e retirada FOB agendada em 48 horas.',
    ctaLabel: 'Explorar Leilões ao Vivo',
    ctaHref: '/leiloes',
    imagemUrl: '/images/banners/banner-atacado-pallets.jpg',
    ordem: 2,
    ativo: true,
    intervaloSegundos: 6,
    criadoEm: '2026-11-16T08:00:00.000Z',
  },
  {
    id: 'banner-modelo-02',
    eyebrow: 'Pregões Multi-Setor · Cerealista, Hortifruti & Limpeza',
    titulo: 'Cerealista, Hortifruti CEASA e Higiene e Limpeza em Lotes',
    subtitulo:
      'Arroz, feijão em sacaria, caixas frescas de hortifruti e combos de limpeza com deságio imediato para mercados e atacarejos.',
    ctaLabel: 'Filtrar Pregões por Segmento',
    ctaHref: '/leiloes',
    imagemUrl: '/images/banners/banner-safra-alimentos.jpg',
    ordem: 3,
    ativo: true,
    intervaloSegundos: 6,
    criadoEm: '2026-11-16T08:05:00.000Z',
  },
  {
    id: 'banner-modelo-03',
    eyebrow: 'Liquidez Imediata · Escoamento B2B',
    titulo: 'Transforme Estoque Parado em Liquidez em até 48 Horas',
    subtitulo:
      'Publique pontas de lote com NF-e integrada, agendamento de doca no CD e pagamento protegido via PIX SPI.',
    ctaLabel: 'Anunciar Lote Agora',
    ctaHref: '/produtos/novo',
    imagemUrl: '/images/banners/banner-logistica-docas.jpg',
    ordem: 4,
    ativo: true,
    intervaloSegundos: 6,
    criadoEm: '2026-11-16T08:10:00.000Z',
  },
];

function createInitialState(): MarketplaceStoreState {
  return {
    auctions: [...MOCK_AUCTION_LOTS],
    bids: [],
    orders: [...MOCK_ORDERS],
    proposals: [...MOCK_PROPOSALS],
    dockAppointments: [
      {
        id: 'apt-101',
        pedidoId: 'PED-2026-9041',
        cdOrigem: 'CD Jundiaí - SP (Rod. Anhanguera, km 58)',
        docaNumero: 'Doca 03A',
        janelaHoraria: '10:00 - 11:00',
        dataAgendada: '2026-11-17',
        placaVeiculo: 'BRA2E19',
        motoristaNome: 'Carlos Eduardo Silva',
        status: 'agendado',
        passeEntradaHash: 'PASSE-JND-2026-9041-A3',
      },
    ],
    banners: [...DEFAULT_HOME_BANNERS],
  };
}

export const marketplaceStore: MarketplaceStoreState =
  globalForStore.__varejistaMarketplaceStore || createInitialState();

if (!globalForStore.__varejistaMarketplaceStore) {
  globalForStore.__varejistaMarketplaceStore = marketplaceStore;
}
if (!marketplaceStore.banners) {
  marketplaceStore.banners = [...DEFAULT_HOME_BANNERS];
}
