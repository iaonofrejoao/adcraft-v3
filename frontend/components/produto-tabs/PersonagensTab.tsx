'use client'
import { useState } from 'react'
import { Users, Clapperboard, ImageOff, Copy, Check, ChevronLeft, ChevronRight, X } from 'lucide-react'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { usePersonagens } from '@/hooks/usePersonagens'
import type {
  CharacterArtifact,
  CharacterArtifactData,
  CharacterEntry,
  PersonaAsset,
} from '@/hooks/usePersonagens'

// ── Helpers ───────────────────────────────────────────────────────────────────

function driveUrlToProxy(url: string): string {
  return `/api/drive-image?url=${encodeURIComponent(url)}`
}

function normalizeCharacters(data: CharacterArtifactData): CharacterEntry[] {
  if (data.characters?.length) return data.characters
  return [{
    character_role:           data.character_role,
    character_anchor:         data.character_anchor,
    appearance:               data.appearance,
    personality:              data.personality,
    midjourney_anchor_prompt: data.midjourney_anchor_prompt,
    character_rationale:      data.character_rationale,
    physical_description: data.appearance
      ? {
          age_appearance: data.appearance.age_range ?? data.appearance.age_appearance,
          gender:         data.appearance.gender,
          ethnicity:      data.appearance.ethnicity,
          hair:           data.appearance.hair,
          style:          data.appearance.style,
          expression:     data.appearance.expression,
        }
      : undefined,
  }]
}

function getPrimaryCharacter(artifacts: CharacterArtifact[]): CharacterEntry | null {
  if (!artifacts.length) return null
  const first = artifacts[0]
  const entries = normalizeCharacters(first.artifact_data)
  if (!entries.length) return null
  const primaryId = first.artifact_data.primary_character_id
  if (primaryId) return entries.find(e => e.character_id === primaryId) ?? entries[0]
  return entries[0]
}

// ── DriveImage ────────────────────────────────────────────────────────────────

