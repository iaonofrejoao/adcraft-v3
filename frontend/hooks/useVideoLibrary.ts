'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LibraryVideo {
  id:               string
  tiktok_url:       string
  tiktok_video_id:  string | null
  video_url:        string | null
  author_handle:    string | null
  description:      string | null
  views_count:      number | null
  likes_count:      number | null
  relevance_score:  number | null
  status:           'pending' | 'approved' | 'rejected'
  thumbnail_url:    string | null
  duration_seconds: number | null
  created_at:       string
  product_id:       string
  product_name:     string | null
  product_sku:      string | null
  niche_id:         string | null
  niche_name:       string | null
}

export interface LibraryNiche   { id: string; name: string }
export interface LibraryProduct { id: string; name: string; sku: string; niche_id: string | null }

export type LibraryStatusFilter = 'all' | 'pending' | 'approved' | 'rejected'

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useVideoLibrary() {
  const [videos,   setVideos]   = useState<LibraryVideo[]>([])
  const [total,    setTotal]    = useState(0)
  const [isLoading, setLoading] = useState(true)
  const [niches,   setNiches]   = useState<LibraryNiche[]>([])
  const [products, setProducts] = useState<LibraryProduct[]>([])

  // Filtros
  const [query,     setQuery]     = useState('')
  const [nicheId,   setNicheIdRaw]   = useState('')
  const [productId, setProductIdRaw] = useState('')
  const [status,    setStatus]    = useState<LibraryStatusFilter>('all')

  // Debounce do texto de busca
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedQuery, setDebouncedQuery] = useState('')

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedQuery(query), 350)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  // Fetch opções de filtro no mount
  useEffect(() => {
    fetch('/api/biblioteca/filters')
      .then(r => r.json())
      .then(d => {
        setNiches(d.niches   ?? [])
        setProducts(d.products ?? [])
      })
      .catch(() => {})
  }, [])

  // Fetch vídeos quando filtros mudam
  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ limit: '100', status })
    if (nicheId)        params.set('niche_id',   nicheId)
    if (productId)      params.set('product_id', productId)
    if (debouncedQuery) params.set('q', debouncedQuery)

    fetch(`/api/biblioteca/tiktok-videos?${params}`)
      .then(r => r.json())
      .then(d => {
        setVideos(d.videos ?? [])
        setTotal(d.total  ?? 0)
      })
      .catch(() => toast.error('Erro ao carregar biblioteca de vídeos'))
      .finally(() => setLoading(false))
  }, [nicheId, productId, status, debouncedQuery])

  // Ao mudar nicho, limpa produto (pode não existir no nicho novo)
  const setNicheId = useCallback((id: string) => {
    setNicheIdRaw(id)
    setProductIdRaw('')
  }, [])

  const setProductId = useCallback((id: string) => {
    setProductIdRaw(id)
  }, [])

  // Atualiza status com optimistic UI
  const updateStatus = useCallback(async (
    id: string,
    newStatus: 'approved' | 'rejected' | 'pending',
  ) => {
    setVideos(prev =>
      prev.map(v => v.id === id ? { ...v, status: newStatus } : v)
    )
    try {
      const res = await fetch('/api/biblioteca/tiktok-videos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erro desconhecido')
    } catch (err) {
      // Reverte
      setVideos(prev =>
        prev.map(v => v.id === id ? { ...v, status: v.status } : v)
      )
      toast.error((err as Error).message)
    }
  }, [])

  const approve = useCallback((id: string) => updateStatus(id, 'approved'), [updateStatus])
  const reject  = useCallback((id: string) => updateStatus(id, 'rejected'), [updateStatus])
  const reset   = useCallback((id: string) => updateStatus(id, 'pending'),  [updateStatus])

  // Produtos filtrados pelo nicho selecionado
  const filteredProducts = nicheId
    ? products.filter(p => p.niche_id === nicheId)
    : products

  const counts = {
    all:      videos.length,
    pending:  videos.filter(v => v.status === 'pending').length,
    approved: videos.filter(v => v.status === 'approved').length,
    rejected: videos.filter(v => v.status === 'rejected').length,
  }

  return {
    videos, total, isLoading,
    niches, products: filteredProducts,
    query,     setQuery,
    nicheId,   setNicheId,
    productId, setProductId,
    status,    setStatus,
    counts,
    approve, reject, reset,
  }
}
