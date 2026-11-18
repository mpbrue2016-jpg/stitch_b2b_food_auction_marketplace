import type {
  AuctionBid,
  AuctionLot,
  CommissionRule,
  EscrowOrder,
  HomeBanner,
  NegotiationProposal,
  ProductBatch,
  ProductCategory,
  ShelfLifeStatus,
} from '@/lib/types';

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

export function computeDaysUntilValidity(dateStr: string): number {
  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) return 90;
  return Math.max(0, Math.ceil((target.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

export function computeShelfLifeStatus(days: number): ShelfLifeStatus {
  if (days < 30) return 'critica';
  if (days < 60) return 'giro_rapido';
  if (days <= 90) return 'atencao';
  return 'longa';
}

export function anonymizeCnpj(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return '**.***.***/0001-**';
  return `**.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-**`;
}

export function mapDbAuctionToAuctionLot(row: Record<string, unknown>): AuctionLot {
  const productRow = (row.products || row.produto || {}) as Record<string, unknown>;
  const dataValidade = String(productRow.data_validade || new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0]);
  const diasRestantes = computeDaysUntilValidity(dataValidade);
  const totalUnidades = Math.max(1, Number(productRow.total_unidades ?? 1));
  const lanceAtual = Number(row.lance_atual ?? row.lance_inicial ?? 0);
  const unidadesPorEmbalagem = Math.max(1, Number(productRow.unidades_por_embalagem ?? 1));

  const produto: ProductBatch = {
    id: String(productRow.id || row.produto_id || ''),
    sku: String(productRow.sku || ''),
    titulo: String(productRow.titulo || 'Lote B2B'),
    descricao: String(productRow.descricao || ''),
    marca: String(productRow.marca || ''),
    fabricante: String(productRow.fabricante || ''),
    origem: String(productRow.origem_cd || 'CD São Paulo - SP'),
    categoriaId: String(productRow.categoria_id || ''),
    gtinEan: String(productRow.gtin_ean || ''),
    dun14: String(productRow.dun14 || ''),
    imagemUrl: String(productRow.imagem_url || '/images/banners/banner-atacado-pallets.jpg'),
    embalagem: String(
      productRow.embalagem || `Caixa c/ ${unidadesPorEmbalagem} un`
    ),
    unidadesPorEmbalagem,
    totalCaixas: Number(productRow.total_caixas ?? 1),
    totalUnidades,
    paletes: Number(productRow.paletes_pbr ?? 1),
    dataValidade,
    diasRestantesValidade: diasRestantes,
    statusShelfLife: (productRow.status_shelf_life as ShelfLifeStatus) || computeShelfLifeStatus(diasRestantes),
    laudoSanitarioAnvisa: Boolean(productRow.laudo_sanitario_anvisa ?? true),
    statusFiscal: (productRow.status_fiscal as ProductBatch['statusFiscal']) || 'homologado',
    precoReferenciaMercado: Number(productRow.preco_referencia_mercado ?? 0),
  };

  return {
    id: String(row.id),
    codigoLote: String(row.codigo_lote || ''),
    produto,
    tipoVenda: (row.tipo_venda as AuctionLot['tipoVenda']) || 'leilao',
    lanceInicial: Number(row.lance_inicial ?? 0),
    lanceAtual,
    incrementoMinimo: Number(row.incremento_minimo ?? 500),
    precoArremateImediato: row.preco_arremate_imediato ? Number(row.preco_arremate_imediato) : undefined,
    precoUnitarioAtual: Number((lanceAtual / totalUnidades).toFixed(2)),
    margemEstimadaRevenda: Number(row.margem_estimada_revenda ?? 35),
    totalLances: Number(row.total_lances ?? 0),
    ultimoLanceEmpresa: row.ultimo_lance_empresa ? String(row.ultimo_lance_empresa) : undefined,
    terminaEm: String(row.termina_em || new Date().toISOString()),
    status: (row.status as AuctionLot['status']) || 'ativo',
    raioKm: Number(row.raio_km ?? 45),
    tipoFrete: (row.tipo_frete as AuctionLot['tipoFrete']) || 'FOB',
  };
}

export function mapDbBidToAuctionBid(
  row: Record<string, unknown>,
  winnerId?: string | null
): AuctionBid {
  const profile = (row.profiles || {}) as Record<string, unknown>;
  const compradorId = String(row.comprador_id || '');
  return {
    id: String(row.id),
    loteId: String(row.auction_id || ''),
    compradorId,
    empresaNome: String(profile.nome_fantasia || 'Comprador Homologado'),
    cnpjAnonimizado: anonymizeCnpj(String(profile.cnpj || '')),
    valorLance: Number(row.valor_lance ?? 0),
    valorUnitario: Number(row.valor_unitario ?? 0),
    criadoEm: String(row.created_at || new Date().toISOString()),
    ehVencedor: Boolean(winnerId && winnerId === compradorId),
  };
}

export function mapDbOrderToEscrowOrder(row: Record<string, unknown>): EscrowOrder {
  const auction = (row.auctions || {}) as Record<string, unknown>;
  const product = (auction.products || {}) as Record<string, unknown>;
  const buyer = (row.comprador || {}) as Record<string, unknown>;
  const supplier = (row.fornecedor || {}) as Record<string, unknown>;

  return {
    id: String(row.id),
    codigoPedido: String(row.codigo_pedido || ''),
    loteId: String(row.auction_id || ''),
    tituloLote: String(
      product.titulo ||
        (auction.codigo_lote ? `${auction.codigo_lote} • Lote B2B` : `Pedido ${row.codigo_pedido}`)
    ),
    compradorId: String(row.comprador_id || ''),
    compradorNome: String(buyer.nome_fantasia || buyer.razao_social || 'Comprador B2B'),
    fornecedorId: String(row.fornecedor_id || ''),
    fornecedorNome: String(supplier.nome_fantasia || supplier.razao_social || 'Indústria Fornecedora'),
    valorTotalArremate: Number(row.valor_total_arremate ?? 0),
    percentualComissao: Number(row.percentual_comissao ?? 6),
    valorComissaoPlataforma: Number(row.valor_comissao_plataforma ?? 0),
    valorRepasseLiquidoFornecedor: Number(row.valor_repasse_liquido ?? 0),
    statusPagamento: (row.status_pagamento as EscrowOrder['statusPagamento']) || 'aguardando_pagamento',
    statusLogistica: (row.status_logistica as EscrowOrder['statusLogistica']) || 'agendamento_doca',
    docaAgendada: row.doca_agendada ? String(row.doca_agendada) : undefined,
    criadoEm: String(row.created_at || new Date().toISOString()),
    termoArremateHash: row.termo_arremate_hash ? String(row.termo_arremate_hash) : undefined,
    comprovantePix: row.comprovante_pix_spi ? String(row.comprovante_pix_spi) : undefined,
    motivoDisputa: row.motivo_disputa ? String(row.motivo_disputa) : undefined,
  };
}

export function mapDbProposalToNegotiationProposal(row: Record<string, unknown>): NegotiationProposal {
  const auction = (row.auctions || {}) as Record<string, unknown>;
  const product = (auction.products || {}) as Record<string, unknown>;
  const buyer = (row.comprador || {}) as Record<string, unknown>;
  const supplier = (row.fornecedor || {}) as Record<string, unknown>;

  return {
    id: String(row.id),
    loteId: String(row.auction_id || ''),
    tituloProduto: String(product.titulo || auction.codigo_lote || 'Lote B2B'),
    compradorId: String(row.comprador_id || ''),
    compradorNome: String(buyer.nome_fantasia || buyer.razao_social || 'Comprador B2B'),
    fornecedorId: String(row.fornecedor_id || ''),
    fornecedorNome: String(supplier.nome_fantasia || supplier.razao_social || 'Fornecedor B2B'),
    quantidadeCaixas: Number(row.quantidade_caixas ?? 1),
    precoUnitarioOfertado: Number(row.preco_unitario_ofertado ?? 0),
    valorTotalProposta: Number(row.valor_total_proposta ?? 0),
    status: (row.status as NegotiationProposal['status']) || 'pendente',
    contrapropostaPrecoUnitario: row.contraproposta_preco_unitario
      ? Number(row.contraproposta_preco_unitario)
      : undefined,
    mensagem: String(row.mensagem || ''),
    criadaEm: String(row.created_at || new Date().toISOString()),
  };
}

export function mapDbDockToAppointment(row: Record<string, unknown>): DockAppointment {
  const order = (row.orders || {}) as Record<string, unknown>;
  return {
    id: String(row.id),
    pedidoId: String(order.codigo_pedido || row.order_id || ''),
    cdOrigem: String(row.cd_origem || ''),
    docaNumero: String(row.doca_numero || ''),
    janelaHoraria: String(row.janela_horaria || ''),
    dataAgendada: String(row.data_agendada || ''),
    placaVeiculo: String(row.placa_veiculo || ''),
    motoristaNome: String(row.motorista_nome || ''),
    status: (row.status as DockAppointment['status']) || 'agendado',
    passeEntradaHash: String(row.passe_entrada_hash || ''),
  };
}

export function mapDbCommissionRule(row: Record<string, unknown>): CommissionRule {
  return {
    id: String(row.id),
    nomeModalidade: String(row.nome_modalidade || ''),
    slug: String(row.slug || ''),
    percentualPadrao: Number(row.percentual_padrao ?? 6),
    descricao: String(row.descricao || ''),
    taxaMinima: row.taxa_minima !== null && row.taxa_minima !== undefined ? Number(row.taxa_minima) : undefined,
    ativo: Boolean(row.ativo ?? true),
    atualizadoEm: String(row.updated_at || row.created_at || new Date().toISOString()),
  };
}

export function mapDbBannerToHomeBanner(row: Record<string, unknown>): HomeBanner {
  return {
    id: String(row.id),
    titulo: String(row.titulo || ''),
    subtitulo: String(row.subtitulo || ''),
    eyebrow: String(row.eyebrow || ''),
    ctaLabel: String(row.cta_label || 'Explorar Lotes'),
    ctaHref: String(row.cta_href || '/catalogo'),
    imagemUrl: String(row.imagem_url || '/images/banners/banner-atacado-pallets.jpg'),
    ordem: Number(row.ordem ?? 1),
    ativo: Boolean(row.ativo ?? true),
    intervaloSegundos: Number(row.intervalo_segundos ?? 6),
    criadoEm: String(row.created_at || new Date().toISOString()),
  };
}

export function mapDbCategoryToProductCategory(
  row: Record<string, unknown>,
  totalLotes = 0
): ProductCategory {
  return {
    id: String(row.id),
    nome: String(row.nome || ''),
    slug: String(row.slug || ''),
    icone: String(row.icone || 'category'),
    totalLotes,
  };
}
