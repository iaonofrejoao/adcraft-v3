'use client'
import { useState, useCallback } from 'react'

export interface AdLibraryAd {
  id: string
  ad_creation_time: string
  ad_delivery_start_time?: string
  ad_delivery_stop_time?: string
  ad_snapshot_url?: string
  currency?: string
  funding_entity?: string
  impressions?: { lower_bound: string; upper_bound: string }
  page_id?: string
  page_name?: string
  publisher_platforms?: string[]
  spend?: { lower_bound: string; upper_bound: string }
  media_type?: string
  ad_creative_bodies?: string[]
  ad_creative_link_titles?: string[]
  ad_creative_link_descriptions?: string[]
  bylines?: string[]
  languages?: string[]
}

export interface AdLibraryFilters {
  search_terms: string
  search_page_ids: string
  countries: string[]
  status: 'ALL' | 'ACTIVE' | 'INACTIVE'
  ad_type: 'ALL' | 'POLITICAL_AND_ISSUE_ADS' | 'HOUSING_ADS' | 'EMPLOYMENT_ADS' | 'CREDIT_ADS'
  media_type: 'ALL' | 'IMAGE' | 'MUTED_VIDEO' | 'VIDEO' | 'NONE'
  platforms: string[]
  languages: string[]
}

export const DEFAULT_FILTERS: AdLibraryFilters = {
  search_terms: '',
  search_page_ids: '',
  countries: ['BR'],
  status: 'ACTIVE',
  ad_type: 'ALL',
  media_type: 'ALL',
  platforms: [],
  languages: [],
}

function buildParams(filters: AdLibraryFilters, after?: string): string {
  const p = new URLSearchParams()
  if (filters.search_terms.trim())    p.set('search_terms', filters.search_terms.trim())
  if (filters.search_page_ids.trim()) p.set('search_page_ids', filters.search_page_ids.trim())
  p.set('countries', filters.countries.join(','))
  p.set('status', filters.status)
  p.set('ad_type', filters.ad_type)
  p.set('media_type', filters.media_type)
  if (filters.platforms.length) p.set('platforms', filters.platforms.join(','))
  if (filters.languages.length) p.set('languages', filters.languages.join(','))
  if (after) p.set('after', after)
  return p.toString()
}

export function useAdLibrary() {
  const [ads, setAds]           = useState<AdLibraryAd[]>([])
  const [isLoading, setLoading] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [cursor, setCursor]     = useState<string | null>(null)
  const [hasMore, setHasMore]   = useState(false)
  const [active, setActive]     = useState<AdLibraryFilters | null>(null)

  const search = useCallback(async (filters: AdLibraryFilters) => {
    setLoading(true)
    setError(null)
    setActive(filters)
    try {
      const res  = await fetch(`/api/ad-library?${buildParams(filters)}`)
      const data = await res.json()
      if (data.error) {
        let msg = data.error
        if (data.code === 10 && data.error_subcode === 2332002) {
          msg = 'O App do Facebook não tem permissão para a Ad Library API. Acesse developers.facebook.com e habilite "Ad Library API" ou gere um novo token com escopo ads_read no Graph API Explorer.'
        } else if (data.code === 190) {
          msg = 'Token do Facebook expirado ou inválido. Gere um novo token no Graph API Explorer.'
        } else {
          const detail = data.code ? ` (código ${data.code}${data.error_subcode ? '/' + data.error_subcode : ''})` : ''
          msg = data.error + detail
        }
        setError(msg)
        setAds([])
        setHasMore(false)
        return
      }
      setAds(data.data ?? [])
      setCursor(data.paging?.cursors?.after ?? null)
      setHasMore(Boolean(data.paging?.next))
    } catch {
      setError('Erro ao carregar anúncios')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadMore = useCallback(async () => {
    if (!active || !cursor || isLoading) return
    setLoading(true)
    try {
      const res  = await fetch(`/api/ad-library?${buildParams(active, cursor)}`)
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setAds(prev => [...prev, ...(data.data ?? [])])
      setCursor(data.paging?.cursors?.after ?? null)
      setHasMore(Boolean(data.paging?.next))
    } catch {
      setError('Erro ao carregar mais anúncios')
    } finally {
      setLoading(false)
    }
  }, [active, cursor, isLoading])

  return { ads, isLoading, error, hasMore, count: ads.length, search, loadMore }
}
