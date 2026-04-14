'use client'
import { useCreatives } from '@/hooks/useCreatives'
import { GaleriaCreativos } from '@/components/galeria-criativos'

export default function CreativesPage() {
  const { assets, isLoading } = useCreatives()

  return <GaleriaCreativos assets={assets} isLoading={isLoading} />
}
