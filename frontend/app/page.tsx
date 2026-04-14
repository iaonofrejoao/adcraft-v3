'use client'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { MessageList } from '@/components/chat/MessageList'
import { MessageInput } from '@/components/chat/MessageInput'
import { NotificationBell } from '@/components/layout/NotificationBell'
import type { ChatMessage } from '@/lib/types/chat'
import type { PipelinePlan } from '@/lib/jarvis/planner'

export type { ChatMessage }

// ── Hook SSE ──────────────────────────────────────────────────────────────────

function useJarvisChat(conversationId: string | null) {
  const [messages, setMessages]       = useState<ChatMessage[]>([])
  const [streaming, setStreaming]     = useState(false)
  const [pendingPipeline, setPending] = useState<string | null>(null)
  // Rastreia o ID ativo da conversa dentro da sessão (pode ser gerado pelo servidor)
  const [activeConvId, setActiveConvId] = useState<string | null>(conversationId)
  const idCounter = useRef(0)

  // Sincroniza quando o usuário muda de conversa via URL
  useEffect(() => {
    setActiveConvId(conversationId)
  }, [conversationId])

  function nextId() { return String(++idCounter.current) }

  // Carrega histórico da conversa ao montar / mudar conversa
  useEffect(() => {
    if (!conversationId) return
    fetch(`/api/conversations/${conversationId}`)
      .then((r) => r.json())
      .then((d) => {
        const msgs: ChatMessage[] = (d.messages ?? []).map((m: {
          id: string
          role: string
          content: string
          pipeline_id?: string
          pipelines?: {
            plan?: {
              tasks?: unknown[]
              checkpoints?: unknown[]
              mermaid?: string
              estimated_cost_usd?: number
              product_sku?: string
              product_name?: string
            }
            status?: string
            goal?: string
            deliverable_agent?: string
            budget_usd?: number
            product_id?: string
          } | null
        }) => {
          const base: ChatMessage = {
            id:      m.id,
            role:    m.role as 'user' | 'assistant',
            content: m.content,
          }

          if (m.pipeline_id && m.pipelines) {
            const p = m.pipelines
            const plan: PipelinePlan = {
              goal:               p.goal as PipelinePlan['goal'],
              product_id:         p.product_id ?? '',
              deliverable:        p.deliverable_agent as PipelinePlan['deliverable'],
              tasks:              (p.plan?.tasks ?? []) as PipelinePlan['tasks'],
              mermaid:            p.plan?.mermaid ?? '',
              estimated_cost_usd: p.plan?.estimated_cost_usd ?? 0,
              budget_usd:         p.budget_usd ?? 0,
              checkpoints:        (p.plan?.checkpoints ?? []) as PipelinePlan['checkpoints'],
              product_sku:        p.plan?.product_sku,
              product_name:       p.plan?.product_name,
            }
            return {
              ...base,
              planPreview: {
                plan,
                pipeline_id:     m.pipeline_id,
                pipeline_status: p.status,
              },
            }
          }

          return base
        })
        setMessages(msgs)
      })
      .catch(() => {})
  }, [conversationId])

  const sendMessage = useCallback(async (text: string) => {
    // Adiciona mensagem do usuário imediatamente
    const userMsg: ChatMessage = { id: nextId(), role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])
    setStreaming(true)

    // Cria placeholder da resposta do assistente
    const assistantId = nextId()
    const assistantMsg: ChatMessage = { id: assistantId, role: 'assistant', content: '' }
    setMessages((prev) => [...prev, assistantMsg])

    try {
      const body: Record<string, unknown> = {
        message:         text,
        conversation_id: activeConvId ?? undefined,
        force_refresh:   false,
      }
      if (pendingPipeline) body.pending_pipeline_id = pendingPipeline

      const resp = await fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })

      if (!resp.ok || !resp.body) {
        setMessages((prev) => prev.map((m) =>
          m.id === assistantId ? { ...m, content: 'Erro ao conectar ao Jarvis.' } : m
        ))
        return
      }

      const reader  = resp.body.getReader()
      const decoder = new TextDecoder()
      let   buffer  = ''

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (!raw) continue
          let event: Record<string, unknown>
          try { event = JSON.parse(raw) } catch { continue }

          switch (event.type) {
            case 'conversation_created': {
              const newConvId = event.conversation_id as string
              setActiveConvId(newConvId)
              const url = new URL(window.location.href)
              url.searchParams.set('conv', newConvId)
              window.history.replaceState({}, '', url.toString())
              break
            }

            case 'status':
              setMessages((prev) => prev.map((m) =>
                m.id === assistantId ? { ...m, statusMessage: event.message as string } : m
              ))
              break

            case 'message':
              setMessages((prev) => prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content + (event.content as string), statusMessage: undefined }
                  : m
              ))
              break

            case 'plan_preview':
              setPending(event.pipeline_id as string)
              setMessages((prev) => prev.map((m) =>
                m.id === assistantId
                  ? { ...m, planPreview: { plan: event.plan as PipelinePlan, pipeline_id: event.pipeline_id as string } }
                  : m
              ))
              break

            case 'pipeline_created':
              setPending(null)
              break

            case 'pipeline_status':
              setMessages((prev) => prev.map((m) =>
                m.id === assistantId
                  ? { ...m, pipelineStatus: event.pipeline as Record<string, unknown> }
                  : m
              ))
              break

            case 'error':
              setMessages((prev) => prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: `Erro: ${event.error}`, statusMessage: undefined }
                  : m
              ))
              break

            case 'done':
              setStreaming(false)
              break
          }
        }
      }
    } catch (err) {
      setMessages((prev) => prev.map((m) =>
        m.id === assistantId ? { ...m, content: 'Falha na conexão com o Jarvis.' } : m
      ))
    } finally {
      setStreaming(false)
    }
  }, [activeConvId, pendingPipeline])

  const approvePlan = useCallback((pipelineId: string) => {
    sendMessage('sim, pode executar')
    setPending(pipelineId)
  }, [sendMessage])

  return { messages, streaming, sendMessage, approvePlan }
}

// ── Página ─────────────────────────────────────────────────────────────────────

function ChatPageInner() {
  const searchParams   = useSearchParams()
  const conversationId = searchParams.get('conv')

  const { messages, streaming, sendMessage, approvePlan } = useJarvisChat(conversationId)

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2.5 shrink-0 bg-surface-low">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold text-on-surface">Jarvis</h1>
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-brand-muted text-brand">
            gemini-2.5-flash
          </span>
        </div>
        <NotificationBell />
      </header>

      {/* Mensagens */}
      <MessageList
        messages={messages}
        isStreaming={streaming}
        onApprovePlan={approvePlan}
      />

      {/* Input */}
      <MessageInput onSend={sendMessage} disabled={streaming} />
    </div>
  )
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex flex-col h-full" />}>
      <ChatPageInner />
    </Suspense>
  )
}
