'use client'
import { useState } from 'react'
import { Film, Grid3x3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StoryboardTab } from './StoryboardTab'

/* ── Sub-tab pill ───────────────────────────────────────────────────── */
type SubTab = 'storyboard' | 'criativos'

const SUB_TABS: { id: SubTab; label: string; icon: React.ReactNode }[] = [
  { id: 'storyboard', label: 'Storyboard', icon: <Grid3x3 size={13} strokeWidth={1.5} /> },
  { id: 'criativos',  label: 'Criativos',  icon: <Film     size={13} strokeWidth={1.5} /> },
]

/* ── Criativos empty state ──────────────────────────────────────────── */
function CriativosPanel({ sku }: { sku: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-14 h-14 rounded-xl bg-surface-container border border-white/5 flex items-center justify-center">
        <Film size={22} strokeWidth={1.5} className="text-on-surface-muted" />
      </div>
      <div className="text-center space-y-1.5">
        <p className="text-sm font-semibold text-on-surface">Nenhum vídeo gerado ainda</p>
        <p className="text-[0.6875rem] text-on-surface-variant max-w-xs leading-relaxed">
          Os criativos aparecerão aqui após serem gerados.
          Acesse o <span className="font-mono text-brand">Storyboard</span> e clique em{' '}
          <span className="font-medium text-on-surface">Fazer Vídeo</span> em cada combinação.
        </p>
      </div>
      <button
        onClick={() => {}}
        className="px-4 py-2 rounded-lg text-sm font-medium bg-surface-container border border-white/5
          text-on-surface-variant hover:text-on-surface hover:bg-surface-high transition-all duration-150"
        // handled by parent via setSubTab
      >
        Ver Storyboard →
      </button>
    </div>
  )
}

/* ── Skeleton ───────────────────────────────────────────────────────── */
export function VideoTabSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex gap-2 mb-4">
        <div className="h-8 w-28 bg-surface-highest rounded-lg" />
        <div className="h-8 w-24 bg-surface-highest rounded-lg" />
      </div>
      <div className="h-48 w-full bg-surface-highest rounded-xl" />
    </div>
  )
}

/* ── Main ───────────────────────────────────────────────────────────── */
export interface VideoTabProps {
  sku: string
}

export function VideoTab({ sku }: VideoTabProps) {
  const [active, setActive] = useState<SubTab>('storyboard')

  return (
    <div>
      {/* Sub-tab bar */}
      <div className="flex gap-1 mb-6 bg-surface-container border border-white/5 rounded-xl p-1 w-fit">
        {SUB_TABS.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setActive(id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150',
              active === id
                ? 'bg-surface-high text-on-surface shadow-sm'
                : 'text-on-surface-muted hover:text-on-surface-variant',
            )}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* Panel */}
      {active === 'storyboard' && <StoryboardTab sku={sku} />}
      {active === 'criativos'  && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-14 h-14 rounded-xl bg-surface-container border border-white/5 flex items-center justify-center">
            <Film size={22} strokeWidth={1.5} className="text-on-surface-muted" />
          </div>
          <div className="text-center space-y-1.5">
            <p className="text-sm font-semibold text-on-surface">Nenhum vídeo gerado ainda</p>
            <p className="text-[0.6875rem] text-on-surface-variant max-w-xs leading-relaxed">
              Os criativos aparecerão aqui após serem gerados.
              Vá para <span className="font-mono text-brand">Storyboard</span> e clique em{' '}
              <span className="font-medium text-on-surface">Fazer Vídeo</span> em cada combinação.
            </p>
          </div>
          <button
            onClick={() => setActive('storyboard')}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-surface-container border border-white/5
              text-on-surface-variant hover:text-on-surface hover:bg-surface-high transition-all duration-150"
          >
            Ver Storyboard →
          </button>
        </div>
      )}
    </div>
  )
}
