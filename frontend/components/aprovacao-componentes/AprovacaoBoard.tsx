'use client'
import { Anchor, AlignJustify, MousePointerClick } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useCopyBoard } from '@/hooks/useCopyBoard'
import { AprovacaoProgressBar } from './AprovacaoProgressBar'
import { ColunaComponentes }    from './ColunaComponentes'
import { CombinacoesList }      from './CombinacoesList'

/* ── Column definitions ──────────────────────────────────────────── */
const COLUMNS = [
  {
    type:      'hook' as const,
    label:     'Hooks',
    Icon:      Anchor,
    iconClass: 'text-brand',
    iconBg:    'bg-brand-muted',
  },
  {
    type:      'body' as const,
    label:     'Bodies',
    Icon:      AlignJustify,
    iconClass: 'text-status-running-text',
    iconBg:    'bg-status-running',
  },
  {
    type:      'cta' as const,
    label:     'CTAs',
    Icon:      MousePointerClick,
    iconClass: 'text-status-done-text',
    iconBg:    'bg-status-done',
  },
]

/* ── Loading skeleton ────────────────────────────────────────────── */
function BoardSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-14 w-full rounded-xl bg-surface-highest" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {Array.from({ length: 3 }).map((_, col) => (
          <div key={col} className="space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="w-8 h-8 rounded-lg bg-surface-highest" />
              <Skeleton className="h-5 w-24 bg-surface-highest" />
            </div>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-surface-container border border-white/5 rounded-xl p-3 space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-2.5 w-20 bg-surface-highest" />
                  <div className="flex gap-1">
                    <Skeleton className="h-4 w-10 rounded bg-surface-highest" />
                    <Skeleton className="h-4 w-14 rounded bg-surface-highest" />
                  </div>
                </div>
                <Skeleton className="h-3 w-full bg-surface-highest" />
                <Skeleton className="h-3 w-4/5 bg-surface-highest" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Board ───────────────────────────────────────────────────────── */
interface AprovacaoBoardProps {
  sku:        string
  pipelineId: string
  productId:  string
}

export function AprovacaoBoard({ sku, pipelineId, productId }: AprovacaoBoardProps) {
  const {
    hooks, bodies, ctas,
    combinations,
    isLoading,
    isMaterializing,
    approveComponent,
    rejectComponent,
    resetComponent,
    selectComponent,
    materializeCombinations,
    canMaterialize,
  } = useCopyBoard(sku, pipelineId, productId)

  if (isLoading) return <BoardSkeleton />

  const colItemsMap = { hook: hooks, body: bodies, cta: ctas }

  return (
    <div>
      {/* Progress + Gerar combinações */}
      <AprovacaoProgressBar
        hooks={hooks}
        bodies={bodies}
        ctas={ctas}
        canMaterialize={canMaterialize}
        isMaterializing={isMaterializing}
        hasCombinations={combinations.length > 0}
        onMaterialize={materializeCombinations}
      />

      {/* 3-column responsive grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {COLUMNS.map(({ type, label, Icon, iconClass, iconBg }) => (
          <ColunaComponentes
            key={type}
            type={type}
            label={label}
            Icon={Icon}
            iconClass={iconClass}
            iconBg={iconBg}
            items={colItemsMap[type]}
            onApprove={approveComponent}
            onReject={rejectComponent}
            onReset={resetComponent}
          />
        ))}
      </div>

      {/* Combinations */}
      <CombinacoesList
        combinations={combinations}
        onToggleVideo={selectComponent}
      />
    </div>
  )
}
