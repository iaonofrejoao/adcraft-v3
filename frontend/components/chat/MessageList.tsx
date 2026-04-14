'use client'
import { useEffect, useRef } from 'react'
import type { ChatMessage } from '@/lib/types/chat'
import { ScrollArea } from '@/components/ui/scroll-area'
import { PlanPreviewCard } from './PlanPreviewCard'
import {
  TypingIndicator,
  JarvisMessageWrapper,
  PipelineStatusCard,
  ChatEmptyState,
} from '@/components/chat-jarvis'

interface MessageListProps {
  messages:      ChatMessage[]
  isStreaming:   boolean
  onApprovePlan: (pipelineId: string) => void
}

export function MessageList({ messages, isStreaming, onApprovePlan }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isStreaming])

  if (messages.length === 0) {
    return <ChatEmptyState />
  }

  return (
    <ScrollArea className="flex-1 min-h-0 w-full">
      <div className="max-w-[800px] mx-auto px-16 py-8 space-y-8 w-full">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} onApprovePlan={onApprovePlan} />
        ))}

        {isStreaming && <TypingIndicator />}

        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  )
}

function MessageBubble({
  msg,
  onApprovePlan,
}: {
  msg: ChatMessage
  onApprovePlan: (id: string) => void
}) {
  if (msg.role === 'user') {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <div className="bg-surface-low rounded-2xl rounded-tr-none px-5 py-3
          max-w-[85%] text-sm text-on-surface leading-relaxed whitespace-pre-wrap shadow-sm">
          {msg.content}
        </div>
        {/* Timestamp placeholder — no logic change, just visual polish */}
      </div>
    )
  }

  // Assistant message
  return (
    <JarvisMessageWrapper>
      {msg.content && (
        <div className="text-sm text-on-surface leading-relaxed whitespace-pre-wrap">
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
        <p className="text-xs italic text-on-surface-muted">
          {msg.statusMessage}
        </p>
      )}
    </JarvisMessageWrapper>
  )
}

// Simplified markdown (bold + inline code) — logic preserved from original
function renderMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="text-on-surface font-semibold">
          {part.slice(2, -2)}
        </strong>
      )
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="font-mono text-[0.6875rem] px-1.5 py-0.5 rounded bg-surface-low text-brand">
          {part.slice(1, -1)}
        </code>
      )
    }
    return part
  })
}
