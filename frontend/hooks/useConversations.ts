'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export interface Conversation {
  id: string
  title: string
  updated_at: string
}

export interface UseConversationsReturn {
  conversations: Conversation[]
  isLoading: boolean
  createConversation: () => Promise<void>
  isCreating: boolean
}

export function useConversations(
  currentConversationId?: string,
): UseConversationsReturn {
  const router = useRouter()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/conversations?limit=20')
      const data = await res.json()
      const raw: Array<{ id: string; title: string; last_message_at: string | null; created_at: string }> =
        data.conversations ?? []
      setConversations(
        raw.map((c) => ({
          id: c.id,
          title: c.title,
          updated_at: c.last_message_at ?? c.created_at,
        })),
      )
    } catch (err) {
      console.error('[useConversations] fetch failed', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  const createConversation = useCallback(async () => {
    setIsCreating(true)
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Nova conversa' }),
      })
      if (res.ok) {
        const conv = await res.json()
        await fetchConversations()
        router.push(`/?conv=${conv.id}`)
      }
    } catch (err) {
      console.error('[useConversations] create failed', err)
    } finally {
      setIsCreating(false)
    }
  }, [fetchConversations, router])

  return { conversations, isLoading, createConversation, isCreating }
}
