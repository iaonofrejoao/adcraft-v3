# BACKLOG v3 — AdCraft

> Consolidado de itens identificados durante estabilização 
> inicial (12/04/2026). Prioridade não é ordem de execução — 
> itens com dependência técnica entre si estão marcados.

---

## 🔥 Alta prioridade — afetam uso real

### Credenciais e configuração de produção

- [ ] **Configurar credencial real de search_web** (Serper, 
      Tavily, Brave ou similar). Hoje retorna mock — agentes 
      `avatar_research` e `market_research` estão gerando 
      output em cima de dados fake. Crítico antes de qualquer 
      uso em cliente real.
      Arquivo: `workers/lib/tools/web-search.ts`

- [ ] **Git config user.email fictício** (joao@adcraft.ai). 
      Trocar pelo email real vinculado ao GitHub antes do 
      primeiro push. Commits ficam sem vínculo ao perfil 
      até lá.

### Qualidade de classificação e reaproveitamento

- [ ] **Classificação de nicho: incluir description no texto 
      do embedding.** Hoje usa só `name + URL`. Produtos com 
      nome pouco descritivo (ex: "Mitolyn") ficam com score 
      baixo. Pré-requisito: adicionar `description` ao schema 
      `products` + `CreateProductSchema`. 
      Impacto esperado: score médio sobe, threshold pode 
      ficar mais seletivo (0.65 → 0.70).

- [ ] **Revisar threshold de niche_classification conforme 
      catálogo crescer.** 0.65 é razoável para os 12 nichos 
      atuais. Com 30+ nichos, produtos podem ficar ambíguos 
      entre 2-3 niches com scores próximos. Reavaliar 
      trimestralmente ou quando adicionar niches novos.

### Robustez do worker

- [ ] **Timeout pra tasks presas em `running` > 10min.** 
      Observado durante QA: task pode ficar `running` 
      indefinidamente se o worker crashar no meio (consome 
      slot de concorrência pra sempre). Adicionar cleanup 
      que detecta e marca como `failed` com erro claro.

- [ ] **Auditar outros lugares que leem de tabelas com RLS 
      sem passar service client** (padrão de bug do FAIL #3 — 
      planner.ts). Buscar chamadas a `createClient()` que 
      não injetam o service client em contextos server-side. 
      Risco: função "funciona" mas retorna vazio 
      silenciosamente.
      
- [ ] Worker: gravar version/commit hash no start pra facilitar 
      correlação entre retries e versões de código. No log:
      "[task-runner] starting — version 377cc52"

- [ ] Worker com hot reload (tsx --watch ou equivalente). 
      Ontem a gente gastou tempo descobrindo que o worker 
      estava rodando código antigo porque não tinha reload.
      Evitaria hipótese B viva hoje também.

---

## 🟡 Média prioridade — dívidas técnicas estruturais

### Jarvis e fluxo do usuário

- [ ] **`detectForceRefresh`: "atualizar" pode dar falso 
      positivo** quando houver fluxo de edição de produto via 
      Jarvis. Hoje "atualiza o nome do produto" vai disparar 
      refresh sem querer. Refinar pattern quando criar fluxo 
      de edição.

- [ ] **Pipeline approval via chat está quebrado** (observado 
      em QA). Enviar `{"message":"sim","pipeline_id":"..."}` 
      é ignorado pelo Jarvis — aprovação só funciona via 
      `PATCH /api/pipelines/:id {"status":"pending"}`. UX 
      ruim: usuário precisa mudar de contexto pra aprovar.

- [ ] **SSE do chat sem reconexão automática.** Se cair a 
      rede, Jarvis silencia e usuário não percebe.

- [ ] **JARVIS_MODEL hardcoded** em algum lugar — mover para 
      `agent-registry.ts` ou config central, padronizando 
      com os outros agentes.

### Documentação

- [ ] **Atualizar CLAUDE.md e PRD.md** com estado real após 
      estabilização. Fazer só quando o produto estiver 
      estável e em uso (evita retrabalho). Pendências 
      atuais que os arquivos não refletem:
      - Componentes "em construção" que já foram construídos
      - `classifyNicheAsync` fire-and-forget no cadastro
      - Lazy singleton do postgres client
      - Alias map de tools no gemini-client
      - Intent classifier `detectForceRefresh`

