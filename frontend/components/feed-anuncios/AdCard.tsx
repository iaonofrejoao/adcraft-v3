'use client'
import { useState } from 'react'
import { ExternalLink, ChevronDown, ChevronUp, Eye, DollarSign, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AdLibraryAd } from '@/hooks/useAdLibrary'

const PLATFORM_SHORT: Record<string, string> = {
  facebook:         'FB',
  instagram:        'IG',
  audience_network: 'AN',
  messenger:        'MSG',
}

const MEDIA_LABEL: Record<string, string> = {
  IMAGE:       '◼ Imagem',
  VIDEO:       '▶ Vídeo',
  MUTED_VIDEO: '▶ Mudo',
}

const TRUNCATE = 160

interface Props {
  ad: AdLibraryAd
}

export function AdCard({ ad }: Props) {
  const [expanded, setExpanded] = useState(false)

  const body  = ad.ad_creative_bodies?.[0] ?? ''
  const title = ad.ad_creative_link_titles?.[0] ?? ''
  const isLong = body.length > TRUNCATE

  const isActive = !ad.ad_delivery_stop_time
    || new Date(ad.ad_delivery_stop_time) > new Date()

  const formattedDate = ad.ad_creation_time
    ? new Date(ad.ad_creation_time).toLocaleDateString('pt-BR', {
        day: '2-digit', month: 'short', year: 'numeric',
      })
    : null

  return (
    <div className="bg-surface-container border border-white/5 rounded-md p-4 flex flex-col gap-3 hover:border-white/10 transition-colors duration-150">

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-on-surface truncate">
            {ad.page_name ?? `Página ${ad.page_id}`}
          </p>
          {ad.funding_entity && ad.funding_entity !== ad.page_name && (
            <p className="text-xs text-on-surface-muted truncate mt-0.5">{ad.funding_entity}</p>
          )}
        </div>
        <span className={cn(
          'shrink-0 text-[0.65rem] font-medium px-1.5 py-0.5 rounded',
          isActive
            ? 'bg-[rgba(34,197,94,0.15)] text-[#4ADE80]'
            : 'bg-[rgba(161,161,170,0.15)] text-[#A1A1AA]',
        )}>
          {isActive ? 'Ativo' : 'Inativo'}
        </span>
      </div>

      {/* Title */}
      {title && (
        <p className="text-xs font-semibold text-brand leading-snug">{title}</p>
      )}

      {/* Body */}
      {body && (
        <div className="space-y-1">
          <p className="text-xs text-on-surface-variant leading-relaxed">
            {expanded || !isLong ? body : `${body.slice(0, TRUNCATE)}…`}
          </p>
          {isLong && (
            <button
              type="button"
              onClick={() => setExpanded(v => !v)}
              className="text-[0.7rem] text-on-surface-muted hover:text-on-surface flex items-center gap-1 transition-colors duration-150"
            >
              {expanded
                ? <><ChevronUp size={12} strokeWidth={1.5} /> Ver menos</>
                : <><ChevronDown size={12} strokeWidth={1.5} /> Ver mais</>}
            </button>
          )}
        </div>
      )}

      {/* Meta chips */}
      <div className="flex flex-wrap gap-1.5 mt-auto">
        {ad.publisher_platforms?.map(p => (
          <span key={p} className="px-1.5 py-0.5 bg-surface-low rounded text-[0.65rem] font-mono text-on-surface-muted">
            {PLATFORM_SHORT[p.toLowerCase()] ?? p.toUpperCase()}
          </span>
        ))}

        {ad.media_type && MEDIA_LABEL[ad.media_type] && (
          <span className="px-1.5 py-0.5 bg-surface-low rounded text-[0.65rem] text-on-surface-muted">
            {MEDIA_LABEL[ad.media_type]}
          </span>
        )}

        {ad.impressions && (
          <span className="flex items-center gap-1 px-1.5 py-0.5 bg-surface-low rounded text-[0.65rem] font-mono text-on-surface-muted">
            <Eye size={10} strokeWidth={1.5} />
            {Number(ad.impressions.lower_bound).toLocaleString('pt-BR')}–{Number(ad.impressions.upper_bound).toLocaleString('pt-BR')}
          </span>
        )}

        {ad.spend && ad.currency && (
          <span className="flex items-center gap-1 px-1.5 py-0.5 bg-surface-low rounded text-[0.65rem] font-mono text-on-surface-muted">
            <DollarSign size={10} strokeWidth={1.5} />
            {ad.spend.lower_bound}–{ad.spend.upper_bound} {ad.currency}
          </span>
        )}

        {formattedDate && (
          <span className="flex items-center gap-1 px-1.5 py-0.5 bg-surface-low rounded text-[0.65rem] font-mono text-on-surface-muted">
            <Calendar size={10} strokeWidth={1.5} />
            {formattedDate}
          </span>
        )}
      </div>

      {/* Languages */}
      {ad.languages && ad.languages.length > 0 && (
        <div className="flex gap-1">
          {ad.languages.map(lang => (
            <span key={lang} className="px-1 py-0.5 bg-surface-low rounded text-[0.6rem] font-mono uppercase text-on-surface-muted">
              {lang}
            </span>
          ))}
        </div>
      )}

      {/* Snapshot link */}
      {ad.ad_snapshot_url && (
        <a
          href={ad.ad_snapshot_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[0.75rem] text-brand/70 hover:text-brand flex items-center gap-1.5 transition-colors duration-150"
        >
          <ExternalLink size={12} strokeWidth={1.5} />
          Ver anúncio completo
        </a>
      )}
    </div>
  )
}
