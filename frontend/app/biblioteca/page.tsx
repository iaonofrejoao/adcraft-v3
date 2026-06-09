import { Library } from 'lucide-react'
import { VideoLibraryPage } from '@/components/biblioteca/VideoLibraryPage'

export const metadata = { title: 'Biblioteca UGC — AdCraft' }

export default function BibliotecaPage() {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-surface-low px-6 py-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <Library size={18} strokeWidth={1.5} className="text-brand" />
          <h1 className="text-base font-semibold text-on-surface tracking-tight">
            Biblioteca UGC
          </h1>
          <span className="text-xs text-on-surface-muted">
            — todos os vídeos TikTok coletados
          </span>
        </div>
      </div>

      <div className="h-px bg-outline-variant/15 shrink-0" />

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <VideoLibraryPage />
      </div>
    </div>
  )
}
