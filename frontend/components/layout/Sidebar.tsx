'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useConversations } from '@/hooks/useConversations'

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
  const { conversations, createConversation } = useConversations()

  return (
    <aside className="flex flex-col w-56 shrink-0 bg-[#1C1B1C] overflow-y-auto">

      {/* Logo */}
      <div className="px-4 py-4">
        <span className="text-lg font-semibold text-[#F28705]">
          AdCraft <span className="text-xs font-normal text-[#6B6460]">v2</span>
        </span>
      </div>
      <div className="h-px bg-[#584237]/15" />

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
                  ? 'bg-[#F28705]/10 text-[#F28705] border-l-2 border-[#F28705]'
                  : 'text-[#9E9489] hover:bg-[#2A2829]'
              }`}
            >
              <span className="text-base">{icon}</span>
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="h-px bg-[#584237]/15 my-2" />

      {/* Histórico de conversas */}
      <div className="px-4 pb-1.5 flex items-center justify-between">
        <span className="text-[0.6875rem] font-medium uppercase tracking-[0.05em] text-[#6B6460]">
          Conversas
        </span>
        <button
          onClick={createConversation}
          className="w-5 h-5 flex items-center justify-center rounded text-xs font-bold bg-[#F28705]/15 text-[#F28705] hover:bg-[#F28705]/25 transition-colors duration-150"
          title="Nova conversa"
        >
          +
        </button>
      </div>

      <div className="flex-1 px-2 pb-4 pt-1 space-y-0.5 overflow-y-auto">
        {conversations.length === 0 ? (
          <p className="px-3 py-2 text-[0.6875rem] text-[#6B6460]">
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
                className={`block px-3 py-2 rounded transition-colors duration-150 ${
                  active
                    ? 'bg-[#2A2829] text-[#E8E3DD]'
                    : 'text-[#9E9489] hover:bg-[#2A2829]'
                }`}
              >
                <span className="block truncate text-sm text-[#E8E3DD]">{conv.title}</span>
                <span className="text-[0.6875rem] font-mono text-[#6B6460]">
                  {timeAgo(conv.updated_at)}
                </span>
              </Link>
            )
          })
        )}
      </div>
    </aside>
  )
}
