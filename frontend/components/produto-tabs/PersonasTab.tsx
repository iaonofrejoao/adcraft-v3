'use client'
import type { ElementType } from 'react'
import Link from 'next/link'
import {
  UserRound, MapPin, Briefcase, BookOpen, Heart,
  AlertCircle, MessageCircle, ExternalLink, RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

/* ── Types ─────────────────────────────────────────────────────────── */
export interface AvatarArtifactData {
  summary: string
  full_profile: {
    fictional_name: string
    age_range:      string
    gender:         string
    location:       string
    income_level:   string
    education:      string
    occupation:     string
  }
  psychographic: {
    primary_pain:       string
    secondary_pains:    string[]
    primary_desire:     string
    secondary_desires:  string[]
    tried_before:       string[]
    objections:         string[]
    language_style:     string
  }
  verbatim_expressions: string[]
  data_sources?:        string[]
}

/* ── Profile row ────────────────────────────────────────────────────── */
function ProfileRow({ Icon, label, value }: {
  Icon:  ElementType
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-white/5 last:border-0">
      <div className="w-7 h-7 rounded-md bg-surface-high flex items-center justify-center shrink-0 mt-0.5">
        <Icon size={14} strokeWidth={1.5} className="text-on-surface-muted" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[0.625rem] text-on-surface-muted/50 uppercase tracking-wider">{label}</p>
        <p className="text-[0.8125rem] text-on-surface mt-0.5">{value}</p>
      </div>
    </div>
  )
}

/* ── List section ───────────────────────────────────────────────────── */
function ListSection({ title, items, accent }: {
  title:  string
  items:  string[]
  accent?: string
}) {
  if (!items?.length) return null
  return (
    <div>
      <h4 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-on-surface-muted/60 mb-2">
        {title}
      </h4>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-[0.8125rem] text-on-surface-variant">
            <span className={cn('shrink-0 mt-1 text-[0.5rem]', accent ?? 'text-on-surface-muted/40')}>●</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ── Verbatim pill ──────────────────────────────────────────────────── */
function VerbatimPill({ text }: { text: string }) {
  return (
    <div className="bg-surface-high border border-white/5 rounded-lg px-3 py-2 text-[0.8125rem] text-on-surface-variant italic">
      "{text}"
    </div>
  )
}

/* ── Source link ────────────────────────────────────────────────────── */
function SourceLink({ url }: { url: string }) {
  let display: string
  try {
    display = new URL(url).hostname.replace('www.', '')
  } catch {
    display = url.length > 40 ? url.slice(0, 40) + '…' : url
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1 text-xs text-brand hover:underline font-mono"
    >
      <span className="truncate max-w-[200px]">{display}</span>
      <ExternalLink size={10} strokeWidth={1.5} className="shrink-0" />
    </a>
  )
}

/* ── Skeleton ───────────────────────────────────────────────────────── */
export function PersonasTabSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-16 w-full rounded-xl bg-surface-highest" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-64 rounded-xl bg-surface-highest" />
        <Skeleton className="h-64 rounded-xl bg-surface-highest" />
      </div>
      <Skeleton className="h-28 rounded-xl bg-surface-highest" />
    </div>
  )
}

/* ── Empty state ────────────────────────────────────────────────────── */
export function PersonasTabEmpty({ sku }: { sku: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-14 h-14 rounded-xl bg-surface-container border border-white/5 flex items-center justify-center">
        <UserRound size={22} strokeWidth={1.5} className="text-on-surface-muted" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-semibold text-on-surface">Nenhuma persona encontrada</p>
        <p className="text-[0.6875rem] text-on-surface-variant">
          Solicite ao Jarvis para construir o perfil do comprador ideal
        </p>
      </div>
      <Link
        href={`/?msg=@${sku}+/avatar`}
        className="text-sm px-4 py-2 rounded font-medium text-[#131314]
          bg-gradient-to-br from-[#F28705] to-[#FFB690]
          hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]
          transition-shadow duration-150"
      >
        Gerar persona via Jarvis
      </Link>
    </div>
  )
}

/* ── Main component ─────────────────────────────────────────────────── */
export interface PersonasTabProps {
  data:      AvatarArtifactData
  createdAt: string
  sku:       string
}

export function PersonasTab({ data, createdAt, sku }: PersonasTabProps) {
  const { full_profile: fp, psychographic: psy } = data

  return (
    <div className="space-y-5">
      {/* Summary card */}
      <div className="bg-surface-container border border-white/5 rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#F29F05]/10 border border-[#F29F05]/20 flex items-center justify-center shrink-0">
              <UserRound size={18} strokeWidth={1.5} className="text-[#F29F05]" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-on-surface">{fp.fictional_name}</h2>
              <p className="text-[0.6875rem] text-on-surface-variant font-mono">
                {fp.age_range} · {fp.gender} · {fp.occupation}
              </p>
            </div>
          </div>
          <Link
            href={`/?msg=@${sku}+/avatar`}
            className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-brand transition-colors duration-150 shrink-0"
          >
            <RefreshCw size={12} strokeWidth={1.5} />
            Nova persona
          </Link>
        </div>
        <p className="mt-4 text-[0.8125rem] leading-relaxed text-on-surface-variant">{data.summary}</p>
      </div>

      {/* Profile + Psychographic grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Demographic profile */}
        <div className="bg-surface-container border border-white/5 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-on-surface mb-4">Perfil demográfico</h3>
          <ProfileRow Icon={MapPin}    label="Localização"    value={fp.location} />
          <ProfileRow Icon={Briefcase} label="Ocupação"       value={fp.occupation} />
          <ProfileRow Icon={BookOpen}  label="Escolaridade"   value={fp.education} />
          <ProfileRow Icon={UserRound} label="Renda"          value={fp.income_level} />
        </div>

        {/* Psychographic */}
        <div className="bg-surface-container border border-white/5 rounded-xl p-5 space-y-5">
          <h3 className="text-sm font-semibold text-on-surface">Psicografia</h3>

          <div>
            <h4 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-[#F87171]/70 mb-1">
              Dor principal
            </h4>
            <p className="text-[0.8125rem] text-on-surface-variant leading-relaxed">
              {psy.primary_pain}
            </p>
          </div>

          <div>
            <h4 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-[#4ADE80]/70 mb-1">
              Desejo principal
            </h4>
            <p className="text-[0.8125rem] text-on-surface-variant leading-relaxed">
              {psy.primary_desire}
            </p>
          </div>

          <div>
            <h4 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-on-surface-muted/50 mb-1">
              Estilo de linguagem
            </h4>
            <p className="text-[0.8125rem] text-on-surface-variant italic">{psy.language_style}</p>
          </div>
        </div>
      </div>

      {/* Secondary data */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-surface-container border border-white/5 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-on-surface flex items-center gap-2">
            <Heart size={14} strokeWidth={1.5} className="text-[#F87171]" />
            Dores secundárias
          </h3>
          <ListSection title="" items={psy.secondary_pains} accent="text-[#F87171]/50" />
        </div>

        <div className="bg-surface-container border border-white/5 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-on-surface flex items-center gap-2">
            <AlertCircle size={14} strokeWidth={1.5} className="text-[#FCD34D]" />
            Objeções
          </h3>
          <ListSection title="" items={psy.objections} accent="text-[#FCD34D]/50" />
        </div>

        <div className="bg-surface-container border border-white/5 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-on-surface flex items-center gap-2">
            <MessageCircle size={14} strokeWidth={1.5} className="text-[#60A5FA]" />
            Já tentou antes
          </h3>
          <ListSection title="" items={psy.tried_before} accent="text-[#60A5FA]/50" />
        </div>
      </div>

      {/* Verbatim expressions */}
      {psy.secondary_desires?.length > 0 && (
        <div className="bg-surface-container border border-white/5 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-on-surface mb-3">Desejos secundários</h3>
          <ListSection title="" items={psy.secondary_desires} accent="text-[#4ADE80]/50" />
        </div>
      )}

      {data.verbatim_expressions?.length > 0 && (
        <div className="bg-surface-container border border-white/5 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-on-surface mb-3">Expressões literais do avatar</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {data.verbatim_expressions.map((expr, i) => (
              <VerbatimPill key={i} text={expr} />
            ))}
          </div>
        </div>
      )}

      {/* Sources */}
      {(data.data_sources?.length ?? 0) > 0 && (
        <div className="bg-surface-container border border-white/5 rounded-xl p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-sm font-semibold text-on-surface">Fontes pesquisadas</h3>
            <span className="text-[0.6875rem] text-on-surface-muted font-mono">
              {new Date(createdAt).toLocaleDateString('pt-BR')}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {data.data_sources!.map((url, i) => (
              <SourceLink key={i} url={url} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
