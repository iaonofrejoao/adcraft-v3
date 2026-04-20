'use client'
import { Film } from 'lucide-react'
import Link from 'next/link'

/* ── Skeleton ───────────────────────────────────────────────────────── */
export function VideoTabSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 animate-pulse">
      <div className="w-14 h-14 rounded-xl bg-surface-highest" />
      <div className="h-4 w-40 bg-surface-highest rounded" />
      <div className="h-3 w-56 bg-surface-highest rounded" />
    </div>
  )
}

/* ── Main ───────────────────────────────────────────────────────────── */
export interface VideoTabProps {
  sku: string
}

export function VideoTab({ sku }: VideoTabProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-14 h-14 rounded-xl bg-surface-container border border-white/5 flex items-center justify-center">
        <Film size={22} strokeWidth={1.5} className="text-on-surface-muted" />
      </div>
      <div className="text-center space-y-1.5">
        <p className="text-sm font-semibold text-on-surface">Nenhum vídeo gerado ainda</p>
        <p className="text-[0.6875rem] text-on-surface-variant max-w-xs leading-relaxed">
          Os criativos em vídeo aparecerão aqui após serem gerados.
          Acesse o <span className="font-mono text-brand">Storyboard</span> e clique em{' '}
          <span className="font-medium text-on-surface">Fazer Vídeo</span> em cada combinação.
        </p>
      </div>
      <Link
        href={`/products/${sku}/storyboard`}
        className="px-4 py-2 rounded-lg text-sm font-medium bg-surface-container border border-white/5
          text-on-surface-variant hover:text-on-surface hover:bg-surface-high transition-all duration-150"
      >
        Ir para Storyboard →
      </Link>
    </div>
  )
}
