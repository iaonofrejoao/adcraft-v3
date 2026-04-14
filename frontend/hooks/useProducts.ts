'use client'
import { useCallback, useEffect, useState } from 'react'

export interface Product {
  id: string
  name: string
  sku: string
  platform: string
  target_language: string
  ticket_price: string | null
  commission_percent: string | null
  created_at: string
  niche?: { name: string } | null
}

export interface UseProductsReturn {
  products: Product[]
  isLoading: boolean
  isModalOpen: boolean
  openModal: () => void
  closeModal: () => void
  refetch: () => Promise<void>
}

export function useProducts(): UseProductsReturn {
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/products')
      const data = await res.json()
      setProducts(data.products ?? data ?? [])
    } catch (err) {
      console.error('[useProducts] fetch failed', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  const openModal = useCallback(() => setIsModalOpen(true), [])
  const closeModal = useCallback(() => setIsModalOpen(false), [])

  return {
    products,
    isLoading,
    isModalOpen,
    openModal,
    closeModal,
    refetch: fetchProducts,
  }
}
