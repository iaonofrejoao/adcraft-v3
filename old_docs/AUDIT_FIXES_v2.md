# AUDIT_FIXES_v2.md — Plano revisado pós-Correção 1

**Status inicial:**
- ✅ Correção 1 (embeddings via gemini-client) — FEITA, commitada
- ✅ Correção 9.5 (payload jsonb em llm_calls) — FEITA, commitada
- ⏳ Próxima: Correção 2

**Como usar este documento:**
1. Abra a Correção atual
2. Copie o bloco de prompt (tudo entre as linhas de `---PROMPT---`)
3. Cole no Claude Code na raiz do projeto
4. Espere terminar
5. Confira os critérios de validação da seção "Validação"
6. Se tudo ok → commite com a mensagem sugerida
7. Se algo falhar → **PARE e me chame** (não tente consertar sozinho)
8. Pause entre correções. Não encadeie sem revisar.

**Regras globais que valem pra todas as correções:**
- Claude Code NÃO pode fazer "melhorias" ou "refactors adicionais" fora do escopo
- Se ele oferecer algo extra, recuse: "Apenas o que o prompt pede"
- Se ele descobrir algo inesperado (arquivo não existe, tabela faltando, etc), pare e me chame
- Commit é OBRIGATÓRIO após cada correção antes da próxima
- Se qualquer verificação falhar, PARE

---

## Correção 2 — Prompt cache real via REST API

**Severidade:** crítico
**Por quê:** `workers/lib/llm/prompt-cache.ts` é mock atualmente. Gera nomes fake de cache sem chamar a API do Gemini. Zero economia real.

### Contexto específico pro Claude Code
- O projeto adotou padrão de **fetch puro** no cliente LLM (decisão da Correção 1)
- `workers/lib/llm/prompt-cache.ts` ainda importa `@google/genai` — essa importação precisa ser removida
- A API do Gemini Cache existe via REST em `https://generativelanguage.googleapis.com/v1beta/cachedContents`

---PROMPT---

Reescreva workers/lib/llm/prompt-cache.ts com implementação REAL 
do Gemini Cache API via fetch puro. Remova completamente o import 
de @google/genai — este arquivo deve seguir o mesmo padrão que 
workers/lib/llm/gemini-client.ts adota (fetch puro, sem SDK).

Requisitos:

1. Endpoint base: https://generativelanguage.googleapis.com/v1beta
2. Autenticação: header x-goog-api-key com GEMINI_API_KEY do env
3. Função principal exportada:

   async function createOrGetCache(params: {
     cache_key: string;
     content: string;
     model: string;  // 'gemini-2.5-pro' ou 'gemini-2.5-flash'
     ttl_seconds?: number;  // default 3600
   }): Promise<{ cache_name: string; cached_tokens: number } | null>

   Lógica:
   a) Consulta tabela prompt_caches por cache_key. Se existe e 
      expires_at > now(), retorna { cache_name: gemini_cache_name, 
      cached_tokens: <contado antes ou estimado len(content)/4> }
   b) Se não existe ou expirou, estima tokens do content como 
      Math.ceil(content.length / 4). Se < 4096, retorna null 
      (cache não vale a pena abaixo desse limite).
   c) Se >= 4096, faz POST fetch para 
      /v1beta/cachedContents com body:
      {
        model: `models/${model}`,
        contents: [{ role: 'user', parts: [{ text: content }] }],
        ttl: `${ttl_seconds}s`
      }
   d) Recebe resposta com cached_content.name (ex: 
      "cachedContents/abc123"). Salva em prompt_caches com:
        - cache_key
        - gemini_cache_name = name retornado
        - expires_at = now() + ttl_seconds
        - created_at = now()
      Se já existe linha com mesmo cache_key (race), faz UPSERT.
   e) Retorna { cache_name, cached_tokens: tokens_estimados }

4. Função auxiliar exportada para limpeza:

   async function invalidateCache(cache_key: string): Promise<void>
   - Deleta da tabela prompt_caches
   - Opcionalmente chama DELETE /v1beta/cachedContents/{name} no Gemini

