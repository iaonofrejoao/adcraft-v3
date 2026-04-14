'use client'
import { Bot } from 'lucide-react'

interface JarvisMessageWrapperProps {
  children: React.ReactNode
}

export function JarvisMessageWrapper({ children }: JarvisMessageWrapperProps) {
  return (
    <div className="flex flex-col items-start gap-3">
      {/* Agent badge */}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-agent-research/20 flex items-center justify-center shrink-0">
          <Bot size={12} strokeWidth={1.5} className="text-agent-research" />
        </div>
        <span className="text-[0.5625rem] font-bold tracking-[0.12em] text-agent-research uppercase">
          Jarvis Agent
        </span>
      </div>

      {/* Content slot */}
      <div className="flex flex-col gap-3 w-full max-w-[90%]">
        {children}
      </div>
    </div>
  )
}
