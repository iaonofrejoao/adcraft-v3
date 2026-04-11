'use client'
import { useEffect, useRef } from 'react'
import type { ChatMessage } from '@/lib/types/chat'
import { PlanPreviewCard } from './PlanPreviewCard'

interface MessageListProps {
  messages: ChatMessage[]
  isStreaming: boolean
  onApprovePlan: (pipelineId: string) => void
}

export function MessageList({ messages, isStreaming, onApprovePlan }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isStreaming])

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4">
        <p className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          Olá, sou o Jarvis 👋
        </p>
        <p className="text-sm text-center max-w-sm" style={{ color: 'var(--text-secondary)' }}>
          Diga o que precisa. Use <code className="font-mono text-xs px-1 py-0.5 rounded"
            style={{ background: 'var(--brand-subtle)', color: 'var(--brand-primary)' }}>@produto</code>{' '}
          para mencionar um produto e{' '}
          <code className="font-mono text-xs px-1 py-0.5 rounded"
            style={{ background: 'var(--brand-subtle)', color: 'var(--brand-primary)' }}>/ação</code>{' '}
          para definir o que fazer.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} msg={msg} onApprovePlan={onApprovePlan} />
      ))}

      {isStreaming && (
        <div className="flex gap-2">
          <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs"
            style={{ background: 'var(--brand-primary)', color: '#fff' }}>J</div>
          <div className="px-3 py-2 rounded-xl rounded-tl-none text-sm"
            style={{ background: 'var(--surface-card)', border: '1px solid var(--border-default)', color: 'var(--text-muted)' }}>
            <span className="animate-pulse">…</span>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}

function MessageBubble({ msg, onApprovePlan }: { msg: ChatMessage; onApprovePlan: (id: string) => void }) {
  const isUser = msg.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tr-none text-sm whitespace-pre-wrap"
          style={{ background: 'var(--brand-primary)', color: '#fff' }}>
          {msg.content}
        </div>
      </div>
    )
  }

  // Mensagem do assistente
  return (
    <div className="flex gap-2 items-start max-w-[90%]">
      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold mt-0.5"
        style={{ background: 'var(--brand-primary)', color: '#fff' }}>J</div>
      <div className="flex flex-col gap-2 flex-1 min-w-0">
        {msg.content && (
          <div className="px-3 py-2 rounded-xl rounded-tl-none text-sm whitespace-pre-wrap"
            style={{ background: 'var(--surface-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}>
            {renderMarkdown(msg.content)}
          </div>
        )}
        {msg.planPreview && (
          <PlanPreviewCard
            plan={msg.planPreview.plan}
            pipelineId={msg.planPreview.pipeline_id}
            onApprove={onApprovePlan}
          />
        )}
        {msg.pipelineStatus && (
          <PipelineStatusCard pipeline={msg.pipelineStatus} />
        )}
        {msg.statusMessage && (
          <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>
            {msg.statusMessage}
          </p>
        )}
      </div>
    </div>
  )
}

function PipelineStatusCard({ pipeline }: { pipeline: Record<string, unknown> }) {
  const status  = pipeline.status as string
  const goal    = pipeline.goal as string
  const cost    = parseFloat((pipeline.cost_so_far_usd as string) ?? '0')
  const budget  = parseFloat((pipeline.budget_usd as string) ?? '0')
  const progress = (pipeline as { progress_pct?: number }).progress_pct ?? 0

  return (
    <div className="rounded-xl border p-3 text-sm"
      style={{ background: 'var(--surface-card)', borderColor: 'var(--border-default)' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>Pipeline: {goal}</span>
        <span className="text-xs px-2 py-0.5 rounded-full"
          style={{ background: 'var(--brand-subtle)', color: 'var(--brand-primary)' }}>{status}</span>
      </div>
      <div className="w-full h-1.5 rounded-full overflow-hidden mb-1"
        style={{ background: 'var(--border-default)' }}>
        <div className="h-full rounded-full transition-all"
          style={{ width: `${progress}%`, background: 'var(--brand-primary)' }} />
      </div>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {progress}% · ${cost.toFixed(4)} / ${budget.toFixed(2)}
      </p>
    </div>
  )
}

// Renderização simplificada de markdown (bold e code)
function renderMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="font-mono text-xs px-1 py-0.5 rounded"
          style={{ background: 'var(--brand-subtle)', color: 'var(--brand-primary)' }}>
          {part.slice(1, -1)}
        </code>
      )
    }
    return part
  })
}
