export type UserRole = 'comprador' | 'fornecedor' | 'admin';

export type TipoPessoa = 'PF' | 'PJ';

export type PerfilComercial =
  | 'comprador'
  | 'fornecedor'
  | 'anunciante'
  | 'empresa'
  | 'pessoa_fisica'
  | 'admin';

export type PlatformEnvironment = 'modelo' | 'original';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  tipoPessoa?: TipoPessoa;
  perfilComercial?: PerfilComercial;
  isDemo?: boolean;
  cnpj: string;
  cpf?: string;
  razaoSocial: string;
  nomeFantasia: string;
  inscricaoEstadual?: string;
  telefone?: string;
  endereco?: {
    cidade: string;
    uf: string;
    cep: string;
    logradouro: string;
  };
  limiteCreditoEscrow: number;
  statusAprovacao: 'aprovado' | 'em_analise' | 'pendente';
  dataCadastro: string;
}

export interface ProductCategory {
  id: string;
  nome: string;
  slug: string;
  icone: string;
  totalLotes: number;
  isDemo?: boolean;
}

export type ShelfLifeStatus = 'longa' | 'atencao' | 'giro_rapido' | 'critica';

export interface ProductBatch {
  id: string;
  fornecedorId?: string;
  sku: string;
  titulo: string;
  descricao: string;
  marca: string;
  fabricante: string;
  origem: string;
  categoriaId: string;
  gtinEan: string;
  dun14: string;
  imagemUrl: string;
  embalagem: string; // Ex: "Caixa c/ 20 un de 900ml"
  unidadesPorEmbalagem: number;
  totalCaixas: number;
  totalUnidades: number;
  paletes: number;
  dataValidade: string;
  diasRestantesValidade: number;
  statusShelfLife: ShelfLifeStatus;
  laudoSanitarioAnvisa: boolean;
  statusFiscal: 'homologado' | 'em_analise';
  precoReferenciaMercado: number;
  isDemo?: boolean;
}

export type AuctionStatus = 'ativo' | 'reta_final' | 'encerrado' | 'homologado';

export interface AuctionLot {
  id: string;
  codigoLote: string;
  produto: ProductBatch;
  tipoVenda: 'leilao' | 'venda_direta' | 'giro_rapido';
  lanceInicial: number;
  lanceAtual: number;
  incrementoMinimo: number;
  precoArremateImediato?: number;
  precoUnitarioAtual: number;
  margemEstimadaRevenda: number;
  totalLances: number;
  ultimoLanceEmpresa?: string;
  terminaEm: string; // ISO date string
  status: AuctionStatus;
  raioKm: number;
  tipoFrete: 'FOB' | 'CIF';
  isDemo?: boolean;
}

export interface AuctionBid {
  id: string;
  loteId: string;
  compradorId: string;
  empresaNome: string;
  cnpjAnonimizado: string;
  valorLance: number;
  valorUnitario: number;
  criadoEm: string;
  ehVencedor: boolean;
  isDemo?: boolean;
}

export interface NegotiationProposal {
  id: string;
  loteId: string;
  tituloProduto: string;
  compradorId: string;
  compradorNome: string;
  fornecedorId: string;
  fornecedorNome: string;
  quantidadeCaixas: number;
  precoUnitarioOfertado: number;
  valorTotalProposta: number;
  status: 'pendente' | 'aceita' | 'recusada' | 'contraproposta';
  contrapropostaPrecoUnitario?: number;
  mensagem: string;
  criadaEm: string;
  isDemo?: boolean;
}

export interface CommissionRule {
  id: string;
  nomeModalidade: string;
  slug: string;
  percentualPadrao: number; // Ex: 6%, 20%, etc.
  descricao: string;
  taxaMinima?: number;
  ativo: boolean;
  atualizadoEm: string;
}

export interface EscrowOrder {
  id: string;
  codigoPedido: string;
  loteId: string;
  tituloLote: string;
  compradorId: string;
  compradorNome: string;
  fornecedorId: string;
  fornecedorNome: string;
  valorTotalArremate: number;
  percentualComissao: number;
  valorComissaoPlataforma: number;
  valorRepasseLiquidoFornecedor: number;
  statusPagamento:
    | 'aguardando_pagamento'
    | 'em_custodia_escrow'
    | 'repasse_liquidado_d0'
    | 'em_disputa'
    | 'estornado';
  statusLogistica: 'agendamento_doca' | 'em_transito_fob' | 'conferido_doca' | 'entregue';
  docaAgendada?: string;
  criadoEm: string;
  termoArremateHash?: string;
  comprovantePix?: string;
  motivoDisputa?: string;
  isDemo?: boolean;
}

export interface HomeBanner {
  id: string;
  titulo: string;
  subtitulo: string;
  eyebrow: string;
  ctaLabel: string;
  ctaHref: string;
  imagemUrl: string;
  ordem: number;
  ativo: boolean;
  intervaloSegundos: number;
  criadoEm: string;
  isDemo?: boolean;
}

export interface DemoCompanyShowcase {
  id: string;
  nomeFantasia: string;
  razaoSocial: string;
  cnpjMascarado: string;
  tipo: 'Comprador' | 'Fornecedor' | 'Indústria & Cerealista' | 'Pequeno Mercado';
  segmento: string;
  cidadeUf: string;
  destaque: string;
  categoriaSlug: string;
  imagemUrl: string;
  isDemo: true;
}

export interface DemoIndicatorSeries {
  label: string;
  valorFormatado: string;
  percentualBarra: number;
  cor: 'primary' | 'secondary' | 'tertiary' | 'amber';
  isDemo: true;
}
