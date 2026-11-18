import { createHash, timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';

export function buildSha256Hash(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export function buildAuditHash(protocolo: string, eventType: string, payload: unknown): string {
  const canonical = JSON.stringify({
    protocolo,
    eventType,
    payload,
    timestamp: new Date().toISOString(),
  });
  return buildSha256Hash(canonical);
}

export function extractClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim().slice(0, 45);
  }
  return (req.headers.get('x-real-ip') || '127.0.0.1').slice(0, 45);
}

export function isValidCnpjDigits(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const calcDigit = (base: string, weights: number[]) => {
    let sum = 0;
    for (let i = 0; i < weights.length; i++) {
      sum += Number(base[i]) * weights[i];
    }
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calcDigit(digits.slice(0, 12), w1);
  if (d1 !== Number(digits[12])) return false;

  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d2 = calcDigit(digits.slice(0, 13), w2);
  return d2 === Number(digits[13]);
}

export function safeCompareSecrets(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
