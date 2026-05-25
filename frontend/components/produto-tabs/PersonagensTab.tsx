'use client'
import { useEffect, useState } from 'react'
import { Users, Clapperboard } from 'lucide-react'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'

/* ── Types ─────────────────────────────────────────────────────────── */
interface CharacterAppearance {
  age_range:  string
  gender:     string
  ethnicity:  string
  hair:       string
  style:      string
  expression: string
}

interface CharacterData {
  combination_tag:          string
  character_role:           string
  character_anchor:         string
  appearance:               CharacterAppearance
  personality:              string
  midjourney_anchor_prompt: string
  character_rationale:      string
}

interface ArtifactRow {
  id:                  string
  artifact_data:       CharacterData
  copy_combination_id: string
  copy_combinations:   { tag: string } | null
}

/* ── Character card ─────────────────────────────────────────────────── */
function CharacterCard({ row }: { row: ArtifactRow }) {
  const d = row.artifact_data
  const tag = d.combination_tag ?? row.copy_combinations?.tag ?? '—'

  return (
    <div className="bg-surface-container border border-white/5 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-white/5">
        <Users size={15} strokeWidth={1.5} className="text-accent-violet" />
        <span className="text-sm font-semibold text-on-surface font-mono">{tag}</span>
        {d.character_role && (
          <span className="text-[0.625rem] bg-surface-high text-on-surface-muted px-1.5 py-0.5 rounded font-mono">
            {d.character_role}
          </span>
        )}
      </div>

      <div className="p-4 space-y-4">
        {d.character_anchor && (
          <div>
            <p className="text-[0.625rem] text-on-surface-muted uppercase tracking-widest mb-1">
              Character anchor
            </p>
            <p className="text-[0.75rem] text-on-surface font-mono leading-relaxed">
              {d.character_anchor}
            </p>
          </div>
        )}

        {d.appearance && (
          <div>
            <p className="text-[0.625rem] text-on-surface-muted uppercase tracking-widest mb-2">Aparência</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(d.appearance).map(([key, val]) => (
                <div key={key} className="bg-surface-high rounded-lg p-2">
                  <p className="text-[0.5625rem] text-on-surface-muted uppercase tracking-wider mb-0.5">
                    {key.replace('_', ' ')}
                  </p>
                  <p className="text-[0.6875rem] text-on-surface">{String(val)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {d.personality && (
          <div>
            <p className="text-[0.625rem] text-on-surface-muted uppercase tracking-widest mb-1">Personalidade</p>
            <p className="text-[0.75rem] text-on-surface-variant leading-relaxed">{d.personality}</p>
          </div>
        )}

        {d.midjourney_anchor_prompt && (
          <div>
            <p className="text-[0.625rem] text-on-surface-muted uppercase tracking-widest mb-1">
              Midjourney anchor prompt
            </p>
            <div className="bg-surface-high rounded-lg p-3">
              <p className="text-[0.6875rem] text-on-surface font-mono leading-relaxed">
                {d.midjourney_anchor_prompt}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Skeleton ───────────────────────────────────────────────────────── */
export function PersonagensTabSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 2 }).map((_, i) => (
        <Skeleton key={i} className="h-48 w-full rounded-xl bg-surface-highest" />
      ))}
    </div>
  )
}

/* ── Main ───────────────────────────────────────────────────────────── */
export interface PersonagensTabProps {
  sku: string
}

export function PersonagensTab({ sku }: PersonagensTabProps) {
  const [characters, setCharacters] = useState<ArtifactRow[]>([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    if (!sku) return
    fetch(`/api/products/${sku}/creative-artifacts?type=character`)
      .then(r => r.json())
      .then(d => setCharacters(d.artifacts ?? []))
      .finally(() => setLoading(false))
  }, [sku])

  if (loading) return <PersonagensTabSkeleton />

  if (characters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-14 h-14 rounded-xl bg-surface-container border border-white/5 flex items-center justify-center">
          <Clapperboard size={22} strokeWidth={1.5} className="text-on-surface-muted" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-on-surface">Nenhum personagem gerado ainda</p>
          <p className="text-[0.6875rem] text-on-surface-variant max-w-xs">
            Gere os scripts na aba <span className="font-mono text-brand">Copy</span> para criar os personagens automaticamente.
          </p>
        </div>
        <Link
          href={`/products/${sku}/copies`}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-surface-container border border-white/5
            text-on-surface-variant hover:text-on-surface hover:bg-surface-high transition-all duration-150"
        >
          Ir para Copy →
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Users size={16} strokeWidth={1.5} className="text-accent-violet" />
        <h3 className="text-sm font-semibold text-on-surface">
          Personagens <span className="text-on-surface-muted font-normal">({characters.length})</span>
        </h3>
      </div>
      {characters.map(row => <CharacterCard key={row.id} row={row} />)}
    </div>
  )
}
