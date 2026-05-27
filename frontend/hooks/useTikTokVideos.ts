'use client'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TikTokVideo {
  id:               string
  tiktok_url:       string
  tiktok_video_id:  string | null
  author_handle:    string | null
  description:      string | null
  views_count:      number | null
  likes_count:      number | null
  relevance_score:  number | null
  status:           'pending' | 'approved' | 'rejected'
  local_path:       string | null
  thumbnail_url:    string | null
  duration_seconds: number | null
  created_at:       string
  reviewed_at:      string | null
}

export type TikTokStatusFilter = 'all' | 'pending' | 'approved' | 'rejected'

export interface UseTikTokVideosReturn {
  videos:     TikTokVideo[]
  isLoading:  boolean
  filter:     TikTokStatusFilter
  setFilter:  (f: TikTokStatusFilter) => void
  approve:    (id: string) => Promise<void>
  reject:     (id: string) => Promise<void>
  reset:      (id: string) => Promise<void>
  refresh:    () => void
  counts: {
    all:      number
    pending:  number
    approved: number
    rejected: number
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTikTokVideos(sku: string): UseTikTokVideosReturn {
  const [allVideos, setAllVideos] = useState<TikTokVideo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter]       = useState<TikTokStatusFilter>('all')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!sku) return
    setIsLoading(true)
    fetch(`/api/products/${sku}/tiktok-videos?status=all&limit=100`)
      .then(r => r.json())
      .then(d => setAllVideos(d.videos ?? []))
      .catch(() => toast.error('Erro ao carregar vídeos TikTok'))
      .finally(() => setIsLoading(false))
  }, [sku, refreshKey])

  const refresh = useCallback(() => setRefreshKey(k => k + 1), [])

  const updateStatus = useCallback(async (
    id: string,
    status: 'approved' | 'rejected' | 'pending',
    label: string
  ) => {
    // Optimistic update
    setAllVideos(prev =>
      prev.map(v => v.id === id ? { ...v, status, reviewed_at: new Date().toISOString() } : v)
    )
    try {
      const res = await fetch(`/api/products/${sku}/tiktok-videos`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erro desconhecido')
      toast.success(label)
    } catch (err) {
      // Revert on failure
      setAllVideos(prev =>
        prev.map(v => v.id === id ? { ...v, status: v.status } : v)
      )
      toast.error((err as Error).message)
    }
  }, [sku])

  const approve = useCallback((id: string) => updateStatus(id, 'approved', 'Vídeo aprovado'), [updateStatus])
  const reject  = useCallback((id: string) => updateStatus(id, 'rejected', 'Vídeo rejeitado'), [updateStatus])
  const reset   = useCallback((id: string) => updateStatus(id, 'pending',  'Status resetado'),  [updateStatus])

  const videos = filter === 'all'
    ? allVideos
    : allVideos.filter(v => v.status === filter)

  const counts = {
    all:      allVideos.length,
    pending:  allVideos.filter(v => v.status === 'pending').length,
    approved: allVideos.filter(v => v.status === 'approved').length,
    rejected: allVideos.filter(v => v.status === 'rejected').length,
  }

  return { videos, isLoading, filter, setFilter, approve, reject, reset, refresh, counts }
}
