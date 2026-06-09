'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

export interface LibraryFbAd {
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
  status:          'pending' | 'approved' | 'rejected'
  created_at:      string
  product_id:      string
  product_name:    string | null
  product_sku:     string | null
  niche_id:        string | null
  niche_name:      string | null
}

export type LibraryAdStatusFilter = 'all' | 'pending' | 'approved' | 'rejected'

export function useFbAdsLibrary() {
  const [ads,       setAds]       = useState<LibraryFbAd[]>([])
  const [total,     setTotal]     = useState(0)
  const [isLoading, setLoading]   = useState(true)
  const [niches,    setNiches]    = useState<{ id: string; name: string }[]>([])
  const [products,  setProducts]  = useState<{ id: string; name: string; sku: string; niche_id: string | null }[]>([])

  const [query,     setQuery]         = useState('')
  const [nicheId,   setNicheIdRaw]    = useState('')
  const [productId, setProductIdRaw]  = useState('')
  const [status,    setStatus]        = useState<LibraryAdStatusFilter>('all')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedQuery, setDebouncedQuery] = useState('')

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedQuery(query), 350)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  useEffect(() => {
    fetch('/api/anuncios-fb/filters')
      .then(r => r.json())
      .then(d => {
        setNiches(d.niches   ?? [])
        setProducts(d.products ?? [])
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ limit: '100', status })
    if (nicheId)        params.set('niche_id',   nicheId)
    if (productId)      params.set('product_id', productId)
    if (debouncedQuery) params.set('q', debouncedQuery)

    fetch(`/api/anuncios-fb/ads?${params}`)
      .then(r => r.json())
      .then(d => {
        setAds(d.ads   ?? [])
        setTotal(d.total ?? 0)
      })
      .catch(() => toast.error('Erro ao carregar anúncios do Facebook'))
      .finally(() => setLoading(false))
  }, [nicheId, productId, status, debouncedQuery])

  const setNicheId   = useCallback((id: string) => { setNicheIdRaw(id); setProductIdRaw('') }, [])
  const setProductId = useCallback((id: string) => setProductIdRaw(id), [])

  const updateStatus = useCallback(async (id: string, newStatus: 'approved' | 'rejected' | 'pending') => {
    setAds(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a))
    try {
      const res = await fetch('/api/anuncios-fb/ads', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id, status: newStatus }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erro desconhecido')
    } catch (err) {
      setAds(prev => prev.map(a => a.id === id ? { ...a, status: a.status } : a))
      toast.error((err as Error).message)
    }
  }, [])

  const approve = useCallback((id: string) => updateStatus(id, 'approved'), [updateStatus])
  const reject  = useCallback((id: string) => updateStatus(id, 'rejected'), [updateStatus])
  const reset   = useCallback((id: string) => updateStatus(id, 'pending'),  [updateStatus])

  const filteredProducts = nicheId ? products.filter(p => p.niche_id === nicheId) : products

  const counts = {
    all:      ads.length,
    pending:  ads.filter(a => a.status === 'pending').length,
    approved: ads.filter(a => a.status === 'approved').length,
    rejected: ads.filter(a => a.status === 'rejected').length,
  }

  return {
    ads, total, isLoading,
    niches, products: filteredProducts,
    query,     setQuery,
    nicheId,   setNicheId,
    productId, setProductId,
    status,    setStatus,
    counts,
    approve, reject, reset,
  }
}
