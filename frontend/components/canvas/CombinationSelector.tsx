'use client'
import { useEffect, useState, useCallback } from 'react'
import {
  Loader2, Plus, AlertCircle, CheckCircle2, Clock,
  ChevronDown, Search, LayoutTemplate,
} from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface Combination {
  id:            string
  tag:           string
  full_text:     string | null
  script_status: string
}

export interface CombinationSelectorProps {
  sku:            string
  selectedId:     string | null
  comboToCanvas:  Record<string, string>
  onSelect:       (comboId: string) => void
  onCreateCanvas: (comboId: string) => Promise<string | null>
}

function StatusPill({ hasCanvas, scriptStatus }: { hasCanvas: boolean; scriptStatus: string }) {
  if (hasCanvas) return (
    <span className="flex items-center gap-1 text-[0.5rem] text-status-done-text bg-status-done px-1.5 py-0.5 rounded-full shrink-0">
      <CheckCircle2 size={8} strokeWidth={2} /> Canvas criado
    </span>
  )
  if (scriptStatus === 'ready') return (
    <span className="flex items-center gap-1 text-[0.5rem] text-brand bg-brand/10 px-1.5 py-0.5 rounded-full shrink-0">
      <CheckCircle2 size={8} strokeWidth={2} /> Pronto
    </span>
  )
  if (scriptStatus === 'pending' || scriptStatus === 'queued') return (
    <span className="flex items-center gap-1 text-[0.5rem] text-on-surface-muted bg-surface-highest px-1.5 py-0.5 rounded-full shrink-0">
      <Clock size={8} strokeWidth={2} /> Pendente
    </span>
  )
  return (
    <span className="flex items-center gap-1 text-[0.5rem] text-status-paused-text bg-status-paused px-1.5 py-0.5 rounded-full shrink-0">
      <AlertCircle size={8} strokeWidth={2} /> Sem storyboard
    </span>
  )
}

const truncate = (text: string | null, len = 80) =>
  !text ? 'Combinação sem copy' : text.length > len ? text.slice(0, len) + '…' : text