5. Tratamento de erro:
   - Se o fetch retornar erro HTTP, logar e retornar null (fallback 
     gracioso: sem cache é melhor que quebrar)
   - Se a API rejeitar o cache por tokens insuficientes (erro 
     400 específico do Gemini), retornar null sem logar como erro

6. NÃO faça mock. Se a API falhar no dev local, deixe o erro 
   propagar visível no console.

Depois do arquivo pronto:

7. Em workers/lib/llm/gemini-client.ts, dentro de callAgent, 
   antes de construir a request principal:
   - Monte o "conteúdo estático" combinando system prompt do 
     agente + niche learnings injetados (esses dois componentes 
     são estáveis entre chamadas do mesmo agente no mesmo nicho)
   - Chame createOrGetCache com cache_key formado como 
     `${agent_name}:${niche_slug}` e o model do registry
   - Se retornar cache_name: adicione ao body da request principal 
     o campo `cachedContent: cache_name` E remova o conteúdo 
     estático das mensagens inline (pra não duplicar)
   - Se retornar null: envia tudo inline normalmente

8. Quando for logar em llm_calls após a chamada, extraia 
   cached_input_tokens de response.usageMetadata.cachedContentTokenCount 
   se presente, senão 0.

9. Rode verificação: 
   grep -rn "@google/genai\|GoogleGenerativeAI" --include="*.ts" .
   Deve retornar vazio (ou só comentários, não imports).

Ao final, mostre:
- Diff completo de workers/lib/llm/prompt-cache.ts
- Diff das mudanças em workers/lib/llm/gemini-client.ts (só as 
  linhas novas relacionadas a cache)
- Output do grep de verificação
- Pare e aguarde minha aprovação antes de commitar qualquer coisa

---PROMPT---

### Validação
- [ ] Grep de `@google/genai` retorna **vazio** (era a última violação pré-existente)
- [ ] `prompt-cache.ts` usa fetch, não SDK
- [ ] `gemini-client.ts` chama `createOrGetCache` antes da request principal em `callAgent`
- [ ] Não há commits antes de validar

### Se tudo ok
```bash
git add .
git commit -m "fix(audit): implement real gemini prompt cache via REST API"
```

### Se falhar
**PARE.** Me chame com: o output dos 3 diffs, o output do grep, e qualquer erro que apareceu.

---

## Correção 3 — `lib/tagging.ts` ausente

**Severidade:** crítico
**Por quê:** Convenção de tagging não tem implementação centralizada. Tags são geradas inline pelo código sem validação nem testes.

### Contexto
- O projeto tem `workers/` (backend) e `frontend/` (Next.js)
- O tagging é usado pelos dois lados, então precisa ficar num lugar que ambos consigam importar
- Escolha: `workers/lib/tagging.ts` E `frontend/lib/tagging.ts` como cópias, OU um único arquivo compartilhado

---PROMPT---

Crie uma implementação canônica de tagging do AdCraft v2. O 
formato é: SKU_v{N}_H{n} para hooks, SKU_v{N}_B{n} para bodies, 
SKU_v{N}_C{n} para CTAs, SKU_v{N}_H{n}_B{n}_C{n} para combinações, 
SKU_v{N}_H{n}_B{n}_C{n}_V{n} para vídeos. SKU tem 4 letras 
maiúsculas, versão é inteiro positivo (v1, v2...), slots de hook/
body/cta vão de 1 a 3, slots de vídeo são inteiros positivos.

Localização:
- Crie workers/lib/tagging.ts como fonte canônica
- Crie frontend/lib/tagging.ts que re-exporta do workers via 
  import relativo (se o tsconfig permitir) OU duplica o mesmo 
  código (aceitável dado o tamanho pequeno)
- Decida qual estratégia usar depois de verificar se o tsconfig 
  do frontend permite imports cross-package. Me informe a decisão 
  antes de aplicar.

