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
  transpilePackages: [
    'd3', 'd3-array', 'd3-axis', 'd3-brush', 'd3-chord', 'd3-color',
    'd3-contour', 'd3-delaunay', 'd3-dispatch', 'd3-drag', 'd3-dsv',
    'd3-ease', 'd3-fetch', 'd3-force', 'd3-format', 'd3-geo',
    'd3-hierarchy', 'd3-interpolate', 'd3-path', 'd3-polygon',
    'd3-quadtree', 'd3-random', 'd3-sankey', 'd3-scale',
    'd3-scale-chromatic', 'd3-selection', 'd3-shape', 'd3-time',
    'd3-time-format', 'd3-timer', 'd3-transition', 'd3-zoom',
    'internmap', 'robust-predicates',
  ],
  experimental: {
    // Mantém compatibilidade com Node.js runtime nas API routes
    // @react-pdf/renderer usa APIs nativas do Node (fs, canvas) — não pode ser bundlado pelo webpack
    serverComponentsExternalPackages: ['@react-pdf/renderer'],
  },
  async redirects() {
    return [
      {
        source: '/pipelines/:id',
        destination: '/demandas?pipeline=:id',
        permanent: false,
      },
    ]
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
