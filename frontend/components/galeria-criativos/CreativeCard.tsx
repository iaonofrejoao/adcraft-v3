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

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  const h    = Math.floor(mins / 60)
  const d    = Math.floor(h / 24)
  if (d >= 7)  return `${Math.floor(d / 7)}sem`
  if (d > 0)   return `há ${d}d`
  if (h > 0)   return `há ${h}h`
  if (mins > 0) return `há ${mins}m`
  return 'agora'
}

function formatSize(bytes?: number): string | null {
  if (!bytes) return null
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Converte tag em chips de metadata (últimos 3 segmentos após vN_) */
function tagChips(tag: string): string[] {
  const parts = tag.split('_')
  return parts.length >= 3 ? parts.slice(1, 4) : parts
}

// ── Componente ────────────────────────────────────────────────────────────────

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
      {/* ── Thumbnail ────────────────────────────────────────────── */}
      <div className="relative aspect-[9/16] bg-[#0D0D0E] rounded-xl overflow-hidden mb-3 border border-[#584237]/10">
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
            <Copy size={32} strokeWidth={1} className="text-[#9E9489]" />
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#131314]/90 via-[#131314]/40 to-[#131314]/10 pointer-events-none" />

        {/* ID badge — top-left */}
        <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded font-mono text-[10px] text-[#F28705] border border-[#F28705]/20">
          {a.tag}
        </div>

        {/* Asset type badge — top-right */}
        <div className="absolute top-3 right-3 px-2 py-1 bg-black/40 backdrop-blur-md rounded font-mono text-[10px] text-[#9E9489] uppercase">
          {a.asset_type}
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/40">
          {/* Play button */}
          <Button
            size="icon"
            className="w-16 h-16 rounded-full bg-[#F28705]/90 hover:bg-[#F28705] text-[#131314] shadow-xl border-0"
          >
            <Play size={28} strokeWidth={1.5} className="ml-1" />
          </Button>

          {/* Download button — bottom-right */}
          <a
            href={a.url}
            download={`${a.tag}.${isVideo ? 'mp4' : 'jpg'}`}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-4 right-4 p-2 bg-white/10 backdrop-blur-md rounded-lg text-white hover:bg-white/20 transition-colors duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <Download size={18} strokeWidth={1.5} />
          </a>

          {/* More actions — top-right of overlay (above badge area) */}
          <div className="absolute top-3 right-14" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
                >
                  <MoreHorizontal size={16} strokeWidth={1.5} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className={cn(
                  'bg-[#353436]/80 backdrop-blur-[12px]',
                  'border-[#584237]/20 text-[#E8E3DD] text-[13px]',
                  'shadow-[0_12px_40px_-10px_rgba(0,0,0,0.5),0_0_20px_rgba(249,115,22,0.05)]',
                  'min-w-[160px]',
                )}
              >
                <DropdownMenuItem
                  className="gap-2 cursor-pointer focus:bg-[#2A2829] focus:text-[#E8E3DD]"
                  asChild
                >
                  <a href={a.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink size={14} strokeWidth={1.5} />
                    Abrir original
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 cursor-pointer focus:bg-[#2A2829] focus:text-[#E8E3DD]">
                  <Copy size={14} strokeWidth={1.5} />
                  Copiar URL
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-[#584237]/20" />
                <DropdownMenuItem className="gap-2 cursor-pointer focus:bg-[#2A2829] text-[#F87171] focus:text-[#F87171]">
                  <Trash2 size={14} strokeWidth={1.5} />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* ── Info ─────────────────────────────────────────────────── */}
      <div>
        <h4 className="text-[14px] font-semibold text-[#E8E3DD] mb-1.5 truncate">{title}</h4>

        {/* Metadata chips */}
        <div className="flex flex-wrap gap-2 mb-1.5">
          {chips.map((chip, i) => (
            <span key={i} className="flex items-center gap-1 text-[11px] text-[#9E9489]/60">
              <span className="w-1 h-1 bg-[#F28705] rounded-full shrink-0" />
              {chip}
            </span>
          ))}
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between font-mono text-[10px] text-[#6B6460]">
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
