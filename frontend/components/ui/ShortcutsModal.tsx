'use client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SHORTCUT_DEFS } from '@/hooks/useKeyboardShortcuts'

interface ShortcutsModalProps {
  open:         boolean
  onOpenChange: (open: boolean) => void
}

export function ShortcutsModal({ open, onOpenChange }: ShortcutsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface-container border-outline-variant/20 text-on-surface max-w-sm p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-outline-variant/10">
          <DialogTitle className="text-[15px] font-semibold tracking-tight text-on-surface">
            Atalhos de teclado
          </DialogTitle>
        </DialogHeader>

        <ul className="divide-y divide-outline-variant/10">
          {SHORTCUT_DEFS.map((s) => (
            <li
              key={s.display}
              className="flex items-center justify-between px-5 py-3"
            >
              <span className="text-[13px] text-on-surface-variant">
                {s.description}
              </span>
              <KeyCombo label={s.display} />
            </li>
          ))}
        </ul>

        <p className="px-5 py-3 text-[11px] text-on-surface-muted border-t border-outline-variant/10">
          Atalhos não funcionam quando o foco está em um campo de texto.
        </p>
      </DialogContent>
    </Dialog>
  )
}

function KeyCombo({ label }: { label: string }) {
  const parts = label.split(' ')
  return (
    <span className="flex items-center gap-1">
      {parts.map((part, i) => (
        <kbd
          key={i}
          className="px-2 py-0.5 bg-surface-high border border-outline-variant/20 rounded text-[11px] font-mono text-on-surface-variant"
        >
          {part}
        </kbd>
      ))}
    </span>
  )
}
