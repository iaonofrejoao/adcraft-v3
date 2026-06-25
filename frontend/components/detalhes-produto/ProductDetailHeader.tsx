'use client'
import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Pencil, Loader2, Globe, Link2, Copy, Check, FileDown } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { COUNTRIES } from '@/lib/constants'
import type { Product } from './types'

function getCountry(code: string) {
  return COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[0]
}

function ProductUrl({ label, url }: { label: string; url: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault()
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  let displayUrl = url
  try {
    const parsed = new URL(url)
    const path = parsed.pathname !== '/' ? parsed.pathname.slice(0, 24) + (parsed.pathname.length > 24 ? '…' : '') : ''
    displayUrl = parsed.hostname + path
  } catch {}

  return (
    <div className="flex items-center gap-1 group/url">
      <Link2 size={11} strokeWidth={1.5} className="text-on-surface-muted/50 shrink-0" />
      <span className="text-[0.6875rem] text-on-surface-variant/50 select-none">{label}</span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-[0.6875rem] text-on-surface-variant/60 hover:text-brand transition-colors duration-150 truncate max-w-[200px]"
        title={url}
      >
        {displayUrl}
      </a>
      <button
        onClick={handleCopy}
        className="opacity-0 group-hover/url:opacity-100 transition-opacity duration-150 ml-0.5"
        title="Copiar URL"
      >
        {copied
          ? <Check size={11} strokeWidth={1.5} className="text-status-done-text" />
          : <Copy size={11} strokeWidth={1.5} className="text-on-surface-muted/60 hover:text-on-surface" />
        }
      </button>
    </div>
  )
}

// ── Botão de exportação PDF ────────────────────────────────────────────────────

function ExportPDFButton({ sku, productName }: { sku: string; productName: string }) {
  const [loading, setLoading] = useState(false)

  const handleExport = useCallback(async () => {
    if (loading) return
    setLoading(true)
    const toastId = toast.loading('Gerando PDF do estudo…')
    try {
      const res = await fetch(`/api/pdf/${sku}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Erro ao gerar PDF')
      }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `estudo-${sku}-${new Date().toISOString().slice(0, 10)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`PDF do estudo de ${productName} gerado`, { id: toastId })
    } catch (err) {
      toast.error((err as Error).message, { id: toastId })
    } finally {
      setLoading(false)
    }
  }, [sku, productName, loading])

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      title="Exportar estudo completo em PDF"
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
        'bg-surface-container border border-outline-variant/20 text-on-surface-variant',
        'hover:border-brand/40 hover:text-on-surface hover:bg-surface-high',
        'disabled:opacity-50 disabled:pointer-events-none',
      )}
    >
      {loading
        ? <Loader2  size={14} strokeWidth={1.5} className="animate-spin shrink-0" />
        : <FileDown size={14} strokeWidth={1.5} className="shrink-0" />
      }
      <span className="hidden sm:inline">{loading ? 'Gerando…' : 'Exportar PDF'}</span>
    </button>
  )
}

interface ProductDetailHeaderProps {
  product: Product
  sku: string
}

const TABS = [
  { label: 'Mercado',     href: (sku: string) => `/products/${sku}/mercado`     },
  { label: 'Personas',    href: (sku: string) => `/products/${sku}/personas`    },
  { label: 'Ângulos',     href: (sku: string) => `/products/${sku}/angulos`     },
  { label: 'Copy',        href: (sku: string) => `/products/${sku}/copies`      },
  { label: 'Criativos',   href: (sku: string) => `/products/${sku}/criativos`   },
  { label: 'Anúncios FB', href: (sku: string) => `/products/${sku}/facebook-ads` },
  { label: 'Campanhas',   href: (sku: string) => `/products/${sku}/campanhas`    },
  { label: 'VSL',         href: (sku: string) => `/products/${sku}/vsl`         },
  { label: 'Histórico',   href: (sku: string) => `/products/${sku}/historico`   },
] as const

function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days  = Math.floor(diff / 86_400_000)
  const hours = Math.floor(diff / 3_600_000)
  if (days > 0)  return `há ${days} dia${days !== 1 ? 's' : ''}`
  if (hours > 0) return `há ${hours}h`
  return 'agora há pouco'
}

