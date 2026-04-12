# AUDIT_FIXES.md — Passo a passo de correções pós-auditoria

**Como usar este documento:** execute uma seção por vez, na ordem. Depois de cada seção, pare, confirme que funcionou, commite, e só então vá pra próxima. **Não pule etapas, não junte etapas, não tente "ganhar tempo" fazendo duas ao mesmo tempo.**

Pra cada correção você vai:
1. Copiar o prompt indicado
2. Colar no Claude Code na raiz do projeto
3. Esperar ele terminar
4. Rodar a verificação
5. Commitar

Se qualquer verificação falhar, **pare e me chame antes de continuar**. Não tente improvisar.

---

## ✅ Pré-requisito — Serviços no ar

Antes de começar, garanta que tudo está rodando:
- Banco de dados acessível (Supabase local via Docker ou cloud)
- Next.js rodando em `localhost:3000`
- Workers Node.js rodando

Abra `localhost:3000` no navegador e confirme que a tela carrega e o Jarvis responde "oi". Se não carrega, conserta isso antes de começar — não adianta corrigir código com aplicação quebrada.

---

## Correção 1 — Regra 18 para embeddings

**Severidade:** crítico
**Por quê:** `workers/lib/embeddings/gemini-embeddings.ts` importa `@google/genai` diretamente, violando a regra "única porta de entrada pro Gemini". Custos de embedding não aparecem em `llm_calls`.

### Prompt

```
Refatore lib/llm/gemini-client.ts para expor uma nova função 
callEmbedding além do callAgent que já existe. Requisitos:

Assinatura:
  callEmbedding({
    texts: string | string[],
    source_table: string,
    source_id: string,
    niche_id?: string,
    product_id?: string,
  }): Promise<number[][]>

Comportamento:
1. Usa o cliente Gemini único já instanciado no arquivo
2. Chama a API de embedding com model='gemini-embedding-001' 
   e output_dimensionality=768
3. Se receber array, faz batch de até 100 por chamada
4. Calcula custo: 0.025 USD por 1M input tokens
5. Loga em llm_calls com agent_name='embedding', model, 
   input_tokens, output_tokens=0, cost_usd, duration_ms, e 
   campos de rastreabilidade (source_table, source_id, niche_id, 
   product_id quando presentes)
6. Retorna array de vetores na mesma ordem dos inputs

Depois, refatore workers/lib/embeddings/gemini-embeddings.ts 
para ser um wrapper fino que:
- Preserva a lógica de batching e debounce de 30s
- Chama callEmbedding do lib/llm/gemini-client.ts em vez de 
  importar @google/genai
- Mantém a mesma API pública externa (não quebra quem já usa)

Ao final, execute e mostre o output:
  grep -rn "@google/genai\|GoogleGenerativeAI" --include="*.ts" .

O resultado só pode ter matches dentro de lib/llm/. Se 
aparecer qualquer outro caminho, liste e pare.
```

### Verificação

Depois que o Claude Code terminar, roda manualmente no terminal:
```bash
grep -rn "@google/genai\|GoogleGenerativeAI" --include="*.ts" . | grep -v "lib/llm/"
```
Deve retornar vazio. Se retornar qualquer linha, me chama.

### Commit

```bash
git add .
git commit -m "fix(audit): route embeddings through gemini-client (rule 18)"
```

---

## Correção 2 — Prompt cache real

**Severidade:** crítico
**Por quê:** `prompt-cache.ts` fabrica nomes fake de cache sem chamar a API do Gemini. Nenhuma economia real acontece hoje.

### Prompt

