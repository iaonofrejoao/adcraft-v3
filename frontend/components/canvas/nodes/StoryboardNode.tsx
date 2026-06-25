'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { type NodeProps } from '@xyflow/react'
import { BookOpen, ChevronDown, ChevronRight, Film, Mic, Video as VideoIcon, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CanvasNode, StoryboardScene } from '@/hooks/useCanvas'

interface StoryboardNodeData {
  node:           CanvasNode
  onUpdateConfig: (nodeId: string, config: Record<string, unknown>) => void
  onUpdatePrompt: (nodeId: string, prompt: string) => void
}

const SECTION_LABELS: Record<string, string> = {
  hook:       'Hook',
  problem:    'Problema',
  agitation:  'Agitação',
  mechanism:  'Mecanismo',
  proof:      'Prova',
  offer:      'Oferta',
  cta:        'CTA',
}

const CHAR_COLORS: Record<string, string> = {
  A: '#F28705',
  B: '#22C55E',
}

function extractNarrationFromPrompt(prompt: string): string {
  const m = prompt.match(/Speaking[^:]*:\s*"([\s\S]+?)"/)
  return m?.[1]?.trim() ?? ''
}

export function StoryboardNode({ data, selected }: NodeProps & { data: StoryboardNodeData }) {
  const { node } = data
  const scenes: StoryboardScene[] = (node.config.scenes as StoryboardScene[] | undefined) ?? []

  const [expandedIdx,   setExpandedIdx]   = useState<number | null>(0)
  const [savedIndicator, setSavedIndicator] = useState(false)
  const saveTimerRef    = useRef<ReturnType<typeof setTimeout>>()
  const indicatorTimer  = useRef<ReturnType<typeof setTimeout>>()

  // Debounce 800ms: salva e mostra "✓ Salvo"
  const scheduleSave = useCallback((fn: () => void) => {
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      fn()
      setSavedIndicator(true)
      clearTimeout(indicatorTimer.current)
      indicatorTimer.current = setTimeout(() => setSavedIndicator(false), 1500)
    }, 800)
  }, [])

  useEffect(() => () => {
    clearTimeout(saveTimerRef.current)
    clearTimeout(indicatorTimer.current)
  }, [])

  function buildDrafts(ss: StoryboardScene[]) {
    const fd: Record<number, string> = {}
    const vd: Record<number, string> = {}
    const nd: Record<number, string> = {}
    ss.forEach((s, i) => {
      fd[i] = s.frame_prompt ?? ''
      vd[i] = s.video_prompt ?? ''
      // Se narration vazia no banco, extrai do video_prompt como fallback
      nd[i] = s.narration || extractNarrationFromPrompt(s.video_prompt ?? '')
    })
    return { fd, vd, nd }
  }

  const [frameDrafts,     setFrameDrafts]     = useState<Record<number, string>>(() => buildDrafts(scenes).fd)
  const [videoDrafts,     setVideoDrafts]     = useState<Record<number, string>>(() => buildDrafts(scenes).vd)
  const [narrationDrafts, setNarrationDrafts] = useState<Record<number, string>>(() => buildDrafts(scenes).nd)

  // Re-sincroniza sempre que o conteúdo das cenas mudar
  useEffect(() => {
    const { fd, vd, nd } = buildDrafts(scenes)
    setFrameDrafts(fd)
    setVideoDrafts(vd)
    setNarrationDrafts(nd)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id, scenes.length, node.config])

  const saveNarration = useCallback((idx: number, value: string) => {
    const original = scenes[idx]?.narration ?? ''
    if (value === original) return
    const updatedScenes = scenes.map((s, i) => i === idx ? { ...s, narration: value } : s)
    data.onUpdateConfig(node.id, { scenes: updatedScenes })
  }, [data, node.id, scenes])

  const saveFramePrompt = useCallback((idx: number, value: string) => {
    const original = scenes[idx]?.frame_prompt ?? ''
    if (value === original) return
    const updatedScenes = scenes.map((s, i) => i === idx ? { ...s, frame_prompt: value } : s)
    data.onUpdateConfig(node.id, { scenes: updatedScenes })
    if (scenes[idx]?.frame_node_id) {
      data.onUpdatePrompt(scenes[idx].frame_node_id!, value)
    }
  }, [data, node.id, scenes])

  const saveVideoPrompt = useCallback((idx: number, value: string) => {
    const original = scenes[idx]?.video_prompt ?? ''
    if (value === original) return
    const updatedScenes = scenes.map((s, i) => i === idx ? { ...s, video_prompt: value } : s)
    data.onUpdateConfig(node.id, { scenes: updatedScenes })
    if (scenes[idx]?.video_node_id) {
      data.onUpdatePrompt(scenes[idx].video_node_id!, value)
    }
  }, [data, node.id, scenes])

  return (
    <div className={cn(
      'w-80 rounded-xl border bg-surface-container text-on-surface flex flex-col',
      'transition-all duration-150 shadow-lg',
      selected ? 'border-brand/60 shadow-[0_0_0_2px_var(--color-brand)]' : 'border-white/10',
    )}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/5 shrink-0">
        <BookOpen size={13} strokeWidth={1.5} className="text-on-surface-muted shrink-0" />
        <span className="text-[0.6875rem] font-semibold uppercase tracking-widest text-on-surface-variant flex-1">
          Storyboard
        </span>
        {savedIndicator && (
          <span className="flex items-center gap-1 text-[0.5rem] text-status-done-text animate-pulse">
            <CheckCircle2 size={9} strokeWidth={2} />
            Salvo
          </span>
        )}
        <span className="text-[0.5625rem] font-mono px-1.5 py-0.5 rounded bg-surface-high text-on-surface-muted">
          {scenes.length} cenas
        </span>
      </div>

      {/* Scene list */}
      <div className="overflow-y-auto max-h-[560px] scrollbar-none">
        {scenes.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-[0.6rem] text-on-surface-muted">Nenhuma cena no storyboard</p>
          </div>
        ) : (
          scenes.map((scene, idx) => {
            const isOpen     = expandedIdx === idx
            const charColor  = CHAR_COLORS[scene.character_id] ?? '#F28705'

            return (
              <div key={idx} className="border-b border-white/5 last:border-b-0">
                {/* Scene header */}
                <button
                  onClick={() => setExpandedIdx(isOpen ? null : idx)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface-high/40 transition-colors text-left"
                >
                  {isOpen
                    ? <ChevronDown size={11} strokeWidth={1.5} className="text-on-surface-muted shrink-0" />
                    : <ChevronRight size={11} strokeWidth={1.5} className="text-on-surface-muted shrink-0" />
                  }
                  <span className="text-[0.5625rem] font-mono text-on-surface-muted shrink-0">
                    #{scene.scene_number}
                  </span>
                  <span className="text-[0.5625rem] text-on-surface-variant flex-1 truncate">
                    {SECTION_LABELS[scene.section] ?? scene.section}
                  </span>
                  <span
                    className="text-[0.5rem] px-1.5 py-0.5 rounded-full font-medium shrink-0"
                    style={{ background: charColor + '22', color: charColor }}
                  >
                    {scene.character_name}
                  </span>
                </button>

                {/* Expanded: prompts */}
                {isOpen && (
                  <div className="px-3 pb-3 space-y-2.5 bg-surface-high/20">
                    {/* Narração */}
                    <div className="space-y-1 pt-2">
                      <div className="flex items-center gap-1.5">
                        <Mic size={10} strokeWidth={1.5} className="text-on-surface-muted" />
                        <span className="text-[0.5rem] font-semibold uppercase tracking-widest text-on-surface-muted">
                          Narração
                        </span>
                      </div>
                      <textarea
                        value={narrationDrafts[idx] ?? ''}
                        onChange={e => {
                          const v = e.target.value
                          setNarrationDrafts(prev => ({ ...prev, [idx]: v }))
                          scheduleSave(() => saveNarration(idx, v))
                        }}
                        onBlur={e => saveNarration(idx, e.target.value)}
                        rows={3}
                        placeholder="Fala/diálogo da cena…"
                        className={cn(
                          'w-full resize-none rounded-lg px-2.5 py-2',
                          'bg-surface-container border border-white/5',
                          'text-[0.5625rem] text-on-surface italic placeholder:text-on-surface-muted leading-relaxed',
                          'focus:outline-none focus:border-brand/40 transition-colors',
                        )}
                      />
                    </div>

                    {/* Frame prompt */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 pt-2">
                        <Film size={10} strokeWidth={1.5} className="text-on-surface-muted" />
                        <span className="text-[0.5rem] font-semibold uppercase tracking-widest text-on-surface-muted">
                          Prompt do frame
                        </span>
                      </div>
                      <textarea
                        value={frameDrafts[idx] ?? ''}
                        onChange={e => {
                          const v = e.target.value
                          setFrameDrafts(prev => ({ ...prev, [idx]: v }))
                          scheduleSave(() => saveFramePrompt(idx, v))
                        }}
                        onBlur={e => saveFramePrompt(idx, e.target.value)}
                        rows={4}
                        placeholder="Prompt de imagem para o Nano Banana…"
                        className={cn(
                          'w-full resize-none rounded-lg px-2.5 py-2',
                          'bg-surface-container border border-white/5',
                          'text-[0.5625rem] text-on-surface placeholder:text-on-surface-muted leading-relaxed',
                          'focus:outline-none focus:border-brand/40 transition-colors',
                        )}
                      />
                    </div>

                    {/* Video prompt */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <VideoIcon size={10} strokeWidth={1.5} className="text-on-surface-muted" />
                        <span className="text-[0.5rem] font-semibold uppercase tracking-widest text-on-surface-muted">
                          Prompt do vídeo
                        </span>
                      </div>
                      <textarea
                        value={videoDrafts[idx] ?? ''}
                        onChange={e => {
                          const v = e.target.value
                          setVideoDrafts(prev => ({ ...prev, [idx]: v }))
                          scheduleSave(() => saveVideoPrompt(idx, v))
                        }}
                        onBlur={e => saveVideoPrompt(idx, e.target.value)}
                        rows={4}
                        placeholder="Prompt de vídeo para o Veo 3…"
                        className={cn(
                          'w-full resize-none rounded-lg px-2.5 py-2',
                          'bg-surface-container border border-white/5',
                          'text-[0.5625rem] text-on-surface placeholder:text-on-surface-muted leading-relaxed',
                          'focus:outline-none focus:border-brand/40 transition-colors',
                        )}
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
