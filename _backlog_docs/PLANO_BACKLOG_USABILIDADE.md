# Plano de Backlog — Usabilidade AdCraft V2

**Data:** 2026-04-16
**Itens:** 9 problemas de usabilidade
**Estratégia:** 3 rodadas curtas, cada uma focada. Commit entre rodadas.

---

## 📋 Resumo Executivo

| Rodada | Foco | Itens | Duração | Prioridade |
|--------|------|-------|---------|------------|
| 1 | Bugs críticos | 1, 7 | 30-60 min | 🔴 Imediato |
| 2 | Produto + Demandas | 2, 3, 4, 5, 8 | 2-3h | 🟡 Alta |
| 3 | Polish + Design | 6, 9 | 2-4h | 🟢 Média |

**Total:** 5-8h de trabalho focado.

**Regra de ouro:** commit entre rodadas. Validar cada rodada antes de seguir. Se algo da Rodada 1 quebrar, não avance.

---

# 🔴 RODADA 1 — Bugs Críticos

**Objetivo:** Resolver os dois bloqueadores funcionais. Sem isso, o sistema não serve pra uso real.

**Itens:**
- #1 Não está adicionando produtos na tela de produtos
- #7 Menu de sub-abas sumiu em `/products/[id]/copies`

## Prompt para Claude Code — Rodada 1

```
Preciso corrigir 2 bugs críticos do AdCraft V2. Antes de qualquer coisa, leia:
- frontend/app/products/page.tsx
- frontend/app/products/new/page.tsx (ou onde é o form de criar produto)
- frontend/app/products/[id]/page.tsx
- frontend/app/products/[id]/copies/page.tsx
- frontend/components/products/ (layout/tabs do produto)
- backend/app/routes/products.py (ou workers equivalente)

## BUG 1 — Não está adicionando produtos na tela

Sintoma: usuário preenche o form de criar produto em /products/new e o produto
não aparece na listagem /products.

Investigar:
1. O POST está chegando no backend? (conferir logs)
2. O backend retorna 200/201? Se sim, o produto foi salvo?
   → Query: SELECT * FROM products ORDER BY created_at DESC LIMIT 5;
3. Se o produto foi salvo, o GET de /products está filtrando errado?
   → Pode ser filtro por user_id, RLS, status, etc.
4. Se o produto NÃO foi salvo, qual é o erro?
   → Validação Zod? Campo obrigatório faltando? Foreign key?

Correção: identificar a causa raiz e corrigir. Não fazer workaround.
Adicionar toast de sucesso/erro claro na UI após submit.
Redirecionar para /products após criação bem-sucedida.

## BUG 2 — Menu de sub-abas sumiu em /products/[id]/copies

Sintoma: as sub-abas (Mercado, Personas, Copy, Criativos, Campanhas, Histórico)
existem em /products/[id] mas sumiram em /products/[id]/copies.

Provável causa:
- O layout compartilhado (/products/[id]/layout.tsx) não está sendo herdado pela
  sub-rota /copies, OU
- A página /copies renderiza seu próprio layout sem importar o componente de tabs.

Correção: garantir que todas as sub-rotas de /products/[id]/* usem o mesmo layout
com o menu de tabs. O Next.js App Router faz isso naturalmente via layout.tsx —
conferir se existe e se está correto.

Critério de aceite: menu aparece em TODAS as sub-rotas:
- /products/[id]
- /products/[id]/copies
- /products/[id]/personas (se existir)
- /products/[id]/criativos
- /products/[id]/campanhas
- /products/[id]/historico

## Ao final
- Commit com mensagem: "fix: restore product creation and tabs in copies route"
- Me mostre o que causou cada bug e o fix aplicado
- Rode um teste manual: crie 1 produto e navegue em todas as sub-abas
```

### Critério de Aceite — Rodada 1

- [ ] Criar produto funciona e ele aparece em `/products`
- [ ] Menu de tabs aparece em todas as sub-rotas de `/products/[id]/*`
- [ ] Toast de sucesso aparece ao criar
- [ ] Commit feito

---

# 🟡 RODADA 2 — Produto + Demandas

**Objetivo:** Melhorar fluxo operacional do dia-a-dia. Onde você vai passar mais tempo.

