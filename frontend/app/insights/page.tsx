'use client'
import { useState }         from 'react'
import {
  Brain, Lightbulb, TrendingUp, Search,
  CheckCircle2, XCircle, RefreshCw, ChevronDown, ChevronUp,
  Filter,
} from 'lucide-react'
import { cn }               from '@/lib/utils'
import { Skeleton }         from '@/components/ui/skeleton'
import { useInsights }      from '@/hooks/useInsights'
import type { Learning, Pattern, Insight } from '@/hooks/useInsights'

// ── Constantes ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'angle',      label: 'Ângulo' },
  { value: 'copy',       label: 'Copy' },
  { value: 'persona',    label: 'Persona' },
  { value: 'creative',   label: 'Criativo' },
  { value: 'targeting',  label: 'Targeting' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'other',      label: 'Outros' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function confidenceColor(c: number): string {
  if (c >= 0.7) return 'text-status-done-text'
  if (c >= 0.5) return 'text-status-paused-text'
  return 'text-on-surface-muted'
}

function confidenceBg(c: number): string {
  if (c >= 0.7) return 'bg-status-done-bg'
  if (c >= 0.5) return 'bg-status-paused-bg'
  return 'bg-surface-container-high'
}

function importanceStars(n: number): string {
  return '★'.repeat(n) + '☆'.repeat(5 - n)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

// ── Componentes de card ───────────────────────────────────────────────────────

function InsightCard({ insight, onValidate }: {
  insight:    Insight
  onValidate: (id: string, valid: boolean) => Promise<void>
}) {
  const [loading, setLoading] = useState(false)

  const handleValidate = async (valid: boolean) => {
    setLoading(true)
    await onValidate(insight.id, valid).finally(() => setLoading(false))
  }

  return (
    <div className="rounded-xl border border-primary/20 bg-primary-container/30 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-primary text-[11px] font-mono">
              {importanceStars(insight.importance)}
            </span>
            <span className="text-[10px] text-on-surface-muted uppercase tracking-wider">
              {insight.source}
            </span>
            {insight.validated_by_user && (
              <CheckCircle2 size={12} strokeWidth={1.5} className="text-status-done-text" />
            )}
          </div>
          <h3 className="text-[14px] font-semibold text-on-surface">{insight.title}</h3>
          <p className="text-[13px] text-on-surface-variant mt-1.5 leading-relaxed">{insight.body}</p>
        </div>

        {!insight.validated_by_user && (
          <div className="flex flex-col gap-1.5 shrink-0">
            <button
              disabled={loading}
              onClick={() => handleValidate(true)}
              className="p-1.5 rounded-md hover:bg-status-done-bg text-on-surface-muted hover:text-status-done-text transition-colors"
              title="Validar insight"
            >
              <CheckCircle2 size={14} strokeWidth={1.5} />
            </button>
            <button
              disabled={loading}
              onClick={() => handleValidate(false)}
              className="p-1.5 rounded-md hover:bg-status-failed-bg text-on-surface-muted hover:text-status-failed-text transition-colors"
              title="Invalidar insight"
            >
              <XCircle size={14} strokeWidth={1.5} />
            </button>
          </div>
        )}
      </div>

      <p className="text-[10px] text-on-surface-muted mt-3">{formatDate(insight.created_at)}</p>
    </div>
  )
}

function PatternCard({ pattern }: { pattern: Pattern }) {
  const categoryLabel = CATEGORIES.find((c) => c.value === pattern.category)?.label ?? pattern.category

  return (
    <div className="rounded-xl border border-outline-variant/10 bg-surface-container p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className={cn(
          'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full',
          confidenceColor(pattern.confidence),
          confidenceBg(pattern.confidence),
        )}>
          {categoryLabel}
        </span>
        <span className={cn('text-[11px] font-mono ml-auto', confidenceColor(pattern.confidence))}>
          {(pattern.confidence * 100).toFixed(0)}% conf.
        </span>
      </div>
      <p className="text-[13px] text-on-surface leading-relaxed">{pattern.pattern_text}</p>
      <p className="text-[10px] text-on-surface-muted mt-2">
        {pattern.supporting_count} learnings · atualizado {formatDate(pattern.updated_at)}
      </p>
    </div>
  )
}

