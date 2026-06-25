'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Learning {
  id:                string
  category:          string
  observation:       string
  confidence:        number
  evidence:          Record<string, unknown> | null
  product_id:        string | null
  niche_id:          string | null
  tags:              string[]
  validated_by_user: boolean | null
  created_at:        string
}

export interface Pattern {
  id:                      string
  pattern_text:            string
  category:                string | null
  niche_id:                string | null
  supporting_learning_ids: string[] | null
  supporting_count:        number
  confidence:              number
  tags:                    string[]
  status:                  string
  created_at:              string
  updated_at:              string
}

export interface Insight {
  id:                string
  title:             string
  body:              string
  importance:        number
  source:            string
  tags:              string[]
  validated_by_user: boolean
  created_at:        string
}

export interface ProductRef {
  id:       string
  name:     string
  niche_id: string | null
}

export interface NicheRef {
  id:   string
  name: string
  slug: string
}

export interface UseInsightsReturn {
  learnings:     Learning[]
  patterns:      Pattern[]
  insights:      Insight[]
  products:      ProductRef[]
  niches:        NicheRef[]
  isLoading:     boolean
  categoryFilter: string | null
  setCategoryFilter: (c: string | null) => void
  searchQuery:    string
  setSearchQuery: (q: string) => void
  validateLearning:   (id: string, valid: boolean) => Promise<void>
  validateInsight:    (id: string, valid: boolean) => Promise<void>
  reload:             () => void
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useInsights(): UseInsightsReturn {
  const [learnings,      setLearnings]      = useState<Learning[]>([])
  const [patterns,       setPatterns]       = useState<Pattern[]>([])
  const [insightsList,   setInsightsList]   = useState<Insight[]>([])
  const [products,       setProducts]       = useState<ProductRef[]>([])
  const [niches,         setNiches]         = useState<NicheRef[]>([])
  const [isLoading,      setIsLoading]      = useState(true)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [searchQuery,    setSearchQuery]    = useState('')

  const supabase = createClient()

  const fetchAll = useCallback(async () => {
    setIsLoading(true)
    try {
      // ── Round 1: learnings, patterns, insights em paralelo ────────────
      let learningsQ = supabase
        .from('execution_learnings')
        .select('id, category, observation, confidence, evidence, product_id, niche_id, tags, validated_by_user, created_at')
        .eq('status', 'active')
        .or('validated_by_user.is.null,validated_by_user.eq.true')
        .gte('confidence', '0.4')
        .order('confidence', { ascending: false })
        .limit(50)

      if (categoryFilter) learningsQ = learningsQ.eq('category', categoryFilter)
      if (searchQuery.trim()) {
        learningsQ = learningsQ.textSearch('observation', searchQuery.trim(), {
          type: 'websearch', config: 'portuguese',
        })
      }

      let patternsQ = supabase
        .from('learning_patterns')
        .select('id, pattern_text, category, niche_id, supporting_learning_ids, supporting_count, confidence, tags, status, created_at, updated_at')
        .eq('status', 'active')
        .order('confidence', { ascending: false })
        .limit(20)

      if (categoryFilter) patternsQ = patternsQ.eq('category', categoryFilter)

      const insightsQ = supabase
        .from('insights')
        .select('id, title, body, importance, source, tags, validated_by_user, created_at')
        .order('importance', { ascending: false })
        .order('created_at',  { ascending: false })
        .limit(10)

      const [
        { data: lData, error: lErr },
        { data: pData, error: pErr },
        { data: iData, error: iErr },
      ] = await Promise.all([learningsQ, patternsQ, insightsQ])

      if (lErr) console.error('[useInsights] learnings error:', lErr)
      if (pErr) console.error('[useInsights] patterns error:',  pErr)
      if (iErr) console.error('[useInsights] insights error:',  iErr)

      const parsedLearnings = ((lData ?? []) as Record<string, unknown>[]).map(l => ({
        ...l,
        confidence: parseFloat(l.confidence as string),
        tags: Array.isArray(l.tags) ? l.tags : [],
      })) as Learning[]

      const parsedPatterns = ((pData ?? []) as Record<string, unknown>[]).map(p => ({
        ...p,
        confidence: parseFloat(p.confidence as string),
        tags: Array.isArray(p.tags) ? p.tags : [],
      })) as Pattern[]

      setLearnings(parsedLearnings)
      setPatterns(parsedPatterns)
      setInsightsList(((iData ?? []) as Record<string, unknown>[]).map(i => ({
        ...i,
        tags: Array.isArray(i.tags) ? i.tags : [],
      })) as Insight[])

      // ── Round 2: produtos e nichos referenciados nos dados ────────────
      const productIds = [...new Set(
        parsedLearnings.map(l => l.product_id).filter((id): id is string => !!id)
      )]
      const nicheIds = [...new Set([
        ...parsedLearnings.map(l => l.niche_id),
        ...parsedPatterns.map(p => p.niche_id),
      ].filter((id): id is string => !!id))]

      const [prodsResult, nichesResult] = await Promise.all([
        productIds.length > 0
          ? supabase.from('products').select('id, name, niche_id').in('id', productIds)
          : Promise.resolve({ data: [] as ProductRef[], error: null }),
        nicheIds.length > 0
          ? supabase.from('niches').select('id, name, slug').in('id', nicheIds)
          : Promise.resolve({ data: [] as NicheRef[], error: null }),
      ])

      setProducts((prodsResult.data ?? []) as ProductRef[])
      setNiches((nichesResult.data ?? []) as NicheRef[])
    } finally {
      setIsLoading(false)
    }
  }, [categoryFilter, searchQuery])

  useEffect(() => { fetchAll() }, [fetchAll])

  const validateLearning = useCallback(async (id: string, valid: boolean) => {
    await supabase.from('execution_learnings').update({ validated_by_user: valid }).eq('id', id)
    fetchAll()
  }, [fetchAll])

  const validateInsight = useCallback(async (id: string, valid: boolean) => {
    await supabase.from('insights').update({ validated_by_user: valid }).eq('id', id)
    fetchAll()
  }, [fetchAll])

  return {
    learnings,
    patterns,
    insights:         insightsList,
    products,
    niches,
    isLoading,
    categoryFilter,
    setCategoryFilter,
    searchQuery,
    setSearchQuery,
    validateLearning,
    validateInsight,
    reload:           fetchAll,
  }
}
