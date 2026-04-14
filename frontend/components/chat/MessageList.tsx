'use client'
import { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import type { ChatMessage } from '@/lib/types/chat'
import { ScrollArea } from '@/components/ui/scroll-area'
import { PlanPreviewCard } from './PlanPreviewCard'
import { MermaidBlock } from './MermaidBlock'
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
        <div className="text-sm text-on-surface leading-relaxed">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={markdownComponents}
          >
            {msg.content}
          </ReactMarkdown>
        </div>
      )}
      {msg.planPreview && (
        <PlanPreviewCard
          plan={msg.planPreview.plan}
          pipelineId={msg.planPreview.pipeline_id}
          pipelineStatus={msg.planPreview.pipeline_status}
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

const markdownComponents: Components = {
  // Fenced code blocks — mermaid gets its own renderer
  code({ className, children, ...props }) {
    const match   = /language-(\w+)/.exec(className ?? '')
    const lang    = match?.[1]
    const codeText = String(children).replace(/\n$/, '')
    const isBlock  = codeText.includes('\n') || lang !== undefined

    if (isBlock && lang === 'mermaid') {
      return <MermaidBlock chart={codeText} />
    }

    if (isBlock) {
      return (
        <pre className="my-3 p-3 rounded-lg bg-surface overflow-x-auto">
          <code className="text-xs font-mono text-on-surface-variant" {...props}>
            {codeText}
          </code>
        </pre>
      )
    }

    return (
      <code
        className="font-mono text-[0.6875rem] px-1.5 py-0.5 rounded bg-surface-low text-brand"
        {...props}
      >
        {children}
      </code>
    )
  },

  // Headings
  h1: ({ children }) => <h1 className="text-base font-semibold text-on-surface mt-4 mb-2">{children}</h1>,
  h2: ({ children }) => <h2 className="text-sm font-semibold text-on-surface mt-3 mb-1.5">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-medium text-on-surface mt-3 mb-1">{children}</h3>,

  // Paragraph
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,

  // Lists
  ul: ({ children }) => <ul className="mb-2 pl-5 list-disc space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 pl-5 list-decimal space-y-0.5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,

  // Inline
  strong: ({ children }) => <strong className="font-semibold text-on-surface">{children}</strong>,
  em:     ({ children }) => <em className="italic">{children}</em>,
  a:      ({ href, children }) => (
    <a href={href} className="text-brand underline underline-offset-2 hover:text-brand/80" target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),

  // Blockquote
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-brand/40 pl-3 text-on-surface-muted italic">
      {children}
    </blockquote>
  ),

  // Horizontal rule
  hr: () => <hr className="my-3 border-outline-variant/20" />,
}
