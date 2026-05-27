'use client'
import { useCallback, useEffect, useState } from 'react'
import { UserSquare, Loader2, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PersonaAsset {
  id:                  string
  status:              'creating' | 'ready' | 'failed'
  photos:              string[] | null
  heygen_avatar_id:    string | null
  elevenlabs_voice_id: string | null
  error_message:       string | null
  created_at:          string
  completed_at:        string | null
}

interface PersonaStatusBadgeProps {
  sku:        string
  className?: string
}

// ── Hook ──────────────────────────────────────────────────────────────────────

function usePersonaAsset(sku: string) {
  const [persona,    setPersona]    = useState<PersonaAsset | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [triggering, setTriggering] = useState(false)

  const fetch_ = useCallback(() => {
    fetch(`/api/products/${sku}/persona`)
      .then(r => r.json())
      .then(d => setPersona(d.persona ?? null))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [sku])

  useEffect(() => {
    fetch_()
  }, [fetch_])

  // Polling enquanto status === 'creating'
  useEffect(() => {
    if (persona?.status !== 'creating') return
    const id = setInterval(fetch_, 15_000)
    return () => clearInterval(id)
  }, [persona?.status, fetch_])

  const triggerSetup = useCallback(async () => {
    setTriggering(true)
    try {
      const res = await fetch(`/api/products/${sku}/persona`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao iniciar setup')
      toast.success('Setup de persona iniciado. Isso pode levar alguns minutos.')
      // Força uma nova leitura após iniciar
      setTimeout(fetch_, 2000)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setTriggering(false)
    }
  }, [sku, fetch_])

  return { persona, loading, triggering, triggerSetup }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PersonaStatusBadge({ sku, className }: PersonaStatusBadgeProps) {
  const { persona, loading, triggering, triggerSetup } = usePersonaAsset(sku)

  if (loading) {
    return (
      <div className={cn('flex items-center gap-1.5 text-[0.6875rem] text-on-surface-muted/60', className)}>
        <UserSquare size={12} strokeWidth={1.5} />
        <span>Persona…</span>
      </div>
    )
  }

  // Sem persona: botão para iniciar setup
  if (!persona) {
    return (
      <button
        onClick={triggerSetup}
        disabled={triggering}
        className={cn(
          'flex items-center gap-1.5 text-[0.6875rem] font-medium transition-colors duration-150',
          'text-on-surface-muted hover:text-brand',
          triggering && 'opacity-50 pointer-events-none',
          className,
        )}
        title="Gerar persona visual e vocal para este produto"
      >
        {triggering
          ? <Loader2 size={12} strokeWidth={1.5} className="animate-spin" />
          : <Sparkles size={12} strokeWidth={1.5} />}
        {triggering ? 'Iniciando…' : 'Configurar persona'}
      </button>
    )
  }

  // Criando
  if (persona.status === 'creating') {
    return (
      <div className={cn('flex items-center gap-1.5 text-[0.6875rem] text-status-running-text', className)}>
        <Loader2 size={12} strokeWidth={1.5} className="animate-spin" />
        <span>Gerando persona…</span>
      </div>
    )
  }

  // Falhou
  if (persona.status === 'failed') {
    return (
      <button
        onClick={triggerSetup}
        disabled={triggering}
        className={cn(
          'flex items-center gap-1.5 text-[0.6875rem] font-medium transition-colors duration-150',
          'text-status-failed-text hover:opacity-80',
          triggering && 'opacity-50 pointer-events-none',
          className,
        )}
        title={persona.error_message ?? 'Falha no setup. Clique para tentar novamente.'}
      >
        {triggering
          ? <Loader2 size={12} strokeWidth={1.5} className="animate-spin" />
          : <AlertCircle size={12} strokeWidth={1.5} />}
        {triggering ? 'Tentando…' : 'Falhou · Retry'}
      </button>
    )
  }

  // Pronta — exibe avatar (primeira foto) + badge verde
  const firstPhoto = persona.photos?.[0]
  return (
    <div
      className={cn('flex items-center gap-2', className)}
      title={`Persona pronta · HeyGen: ${persona.heygen_avatar_id ?? '—'} · ElevenLabs: ${persona.elevenlabs_voice_id ?? '—'}`}
    >
      {firstPhoto ? (
        <img
          src={firstPhoto}
          alt="Persona"
          className="w-6 h-6 rounded-full object-cover ring-1 ring-status-done-text/40"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      ) : (
        <div className="w-6 h-6 rounded-full bg-status-done flex items-center justify-center">
          <UserSquare size={11} strokeWidth={1.5} className="text-status-done-text" />
        </div>
      )}
      <span className="flex items-center gap-1 text-[0.6875rem] font-medium text-status-done-text">
        <CheckCircle2 size={11} strokeWidth={1.5} />
        Persona pronta
      </span>
    </div>
  )
}
