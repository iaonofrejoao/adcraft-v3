'use client'
import { useEffect } from 'react'
import { X, Download } from 'lucide-react'

interface ImageLightboxProps {
  url:      string
  onClose:  () => void
}

async function downloadImage(proxyUrl: string) {
  const res  = await fetch(proxyUrl)
  const blob = await res.blob()
  const a    = document.createElement('a')
  a.href     = URL.createObjectURL(blob)
  a.download = `imagem_${Date.now()}.png`
  a.click()
  URL.revokeObjectURL(a.href)
}

export function ImageLightbox({ url, onClose }: ImageLightboxProps) {
  const proxyUrl = `/api/drive-image?url=${encodeURIComponent(url)}`

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Toolbar */}
      <div
        className="absolute top-4 right-4 flex items-center gap-2"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={() => downloadImage(proxyUrl)}
          className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          title="Baixar imagem"
        >
          <Download size={16} strokeWidth={1.5} />
        </button>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          title="Fechar"
        >
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>

      {/* Imagem */}
      <div onClick={e => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={proxyUrl}
          alt=""
          className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl shadow-2xl"
        />
      </div>
    </div>
  )
}
