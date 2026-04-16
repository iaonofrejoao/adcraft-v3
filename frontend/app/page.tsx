'use client'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { MessageList } from '@/components/chat/MessageList'
import { MessageInput } from '@/components/chat/MessageInput'
import { NotificationBell } from '@/components/layout/NotificationBell'
import type { ChatMessage, ToolCallRecord } from '@/lib/types/chat'
import type { PipelinePlan } from '@/lib/jarvis/planner'

export type { ChatMessage, ToolCallRecord }

// ── Hook SSE ──────────────────────────────────────────────────────────────────

function useJarvisChat(conversationId: string | null) {
  const [messages, setMessages]       = useState<ChatMessage[]>([])
  const [streaming, setStreaming]     = useState(false)
  const [pendingPipeline, setPending] = useState<string | null>(null)
  // Rastreia o ID ativo da conversa dentro da sessão (pode ser gerado pelo servidor)
  const [activeConvId, setActiveConvId]       = useState<string | null>(conversationId)
  // Quando true, o próximo disparo do useEffect de histórico é ignorado.
  // Evita sobrescrever mensagens em memória quando conversation_created chega via SSE.
  const skipHistoryLoad                        = useRef(false)
  const idCounter                              = useRef(0)
  // Controle de reconexão SSE
  const isStreamingRef                         = useRef(false)
  const retryCountRef                          = useRef(0)

  // Sincroniza quando o usuário muda de conversa via URL (click na sidebar, cold load)
  useEffect(() => {
    setActiveConvId(conversationId)
  }, [conversationId])

  function nextId() { return String(++idCounter.current) }

  // Carrega histórico da conversa ao montar / mudar conversa
  useEffect(() => {
    if (!activeConvId) return
    if (skipHistoryLoad.current) {
      skipHistoryLoad.current = false
      return
    }
    fetch(`/api/conversations/${activeConvId}`)
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

        // Restaura pendingPipeline se houver plano aguardando aprovação
        const pendingMsg = msgs.find(
          (m) => m.planPreview?.pipeline_status === 'plan_preview',
        )
        if (pendingMsg?.planPreview) {
          setPending(pendingMsg.planPreview.pipeline_id)
        }
      })
      .catch(() => {})
  }, [activeConvId])

  const sendMessage = useCallback(async (text: string) => {
    // Adiciona mensagem do usuário imediatamente
    const userMsg: ChatMessage = { id: nextId(), role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])
    setStreaming(true)
    isStreamingRef.current = true
    retryCountRef.current  = 0

    // Cria placeholder da resposta do assistente
    const assistantId = nextId()
    const assistantMsg: ChatMessage = { id: assistantId, role: 'assistant', content: '' }
    setMessages((prev) => [...prev, assistantMsg])

    async function startStream(convId: string | null): Promise<void> {
      try {
        const body: Record<string, unknown> = {
          message:         text,
          conversation_id: convId ?? undefined,
          force_refresh:   false,
        }
        if (pendingPipeline) body.pending_pipeline_id = pendingPipeline

        const resp = await fetch('/api/chat', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(body),
        })

        if (!resp.ok || !resp.body) {
          throw new Error(`HTTP ${resp.status}`)
        }

        const reader  = resp.body.getReader()
        const decoder = new TextDecoder()
        let   buffer  = ''
        // Guarda convId resolvido pelo servidor (conversation_created event)
        let   resolvedConvId = convId

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
                resolvedConvId = newConvId
                skipHistoryLoad.current = true   // não sobrescrever mensagens em memória
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

              case 'tool_call':
                setMessages((prev) => prev.map((m) => {
                  if (m.id !== assistantId) return m
                  const call: ToolCallRecord = {
                    name:  event.name as string,
                    input: event.input as Record<string, unknown>,
                  }
                  return {
                    ...m,
                    statusMessage: `Usando ${event.name as string}…`,
                    toolCalls: [...(m.toolCalls ?? []), call],
                  }
                }))
                break

              case 'tool_result': {
                const toolName = event.name as string
                setMessages((prev) => prev.map((m) => {
                  if (m.id !== assistantId) return m
                  const calls = (m.toolCalls ?? []).map((c) =>
                    c.name === toolName && c.output === undefined
                      ? { ...c, output: event.output, is_error: event.is_error as boolean | undefined }
                      : c,
                  )
                  return { ...m, toolCalls: calls, statusMessage: 'Pensando…' }
                }))
                break
              }

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
                isStreamingRef.current = false
                setStreaming(false)
                break
            }
          }
        }
        // Usa o convId resolvido para manter coerência (não afeta lógica actual, mas
        // evita que um retry use o ID antigo antes de conversation_created chegar)
        void resolvedConvId
      } catch (err) {
        if (isStreamingRef.current && retryCountRef.current < 3) {
          retryCountRef.current += 1
          console.warn(`[SSE] connection error, retrying (${retryCountRef.current}/3) in 3s…`, err)
          setMessages((prev) => prev.map((m) =>
            m.id === assistantId
              ? { ...m, statusMessage: `Reconectando… (tentativa ${retryCountRef.current}/3)` }
              : m
          ))
          await new Promise((resolve) => setTimeout(resolve, 3000))
          // Passa o convId corrente (pode ter sido actualizado por conversation_created)
          if (isStreamingRef.current) {
            await startStream(activeConvId)
          }
        } else {
          console.error('[SSE] gave up after retries or stream already cancelled', err)
          isStreamingRef.current = false
          setMessages((prev) => prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: 'Conexão perdida. Recarregue a página ou tente novamente.', statusMessage: undefined }
              : m
          ))
          setStreaming(false)
        }
      }
    }

    try {
      await startStream(activeConvId)
    } finally {
      isStreamingRef.current = false
      setStreaming(false)
    }
  }, [activeConvId, pendingPipeline])

  const approvePlan = useCallback((pipelineId: string) => {
    setPending(pipelineId)
    sendMessage('sim, pode executar')
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
            claude-opus-4-6
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
