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
