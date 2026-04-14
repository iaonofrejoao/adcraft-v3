'use client'
import { Bot } from 'lucide-react'

export function TypingIndicator() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-6 h-6 rounded-full bg-agent-research/20 flex items-center justify-center shrink-0">
        <Bot size={12} strokeWidth={1.5} className="text-agent-research" />
      </div>
      <div className="bg-surface-low rounded-xl px-4 py-3 flex gap-1.5 items-center">
        <span className="w-1.5 h-1.5 rounded-full bg-on-surface-variant animate-bounce [animation-delay:-0.3s]" />
        <span className="w-1.5 h-1.5 rounded-full bg-on-surface-variant animate-bounce [animation-delay:-0.15s]" />
        <span className="w-1.5 h-1.5 rounded-full bg-on-surface-variant animate-bounce" />
      </div>
    </div>
  )
}
