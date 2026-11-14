import React from 'react';
import { ShelfLifeStatus } from '@/lib/types';

interface ShelfLifeBadgeProps {
  status: ShelfLifeStatus;
  diasRestantes: number;
  dataValidade?: string;
  className?: string;
}

export const ShelfLifeBadge: React.FC<ShelfLifeBadgeProps> = ({
  status,
  diasRestantes,
  dataValidade,
  className = '',
}) => {
  // Configurações exatas do DESIGN.md
  const config = {
    longa: {
      bg: 'bg-[#E8F5E9]',
      text: 'text-[#2E7D32]',
      border: 'border-[#A5D6A7]',
      label: 'Validade Longa',
      icone: 'event_available',
    },
    atencao: {
      bg: 'bg-[#FFFDE7]',
      text: 'text-[#F57F17]',
      border: 'border-[#FFF59D]',
      label: 'Atenção FEFO',
      icone: 'warning',
    },
    giro_rapido: {
      bg: 'bg-[#FFF3E0]',
      text: 'text-[#E65100]',
      border: 'border-[#FFCC80]',
      label: 'Giro Rápido',
      icone: 'flash_on',
    },
    critica: {
      bg: 'bg-[#FFEBEE]',
      text: 'text-[#C62828]',
      border: 'border-[#EF9A9A]',
      label: 'Crítico / Imediato',
      icone: 'local_fire_department',
    },
  }[status];

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] border ${config.bg} ${config.text} ${config.border} text-xs font-semibold ${className}`}
      title={dataValidade ? `Validade: ${dataValidade}` : undefined}
    >
      <span className="material-symbols-outlined text-[15px]">{config.icone}</span>
      <span>
        {diasRestantes} dias restantes • {config.label}
      </span>
    </div>
  );
};