```
Reescreva lib/llm/prompt-cache.ts com implementação REAL da 
API de cache do Gemini. Remova toda a lógica mock de gerar 
nomes fictícios tipo cac_${Date.now()}.

Requisitos:

1. Função createOrGetCache(params):
     params: {
       cache_key: string,     // ex: "avatar_research:emagrecimento"
       content: string,       // system_prompt + niche_learnings concatenados
       ttl_seconds?: number   // default 3600
     }
     retorna: { cache_name: string, cached_tokens: number } | null

   Lógica:
   a) Consulta prompt_caches por cache_key. Se existe e 
      expires_at > now(), retorna dados existentes.
   b) Se não existe ou expirou, conta tokens do content. 
      Use o método countTokens() do SDK do Gemini.
   c) Se tokens < 4096, retorna null (não vale cachear — 
      cache do Gemini tem overhead e só compensa acima desse 
      limite prático).
   d) Se tokens >= 4096, chama genai.caches.create({
        model: 'models/gemini-2.5-pro' ou flash conforme o caso,
        contents: [{ role: 'user', parts: [{ text: content }] }],
        ttl: `${ttl_seconds}s`
      })
   e) Salva o cached_content.name retornado na tabela 
      prompt_caches junto com expires_at.
   f) Retorna { cache_name, cached_tokens }.

2. Integração no callAgent() do gemini-client.ts:
   - Antes da chamada ao modelo, monta "conteúdo estático" 
     combinando o system_prompt do agente + niche_learnings 
     injetados.
   - Chama createOrGetCache com esse conteúdo.
   - Se retornou cache_name: passa em generateContent via 
     parâmetro cachedContent E remove esse conteúdo da 
     mensagem inline pra não duplicar.
   - Se retornou null: envia tudo inline normalmente.

3. Ao logar em llm_calls, preenche cached_input_tokens 
   corretamente a partir de response.usageMetadata.cachedContentTokenCount 
   quando disponível.

NÃO use mock. Se a API real falhar, deixe o erro propagar. 
Falso positivo em cache silencioso é pior que erro visível.

Ao final, execute um teste manual: chame callAgent para 
avatar_research duas vezes seguidas com o mesmo niche. Mostre 
os dois registros correspondentes em llm_calls (query SQL), 
confirmando que a segunda chamada tem cached_input_tokens > 0.
```

### Verificação

O próprio prompt pede a verificação no final (query SQL em `llm_calls`). Confirma que a segunda chamada aparece com `cached_input_tokens > 0`. Se vier zero, o cache não está funcionando — me chama.

### Commit

```bash
git add .
git commit -m "fix(audit): implement real gemini prompt cache"
```

---

## Correção 3 — `lib/tagging.ts` ausente

**Severidade:** crítico
**Por quê:** A convenção de tagging não tem implementação centralizada. Tags são geradas inline pelo código, sem validação nem testes.

### Prompt

```
Crie lib/tagging.ts com funções puras para a convenção de 
tagging do AdCraft v2. Formato: SKU_v{N}_H{n} para hooks, 
SKU_v{N}_B{n} para bodies, SKU_v{N}_C{n} para CTAs, 
SKU_v{N}_H{n}_B{n}_C{n} para combinações, e 
SKU_v{N}_H{n}_B{n}_C{n}_V{n} para vídeos. SKU tem 4 letras 
maiúsculas, versão é inteiro positivo (v1, v2...), slots 
são 1 a 3.

Funções a exportar:
- buildHookTag(sku, version, slot): string
- buildBodyTag(sku, version, slot): string  
- buildCtaTag(sku, version, slot): string
- buildCombinationTag(sku, version, hookSlot, bodySlot, ctaSlot): string
- buildVideoTag(sku, version, hookSlot, bodySlot, ctaSlot, videoSlot): string
- parseTag(tag): TagParts | null
- validateTag(tag): boolean

TagParts é um objeto com: { sku, version, hookSlot?, bodySlot?, 
ctaSlot?, videoSlot?, type: 'hook'|'body'|'cta'|'combination'|'video' }

Todas as funções de build devem validar inputs e lançar erro 
claro se SKU não tem 4 letras maiúsculas, se versão não é 
inteiro >= 1, ou se slot não está em 1-3.

Regex para validateTag:
  /^[A-Z]{4}_v\d+(_H[1-3])?(_B[1-3])?(_C[1-3])?(_V\d+)?$/
Mas com regra adicional: combination exige H+B+C presentes, 
video exige H+B+C+V presentes.

Crie lib/tagging.test.ts com pelo menos 20 testes cobrindo:
- Build correto dos 5 tipos (5 testes)
- Roundtrip build → parse → build idêntico (5 testes)
- Rejeição de SKUs inválidos: minúsculas, 3 letras, 5 letras, 
  números, vazio (5 testes)
- Rejeição de versões inválidas: 0, negativa, decimal, não-número (3 testes)
- Rejeição de slots fora de 1-3 (2 testes)

Rode os testes com: pnpm test lib/tagging.test.ts
Mostre o output. Todos devem passar.

Depois, busque no código lugares onde tags são geradas inline:
  grep -rn "_v\${.*}_H\|_v\${.*}_B\|_v\${.*}_C" --include="*.ts" .

Para cada match, substitua pela função correspondente do 
lib/tagging.ts. Liste arquivo por arquivo cada substituição 
feita, mas NÃO commite ainda. Só liste para eu revisar.
```

