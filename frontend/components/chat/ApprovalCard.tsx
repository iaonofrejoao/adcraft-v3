'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface ApprovalCardProps {
  approvalId:   string
  approvalType: 'budget_exceeded' | 'copy_components' | 'combination_selection' | string
  payload:      Record<string, unknown>
  onResolve:    (approvalId: string, decision: 'approved' | 'rejected') => void
}

export function ApprovalCard({ approvalId, approvalType, payload, onResolve }: ApprovalCardProps) {
  const [resolved, setResolved] = useState<'approved' | 'rejected' | null>(null)
  const [loading, setLoading]   = useState(false)

  async function handleDecision(decision: 'approved' | 'rejected') {
    setLoading(true)
    try {
      const res = await fetch(`/api/approvals/${approvalId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: decision }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setResolved(decision)
      onResolve(approvalId, decision)
      if (decision === 'approved') {
        toast.success('Pipeline continuado', { description: 'A execução foi aprovada e segue.' })
      } else {
        toast('Pipeline pausado', { description: 'A execução foi pausada aguardando ação.' })
      }
    } catch {
      toast.error('Erro ao processar decisão', { description: 'Tente novamente ou verifique a conexão.' })
    } finally {
      setLoading(false)
    }
  }

  const titleMap: Record<string, string> = {
    budget_exceeded:      '⚠️ Budget excedido',
    copy_components:      '✏️ Aprovação de componentes',
    combination_selection:'🎬 Selecionar combinações',
  }

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden',
      'bg-surface-container',
      resolved ? 'border-white/10 opacity-70' : 'border-status-paused-text/40',
    )}>
      <div className={cn(
        'px-4 py-3 border-b border-white/5',
        !resolved && 'bg-status-paused',
      )}>
        <p className="text-sm font-semibold text-on-surface">
          {titleMap[approvalType] ?? `Aprovação: ${approvalType}`}
        </p>
      </div>

      <div className="px-4 py-3 text-sm text-on-surface-variant">
        {approvalType === 'budget_exceeded' && (
          <p>
            O custo atual superou o budget configurado.{' '}
            <strong className="text-on-surface">
              Atual: ${String(payload.cost_so_far_usd ?? '?')} / Budget: ${String(payload.budget_usd ?? '?')}
            </strong>.
            Deseja continuar?
          </p>
        )}
        {approvalType === 'copy_components' && (
          <p>
            Componentes de copy gerados e pendentes de aprovação em{' '}
            <a href={`/products/${payload.sku}/copies`} className="underline text-brand">
              /products/{String(payload.sku ?? '?')}/copies
            </a>.
          </p>
        )}
        {approvalType === 'combination_selection' && (
          <p>
            Combinações materializadas. Selecione quais viram vídeo em{' '}
            <a href={`/products/${payload.sku}/copies`} className="underline text-brand">
              /products/{String(payload.sku ?? '?')}/copies
            </a>.
          </p>
        )}
      </div>

      {!resolved && (
        <div className="px-4 pb-4 flex gap-2">
          <Button
            onClick={() => handleDecision('approved')}
            disabled={loading}
            className="flex-1 bg-status-done text-status-done-text hover:bg-status-done/80 disabled:opacity-40"
          >
            {loading ? '…' : 'Continuar'}
          </Button>
          <Button
            variant="outline"
            onClick={() => handleDecision('rejected')}
            disabled={loading}
            className="flex-1 border-status-failed-text/40 text-status-failed-text hover:bg-status-failed disabled:opacity-40"
          >
            Pausar
          </Button>
        </div>
      )}

      {resolved && (
        <div className="px-4 pb-4">
          <p className={cn(
            'text-sm font-medium',
            resolved === 'approved' ? 'text-status-done-text' : 'text-status-failed-text',
          )}>
            {resolved === 'approved' ? 'Aprovado ✓' : 'Pausado ✗'}
          </p>
        </div>
      )}
    </div>
  )
}
