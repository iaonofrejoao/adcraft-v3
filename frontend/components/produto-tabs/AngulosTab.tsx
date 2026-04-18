'use client'
import Link from 'next/link'
import {
  Crosshair, Zap, Heart, Lightbulb, RefreshCw,
  ChevronRight, Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

/* ── Types ─────────────────────────────────────────────────────────── */
export interface AngleHook {
  hook_text:    string
  hook_type:    'question' | 'shocking_statement' | 'story' | 'fact'
  variant_id:   string
}

export interface AngulosArtifactData {
  primary_angle:          string
  angle_type:             'betrayed_authority' | 'transformation' | 'social_proof' | 'novelty' | 'fear' | 'curiosity' | 'identification'
  usp:                    string
  emotional_trigger:      string
  hooks:                  AngleHook[]
  selected_hook_variant:  string
  alternative_angles:     string[]
  angle_rationale:        string
}

/* ── Label maps ─────────────────────────────────────────────────────── */
const ANGLE_TYPE_LABELS: Record<AngulosArtifactData['angle_type'], string> = {
  betrayed_authority: 'Autoridade traída',
  transformation:     'Transformação',
  social_proof:       'Prova social',
  novelty:            'Novidade',
  fear:               'Medo',
  curiosity:          'Curiosidade',
  identification:     'Identificação',
}

const HOOK_TYPE_LABELS: Record<AngleHook['hook_type'], string> = {
  question:          'Pergunta',
  shocking_statement:'Declaração chocante',
  story:             'História',
  fact:              'Fato',
}

const ANGLE_TYPE_COLOR: Record<AngulosArtifactData['angle_type'], string> = {
  betrayed_authority: 'text-status-failed-text  bg-status-failed  border-status-failed-text/20',
  transformation:     'text-status-done-text    bg-status-done    border-status-done-text/20',
  social_proof:       'text-status-running-text bg-status-running border-status-running-text/20',
  novelty:            'text-accent-violet       bg-accent-violet/10 border-accent-violet/20',
  fear:               'text-brand               bg-brand-muted    border-brand/20',
  curiosity:          'text-status-paused-text  bg-status-paused  border-status-paused-text/20',
  identification:     'text-accent-teal         bg-accent-teal/10 border-accent-teal/20',
}

const HOOK_TYPE_COLOR: Record<AngleHook['hook_type'], string> = {
  question:           'text-status-running-text bg-status-running border-status-running-text/20',
  shocking_statement: 'text-status-failed-text  bg-status-failed  border-status-failed-text/20',
  story:              'text-accent-violet       bg-accent-violet/10 border-accent-violet/20',
  fact:               'text-status-done-text    bg-status-done    border-status-done-text/20',
}

/* ── Skeleton ───────────────────────────────────────────────────────── */
export function AngulosTabSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-28 w-full rounded-xl bg-surface-high" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-20 rounded-xl bg-surface-high" />
        <Skeleton className="h-20 rounded-xl bg-surface-high" />
      </div>
      <Skeleton className="h-64 rounded-xl bg-surface-high" />
      <Skeleton className="h-28 rounded-xl bg-surface-high" />
    </div>
  )
}

/* ── Empty state ────────────────────────────────────────────────────── */
export function AngulosTabEmpty({ sku }: { sku: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-14 h-14 rounded-xl bg-surface-container border border-white/5 flex items-center justify-center">
        <Crosshair size={22} strokeWidth={1.5} className="text-on-surface-muted" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-semibold text-on-surface">Nenhum ângulo encontrado</p>
        <p className="text-[0.6875rem] text-on-surface-variant">
          Solicite ao Jarvis para descobrir o ângulo campeão deste produto
        </p>
      </div>
      <Link
        href={`/?msg=@${sku}+/angulos`}
        className="text-sm px-4 py-2 rounded font-medium text-on-primary
          bg-brand-gradient
          hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]
          transition-shadow duration-150"
      >
        Gerar ângulos via Jarvis
      </Link>
    </div>
  )
}

/* ── Hook card ──────────────────────────────────────────────────────── */
function HookCard({ hook, isSelected, sku }: {
  hook:       AngleHook
  isSelected: boolean
  sku:        string
}) {
  const colorClass = HOOK_TYPE_COLOR[hook.hook_type] ?? 'text-on-surface-muted bg-surface-high border-white/10'

  return (
    <div className={cn(
      'relative bg-surface-container border rounded-xl p-5 flex flex-col gap-3 transition-all duration-150',
      isSelected
        ? 'border-brand/40 shadow-[0_0_0_1px_rgba(242,135,5,0.15),inset_0_0_0_1px_rgba(242,135,5,0.05)]'
        : 'border-white/5'
    )}>
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {/* Variant badge */}
          <span className={cn(
            'text-[0.625rem] font-bold font-mono px-2 py-0.5 rounded border',
            isSelected
              ? 'text-brand bg-brand/10 border-brand/30'
              : 'text-on-surface-muted bg-surface-high border-white/10'
          )}>
            {hook.variant_id}
          </span>

          {/* Hook type badge */}
          <span className={cn(
            'text-[0.625rem] font-medium px-2 py-0.5 rounded border',
            colorClass
          )}>
            {HOOK_TYPE_LABELS[hook.hook_type]}
          </span>

          {isSelected && (
            <span className="text-[0.625rem] font-semibold text-brand flex items-center gap-1">
              <Sparkles size={10} strokeWidth={1.5} />
              Selecionado
            </span>
          )}
        </div>

        {/* CTA: gerar criativo com este hook */}
        <Link
          href={`/?msg=@${sku} gere um criativo com o hook: "${hook.hook_text}"`}
          className="flex items-center gap-1 text-[0.6875rem] text-on-surface-muted hover:text-brand transition-colors shrink-0"
        >
          <Zap size={11} strokeWidth={1.5} />
          Gerar criativo
          <ChevronRight size={10} strokeWidth={1.5} />
        </Link>
      </div>

      {/* Hook text */}
      <p className="text-[0.875rem] leading-relaxed text-on-surface-variant italic">
        "{hook.hook_text}"
      </p>
    </div>
  )
}

