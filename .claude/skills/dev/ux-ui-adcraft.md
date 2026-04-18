---
name: ux-ui-adcraft
description: >
  Lapida e audita a experiência do usuário no AdCraft v2.
  Use para: revisar fluxos de navegação, identificar inconsistências visuais,
  propor melhorias de UX, hierarquia de informação, micro-interações,
  estados vazios, feedbacks de ação e densidade de informação.
---

# SKILL: UX/UI Polish — AdCraft v2

## Filosofia Kinetic Console (revisão rápida)
- UI como instrumento profissional: **alta densidade**, **sem ruído decorativo**
- Cada pixel deve justificar sua existência — nada é "só visual"
- Dark mode absoluto, nunca modo claro
- Animações funcionais: comunicam estado, não chamam atenção

---

## 1. Checklist de auditoria UX por tela

Ao auditar qualquer tela, responda cada item:

### Hierarquia visual
- [ ] A ação primária da tela é imediatamente óbvia?
- [ ] O título/contexto de onde o usuário está é claro?
- [ ] Conteúdo crítico está na metade superior (above the fold)?
- [ ] Informações secundárias estão visualmente recuadas (muted)?

### Superfícies e profundidade
- [ ] As camadas usam o Tonal Carving correto (surface → surface-highest)?
- [ ] Há algum `border-b` separando seções? (proibido — substituir por shift de bg)
- [ ] Algum hex hardcoded onde deveria haver token? (ex: `#201F20` → `bg-surface-container`)
- [ ] Modais e overlays têm glassmorphism (`bg-surface-highest/80 backdrop-blur-[12px]`)?

### Tipografia e dados
- [ ] Números, IDs, timestamps, SKUs, custos usam `font-mono`?
- [ ] Labels secundários usam `text-on-surface-variant` (`#9E9489`)?
- [ ] Textos desativados/mutados usam `text-on-surface-muted` (`#6B6460`)?
- [ ] Nenhum texto usa preto/branco puro (`#000` / `#fff`)?

### Feedback e estados
- [ ] Há estado de loading (Skeleton) para cada dado assíncrono?
- [ ] Há estado vazio (empty state) com CTA quando lista é vazia?
- [ ] Erros têm mensagem clara e ação de recuperação?
- [ ] Ações destrutivas têm `AlertDialog` de confirmação?
- [ ] Toasts (Sonner) são usados para confirmações de ação?

### Micro-interações
- [ ] Todos os elementos interativos têm `transition-colors duration-150`?
- [ ] Hovers em listas usam `hover:bg-surface-high`?
- [ ] Botões têm estado de loading (`disabled` + spinner) em operações async?
- [ ] Status "running" tem `animate-pulse` no indicador?

### Navegação
- [ ] O item ativo na sidebar está claramente destacado?
- [ ] Breadcrumb ou título contextual está presente?
- [ ] Ações destrutivas estão distantes das ações primárias?

---

## 2. Padrões de UX por tipo de tela

### Listagens (produtos, demandas, campanhas)
```
┌─ FilterBar ──────────────────────────────────┐  ← surface-low
│  [Busca] [Status ▾] [Período ▾]  [+ Novo]   │
└──────────────────────────────────────────────┘
┌─ Lista ───────────────────────────────────────┐  ← surface
│  Item  ·  Item  ·  Item  · ...               │  hover: surface-high
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│  [Empty state com CTA quando lista vazia]    │
└──────────────────────────────────────────────┘
```
- FilterBar sempre fixo no topo, nunca inline no conteúdo
- Ordenação por coluna: indicador visual de direção (ChevronUp/Down)
- Paginação: preferir scroll infinito via `useIntersectionObserver`

### Detalhe / workspace (produto, demanda, campanha)
```
┌─ Header ──────────────────────────────────────┐  surface-low
│  ← Voltar   [Título]   [StatusBadge]  [Ações]│
└──────────────────────────────────────────────┘
┌─ Tabs ────────────────────────────────────────┐  surface
│  [Aba1] [Aba2] [Aba3] ...                    │
├──────────────────────────────────────────────┤
│  Conteúdo da aba ativa                        │  surface-container
└──────────────────────────────────────────────┘
```
- Tabs com `Tabs` Shadcn, `TabsTrigger` com badge de contagem quando relevante
- Ações secundárias no header via `DropdownMenu`, não botões avulsos

