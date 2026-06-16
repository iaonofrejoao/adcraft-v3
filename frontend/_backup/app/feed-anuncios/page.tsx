'use client'
import { Megaphone, RefreshCw } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { AdFilters } from '@/components/feed-anuncios/AdFilters'
import { AdCard } from '@/components/feed-anuncios/AdCard'
import { useAdLibrary, type AdLibraryFilters } from '@/hooks/useAdLibrary'

export default function FeedAnunciosPage() {
  const { ads, isLoading, error, hasMore, count, search, loadMore } = useAdLibrary()

  function handleSearch(filters: AdLibraryFilters) {
    search(filters)
  }

  return (
    <div className="flex flex-col h-full bg-surface">

      {/* Header */}
      <div className="px-6 py-4 bg-surface-low">
        <div className="flex items-center gap-2.5">
          <Megaphone size={18} strokeWidth={1.5} className="text-brand" />
          <div>
            <h1 className="text-sm font-semibold text-on-surface">Feed de Anúncios</h1>
            <p className="text-xs text-on-surface-muted">
              Facebook Ad Library — pesquise anúncios de concorrentes
            </p>
          </div>
          {count > 0 && (
            <span className="ml-auto font-mono text-xs text-on-surface-muted">
              {count} anúncios carregados
            </span>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-6 py-5 space-y-6 max-w-6xl mx-auto">

          {/* Filters */}
          <AdFilters onSearch={handleSearch} isLoading={isLoading} />

          {/* Error */}
          {error && (
            <div className="bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] rounded-md px-4 py-3">
              <p className="text-sm text-[#F87171]">{error}</p>
            </div>
          )}

          {/* Skeleton inicial */}
          {isLoading && ads.length === 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-52 rounded-md bg-surface-container" />
              ))}
            </div>
          )}

          {/* Estado vazio */}
          {!isLoading && !error && ads.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center mb-4">
                <Megaphone size={20} strokeWidth={1.5} className="text-on-surface-muted" />
              </div>
              <p className="text-sm font-medium text-on-surface mb-1">Nenhum anúncio aqui ainda</p>
              <p className="text-xs text-on-surface-muted max-w-xs">
                Use os filtros acima para pesquisar por palavras-chave ou ID de página anunciante
              </p>
            </div>
          )}

          {/* Grid de resultados */}
          {ads.length > 0 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {ads.map(ad => (
                  <AdCard key={ad.id} ad={ad} />
                ))}
                {isLoading && Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={`more-${i}`} className="h-52 rounded-md bg-surface-container" />
                ))}
              </div>

              {hasMore && !isLoading && (
                <div className="flex justify-center pb-4">
                  <Button
                    variant="outline"
                    onClick={loadMore}
                    className="border-white/10 bg-transparent text-on-surface-muted hover:bg-surface-high hover:text-on-surface transition-colors duration-150"
                  >
                    <RefreshCw size={14} strokeWidth={1.5} className="mr-2" />
                    Carregar mais
                  </Button>
                </div>
              )}
            </>
          )}

        </div>
      </ScrollArea>
    </div>
  )
}
