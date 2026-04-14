import { Skeleton } from '@/components/ui/skeleton'

export function ProductDetailLoading() {
  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Header skeleton */}
      <div className="bg-surface-low px-8 pt-6 pb-4 shrink-0 space-y-3">
        <Skeleton className="h-3 w-32 bg-surface-highest" />
        <Skeleton className="h-8 w-80 bg-surface-highest" />
        <Skeleton className="h-3 w-56 bg-surface-highest" />
        <div className="flex gap-4 pt-2">
          <Skeleton className="h-3 w-20 bg-surface-highest" />
          <Skeleton className="h-3 w-20 bg-surface-highest" />
        </div>
      </div>

      {/* Bento skeleton */}
      <div className="flex-1 p-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Left column */}
          <div className="col-span-12 lg:col-span-7 space-y-4">
            <Skeleton className="h-5 w-48 bg-surface-highest" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="bg-surface-low border border-white/5 rounded-xl p-6 space-y-3"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-lg bg-surface-highest" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24 bg-surface-highest" />
                    <Skeleton className="h-2.5 w-16 bg-surface-highest" />
                  </div>
                </div>
                <Skeleton className="h-3 w-full bg-surface-highest" />
                <Skeleton className="h-3 w-5/6 bg-surface-highest" />
                <Skeleton className="h-3 w-4/6 bg-surface-highest" />
              </div>
            ))}
          </div>

          {/* Right column */}
          <div className="col-span-12 lg:col-span-5 space-y-4">
            <Skeleton className="h-5 w-40 bg-surface-highest" />
            <div className="bg-surface-container border border-white/5 rounded-xl p-5 space-y-3">
              <Skeleton className="h-4 w-28 bg-surface-highest" />
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-lg bg-surface-highest" />
                ))}
              </div>
            </div>
            <div className="bg-surface-container border border-white/5 rounded-xl p-5 space-y-4">
              <Skeleton className="h-4 w-36 bg-surface-highest" />
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="w-8 h-8 rounded-full shrink-0 bg-surface-highest" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-40 bg-surface-highest" />
                    <Skeleton className="h-2.5 w-28 bg-surface-highest" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