Funções a exportar (em workers/lib/tagging.ts):

  type TagType = 'hook' | 'body' | 'cta' | 'combination' | 'video';
  
  interface TagParts {
    sku: string;
    version: number;
    hookSlot?: number;
    bodySlot?: number;
    ctaSlot?: number;
    videoSlot?: number;
    type: TagType;
  }
  
  export function buildHookTag(sku: string, version: number, slot: number): string
  export function buildBodyTag(sku: string, version: number, slot: number): string
  export function buildCtaTag(sku: string, version: number, slot: number): string
  export function buildCombinationTag(sku: string, version: number, h: number, b: number, c: number): string
  export function buildVideoTag(sku: string, version: number, h: number, b: number, c: number, v: number): string
  export function parseTag(tag: string): TagParts | null
  export function validateTag(tag: string): boolean

Validações em cada build:
- SKU deve matchear /^[A-Z]{4}$/ (exatamente 4 maiúsculas)
- version deve ser inteiro >= 1
- slots H/B/C devem estar em {1, 2, 3}
- videoSlot deve ser inteiro >= 1
- Inputs inválidos lançam Error com mensagem clara

Regex de validação para validateTag:
  /^[A-Z]{4}_v\d+(_H[1-3]_B[1-3]_C[1-3](_V\d+)?)?$|^[A-Z]{4}_v\d+_[HBC][1-3]$/

parseTag deve retornar null (não lançar) se o tag for inválido, 
com type inferido do padrão.

Crie workers/lib/tagging.test.ts com pelo menos 20 testes:
- 5 testes: build correto de cada tipo
- 5 testes: roundtrip build → parse → build idêntico
- 5 testes: rejeição de SKUs inválidos (minúsculas, 3 letras, 5 
  letras, números, vazio)
- 3 testes: rejeição de versões inválidas (0, -1, 1.5)
- 2 testes: rejeição de slots fora de 1-3

Rode os testes:
  cd workers && pnpm test lib/tagging.test.ts
(ou comando equivalente que o projeto usa)

Mostre o output. Todos devem passar.

Depois, faça busca no código por geração inline de tags:
  grep -rn "_v\${" --include="*.ts" workers/ frontend/
  grep -rn "_H1\|_B1\|_C1\|_V1" --include="*.ts" workers/ frontend/

Para cada match que parece ser geração de tag (não é comentário, 
não é teste), LISTE em formato:
  - arquivo:linha — trecho atual — tag sendo construída

NÃO substitua ainda. Só liste. Aguarde minha revisão.

---PROMPT---

### Validação
- [ ] Arquivo `workers/lib/tagging.ts` criado
- [ ] Testes todos passando (output visível)
- [ ] Lista de substituições candidatas mostrada
- [ ] Decisão sobre re-export vs duplicação no frontend foi informada

### Se tudo ok
**NÃO COMMITE AINDA.** Depois que ver a lista de substituições, me chame pra revisar a lista. Se você aprovar, roda este segundo prompt:

---PROMPT-SUBSTITUIÇÕES---

Aplique as substituições que você listou antes, trocando cada 
geração inline de tag por chamada às funções de workers/lib/tagging.ts.

Para cada substituição:
1. Edite o arquivo trocando o código inline pela função apropriada
2. Adicione o import no topo se não existir
3. Ao final liste o que foi substituído em formato:
   - arquivo:linha — ANTES: ... — DEPOIS: ...

Depois, rode:
  grep -rn "_v\${" --include="*.ts" workers/ frontend/

Deve retornar vazio (ou só arquivos de teste e tagging.ts).

Se algum arquivo não puder ser substituído (ex: lógica complexa 
que não bate com as funções), PARE e me informe qual.

---PROMPT-SUBSTITUIÇÕES---

### Commit (só depois da validação + substituição)
```bash
git add .
git commit -m "fix(audit): centralize tagging convention with tests and replace inline usages"
```

---

## Correção 4 — Cap de 5 vídeos no video_maker

**Severidade:** crítico econômico

---PROMPT---

Em workers/agents/video-maker.ts, adicione hard cap de 5 vídeos 
por execução.

1. Adicione no topo do arquivo:
   const MAX_VIDEOS_PER_RUN = 5;

