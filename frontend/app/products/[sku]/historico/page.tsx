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
  HistoricoTab,
  HistoricoTabSkeleton,
} from '@/components/produto-tabs/HistoricoTab'
import { ScrollArea } from '@/components/ui/scroll-area'

export default function HistoricoPage() {
  const { sku } = useParams<{ sku: string }>()
  const [product,   setProduct]   = useState<Product | null>(null)
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    if (!sku) return
    Promise.all([
      fetch(`/api/products/${sku}`).then((r) => r.json()),
      fetch(`/api/pipelines?sku=${sku}&limit=200`)
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
    <ScrollArea className="h-full bg-surface">
      <div className="flex flex-col">
        <ProductDetailHeader product={product} sku={sku!} />

        <section className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 py-7 pb-12">
          {loading ? (
            <HistoricoTabSkeleton />
          ) : (
            <HistoricoTab pipelines={pipelines} sku={sku!} />
          )}
        </section>
      </div>
    </ScrollArea>
  )
}
