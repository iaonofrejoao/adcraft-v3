'use client'
import { Play, Download, MoreHorizontal, ExternalLink, Trash2, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import type { Asset } from '@/hooks/useCreatives'

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  const h    = Math.floor(mins / 60)
  const d    = Math.floor(h / 24)
  if (d >= 7)   return `${Math.floor(d / 7)}sem`
  if (d > 0)    return `há ${d}d`
  if (h > 0)    return `há ${h}h`
  if (mins > 0) return `há ${mins}m`
  return 'agora'
}

function formatSize(bytes?: number): string | null {
  if (!bytes) return null
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function tagChips(tag: string): string[] {
  const parts = tag.split('_')
  return parts.length >= 3 ? parts.slice(1, 4) : parts
}

export interface CreativeCardProps {
  asset: Asset
}

export function CreativeCard({ asset: a }: CreativeCardProps) {
  const isVideo = a.asset_type === 'video'
  const sizeStr = formatSize(a.file_size)
  const chips   = tagChips(a.tag)
  const title   = a.product?.name ?? a.tag

  function handleMouseEnter(e: React.MouseEvent<HTMLVideoElement>) {
    e.currentTarget.play().catch(() => {})
  }
  function handleMouseLeave(e: React.MouseEvent<HTMLVideoElement>) {
    const v = e.currentTarget
    v.pause()
    v.currentTime = 0
  }

  return (
    <div className="group flex flex-col">
      {/* Thumbnail */}
      <div className="relative aspect-[9/16] bg-surface rounded-xl overflow-hidden mb-3 border border-outline-variant/10">
        {isVideo ? (
          <video
            src={a.url}
            className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-500"
            preload="metadata"
            muted
            playsInline
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center opacity-30">
            <Copy size={32} strokeWidth={1} className="text-on-surface-variant" />
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-background/10 pointer-events-none" />

        {/* ID badge — top-left */}
        <div className="absolute top-3 left-3 px-2 py-1 bg-surface/60 backdrop-blur-md rounded font-mono text-[10px] text-brand border border-brand/20">
          {a.tag}
        </div>

        {/* Asset type badge — top-right */}
        <div className="absolute top-3 right-3 px-2 py-1 bg-surface/40 backdrop-blur-md rounded font-mono text-[10px] text-on-surface-variant uppercase">
          {a.asset_type}
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-surface/40">
          <Button
            size="icon"
            className="w-16 h-16 rounded-full bg-brand/90 hover:bg-brand text-on-primary shadow-xl border-0"
          >
            <Play size={28} strokeWidth={1.5} className="ml-1" />
          </Button>

          <a
            href={a.url}
            download={`${a.tag}.${isVideo ? 'mp4' : 'jpg'}`}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-4 right-4 p-2 bg-on-surface/10 backdrop-blur-md rounded-lg text-on-surface hover:bg-on-surface/20 transition-colors duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <Download size={18} strokeWidth={1.5} />
          </a>

          <div className="absolute top-3 right-14" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-on-surface/70 hover:text-on-surface hover:bg-on-surface/10"
                >
                  <MoreHorizontal size={16} strokeWidth={1.5} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="bg-surface-highest/80 backdrop-blur-[12px] border-outline-variant/20 text-on-surface text-[13px] shadow-ambient min-w-[160px]"
              >
                <DropdownMenuItem
                  className="gap-2 cursor-pointer focus:bg-surface-high focus:text-on-surface"
                  asChild
                >
                  <a href={a.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink size={14} strokeWidth={1.5} />
                    Abrir original
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 cursor-pointer focus:bg-surface-high focus:text-on-surface">
                  <Copy size={14} strokeWidth={1.5} />
                  Copiar URL
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-outline-variant/20" />
                <DropdownMenuItem className="gap-2 cursor-pointer focus:bg-surface-high text-destructive focus:text-destructive">
                  <Trash2 size={14} strokeWidth={1.5} />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Info */}
      <div>
        <h4 className="text-sm font-semibold text-on-surface mb-1.5 truncate">{title}</h4>

        <div className="flex flex-wrap gap-2 mb-1.5">
          {chips.map((chip, i) => (
            <span key={i} className="flex items-center gap-1 text-[11px] text-on-surface-variant/60">
              <span className="w-1 h-1 bg-brand rounded-full shrink-0" />
              {chip}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between font-mono text-[10px] text-on-surface-muted">
          <span>
            {a.duration_s ? `${a.duration_s}s` : null}
            {a.duration_s && sizeStr ? ' • ' : null}
            {sizeStr}
          </span>
          <span>{formatRelative(a.created_at)}</span>
        </div>
      </div>
    </div>
  )
}
