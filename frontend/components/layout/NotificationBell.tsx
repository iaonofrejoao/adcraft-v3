'use client'
import { useState } from 'react'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useNotifications } from '@/hooks/useNotifications'
import { cn } from '@/lib/utils'

export function NotificationBell() {
  const { notifications, unreadCount, markAllAsRead } = useNotifications()
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificações"
        className={cn(
          'relative w-8 h-8 text-on-surface-variant hover:text-on-surface hover:bg-surface-high transition-colors duration-150',
          open && 'bg-brand-muted text-brand'
        )}
      >
        <Bell className="w-4 h-4" strokeWidth={1.5} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 flex items-center justify-center rounded-full bg-destructive text-on-surface text-[10px] font-bold leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-10 w-80 rounded-xl z-50 overflow-hidden
          bg-surface-highest/80 backdrop-blur-[12px]
          border border-outline-variant/20 shadow-ambient">

          <div className="flex items-center justify-between px-4 py-2.5 bg-surface-highest">
            <span className="text-sm font-medium text-on-surface">Notificações</span>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="h-auto px-0 py-0 text-xs text-brand hover:text-brand/80 hover:bg-transparent"
              >
                Marcar todas como lidas
              </Button>
            )}
          </div>

          <ScrollArea className="max-h-72">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-sm text-center text-on-surface-muted">
                Nenhuma notificação
              </p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    'px-4 py-3 hover:bg-surface-high transition-colors duration-150',
                    !n.read ? 'opacity-100' : 'opacity-60'
                  )}
                >
                  <p className="text-sm text-on-surface">{n.message}</p>
                  <p className="text-xs mt-0.5 text-on-surface-muted font-mono">
                    {new Date(n.created_at).toLocaleString('pt-BR')}
                  </p>
                </div>
              ))
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  )
}
