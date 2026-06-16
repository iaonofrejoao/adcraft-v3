'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Package, Film, Brain, Library, MonitorPlay, ChevronLeft, LayoutDashboard } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { AdCraftLogoMark } from '@/components/layout/AdCraftLogo'

interface NavItem { href: string; label: string; Icon: LucideIcon }

const NAV: NavItem[] = [
  { href: '/dashboard',   label: 'Dashboard',          Icon: LayoutDashboard },
  { href: '/products',    label: 'Produtos',           Icon: Package         },
  { href: '/creatives',   label: 'Criativos',          Icon: Film            },
  { href: '/biblioteca',  label: 'Vídeos Tiktok',      Icon: Library         },
  { href: '/anuncios-fb', label: 'Anúncios Facebook',  Icon: MonitorPlay     },
  { href: '/insights',    label: 'Memória',            Icon: Brain           },
]

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside className={cn(
      'flex h-screen flex-col shrink-0 bg-surface-low overflow-hidden',
      'transition-[width] duration-200 ease-in-out',
      collapsed ? 'w-14' : 'w-56',
    )}>

      {/* Header: logo + toggle */}
      <div className="flex items-center justify-between px-3 py-4 min-w-0">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 min-w-0 shrink-0 rounded hover:opacity-80 transition-opacity duration-150"
          aria-label="Ir para o Dashboard"
        >
          <AdCraftLogoMark size={22} className="shrink-0" />
          <span className={cn(
            'text-sm font-semibold text-on-surface whitespace-nowrap overflow-hidden',
            'transition-[max-width,opacity] duration-150 ease-in-out',
            collapsed ? 'max-w-0 opacity-0' : 'max-w-[120px] opacity-100 delay-100',
          )}>
            AdCraft <span className="text-xs font-normal text-on-surface-muted">v3</span>
          </span>
        </Link>

        <button
          onClick={() => setCollapsed(c => !c)}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          className="shrink-0 p-1.5 rounded text-on-surface-muted hover:text-on-surface hover:bg-surface-high transition-colors duration-150"
        >
          <ChevronLeft
            size={16}
            strokeWidth={1.5}
            className={cn(
              'transition-transform duration-200 ease-in-out',
              collapsed && 'rotate-180',
            )}
          />
        </button>
      </div>

      <div className="h-px bg-outline-variant/15 shrink-0" />

      {/* Nav principal — árvore estável, tooltip só ativo quando recolhido */}
      <nav className="px-2 pt-3 pb-1 space-y-0.5">
        {NAV.map(({ href, label, Icon }) => {
          const active = pathname.startsWith(href)

          return (
            <Tooltip key={href} delayDuration={0}>
              <TooltipTrigger asChild>
                <Link
                  href={href}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-colors duration-150',
                    active
                      ? cn('bg-brand/10 text-brand', !collapsed && 'border-l-2 border-brand')
                      : 'text-on-surface-variant hover:bg-surface-high',
                  )}
                >
                  <Icon size={16} strokeWidth={1.5} className="shrink-0" />
                  <span className={cn(
                    'whitespace-nowrap overflow-hidden',
                    'transition-[max-width,opacity] duration-150 ease-in-out',
                    collapsed ? 'max-w-0 opacity-0' : 'max-w-[160px] opacity-100 delay-100',
                  )}>
                    {label}
                  </span>
                </Link>
              </TooltipTrigger>
              {collapsed && <TooltipContent side="right">{label}</TooltipContent>}
            </Tooltip>
          )
        })}
      </nav>
    </aside>
  )
}
