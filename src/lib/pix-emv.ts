function emvField(id: string, value: string): string {
  const len = String(value.length).padStart(2, '0');
  return `${id}${len}${value}`;
}

function crc16Ccitt(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export interface PixEmvParams {
  amount: number;
  txid: string;
  description?: string;
  pixKey?: string;
  merchantName?: string;
  merchantCity?: string;
}

/**
 * Gera payload BR Code (EMV QRCPS-MPM) oficial do Banco Central do Brasil com CRC16-CCITT.
 */
export function generatePixEmvPayload(params: PixEmvParams): string {
  const pixKey = (
    params.pixKey ||
    process.env.PIX_ESCROW_KEY ||
    'escrow@varejistaonline.com.br'
  ).trim();
  const merchantName = (params.merchantName || 'VAREJISTA ONLINE B2B')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .slice(0, 25);
  const merchantCity = (params.merchantCity || 'SAO PAULO')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .slice(0, 15);
  const cleanTxid = params.txid.replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || 'VAREJISTA001';
  const amountStr = Math.max(0.01, params.amount).toFixed(2);

  const gui = emvField('00', 'br.gov.bcb.pix');
  const keyField = emvField('01', pixKey);
  const descField = params.description
    ? emvField(
        '02',
        params.description
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .slice(0, 40)
      )
    : '';
  const merchantAccountInfo = emvField('26', `${gui}${keyField}${descField}`);

  const additionalData = emvField('62', emvField('05', cleanTxid));

  const payloadWithoutCrc =
    emvField('00', '01') +
    emvField('01', '12') +
    merchantAccountInfo +
    emvField('52', '0000') +
    emvField('53', '986') +
    emvField('54', amountStr) +
    emvField('58', 'BR') +
    emvField('59', merchantName) +
    emvField('60', merchantCity) +
    additionalData +
    '6304';

  const crc = crc16Ccitt(payloadWithoutCrc);
  return `${payloadWithoutCrc}${crc}`;
}