2. No início da função principal (antes do loop de geração), 
   adicione a validação:

   if (selectedCombinations.length > MAX_VIDEOS_PER_RUN) {
     if (!task.confirmed_oversized) {
       await createApproval({
         pipeline_id: task.pipeline_id,
         task_id: task.id,
         approval_type: 'video_cap_exceeded',
         payload: {
           requested: selectedCombinations.length,
           cap: MAX_VIDEOS_PER_RUN,
           estimated_cost_usd: Number((selectedCombinations.length * 5.5).toFixed(2))
         }
       });
       await updatePipelineStatus(task.pipeline_id, 'paused');
       return { status: 'awaiting_approval', reason: 'video_cap_exceeded' };
     }
   }

3. Verifique se a tabela tasks tem coluna confirmed_oversized. 
   Rode: 
   SELECT column_name FROM information_schema.columns 
   WHERE table_name='tasks' AND column_name='confirmed_oversized';
   
   Se não existir, crie nova migration em migrations/v2/ com:
   ALTER TABLE tasks ADD COLUMN IF NOT EXISTS confirmed_oversized boolean DEFAULT false;
   
   Aplique a migration.

4. Em workers/agents/prompts/video_maker.md (ou arquivo de prompt 
   do agente), adicione nota no topo explicando o cap.

5. No prompt do Jarvis (procure em prompts/ ou 
   workers/agents/prompts/ qual é o arquivo ativo), adicione 
   seção sobre como lidar com approval 'video_cap_exceeded':
   - Quando receber esse approval, Jarvis apresenta custo total 
     ao usuário
   - Pede confirmação dupla: "Você selecionou N combinações. 
     Custo total estimado: $X. Confirma?"
   - Se usuário confirma, setar confirmed_oversized=true na task 
     e retomar pipeline
   - Se cancela, liberar pipeline ou solicitar nova seleção

Mostre:
- Diff de workers/agents/video-maker.ts
- Arquivo de migration criado (se foi necessário)
- Diff do prompt do Jarvis
- Output da query SQL confirmando a coluna

Não commite. Aguarde confirmação.

---PROMPT---

### Validação
- [ ] Constante `MAX_VIDEOS_PER_RUN = 5` no topo
- [ ] Check acontece antes do loop de geração
- [ ] Migration criada se era necessária
- [ ] Query SQL mostra a coluna existindo

### Commit
```bash
git add .
git commit -m "fix(audit): enforce 5-video cap in video_maker with confirmation flow"
```

---

## Correção 5 — Remover `niche_curator` do registry

**Severidade:** alto

---PROMPT---

Remova niche_curator de workers/lib/agent-registry.ts. O registry 
deve conter EXATAMENTE 6 agentes: avatar_research, market_research, 
angle_generator, copy_hook_generator, anvisa_compliance, video_maker.

niche_curator é um job agendado, não um agente de pipeline. Já 
existe cron em workers/cron/niche-curator-cron.ts — verifique 
que ele usa callAgent de workers/lib/llm/gemini-client.ts 
passando agent_name='niche_curator' para que o logging em 
llm_calls ainda funcione.

Se o cron não usa callAgent mas sim outra forma, refatore-o para 
usar callAgent (mantendo o padrão da Regra 18).

Verifique que nenhum código em workers/lib/ (especialmente 
seed-next-task.ts, planner, task-runner) inclui niche_curator 
na lista de agentes válidos. Se incluir, remova.

Atualize PRD_v2.md seção 4 adicionando subseção "4.5 Jobs 
agendados" com texto curto:
  "niche_curator é um job agendado (cron diário 4h), não um 
  agente de pipeline. Ele consome sinais de aprovação/rejeição 
  de componentes e produz niche_learnings consolidados. Não 
  entra no agent-registry nem é orquestrado pelo planner."

Verificação final:
  grep -n "niche_curator" workers/lib/agent-registry.ts
Deve retornar vazio.

Mostre: diff do agent-registry, diff do cron se mudou, diff do 
PRD, e output do grep final. Aguarde aprovação.

---PROMPT---

### Validação
- [ ] Grep final retorna vazio
- [ ] Cron usa `callAgent` (passa pelo cliente canônico)
- [ ] PRD atualizado

