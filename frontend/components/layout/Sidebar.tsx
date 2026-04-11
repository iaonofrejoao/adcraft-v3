'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface Conversation {
  id: string
  title: string
  last_message_at: string | null
  created_at: string
}

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
  const [conversations, setConversations] = useState<Conversation[]>([])

  useEffect(() => {
    fetch('/api/conversations?limit=20')
      .then((r) => r.json())
      .then((d) => setConversations(d.conversations ?? []))
      .catch(() => {})
  }, [])

  async function newConversation() {
    const res = await fetch('/api/conversations', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ title: 'Nova conversa' }),
    })
    if (res.ok) {
      const conv = await res.json()
      setConversations((prev) => [conv, ...prev])
      // Navegar para a nova conversa (pela query string)
      window.location.href = `/?conv=${conv.id}`
    }
  }

  return (
    <aside className="flex flex-col w-56 shrink-0 border-r overflow-y-auto"
      style={{ background: 'var(--surface-sidebar)', borderColor: 'var(--border-default)' }}>

      {/* Logo */}
      <div className="px-4 py-4 border-b" style={{ borderColor: 'var(--border-default)' }}>
        <span className="text-base font-semibold" style={{ color: 'var(--brand-primary)' }}>
          AdCraft <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>v2</span>
        </span>
      </div>

      {/* Nav principal */}
      <nav className="px-2 pt-3 pb-1 space-y-0.5">
        {NAV.map(({ href, label, icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? 'font-medium'
                  : 'hover:opacity-80'
              }`}
              style={active
                ? { background: 'var(--brand-subtle)', color: 'var(--brand-primary)' }
                : { color: 'var(--text-secondary)' }}
            >
              <span className="text-base">{icon}</span>
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Divisor + histórico de conversas */}
      <div className="px-4 pt-4 pb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Conversas
        </span>
        <button
          onClick={newConversation}
          className="w-5 h-5 flex items-center justify-center rounded text-xs font-bold transition-colors hover:opacity-70"
          style={{ background: 'var(--brand-subtle)', color: 'var(--brand-primary)' }}
          title="Nova conversa"
        >
          +
        </button>
      </div>

      <div className="flex-1 px-2 pb-4 space-y-0.5 overflow-y-auto">
        {conversations.length === 0 ? (
          <p className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            Nenhuma conversa ainda
          </p>
        ) : (
          conversations.map((conv) => {
            const active = pathname === '/' && typeof window !== 'undefined' &&
              new URLSearchParams(window.location.search).get('conv') === conv.id
            return (
              <Link
                key={conv.id}
                href={`/?conv=${conv.id}`}
                className={`block px-3 py-2 rounded-lg text-xs transition-colors ${
                  active ? 'font-medium' : 'hover:opacity-80'
                }`}
                style={active
                  ? { background: 'var(--brand-subtle)', color: 'var(--brand-primary)' }
                  : { color: 'var(--text-secondary)' }}
              >
                <span className="block truncate">{conv.title}</span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {timeAgo(conv.last_message_at ?? conv.created_at)}
                </span>
              </Link>
            )
          })
        )}
      </div>
    </aside>
  )
}
