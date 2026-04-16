'use client'
import { useState } from 'react'
import { RefreshCw, AlertTriangle } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'

export interface RerunModalProps {
  open:        boolean
  agentName:   string
  downstreamCount?: number
  onConfirm:   () => Promise<void>
  onCancel:    () => void
}

export function RerunModal({
  open,
  agentName,
  downstreamCount = 0,
  onConfirm,
  onCancel,
}: RerunModalProps) {
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await onConfirm()
    } finally {
      setLoading(false)
    }
  }

  const label = agentName.replace(/_/g, ' ')

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="bg-surface-container border-outline-variant max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-on-surface flex items-center gap-2">
            <RefreshCw size={18} strokeWidth={1.5} className="text-primary" />
            Re-executar agente
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-on-surface-variant text-[13px]">
              <p>
                Isso vai re-rodar o agente{' '}
                <span className="font-mono font-bold text-on-surface">{label}</span>{' '}
                usando o input atual.
              </p>

              {downstreamCount > 0 && (
                <div className="flex items-start gap-2 bg-status-paused-bg border border-status-paused-text/20 rounded-md p-3">
                  <AlertTriangle
                    size={14}
                    strokeWidth={1.5}
                    className="text-status-paused-text shrink-0 mt-0.5"
                  />
                  <p className="text-status-paused-text">
                    {downstreamCount} {downstreamCount === 1 ? 'step seguinte será invalidado' : 'steps seguintes serão invalidados'}{' '}
                    e precisarão rodar novamente.
                  </p>
                </div>
              )}

              <p className="text-on-surface-muted">Deseja continuar?</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={onCancel}
            disabled={loading}
            className="bg-surface-container-high border-outline-variant text-on-surface hover:bg-surface-container-highest"
          >
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading}
            className={cn(
              'bg-primary text-on-primary hover:bg-primary/90',
              loading && 'opacity-60 cursor-not-allowed'
            )}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <RefreshCw size={14} strokeWidth={1.5} className="animate-spin" />
                Enviando…
              </span>
            ) : (
              'Re-executar'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