### Commit
```bash
git add .
git commit -m "refactor(audit): move niche_curator from registry to scheduled job"
```

---

## Correção 6 — Migration fora de v2/

**Severidade:** alto
**Atenção:** este prompt é de investigação primeiro. Não executa ação sem sua confirmação.

---PROMPT---

A migration migrations/0000_gifted_lyja.sql está na raiz de 
migrations/ em vez de migrations/v2/. Preciso movê-la sem 
quebrar o Drizzle.

Etapa 1 — Investigação:

Execute contra o banco:
  SELECT hash, created_at FROM drizzle.__drizzle_migrations 
  WHERE hash LIKE '%gifted_lyja%' OR hash LIKE '%0000%';

Mostre o resultado.

Se retornar linha(s) mencionando gifted_lyja, a migration já 
foi aplicada. PARE e me informe — nesse caso precisa intervenção 
manual cuidadosa no registro interno do Drizzle.

Se não retornar nada mencionando gifted_lyja, a migration nunca 
foi aplicada e pode ser movida sem dor.

Etapa 2 — Mover (apenas se a etapa 1 mostrou que nunca foi aplicada):

1. Verifique se o conteúdo de migrations/0000_gifted_lyja.sql 
   conflita com algum arquivo já existente em migrations/v2/ 
   (especificamente migrations/v2/0000_mean_greymalkin.sql). 
   Compare os dois arquivos.

2. Se os conteúdos são DIFERENTES e ambos precisam existir:
   - Renomeie 0000_gifted_lyja.sql para um número sequencial 
     livre em migrations/v2/ (ex: 0004_from_old_location.sql)
   - Mova pra migrations/v2/
   - Atualize migrations/v2/meta/_journal.json se necessário 
     (Drizzle pode reclamar se o journal não bater)

3. Se os conteúdos são IDÊNTICOS ou o gifted_lyja está obsoleto:
   - Delete migrations/0000_gifted_lyja.sql
   - Não precisa criar nada novo em v2/

4. Verifique que drizzle.config.ts aponta para migrations/v2/ 
   como dir ativo.

5. Rode pnpm drizzle-kit check ou equivalente e mostre o output. 
   Não deve haver erros de drift ou missing migrations.

Mostre todos os passos executados e pare antes de commitar.

---PROMPT---

### Validação
- [ ] Query inicial mostrou estado real
- [ ] Conteúdos comparados antes de decidir
- [ ] `drizzle-kit check` passa sem erro

### Se der qualquer sinal estranho
PARE e me chame com o output.

### Commit
```bash
git add .
git commit -m "fix(audit): reorganize stray migration into v2 directory"
```

---

## Correção 7 — Arquivar backend/ Python

**Status:** ✅ JÁ FEITO no cleanup inicial (commit baseline)

Pula essa correção. Marca como concluída.

---

## Correção 8 — RLS completo

**Severidade:** alto

---PROMPT---

Crie nova migration em migrations/v2/ com próximo número 
sequencial disponível, nome sugerido XXX_complete_rls.sql, 
ativando RLS em todas as tabelas v2 que ainda não têm.

Etapa 1 — Planejamento (reporte antes de gerar SQL):

Para cada tabela abaixo, leia o schema (arquivos em 
migrations/v2/ ou frontend/lib/schema/) e determine a estratégia 
de policy:

Tabelas: tasks, approvals, copy_components, copy_combinations, 
product_knowledge, niche_learnings, embeddings, messages, 
prompt_caches, llm_calls

Para cada tabela, indique:
A) Tem user_id direto? → policy simples: WHERE user_id = auth.uid()
B) Pertence a pipeline? → JOIN com pipelines verificando user_id
C) Pertence a product? → JOIN com products verificando user_id
D) É global/polimórfica (embeddings, prompt_caches)? → policy 
   especial, me explique qual você propõe

Mostre a lista em formato:
  tabela_X — estratégia A/B/C/D — justificativa curta

PARE aqui. Não gere SQL ainda. Aguarde minha aprovação do plano.

---PROMPT---