### Modals e dialogs
```tsx
// Estrutura padrão
<Dialog>
  <DialogContent className="bg-surface-highest/80 backdrop-blur-[12px]
    border border-outline-variant/20 shadow-ambient max-w-lg">
    <DialogHeader>
      <DialogTitle className="text-on-surface font-semibold">Título</DialogTitle>
      <DialogDescription className="text-on-surface-variant text-sm">
        Contexto ou instrução
      </DialogDescription>
    </DialogHeader>
    {/* conteúdo */}
    <DialogFooter>
      <Button variant="ghost">Cancelar</Button>
      <Button className="bg-brand-gradient text-on-primary">Confirmar</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Cards em grid
```tsx
// Card padrão com hover
<Card className="bg-surface-container border-0 rounded-md
  hover:bg-surface-high transition-colors duration-150 cursor-pointer
  group">
  <CardHeader className="pb-2">
    <CardTitle className="text-sm font-medium text-on-surface">Título</CardTitle>
  </CardHeader>
  <CardContent>
    {/* dados com font-mono para números */}
  </CardContent>
</Card>
```

---

## 3. Tokens semânticos de uso rápido

### Texto
| Intenção              | Classe Tailwind                |
|-----------------------|-------------------------------|
| Título / label forte  | `text-on-surface font-semibold` |
| Corpo / descrição     | `text-on-surface text-sm`     |
| Secundário / dica     | `text-on-surface-variant`     |
| Placeholder / mudo    | `text-on-surface-muted`       |
| Destaque / brand      | `text-brand`                  |
| Erro / destrutivo     | `text-destructive`            |

### Fundo
| Intenção              | Classe Tailwind                |
|-----------------------|-------------------------------|
| Canvas / corpo        | `bg-background`               |
| Sidebar / nav         | `bg-surface-low`              |
| Card / painel         | `bg-surface-container`        |
| Hover em lista        | `bg-surface-high`             |
| Modal / dropdown      | `bg-surface-highest`          |

### Bordas
| Intenção              | Classe Tailwind                |
|-----------------------|-------------------------------|
| Ghost border padrão   | `border border-outline-variant/15` |
| Focus ring input      | `focus:ring-2 focus:ring-brand/20` |
| Separador brand       | `border-brand/20`             |

---

## 4. Empty States — template padrão

```tsx
// Usar quando lista/grid não tem itens
<div className="flex flex-col items-center justify-center py-16 gap-4">
  <div className="w-12 h-12 rounded-full bg-surface-high
    flex items-center justify-center">
    <IconName className="w-5 h-5 text-on-surface-muted" strokeWidth={1.5} />
  </div>
  <div className="text-center space-y-1">
    <p className="text-sm font-medium text-on-surface">Nenhum [item] ainda</p>
    <p className="text-xs text-on-surface-variant max-w-xs">
      [Instrução de próximo passo]
    </p>
  </div>
  <Button size="sm" className="bg-brand-gradient text-on-primary">
    <Plus className="w-4 h-4 mr-1.5" strokeWidth={1.5} />
    [CTA]
  </Button>
</div>
```

---

## 5. Skeleton Loaders — template padrão

```tsx
// Para listas
{isLoading && Array.from({ length: 4 }).map((_, i) => (
  <div key={i} className="flex items-center gap-3 p-3">
    <Skeleton className="h-8 w-8 rounded-md bg-surface-high" />
    <div className="space-y-1.5 flex-1">
      <Skeleton className="h-3 w-2/3 bg-surface-high" />
      <Skeleton className="h-3 w-1/3 bg-surface-high" />
    </div>
  </div>
))}

// Para cards
<Card className="bg-surface-container border-0 rounded-md p-4 space-y-3">
  <Skeleton className="h-4 w-1/2 bg-surface-high" />
  <Skeleton className="h-3 w-full bg-surface-high" />
  <Skeleton className="h-3 w-4/5 bg-surface-high" />
