'use client'
import { useEffect, useState } from 'react'

export interface KnowledgeArtifact {
  id: string
  artifact_type: string
  artifact_data: Record<string, unknown>
  status: string
  source_pipeline_id: string | null
  created_at: string
}

export function useProductKnowledge(sku: string, type: string) {
  const [data,      setData]      = useState<KnowledgeArtifact | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  useEffect(() => {
    if (!sku || !type) return
    setIsLoading(true)
    setError(null)
    fetch(`/api/products/${sku}/knowledge?type=${type}`)
      .then((r) => r.json())
      .then((res) => {
        const items: KnowledgeArtifact[] = res.knowledge ?? []
        setData(items[0] ?? null)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setIsLoading(false))
  }, [sku, type])

  return { data, isLoading, error }
}
