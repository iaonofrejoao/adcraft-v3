'use client'
import { useEffect, useState } from 'react'
import { Toggle } from '@/components/ui/Toggle'

interface Asset {
  id:         string
  tag:        string
  asset_type: string
  url:        string
  file_size?: number
  duration_s?: number
  created_at: string
  product?:   { name: string; sku: string }
}

export default function CreativesPage() {
  const [assets,   setAssets]   = useState<Asset[]>([])
  const [loading,  setLoading]  = useState(true)
  const [videoOnly, setVideoOnly] = useState(false)

  useEffect(() => {
    fetch('/api/assets?limit=50')
      .then((r) => r.json())
      .then((d) => setAssets(d.assets ?? d ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = videoOnly ? assets.filter((a) => a.asset_type === 'video') : assets

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b shrink-0"
        style={{ borderColor: 'var(--border-default)', background: 'var(--surface-page)' }}>
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Criativos</h1>
        <Toggle checked={videoOnly} onChange={setVideoOnly} label="Somente vídeos" size="sm" />
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <span className="animate-pulse text-sm" style={{ color: 'var(--text-muted)' }}>
              Carregando criativos…
            </span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <p className="text-4xl">🎬</p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Nenhum criativo gerado ainda.
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Gere vídeos aprovando combinações de copy e rodando o pipeline <code>/video</code>.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((asset) => (
              <AssetCard key={asset.id} asset={asset} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function AssetCard({ asset: a }: { asset: Asset }) {
  const isVideo = a.asset_type === 'video'
  const sizeKb  = a.file_size ? (a.file_size / 1024).toFixed(0) : null

  return (
    <div className="rounded-xl border overflow-hidden group"
      style={{ background: 'var(--surface-card)', borderColor: 'var(--border-default)' }}>

      {/* Thumbnail / Preview */}
      <div className="relative aspect-video flex items-center justify-center"
        style={{ background: 'var(--surface-sidebar)' }}>
        {isVideo ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            src={a.url}
            className="w-full h-full object-cover"
            preload="metadata"
            onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play()}
            onMouseLeave={(e) => { const v = e.currentTarget as HTMLVideoElement; v.pause(); v.currentTime = 0 }}
          />
        ) : (
          <span className="text-4xl">📄</span>
        )}
        {/* Overlay de download */}
        <a
          href={a.url}
          download={`${a.tag}.${isVideo ? 'mp4' : 'jpg'}`}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: 'rgba(0,0,0,0.45)' }}>
          <span className="text-white text-sm font-medium">⬇ Baixar</span>
        </a>
      </div>

      {/* Info */}
      <div className="px-3 py-2.5">
        <p className="text-xs font-mono truncate" style={{ color: 'var(--brand-primary)' }}>{a.tag}</p>
        {a.product && (
          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
            {a.product.name}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          {a.duration_s && <span>{a.duration_s}s</span>}
          {sizeKb       && <span>{sizeKb} KB</span>}
          <span className="ml-auto">{new Date(a.created_at).toLocaleDateString('pt-BR')}</span>
        </div>
      </div>
    </div>
  )
}
