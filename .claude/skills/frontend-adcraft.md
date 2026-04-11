---
name: frontend-adcraft
description: >
  Build the AdCraft AI marketing platform frontend using Next.js 14, Tailwind CSS,
  and the AdCraft design system with a professional dark-capable SaaS aesthetic.
  Use this skill for all AdCraft frontend components, pages, and UI elements including
  the sidebar navigation, project cards, metric displays, approval panels, cost counters,
  notification bells, asset library cards, and any other AdCraft-specific interface elements.
  Triggers on: AdCraft UI, build the interface, create the page, sidebar, dashboard,
  project card, metric card, approval panel, asset card, notification, or any request
  to build a frontend component for the AdCraft platform.
---

# Frontend AdCraft — Design System e Componentes

Skill para construir a interface do AdCraft com identidade visual consistente,
componentes reutilizáveis e padrões de UX para plataformas SaaS de IA.

---

## Princípios de Design

**Profissional e focado** — a interface serve um propósito operacional. Sem elementos decorativos que distraem. Cada pixel serve uma função.

**Informação densa mas legível** — o usuário precisa ver status de múltiplos agentes, métricas e histórico ao mesmo tempo. Use densidade controlada com hierarquia clara.

**Status sempre visível** — o estado de cada execução, nó e campanha deve ser imediatamente legível sem interação. Cores e ícones comunicam antes do texto.

**Feedback imediato** — toda ação tem resposta visual instantânea. Botões mudam de estado, nós pulsam durante execução, custos sobem em tempo real.

---

## Paleta de Cores

```css
/* globals.css */
:root {
  /* Marca */
  --brand-primary: #6D5BD0;       /* Roxo principal — ações primárias */
  --brand-secondary: #8B7AE0;     /* Roxo claro — hover states */
  --brand-subtle: #EEEDFE;        /* Roxo muito claro — backgrounds de badge */

  /* Superfícies */
  --surface-page: #F8F7FF;        /* Fundo da página */
  --surface-card: #FFFFFF;        /* Cards e painéis */
  --surface-sidebar: #F3F2FA;     /* Sidebar */
  --surface-input: #FAFAFA;       /* Inputs */

  /* Texto */
  --text-primary: #1A1830;        /* Títulos e labels */
  --text-secondary: #6B6880;      /* Subtítulos e meta */
  --text-muted: #A09DB8;          /* Placeholders e dicas */

  /* Bordas */
  --border-default: #E8E6F0;
  --border-focus: #6D5BD0;

  /* Status */
  --status-running: #7C3AED;      /* Roxo — executando */
  --status-success: #16A34A;      /* Verde — aprovado/concluído */
  --status-warning: #D97706;      /* Âmbar — aguardando */
  --status-error: #DC2626;        /* Vermelho — falha */
  --status-idle: #9CA3AF;         /* Cinza — inativo */
  --status-disabled: #D1D5DB;     /* Cinza claro — desativado */
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  :root {
    --surface-page: #0F0E1A;
    --surface-card: #1A1830;
    --surface-sidebar: #15132A;
    --text-primary: #F0EFF8;
    --text-secondary: #A09DB8;
    --border-default: #2D2B45;
  }
}
```

---

## Tipografia

```css
/* Usa Inter como fonte principal — limpa e legível em interfaces */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

body {
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-primary);
  background: var(--surface-page);
}

/* Escala tipográfica */
.text-xs  { font-size: 11px; }
.text-sm  { font-size: 13px; }
.text-base { font-size: 14px; }
.text-lg  { font-size: 16px; }
.text-xl  { font-size: 18px; }
.text-2xl { font-size: 22px; }

/* Mono para valores numéricos e código */
.font-mono { font-family: 'JetBrains Mono', monospace; }
```

---

## Componentes Base

### Badge de Status

