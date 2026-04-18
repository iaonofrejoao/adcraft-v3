---
name: stitch-to-adcraft
description: >
  Converte exports do Google Stitch (.zip com index.html, DESIGN.md
  e screenshot.png) em componentes React para o AdCraft, usando
  Shadcn/ui e o design system Kinetic Console.
---

# SKILL: Stitch → AdCraft Component

## Arquivos recebidos por export
- index.html   → estrutura, hierarquia, estados interativos
- DESIGN.md    → tokens da tela (reconciliar com globals.css)
- screenshot   → referência visual para fidelidade pixel

## Processo obrigatório (nesta ordem)

### 1. Reconciliar tokens
Compare os valores de cor do DESIGN.md da tela com as CSS
variables em globals.css. Para cada token novo não mapeado:
  a) Adicionar CSS variable no :root do globals.css
  b) Adicionar alias no tailwind.config.ts
  NUNCA usar valores hex hardcoded em componentes.

### 2. Mapear visualmente o screenshot
Identificar:
- Layout macro: sidebar? grid? lista? modal? full-page?
- Nível de superfície correto para cada camada
- Componentes Shadcn que cobrem cada padrão visual
- Todos os estados: empty, loading, hover, active, error, disabled

### 3. Parsear o index.html
Extrair:
- Estrutura semântica real
- Textos e placeholders reais (nunca inventar conteúdo)
- Indicadores de estado interativo

### 4. Gerar o .tsx
Seguir TODAS as regras do skill frontend-adcraft.md.

## Mapeamento Stitch → Shadcn + Kinetic Console

| Padrão visual               | Shadcn base       | Regra AdCraft                          |
|-----------------------------|-------------------|----------------------------------------|
| CTA principal               | Button            | gradient from-[#F28705] to-[#FFB690]  |
| Botão secundário            | Button outline    | border-[#584237]/20                    |
| Botão ghost / icon          | Button ghost      | text-[#9E9489]                         |
| Campo de texto              | Input             | h-9 bg-[#1C1B1C]                      |
| Área de texto               | Textarea          | bg-[#1C1B1C]                          |
| Painel / workspace          | Card              | bg-[#201F20] border-0                 |
| Modal                       | Dialog            | glassmorphism obrigatório              |
| Dropdown / context menu     | DropdownMenu      | glassmorphism obrigatório              |
| Status label                | Badge             | statusClass vars                       |
| Abas                        | Tabs              | —                                      |
| Progresso                   | Progress          | [&>div]:bg-[#F28705]                  |
| Skeleton                    | Skeleton          | bg-[#2A2829]                          |
| Scroll com overflow         | ScrollArea        | —                                      |
| Checkbox / multi-select     | Checkbox          | —                                      |
| Notificação / feedback      | Sonner (toast)    | —                                      |

## Estrutura de saída
components/
  [feature]/
    index.tsx
    [SubComponente].tsx

## Processo visual obrigatório (screen.png)

Antes de escrever qualquer código, execute estes passos
em ordem e mostre o output de cada um:

1. Use a tool view para abrir screen.png da tela
2. Descreva em até 5 linhas o que você vê:
   - Layout macro (modal? página? painel lateral?)
   - Seções principais identificadas
   - Componentes de UI visíveis
   - Estados especiais (empty, loading, hover visíveis)
3. Compare a descrição com o code.html — se houver
   divergência, o screen.png tem prioridade
4. Só então inicie a conversão

## Mapeamento obrigatório Shadcn

Antes de criar qualquer elemento de UI, verifique se
existe componente Shadcn equivalente em components/ui/.
Uso obrigatório:

| Elemento visual            | Componente Shadcn                        |
|----------------------------|------------------------------------------|
| Abas de navegação          | Tabs + TabsList + TabsTrigger            |
| Lista com scroll           | ScrollArea                               |
| Ícone com texto de ajuda   | Tooltip + TooltipTrigger + TooltipContent|
| Menu de ação em card       | DropdownMenu + DropdownMenuTrigger       |
| Confirmação destrutiva     | AlertDialog                              |
| Separador semântico        | Separator                                |
| Modal / overlay            | Dialog + DialogPortal + DialogOverlay    |
| Progresso / loading bar    | Progress                                 |
| Estado de carregamento     | Skeleton                                 |
| Checkbox / multi-select    | Checkbox                                 |
| Select / combobox          | Select + SelectTrigger + SelectContent   |
| Campo de texto             | Input                                    |
| Área de texto              | Textarea                                 |
| Notificação / feedback     | Sonner (toast)                           |
| Badge de status            | Usar StatusBadge de @/components/ui      |

NUNCA criar elemento custom quando existir Shadcn equivalente.
NUNCA usar div clicável onde Button resolve.
NUNCA usar overflow-y-auto direto onde ScrollArea resolve.

## Prompt padrão de invocação
Converta o layout Stitch da tela [NOME].
Arquivos:
  @stitch/[nome]/index.html
  @stitch/[nome]/DESIGN.md
  @stitch/[nome]/screenshot.png

Siga .claude/skills/stitch-to-adcraft.md e
.claude/skills/frontend-adcraft.md.
Crie em components/[feature]/.