**Itens:**
- #2 Subir VSL como insumo do produto
- #3 Popup de detalhes ao clicar na demanda (kanban e lista)
- #4 Card de produto com nota + ícones + remover botões
- #5 Editar nome + ativar/desativar produto
- #8 Hyperlink clicável nas respostas do Jarvis

## Prompt para Claude Code — Rodada 2

```
Melhorias de UX em /products e /demandas. Antes de começar, leia:
- frontend/app/products/page.tsx (listagem, cards)
- frontend/app/products/[id]/page.tsx (detalhe)
- frontend/app/products/new/page.tsx (form criação)
- frontend/app/demandas/page.tsx (com view=list e view=kanban)
- frontend/components/demandas/ (cards de demanda)
- frontend/components/jarvis/ChatMessage.tsx (renderização de mensagens)
- backend/app/models/product.py (schema de produto)
- backend/app/routes/products.py

## Feature 2 — Upload de VSL como insumo do produto

Adicionar na tela de criação E edição de produto:
- Campo "VSL (Video Sales Letter)" com upload de arquivo (mp4, mov, webm — max 500MB)
- OU campo URL (link direto pra VSL hospedada)
- Storage: usar Cloudflare R2 (já configurado no projeto)
- Salvar na tabela products:
  - vsl_url TEXT (URL do R2 ou URL externa)
  - vsl_uploaded_at TIMESTAMPTZ
  - vsl_duration_seconds INT (extrair via ffprobe se upload)

Criar migration nova `db/019_product_vsl.sql` adicionando essas colunas se ainda
não existirem.

Backend: novo endpoint POST /api/products/[id]/vsl que recebe arquivo OU URL,
valida, faz upload no R2 se arquivo, atualiza o produto.

Frontend: componente <VSLUpload productId={...} /> com drag-and-drop e preview
do vídeo após upload. Usar o componente de Upload do Shadcn se disponível.

## Feature 3 — Popup de detalhes da demanda

Em /demandas (tanto view=list quanto view=kanban):
- Ao clicar em qualquer demanda/card, abrir Dialog/Modal (Shadcn Dialog)
- Modal mostra resumo da demanda:
  - Produto associado (com link)
  - Status geral
  - Agente atual rodando (se em progresso)
  - Últimas 3 atualizações
  - Custo acumulado
  - Botão "Ver detalhes completos" → navega pra /demandas/[id]
  - Botão "Cancelar demanda" (se em progresso)

Componente reutilizável: <DemandaDetailModal demandaId={...} onClose={...} />

O modal usa os mesmos dados que /demandas/[id] já tem — só muda a apresentação
(resumida em vez de completa).

## Feature 4 — Card de produto melhorado

Em /products, refatorar o card do produto:

REMOVER:
- Botão "Criar cópia"
- Botão "Copies" (ou qualquer botão redundante)

ADICIONAR:
- Nota/score de viabilidade do produto (0-10, vindo do estudo de mercado)
- Linha de ícones de status com tooltip:
  - 🔍 Estudo de mercado (cinza = não feito, verde = feito)
  - 👤 Persona/Avatar (cinza/verde/amarelo dependendo se tem 1+ persona)
  - ✍️ Copy (cinza/verde se tem copies geradas)
  - 🎬 Vídeo (cinza/verde se tem criativos de vídeo)
  - 📢 Campanha (cinza/verde se tem campanha ativa)

Layout sugerido do card:
```
┌─────────────────────────────────────┐
│  [Nome do Produto]          [⚙️]    │
│  Nicho • Plataforma                 │
│                                     │
│  Nota: 8.2/10                       │
│  🔍 👤 ✍️ 🎬 📢                       │
│                                     │
│  Atualizado há 2 dias               │
└─────────────────────────────────────┘
```

Componente: <ProductCard product={...} />
Estado de cada ícone vem do backend via GET /api/products/[id]/summary que
retorna booleans de cada sinal.

## Feature 5 — Editar nome + ativar/desativar produto

Na tela de detalhe do produto (/products/[id]):
- Nome do produto agora é editável inline (clicar no nome → vira input → salvar)
  OU botão "Editar" ao lado do nome abre modal
- Toggle "Ativo/Inativo" no header
  - Inativo = não aparece em listagens por padrão (filtrar com checkbox "Mostrar inativos")
  - Inativo = Jarvis não dispara pipelines automaticamente

Schema: tabela products já deve ter coluna status — confirmar. Se não tiver,
adicionar na migration 019:
- status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived'))

Backend: PATCH /api/products/[id] aceita { name?, status? }

## Feature 8 — Hyperlink clicável no Jarvis

Hoje Jarvis retorna algo como:
"Pipeline em execução! 1 tasks enfileiradas. Acompanhe o progresso em
/demandas?pipeline=c039c35e-..."

Queremos:
"Pipeline em execução! 1 tasks enfileiradas. Acompanhe o progresso em
[Demanda CitrusBurnX #c039c35e]" — onde [...] é um link clicável.

Como fazer:
1. No lado do Jarvis (system prompt ou tool response), retornar markdown com
   link: [Demanda CitrusBurnX #c039](/demandas?pipeline=c039c35e-...)
2. No frontend, o renderer de mensagens (ChatMessage.tsx) já deve ter suporte a
   markdown via react-markdown. Se não tem, adicionar.
3. O nome da demanda: "Demanda [Nome do Produto] #[primeiros 4 chars do UUID]"
4. Links internos (/demandas, /products) devem usar Next Link component, não
   window.open — evitar reload de página.

Tool response pattern:
```typescript
return {
  message: "Pipeline em execução! 1 task enfileirada.",
  links: [
    { label: `Demanda ${productName} #${pipelineId.slice(0,4)}`, url: `/demandas?pipeline=${pipelineId}` }
  ]
}
```

O frontend renderiza automaticamente `message` + `links` em markdown.

## Ao final
- Commit com mensagem: "feat: product improvements (VSL, card, toggle) + demanda modal + jarvis links"
- Testar manualmente cada feature
- Atualizar screenshots no README se houver
```

