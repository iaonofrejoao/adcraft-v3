'use client'
import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'

export type FbAdStatus = 'pending' | 'approved' | 'rejected'
export type FbAdStatusFilter = FbAdStatus | 'all'

export interface FbAd {
  id:              string
  fb_ad_id:        string
  page_name:       string | null
  page_id:         string | null
  ad_copy:         string | null
  headline:        string | null
  cta_text:        string | null
  destination_url: string | null
  media_type:      'video' | 'image' | 'carousel' | 'unknown'
  video_url:       string | null
  image_url:       string | null
  platforms:       string[]
  started_at:      string | null
  stopped_at:      string | null
  days_running:    number | null
  relevance_score: number | null
  status:          FbAdStatus
  created_at:      string
  reviewed_at:     string | null
}

type Counts = Record<FbAdStatusFilter, number>

interface UseFacebookAdsReturn {
  ads:       FbAd[]
  isLoading: boolean
  filter:    FbAdStatusFilter
  setFilter: (f: FbAdStatusFilter) => void
  approve:   (id: string) => void
  reject:    (id: string) => void
  reset:     (id: string) => void
  refresh:   () => void
  counts:    Counts
}

async function patchAd(sku: string, id: string, status: FbAdStatus) {
  const res = await fetch(`/api/products/${sku}/facebook-ads`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ id, status }),
  })
  if (!res.ok) {
    const d = await res.json().catch(() => ({}))
    throw new Error(d.error ?? 'Falha ao atualizar status')
  }
}

export function useFacebookAds(sku: string): UseFacebookAdsReturn {
  const [allAds,    setAllAds]    = useState<FbAd[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter,    setFilter]    = useState<FbAdStatusFilter>('all')
  const [tick,      setTick]      = useState(0)

  const refresh = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    if (!sku) return
    setIsLoading(true)
    fetch(`/api/products/${sku}/facebook-ads?status=all&limit=100`)
      .then(r => r.json())
      .then(d => setAllAds(d.ads ?? []))
      .catch(() => setAllAds([]))
      .finally(() => setIsLoading(false))
  }, [sku, tick])

  const counts: Counts = {
    all:      allAds.length,
    pending:  allAds.filter(a => a.status === 'pending').length,
    approved: allAds.filter(a => a.status === 'approved').length,
    rejected: allAds.filter(a => a.status === 'rejected').length,
  }

  const ads = filter === 'all' ? allAds : allAds.filter(a => a.status === filter)

  function optimisticUpdate(id: string, status: FbAdStatus) {
    setAllAds(prev => prev.map(a =>
      a.id === id ? { ...a, status, reviewed_at: new Date().toISOString() } : a
    ))
  }

  async function changeStatus(id: string, status: FbAdStatus, label: string) {
    optimisticUpdate(id, status)
    try {
      await patchAd(sku, id, status)
      toast.success(label)
    } catch (err: any) {
      toast.error(err.message ?? 'Erro ao atualizar')
      refresh()
    }
  }

  return {
    ads,
    isLoading,
    filter,
    setFilter,
    approve: (id) => changeStatus(id, 'approved', 'Anúncio aprovado'),
    reject:  (id) => changeStatus(id, 'rejected', 'Anúncio rejeitado'),
    reset:   (id) => changeStatus(id, 'pending',  'Anúncio restaurado'),
    refresh,
    counts,
  }
}
