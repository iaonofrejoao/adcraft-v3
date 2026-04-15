# DESIGN.md — AdCraft v2 · Kinetic Console

**Design system:** Kinetic Console
**Modo:** Dark-only (sem light mode implementado)
**Fontes:** Inter (UI), JetBrains Mono (código/tags)

---

## 1. Princípios visuais

- **Tonal Carving:** seções separadas por shift de background, nunca por border-b
- **Dark-first:** paleta de tons de carvão quente (#131314 → #353436)
- **Acento laranja:** gradiente brand como único ponto de cor ativa
- **Densidade controlada:** UI compacta sem ser claustrofóbica (14px base)

---

## 2. Tipografia

| Papel | Fonte | Tamanho | Peso |
|---|---|---|---|
| Body padrão | Inter | 14px | 400 |
| Labels / botões | Inter | 12–13px | 500 |
| Headings | Inter | 16–20px | 600 |
| Tags / código | JetBrains Mono | 12px | 400–500 |

---

## 3. Espaçamento e raios

- **Raio padrão:** `0.375rem` (6px) — mapeado em `--radius`
- **Gap interno de cards:** `p-4` (16px)
- **Gap entre seções:** `gap-6` (24px) ou shift de surface

---

## 4. Iconografia

- **Biblioteca:** Lucide React
- **strokeWidth:** 1.5 (sempre)
- **Tamanhos:** 16 / 18 / 20px conforme contexto

---

## 5. Layout

- **Sidebar:** largura 240px, fixa, ScrollArea Shadcn (não overflow nativo)
- **Área de conteúdo:** flex-1, padding 24px
- **Chat input:** fixo no rodapé da área de chat

---

## 6. Componentes Shadcn instalados

`button`, `input`, `card`, `badge`, `dropdown-menu`, `select`, `tabs`,
`tooltip`, `separator`, `progress`, `skeleton`, `scroll-area`, `checkbox`,
`dialog`, `alert-dialog`, `alert`, `textarea`, `sonner` (toasts), `toggle`

Ficam em `frontend/components/ui/` — não modificar diretamente.

Componentes customizados nessa pasta (extensões do design system):
- `StatusBadge.tsx` — badge de status com tokens CSS
- `MetricCard.tsx` — card de métrica com classes semânticas
- `CostDisplay.tsx` — exibição de custo em USD

---

## 7. Cards de status

| Status | Bg class | Text class |
|---|---|---|
| pending | `bg-status-pending` | `text-status-pending-text` |
| running | `bg-status-running` | `text-status-running-text` |
| done | `bg-status-done` | `text-status-done-text` |
| failed | `bg-status-failed` | `text-status-failed-text` |
| paused | `bg-status-paused` | `text-status-paused-text` |

Superfícies aprovação/rejeição: `bg-status-approved-surface` / `bg-status-rejected-surface`.

---

---

## Implementation Reference

> Esta seção documenta os tokens e mapeamentos reais implementados no código.
> Fonte: `frontend/app/globals.css` + `frontend/tailwind.config.ts`

### CSS custom properties (globals.css)

#### Superfícies
| CSS var | Valor | Tailwind class |
|---|---|---|
| `--surface` | `#131314` | `bg-surface` |
| `--surface-container-low` | `#1C1B1C` | `bg-surface-low` |
| `--surface-container` | `#201F20` | `bg-surface-container` |
| `--surface-container-high` | `#2A2829` | `bg-surface-high` |
| `--surface-container-highest` | `#353436` | `bg-surface-highest` |

#### Brand
| CSS var | Valor | Tailwind class |
|---|---|---|
| `--primary` | `#F28705` | `text-brand` / `bg-brand` |
| `--primary-end` | `#FFB690` | `text-brand-end` / `bg-brand-end` |
| `--primary-container` | `rgba(242,135,5,0.15)` | `bg-brand-muted` |
| gradient | `135deg, #F28705 → #FFB690` | `bg-brand-gradient` |

#### Texto
| CSS var | Valor | Tailwind class |
|---|---|---|
| `--on-surface` | `#E8E3DD` | `text-on-surface` |
| `--on-surface-variant` | `#9E9489` | `text-on-surface-variant` |
| `--on-surface-muted` | `#6B6460` | `text-on-surface-muted` |
| `--outline-variant` | `#584237` | `text-outline-variant` |

#### Status (bg + text separados)
```
--status-pending-bg    rgba(161,161,170,0.15)   → bg-status-pending
--status-pending-text  #A1A1AA                  → text-status-pending-text
--status-running-bg    rgba(59,130,246,0.15)     → bg-status-running
--status-running-text  #60A5FA                  → text-status-running-text
--status-done-bg       rgba(34,197,94,0.15)      → bg-status-done
--status-done-text     #4ADE80                  → text-status-done-text
--status-failed-bg     rgba(239,68,68,0.15)      → bg-status-failed
--status-failed-text   #F87171                  → text-status-failed-text
--status-paused-bg     rgba(245,158,11,0.15)     → bg-status-paused
--status-paused-text   #FCD34D                  → text-status-paused-text
--status-approved-surface  rgba(74,222,128,0.08) → bg-status-approved-surface
--status-rejected-surface  rgba(248,113,113,0.08)→ bg-status-rejected-surface
```

#### Agentes
| Tailwind class | Cor |
|---|---|
| `text-agent-research` / `bg-agent-research` | `#F29F05` |
| `text-agent-market` / `bg-agent-market` | `#A1A1AA` |
| `text-agent-strategy` / `bg-agent-strategy` | `#FFDBCA` |

#### Shadcn mappings (para compatibilidade com components/ui/)
As variáveis `--background`, `--foreground`, `--card`, `--popover`, `--primary-shadcn`,
`--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`
são mapeadas para os tokens de surface/brand/status conforme necessário. O `--background`
aponta para `--surface` (#131314).

### Utilitários especiais

```
shadow-ambient  → sombra ambiente com leve glow laranja
bg-brand-gradient → linear-gradient(135deg, #F28705, #FFB690)
animate-pulse-status → pulse 2s para indicadores de status running
```

### Nota dark-only

Não existe bloco `@media (prefers-color-scheme: light)` nem classe `.light` no projeto.
Toda a paleta é dark-only. Não implementar light mode sem instrução explícita.
