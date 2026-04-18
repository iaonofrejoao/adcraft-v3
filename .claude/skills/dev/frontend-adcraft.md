---
name: frontend-adcraft
description: >
  Build the AdCraft AI marketing platform frontend using Next.js 14,
  Tailwind CSS, Shadcn/ui, and the "Kinetic Console" design system.
  Use for all AdCraft UI: sidebar, chat, cards, pipelines, modals,
  status badges, cost counters, approval panels, agent status.
---

# Frontend AdCraft — Kinetic Console Design System

## Filosofia
"The Kinetic Console" — UI como instrumento profissional.
Alta densidade de informação. Inspirado em flight decks e IDEs.
Nunca "soft SaaS". Sempre preciso, denso, responsivo ao toque.

## Regras absolutas
- NUNCA usar #000000 ou #FFFFFF puros
- NUNCA usar border 1px sólido para separar seções — usar shifts de background (Tonal Carving)
- NUNCA usar cantos sharp — sempre border-radius moderado (radius SM = 0.375rem)
- SEMPRE usar JetBrains Mono (font-mono) para números, timestamps, IDs, custos, SKUs
- SEMPRE animar com duration-150 ou duration-200 máximo
- Glassmorphism obrigatório em todos os overlays flutuantes

## Superfícies — Tonal Carving
bg-[#131314]  → surface base (body/canvas)
bg-[#1C1B1C]  → surface-low (sidebar, navigation gutter, inputs)
bg-[#201F20]  → surface-container (cards, painéis de trabalho)
bg-[#2A2829]  → surface-high (hover states em listas)
bg-[#353436]  → surface-highest (modals, dropdowns)
Separar seções sempre por shift de background, NUNCA por border-b.

## Botões
```tsx
// Primário — gradient com sheen metálico
<Button className="bg-gradient-to-br from-[#F28705] to-[#FFB690]
  text-[#131314] font-medium
  hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]
  transition-shadow duration-150">

// Secundário — outline sutil
<Button variant="outline"
  className="border-[#584237]/20 bg-transparent text-[#E8E3DD]
  hover:bg-[#2A2829] transition-colors duration-150">

// Ghost — sem fundo, sem borda
<Button variant="ghost"
  className="text-[#9E9489] hover:text-[#E8E3DD]
  hover:bg-[#2A2829] transition-colors duration-150">
```

## Inputs
```tsx
<Input className="h-9 bg-[#1C1B1C] border-transparent text-[#E8E3DD]
  placeholder:text-[#6B6460]
  focus:border-[#F28705] focus:ring-2 focus:ring-[#F28705]/20
  transition-all duration-150" />
```

## Cards e Painéis
```tsx
// Card padrão — sem border, só shift de surface
<Card className="bg-[#201F20] border-0 rounded-md">

// Card com ghost border (acessibilidade)
<Card className="bg-[#201F20] border border-[#584237]/15 rounded-md">

// Hover em lista
<div className="hover:bg-[#2A2829] rounded transition-colors duration-150">
```

## Status Badges
```tsx
const statusClass = {
  pending: 'bg-[rgba(161,161,170,0.15)] text-[#A1A1AA]',
  running: 'bg-[rgba(59,130,246,0.15)]  text-[#60A5FA]',
  done:    'bg-[rgba(34,197,94,0.15)]   text-[#4ADE80]',
  failed:  'bg-[rgba(239,68,68,0.15)]   text-[#F87171]',
  paused:  'bg-[rgba(245,158,11,0.15)]  text-[#FCD34D]',
}

// Ponto animado para status running:
<span className="w-1.5 h-1.5 rounded-full bg-[#60A5FA] animate-pulse" />
```

## Agentes AI — Functional Tinting
avatar-research  → text-[#F29F05]  (âmbar)
market-research  → text-[#A1A1AA]  (cinza frio)
strategy/angles  → text-[#FFDBCA]  (âmbar quente)

## Glassmorphism — Dropdowns, Modals, Command Bar
```tsx
className="bg-[#353436]/80 backdrop-blur-[12px] shadow-[0_12px_40px_-10px_rgba(0,0,0,0.5),0_0_20px_rgba(249,115,22,0.05)]"
```

## AI Command Bar (componente especial)
```tsx
<div className="fixed bottom-6 left-1/2 -translate-x-1/2
  bg-[#353436]/80 backdrop-blur-[12px]
  border border-[#F28705]/20 rounded-xl
  shadow-[0_12px_40px_-10px_rgba(0,0,0,0.5),0_0_20px_rgba(249,115,22,0.05)]
  px-4 py-3 w-[600px]">
```

## Tipografia
Títulos/labels    → font-sans (Inter)
Dados/números     → font-mono (JetBrains Mono)  ← OBRIGATÓRIO
Escala: display 2.75rem/600, headline 1.5rem/600,
title 1rem/600, body 0.875rem/400, label 0.6875rem/500
Tracking: display -0.02em, headline -0.01em, label +0.02em

## Convenções de código
- Arquivos em components/[feature]/NomeComponente.tsx
- Named exports + interface TypeScript explícita
- cn() de @/lib/utils para classNames condicionais
- Ícones: Lucide React, outline, strokeWidth=1.5, 16/18/20px
- Nunca style inline
- Estados vazios: sempre ilustração sutil + texto + CTA
