'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ProductDetailHeader,
  ProductDetailLoading,
} from '@/components/detalhes-produto'
import type { Product, Pipeline } from '@/components/detalhes-produto'
import {
  CriativosTab,
  CriativosTabSkeleton,
} from '@/components/produto-tabs/CriativosTab'

export default function CriativosPage() {
  const { sku } = useParams<{ sku: string }>()
  const [product,   setProduct]   = useState<Product | null>(null)
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    if (!sku) return
    Promise.all([
      fetch(`/api/products/${sku}`).then((r) => r.json()),
      fetch(`/api/pipelines?sku=${sku}&limit=50`)
        .then((r) => r.json())
        .catch(() => ({ pipelines: [] })),
    ]).then(([prod, pipes]) => {
      setProduct(prod.product ?? prod)
      setPipelines(pipes.pipelines ?? pipes ?? [])
    }).finally(() => setLoading(false))
  }, [sku])

  if (loading) return <ProductDetailLoading />

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 bg-surface">
        <p className="text-sm text-on-surface-variant">Produto não encontrado: {sku}</p>
        <Link href="/products" className="text-sm text-brand hover:underline">← Voltar</Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-surface overflow-y-auto">
      <ProductDetailHeader product={product} sku={sku!} />

      <section className="flex-1 px-8 py-6 pb-10 max-w-4xl w-full">
        <CriativosTab pipelines={pipelines} sku={sku!} />
      </section>
    </div>
  )
}