### Verificação

Você revisa a lista de substituições que ele te mostrar. Se bater com o que faz sentido (são lugares onde tags eram construídas manualmente), fala "pode aplicar". Se tiver algum arquivo suspeito na lista, me chama antes.

### Commit

```bash
git add .
git commit -m "fix(audit): centralize tagging convention with tests"
```

---

## Correção 4 — Cap de 5 vídeos no video_maker

**Severidade:** crítico econômico (marcado como "alto" no relatório, mas trato como crítico)
**Por quê:** loop sem limite em VEO 3 pode gerar $300+ numa noite se você selecionar muitas combinações.

### Prompt

```
Em workers/agents/video-maker.ts, adicione validação no início 
da função principal (antes do loop que itera pelas combinações).

Requisitos:

1. Constante no topo do arquivo:
     const MAX_VIDEOS_PER_RUN = 5;

2. Antes do loop de geração, verificar:
     if (selectedCombinations.length > MAX_VIDEOS_PER_RUN) {
       if (!task.confirmed_oversized) {
         // cria approval e pausa
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

3. Se tasks não tiver coluna confirmed_oversized, crie uma 
   migration em migrations/v2/ adicionando:
     ALTER TABLE tasks ADD COLUMN confirmed_oversized boolean DEFAULT false;

4. No prompt do Jarvis (prompts/jarvis.md), adicione nota 
   sobre como lidar com approval do tipo 'video_cap_exceeded': 
   apresentar custo total ao usuário, pedir confirmação dupla, 
   se confirmado setar confirmed_oversized=true e retomar 
   pipeline.

Ao final mostre:
- O diff de workers/agents/video-maker.ts
- O arquivo de migration criado (se foi necessário)
- A seção atualizada do prompts/jarvis.md
```

### Verificação

Lê o diff que ele mostrar. Confirma que:
- A constante está no topo
- O check acontece ANTES do loop de geração (não no meio)
- Se a migration foi criada, ela está em `migrations/v2/`

### Commit

```bash
git add .
git commit -m "fix(audit): enforce 5-video cap in video_maker with confirmation flow"
```

---

## Correção 5 — niche_curator fora do registry

**Severidade:** alto
**Por quê:** O PRD especifica 6 agentes no registry, mas `niche_curator` foi incluído como 7º. Conceitualmente ele é um job agendado, não um agente de pipeline.

### Prompt

```
Remova niche_curator de workers/lib/agent-registry.ts. O 
registry deve conter EXATAMENTE 6 agentes: avatar_research, 
market_research, angle_generator, copy_hook_generator, 
anvisa_compliance, video_maker.

Em seguida, crie lib/jobs/niche-curator-job.ts que:
- Exporta função runNicheCuratorJob(niche_id?): se niche_id 
  fornecido roda só aquele, senão roda todos os nichos ativos
- Tem configuração própria: model='gemini-2.5-flash', 
  budget_per_run_usd=0.50, schedule='0 4 * * *' (cron diário 4h)
- Usa callAgent do gemini-client passando os parâmetros 
  corretos (mas com agent_name='niche_curator' registrado 
  em llm_calls pra rastreabilidade)
- Lê o prompt de prompts/niche_curator.md

Crie também um arquivo scripts/run-niche-curator.ts que 
executa o job manualmente:
  pnpm tsx scripts/run-niche-curator.ts [niche_id]

Atualize o PRD_v2.md seção 4 adicionando uma subseção curta 
"4.5 Jobs agendados" explicando que niche_curator é um job, 
não um agente de pipeline. Isso deixa a distinção explícita.

Confirme que o planner e o agent registry agora tratam só 
dos 6 agentes citados. Rode:
  grep -n "niche_curator" workers/lib/agent-registry.ts
Deve retornar vazio.
```

