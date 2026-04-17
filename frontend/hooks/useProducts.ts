'use client'
import { useCallback, useEffect, useState } from 'react'

export interface Product {
  id: string
  name: string
  sku: string
  platform: string
  status: string
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
  showInactive: boolean
  setShowInactive: (v: boolean) => void
  openModal: () => void
  closeModal: () => void
  refetch: () => Promise<void>
}

export function useProducts(): UseProductsReturn {
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [showInactive, setShowInactive] = useState(false)

  const fetchProducts = useCallback(async () => {
    try {
      const url = showInactive ? '/api/products?show_inactive=true' : '/api/products'
      const res = await fetch(url)
      const data = await res.json()
      const list = data?.products
      setProducts(Array.isArray(list) ? list : [])
    } catch (err) {
      console.error('[useProducts] fetch failed', err)
      setProducts([])
    } finally {
      setIsLoading(false)
    }
  }, [showInactive])

  useEffect(() => {
    setIsLoading(true)
    fetchProducts()
  }, [fetchProducts])

  const openModal  = useCallback(() => setIsModalOpen(true), [])
  const closeModal = useCallback(() => setIsModalOpen(false), [])

  return {
    products,
    isLoading,
    isModalOpen,
    showInactive,
    setShowInactive,
    openModal,
    closeModal,
    refetch: fetchProducts,
  }
}
