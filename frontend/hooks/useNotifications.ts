'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface Notification {
  id: string
  message: string
  read: boolean
  created_at: string
}

export interface UseNotificationsReturn {
  notifications: Notification[]
  unreadCount: number
  markAllAsRead: () => void
}

export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'knowledge_notifications' },
        (payload) => {
          try {
            const row = payload.new as Notification
            setNotifications((prev) => [{ ...row, read: false }, ...prev].slice(0, 50))
          } catch (err) {
            console.error('[useNotifications] realtime payload error', err)
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [])

  const unreadCount = notifications.filter((n) => !n.read).length

  return { notifications, unreadCount, markAllAsRead }
}
