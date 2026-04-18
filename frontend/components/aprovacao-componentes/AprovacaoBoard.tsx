'use client'
import { useState, useCallback } from 'react'
import { Anchor, AlignJustify, MousePointerClick, Layers, CheckSquare } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
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

type TabId = 'componentes' | 'copies'

/* ── Loading skeleton ────────────────────────────────────────────── */
function BoardSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-10 w-72 rounded-xl bg-surface-highest" />
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

/* ── Tab pill bar ────────────────────────────────────────────────── */
interface TabBarProps {
  active:          TabId
  onChange:        (tab: TabId) => void
  approvedTotal:   number
  componentTotal:  number
  combinationCount: number
}

function TabBar({ active, onChange, approvedTotal, componentTotal, combinationCount }: TabBarProps) {
  const tabs: { id: TabId; label: string; badge: string | null }[] = [
    {
      id:    'componentes',
      label: 'Componentes',
      badge: componentTotal > 0 ? `${approvedTotal}/${componentTotal}` : null,
    },
    {
      id:    'copies',
      label: 'Copies finais',
      badge: combinationCount > 0 ? String(combinationCount) : null,
    },
  ]

  return (
    <div className="flex items-center gap-1 p-1 bg-surface-low rounded-xl w-fit mb-6">
      {tabs.map(({ id, label, badge }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
            'transition-all duration-150',
            active === id
              ? 'bg-surface-container text-on-surface shadow-sm'
              : 'text-on-surface-muted hover:text-on-surface-variant hover:bg-surface-high',
          )}
        >
          {label}
          {badge && (
            <span className={cn(
              'text-[0.625rem] font-mono px-1.5 py-0.5 rounded-full',
              active === id
                ? 'bg-brand/15 text-brand'
                : 'bg-surface-highest text-on-surface-muted',
            )}>
              {badge}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

/* ── Empty state — copies finais ─────────────────────────────────── */
function CopiesEmptyState({
  canMaterialize,
  onGoToComponents,
}: {
  canMaterialize: boolean
  onGoToComponents: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-12 h-12 rounded-full bg-surface-high flex items-center justify-center">
        <Layers size={20} strokeWidth={1.5} className="text-on-surface-muted" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-on-surface">Nenhuma copy gerada ainda</p>
        <p className="text-xs text-on-surface-variant max-w-xs">
          {canMaterialize
            ? 'Todos os componentes estão aprovados. Volte à aba Componentes e clique em "Gerar combinações".'
            : 'Aprove ao menos 1 hook, 1 body e 1 CTA na aba Componentes para liberar a geração.'}
        </p>
      </div>
      <button
        onClick={onGoToComponents}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium
          bg-surface-container border border-white/5 text-on-surface-variant
          hover:text-on-surface hover:bg-surface-high transition-all duration-150"
      >
        ← Ir para Componentes
      </button>
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
  const [activeTab, setActiveTab] = useState<TabId>('componentes')

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

  // After materializing, jump to copies tab
  const handleMaterialize = useCallback(async () => {
    await materializeCombinations()
    setActiveTab('copies')
  }, [materializeCombinations])

  if (isLoading) return <BoardSkeleton />

  const colItemsMap = { hook: hooks, body: bodies, cta: ctas }
  const allComponents = [...hooks, ...bodies, ...ctas]
  const approvedTotal  = allComponents.filter((c) => c.approval_status === 'approved').length

  return (
    <div>
      <TabBar
        active={activeTab}
        onChange={setActiveTab}
        approvedTotal={approvedTotal}
        componentTotal={allComponents.length}
        combinationCount={combinations.length}
      />

      {/* ── Tab: Componentes ──────────────────────────────────────── */}
      {activeTab === 'componentes' && (
        <>
          <AprovacaoProgressBar
            hooks={hooks}
            bodies={bodies}
            ctas={ctas}
            canMaterialize={canMaterialize}
            isMaterializing={isMaterializing}
            hasCombinations={combinations.length > 0}
            onMaterialize={handleMaterialize}
          />

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
        </>
      )}

      {/* ── Tab: Copies finais ────────────────────────────────────── */}
      {activeTab === 'copies' && (
        combinations.length === 0 ? (
          <CopiesEmptyState
            canMaterialize={canMaterialize}
            onGoToComponents={() => setActiveTab('componentes')}
          />
        ) : (
          <CombinacoesList
            combinations={combinations}
            onToggleVideo={selectComponent}
          />
        )
      )}
    </div>
  )
}