function LearningCard({ learning, onValidate }: {
  learning:   Learning
  onValidate: (id: string, valid: boolean) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const [loading,  setLoading]  = useState(false)

  const categoryLabel = CATEGORIES.find((c) => c.value === learning.category)?.label ?? learning.category
  const hasEvidence   = learning.evidence && Object.keys(learning.evidence).length > 0

  const handleValidate = async (valid: boolean) => {
    setLoading(true)
    await onValidate(learning.id, valid).finally(() => setLoading(false))
  }

  return (
    <div className={cn(
      'rounded-xl border bg-surface-container-low p-4 transition-colors',
      learning.validated_by_user === false
        ? 'border-status-failed-text/20 opacity-60'
        : learning.validated_by_user === true
          ? 'border-status-done-text/20'
          : 'border-outline-variant/10',
    )}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={cn(
              'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full',
              confidenceColor(learning.confidence),
              confidenceBg(learning.confidence),
            )}>
              {categoryLabel}
            </span>
            <span className={cn('text-[11px] font-mono ml-auto', confidenceColor(learning.confidence))}>
              {(learning.confidence * 100).toFixed(0)}%
            </span>
          </div>
          <p className="text-[13px] text-on-surface leading-relaxed">{learning.observation}</p>

          {hasEvidence && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="flex items-center gap-1 mt-2 text-[11px] text-on-surface-muted hover:text-on-surface-variant transition-colors"
            >
              {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              Evidência
            </button>
          )}

          {expanded && hasEvidence && (
            <pre className="mt-2 text-[10px] font-mono text-on-surface-muted bg-surface-container-highest rounded-md p-2 overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(learning.evidence, null, 2)}
            </pre>
          )}
        </div>

        {learning.validated_by_user === null && (
          <div className="flex flex-col gap-1 shrink-0">
            <button
              disabled={loading}
              onClick={() => handleValidate(true)}
              className="p-1.5 rounded-md hover:bg-status-done-bg text-on-surface-muted hover:text-status-done-text transition-colors"
              title="Confirmar learning"
            >
              <CheckCircle2 size={13} strokeWidth={1.5} />
            </button>
            <button
              disabled={loading}
              onClick={() => handleValidate(false)}
              className="p-1.5 rounded-md hover:bg-status-failed-bg text-on-surface-muted hover:text-status-failed-text transition-colors"
              title="Invalidar learning"
            >
              <XCircle size={13} strokeWidth={1.5} />
            </button>
          </div>
        )}
      </div>

      <p className="text-[10px] text-on-surface-muted mt-2">{formatDate(learning.created_at)}</p>
    </div>
  )
}

// ── Skeletons ─────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return <Skeleton className="h-24 w-full rounded-xl bg-surface-container" />
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function InsightsPage() {
  const {
    learnings, patterns, insights,
    isLoading,
    categoryFilter, setCategoryFilter,
    searchQuery, setSearchQuery,
    validateLearning, validateInsight,
    reload,
  } = useInsights()

  const [activeTab, setActiveTab] = useState<'insights' | 'patterns' | 'learnings'>('insights')

  return (
    <div className="flex flex-col h-full bg-surface overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-outline-variant/10 bg-surface-container/40 px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Brain size={20} strokeWidth={1.5} className="text-primary" />
            <div>
              <h1 className="text-lg font-bold text-on-surface">Memória Cumulativa</h1>
              <p className="text-[12px] text-on-surface-muted">
                Aprendizados, padrões e insights extraídos de cada campanha
              </p>
            </div>
          </div>
          <button
            onClick={reload}
            disabled={isLoading}
            className="p-2 rounded-md text-on-surface-muted hover:text-on-surface hover:bg-surface-container-high transition-colors"
            title="Recarregar"
          >
            <RefreshCw size={14} strokeWidth={1.5} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Stats rápidas */}
        <div className="flex items-center gap-6 mt-4 flex-wrap">
          {[
            { icon: Lightbulb,   label: 'Insights',   count: insights.length,  tab: 'insights'  as const },
            { icon: TrendingUp,  label: 'Padrões',    count: patterns.length,  tab: 'patterns'  as const },
            { icon: Brain,       label: 'Learnings',  count: learnings.length, tab: 'learnings' as const },
          ].map(({ icon: Icon, label, count, tab }) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 transition-colors text-left',
                activeTab === tab
                  ? 'bg-primary-container text-primary'
                  : 'text-on-surface-muted hover:text-on-surface hover:bg-surface-container-high',
              )}
            >
              <Icon size={14} strokeWidth={1.5} />
              <span className="text-[12px] font-medium">{label}</span>
              <span className={cn(
                'text-[11px] font-mono rounded-full px-1.5 py-0.5 min-w-[20px] text-center',
                activeTab === tab ? 'bg-primary/20' : 'bg-surface-container-high',
              )}>
                {count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Filtros */}
      {(activeTab === 'patterns' || activeTab === 'learnings') && (
        <div className="shrink-0 border-b border-outline-variant/10 px-6 py-3 flex items-center gap-3 flex-wrap">
          {/* Busca textual (só em learnings) */}
          {activeTab === 'learnings' && (
            <div className="flex items-center gap-2 bg-surface-container rounded-md px-3 h-8 flex-1 min-w-[200px] max-w-xs">
              <Search size={12} strokeWidth={1.5} className="text-on-surface-muted shrink-0" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar nos learnings…"
                className="bg-transparent text-[12px] text-on-surface placeholder:text-on-surface-muted outline-none flex-1"
              />
            </div>
          )}

          {/* Filtro por categoria */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Filter size={12} strokeWidth={1.5} className="text-on-surface-muted" />
            <button
              onClick={() => setCategoryFilter(null)}
              className={cn(
                'text-[11px] px-2.5 py-1 rounded-full transition-colors',
                !categoryFilter
                  ? 'bg-primary text-on-primary font-medium'
                  : 'bg-surface-container text-on-surface-muted hover:text-on-surface',
              )}
            >
              Todos
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setCategoryFilter(cat.value === categoryFilter ? null : cat.value)}
                className={cn(
                  'text-[11px] px-2.5 py-1 rounded-full transition-colors',
                  categoryFilter === cat.value
                    ? 'bg-primary text-on-primary font-medium'
                    : 'bg-surface-container text-on-surface-muted hover:text-on-surface',
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto px-6 py-6">

        {/* Tab: Insights */}
        {activeTab === 'insights' && (
          <div className="max-w-2xl space-y-4">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)
            ) : insights.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Lightbulb size={32} strokeWidth={1} className="text-on-surface-muted mb-3" />
                <p className="text-[14px] text-on-surface-variant font-medium">
                  Nenhum insight ainda
                </p>
                <p className="text-[12px] text-on-surface-muted mt-1 max-w-xs">
                  Os insights são gerados automaticamente após o aggregator diário
                  acumular learnings suficientes.
                </p>
              </div>
            ) : (
              insights.map((insight) => (
                <InsightCard
                  key={insight.id}
                  insight={insight}
                  onValidate={validateInsight}
                />
              ))
            )}
          </div>
        )}

        {/* Tab: Padrões */}
        {activeTab === 'patterns' && (
          <div className="max-w-2xl space-y-3">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)
            ) : patterns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <TrendingUp size={32} strokeWidth={1} className="text-on-surface-muted mb-3" />
                <p className="text-[14px] text-on-surface-variant font-medium">
                  Nenhum padrão identificado ainda
                </p>
                <p className="text-[12px] text-on-surface-muted mt-1 max-w-xs">
                  Padrões são gerados quando ≥ 3 learnings similares são acumulados.
                  Execute mais pipelines para gerar dados.
                </p>
              </div>
            ) : (
              patterns.map((pattern) => (
                <PatternCard key={pattern.id} pattern={pattern} />
              ))
            )}
          </div>
        )}

        {/* Tab: Learnings */}
        {activeTab === 'learnings' && (
          <div className="max-w-2xl space-y-3">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)
            ) : learnings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Brain size={32} strokeWidth={1} className="text-on-surface-muted mb-3" />
                <p className="text-[14px] text-on-surface-variant font-medium">
                  Nenhum learning encontrado
                </p>
                <p className="text-[12px] text-on-surface-muted mt-1 max-w-xs">
                  Learnings são extraídos automaticamente após cada pipeline concluído.
                  {searchQuery && ' Tente limpar a busca.'}
                </p>
              </div>
            ) : (
              learnings.map((learning) => (
                <LearningCard
                  key={learning.id}
                  learning={learning}
                  onValidate={validateLearning}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