export function ProductDetailHeader({ product, sku }: ProductDetailHeaderProps) {
  const pathname = usePathname()

  // ── Name editing ────────────────────────────────────────────────────────────
  const [editingName, setEditingName]   = useState(false)
  const [nameValue,   setNameValue]     = useState(product.name)
  const [savingName,  setSavingName]    = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const startEdit = useCallback(() => {
    setEditingName(true)
    setNameValue(product.name)
    setTimeout(() => inputRef.current?.select(), 0)
  }, [product.name])

  const cancelEdit = useCallback(() => {
    setEditingName(false)
    setNameValue(product.name)
  }, [product.name])

  const saveName = useCallback(async () => {
    const trimmed = nameValue.trim()
    if (!trimmed || trimmed === product.name) {
      cancelEdit()
      return
    }
    setSavingName(true)
    try {
      const res = await fetch(`/api/products/${sku}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erro ao salvar')
      toast.success('Nome atualizado')
      setEditingName(false)
      // Atualiza o valor local para refletir sem reload
      setNameValue(trimmed)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSavingName(false)
    }
  }, [nameValue, product.name, sku, cancelEdit])

  // ── Status toggle ────────────────────────────────────────────────────────────
  const [status,       setStatus]      = useState(product.status ?? 'active')
  const [savingStatus, setSavingStatus] = useState(false)

  // ── Country / Language ───────────────────────────────────────────────────────
  const [country,       setCountry]      = useState(product.target_country ?? 'BR')
  const [savingCountry, setSavingCountry] = useState(false)

  const saveCountry = useCallback(async (code: string) => {
    const found = getCountry(code)
    setSavingCountry(true)
    try {
      const res = await fetch(`/api/products/${sku}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_country: found.code, target_language: found.language }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erro ao salvar')
      setCountry(found.code)
      toast.success(`País atualizado: ${found.label} (${found.language})`)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSavingCountry(false)
    }
  }, [sku])

  const toggleStatus = useCallback(async (checked: boolean) => {
    const newStatus = checked ? 'active' : 'inactive'
    setSavingStatus(true)
    try {
      const res = await fetch(`/api/products/${sku}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erro ao salvar')
      setStatus(newStatus)
      toast.success(newStatus === 'active' ? 'Produto ativado' : 'Produto desativado')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSavingStatus(false)
    }
  }, [sku])

  return (
    <header className="bg-surface-low shrink-0">
      {/* Top bar: breadcrumb + actions */}
      <div className="flex items-start justify-between px-4 sm:px-6 lg:px-10 pt-6 pb-3">
        <div className="flex flex-col gap-1">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-[0.6875rem] font-medium tracking-wide">
            <Link
              href="/products"
              className="text-on-surface-variant/60 hover:text-on-surface-variant transition-colors duration-150"
            >
              Produtos
            </Link>
            <ChevronRight size={10} strokeWidth={1.5} className="text-on-surface-muted/40" />
            <span className="bg-brand-muted text-brand font-mono px-1.5 py-0.5 rounded">
              {sku}
            </span>
          </nav>

          {/* Title row: sku + nome editável + status switch */}
          <div className="flex items-center gap-3 mt-1 group">
            <span className="font-mono text-brand text-base font-medium">{sku}</span>

            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveName()
                    if (e.key === 'Escape') cancelEdit()
                  }}
                  onBlur={saveName}
                  disabled={savingName}
                  className={cn(
                    'text-[1.75rem] font-semibold tracking-[-0.02em] text-on-surface bg-transparent',
                    'border-b border-brand/60 outline-none focus:border-brand',
                    'min-w-[200px] w-auto'
                  )}
                  style={{ width: `${Math.max((nameValue ?? '').length, 10)}ch` }}
                  autoFocus
                />
                {savingName && (
                  <Loader2 size={16} strokeWidth={1.5} className="text-brand animate-spin shrink-0" />
                )}
              </div>
            ) : (
              <button
                onClick={startEdit}
                title="Clique para editar o nome"
                className="flex items-center gap-2 group/name"
              >
                <h1 className="text-[1.75rem] font-semibold tracking-[-0.02em] text-on-surface">
                  {nameValue}
                </h1>
                <Pencil
                  size={14}
                  strokeWidth={1.5}
                  className="text-on-surface-muted/0 group-hover/name:text-on-surface-muted transition-colors shrink-0"
                />
              </button>
            )}

            {/* Status switch */}
            <div className="flex items-center gap-2 ml-2">
              <Switch
                checked={status === 'active'}
                onCheckedChange={toggleStatus}
                disabled={savingStatus}
                id="product-status"
              />
              <label
                htmlFor="product-status"
                className={cn(
                  'text-[0.75rem] font-medium cursor-pointer select-none transition-colors',
                  status === 'active' ? 'text-status-done-text' : 'text-on-surface-muted'
                )}
              >
                {status === 'active' ? 'Ativo' : 'Inativo'}
              </label>
            </div>
          </div>

          {/* Metadata row */}
          <div className="flex items-center gap-3 mt-1 text-[0.8125rem] text-on-surface-variant/70">
            <span className="font-mono">{product.platform}</span>
            <span className="w-1 h-1 bg-white/20 rounded-full" />
            <span>Cadastrado {formatRelativeDate(product.created_at)}</span>
            {product.ticket_price && (
              <>
                <span className="w-1 h-1 bg-white/20 rounded-full" />
                <span className="font-mono">
                  R$ {parseFloat(product.ticket_price).toLocaleString('pt-BR')}
                </span>
              </>
            )}
            {product.commission_percent && (
              <>
                <span className="w-1 h-1 bg-white/20 rounded-full" />
                <span className="font-mono">
                  {parseFloat(product.commission_percent).toFixed(0)}% comissão
                </span>
              </>
            )}
            <span className="w-1 h-1 bg-white/20 rounded-full" />
            {/* Country / Language selector */}
            <div className="flex items-center gap-1.5">
              <Globe size={12} strokeWidth={1.5} className="text-on-surface-muted/60 shrink-0" />
              <div className="relative">
                <select
                  value={country}
                  disabled={savingCountry}
                  onChange={(e) => saveCountry(e.target.value)}
                  className={cn(
                    'appearance-none bg-transparent text-[0.8125rem] text-on-surface-variant/70',
                    'border-none outline-none cursor-pointer hover:text-on-surface transition-colors',
                    'pr-1',
                    savingCountry && 'opacity-50 pointer-events-none'
                  )}
                  title="País de destino (afeta idioma e adaptações culturais de todos os materiais gerados)"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code} className="bg-surface-container text-on-surface">
                      {c.flag} {c.label}
                    </option>
                  ))}
                </select>
              </div>
              {savingCountry && (
                <Loader2 size={11} strokeWidth={1.5} className="text-brand animate-spin shrink-0" />
              )}
            </div>
          </div>

          {/* URLs row */}
          {(product.product_url || product.affiliate_link) && (
            <div className="flex items-center gap-3 mt-1.5">
              {product.product_url && (
                <ProductUrl label="Produto" url={product.product_url} />
              )}
              {product.affiliate_link && product.affiliate_link !== product.product_url && (
                <>
                  <span className="w-1 h-1 bg-white/20 rounded-full shrink-0" />
                  <ProductUrl label="Afiliado" url={product.affiliate_link} />
                </>
              )}
            </div>
          )}

        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0 pt-1">
          <ExportPDFButton sku={sku} productName={product.name} />
        </div>
      </div>

      {/* Tab navigation */}
      <nav className="flex gap-6 px-4 sm:px-6 lg:px-10 overflow-x-auto scrollbar-none">
        {TABS.map(({ label, href }) => {
          const target   = href(sku)
          const isActive = pathname === target
          return (
            <Link
              key={label}
              href={target}
              className={cn(
                'pb-3 pt-1 text-sm font-medium border-b-2 transition-colors duration-150 shrink-0 whitespace-nowrap',
                isActive
                  ? 'text-brand border-brand'
                  : 'text-on-surface-variant/60 border-transparent hover:text-on-surface-variant'
              )}
            >
              {label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
