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
    id: 'banner-modelo-01',
    eyebrow: 'Rodada Industrial SP · Custódia Escrow BACEN',
    titulo: 'Cargas Fechadas direto da Indústria com até 70% OFF',
    subtitulo:
      'Negocie paletes PBR homologados ANVISA/MAPA com repasse D+0 garantido e retirada FOB agendada em 48 horas.',
    ctaLabel: 'Explorar Leilões ao Vivo',
    ctaHref: '/leiloes',
    imagemUrl: '/images/banners/banner-atacado-pallets.jpg',
    ordem: 1,
    ativo: true,
    intervaloSegundos: 6,
    criadoEm: '2026-11-16T08:00:00.000Z',
  },
  {
    id: 'banner-modelo-02',
    eyebrow: 'Oportunidades FEFO · Validade Auditada',
    titulo: 'Giro Rápido em Cafés, Óleos Vegetais e Laticínios UHT',
    subtitulo:
      'Lotes com laudo sanitário rastreável pelo CNPJ e deságio imediato para abastecimento de redes e atacadistas.',
    ctaLabel: 'Ver Catálogo Completo',
    ctaHref: '/catalogo',
    imagemUrl: '/images/banners/banner-safra-alimentos.jpg',
    ordem: 2,
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
    ordem: 3,
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
