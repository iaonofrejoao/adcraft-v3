import { Megaphone } from 'lucide-react'
import { FbAdsLibraryPage } from '@/components/anuncios-fb/FbAdsLibraryPage'

export const metadata = { title: 'Anúncios Facebook — AdCraft' }

export default function AnunciosFbPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="bg-surface-low px-6 py-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <Megaphone size={18} strokeWidth={1.5} className="text-brand" />
          <h1 className="text-base font-semibold text-on-surface tracking-tight">
            Anúncios Facebook
          </h1>
          <span className="text-xs text-on-surface-muted">
            — todos os anúncios do Facebook Ads Library coletados
          </span>
        </div>
      </div>

      <div className="h-px bg-outline-variant/15 shrink-0" />

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <FbAdsLibraryPage />
      </div>
    </div>
  )
}