### Verificação

Manual: roda o grep do prompt e confirma vazio.

### Commit

```bash
git add .
git commit -m "refactor(audit): move niche_curator from registry to scheduled job"
```

---

## Correção 6 — Migration fora de `v2/`

**Severidade:** alto

### ⚠️ Importante antes do prompt

**Antes de mover qualquer coisa**, verifica se a migration `0000_gifted_lyja.sql` já foi aplicada no banco. Roda esta query no Supabase:

```sql
SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at DESC;
```

Se `0000_gifted_lyja` aparecer na lista, ela já foi aplicada — precisa tratamento especial (no prompt abaixo). Se não aparecer, mover é trivial.

### Prompt

```
A migration migrations/0000_gifted_lyja.sql está na raiz de 
migrations/ em vez de migrations/v2/. Preciso mover para v2/ 
sem quebrar o estado do Drizzle.

Antes de mexer, execute esta query contra o banco e mostre 
o resultado:
  SELECT * FROM drizzle.__drizzle_migrations 
  WHERE hash LIKE '%gifted_lyja%';

Se retornar vazio (migration nunca foi aplicada):
  - Simplesmente mova o arquivo: 
    mv migrations/0000_gifted_lyja.sql migrations/v2/
  - Atualiza drizzle.config.ts se necessário para apontar 
    pra migrations/v2/

Se retornar uma linha (migration já foi aplicada):
  - Pare e me avise. Não mexa em nada.
  - Nesse caso preciso de intervenção manual pra atualizar 
    o registro interno do Drizzle.

Em qualquer caso, mostre o output da query primeiro e 
aguarde confirmação antes de aplicar mudanças no filesystem.
```

### Verificação

Você lê o output da query. Se ele te pedir confirmação (caso "já aplicada"), me chama. Se for o caso "nunca aplicada", confirma manualmente que o arquivo foi movido e o `drizzle.config.ts` aponta pra `migrations/v2/`.

### Commit

```bash
git add .
git commit -m "fix(audit): move stray migration into v2/ directory"
```

---

## Correção 7 — Arquivar `backend/` Python

**Severidade:** médio (mas rápido)

### Prompt

```
Arquive o diretório backend/ do projeto. Ele é legado v1 
Python e deve ficar como referência, não como código ativo.

Passos:
1. Renomeie backend/ para _legacy-v1-python/
2. Crie _legacy-v1-python/ARCHIVED.md com o texto:
   "Este diretório contém o backend Python da v1 do AdCraft, 
   mantido apenas como referência para portar trechos quando 
   necessário. Não está em uso ativo. A v2 roda em workers/ 
   + app/ (Next.js + Node.js). Consulte MIGRATION_GUIDE.md 
   para saber o que ainda vale portar."
3. Atualize o README.md principal mencionando a existência 
   do _legacy-v1-python/ com um parágrafo curto
4. Verifique que nenhum arquivo do app ativo importa de backend/:
   grep -rn "from backend\|import backend" --include="*.py" --include="*.ts" --include="*.tsx" .
   Deve retornar vazio.
```

### Verificação

Roda o grep do final do prompt manualmente. Deve retornar vazio.

### Commit

```bash
git add .
git commit -m "chore(audit): archive v1 python backend as reference-only"
```

---

## Correção 8 — RLS completo

**Severidade:** alto

### Prompt

```
Crie uma nova migration em migrations/v2/ que ativa Row Level 
Security em todas as tabelas v2 que ainda não têm. Nome do 
arquivo: XXX_complete_rls.sql (use o próximo número sequencial 
disponível na pasta v2/).

Tabelas a tratar:
- tasks
- approvals
- copy_components
- copy_combinations
- product_knowledge
- niche_learnings
- embeddings
- messages
- prompt_caches
- llm_calls

Para cada uma, a migration deve:
1. ALTER TABLE {tabela} ENABLE ROW LEVEL SECURITY;
2. Criar policy users_own_{tabela} que permite SELECT/INSERT/
   UPDATE/DELETE quando:
   - A tabela tem user_id direto: WHERE user_id = auth.uid()
   - A tabela não tem user_id mas pertence a pipeline: JOIN 
     com pipelines verificando user_id lá
   - A tabela é filho de produto: JOIN com products verificando 
     user_id lá

Para cada tabela, detecte qual caso se aplica olhando o schema 
atual (leia os arquivos de migration existentes em migrations/v2/ 
pra ver as FKs).

IMPORTANTE: tabelas sem relação direta ou transitiva com 
user_id (ex: embeddings é polimórfica) precisam de policy 
diferente — pense caso a caso e me mostre o plano ANTES de 
gerar o SQL. Liste cada tabela e qual estratégia você vai 
usar. Aguarde minha confirmação antes de escrever a migration.
```

