const PLACEHOLDER_URL_FRAGMENTS = [
  'placeholder',
  'sua-instancia',
  'sua_instancia',
  'seu-projeto',
  'seu_projeto',
  'your-project',
  'your_project',
  'your-supabase',
  'example.supabase.co',
  'example.com',
  '<',
  '>',
  '{',
  '}',
];

const PLACEHOLDER_KEY_FRAGMENTS = [
  'placeholder',
  'sua-chave',
  'sua_chave',
  'seu-token',
  'seu_token',
  'your-anon',
  'your_anon',
  'your-service',
  'your_service',
  'your-supabase',
  'changeme',
  '<',
  '>',
  '{',
  '}',
];

export function isValidSupabaseUrl(rawUrl?: string | null): boolean {
  if (!rawUrl) return false;
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (PLACEHOLDER_URL_FRAGMENTS.some((fragment) => lower.includes(fragment))) {
    return false;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    if (!host) return false;
    if (host !== 'localhost' && host !== '127.0.0.1' && !host.includes('.')) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function isValidSupabaseKey(rawKey?: string | null): boolean {
  if (!rawKey) return false;
  const trimmed = rawKey.trim();
  if (trimmed.length < 20) return false;
  const lower = trimmed.toLowerCase();
  if (PLACEHOLDER_KEY_FRAGMENTS.some((fragment) => lower.includes(fragment))) {
    return false;
  }
  return true;
}

export function isConfiguredSupabaseEnv(
  rawUrl?: string | null,
  rawKey?: string | null
): boolean {
  return isValidSupabaseUrl(rawUrl) && isValidSupabaseKey(rawKey);
}