/* ── Main component ─────────────────────────────────────────────────── */
export interface AngulosTabProps {
  data:      AngulosArtifactData
  createdAt: string
  sku:       string
}

export function AngulosTab({ data, createdAt, sku }: AngulosTabProps) {
  const angleColor = ANGLE_TYPE_COLOR[data.angle_type] ?? 'text-on-surface-muted bg-surface-high border-white/10'

  return (
    <div className="space-y-5">

      {/* Primary angle card */}
      <div className="bg-surface-container border border-white/5 rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0">
              <Crosshair size={18} strokeWidth={1.5} className="text-brand" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-on-surface">Ângulo campeão</h2>
                <span className={cn(
                  'text-[0.625rem] font-medium px-2 py-0.5 rounded border',
                  angleColor
                )}>
                  {ANGLE_TYPE_LABELS[data.angle_type]}
                </span>
              </div>
              <p className="text-[0.6875rem] text-on-surface-variant font-mono mt-0.5">
                Gerado em {new Date(createdAt).toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>
          <Link
            href={`/?msg=@${sku}+/angulos`}
            className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-brand transition-colors duration-150 shrink-0"
          >
            <RefreshCw size={12} strokeWidth={1.5} />
            Novo ângulo
          </Link>
        </div>
        <p className="mt-4 text-[0.9375rem] font-medium text-on-surface leading-relaxed">
          {data.primary_angle}
        </p>
      </div>

      {/* USP + Emotional trigger */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-surface-container border border-white/5 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb size={14} strokeWidth={1.5} className="text-status-paused-text" />
            <h3 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-status-paused-text/80">
              USP — Diferencial único
            </h3>
          </div>
          <p className="text-[0.8125rem] text-on-surface-variant leading-relaxed">{data.usp}</p>
        </div>

        <div className="bg-surface-container border border-white/5 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Heart size={14} strokeWidth={1.5} className="text-status-failed-text" />
            <h3 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-status-failed-text/80">
              Gatilho emocional
            </h3>
          </div>
          <p className="text-[0.8125rem] text-on-surface-variant leading-relaxed">{data.emotional_trigger}</p>
        </div>
      </div>

      {/* Hooks */}
      {data.hooks?.length > 0 && (
        <div className="bg-surface-low border border-white/5 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-on-surface flex items-center gap-2">
              <Zap size={14} strokeWidth={1.5} className="text-brand" />
              Hooks de abertura
            </h3>
            <span className="text-[0.6875rem] text-on-surface-muted font-mono">
              {data.hooks.length} variante{data.hooks.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-3">
            {data.hooks.map((hook, i) => (
              <HookCard
                key={i}
                hook={hook}
                isSelected={hook.variant_id === data.selected_hook_variant}
                sku={sku}
              />
            ))}
          </div>
        </div>
      )}

      {/* Rationale */}
      {data.angle_rationale && (
        <div className="bg-surface-container border border-white/5 rounded-xl p-5">
          <h3 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-on-surface-muted/60 mb-2">
            Raciocínio estratégico
          </h3>
          <p className="text-[0.8125rem] text-on-surface-variant leading-relaxed">
            {data.angle_rationale}
          </p>
        </div>
      )}

      {/* Alternative angles */}
      {data.alternative_angles?.length > 0 && (
        <div className="bg-surface-container border border-white/5 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-on-surface">Ângulos alternativos</h3>
            <Link
              href={`/?msg=@${sku} desenvolva o ângulo alternativo: "${data.alternative_angles[0]}"`}
              className="flex items-center gap-1 text-[0.6875rem] text-on-surface-muted hover:text-brand transition-colors"
            >
              <Zap size={11} strokeWidth={1.5} />
              Desenvolver via Jarvis
              <ChevronRight size={10} strokeWidth={1.5} />
            </Link>
          </div>
          <ul className="space-y-2">
            {data.alternative_angles.map((angle, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="shrink-0 mt-1.5 w-1 h-1 rounded-full bg-on-surface-muted/30" />
                <div className="flex-1 flex items-start justify-between gap-3">
                  <p className="text-[0.8125rem] text-on-surface-variant">{angle}</p>
                  <Link
                    href={`/?msg=@${sku} crie hooks para o ângulo: "${angle}"`}
                    className="shrink-0 text-[0.625rem] text-on-surface-muted hover:text-brand transition-colors flex items-center gap-0.5"
                  >
                    Hooks
                    <ChevronRight size={9} strokeWidth={1.5} />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