### Verificação

Ele vai te mostrar o plano primeiro. **Lê com atenção**. Se algum caso parecer estranho (especialmente `embeddings` e `prompt_caches` que são polimórficas ou globais), me chama antes de aprovar. Depois que a migration for criada, aplica:

```bash
pnpm drizzle-kit push
```

E testa que ainda consegue ler dados como usuário normal.

### Commit

```bash
git add .
git commit -m "fix(audit): enable RLS on all v2 tables"
```

---

## Correção 9 — Investigar merge JSONB

**Severidade:** alto
**Atenção:** este é o único que começa com **investigação**, não com correção. Não deixa o Claude Code "corrigir" antes de você ver o diagnóstico.

### Prompt de investigação

```
Investigue como pipeline.state é atualizado no código. NÃO 
CORRIJA NADA nesta execução. Apenas reporte.

Faça:
1. grep -rn "pipelines" workers/ lib/ --include="*.ts" | grep -iE "update|set.*state"
2. grep -rn "state" workers/lib/knowledge-writer.ts workers/lib/seed-next-task.ts
3. Encontre toda função que atualiza a coluna state da tabela 
   pipelines e liste:
   - arquivo:linha
   - método usado (UPDATE direto? operador ||? spread JS antes 
     de gravar? função custom?)
   - se faz merge ou sobrescreve
4. Se achar qualquer lugar que sobrescreve state inteiro em 
   vez de fazer merge JSONB com ||, MARQUE como bug crítico 
   na saída mas não corrija.

Me mostre uma lista tipo:
  workers/lib/knowledge-writer.ts:42 — UPDATE pipelines SET state = $1 — SOBRESCREVE (BUG)
  workers/agents/avatar-research.ts:88 — UPDATE pipelines SET state = state || $1::jsonb — MERGE OK

Aguarde minha confirmação antes de qualquer correção.
```

### Verificação

Você lê a lista. Se aparecer qualquer linha marcada "SOBRESCREVE (BUG)", me manda a lista aqui antes de corrigir. Se todas estiverem "MERGE OK", este item vira falso positivo da auditoria e você só documenta isso.

### Correção (só se houver bug)

Se houver bug, me chama. Vou te passar o prompt de correção específico baseado nos arquivos exatos que aparecerem na lista — não adianta eu escrever prompt genérico agora.

### Commit

Condicional ao resultado. Se foi falso positivo, não precisa commit. Se teve correção, commita como:
```bash
git commit -m "fix(audit): use jsonb merge operator in pipeline state updates"
```

---

## Depois de tudo — re-auditoria

Quando as 9 correções estiverem feitas e commitadas:

1. Roda o `AUDIT.md` inteiro de novo com o mesmo prompt de antes. **Não confia no relatório anterior** — algumas coisas mudaram colateralmente.
2. Quando o novo `AUDIT_REPORT.md` sair, cola aqui no chat.
3. A gente revisa os WARNs e decide o que vira tarefa agora e o que vai pro backlog da v3.

---

## Regras de disciplina

- **Uma correção por vez.** Não paralelize.
- **Commit depois de cada uma.** Se der regressão na próxima, você reverte só aquela.
- **Se qualquer verificação falhar, pare.** Me chame. Não tente consertar improvisando.
- **Não edite arquivos manualmente.** Use sempre os prompts. Você pode revisar o que o Claude Code fez antes de aceitar, mas não escreva código manualmente — o risco de inconsistência é alto.
- **Não pule o commit.** Parece bobagem mas é o que te salva quando algo dá errado.

Boa execução. Qualquer dúvida em qualquer passo, me chama antes de prosseguir.
