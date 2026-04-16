'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Learning {
  id:               string
  category:         string
  observation:      string
  confidence:       number
  evidence:         Record<string, unknown> | null
  product_id:       string | null
  niche_id:         string | null
  validated_by_user: boolean | null
  created_at:       string
}

export interface Pattern {
  id:               string
  pattern_text:     string
  category:         string | null
  niche_id:         string | null
  supporting_count: number
  confidence:       number
  status:           string
  created_at:       string
  updated_at:       string
}

export interface Insight {
  id:                string
  title:             string
  body:              string
  importance:        number
  source:            string
  validated_by_user: boolean
  created_at:        string
}

export interface UseInsightsReturn {
  // Dados
  learnings:     Learning[]
  patterns:      Pattern[]
  insights:      Insight[]
  // Estado
  isLoading:     boolean
  // Filtros
  categoryFilter: string | null
  setCategoryFilter: (c: string | null) => void
  searchQuery:    string
  setSearchQuery: (q: string) => void
  // Ações
  validateLearning:   (id: string, valid: boolean) => Promise<void>
  validateInsight:    (id: string, valid: boolean) => Promise<void>
  reload:             () => void
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useInsights(): UseInsightsReturn {
  const [learnings,      setLearnings]      = useState<Learning[]>([])
  const [patterns,       setPatterns]       = useState<Pattern[]>([])
  const [insightsList,   setInsightsList]   = useState<Insight[]>([])
  const [isLoading,      setIsLoading]      = useState(true)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [searchQuery,    setSearchQuery]    = useState('')

  const supabase = createClient()

  const fetchAll = useCallback(async () => {
    setIsLoading(true)
    try {
      // Learnings (últimos 50, status active, confiança ≥ 0.4)
      let learningsQ = supabase
        .from('execution_learnings')
        .select('id, category, observation, confidence, evidence, product_id, niche_id, validated_by_user, created_at')
        .eq('status', 'active')
        .neq('validated_by_user', false)
        .gte('confidence', '0.4')
        .order('confidence', { ascending: false })
        .limit(50)

      if (categoryFilter) learningsQ = learningsQ.eq('category', categoryFilter)
      if (searchQuery.trim()) {
        learningsQ = learningsQ.textSearch('observation', searchQuery.trim(), {
          type: 'websearch',
          config: 'portuguese',
        })
      }

      // Patterns (top 20 por confiança)
      let patternsQ = supabase
        .from('learning_patterns')
        .select('id, pattern_text, category, niche_id, supporting_count, confidence, status, created_at, updated_at')
        .eq('status', 'active')
        .order('confidence', { ascending: false })
        .limit(20)

      if (categoryFilter) patternsQ = patternsQ.eq('category', categoryFilter)

      // Insights (top 10 por importância)
      const insightsQ = supabase
        .from('insights')
        .select('id, title, body, importance, source, validated_by_user, created_at')
        .order('importance', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(10)

      const [
        { data: lData, error: lErr },
        { data: pData, error: pErr },
        { data: iData, error: iErr },
      ] = await Promise.all([learningsQ, patternsQ, insightsQ])

      if (lErr) console.error('[useInsights] learnings error:', lErr)
      if (pErr) console.error('[useInsights] patterns error:', pErr)
      if (iErr) console.error('[useInsights] insights error:', iErr)

      setLearnings((lData ?? []).map((l: Record<string, unknown>) => ({
        ...l,
        confidence: parseFloat(l.confidence as string),
      })) as Learning[])

      setPatterns((pData ?? []).map((p: Record<string, unknown>) => ({
        ...p,
        confidence: parseFloat(p.confidence as string),
      })) as Pattern[])

      setInsightsList((iData ?? []) as Insight[])
    } finally {
      setIsLoading(false)
    }
  }, [categoryFilter, searchQuery])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const validateLearning = useCallback(async (id: string, valid: boolean) => {
    await supabase
      .from('execution_learnings')
      .update({ validated_by_user: valid })
      .eq('id', id)
    fetchAll()
  }, [fetchAll])

  const validateInsight = useCallback(async (id: string, valid: boolean) => {
    await supabase
      .from('insights')
      .update({ validated_by_user: valid })
      .eq('id', id)
    fetchAll()
  }, [fetchAll])

  return {
    learnings,
    patterns,
    insights:         insightsList,
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