export function CombinationSelector({
  sku,
  selectedId,
  comboToCanvas,
  onSelect,
  onCreateCanvas,
}: CombinationSelectorProps) {
  const [combinations, setCombinations] = useState<Combination[]>([])
  const [isLoading,    setIsLoading]    = useState(true)
  const [open,         setOpen]         = useState(false)
  const [query,        setQuery]        = useState('')
  const [creating,     setCreating]     = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/products/${sku}/combinations`)
      .then(r => r.json())
      .then((d: { combinations?: Combination[] }) => setCombinations(d.combinations ?? []))
      .finally(() => setIsLoading(false))
  }, [sku])

  const selected   = combinations.find(c => c.id === selectedId)
  const hasCanvas  = selected ? !!comboToCanvas[selected.id] : false

  const filtered = query.trim()
    ? combinations.filter(c =>
        c.tag.toLowerCase().includes(query.toLowerCase()) ||
        (c.full_text ?? '').toLowerCase().includes(query.toLowerCase()),
      )
    : combinations

  const handlePick = useCallback((comboId: string) => {
    onSelect(comboId)
    setOpen(false)
    setQuery('')
  }, [onSelect])

  const handleCreate = useCallback(async (e: React.MouseEvent, comboId: string) => {
    e.stopPropagation()
    setCreating(comboId)
    try {
      const canvasId = await onCreateCanvas(comboId)
      if (canvasId) setOpen(false)
    } finally {
      setCreating(null)
      setQuery('')
    }
  }, [onCreateCanvas])

  return (
    <>
      {/* Trigger */}
      <button
        onClick={() => setOpen(true)}
        disabled={isLoading}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg border text-[0.6875rem] transition-all duration-150',
          'bg-surface-container border-outline-variant/20 text-on-surface-variant',
          'hover:border-brand/40 hover:text-on-surface',
          'disabled:opacity-50 disabled:pointer-events-none',
        )}
      >
        {isLoading
          ? <Loader2 size={13} strokeWidth={1.5} className="animate-spin shrink-0" />
          : <LayoutTemplate size={13} strokeWidth={1.5} className="shrink-0 text-on-surface-muted" />}

        <span className="max-w-[260px] truncate text-left">
          {selected ? truncate(selected.full_text, 40) : 'Selecionar combinação…'}
        </span>

        {selected && (
          <span className="text-[0.5rem] font-mono text-on-surface-muted shrink-0">{selected.tag}</span>
        )}

        {selected && hasCanvas && (
          <CheckCircle2 size={11} strokeWidth={2} className="text-status-done-text shrink-0" />
        )}

        <ChevronDown size={12} strokeWidth={1.5} className="shrink-0 text-on-surface-muted ml-auto" />
      </button>

      {/* Modal */}
      <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) setQuery('') }}>
        <DialogContent className="max-w-2xl p-0 gap-0 bg-surface-container border-outline-variant/20 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-4 border-b border-white/5 shrink-0">
            <DialogTitle className="text-sm font-semibold text-on-surface">
              Selecionar combinação
            </DialogTitle>
            <p className="text-[0.6875rem] text-on-surface-variant mt-0.5">
              {combinations.length} combinações disponíveis
            </p>
          </DialogHeader>

          {/* Search */}
          <div className="px-5 py-3 border-b border-white/5 shrink-0">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-high border border-white/5">
              <Search size={13} strokeWidth={1.5} className="text-on-surface-muted shrink-0" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar por tag ou copy…"
                className="flex-1 bg-transparent text-[0.6875rem] text-on-surface placeholder:text-on-surface-muted outline-none"
              />
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto" style={{ maxHeight: 'min(480px, 60vh)' }}>
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <p className="text-[0.6875rem] text-on-surface-muted">
                  {query ? 'Nenhuma combinação encontrada' : 'Nenhuma combinação disponível'}
                </p>
              </div>
            ) : (
              filtered.map(combo => {
                const cv          = !!comboToCanvas[combo.id]
                const isSelected  = combo.id === selectedId
                const isCreating  = creating === combo.id
                const noScript    = combo.script_status !== 'ready' && !cv

                return (
                  <div
                    key={combo.id}
                    onClick={() => handlePick(combo.id)}
                    className={cn(
                      'flex items-start gap-4 px-5 py-3.5 border-b border-white/5 last:border-0 cursor-pointer transition-colors duration-100',
                      isSelected ? 'bg-brand/8' : 'hover:bg-surface-high/60',
                    )}
                  >
                    {/* Indicador de seleção */}
                    <div className={cn(
                      'mt-0.5 w-1.5 h-1.5 rounded-full shrink-0',
                      isSelected ? 'bg-brand' : 'bg-transparent',
                    )} />

                    {/* Conteúdo */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[0.5625rem] font-mono text-on-surface-muted">{combo.tag}</span>
                        <StatusPill hasCanvas={cv} scriptStatus={combo.script_status} />
                      </div>
                      <p className="text-[0.75rem] text-on-surface leading-snug">
                        {combo.full_text ?? <em className="text-on-surface-muted">sem copy</em>}
                      </p>
                    </div>

                    {/* Ação */}
                    {!cv && !noScript && (
                      <button
                        onClick={e => handleCreate(e, combo.id)}
                        disabled={isCreating}
                        className={cn(
                          'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[0.5625rem] font-medium shrink-0 transition-all duration-150',
                          'bg-brand text-white hover:opacity-90 disabled:opacity-40',
                        )}
                      >
                        {isCreating
                          ? <Loader2 size={10} strokeWidth={2} className="animate-spin" />
                          : <Plus size={10} strokeWidth={2} />}
                        Criar canvas
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
