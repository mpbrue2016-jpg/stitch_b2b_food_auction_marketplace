import fs from 'node:fs';
import path from 'node:path';

function isPlaceholderValue(val) {
  if (!val) return true;
  const lower = String(val).trim().toLowerCase();
  return [
    'placeholder',
    'sua-instancia',
    'sua_instancia',
    'seu-projeto',
    'seu_projeto',
    'sua-chave',
    'sua_chave',
    'your-project',
    'your-anon',
    'your-service',
    'example.supabase.co',
    'changeme',
  ].some((frag) => lower.includes(frag));
}

function hydrateEnvFromDotEnv() {
  const cwd = process.cwd();
  for (const fileName of ['.env', '.env.local']) {
    const fullPath = path.join(cwd, fileName);
    if (!fs.existsSync(fullPath)) continue;
    const raw = fs.readFileSync(fullPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx <= 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!val || isPlaceholderValue(val)) continue;
      if (!process.env[key] || isPlaceholderValue(process.env[key])) {
        process.env[key] = val;
      }
    }
  }
}

hydrateEnvFromDotEnv();

const publicRuntimeEnv = {};
if (process.env.NEXT_PUBLIC_SUPABASE_URL && !isPlaceholderValue(process.env.NEXT_PUBLIC_SUPABASE_URL)) {
  publicRuntimeEnv.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
}
if (
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  !isPlaceholderValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
) {
  publicRuntimeEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  env: publicRuntimeEnv,
  images: {
    formats: ['image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [80, 96, 140, 256, 384, 512],
    minimumCacheTTL: 31536000,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'api.qrserver.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
