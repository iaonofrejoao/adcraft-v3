'use client'
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

export interface ShortcutDef {
  /** Exibição amigável, ex: "g p" ou "⌘K" */
  display: string
  description: string
}

/** Mapa de shortcuts exibidos no modal de ajuda — fonte única da verdade. */
export const SHORTCUT_DEFS: ShortcutDef[] = [
  { display: '?',    description: 'Abrir atalhos de teclado'     },
  { display: '⌘ /',  description: 'Focar no chat do Jarvis'       },
  { display: 'g p',  description: 'Ir para Produtos'              },
  { display: 'g d',  description: 'Ir para Demandas'              },
  { display: 'g c',  description: 'Ir para Criativos'             },
  { display: 'Esc',  description: 'Fechar modal / cancelar'       },
]

/**
 * Registra atalhos de teclado globais.
 * onOpenHelp: abre o modal de shortcuts (?)
 */
export function useKeyboardShortcuts(onOpenHelp: () => void) {
  const router = useRouter()
  // Sequência em andamento — ex: "g" seguido de outra tecla
  const pendingRef = useRef<string | null>(null)
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function clearPending() {
      pendingRef.current = null
      if (timerRef.current) clearTimeout(timerRef.current)
    }

    function handler(e: KeyboardEvent) {
      // Ignora quando o foco está num input / textarea / contenteditable
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT'    ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) return

      const key = e.key
      const mod = e.metaKey || e.ctrlKey

      // ── Cmd+/ → foca no Jarvis ────────────────────────────────────────────
      if (mod && key === '/') {
        e.preventDefault()
        const input = document.querySelector<HTMLElement>(
          '[data-jarvis-input]'
        )
        input?.focus()
        return
      }

      // ── Sequências com prefixo "g" ────────────────────────────────────────
      if (pendingRef.current === 'g') {
        clearPending()
        switch (key) {
          case 'p': router.push('/products');  break
          case 'd': router.push('/demandas');  break
          case 'c': router.push('/creatives'); break
        }
        return
      }

      // ── Teclas simples (sem modificador) ─────────────────────────────────
      if (!mod) {
        if (key === '?') {
          onOpenHelp()
          return
        }
        if (key === 'g') {
          pendingRef.current = 'g'
          // Janela de 600ms para completar a sequência
          timerRef.current = setTimeout(clearPending, 600)
          return
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      clearPending()
    }
  }, [router, onOpenHelp])
}
