import { redirect } from 'next/navigation'

export default function VideoPage({ params }: { params: { sku: string } }) {
  redirect(`/products/${params.sku}/criativos`)
}
