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
  total: number
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  loadMore: () => Promise<void>
  createConversation: () => Promise<void>
  isCreating: boolean
}

const PAGE_SIZE = 30

function mapConversation(c: {
  id: string
  title: string
  last_message_at: string | null
  created_at: string
}): Conversation {
  return {
    id: c.id,
    title: c.title,
    updated_at: c.last_message_at ?? c.created_at,
  }
}

export function useConversations(
  currentConversationId?: string,
): UseConversationsReturn {
  const router = useRouter()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  const hasMore = conversations.length < total

  const loadInitial = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/conversations?limit=${PAGE_SIZE}&offset=0`)
      const data = await res.json()
      const raw: Array<{ id: string; title: string; last_message_at: string | null; created_at: string }> =
        data.conversations ?? []
      setConversations(raw.map(mapConversation))
      setTotal(data.total ?? raw.length)
    } catch (err) {
      console.error('[useConversations] loadInitial failed', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadMore = useCallback(async () => {
    if (isLoadingMore) return
    setIsLoadingMore(true)
    try {
      const res = await fetch(
        `/api/conversations?limit=${PAGE_SIZE}&offset=${conversations.length}`,
      )
      const data = await res.json()
      const raw: Array<{ id: string; title: string; last_message_at: string | null; created_at: string }> =
        data.conversations ?? []
      setConversations((prev) => [...prev, ...raw.map(mapConversation)])
      setTotal(data.total ?? 0)
    } catch (err) {
      console.error('[useConversations] loadMore failed', err)
    } finally {
      setIsLoadingMore(false)
    }
  }, [conversations.length, isLoadingMore])

  useEffect(() => {
    loadInitial()
  }, [loadInitial])

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
        await loadInitial()
        router.push(`/?conv=${conv.id}`)
      }
    } catch (err) {
      console.error('[useConversations] create failed', err)
    } finally {
      setIsCreating(false)
    }
  }, [loadInitial, router])

  return {
    conversations,
    total,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    createConversation,
    isCreating,
  }
}