### Critério de Aceite — Rodada 2

- [ ] Upload de VSL funciona (arquivo OU URL)
- [ ] Clicar em demanda abre modal de detalhes em ambas views
- [ ] Card de produto mostra nota e ícones de status
- [ ] Editar nome funciona inline
- [ ] Toggle ativo/inativo funciona
- [ ] Links nas respostas do Jarvis são clicáveis e navegam sem reload
- [ ] Commit feito

---

# 🟢 RODADA 3 — Polish + Design

**Objetivo:** Ajustes finos de tom e consistência visual.

**Itens:**
- #6 Tornar o Jarvis menos "chegado" (mais profissional, menos íntimo)
- #9 Aplicar componentes Shadcn em todas as páginas

## ⚠️ Clarificação necessária sobre item 6

"Chegado" pode significar duas coisas bem diferentes. Antes de rodar a Rodada 3,
confirma comigo:

**Opção A — Menos íntimo, mais profissional:**
Jarvis trata você com formalidade, sem brincadeira, sem "cara/mano", sem emojis.
Tom: "Pipeline iniciado. Acompanhe em [link]."

**Opção B — Menos apressado, pensa mais antes de agir:**
Jarvis hoje dispara ações rápido demais. Você quer que ele reflita, confirme
antes, pergunte clarificações.

**Opção C — Menos verboso, respostas mais curtas:**
Jarvis está falando demais. Você quer respostas diretas, sem rodeios.

→ Confirma qual é antes de aplicar o prompt da Rodada 3.

## Prompt para Claude Code — Rodada 3

