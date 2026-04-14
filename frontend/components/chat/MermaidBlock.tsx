'use client'
import { useEffect, useId, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

interface MermaidBlockProps {
  chart: string
}

export function MermaidBlock({ chart }: MermaidBlockProps) {
  const id                        = useId().replace(/:/g, '-')
  const [svg,   setSvg]           = useState<string>('')
  const [error, setError]         = useState<string>('')
  const [ready, setReady]         = useState(false)

  useEffect(() => {
    let cancelled = false

    import('mermaid').then(({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad:   false,
        theme:         'base',
        themeVariables: {
          primaryColor:     '#6D5BD0',
          primaryTextColor: '#fff',
          lineColor:        '#A09DB8',
          background:       '#FFFFFF',
        },
        securityLevel: 'strict',
      })

      mermaid
        .render(`mermaid-block-${id}`, chart)
        .then(({ svg: rendered }) => {
          if (!cancelled) {
            setSvg(rendered)
            setReady(true)
          }
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : String(err))
            setReady(true)
          }
        })
    })

    return () => { cancelled = true }
  }, [chart, id])

  if (!ready) {
    return (
      <div className="my-3 space-y-2">
        <Skeleton className="h-4 w-3/4 bg-surface-high" />
        <Skeleton className="h-4 w-1/2 bg-surface-high" />
        <Skeleton className="h-4 w-2/3 bg-surface-high" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="my-3 rounded-lg border border-outline-variant/20 overflow-hidden">
        <p className="px-3 py-1.5 text-[0.6875rem] text-on-surface-muted bg-surface-low">
          Não foi possível renderizar o diagrama
        </p>
        <pre className="p-3 text-xs text-on-surface-variant overflow-x-auto bg-surface">
          {chart}
        </pre>
      </div>
    )
  }

  return (
    <div
      className="my-3 rounded-lg bg-surface p-3 overflow-x-auto mermaid-diagram"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
