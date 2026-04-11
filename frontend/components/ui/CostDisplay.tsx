'use client'
import { useEffect, useRef, useState } from 'react'

interface CostDisplayProps {
  costUsd: number
  tokens?: number
  animated?: boolean
}

export function CostDisplay({ costUsd, tokens, animated = true }: CostDisplayProps) {
  const [displayCost, setDisplayCost] = useState(costUsd)
  const prevCostRef = useRef(costUsd)

  useEffect(() => {
    if (!animated || costUsd === prevCostRef.current) {
      setDisplayCost(costUsd)
      return
    }

    // Animação suave de counter
    const start = prevCostRef.current
    const end = costUsd
    const duration = 500
    const startTime = Date.now()

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      setDisplayCost(start + (end - start) * progress)
      if (progress < 1) requestAnimationFrame(animate)
    }

    requestAnimationFrame(animate)
    prevCostRef.current = costUsd
  }, [costUsd, animated])

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-mono text-[var(--text-secondary)]">
        ${displayCost.toFixed(4)}
      </span>
      {tokens !== undefined && (
        <span className="text-xs text-[var(--text-muted)]">
          {tokens.toLocaleString()} tokens
        </span>
      )}
    </div>
  )
}
