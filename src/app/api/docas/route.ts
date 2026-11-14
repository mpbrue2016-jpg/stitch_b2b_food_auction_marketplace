import { NextRequest, NextResponse } from 'next/server';

interface DockAppointment {
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

let appointments: DockAppointment[] = [
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
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const pedidoId = searchParams.get('pedidoId');

  if (pedidoId) {
    const apt = appointments.find((a) => a.pedidoId === pedidoId);
    return NextResponse.json({ appointment: apt || null });
  }

  return NextResponse.json({ appointments });
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

    appointments.unshift(newApt);

    return NextResponse.json({
      message: 'Agendamento de Doca FOB homologado com sucesso no WMS',
      appointment: newApt,
    });
  } catch (err) {
    console.error('Erro na API de agendamento de docas:', err);
    return NextResponse.json({ error: 'Erro interno ao processar agendamento' }, { status: 500 });
  }
}