function DriveImage({ url, alt, className }: { url: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  const thumb = driveUrlToProxy(url)

  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-surface-high text-on-surface-muted ${className ?? ''}`}>
        <ImageOff size={20} strokeWidth={1.5} />
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={thumb}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`object-cover ${className ?? ''}`}
    />
  )
}

// ── PromptBlock ───────────────────────────────────────────────────────────────

function PromptBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div>
      {label && (
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[0.625rem] text-on-surface-muted uppercase tracking-widest">{label}</p>
        </div>
      )}
      <div className="relative bg-white/4 border border-white/5 rounded-lg p-3 pr-12">
        <p className="text-[0.6875rem] text-on-surface font-mono leading-relaxed">{text}</p>
        <button
          onClick={handleCopy}
          className="absolute top-2.5 right-2.5 flex items-center gap-1 text-[0.5625rem] text-on-surface-muted hover:text-on-surface transition-colors bg-surface-high rounded px-1.5 py-1"
        >
          {copied
            ? <Check size={10} strokeWidth={2} className="text-emerald-400" />
            : <Copy size={10} strokeWidth={1.5} />}
        </button>
      </div>
    </div>
  )
}

// ── CharacterDetailPanel (painel direito do modal) ────────────────────────────

function CharacterDetailPanel({ character, consistencyNotes }: {
  character: CharacterEntry
  consistencyNotes?: string
}) {
  const pd = character.physical_description
  const va = character.visual_anchors

  return (
    <div className="space-y-5">
      {/* Nome + badges */}
      <div className="flex items-center gap-2 flex-wrap">
        {character.character_name && (
          <span className="text-base font-semibold text-on-surface">{character.character_name}</span>
        )}
        {character.character_role && (
          <span className="text-[0.625rem] bg-surface-high text-on-surface-muted px-2 py-0.5 rounded font-mono">
            {character.character_role}
          </span>
        )}
        {character.style_reference && (
          <span className="text-[0.625rem] bg-accent-violet/10 text-accent-violet px-2 py-0.5 rounded font-mono">
            {character.style_reference}
          </span>
        )}
      </div>

      {/* Aparência física */}
      {pd && Object.values(pd).some(Boolean) && (
        <div>
          <p className="text-[0.625rem] text-on-surface-muted uppercase tracking-widest mb-2">Aparência</p>
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(pd) as [string, string | undefined][])
              .filter(([, v]) => v)
              .map(([key, val]) => (
                <div key={key} className="bg-surface-high rounded-lg p-2">
                  <p className="text-[0.5625rem] text-on-surface-muted uppercase tracking-wider mb-0.5">
                    {key.replace(/_/g, ' ')}
                  </p>
                  <p className="text-[0.6875rem] text-on-surface">{val}</p>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Character anchor (formato antigo) */}
      {character.character_anchor && (
        <div>
          <p className="text-[0.625rem] text-on-surface-muted uppercase tracking-widest mb-1">
            Character anchor
          </p>
          <p className="text-[0.75rem] text-on-surface font-mono leading-relaxed">
            {character.character_anchor}
          </p>
        </div>
      )}

      {/* Personalidade */}
      {character.personality_traits?.length ? (
        <div>
          <p className="text-[0.625rem] text-on-surface-muted uppercase tracking-widest mb-2">Personalidade</p>
          <div className="flex flex-wrap gap-1.5">
            {character.personality_traits.map((t, i) => (
              <span key={i} className="text-[0.6875rem] bg-surface-high text-on-surface-variant px-2 py-0.5 rounded-full">
                {t}
              </span>
            ))}
          </div>
        </div>
      ) : character.personality ? (
        <div>
          <p className="text-[0.625rem] text-on-surface-muted uppercase tracking-widest mb-1">Personalidade</p>
          <p className="text-[0.75rem] text-on-surface-variant leading-relaxed">{character.personality}</p>
        </div>
      ) : null}

      {/* Anchors visuais */}
      {va && Object.values(va).some(Boolean) && (
        <div>
          <p className="text-[0.625rem] text-on-surface-muted uppercase tracking-widest mb-2">Anchors visuais</p>
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(va) as [string, string | undefined][])
              .filter(([, v]) => v)
              .map(([key, val]) => (
                <div key={key} className="bg-surface-high rounded-lg p-2">
                  <p className="text-[0.5625rem] text-on-surface-muted uppercase tracking-wider mb-0.5">
                    {key.replace(/_/g, ' ')}
                  </p>
                  <p className="text-[0.6875rem] text-on-surface">{val}</p>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Image prompt */}
      {(character.image_prompt_en ?? character.midjourney_anchor_prompt) && (
        <PromptBlock
          label="Image prompt"
          text={(character.image_prompt_en ?? character.midjourney_anchor_prompt)!}
        />
      )}

      {/* Video prompt */}
      {character.video_prompt_en && (
        <PromptBlock label="Video prompt (Veo 3)" text={character.video_prompt_en} />
      )}

      {/* Rationale */}
      {(character.rationale ?? character.character_rationale) && (
        <div>
          <p className="text-[0.625rem] text-on-surface-muted uppercase tracking-widest mb-1">Rationale</p>
          <p className="text-[0.75rem] text-on-surface-variant leading-relaxed italic">
            {character.rationale ?? character.character_rationale}
          </p>
        </div>
      )}

      {/* Consistency notes */}
      {consistencyNotes && (
        <div>
          <p className="text-[0.625rem] text-on-surface-muted uppercase tracking-widest mb-1">Consistency notes</p>
          <p className="text-[0.6875rem] text-on-surface-variant leading-relaxed">{consistencyNotes}</p>
        </div>
      )}
    </div>
  )
}

// ── CharacterModal ────────────────────────────────────────────────────────────

interface ModalState {
  imageUrls:         string[]
  activeIndex:       number
  character:         CharacterEntry
  consistencyNotes?: string
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="text-[0.6rem] font-semibold text-on-surface-muted uppercase tracking-[0.12em]">
        {children}
      </span>
      <div className="flex-1 h-px bg-white/5" />
    </div>
  )
}

function CharacterModal({
  state,
  onClose,
  onNav,
}: {
  state:   ModalState
  onClose: () => void
  onNav:   (index: number) => void
}) {
  const { imageUrls, activeIndex, character, consistencyNotes } = state
  const total = imageUrls.length
  const pd    = character.physical_description
  const va    = character.visual_anchors

  return (
    <DialogPrimitive.Root open onOpenChange={open => { if (!open) onClose() }}>
      <DialogPrimitive.Portal>
        {/* Backdrop escuro com blur */}
        <DialogPrimitive.Overlay
          className="
            fixed inset-0 z-50 bg-black/75 backdrop-blur-sm
            data-open:animate-in   data-open:fade-in-0
            data-closed:animate-out data-closed:fade-out-0
            duration-300
          "
        />

        {/* Container do modal */}
        <DialogPrimitive.Content
          className="
            fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2
            w-[92vw] max-w-5xl max-h-[90vh]
            bg-[#141414] border border-white/8 rounded-2xl overflow-hidden shadow-2xl outline-none
            data-open:animate-in   data-open:fade-in-0   data-open:slide-in-from-bottom-4
            data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-bottom-4
            duration-300
          "
        >
          <DialogPrimitive.Title className="sr-only">
            {character.character_name ?? 'Personagem'}
          </DialogPrimitive.Title>

          <div className="flex" style={{ height: 'min(88vh, 680px)' }}>

            {/* ── Coluna esquerda: imagem ─────────────────────────── */}
            <div className="relative w-[42%] flex-shrink-0 flex flex-col bg-black/30">

              {/* Imagem principal */}
              <div className="relative flex-1 min-h-0 overflow-hidden">
                <DriveImage
                  url={imageUrls[activeIndex]}
                  alt={`Personagem — foto ${activeIndex + 1}`}
                  className="w-full h-full object-cover object-top"
                />

                {/* Gradient bottom para as miniaturas não cortarem a imagem */}
                {total > 1 && (
                  <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                )}

                {/* Setas de navegação */}
                {total > 1 && (
                  <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-3">
                    <button
                      onClick={() => onNav((activeIndex - 1 + total) % total)}
                      className="w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 border border-white/10 flex items-center justify-center transition-all hover:scale-105"
                    >
                      <ChevronLeft size={15} strokeWidth={2} className="text-white" />
                    </button>
                    <span className="text-[0.625rem] text-white/60 font-mono tabular-nums bg-black/50 px-2 py-0.5 rounded-full">
                      {activeIndex + 1} / {total}
                    </span>
                    <button
                      onClick={() => onNav((activeIndex + 1) % total)}
                      className="w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 border border-white/10 flex items-center justify-center transition-all hover:scale-105"
                    >
                      <ChevronRight size={15} strokeWidth={2} className="text-white" />
                    </button>
                  </div>
                )}
              </div>

              {/* Miniaturas */}
              {total > 1 && (
                <div className="flex gap-2 p-3 bg-black/40 border-t border-white/5 overflow-x-auto">
                  {imageUrls.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => onNav(i)}
                      className={`
                        relative flex-shrink-0 w-11 h-16 rounded-md overflow-hidden
                        transition-all duration-200
                        ${i === activeIndex
                          ? 'ring-1 ring-brand/80 opacity-100 scale-100'
                          : 'opacity-35 hover:opacity-60 hover:scale-[1.02]'
                        }
                      `}
                    >
                      <DriveImage url={url} alt={`Thumb ${i + 1}`} className="w-full h-full" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── Coluna direita: ficha ───────────────────────────── */}
            <div className="flex-1 min-w-0 flex flex-col border-l border-white/5">

              {/* Header */}
              <div className="flex items-start justify-between px-6 pt-6 pb-4 flex-shrink-0">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Users size={13} strokeWidth={1.5} className="text-accent-violet mt-px" />
                    <span className="text-[0.6rem] text-on-surface-muted uppercase tracking-[0.14em] font-medium">
                      Ficha do personagem
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {character.character_name && (
                      <h2 className="text-xl font-semibold text-on-surface tracking-tight">
                        {character.character_name}
                      </h2>
                    )}
                    {character.character_role && (
                      <span className="text-[0.625rem] bg-surface-high border border-white/5 text-on-surface-muted px-2 py-0.5 rounded font-mono">
                        {character.character_role}
                      </span>
                    )}
                    {character.style_reference && (
                      <span className="text-[0.625rem] bg-accent-violet/10 text-accent-violet px-2 py-0.5 rounded font-mono border border-accent-violet/20">
                        {character.style_reference}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-muted hover:text-on-surface hover:bg-white/8 transition-all flex-shrink-0"
                >
                  <X size={15} strokeWidth={1.5} />
                </button>
              </div>

              {/* Divider */}
              <div className="h-px bg-white/5 mx-6" />

              {/* Conteúdo rolável */}
              <ScrollArea className="flex-1 min-h-0">
                <div className="px-6 py-5 space-y-6">

                  {/* Aparência */}
                  {pd && Object.values(pd).some(Boolean) && (
                    <div>
                      <SectionLabel>Aparência</SectionLabel>
                      <div className="grid grid-cols-3 gap-2">
                        {(Object.entries(pd) as [string, string | undefined][])
                          .filter(([, v]) => v)
                          .map(([key, val]) => (
                            <div key={key} className="bg-white/4 rounded-lg p-2.5 border border-white/5">
                              <p className="text-[0.5rem] text-on-surface-muted uppercase tracking-widest mb-1">
                                {key.replace(/_/g, ' ')}
                              </p>
                              <p className="text-[0.6875rem] text-on-surface leading-snug">{val}</p>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Character anchor (formato antigo) */}
                  {character.character_anchor && (
                    <div>
                      <SectionLabel>Character anchor</SectionLabel>
                      <p className="text-[0.75rem] text-on-surface font-mono leading-relaxed">
                        {character.character_anchor}
                      </p>
                    </div>
                  )}

                  {/* Personalidade */}
                  {(character.personality_traits?.length || character.personality) && (
                    <div>
                      <SectionLabel>Personalidade</SectionLabel>
                      {character.personality_traits?.length ? (
                        <div className="flex flex-wrap gap-1.5">
                          {character.personality_traits.map((t, i) => (
                            <span
                              key={i}
                              className="text-[0.6875rem] bg-white/4 border border-white/6 text-on-surface-variant px-2.5 py-1 rounded-full"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[0.75rem] text-on-surface-variant leading-relaxed">
                          {character.personality}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Anchors visuais */}
                  {va && Object.values(va).some(Boolean) && (
                    <div>
                      <SectionLabel>Anchors visuais</SectionLabel>
                      <div className="grid grid-cols-2 gap-2">
                        {(Object.entries(va) as [string, string | undefined][])
                          .filter(([, v]) => v)
                          .map(([key, val]) => (
                            <div key={key} className="bg-white/4 rounded-lg p-2.5 border border-white/5">
                              <p className="text-[0.5rem] text-on-surface-muted uppercase tracking-widest mb-1">
                                {key.replace(/_/g, ' ')}
                              </p>
                              <p className="text-[0.6875rem] text-on-surface leading-snug">{val}</p>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Image prompt */}
                  {(character.image_prompt_en ?? character.midjourney_anchor_prompt) && (
                    <div>
                      <SectionLabel>Image prompt</SectionLabel>
                      <PromptBlock
                        label=""
                        text={(character.image_prompt_en ?? character.midjourney_anchor_prompt)!}
                      />
                    </div>
                  )}

                  {/* Video prompt */}
                  {character.video_prompt_en && (
                    <div>
                      <SectionLabel>Video prompt (Veo 3)</SectionLabel>
                      <PromptBlock label="" text={character.video_prompt_en} />
                    </div>
                  )}

                  {/* Rationale */}
                  {(character.rationale ?? character.character_rationale) && (
                    <div>
                      <SectionLabel>Rationale</SectionLabel>
                      <p className="text-[0.75rem] text-on-surface-variant leading-relaxed italic">
                        {character.rationale ?? character.character_rationale}
                      </p>
                    </div>
                  )}

                  {/* Consistency notes */}
                  {consistencyNotes && (
                    <div>
                      <SectionLabel>Consistency notes</SectionLabel>
                      <p className="text-[0.6875rem] text-on-surface-variant leading-relaxed">
                        {consistencyNotes}
                      </p>
                    </div>
                  )}

                </div>
              </ScrollArea>
            </div>

          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

// ── CharacterBoardGallery ─────────────────────────────────────────────────────

function CharacterBoardGallery({
  asset,
  onImageClick,
}: {
  asset:        PersonaAsset
  onImageClick: (index: number) => void
}) {
  const board = asset.nano_banana_character_board
  if (!board?.drive_urls?.length) return null

  const statusColor =
    asset.status === 'ready'  ? 'bg-emerald-500/10 text-emerald-400' :
    asset.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                                'bg-amber-500/10 text-amber-400'

  return (
    <div className="bg-surface-container border border-white/5 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-white/5">
        <p className="text-[0.625rem] text-on-surface-muted uppercase tracking-widest">
          Character Board
        </p>
        <span className={`text-[0.625rem] px-1.5 py-0.5 rounded font-mono ${statusColor}`}>
          {asset.status}
        </span>
        {board.generated_at && (
          <span className="ml-auto text-[0.5625rem] text-on-surface-muted">
            {new Date(board.generated_at).toLocaleDateString('pt-BR')}
          </span>
        )}
      </div>

      <div className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {board.drive_urls.map((url, i) => (
            <button
              key={i}
              onClick={() => onImageClick(i)}
              className="group relative aspect-[3/4] overflow-hidden rounded-lg bg-surface-high block w-full cursor-pointer"
            >
              <DriveImage
                url={url}
                alt={`Character board ${i + 1}`}
                className="w-full h-full transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200 rounded-lg flex items-center justify-center">
                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[0.625rem] text-white font-medium bg-black/50 px-2 py-0.5 rounded">
                  Ver ficha
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── CharacterCard (lista abaixo da galeria) ───────────────────────────────────

function CharacterCard({ row }: { row: CharacterArtifact }) {
  const tag     = row.artifact_data.combination_tag ?? row.copy_combinations?.tag ?? '—'
  const entries = normalizeCharacters(row.artifact_data)

  return (
    <div className="bg-surface-container border border-white/5 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-white/5">
        <Users size={15} strokeWidth={1.5} className="text-accent-violet" />
        <span className="text-sm font-semibold text-on-surface font-mono">{tag}</span>
        <span className="ml-auto text-[0.625rem] text-on-surface-muted">
          {entries.length} personagem{entries.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="p-4 divide-y divide-white/5">
        {entries.map((entry, i) => (
          <div key={entry.character_id ?? i} className={i > 0 ? 'pt-6 mt-6' : ''}>
            <CharacterDetailPanel
              character={entry}
              consistencyNotes={i === entries.length - 1 ? row.artifact_data.consistency_notes : undefined}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

export function PersonagensTabSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-64 w-full rounded-xl bg-surface-highest" />
      <Skeleton className="h-48 w-full rounded-xl bg-surface-highest" />
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface PersonagensTabProps {
  sku: string
}

export function PersonagensTab({ sku }: PersonagensTabProps) {
  const { characters, personaAsset, characterArtifact, loading } = usePersonagens(sku)
  const [modal, setModal] = useState<ModalState | null>(null)

  if (loading) return <PersonagensTabSkeleton />

  const hasBoard      = !!personaAsset?.nano_banana_character_board?.drive_urls?.length
  const hasCharacters = characters.length > 0

  // Usa o artefato global (mesmo critério do setup-character-board.ts),
  // com fallback para o primeiro artefato por combination
  const primaryChar = characterArtifact
    ? normalizeCharacters(characterArtifact)[0]
    : getPrimaryCharacter(characters)

  if (!hasCharacters && !hasBoard) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-14 h-14 rounded-xl bg-surface-container border border-white/5 flex items-center justify-center">
          <Clapperboard size={22} strokeWidth={1.5} className="text-on-surface-muted" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-on-surface">Nenhum personagem gerado ainda</p>
          <p className="text-[0.6875rem] text-on-surface-variant max-w-xs">
            Gere os scripts na aba{' '}
            <span className="font-mono text-brand">Copy</span>{' '}
            para criar os personagens automaticamente.
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

  const openModal = (index: number) => {
    if (!personaAsset?.nano_banana_character_board?.drive_urls) return
    const char = primaryChar ?? normalizeCharacters(characters[0]?.artifact_data ?? {})[0]
    if (!char) return
    setModal({
      imageUrls:        personaAsset.nano_banana_character_board.drive_urls,
      activeIndex:      index,
      character:        char,
      consistencyNotes: (characterArtifact ?? characters[0]?.artifact_data)?.consistency_notes,
    })
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Users size={16} strokeWidth={1.5} className="text-accent-violet" />
          <h3 className="text-sm font-semibold text-on-surface">
            Personagens
            {hasCharacters && (
              <span className="text-on-surface-muted font-normal ml-1">({characters.length})</span>
            )}
          </h3>
        </div>

        {hasBoard && (
          <CharacterBoardGallery
            asset={personaAsset!}
            onImageClick={openModal}
          />
        )}

        {hasCharacters && (
          <div className="space-y-4">
            {characters.map(row => <CharacterCard key={row.id} row={row} />)}
          </div>
        )}
      </div>

      {modal && (
        <CharacterModal
          state={modal}
          onClose={() => setModal(null)}
          onNav={index => setModal(prev => prev ? { ...prev, activeIndex: index } : null)}
        />
      )}
    </>
  )
}