**IMPORTANTE:** Quando ele mostrar o plano, revisa. Se qualquer tabela estiver marcada como D (polimórfica) ou se alguma estratégia parecer estranha, **me chame antes de aprovar**. RLS mal configurado em tabela polimórfica pode bloquear acesso legítimo.

Depois da sua aprovação (ou minha), roda este segundo prompt:

---PROMPT-APLICAR-RLS---

Aplicando o plano aprovado. Gere a migration 
migrations/v2/XXX_complete_rls.sql com:

Para cada tabela:
1. ALTER TABLE {tabela} ENABLE ROW LEVEL SECURITY;
2. CREATE POLICY users_own_{tabela} ON {tabela}
     FOR ALL USING ({condição da estratégia aprovada})
     WITH CHECK ({mesma condição})

Aplique a migration via Drizzle.

Teste: rode uma query simples em cada tabela como usuário 
autenticado e confirme que ainda retorna dados do próprio user.
Rode também como usuário anônimo (via service role) e confirme 
comportamento esperado.

Mostre output dos testes e pare.

---PROMPT-APLICAR-RLS---

### Commit
```bash
git add .
git commit -m "fix(audit): enable RLS on all v2 tables"
```

---

## Correção 9 — Merge JSONB (investigação primeiro)

**Severidade:** alto
**Pode ser falso positivo.** Investigação obrigatória antes de qualquer correção.

---PROMPT---

Investigue como pipeline.state é atualizado. NÃO CORRIJA NADA 
nesta execução, apenas reporte.

Execute estes greps:
1. grep -rn "pipelines" workers/ frontend/lib/ --include="*.ts" | grep -iE "update|set.*state"
2. grep -rn "state" workers/lib/knowledge.ts workers/lib/seed-next-task.ts
3. grep -rn "||.*::jsonb\|jsonb_set\|\\.state" workers/ frontend/lib/ --include="*.ts"

Encontre toda função/query que atualiza a coluna state da tabela 
pipelines. Para cada ocorrência liste:

  arquivo:linha | método | MERGE ou SOBRESCREVE
  
Exemplos de classificação:
- "UPDATE pipelines SET state = $1" sem || → SOBRESCREVE (BUG)
- "UPDATE pipelines SET state = state || $1::jsonb" → MERGE OK
- Uso de Drizzle .update({ state: ... }) sem sql`` raw → verificar 
  se Drizzle está gerando merge ou substituição
- RPC custom tipo write_artifact → ler o SQL da função e classificar

Se achar SOBRESCREVE, marque como bug crítico mas NÃO corrija.

Mostre a lista completa e aguarde minha análise.

---PROMPT---

### Validação
- Você lê a lista. Se **tudo** aparecer como "MERGE OK", este item é **falso positivo** — marque como resolvido sem correção.
- Se qualquer linha aparecer como "SOBRESCREVE (BUG)" — **PARE e me chame**. A correção depende dos arquivos específicos e precisa de análise caso-a-caso.

### Commit (só se houver correção)
Não aplicável nesta etapa. Se tiver que corrigir, eu te passo prompt específico depois da sua análise.

---

## Re-auditoria final

Depois que Correções 2 a 9 estiverem commitadas, roda o `AUDIT.md` inteiro de novo:

```
Leia AUDIT.md integralmente e execute a auditoria seguindo 
exatamente as três camadas descritas. Gere novo relatório em 
AUDIT_REPORT_v2.md. Não corrija nada — apenas reporte.
```

Quando o novo relatório sair, me manda aqui. A gente decide em conjunto o que vira tarefa agora e o que vai pro backlog da v3.

---

## Regras finais

- **Uma correção por vez. Commit entre cada.**
- **Se qualquer verificação falhar, PARE e me chame.**
- **Se o Claude Code descobrir algo inesperado, PARE e me chame.**
- **Não edite arquivos manualmente.** Use sempre os prompts.
- **Não pule o commit.** É seu ponto de reversão.

Correções 2, 3 e 4 são críticas e precisam ser feitas nos próximos dias. 5 a 9 podem ser feitas com mais calma. Prioriza 2, 3, 4 em sessões separadas — não tenta fazer tudo num dia.
