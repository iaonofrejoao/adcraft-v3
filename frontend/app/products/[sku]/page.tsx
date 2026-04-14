'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ProductDetailHeader,
  KnowledgeSection,
  StatsAndActivity,
  ProductDetailLoading,
} from '@/components/detalhes-produto'
import type { Product, Pipeline } from '@/components/detalhes-produto'

export default function ProductDetailPage() {
  const { sku } = useParams<{ sku: string }>()
  const [product,   setProduct]   = useState<Product | null>(null)
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    if (!sku) return
    Promise.all([
      fetch(`/api/products/${sku}`).then((r) => r.json()),
      fetch(`/api/pipelines?sku=${sku}&limit=10`).then((r) => r.json()).catch(() => ({ pipelines: [] })),
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
      <ProductDetailHeader product={product} sku={sku} />

      <section className="flex-1 p-6 pb-10">
        <div className="grid grid-cols-12 gap-6">
          <KnowledgeSection
            className="col-span-12 lg:col-span-7"
            pipelines={pipelines}
            sku={sku}
          />
          <StatsAndActivity
            className="col-span-12 lg:col-span-5"
            product={product}
            pipelines={pipelines}
          />
        </div>
      </section>
    </div>
  )
}
