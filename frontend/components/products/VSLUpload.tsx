'use client'
import { useCallback, useRef, useState } from 'react'
import { Upload, Link2, Video, X, Loader2, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'

// ── Types ─────────────────────────────────────────────────────────────────────

type Mode = 'url' | 'upload'

interface VSLUploadProps {
  sku: string
  /** URL já salva (ex: produto carregado do banco) */
  currentUrl?: string | null
  /** Chamado após upload/save bem-sucedido com a URL final */
  onSaved?: (url: string) => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// ── Componente ────────────────────────────────────────────────────────────────

export function VSLUpload({ sku, currentUrl, onSaved }: VSLUploadProps) {
  const [mode,         setMode]         = useState<Mode>('url')
  const [urlValue,     setUrlValue]     = useState(currentUrl ?? '')
  const [file,         setFile]         = useState<File | null>(null)
  const [dragOver,     setDragOver]     = useState(false)
  const [uploading,    setUploading]    = useState(false)
  const [uploadPct,    setUploadPct]    = useState(0)
  const [savedUrl,     setSavedUrl]     = useState<string | null>(currentUrl ?? null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── URL externa ─────────────────────────────────────────────────────────────

  const saveUrl = async () => {
    if (!urlValue.trim()) {
      toast.error('Informe uma URL válida')
      return
    }
    setUploading(true)
    try {
      const res = await fetch(`/api/products/${sku}/vsl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'url', url: urlValue.trim() }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erro ao salvar')
      const data = await res.json()
      setSavedUrl(data.vsl_url)
      onSaved?.(data.vsl_url)
      toast.success('VSL salvo com sucesso')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setUploading(false)
    }
  }

  // ── Upload de arquivo ────────────────────────────────────────────────────────

  const handleFile = useCallback((f: File) => {
    const ALLOWED = ['video/mp4', 'video/quicktime', 'video/webm']
    if (!ALLOWED.includes(f.type)) {
      toast.error('Formato não suportado. Use MP4, MOV ou WebM.')
      return
    }
    if (f.size > 500 * 1024 * 1024) {
      toast.error('Arquivo muito grande (máximo 500MB)')
      return
    }
    setFile(f)
    setSavedUrl(null)
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  const uploadFile = async () => {
    if (!file) return
    setUploading(true)
    setUploadPct(0)

    // Simula progresso (upload real é síncono no servidor — sem streaming nativo)
    const interval = setInterval(() => {
      setUploadPct((prev) => Math.min(prev + 8, 90))
    }, 300)

    try {
      const form = new FormData()
      form.append('file', file)
      form.append('type', 'upload')

      const res = await fetch(`/api/products/${sku}/vsl`, {
        method: 'POST',
        body: form,
      })

      clearInterval(interval)

      if (!res.ok) throw new Error((await res.json()).error ?? 'Erro no upload')
      const data = await res.json()
      setUploadPct(100)
      setSavedUrl(data.vsl_url)
      onSaved?.(data.vsl_url)
      toast.success('VSL enviado com sucesso')
    } catch (err) {
      clearInterval(interval)
      setUploadPct(0)
      toast.error((err as Error).message)
    } finally {
      setUploading(false)
    }
  }

  const clearFile = () => {
    setFile(null)
    setUploadPct(0)
    setSavedUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Toggle de modo */}
      <div className="flex items-center bg-surface-container p-1 rounded-lg border border-white/5 w-fit">
        <button
          onClick={() => setMode('url')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors',
            mode === 'url'
              ? 'bg-surface-container-high text-on-surface'
              : 'text-on-surface-muted hover:text-on-surface-variant'
          )}
        >
          <Link2 size={13} strokeWidth={1.5} />
          URL externa
        </button>
        <button
          onClick={() => setMode('upload')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors',
            mode === 'upload'
              ? 'bg-surface-container-high text-on-surface'
              : 'text-on-surface-muted hover:text-on-surface-variant'
          )}
        >
          <Upload size={13} strokeWidth={1.5} />
          Upload de arquivo
        </button>
      </div>

      {/* ── Modo URL ─────────────────────────────────────────────────────────── */}
      {mode === 'url' && (
        <div className="flex gap-2">
          <Input
            type="url"
            placeholder="https://www.youtube.com/watch?v=..."
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveUrl()}
            disabled={uploading}
            className="flex-1 bg-surface-container border-white/10 text-on-surface text-sm"
          />
          <Button
            onClick={saveUrl}
            disabled={uploading || !urlValue.trim()}
            size="sm"
            className="bg-brand text-[#131314] hover:bg-brand/90 shrink-0"
          >
            {uploading ? (
              <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />
            ) : 'Salvar'}
          </Button>
        </div>
      )}

      {/* ── Modo Upload ───────────────────────────────────────────────────────── */}
      {mode === 'upload' && (
        <div className="space-y-3">
          {!file ? (
            // Drag & drop zone
            <div
              onDrop={onDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
                dragOver
                  ? 'border-brand bg-brand/5'
                  : 'border-white/10 hover:border-white/20 hover:bg-surface-container'
              )}
            >
              <Video size={32} strokeWidth={1} className="mx-auto text-on-surface-muted mb-3" />
              <p className="text-sm text-on-surface-variant font-medium">
                Arraste um vídeo ou clique para selecionar
              </p>
              <p className="text-[0.6875rem] text-on-surface-muted mt-1">
                MP4, MOV, WebM · máximo 500MB
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/webm"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleFile(f)
                }}
              />
            </div>
          ) : (
            // Preview do arquivo selecionado
            <div className="bg-surface-container rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Video size={16} strokeWidth={1.5} className="text-brand shrink-0" />
                  <span className="text-sm text-on-surface truncate">{file.name}</span>
                  <span className="text-[0.6875rem] text-on-surface-muted shrink-0">
                    {formatBytes(file.size)}
                  </span>
                </div>
                {!uploading && (
                  <button
                    onClick={clearFile}
                    className="p-1 rounded text-on-surface-muted hover:text-on-surface transition-colors shrink-0"
                  >
                    <X size={14} strokeWidth={1.5} />
                  </button>
                )}
              </div>

              {/* Progress bar */}
              {uploading && (
                <div className="space-y-1">
                  <Progress value={uploadPct} className="h-1.5 bg-surface-container-high" />
                  <p className="text-[0.6875rem] text-on-surface-muted">{uploadPct}% enviado…</p>
                </div>
              )}

              {!uploading && uploadPct < 100 && (
                <Button
                  onClick={uploadFile}
                  size="sm"
                  className="w-full bg-brand text-[#131314] hover:bg-brand/90"
                >
                  <Upload size={14} strokeWidth={1.5} className="mr-1.5" />
                  Enviar vídeo
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Preview do vídeo salvo */}
      {savedUrl && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[0.75rem] text-green-400">
            <CheckCircle2 size={14} strokeWidth={1.5} />
            VSL vinculado com sucesso
          </div>
          <video
            src={savedUrl}
            controls
            className="w-full rounded-xl bg-black max-h-64 border border-white/5"
          />
        </div>
      )}
    </div>
  )
}
