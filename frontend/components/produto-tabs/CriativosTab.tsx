'use client'
import Link from 'next/link'
import { Film, Image as ImageIcon, ExternalLink, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Skeleton } from '@/components/ui/skeleton'
import type { Pipeline } from '@/components/detalhes-produto'

/* ── Types ─────────────────────────────────────────────────────────── */
interface VideoCreativePipeline extends Pipeline {
  goal: 'video_prod'
}

/* ── Pipeline row ───────────────────────────────────────────────────── */
function VideoPipelineRow({ pipeline }: { pipeline: Pipeline }) {
  const cost = parseFloat(pipeline.cost_so_far_usd ?? '0')
  const isRunning = pipeline.status === 'running'

  return (
    <div className={cn(
      'bg-surface-container border border-white/5 rounded-xl p-5',
      'hover:bg-surface-high transition-colors duration-150'
    )}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
            'bg-[#60A5FA]/10'
          )}>
            <Film size={18} strokeWidth={1.5} className="text-[#60A5FA]" />
          </div>
          <div>
            <p className="text-sm font-medium text-on-surface font-mono">{pipeline.goal}</p>
            <p className="text-[0.6875rem] text-on-surface-muted/60 mt-0.5">
              {new Date(pipeline.created_at).toLocaleDateString('pt-BR', {
                day: '2-digit', month: 'short', year: 'numeric',
              })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={pipeline.status as 'running' | 'done' | 'failed' | 'pending' | 'paused'} />
          {isRunning && pipeline.progress_pct != null && (
            <span className="text-xs font-mono text-[#60A5FA]">{pipeline.progress_pct}%</span>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 pt-3 border-t border-white/5">
        <span className="text-xs text-on-surface-muted font-mono">
          Custo: ${cost.toFixed(4)}
        </span>
        {isRunning ? (
          <span className="flex items-center gap-1.5 text-xs text-[#60A5FA]">
            <Loader2 size={10} strokeWidth={1.5} className="animate-spin" />
            Em produção…
          </span>
        ) : pipeline.status === 'done' ? (
          <span className="text-xs text-[#4ADE80] font-medium">
            Concluído
          </span>
        ) : null}
      </div>
    </div>
  )
}

/* ── Skeleton ───────────────────────────────────────────────────────── */
export function CriativosTabSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 2 }).map((_, i) => (
        <Skeleton key={i} className="h-28 w-full rounded-xl bg-surface-highest" />
      ))}
    </div>
  )
}

/* ── Empty state ────────────────────────────────────────────────────── */
export function CriativosTabEmpty({ sku }: { sku: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-14 h-14 rounded-xl bg-surface-container border border-white/5 flex items-center justify-center">
        <Film size={22} strokeWidth={1.5} className="text-on-surface-muted" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-semibold text-on-surface">Nenhum criativo gerado ainda</p>
        <p className="text-[0.6875rem] text-on-surface-variant max-w-xs">
          Após a aprovação de copies, solicite ao Jarvis para iniciar a produção de vídeo
        </p>
      </div>
      <Link
        href={`/products/${sku}/copies`}
        className="text-sm px-4 py-2 rounded font-medium text-on-surface
          border border-outline-variant/20
          hover:bg-surface-high transition-colors duration-150"
      >
        Ver copies aprovadas
      </Link>
    </div>
  )
}

/* ── Main component ─────────────────────────────────────────────────── */
export interface CriativosTabProps {
  pipelines: Pipeline[]
  sku:       string
}

export function CriativosTab({ pipelines, sku }: CriativosTabProps) {
  const videoPipelines = pipelines.filter((p) => p.goal === 'video_prod')

  if (videoPipelines.length === 0) {
    return <CriativosTabEmpty sku={sku} />
  }

  return (
    <div className="space-y-5">
      {/* Info banner */}
      <div className="bg-[#60A5FA]/5 border border-[#60A5FA]/20 rounded-xl p-4 flex items-start gap-3">
        <Film size={16} strokeWidth={1.5} className="text-[#60A5FA] shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-[#60A5FA]">Pipelines de produção de vídeo</p>
          <p className="text-[0.75rem] text-on-surface-variant mt-0.5">
            Os vídeos são gerados localmente pelo agente video_maker.
            Preview e download disponíveis após a conclusão de cada pipeline.
          </p>
        </div>
      </div>

      {/* Video pipeline list */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-on-surface">
          Pipelines de vídeo ({videoPipelines.length})
        </h3>
        {videoPipelines.map((p) => (
          <VideoPipelineRow key={p.id} pipeline={p} />
        ))}
      </div>

      {/* Image section placeholder */}
      <div className="bg-surface-container border border-white/5 rounded-xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-lg bg-[#A1A1AA]/10 flex items-center justify-center">
            <ImageIcon size={16} strokeWidth={1.5} className="text-[#A1A1AA]" />
          </div>
          <h3 className="text-sm font-semibold text-on-surface">Imagens estáticas</h3>
        </div>
        <p className="text-[0.8125rem] text-on-surface-variant">
          Geração de imagens estáticas via Nano Banana disponível em breve.
        </p>
        <Link
          href={`/?msg=@${sku}+/video`}
          className="mt-3 inline-flex items-center gap-1.5 text-xs text-brand hover:underline"
        >
          <ExternalLink size={10} strokeWidth={1.5} />
          Gerar novo vídeo via Jarvis
        </Link>
      </div>
    </div>
  )
}
