import { NextRequest, NextResponse } from 'next/server';
import { DockAppointment, marketplaceStore } from '@/lib/marketplace-store';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const pedidoId = searchParams.get('pedidoId');

  if (pedidoId) {
    const apt = marketplaceStore.dockAppointments.find((a) => a.pedidoId === pedidoId);
    return NextResponse.json({ appointment: apt || null });
  }

  return NextResponse.json({ appointments: marketplaceStore.dockAppointments });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pedidoId, janelaHoraria, placaVeiculo, motoristaNome, dataAgendada, docaNumero } = body;

    if (!pedidoId || !janelaHoraria || !placaVeiculo || !motoristaNome) {
      return NextResponse.json(
        { error: 'Parâmetros obrigatórios: pedidoId, janelaHoraria, placaVeiculo, motoristaNome' },
        { status: 400 }
      );
    }

    const cleanPlaca = placaVeiculo.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (cleanPlaca.length !== 7) {
      return NextResponse.json(
        { error: 'Placa inválida. Utilize o formato Mercosul ou padrão brasileiro (7 caracteres).' },
        { status: 400 }
      );
    }

    const newApt: DockAppointment = {
      id: `apt-${Date.now()}`,
      pedidoId,
      cdOrigem: 'CD Jundiaí - SP (Doca 03A)',
      docaNumero: docaNumero || 'Doca 03A',
      janelaHoraria,
      dataAgendada: dataAgendada || new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
      placaVeiculo: cleanPlaca,
      motoristaNome,
      status: 'agendado',
      passeEntradaHash: `PASSE-JND-${pedidoId}-${cleanPlaca}`,
    };

    const existingIdx = marketplaceStore.dockAppointments.findIndex(
      (a) => a.pedidoId === pedidoId
    );
    if (existingIdx !== -1) {
      marketplaceStore.dockAppointments[existingIdx] = newApt;
    } else {
      marketplaceStore.dockAppointments.unshift(newApt);
    }

    const orderIdx = marketplaceStore.orders.findIndex((o) => o.codigoPedido === pedidoId);
    if (orderIdx !== -1) {
      marketplaceStore.orders[orderIdx] = {
        ...marketplaceStore.orders[orderIdx],
        docaAgendada: `${newApt.docaNumero} • ${newApt.cdOrigem} (${newApt.dataAgendada} às ${newApt.janelaHoraria} • Placa ${newApt.placaVeiculo} • ${newApt.passeEntradaHash})`,
        statusLogistica: 'em_transito_fob',
      };
    }

    return NextResponse.json({
      message: 'Agendamento de Doca FOB homologado com sucesso no WMS',
      appointment: newApt,
    });
  } catch (err) {
    console.error('Erro na API de agendamento de docas:', err);
    return NextResponse.json({ error: 'Erro interno ao processar agendamento' }, { status: 500 });
  }
}
