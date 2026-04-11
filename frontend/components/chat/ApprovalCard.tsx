'use client'
import { useState } from 'react'

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
      // Para budget_exceeded, apenas resolve o approval
      await fetch(`/api/approvals/${approvalId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: decision }),
      })
      setResolved(decision)
      onResolve(approvalId, decision)
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
    <div className="rounded-xl border overflow-hidden"
      style={{ background: 'var(--surface-card)', borderColor: resolved ? 'var(--border-default)' : 'var(--status-warning)', opacity: resolved ? 0.7 : 1 }}>

      <div className="px-4 py-3 border-b"
        style={{ borderColor: 'var(--border-default)', background: resolved ? 'var(--surface-page)' : '#FFF9ED' }}>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {titleMap[approvalType] ?? `Aprovação: ${approvalType}`}
        </p>
      </div>

      <div className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
        {approvalType === 'budget_exceeded' && (
          <p>
            O custo atual superou o budget configurado.{' '}
            <strong style={{ color: 'var(--text-primary)' }}>
              Atual: ${String(payload.cost_so_far_usd ?? '?')} / Budget: ${String(payload.budget_usd ?? '?')}
            </strong>.
            Deseja continuar?
          </p>
        )}
        {approvalType === 'copy_components' && (
          <p>
            Componentes de copy gerados e pendentes de aprovação em{' '}
            <a href={`/products/${payload.sku}/copies`}
              className="underline" style={{ color: 'var(--brand-primary)' }}>
              /products/{String(payload.sku ?? '?')}/copies
            </a>.
          </p>
        )}
        {approvalType === 'combination_selection' && (
          <p>
            Combinações materializadas. Selecione quais viram vídeo em{' '}
            <a href={`/products/${payload.sku}/copies`}
              className="underline" style={{ color: 'var(--brand-primary)' }}>
              /products/{String(payload.sku ?? '?')}/copies
            </a>.
          </p>
        )}
      </div>

      {!resolved && (
        <div className="px-4 pb-4 flex gap-2">
          <button
            onClick={() => handleDecision('approved')}
            disabled={loading}
            className="flex-1 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-40"
            style={{ background: 'var(--status-success)' }}
          >
            {loading ? '…' : 'Continuar'}
          </button>
          <button
            onClick={() => handleDecision('rejected')}
            disabled={loading}
            className="flex-1 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40 border"
            style={{ color: 'var(--status-error)', borderColor: 'var(--status-error)' }}
          >
            Pausar
          </button>
        </div>
      )}

      {resolved && (
        <div className="px-4 pb-4">
          <p className="text-sm font-medium" style={{ color: resolved === 'approved' ? 'var(--status-success)' : 'var(--status-error)' }}>
            {resolved === 'approved' ? 'Aprovado ✓' : 'Pausado ✗'}
          </p>
        </div>
      )}
    </div>
  )
}
