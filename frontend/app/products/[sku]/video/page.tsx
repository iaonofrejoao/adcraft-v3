'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ProductDetailHeader, ProductDetailLoading } from '@/components/detalhes-produto'
import type { Product } from '@/components/detalhes-produto'
import { VideoTab, VideoTabSkeleton } from '@/components/produto-tabs/VideoTab'
import { ScrollArea } from '@/components/ui/scroll-area'

export default function VideoPage() {
  const { sku } = useParams<{ sku: string }>()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sku) return
    fetch(`/api/products/${sku}`)
      .then(r => r.json())
      .then(d => setProduct(d.product ?? d))
      .finally(() => setLoading(false))
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
          <VideoTab sku={sku!} />
        </section>
      </div>
    </ScrollArea>
  )
}
