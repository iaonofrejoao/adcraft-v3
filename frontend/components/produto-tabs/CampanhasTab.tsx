'use client'
import { Megaphone, ExternalLink } from 'lucide-react'

/* ── Empty state (the only state for now — no campaign data yet) ─────── */
export function CampanhasTab() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-6">
      <div className="w-14 h-14 rounded-xl bg-surface-container border border-white/5 flex items-center justify-center">
        <Megaphone size={22} strokeWidth={1.5} className="text-on-surface-muted" />
      </div>

      <div className="text-center space-y-1.5 max-w-sm">
        <p className="text-sm font-semibold text-on-surface">Campanhas não integradas ainda</p>
        <p className="text-[0.6875rem] text-on-surface-variant leading-relaxed">
          A integração com o Facebook Ads e Google Ads está planejada para uma próxima versão.
          Quando conectadas, as métricas de spend, CPM, CTR, CPA e ROAS aparecerão aqui.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <a
          href="https://business.facebook.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-outline-variant/20
            text-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-high
            transition-colors duration-150"
        >
          Facebook Ads
          <ExternalLink size={12} strokeWidth={1.5} />
        </a>
        <a
          href="https://ads.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-outline-variant/20
            text-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-high
            transition-colors duration-150"
        >
          Google Ads
          <ExternalLink size={12} strokeWidth={1.5} />
        </a>
      </div>

      <p className="text-[0.625rem] text-on-surface-muted/40 mt-2 font-mono">
        v2.x — campaigns integration
      </p>
    </div>
  )
}