</Card>
```

---

## 6. Micro-interações essenciais

### Botão com loading async
```tsx
const [loading, setLoading] = useState(false)

<Button
  disabled={loading}
  onClick={async () => {
    setLoading(true)
    try { await action() } finally { setLoading(false) }
  }}
  className="bg-brand-gradient text-on-primary">
  {loading
    ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
    : <span>Confirmar</span>}
</Button>
```

### Toast de confirmação (Sonner)
```tsx
import { toast } from 'sonner'

// Sucesso
toast.success('Salvo com sucesso')

// Erro
toast.error('Falha ao salvar', { description: error.message })

// Promise (loading automático)
toast.promise(saveAction(), {
  loading: 'Salvando...',
  success: 'Salvo!',
  error: 'Falha ao salvar',
})
```

### Status running com pulse
```tsx
{status === 'running' && (
  <span className="flex items-center gap-1.5 text-status-running-text text-xs">
    <span className="w-1.5 h-1.5 rounded-full bg-status-running-text animate-pulse" />
    Em execução
  </span>
)}
```

---

## 7. Regras de densidade de informação

### Espaçamento entre elementos
- Dentro de card: `p-3` (compacto) ou `p-4` (confortável)
- Entre cards em grid: `gap-3`
- Entre seções de uma página: `space-y-6`
- Label → valor: `gap-1` (empilhado) ou `gap-2` (lado a lado)
- Itens de lista: `py-2.5 px-3` com `hover:bg-surface-high`

### Tamanho de fonte
- Título de página: `text-base font-semibold` (16px)
- Título de card/seção: `text-sm font-medium` (14px)
- Corpo e descrição: `text-sm` (14px)
- Label e metadado: `text-xs` (12px)
- Caption / timestamp: `text-xs text-on-surface-muted font-mono`

### Ícones Lucide
- Em botão com texto: `w-4 h-4 mr-1.5` (strokeWidth=1.5)
- Ícone standalone de ação: `w-4 h-4` (strokeWidth=1.5)
- Ícone em header/título: `w-5 h-5` (strokeWidth=1.5)
- Ícone em empty state: `w-5 h-5 text-on-surface-muted` (strokeWidth=1.5)
- NUNCA `strokeWidth=2` — sempre `strokeWidth=1.5`

---

## 8. Processo de polish — passo a passo

Ao receber uma tela para lapidação:

1. **Ler o componente atual** — identificar todas as violações do checklist (seção 1)
2. **Listar os problemas** por categoria (superfícies, tipografia, estados, micro-interações)
3. **Priorizar** — quebras visuais > estados faltantes > micro-interações > densidade
4. **Corrigir em sequência** — nunca misturar lógica e estilo no mesmo diff
5. **Verificar tipos** — rodar `pnpm typecheck` após cada alteração
6. **Confirmar visualmente** — descrever o antes/depois de cada mudança

---

## 9. Anti-patterns a eliminar

| Anti-pattern | Correção |
|---|---|
| `style={{ color: '#F28705' }}` | `className="text-brand"` |
| `border-b border-gray-700` | Shift de background (`bg-surface-low`) |
| `overflow-y-auto` direto | `<ScrollArea>` Shadcn |
| `<div onClick>` clicável | `<Button variant="ghost">` |
| `text-white` / `text-black` | `text-on-surface` / `text-on-primary` |
| `bg-gray-800` | token de surface correspondente |
| Modal sem glassmorphism | `bg-surface-highest/80 backdrop-blur-[12px]` |
| Lista sem empty state | Adicionar template da seção 4 |
| Async sem loading state | Adicionar Skeleton (seção 5) ou botão com spinner (seção 6) |
| `strokeWidth=2` em Lucide | `strokeWidth={1.5}` |
| Números em `font-sans` | `font-mono` obrigatório |

---

## 10. Prompt de invocação

```
Lapide a tela [NOME].
Arquivo: @frontend/components/[feature]/NomeComponente.tsx

Siga .claude/skills/dev/ux-ui-adcraft.md.
1. Rode o checklist completo da seção 1
2. Liste todos os problemas encontrados
3. Corrija em ordem de prioridade
4. Descreva o antes/depois de cada mudança
```
