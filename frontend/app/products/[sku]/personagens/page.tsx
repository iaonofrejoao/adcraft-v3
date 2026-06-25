import { redirect } from 'next/navigation'

export default function PersonagensPage({ params }: { params: { sku: string } }) {
  redirect(`/products/${params.sku}/criativos`)
}
