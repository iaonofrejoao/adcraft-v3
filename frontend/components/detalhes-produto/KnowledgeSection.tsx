'use client'
import Link from 'next/link'
import { UserRound, BarChart2, Megaphone, ExternalLink, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Pipeline } from './types'

/* ── Agent card definitions ─────────────────────────────────────── */
interface CardDef {
  goal:       string
  title:      string
  Icon:       LucideIcon
  iconColor:  string
  iconBg:     string
  versionColor: string
  versionBg:  string
  gradientFrom: string
}

const CARD_DEFS: CardDef[] = [
  {
    goal:         'avatar_research',
    title:        'Avatar',
    Icon:         UserRound,
    iconColor:    'text-agent-research',
    iconBg:       'bg-agent-research/10',
    versionColor: 'text-agent-research',
    versionBg:    'bg-agent-research/10',
    gradientFrom: 'from-surface-low',
  },
  {
    goal:         'market_research',
    title:        'Mercado',
    Icon:         BarChart2,
    iconColor:    'text-agent-market',
    iconBg:       'bg-agent-market/10',
    versionColor: 'text-agent-market',
    versionBg:    'bg-agent-market/10',
    gradientFrom: 'from-surface-low',
  },
  {
    goal:         'angle_generation',
    title:        'Ângulos',
    Icon:         Megaphone,
    iconColor:    'text-agent-strategy',
    iconBg:       'bg-agent-strategy/10',
    versionColor: 'text-agent-strategy',
    versionBg:    'bg-agent-strategy/10',
    gradientFrom: 'from-surface-low',
  },
]

/* ── Status copy ─────────────────────────────────────────────────── */
function statusPreview(pipeline: Pipeline | undefined): string {
  if (!pipeline) return 'Nenhuma análise disponível ainda.'
  const map: Record<string, string> = {
    done:    'Análise concluída com sucesso. Clique em "Ver completo" para acessar os resultados.',
    running: 'Em execução — aguardando conclusão do agente.',
    pending: 'Na fila de execução.',
    failed:  'Execução falhou. Reinicie o pipeline para tentar novamente.',
    paused:  'Pipeline pausado.',
  }
  return map[pipeline.status] ?? 'Status desconhecido.'
}

/* ── Knowledge Card ──────────────────────────────────────────────── */
interface KnowledgeCardProps {
  def:      CardDef
  pipeline: Pipeline | undefined
  sku:      string
}

function KnowledgeCard({ def, pipeline, sku }: KnowledgeCardProps) {
  const { Icon, title, iconColor, iconBg, versionColor, versionBg } = def
  const isRunning = pipeline?.status === 'running'
  const isDone    = pipeline?.status === 'done'

  return (
    <div
      className={cn(
        'bg-surface-low border border-white/5 rounded-xl p-6',
        'hover:bg-surface-container transition-colors duration-200 group'
      )}
    >
      {/* Card header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', iconBg)}>
            <Icon size={20} strokeWidth={1.5} className={iconColor} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-on-surface">{title}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              {pipeline ? (
                <>
                  <span className={cn(
                    'text-[0.625rem] font-mono px-1.5 py-0.5 rounded',
                    versionColor, versionBg
                  )}>
                    {pipeline.status}
                  </span>
                  <span className="text-[0.625rem] text-on-surface-muted/40">
                    {new Date(pipeline.updated_at ?? pipeline.created_at).toLocaleDateString('pt-BR')}
                  </span>
                </>
              ) : (
                <span className="text-[0.625rem] text-on-surface-muted/40">sem dados</span>
              )}
            </div>
          </div>
        </div>

        {isDone ? (
          <Link
            href={`/products/${sku}/copies`}
            className="text-xs text-brand hover:underline font-medium flex items-center gap-1"
          >
            Ver completo
            <ExternalLink size={10} strokeWidth={1.5} />
          </Link>
        ) : (
          <Link
            href={`/?msg=@${sku}+/${def.goal.replace('_', '-')}`}
            className="text-xs text-on-surface-variant hover:text-brand font-medium transition-colors duration-150 flex items-center gap-1"
          >
            <Zap size={10} strokeWidth={1.5} />
            Gerar
          </Link>
        )}
      </div>

      {/* Preview content */}
      <div className="relative overflow-hidden min-h-[64px]">
        {isRunning ? (
          <div className="flex items-center gap-2 text-[0.8125rem] text-on-surface-variant">
            <span className="w-1.5 h-1.5 rounded-full bg-status-running-text animate-pulse shrink-0" />
            Em execução…
            {pipeline?.progress_pct != null && (
              <>
                <span className="ml-auto font-mono text-status-running-text">
                  {pipeline.progress_pct}%
                </span>
              </>
            )}
          </div>
        ) : (
          <>
            <p className="text-[0.8125rem] leading-relaxed text-on-surface-variant/80">
              {statusPreview(pipeline)}
            </p>
            {/* Fade-out gradient — only when content might overflow */}
            <div className={cn(
              'absolute bottom-0 left-0 w-full h-10',
              'bg-gradient-to-t from-surface-low to-transparent',
              'group-hover:from-surface-container transition-colors duration-200'
            )} />
          </>
        )}
      </div>
    </div>
  )
}

/* ── Knowledge Section ───────────────────────────────────────────── */
interface KnowledgeSectionProps {
  pipelines: Pipeline[]
  sku:       string
  className?: string
}

export function KnowledgeSection({ pipelines, sku, className }: KnowledgeSectionProps) {
  function findPipeline(goal: string): Pipeline | undefined {
    return pipelines
      .filter((p) => p.goal === goal)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <h2 className="text-[1rem] font-semibold tracking-tight text-on-surface">
        Conhecimento acumulado
      </h2>
      {CARD_DEFS.map((def) => (
        <KnowledgeCard
          key={def.goal}
          def={def}
          pipeline={findPipeline(def.goal)}
          sku={sku}
        />
      ))}
    </div>
  )
}