- [ ] **Avaliar se CLAUDE.md precisa de seção de índice de 
      arquivos críticos** (tipo "pra entender agentes leia X, 
      Y, Z"). Decidir depois de 1-2 sessões novas do Claude 
      Code — se ele estiver se perdendo, vale criar; se não, 
      ignorar.

### Testes e CI

- [ ] **Testes do circuit breaker** (budget_usd exceeded).
- [ ] **Testes do trigger SQL de copy_combinations** 
      (bloqueio de insert com componente rejeitado).
- [ ] **Avaliar Playwright** se regressões manuais começarem 
      a consumir muito tempo.

### Skill qa-runner — melhorias conhecidas

- [ ] **Adicionar cleanup agressivo no final.** Hoje cleanup 
      só apaga por prefixo `QA_`. Adicionar limpeza de 
      resíduos estruturais deixados por testes destrutivos:
      tasks órfãs (pipeline_id inexistente), pipelines com 
      budget_usd <= 0, approvals sem pipeline, etc.

- [ ] **FAIL #4 reporta label errado.** O erro original era 
      `pipelines.product_version` numa stack trace, mas foi 
      atribuído a `"products.product_version"`. A skill deve 
      capturar o nome completo da tabela do erro SQL.

- [ ] **Teste 30 (Unicode) é falso positivo** por transporte 
      PowerShell → curl. Marcar como "known limitation" ou 
      reescrever usando fetch nativo do Node em vez de shell.

- [ ] **Horário ideal pra rodar QA: madrugada Brasil** (menos 
      503 do Gemini). Documentar na seção de pré-requisitos 
      da skill.

### Schema e encoding

- [ ] **`llm_calls.error` não existe**. Logging de erros em 
      llm_calls não é suportado pelo schema atual — adicionar 
      coluna ou documentar ausência.

- [ ] **`copy_components.status` não existe**. Usa 
      `approved_at IS NULL` como proxy. Código que acessa 
      `.status` direto vai falhar. Adicionar coluna ou 
      refatorar callers.

- [ ] **`tasks.updated_at` não existe**. Referenciada em 
      documentação mas ausente do schema.

- [ ] **Platform defaulta para 'hotmart'** em produtos com 
      URL não reconhecida. Default deveria ser NULL ou 
      extraído da URL.

---

## 🟢 Baixa prioridade — limpeza e refino

### Redesign do frontend (planejado, não iniciado)

- [ ] **Refatorar UI** seguindo designs gerados no Google 
      Stitch (STITCH_PROMPTS.md). Fazer só depois do fluxo 
      real estar operacional e estável. Ordem por tela:
      1. Tela 1 (Chat com Jarvis) — mais crítica
      2. Tela 4 (Aprovação de Copies)
      3. Tela 2 (Lista de Produtos)
      4. Demais telas

- [ ] **Criar BRIEFING_REDESIGN.md** conforme for validando 
      designs no Stitch — anotar o que gostou/não gostou de 
      cada tela. Esse briefing vira input pro Claude Code 
      refatorar com fidelidade.

### Limpeza de código

- [ ] **14 `console.log` nos workers** — migrar para logger 
      estruturado ou remover.

- [ ] **Duplicação frontend/lib/tagging.ts vs workers/lib/
      tagging.ts** — verificar se são cópia, re-export ou 
      lógica divergente. Consolidar se divergente.

- [ ] **mermaid-renderer.ts já foi limpo** (niche_curator 
      removido). Apenas confirmar que não há outros 
      resíduos do refactor em outros arquivos.

- [ ] **evolucao.md** foi deletado no cleanup inicial — 
      provavelmente perda de histórico sem volta, só 
      registro.

### Anotações cosméticas

- [ ] **SKU format hex → A-Z já corrigido** em produtos 
      novos (migration 0009). Produtos antigos com SKU hex 
      (6923, 0735) continuam válidos — não renomear em 
      massa.

- [ ] **`POST /api/products` retorna 201 em vez de 200** 
      (semanticamente correto — Created). Skill qa-runner 
      espera 200. Ajustar a skill pra aceitar 2xx.

---

## ✅ Fechados hoje (12/04/2026)

Correções aplicadas e commitadas. Aqui pra referência rápida:

- `fix(qa): handle gemini tool name hallucinations via alias map`
- `fix(qa): apply pending migration adding confirmed_oversized to tasks`
- `fix(qa): resolve 3 bugs in product niche classification pipeline`
- `feat(seed): populate initial niches catalog with embeddings`
- `fix(qa): correct type mismatch in find_nearest_niche RPC`
- `fix(qa): planner uses service client and worker respects pipeline status`
- `fix(schema): resolve QA Grupo Z — SKU hex→A-Z, budget CHECK, tasks FK`
- `fix(jarvis): detect and persist force_refresh from natural language`
- `chore(qa): use semantically rich product names in qa-runner seed`

Falsos positivos do QA (nenhuma ação necessária):
- FAIL #2 (niche_id null em produtos QA sintéticos)
- FAIL #4 Subproblema B (label errado: products.product_version 
  vs pipelines.product_version)
- FAIL #5 (transporte PowerShell corrompendo emoji)

---

## 🔮 Ideias pra v3 (não priorizar ainda)

- Autenticação multi-usuário (hoje é single-user local)
- Integração com Meta Ad Library, YouTube Data API, Amazon
- Agentes que foram arquivados: scaler, performance_analyst, 
  utm_structurer, campaign_strategist, media_buyer, etc 
  (ver `prompts/_archive/v3-future/`)
- Dashboard de ROI: CAC/LTV por criativo gerado
- Modo colaborativo (review de copies em equipe)