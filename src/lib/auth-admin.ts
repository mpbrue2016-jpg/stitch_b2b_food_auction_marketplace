export const SOLE_ADMIN_EMAIL = 'mpbrue2016@gmail.com';
export const SOLE_ADMIN_CPF_DIGITS = '11567025854';
export const SOLE_ADMIN_CPF_FORMATTED = '115.670.258-54';

export function normalizeAdminEmail(email?: string | null): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

export function normalizeAdminCpfDigits(cpf?: string | null): string {
  return typeof cpf === 'string' ? cpf.replace(/\D/g, '') : '';
}

export function isSoleAdminEmail(email?: string | null): boolean {
  return normalizeAdminEmail(email) === SOLE_ADMIN_EMAIL;
}

export function isSoleAdminCpf(cpf?: string | null): boolean {
  return normalizeAdminCpfDigits(cpf) === SOLE_ADMIN_CPF_DIGITS;
}

export function isSoleAdminIdentity(email?: string | null, cpf?: string | null): boolean {
  return isSoleAdminEmail(email) && isSoleAdminCpf(cpf);
}

export function isAuthorizedAdminProfile(
  profile?: {
    role?: string | null;
    email?: string | null;
    cpf?: string | null;
    isDemo?: boolean | null;
    is_demo?: boolean | null;
  } | null
): boolean {
  if (!profile) return false;
  if (profile.role !== 'admin') return false;
  if (profile.isDemo || profile.is_demo) return false;
  return isSoleAdminIdentity(profile.email, profile.cpf);
}

export function assertSoleAdminAuthRequest(input: {
  email?: string | null;
  cpf?: string | null;
}):
  | {
      ok: true;
      email: string;
      cpfDigits: string;
      cpfFormatted: string;
    }
  | {
      ok: false;
      error: string;
    } {
  const email = normalizeAdminEmail(input.email);
  const cpfDigits = normalizeAdminCpfDigits(input.cpf);

  if (!isSoleAdminEmail(email) || !isSoleAdminCpf(cpfDigits)) {
    return {
      ok: false,
      error:
        'Acesso administrativo bloqueado: apenas o e-mail e o CPF fixos autorizados podem acessar o perfil de Administrador Master.',
    };
  }

  return {
    ok: true,
    email: SOLE_ADMIN_EMAIL,
    cpfDigits: SOLE_ADMIN_CPF_DIGITS,
    cpfFormatted: SOLE_ADMIN_CPF_FORMATTED,
  };
}
