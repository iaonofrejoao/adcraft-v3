'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ClipboardList, Package, Film, Brain } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem { href: string; label: string; Icon: LucideIcon }

const NAV: NavItem[] = [
  { href: '/demandas',  label: 'Demandas',  Icon: ClipboardList },
  { href: '/products',  label: 'Produtos',  Icon: Package       },
  { href: '/creatives', label: 'Criativos', Icon: Film          },
  { href: '/insights',  label: 'Memória',   Icon: Brain         },
]

export function Sidebar() {
  const pathname = usePathname()

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
        {NAV.map(({ href, label, Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-colors duration-150',
                active
                  ? 'bg-brand/10 text-brand border-l-2 border-brand'
                  : 'text-on-surface-variant hover:bg-surface-high',
              )}
            >
              <Icon size={16} strokeWidth={1.5} />
              {label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
