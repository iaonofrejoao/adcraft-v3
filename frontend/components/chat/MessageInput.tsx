'use client'
import { useCallback, useRef, useState } from 'react'
import { ArrowUp, Paperclip } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { MentionPicker, type MentionItem } from './MentionPicker'

interface MessageInputProps {
  onSend:    (message: string) => void
  disabled?: boolean
}

// Detecta trigger @ ou / e a query que vem depois — lógica original preservada
function detectTrigger(
  text: string,
  cursor: number,
): { trigger: '@' | '/' | null; query: string; triggerStart: number } {
  const before     = text.slice(0, cursor)
  const atMatch    = before.match(/@(\w*)$/)
  const slashMatch = before.match(/\/(\w*)$/)

  if (atMatch)    return { trigger: '@', query: atMatch[1],    triggerStart: cursor - atMatch[0].length }
  if (slashMatch) return { trigger: '/', query: slashMatch[1], triggerStart: cursor - slashMatch[0].length }
  return { trigger: null, query: '', triggerStart: -1 }
}

export function MessageInput({ onSend, disabled = false }: MessageInputProps) {
  const [text,           setText]           = useState('')
  const [mentionTrigger, setMentionTrigger] = useState<'@' | '/' | null>(null)
  const [mentionQuery,   setMentionQuery]   = useState('')
  const [triggerStart,   setTriggerStart]   = useState(-1)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val    = e.target.value
    const cursor = e.target.selectionStart ?? val.length
    setText(val)
    const { trigger, query, triggerStart: ts } = detectTrigger(val, cursor)
    setMentionTrigger(trigger)
    setMentionQuery(query)
    setTriggerStart(ts)
  }, [])

  const handleSelect = useCallback((item: MentionItem) => {
    if (triggerStart < 0) return
    const before      = text.slice(0, triggerStart)
    const after       = text.slice(triggerStart + 1 + mentionQuery.length)
    const replacement = item.type === '@' ? `@${item.value} ` : `/${item.value} `
    const newText     = before + replacement + after
    setText(newText)
    setMentionTrigger(null)
    setTimeout(() => {
      const el = textareaRef.current
      if (!el) return
      el.focus()
      const pos = (before + replacement).length
      el.setSelectionRange(pos, pos)
    }, 0)
  }, [text, triggerStart, mentionQuery])

  const dismiss = useCallback(() => setMentionTrigger(null), [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !mentionTrigger) {
      e.preventDefault()
      submit()
    }
  }

  const submit = () => {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
    setMentionTrigger(null)
  }

  const canSend = !!text.trim() && !disabled

  return (
    <div className="relative px-6 py-4 shrink-0 bg-surface">
      {/* Gradient fade over messages — tonal separation without border */}
      <div className="absolute inset-x-0 -top-16 h-16 bg-gradient-to-t from-surface to-transparent pointer-events-none" />

      {/* MentionPicker — absolute bottom-full from this relative container */}
      <MentionPicker
        trigger={mentionTrigger}
        query={mentionQuery}
        anchorRef={textareaRef as React.RefObject<HTMLTextAreaElement>}
        onSelect={handleSelect}
        onDismiss={dismiss}
      />

      {/* Textarea with action buttons inside */}
      <div className="relative max-w-[800px] mx-auto">
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Pergunte ao Jarvis ou use @ para produtos e / para ações..."
          rows={2}
          className={cn(
            'resize-none min-h-[52px] max-h-40 w-full',
            'bg-surface-low border-outline-variant/20 rounded-xl',
            'text-sm text-on-surface placeholder:text-on-surface-muted',
            'px-5 py-4 pb-14',                             // pb-14 → room for action row
            'focus-visible:border-brand focus-visible:ring-brand/20',
            'transition-all duration-150',
          )}
        />

        {/* Action row: attach + send — absolutely inside the textarea */}
        <div className="absolute bottom-3 right-3 flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Anexar arquivo"
            className="w-8 h-8 text-on-surface-muted hover:text-on-surface hover:bg-surface-high"
          >
            <Paperclip size={16} strokeWidth={1.5} />
          </Button>

          <Button
            type="button"
            size="icon"
            onClick={submit}
            disabled={!canSend}
            className={cn(
              'w-8 h-8 transition-all duration-150',
              canSend
                ? 'bg-gradient-to-br from-[#F28705] to-[#FFB690] text-[#131314]' +
                  ' hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.15)] active:scale-95'
                : 'bg-surface-high text-on-surface-muted',
            )}
            aria-label="Enviar"
          >
            <ArrowUp size={16} strokeWidth={2} />
          </Button>
        </div>
      </div>

      {/* Help text */}
      <div className="flex items-center justify-between mt-2 px-1 max-w-[800px] mx-auto">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <kbd className="text-[0.625rem] px-1.5 py-0.5 rounded border border-outline-variant/30
              bg-surface-container text-on-surface-muted font-mono">
              @
            </kbd>
            <span className="text-[0.625rem] text-on-surface-muted">Mencionar produto</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="text-[0.625rem] px-1.5 py-0.5 rounded border border-outline-variant/30
              bg-surface-container text-on-surface-muted font-mono">
              /
            </kbd>
            <span className="text-[0.625rem] text-on-surface-muted">Acionar pipeline</span>
          </div>
        </div>
        <p className="text-[0.625rem] text-on-surface-muted">
          <kbd className="font-mono font-medium">Enter</kbd> para enviar ·{' '}
          <kbd className="font-mono font-medium">Shift+Enter</kbd> nova linha
        </p>
      </div>
    </div>
  )
}
