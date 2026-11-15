import { MOCK_AUCTION_LOTS, MOCK_ORDERS, MOCK_PROPOSALS } from './mock-data';
import { AuctionBid, AuctionLot, EscrowOrder, NegotiationProposal } from './types';

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
}

const globalForStore = globalThis as unknown as {
  __varejistaMarketplaceStore?: MarketplaceStoreState;
};

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
  };
}

export const marketplaceStore: MarketplaceStoreState =
  globalForStore.__varejistaMarketplaceStore || createInitialState();

if (!globalForStore.__varejistaMarketplaceStore) {
  globalForStore.__varejistaMarketplaceStore = marketplaceStore;
}
