'use client'
import { Plus, Clock } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { CopyComponent } from '@/hooks/useCopyBoard'
import { ComponenteCard } from './ComponenteCard'

interface ColunaComponentesProps {
  type:             'hook' | 'body' | 'cta'
  label:            string
  Icon:             LucideIcon
  iconClass:        string
  iconBg:           string
  items:            CopyComponent[]
  onApprove:        (id: string) => void
  onReject:         (id: string) => void
  onGenerateMore?:  () => void
}

export function ColunaComponentes({
  label, Icon, iconClass, iconBg, items,
  onApprove, onReject, onGenerateMore,
}: ColunaComponentesProps) {
  const approvedCount = items.filter((c) => c.approval_status === 'approved').length

  return (
    <section className="flex flex-col gap-3 min-h-0">
      {/* Column header */}
      <div className="flex items-center justify-between px-1 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', iconBg)}>
            <Icon size={16} strokeWidth={1.5} className={iconClass} />
          </div>
          <h2 className="text-base font-bold text-on-surface">
            {label}
            <span className="text-on-surface-muted text-sm font-normal ml-1.5">
              ({items.length})
            </span>
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {approvedCount > 0 && (
            <span className="text-[0.625rem] font-mono text-brand">
              {approvedCount}/{items.length} ✓
            </span>
          )}
          {onGenerateMore && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onGenerateMore}
              className="h-auto px-2 py-1 text-[0.625rem] text-brand
                hover:text-brand hover:bg-brand/5 gap-1 font-bold"
            >
              <Plus size={10} strokeWidth={2.5} />
              Gerar mais 3
            </Button>
          )}
        </div>
      </div>

      {/* Scrollable cards — each column scrolls independently */}
      <ScrollArea className="h-[calc(100vh-320px)] min-h-[400px]">
        <div className="space-y-3 pr-3 pb-4">
          {items.length === 0 ? (
            <div className="bg-surface-container/50 rounded-xl p-8 border border-dashed border-white/10
              flex flex-col items-center justify-center text-center gap-2">
              <Clock size={20} strokeWidth={1.5} className="text-on-surface-muted/40" />
              <p className="text-[0.625rem] font-mono text-on-surface-muted/40 uppercase tracking-widest">
                Aguardando Geração
              </p>
            </div>
          ) : (
            items.map((comp) => (
              <ComponenteCard
                key={comp.id}
                component={comp}
                columnLabel={label}
                onApprove={onApprove}
                onReject={onReject}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </section>
  )
}
