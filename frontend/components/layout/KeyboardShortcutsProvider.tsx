'use client'
import { useState, useCallback } from 'react'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { ShortcutsModal } from '@/components/ui/ShortcutsModal'

/**
 * Client component que registra os shortcuts globais e renderiza o modal "?".
 * Deve ser inserido dentro do RootLayout (server component) como filho.
 */
export function KeyboardShortcutsProvider() {
  const [open, setOpen] = useState(false)
  const openHelp = useCallback(() => setOpen(true), [])

  useKeyboardShortcuts(openHelp)

  return <ShortcutsModal open={open} onOpenChange={setOpen} />
}
