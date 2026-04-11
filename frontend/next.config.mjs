import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Carrega .env da raiz do monorepo (sem sobrescrever vars já definidas por .env.local).
// Usa apenas Node.js built-ins — sem dependência de dotenv no frontend.
const rootEnvPath = resolve(__dirname, '../.env');
if (existsSync(rootEnvPath)) {
  const lines = readFileSync(rootEnvPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const raw = trimmed.slice(eqIdx + 1).trim();
    // Remove aspas opcionais; não sobrescreve vars já definidas
    if (!process.env[key]) {
      process.env[key] = raw.replace(/^["']|["']$/g, '');
    }
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Mantém compatibilidade com Node.js runtime nas API routes
    serverComponentsExternalPackages: [],
  },
  // Silencia warning do mermaid no SSR
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals ?? []), 'canvas']
    }
    return config
  },
}

export default nextConfig
