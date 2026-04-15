'use client'
import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useConversations } from '@/hooks/useConversations'
import { ScrollArea } from '@/components/ui/scroll-area'

const NAV = [
  { href: '/',          label: 'Chat',      icon: '💬' },
  { href: '/products',  label: 'Produtos',  icon: '📦' },
  { href: '/creatives', label: 'Criativos', icon: '🎬' },
  { href: '/demandas',  label: 'Demandas',  icon: '📋' },
]

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  if (mins < 60)  return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

export function Sidebar() {
  const pathname = usePathname()
  const {
    conversations,
    hasMore,
    isLoadingMore,
    loadMore,
    createConversation,
  } = useConversations()

  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMore()
        }
      },
      { threshold: 0.1 },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, isLoadingMore, loadMore])

  return (
    <aside className="flex h-screen flex-col w-56 shrink-0 bg-surface-low">

      {/* Logo */}
      <div className="px-4 py-4">
        <span className="text-lg font-semibold text-brand">
          AdCraft <span className="text-xs font-normal text-on-surface-muted">v2</span>
        </span>
      </div>
      <div className="h-px bg-outline-variant/15" />

      {/* Nav principal */}
      <nav className="px-2 pt-3 pb-1 space-y-0.5">
        {NAV.map(({ href, label, icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-colors duration-150 ${
                active
                  ? 'bg-brand/10 text-brand border-l-2 border-brand'
                  : 'text-on-surface-variant hover:bg-surface-high'
              }`}
            >
              <span className="text-base">{icon}</span>
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="h-px bg-outline-variant/15 my-2" />

      {/* Histórico de conversas */}
      <div className="px-4 pb-1.5 flex items-center justify-between">
        <span className="text-[0.6875rem] font-medium uppercase tracking-[0.05em] text-on-surface-muted">
          Conversas
        </span>
        <button
          onClick={createConversation}
          className="w-5 h-5 flex items-center justify-center rounded text-xs font-bold bg-brand/15 text-brand hover:bg-brand/25 transition-colors duration-150"
          title="Nova conversa"
        >
          +
        </button>
      </div>

      <ScrollArea className="flex-1 h-0">
        <div className="px-2 pb-4 pt-1 space-y-0.5">
          {conversations.length === 0 ? (
            <p className="px-3 py-2 text-[0.6875rem] text-on-surface-muted">
              Nenhuma conversa ainda
            </p>
          ) : (
            <>
              {conversations.map((conv) => {
                const active = pathname === '/' && typeof window !== 'undefined' &&
                  new URLSearchParams(window.location.search).get('conv') === conv.id
                return (
                  <Link
                    key={conv.id}
                    href={`/?conv=${conv.id}`}
                    className={`block px-3 py-2 rounded transition-colors duration-150 ${
                      active
                        ? 'bg-surface-high text-on-surface'
                        : 'text-on-surface-variant hover:bg-surface-high'
                    }`}
                  >
                    <span className="block truncate text-sm text-on-surface">{conv.title}</span>
                    <span className="text-[0.6875rem] font-mono text-on-surface-muted">
                      {timeAgo(conv.updated_at)}
                    </span>
                  </Link>
                )
              })}

              {/* Sentinel: IntersectionObserver aciona loadMore quando visível */}
              <div ref={sentinelRef} className="h-1" />

              {isLoadingMore && (
                <div className="px-3 py-2 space-y-1.5">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-8 rounded bg-surface-high animate-pulse" />
                  ))}
                </div>
              )}

              {!hasMore && (
                <p className="px-3 py-2 text-center text-[0.625rem] text-on-surface-muted">
                  Você viu todas as conversas
                </p>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </aside>
  )
}