```tsx
// components/ui/StatusBadge.tsx
type Status = 'active' | 'running' | 'draft' | 'paused' | 'failed' | 'completed'

const statusConfig = {
  active:    { label: 'ativo',      bg: 'bg-green-50',  text: 'text-green-800',  dot: 'bg-green-500' },
  running:   { label: 'executando', bg: 'bg-purple-50', text: 'text-purple-800', dot: 'bg-purple-500' },
  draft:     { label: 'rascunho',   bg: 'bg-gray-50',   text: 'text-gray-600',   dot: 'bg-gray-400' },
  paused:    { label: 'pausado',    bg: 'bg-amber-50',  text: 'text-amber-800',  dot: 'bg-amber-500' },
  failed:    { label: 'falha',      bg: 'bg-red-50',    text: 'text-red-800',    dot: 'bg-red-500' },
  completed: { label: 'concluído',  bg: 'bg-blue-50',   text: 'text-blue-800',   dot: 'bg-blue-500' },
}

export function StatusBadge({ status }: { status: Status }) {
  const config = statusConfig[status]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot} ${status === 'running' ? 'animate-pulse' : ''}`} />
      {config.label}
    </span>
  )
}
```

### Metric Card

```tsx
// components/ui/MetricCard.tsx
interface MetricCardProps {
  label: string
  value: string | number
  delta?: string
  deltaPositive?: boolean
  format?: 'number' | 'currency' | 'percent' | 'multiplier'
}

export function MetricCard({ label, value, delta, deltaPositive, format = 'number' }: MetricCardProps) {
  const formattedValue = formatValue(value, format)

  return (
    <div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-xl p-4">
      <p className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider mb-2">
        {label}
      </p>
      <p className="text-2xl font-semibold text-[var(--text-primary)] font-mono">
        {formattedValue}
      </p>
      {delta && (
        <p className={`text-xs mt-1 ${deltaPositive ? 'text-green-600' : 'text-red-500'}`}>
          {delta}
        </p>
      )}
    </div>
  )
}

function formatValue(value: string | number, format: string): string {
  if (typeof value === 'string') return value
  switch (format) {
    case 'currency': return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    case 'percent':  return `${value.toFixed(1)}%`
    case 'multiplier': return `${value.toFixed(1)}x`
    default: return value.toLocaleString('pt-BR')
  }
}
```

### Card de Projeto

```tsx
// components/projects/ProjectCard.tsx
import { StatusBadge } from '@/components/ui/StatusBadge'
import Link from 'next/link'

interface ProjectCardProps {
  id: string
  name: string
  niche: string
  platform: string
  language: string
  status: 'active' | 'running' | 'draft' | 'paused'
  executionCount: number
  creativeCount: number
  roas?: number
  lastUpdated: string
}

export function ProjectCard({ id, name, niche, platform, language, status, executionCount, creativeCount, roas, lastUpdated }: ProjectCardProps) {
  return (
    <Link href={`/projetos/${id}`}>
      <div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-xl p-4 hover:border-[var(--brand-primary)] transition-colors cursor-pointer">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">
              {name}
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {niche} · {platform} · {language}
            </p>
          </div>
          <StatusBadge status={status} />
        </div>

        {/* Métricas inline */}
        <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
          <span>{executionCount} execuções</span>
          <span>{creativeCount} criativos</span>
          {roas && (
            <span className="text-green-600 font-medium font-mono">
              ROAS {roas.toFixed(1)}x
            </span>
          )}
        </div>

        {/* Footer */}
        <p className="text-xs text-[var(--text-muted)] mt-3">
          atualizado {lastUpdated}
        </p>
      </div>
    </Link>
  )
}
```

### Toggle Component

```tsx
// components/ui/Toggle.tsx
interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  size?: 'sm' | 'md'
}

export function Toggle({ checked, onChange, label, size = 'md' }: ToggleProps) {
  const trackSize = size === 'sm' ? 'w-8 h-4' : 'w-10 h-6'
  const thumbSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'
  const thumbTranslate = size === 'sm'
    ? checked ? 'translate-x-4' : 'translate-x-0.5'
    : checked ? 'translate-x-5' : 'translate-x-1'

  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`
          relative ${trackSize} rounded-full transition-colors duration-200
          ${checked ? 'bg-[var(--brand-primary)]' : 'bg-gray-200'}
        `}
      >
        <span className={`
          absolute top-0.5 ${thumbSize} rounded-full bg-white shadow-sm
          transition-transform duration-200 ${thumbTranslate}
        `} />
      </button>
      {label && (
        <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      )}
    </label>
  )
}
```

### Cost Display em Tempo Real

```tsx
// components/ui/CostDisplay.tsx
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
```

---

## Layout Principal

```tsx
// app/layout.tsx
import { Sidebar } from '@/components/layout/Sidebar'
import { NotificationBell } from '@/components/layout/NotificationBell'
import './globals.css'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="flex h-screen overflow-hidden bg-[var(--surface-page)]">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          {children}
        </main>
      </body>
    </html>
  )
}
```

---

## Tailwind Config

```js
// tailwind.config.js
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#6D5BD0',
          secondary: '#8B7AE0',
          subtle: '#EEEDFE',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
```