```
Polish final do AdCraft V2. Duas mudanças principais.

## Mudança 6 — Ajustar tom do Jarvis

[PREENCHER DEPOIS DE CONFIRMAR COM JOÃO qual das opções A/B/C]

Editar o system prompt do Jarvis em:
- frontend/lib/jarvis/system_prompt.ts (ou equivalente)

Mudanças no prompt:
- Remover instruções que encorajam intimidade/informalidade excessiva
- Adicionar: "Seja profissional e objetivo. Evite expressões casuais demais."
- Adicionar exemplos de tom desejado (3-4 interações modelo)
- Manter: capacidade de ser amigável sem ser "colega"

Se opção B: adicionar regra "Sempre confirme ações destrutivas ou de alto
impacto (disparar pipeline, modificar dados) antes de executar."

Se opção C: adicionar regra "Respostas devem ser diretas. Máximo 3 parágrafos
a menos que usuário peça detalhes."

## Mudança 9 — Aplicar Shadcn em todas as páginas

Contexto: o projeto já tem Shadcn configurado, mas não foi aplicado em várias
páginas. Quero consistência visual.

Páginas a auditar:
- /products (listagem e cards)
- /products/new (form)
- /products/[id] (detalhe)
- /products/[id]/copies, /personas, /criativos, /campanhas, /historico
- /demandas (lista e kanban)
- /demandas/[id]
- /insights
- / (home com chat do Jarvis)

Para cada página:
1. Substituir elementos HTML puros por componentes Shadcn onde aplicável:
   - <input> → <Input />
   - <button> → <Button />
   - <select> → <Select />
   - <textarea> → <Textarea />
   - divs com estilo de card → <Card />
   - modais ad-hoc → <Dialog />
   - tabs custom → <Tabs />
   - tabelas → <Table />
   - dropdowns → <DropdownMenu />
   - toasts → <Toast /> via sonner
   - forms → <Form /> (react-hook-form + zod)
   - tooltips → <Tooltip />
   - skeletons → <Skeleton />

2. Remover CSS inline (style={{}}) e classes ad-hoc. Usar Tailwind + variantes
   do Shadcn.

3. Garantir theming consistente:
   - Cores via CSS variables do theme
   - Dark mode funcionando em TODAS as páginas (se o projeto suporta)
   - Espaçamentos padronizados (gap-4, p-6, etc)

4. Não quebrar funcionalidade existente. Ao final, rodar teste manual em cada
   página.

IMPORTANTE:
- NÃO refatorar lógica de negócio — apenas troca de componentes visuais
- NÃO mudar rotas ou endpoints
- Se algum componente Shadcn não existe, adicionar via npx shadcn-ui@latest add [componente]

## Ao final
- Commit 1: "refactor: adjust jarvis tone (professional)"
- Commit 2: "refactor: migrate all pages to shadcn components"
- Lista de componentes adicionados via shadcn-ui CLI
- Screenshots antes/depois de 3 páginas principais
```

### Critério de Aceite — Rodada 3

- [ ] Jarvis tem tom ajustado conforme escolha (A/B/C)
- [ ] Todas as 10+ páginas usam Shadcn consistentemente
- [ ] Dark mode funciona em todas (se aplicável)
- [ ] Nenhuma funcionalidade quebrou
- [ ] Commits separados por mudança

---

## 🔍 Validação Final

Após as 3 rodadas, fazer um tour rápido pelo sistema:

1. Criar um produto novo com VSL (#1, #2)
2. Abrir /products e conferir cards (#4)
3. Abrir detalhe do produto (#5, #7)
4. Navegar entre sub-abas do produto (#7)
5. Editar nome e desativar produto (#5)
6. Disparar pipeline via Jarvis, clicar no link retornado (#8)
7. Ir em /demandas e clicar em uma demanda para ver popup (#3)
8. Conversar com Jarvis em diferentes contextos (#6)
9. Conferir se design está consistente (#9)

**Critério geral de sucesso:** tour completo sem bugs, UX fluida, design coeso.

---

## 📝 Notas Estratégicas

1. **Ordem importa.** Rodada 1 antes de tudo — não adianta polir design se não
   consegue criar produto. Rodada 2 traz o maior valor operacional. Rodada 3 é
   o toque final.

2. **Tempo entre rodadas.** Vale uma pausa de pelo menos 30 min entre rodadas
   pra você validar com cabeça fresca. Erro comum: emendar tudo e não testar.

3. **Shadcn (#9) é o maior.** Se der pra testar a Rodada 2 durante 1-2 dias
   antes de mexer no Shadcn, melhor. Refactor de design em cima de funcionalidade
   recém-adicionada tem mais risco de regressão.

4. **Backlog de amanhã.** Quando terminar, provavelmente vão surgir mais 3-5
   itens de polish. Anote e faz outra rodada futura — não tenta arrumar tudo
   de uma vez.

---

**FIM DO PLANO**

Responde sobre o item 6 (A/B/C) e você já pode começar pela Rodada 1.
