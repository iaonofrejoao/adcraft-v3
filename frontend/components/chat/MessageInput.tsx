'use client'
import { useCallback, useRef, useState } from 'react'
import { MentionPicker, type MentionItem } from './MentionPicker'

interface MessageInputProps {
  onSend: (message: string) => void
  disabled?: boolean
}

// Detecta trigger @ ou / e a query que vem depois
function detectTrigger(text: string, cursor: number): { trigger: '@' | '/' | null; query: string; triggerStart: number } {
  const before = text.slice(0, cursor)
  const atMatch  = before.match(/@(\w*)$/)
  const slashMatch = before.match(/\/(\w*)$/)

  if (atMatch) {
    return { trigger: '@', query: atMatch[1], triggerStart: cursor - atMatch[0].length }
  }
  if (slashMatch) {
    return { trigger: '/', query: slashMatch[1], triggerStart: cursor - slashMatch[0].length }
  }
  return { trigger: null, query: '', triggerStart: -1 }
}

export function MessageInput({ onSend, disabled = false }: MessageInputProps) {
  const [text, setText]             = useState('')
  const [mentionTrigger, setMentionTrigger] = useState<'@' | '/' | null>(null)
  const [mentionQuery, setMentionQuery]     = useState('')
  const [triggerStart, setTriggerStart]     = useState(-1)
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
    const before  = text.slice(0, triggerStart)
    const after   = text.slice(triggerStart + 1 + mentionQuery.length) // +1 para o trigger char
    const replacement = item.type === '@' ? `@${item.value} ` : `/${item.value} `
    const newText = before + replacement + after
    setText(newText)
    setMentionTrigger(null)
    // Foca textarea e posiciona cursor
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
    // Submit com Enter (sem Shift)
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

  return (
    <div className="relative px-4 py-3 border-t" style={{ borderColor: 'var(--border-default)', background: 'var(--surface-page)' }}>
      <MentionPicker
        trigger={mentionTrigger}
        query={mentionQuery}
        anchorRef={textareaRef as React.RefObject<HTMLTextAreaElement>}
        onSelect={handleSelect}
        onDismiss={dismiss}
      />
      <div className="flex items-end gap-2 rounded-xl border px-3 py-2 focus-within:ring-1"
        style={{ background: 'var(--surface-input)', borderColor: 'var(--border-default)', '--tw-ring-color': 'var(--brand-primary)' } as React.CSSProperties}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          placeholder="Mensagem… use @produto e /ação"
          className="flex-1 resize-none bg-transparent text-sm outline-none leading-5 max-h-36 overflow-y-auto"
          style={{ color: 'var(--text-primary)' }}
        />
        <button
          type="button"
          onClick={submit}
          disabled={!text.trim() || disabled}
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-white transition-all disabled:opacity-40"
          style={{ background: 'var(--brand-primary)' }}
          aria-label="Enviar"
        >
          ↑
        </button>
      </div>
      <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
        <kbd className="font-mono">Enter</kbd> para enviar · <kbd className="font-mono">Shift+Enter</kbd> nova linha ·{' '}
        <span style={{ color: 'var(--brand-primary)' }}>@produto</span> e{' '}
        <span style={{ color: 'var(--brand-primary)' }}>/ação</span>
      </p>
    </div>
  )
}
