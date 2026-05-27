'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

export type FinalVideoStatus =
  | 'queued'
  | 'generating_persona'
  | 'generating_scenes'
  | 'processing_ugc'
  | 'composing'
  | 'adding_captions'
  | 'ready'
  | 'failed'

export interface FinalVideo {
  id:                  string
  product_id:          string
  pipeline_id:         string | null
  copy_combination_id: string
  status:              FinalVideoStatus
  progress_step:       string | null
  video_url:           string | null
  thumbnail_url:       string | null
  duration_seconds:    number | null
  error_message:       string | null
  created_at:          string
  completed_at:        string | null
}

export interface UseFinalVideosReturn {
  videos:              FinalVideo[]
  isLoading:           boolean
  personaReady:        boolean
  productId:           string | null
  usedTikTokIds:       Set<string>
  queueVideo:          (copyCombinationId: string) => Promise<void>
  videosByCombination: Record<string, FinalVideo>
}

// ── Status helpers ────────────────────────────────────────────────────────────

const ACTIVE_STATUSES = new Set<FinalVideoStatus>([
  'generating_persona',
  'generating_scenes',
  'processing_ugc',
  'composing',
  'adding_captions',
])

export function isVideoActive(status: FinalVideoStatus): boolean {
  return ACTIVE_STATUSES.has(status)
}

export const STATUS_PROGRESS: Record<FinalVideoStatus, number> = {
  queued:              5,
  generating_persona:  15,
  generating_scenes:   45,
  processing_ugc:      60,
  composing:           75,
  adding_captions:     90,
  ready:               100,
  failed:              0,
}

export const STATUS_LABEL: Record<FinalVideoStatus, string> = {
  queued:              'Na fila',
  generating_persona:  'Gerando persona',
  generating_scenes:   'Gerando cenas',
  processing_ugc:      'Processando UGC',
  composing:           'Compondo vídeo',
  adding_captions:     'Adicionando legendas',
  ready:               'Pronto',
  failed:              'Falhou',
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useFinalVideos(sku: string, productId?: string): UseFinalVideosReturn {
  const [videos,        setVideos]        = useState<FinalVideo[]>([])
  const [isLoading,     setIsLoading]     = useState(true)
  const [personaReady,  setPersonaReady]  = useState(false)
  const [resolvedId,    setResolvedId]    = useState<string | null>(productId ?? null)
  const [usedTikTokIds, setUsedTikTokIds] = useState<Set<string>>(new Set())
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  // ── Carregamento inicial ──
  useEffect(() => {
    if (!sku) return
    setIsLoading(true)

    fetch(`/api/products/${sku}/final-videos`)
      .then(r => r.json())
      .then((d: { videos?: FinalVideo[]; persona_ready?: boolean; product_id?: string; used_tiktok_ids?: string[] }) => {
        setVideos(d.videos ?? [])
        setPersonaReady(d.persona_ready ?? false)
        setUsedTikTokIds(new Set(d.used_tiktok_ids ?? []))
        if (d.product_id) setResolvedId(d.product_id)
      })
      .catch(() => toast.error('Erro ao carregar criativos'))
      .finally(() => setIsLoading(false))
  }, [sku])

  // ── Supabase Realtime ──
  useEffect(() => {
    const pid = resolvedId
    if (!pid) return

    const supabase = createClient()

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    const channel = supabase
      .channel(`final_videos_${pid}`)
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'final_videos',
          filter: `product_id=eq.${pid}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const inserted = payload.new as FinalVideo
            setVideos(prev => {
              if (prev.some(v => v.id === inserted.id)) return prev
              return [inserted, ...prev]
            })
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as FinalVideo
            setVideos(prev =>
              prev.map(v => v.id === updated.id ? { ...v, ...updated } : v),
            )
            // Toast quando vídeo fica pronto
            if (updated.status === 'ready') {
              toast.success('Vídeo pronto!', { description: `${updated.copy_combination_id.slice(0, 8)}…` })
            }
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { id: string }
            setVideos(prev => prev.filter(v => v.id !== deleted.id))
          }
        },
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [resolvedId])

  // ── Enfileirar vídeo ──
  const queueVideo = useCallback(async (copyCombinationId: string) => {
    // Optimistic insert
    const tempId = `temp_${Date.now()}`
    const tempVideo: FinalVideo = {
      id:                  tempId,
      product_id:          resolvedId ?? '',
      pipeline_id:         null,
      copy_combination_id: copyCombinationId,
      status:              'queued',
      progress_step:       null,
      video_url:           null,
      thumbnail_url:       null,
      duration_seconds:    null,
      error_message:       null,
      created_at:          new Date().toISOString(),
      completed_at:        null,
    }
    setVideos(prev => [tempVideo, ...prev])

    try {
      const res = await fetch(`/api/products/${sku}/final-videos`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ copy_combination_id: copyCombinationId }),
      })
      const data = await res.json() as { video?: FinalVideo; error?: string; already_queued?: boolean }

      if (!res.ok) throw new Error(data.error ?? `Erro ${res.status}`)

      // Substituir temporário pelo real
      setVideos(prev =>
        prev.map(v => v.id === tempId ? (data.video ?? v) : v)
          .filter((v, i, arr) => arr.findIndex(x => x.id === v.id) === i),
      )

      if (data.already_queued) {
        toast.info('Já existe um vídeo em processamento para esta combinação')
      } else {
        toast.success('Vídeo enfileirado', {
          description: 'Execute process-video-queue.ts para iniciar a geração',
        })
      }
    } catch (err) {
      // Reverter temporário em caso de erro
      setVideos(prev => prev.filter(v => v.id !== tempId))
      toast.error('Erro ao enfileirar vídeo', { description: (err as Error).message })
    }
  }, [sku, resolvedId])

  const videosByCombination = videos.reduce<Record<string, FinalVideo>>((acc, v) => {
    // Por combinação: mostrar o mais recente não-failed primeiro, ou failed se não houver outro
    const existing = acc[v.copy_combination_id]
    if (!existing || (existing.status === 'failed' && v.status !== 'failed')) {
      acc[v.copy_combination_id] = v
    }
    return acc
  }, {})

  return {
    videos,
    isLoading,
    personaReady,
    productId: resolvedId,
    usedTikTokIds,
    queueVideo,
    videosByCombination,
  }
}
