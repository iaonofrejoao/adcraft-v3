'use client'
import { Bot } from 'lucide-react'

export function ChatEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-6 text-center px-6">
      <div className="w-14 h-14 rounded-2xl bg-agent-research/10 border border-agent-research/20
        flex items-center justify-center">
        <Bot size={24} strokeWidth={1.5} className="text-agent-research" />
      </div>
      <div className="space-y-3">
        <p className="text-[1.5rem] font-semibold tracking-[-0.01em] text-on-surface">
          Olá, sou o Jarvis 👋
        </p>
        <p className="text-sm text-on-surface-variant max-w-sm leading-relaxed">
          Diga o que precisa. Use{' '}
          <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-brand-muted text-brand">
            @produto
          </code>{' '}
          para mencionar um produto e{' '}
          <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-brand-muted text-brand">
            /ação
          </code>{' '}
          para definir o que fazer.
        </p>
      </div>
    </div>
  )
}
