'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Notification {
  id: string
  type: string
  message: string
  pipeline_id?: string
  created_at: string
  read: boolean
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)

  const unread = notifications.filter((n) => !n.read).length

  // Subscrição Realtime em knowledge_notifications
  useEffect(() => {
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'knowledge_notifications' },
        (payload) => {
          const row = payload.new as Notification
          setNotifications((prev) => [{ ...row, read: false }, ...prev].slice(0, 50))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:opacity-70"
        style={{ background: open ? 'var(--brand-subtle)' : 'transparent' }}
        aria-label="Notificações"
      >
        <span className="text-base">🔔</span>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 flex items-center justify-center rounded-full text-white text-xs font-bold"
            style={{ background: 'var(--status-error)', fontSize: '10px' }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 rounded-xl shadow-lg border z-50 overflow-hidden"
          style={{ background: 'var(--surface-card)', borderColor: 'var(--border-default)' }}>
          <div className="flex items-center justify-between px-4 py-2.5 border-b"
            style={{ borderColor: 'var(--border-default)' }}>
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              Notificações
            </span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs hover:underline"
                style={{ color: 'var(--brand-primary)' }}>
                Marcar todas como lidas
              </button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-sm text-center" style={{ color: 'var(--text-muted)' }}>
                Nenhuma notificação
              </p>
            ) : (
              notifications.map((n) => (
                <div key={n.id}
                  className={`px-4 py-3 border-b ${!n.read ? 'opacity-100' : 'opacity-60'}`}
                  style={{ borderColor: 'var(--border-default)' }}>
                  <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{n.message}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {new Date(n.created_at).toLocaleString('pt-BR')}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
