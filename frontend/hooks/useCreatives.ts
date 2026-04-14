'use client'
import { useEffect, useState } from 'react'

export interface Asset {
  id:          string
  tag:         string
  asset_type:  string
  url:         string
  file_size?:  number
  duration_s?: number
  created_at:  string
  product?:    { name: string; sku: string }
}

export interface UseCreativesReturn {
  assets:    Asset[]
  isLoading: boolean
}

export function useCreatives(): UseCreativesReturn {
  const [assets,    setAssets]    = useState<Asset[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/assets?limit=50')
      .then((r) => r.json())
      .then((d) => setAssets(d.assets ?? d ?? []))
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  return { assets, isLoading }
}
