# AdCraft V2 — Plano de Execução

**Versão:** 2.0
**Data:** 16/04/2026
**Autor:** João + Claude (thinking partner)
**Status:** Pronto para execução

---

## 🎯 Contexto da V2

A V1 entregou a fundação (migrations, backend FastAPI, scaffold React Flow, 18 agentes planejados). Após teste prático com Claude Code + skills, ficou claro que:

1. **A qualidade dos outputs do Claude é superior ao Gemini** para os agentes de texto/análise
2. **O Jarvis atual é limitado demais** — precisa ser um agente inteligente aberto, não um chatbot de comandos
3. **Faltam telas de visibilidade operacional** — tela de Demandas com timeline, tela de Produto com sub-abas
4. **Falta memória cumulativa real** — o sistema precisa aprender com cada campanha executada

A V2 resolve esses 4 pontos em 6 fases sequenciais.

---

## 🗺️ Visão Geral das Fases

| Fase | Nome | Duração estimada | Objetivo |
|------|------|------------------|----------|
| A | Migração Gemini → Claude | 1 semana | Elevar qualidade de todos os agentes de texto |
| B | Jarvis Inteligente (tool use) | 1-2 semanas | Transformar Jarvis em agente Claude completo |
| C | Tela de Demandas refatorada | 1 semana | Visibilidade total de cada execução |
| D | Tela de Produto refatorada | 1-2 semanas | Sub-abas (Mercado, Personas, Copy, Criativos, Campanhas, Histórico) |
| E | Sistema de Memória Cumulativa | 1 semana | Aprendizado persistente entre campanhas |
| F | Filtros, polish e testes | 3-5 dias | Finalização e qualidade |

**Total:** 5-7 semanas de execução focada.

---

## 🧱 Princípios da V2

1. **Claude em tudo que for possível.** Exceções: Veo 3 (vídeo) e Nano Banana (imagem).
2. **Modelo configurável por agente.** Você escolhe no painel se aquele agente usa Opus 4.7, Sonnet 4.6 ou Haiku 4.5.
3. **Jarvis tem as mesmas capacidades do Claude Code.** Acesso ao banco, arquivos, execução de agentes, web search, análise de mídia.
4. **Toda execução é rastreável.** Timeline completa, logs em tempo real, re-execução de qualquer agente.
5. **Memória é ativa, não passiva.** O Jarvis consulta aprendizados automaticamente ao responder.

---

# FASE A — Migração Gemini → Claude

## Objetivo
Trocar o provider de LLM de Google Gemini para Anthropic Claude em todos os agentes de texto e análise, mantendo Veo 3 para vídeo e Nano Banana para imagem. Implementar seletor de modelo por agente.

## Escopo

**Dentro:**
- Refatorar a camada de LLM provider (abstração) para suportar Anthropic API
- Migrar os 14 agentes de texto/análise para Claude (dos 18 totais, 14 são texto/análise)
- Adicionar coluna `model_config` na tabela `agents` do Supabase
- Criar seletor de modelo no painel de cada agente (Opus 4.7 / Sonnet 4.6 / Haiku 4.5)
- Atualizar cost tracking para refletir pricing da Anthropic
- Validar qualidade de cada agente comparando com o teste manual já feito

**Fora:**
- Migrar Veo 3 (vídeo fica)
- Migrar Nano Banana (imagem fica)
- Refatorar Jarvis (isso é Fase B)

**Depois:**
- Fine-tuning de prompts por agente (Fase F)
- Batch processing via Anthropic Batch API (v2.1)

## Agentes a migrar (14 de 18)

| # | Agente | Recomendação de modelo | Motivo |
|---|--------|------------------------|--------|
| 1 | Análise de VSL/página | Sonnet 4.6 | Análise estruturada, custo-benefício |
| 2 | Viabilidade de mercado | Opus 4.7 | Decisão crítica, precisa precisão |
| 3 | Construção de persona | Opus 4.7 | Criatividade + profundidade |
| 4 | Estratégia de ângulos | Opus 4.7 | Alto impacto no resultado final |
| 5 | Benchmark intelligence | Sonnet 4.6 | Volume alto, análise repetitiva |
| 6 | Estratégia de campanha | Opus 4.7 | Decisão crítica |
| 7 | Roteirização (script) | Opus 4.7 | Qualidade de escrita crítica |
| 8 | Copywriting | Opus 4.7 | Qualidade de escrita crítica |
| 9 | Geração de personagens (prompt) | Sonnet 4.6 | Prompt engineering, não geração final |
| 10 | Geração de keyframes (prompt) | Sonnet 4.6 | Prompt engineering |
| 11 | Creative director (FFmpeg) | Sonnet 4.6 | Orquestração, não criação |
| 12 | Compliance checker | Sonnet 4.6 | Análise baseada em regras |
| 13 | UTM structuring | Haiku 4.5 | Task simples, alta velocidade |
| 14 | Performance analyzer | Opus 4.7 | Análise de dados complexa |

**Fora (mantém):** Per-scene video (Veo 3), Media buying FB (lógica pura), Media buying Google (lógica pura), Scaling (lógica pura).

## Prompt para Claude Code — Fase A

```markdown
Estou refatorando o AdCraft para migrar de Google Gemini para Anthropic Claude
nos agentes de texto e análise. Preciso que você:

1. Leia os seguintes arquivos para entender o estado atual:
   - backend/app/services/llm_provider.py (ou equivalente)
   - backend/app/agents/ (todos os agentes)
   - backend/app/config.py
   - backend/.env.example

2. Crie uma nova camada de abstração em backend/app/services/llm/
   com três arquivos:
   - base.py — Interface LLMProvider (abstract class) com métodos
     generate(), generate_with_tools(), stream()
   - anthropic_provider.py — Implementação usando anthropic SDK
   - provider_factory.py — Factory que retorna o provider certo
     baseado na config do agente

3. Instale a dependência: anthropic>=0.40.0 no pyproject.toml / requirements.txt

4. Adicione no .env.example:
   ANTHROPIC_API_KEY=sk-ant-...

5. Crie uma migration SQL nova (014_add_model_config.sql) que adiciona:
   - Coluna `model_provider` na tabela agents (default: 'anthropic')
   - Coluna `model_name` na tabela agents (default: 'claude-sonnet-4-6')
   - Coluna `model_settings` JSONB na tabela agents (temperature, max_tokens, etc)

6. Refatore CADA UM dos 14 agentes listados no PLANO_EXECUCAO_V2.md
   (Fase A) para:
   - Usar o LLMProvider injetado via factory
   - Ler model_name/settings da config do agente no banco
   - Preservar exatamente o prompt atual (só troca o provider)

7. Atualize o cost tracking em backend/app/services/cost_tracker.py:
   - Pricing Anthropic atualizado (consultar docs.anthropic.com)
   - Preservar compatibilidade com Gemini (ainda usado em alguns agentes)

8. Crie testes em backend/tests/test_llm_provider.py com:
   - Mock da API Anthropic
   - Teste de cada método da interface
   - Teste de troca de provider via factory

9. NÃO toque no Jarvis nessa fase — ele é a Fase B.
10. NÃO toque em Veo 3 nem Nano Banana.

Ao final, rode os testes e me mostre o diff completo de cada agente
migrado. Se algum agente tem lógica específica de Gemini (ex.: chamada
a gemini.configure()), adapte com cuidado para o equivalente Anthropic.

IMPORTANTE: Use o SDK oficial `anthropic`, nunca construa chamadas HTTP
manuais. Use streaming quando o agente já usava streaming antes.
```

## Critérios de aceite — Fase A

- [ ] Migration 014 aplicada no Supabase
- [ ] LLMProvider abstrato implementado com Anthropic e Gemini funcionando lado a lado
- [ ] 14 agentes migrados, rodando e com testes passando
- [ ] Painel do agente mostra seletor de modelo com 3 opções (Opus / Sonnet / Haiku)
- [ ] Cost tracking exibe custo correto por provider
- [ ] Rodar 1 execução end-to-end de um produto real e comparar qualidade com teste manual

## Riscos — Fase A

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Rate limits Anthropic em execução paralela | Média | Alto | Implementar retry com backoff + configurar tier adequado |
| Prompts feitos pra Gemini não funcionam igual no Claude | Alta | Médio | Testar cada agente, ajustar só se qualidade cair |
| Custo subir muito (Opus é caro) | Média | Médio | Usar Sonnet como default, Opus só em agentes críticos |

---

# FASE B — Jarvis Inteligente

## Objetivo
Transformar o Jarvis de chatbot limitado em agente Claude completo com tool use, acesso ao banco, arquivos do projeto, execução de agentes, web search e análise de mídia. Nível de inteligência igual ao Claude Code, mas com contexto persistente do negócio.

## Escopo

**Dentro:**
- Backend: novo endpoint `/api/jarvis/chat` com suporte a tool use em loop
- Backend: implementação de 12-15 tools customizadas (detalhadas abaixo)
- Backend: sistema de autorização de tools (confirmação humana para ações destrutivas)
- Frontend: refatorar chat do Jarvis para suportar:
  - Streaming de resposta
  - Visualização de tool calls em tempo real
  - Approval inline para ações destrutivas
  - Histórico persistente de conversas
- Memória de conversa: últimas 50 mensagens + summarization automática

**Fora:**
- Voice input/output (v2.2)
- Multi-agent collaboration (Jarvis + outro agente simultâneo) (v3)

## Tools do Jarvis

### Categoria 1 — Banco de dados (read)
1. `query_products` — Listar/filtrar produtos
2. `query_executions` — Listar execuções com filtros
3. `query_agent_output` — Buscar output específico de um agente numa execução
4. `query_campaigns` — Listar campanhas de ads ativas/passadas
5. `query_learnings` — Consultar tabela de aprendizados (Fase E)

### Categoria 2 — Banco de dados (write, com confirmação)
6. `create_product` — Criar novo produto
7. `update_product` — Editar produto existente
8. `approve_execution_step` — Aprovar checkpoint
9. `reject_execution_step` — Rejeitar checkpoint com feedback

### Categoria 3 — Arquivos do projeto
10. `read_file` — Ler qualquer arquivo do projeto (skills, docs, código)
11. `list_files` — Listar estrutura de diretórios
12. `search_in_files` — Busca por conteúdo (grep-like)

### Categoria 4 — Execução
13. `trigger_agent` — Disparar execução de um agente específico (com confirmação)
14. `rerun_agent` — Re-executar agente de uma execução existente

### Categoria 5 — Web e mídia
15. `web_search` — Busca na web (via API do Claude ou Brave Search)
16. `analyze_image` — Análise de imagem (upload ou URL)
17. `analyze_video` — Análise de vídeo (via Veo API ou frame extraction)

## Prompt para Claude Code — Fase B

```markdown
Estou refatorando o Jarvis para ser um agente Claude completo com tool use.
Ele precisa ter inteligência aberta (conversar sobre qualquer tema) + acesso
total ao banco, arquivos e execução do AdCraft.

1. Leia o estado atual do Jarvis:
   - backend/app/routes/jarvis.py (ou similar)
   - backend/app/agents/jarvis_agent.py (ou similar)
   - frontend/app/jarvis/* ou onde está o chat

2. Crie uma nova estrutura em backend/app/jarvis/:
   - agent.py — Loop principal de tool use (while stop_reason == 'tool_use')
   - tools/ — um arquivo por categoria de tool:
     - database_read.py (query_products, query_executions, ...)
     - database_write.py (create_product, update_product, ...)
     - files.py (read_file, list_files, search_in_files)
     - execution.py (trigger_agent, rerun_agent)
     - web_media.py (web_search, analyze_image, analyze_video)
   - tool_registry.py — Registry central que o agent.py usa
   - authorization.py — Decorator @requires_confirmation pra tools destrutivas
   - system_prompt.py — System prompt do Jarvis (veja template abaixo)

3. System prompt do Jarvis deve conter:
   - Identidade: "Você é o Jarvis, assistente inteligente do AdCraft"
   - Contexto: explicar o que é o AdCraft, os 18 agentes, o fluxo
   - Capacidades: enumerar as tools disponíveis
   - Regras: quando pedir confirmação, como apresentar dados, tom de voz
   - Contexto do usuário: nome, empresa, preferências (ler do banco)

4. Implementar o loop de tool use corretamente:
   - Receber mensagem do usuário
   - Chamar Claude com messages + tools
   - Se stop_reason == 'tool_use': executar tool, adicionar resultado, chamar de novo
   - Se stop_reason == 'end_turn': retornar resposta final pro frontend
   - Streaming habilitado para resposta final

5. Sistema de autorização:
   - Tools marcadas com @requires_confirmation retornam
     {"status": "pending_approval", "action": "...", "preview": "..."}
   - Frontend exibe modal de confirmação
   - Usuário aprova/rejeita → backend executa ou cancela

6. Persistência de conversa:
   - Nova tabela `jarvis_conversations` (id, user_id, created_at, ...)
   - Nova tabela `jarvis_messages` (id, conversation_id, role, content, tool_calls, tool_results)
   - Migration 015_jarvis_conversations.sql
   - Retentar últimas 50 mensagens; se ultrapassar, summarizar as antigas

7. Frontend (Next.js + React):
   - Componente `<JarvisChat>` com:
     - Input com suporte a upload de imagem/PDF
     - Streaming de texto via Server-Sent Events ou WebSocket
     - Renderização de tool calls (card expansível mostrando tool + input + output)
     - Modal de approval para ações destrutivas
   - Nova rota `/jarvis` (se ainda não tem)
   - Sidebar com histórico de conversas

8. Testes:
   - backend/tests/test_jarvis_tools.py — teste cada tool isoladamente
   - backend/tests/test_jarvis_loop.py — teste o loop de tool use com mock
   - backend/tests/test_jarvis_authorization.py — teste confirmações

Use claude-opus-4-7 como modelo padrão do Jarvis (ele precisa ser o mais
inteligente possível). Permitir override via config.

IMPORTANTE: Siga as melhores práticas de tool use da Anthropic:
- Descrições de tools claras e específicas
- Input schemas com descriptions em cada campo
- Tool results em formato estruturado (não só strings)
- Tratamento de erro: se tool falhar, retorne erro estruturado pro Claude decidir
```

## Critérios de aceite — Fase B

- [ ] Jarvis responde perguntas abertas ("me explica o que é CAC") com mesma qualidade do Claude Code
- [ ] Jarvis consegue consultar o banco: "quantas execuções rodei semana passada?"
- [ ] Jarvis lê arquivos do projeto: "me mostra o skill de copywriting"
- [ ] Jarvis dispara agentes: "roda o estudo de público pro produto X" (com confirmação)
- [ ] Jarvis faz web search: "busca concorrentes do produto Y"
- [ ] Jarvis analisa imagem: upload de print de ad → análise
- [ ] Modal de confirmação funciona para ações destrutivas
- [ ] Histórico de conversas persiste entre sessões

## Riscos — Fase B

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Tool use em loop infinito (Claude chama tool eternamente) | Baixa | Alto | Limite hard de 25 iterações por turno |
| Tools destrutivas executam sem confirmação | Média | Crítico | Unit tests obrigatórios para o decorator @requires_confirmation |
| Custo alto com Opus | Alta | Médio | Cache de prompt system, summarization de histórico |
| Latência alta (loop de tools) | Média | Médio | Streaming + indicador visual de progresso |

---

# FASE C — Tela de Demandas Refatorada

## Objetivo
Criar uma tela de Demandas que seja o painel de controle operacional. Cada execução tem ID, timeline visual, logs em tempo real, custo por etapa, e botão de re-executar qualquer agente específico.

## Escopo

**Dentro:**
- Refatorar/criar tela `/demandas` (lista) e `/demandas/[id]` (detalhe)
- Timeline visual de execução (vertical stepper)
- Logs em tempo real via WebSocket
- Cards por agente com: input, output, custo, tempo, status
- Botão "Re-executar este agente" em cada card
- Filtros: status, produto, período, agente específico
- Export de execução (JSON) para debug

**Fora:**
- Edição inline de outputs de agente (v2.3)
- Comparação entre execuções (v3)

## Prompt para Claude Code — Fase C

```markdown
Refatore a tela de Demandas do AdCraft para ser o painel de controle
operacional completo. Preciso de visibilidade total de cada execução.

1. Leia o estado atual:
   - frontend/app/demandas/* (ou onde está hoje)
   - backend/app/routes/executions.py
   - backend/app/models/execution.py

2. Backend — endpoints novos ou refinados:
   - GET /api/executions — lista com filtros (status, produto, data, agente)
   - GET /api/executions/{id} — detalhe completo com todos os steps
   - GET /api/executions/{id}/steps/{step_id} — detalhe de um step
   - POST /api/executions/{id}/steps/{step_id}/rerun — re-executar step
   - GET /api/executions/{id}/logs?stream=true — SSE com logs em tempo real
   - WebSocket /ws/executions/{id} — updates de status em tempo real

3. Modelo de dados (verificar e ajustar se preciso):
   - executions (id, product_id, status, started_at, completed_at, total_cost)
   - execution_steps (id, execution_id, agent_id, order, status, input_json,
     output_json, cost, duration_ms, started_at, completed_at, error)
   - execution_logs (id, step_id, timestamp, level, message)

4. Frontend — tela de listagem `/demandas`:
   - Tabela com: ID, produto, status (badge colorido), progresso (3/12 steps),
     custo total, iniciado em, duração
   - Filtros no topo: status (multi-select), produto (autocomplete),
     período (date range), agente (multi-select)
   - Paginação server-side (25/50/100 por página)
   - Click na linha → abre detalhe

5. Frontend — tela de detalhe `/demandas/[id]`:
   - Header: produto, status geral, custo total, duração, botão "Re-executar tudo"
   - Timeline vertical (stepper):
     - Um card por step/agente
     - Cor do card por status (pending/running/success/error/awaiting_approval)
     - Cada card expansível mostra:
       - Input JSON (collapsible)
       - Output (renderizado bonito se for texto/markdown, JSON se for dado)
       - Custo + duração + modelo usado
       - Logs em tempo real (se running)
       - Botão "Re-executar este agente" (com modal de confirmação)
   - Painel lateral: logs globais em tempo real (WebSocket)

6. Componentes reutilizáveis:
   - <StatusBadge status={...} /> — badge colorido padrão
   - <CostDisplay cents={...} /> — formatação de custo
   - <Timeline steps={[...]} /> — stepper vertical
   - <LogStream executionId={...} /> — viewer de logs com autoscroll
   - <AgentOutputRenderer output={...} type={...} /> — renderiza saída

7. Re-execução:
   - Ao clicar "Re-executar este agente":
     - Modal explica: "Isso vai re-rodar o agente X usando o input atual.
       Os steps seguintes serão invalidados. Continuar?"
     - Backend: marca step como pending, cascateia invalidation,
       dispara Celery task
     - Frontend: atualiza via WebSocket

8. Testes:
   - backend/tests/test_executions_api.py
   - backend/tests/test_rerun.py
   - frontend — componentes críticos com Playwright ou similar

IMPORTANTE: WebSocket deve reconectar automaticamente em caso de queda.
Use exponential backoff. Ver skill websocket-realtime.
```

## Critérios de aceite — Fase C

- [ ] Tela `/demandas` lista execuções com filtros funcionando
- [ ] Tela `/demandas/[id]` mostra timeline completa
- [ ] Logs aparecem em tempo real enquanto um agente roda
- [ ] Re-execução de um agente específico funciona e cascateia corretamente
- [ ] Custo total e por step exibido corretamente
- [ ] Export de execução (JSON download) funciona
- [ ] WebSocket reconecta automaticamente após queda

## Riscos — Fase C

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| WebSocket com muitos clientes simultâneos | Baixa (single-user) | Baixo | Não é problema no v1, pensar no v2 SaaS |
| Re-execução gera inconsistência no banco | Média | Alto | Transação atômica + testes de integração |
| Logs em tempo real consomem muita memória | Baixa | Médio | Limitar a últimos 500 logs na UI, resto via API |

---

# FASE D — Tela de Produto Refatorada

## Objetivo
Criar a tela de detalhe de Produto com sub-abas: Estudo de Mercado, Personas, Copy, Criativos, Campanhas, Histórico. Cada aba tem visualização rica do conteúdo gerado pelos agentes, com mini-dashboards e navegação fluida.

## Escopo

**Dentro:**
- Refatorar tela `/produtos/[id]` com sistema de tabs
- 6 sub-abas com visualizações específicas (detalhadas abaixo)
- Card de score/viabilidade no topo (dashboard resumo)
- Navegação entre múltiplas versões (personas, copies) com setas

**Fora:**
- Edição inline do conteúdo gerado (v2.3)
- A/B testing de copies no próprio AdCraft (v3)

## Sub-abas detalhadas

### 1. Estudo de Mercado
- Card de score (0-100) de viabilidade, com cor e tooltip explicativo
- Resumo executivo (3-5 parágrafos)
- Sub-seções expansíveis: concorrência, tamanho de mercado, sazonalidade, tendências
- Gráfico de trends (se disponível via Google Trends API)

### 2. Personas
- Cards de persona navegáveis com setas ← →
- Contador "Persona 2 de 4"
- Botão "Gerar nova persona"
- Cada card: nome, idade, demografia, dores, desejos, objeções, linguagem típica
- Avatar visual (gerado ou placeholder)

### 3. Copy
- Lista de todas as versões de copy geradas
- Tabs internas: Headlines / Body / CTAs
- Para cada: status (aprovada/rejeitada/pending), feedback, data
- Diff visual entre versões
- Botão "Gerar nova versão com feedback"

### 4. Criativos
- Grid de vídeos gerados (Veo 3) com preview
- Grid de imagens geradas (Nano Banana) com preview
- Filtro por status, scene, versão
- Click → modal com detalhes: prompt usado, agente criativo director, custo

### 5. Campanhas
- Lista de campanhas Facebook/Google Ads associadas
- Métricas principais: spend, CPM, CTR, CPA, ROAS
- Status (ativa/pausada/arquivada)
- Link para o painel do FB/Google

### 6. Histórico
- Timeline completa de tudo que aconteceu com este produto
- Filtro por tipo de evento (execução, aprovação, edição, campanha)
- Export CSV

## Prompt para Claude Code — Fase D

```markdown
Refatore a tela de Produto (/produtos/[id]) para ter sub-abas ricas
que mostrem todo o conteúdo gerado pelos agentes de forma visual e
navegável.

1. Leia o estado atual:
   - frontend/app/produtos/[id]/* (ou similar)
   - backend/app/routes/products.py
   - Modelos relacionados: products, personas, copies, creatives, campaigns

2. Arquitetura da tela:
   - Header sticky: nome do produto, URL, status, score de viabilidade
   - Tabs horizontais: Mercado | Personas | Copy | Criativos | Campanhas | Histórico
   - Cada tab é um componente separado em components/produto/tabs/

3. Backend — endpoints por aba:
   - GET /api/products/{id}/market-study — retorna estudo completo
   - GET /api/products/{id}/personas?sort=created_at — lista personas
   - GET /api/products/{id}/copies?version=all — lista copies
   - GET /api/products/{id}/creatives?type=video|image — lista criativos
   - GET /api/products/{id}/campaigns?platform=fb|google — lista campanhas
   - GET /api/products/{id}/history — timeline de eventos

4. Componente da aba "Mercado":
   - <MarketScoreCard score={...} reasoning={...} />
     (usa Sonnet 4.6 para gerar o reasoning a partir do estudo)
   - <ExecutiveSummary text={...} />
   - <CollapsibleSection title="Concorrência">...</CollapsibleSection>
   - <TrendsChart data={...} /> (se Google Trends disponível)

5. Componente da aba "Personas":
   - <PersonaCard persona={...} />
   - Navegação: ← Persona 2 de 4 →
   - Botão <GeneratePersonaButton />
   - Cada campo da persona em seção separada com ícone

6. Componente da aba "Copy":
   - Sub-tabs: Headlines / Body / CTAs
   - <CopyVersionCard copy={...} onApprove={...} onReject={...} />
   - <CopyDiff from={v1} to={v2} /> — diff visual
   - Botão "Gerar nova versão" abre modal de feedback

7. Componente da aba "Criativos":
   - <VideoGrid videos={...} /> com preview hover
   - <ImageGrid images={...} /> com lightbox
   - Modal de detalhe: prompt, director, custo, FFmpeg command (se vídeo)

8. Componente da aba "Campanhas":
   - <CampaignTable campaigns={...} />
   - Colunas: plataforma, nome, status, spend, CPM, CTR, CPA, ROAS
   - Link externo para FB/Google Ads

9. Componente da aba "Histórico":
   - <EventTimeline events={...} />
   - Filtros por tipo de evento
   - Export CSV

10. UX obrigatório:
    - Skeleton loaders em todas as abas
    - Empty states com ilustração + CTA
    - Breadcrumb: Produtos > [nome do produto] > [aba atual]
    - URL reflete a aba ativa (?tab=personas)
    - Performance: lazy load de abas não ativas

11. Score de viabilidade — lógica:
    - Novo agente mini "viability_scorer" ou método do agente de mercado
    - Input: estudo de mercado completo
    - Output: { score: 0-100, reasoning: "..." }
    - Chamado 1x quando estudo é concluído, cached

12. Testes:
    - Componentes principais com Vitest/Jest
    - E2E de navegação entre abas com Playwright

Use design system da skill frontend-adcraft. Mantenha consistência com
telas existentes. Cores do score: verde (70+), amarelo (40-69), vermelho (<40).
```

## Critérios de aceite — Fase D

- [ ] Navegação entre as 6 abas funciona e reflete na URL
- [ ] Score de viabilidade aparece e tem reasoning explicativo
- [ ] Personas navegáveis com setas, contador correto
- [ ] Copies organizadas por tipo (headlines/body/CTAs) com diff
- [ ] Vídeos e imagens com preview funcional
- [ ] Campanhas mostram métricas reais (se FB/Google conectado)
- [ ] Histórico filtra e exporta CSV corretamente

## Riscos — Fase D

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Tela carrega lenta (muito dado) | Alta | Médio | Lazy load + paginação + skeleton |
| Preview de vídeo estoura banda | Média | Baixo | Thumbnail + preview só no hover |
| Score de viabilidade gera expectativa irreal | Média | Médio | Tooltip explicando que é sugestão, não garantia |

---

# FASE E — Sistema de Memória Cumulativa

## Objetivo
Criar tabelas de aprendizado que são alimentadas automaticamente após cada execução e consultadas pelo Jarvis para dar respostas informadas pelo histórico. Exemplo: "que ângulo funcionou melhor pra produtos de emagrecimento?"

## Escopo

**Dentro:**
- Tabelas: `learnings`, `patterns`, `insights`
- Agente extrator de learnings (roda após cada execução completa)
- Embeddings via `voyage-3` ou `text-embedding-3-small` (OpenAI)
- Busca vetorial no Supabase (pgvector)
- Tools do Jarvis para consultar: `query_learnings`, `find_similar_campaigns`
- Dashboard simples de insights agregados

**Fora:**
- ML supervisionado (modelo treinado) — v3
- Recomendações proativas do Jarvis ("você devia rodar X") — v2.2

## Modelo de dados

```sql
-- Aprendizados atômicos
CREATE TABLE learnings (
  id UUID PRIMARY KEY,
  execution_id UUID REFERENCES executions(id),
  product_id UUID REFERENCES products(id),
  category TEXT, -- angle|copy|persona|creative|targeting
  observation TEXT, -- "Ângulo de medo funcionou 2x melhor que autoridade"
  evidence JSONB, -- { metric: "CTR", value: 3.2, baseline: 1.6 }
  confidence NUMERIC, -- 0-1
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Padrões agregados (derivados)
CREATE TABLE patterns (
  id UUID PRIMARY KEY,
  pattern_text TEXT, -- "Produtos de nicho de saúde performam 40% melhor com ângulo de medo"
  supporting_learnings UUID[], -- array de learning IDs
  niche TEXT,
  confidence NUMERIC,
  updated_at TIMESTAMPTZ
);

-- Insights top-level (curadoria)
CREATE TABLE insights (
  id UUID PRIMARY KEY,
  title TEXT,
  body TEXT,
  importance INT, -- 1-5
  created_at TIMESTAMPTZ,
  validated_by_user BOOLEAN DEFAULT FALSE
);
```

## Prompt para Claude Code — Fase E

```markdown
Implemente o sistema de memória cumulativa do AdCraft.

1. Criar migration 016_learnings_system.sql com as 3 tabelas acima,
   habilitando pgvector extension e índices adequados (ivfflat para
   embeddings, btree para filtros).

2. Backend — novo módulo backend/app/memory/:
   - extractor.py — agente que roda pós-execução e gera learnings
   - aggregator.py — roda diariamente (Celery beat) e gera patterns
   - embeddings.py — wrapper pro provider de embeddings
   - search.py — busca vetorial + textual

3. Agente extrator (extractor.py):
   - Trigger: signal pós-execução bem-sucedida
   - Input: execução completa + métricas de campanha (se já tiver)
   - Modelo: claude-sonnet-4-6
   - Prompt: "Analise esta execução e extraia 3-8 learnings atômicos..."
   - Output: array de learnings (JSON estruturado)
   - Salva no banco + gera embeddings

4. Aggregator (Celery task diária):
   - Busca learnings dos últimos 30 dias
   - Clusteriza por similaridade (embeddings)
   - Para cada cluster: gera pattern via Claude
   - Atualiza tabela patterns (upsert)

5. Tools do Jarvis (integração com Fase B):
   - query_learnings(filters) — busca SQL com filtros
   - find_similar_campaigns(product_id) — busca vetorial
   - get_insights(importance_min) — insights curados

6. Dashboard simples em /insights:
   - Top 10 patterns por confidence
   - Últimos learnings (feed)
   - Busca full-text + filtro por categoria

7. Tests:
   - backend/tests/test_extractor.py (mock execution completa)
   - backend/tests/test_aggregator.py
   - backend/tests/test_memory_search.py

IMPORTANTE:
- Use Anthropic embeddings OU voyage-3 (mais barato e bom)
- Extractor roda async (Celery), nunca bloqueando a UI
- Validar que learnings têm evidência quantitativa sempre que possível
- Permitir que o usuário marque learning como inválido (feedback loop)
```

## Critérios de aceite — Fase E

- [ ] Migration aplicada, pgvector funcionando
- [ ] Extractor gera learnings automaticamente após execução
- [ ] Aggregator roda diariamente e atualiza patterns
- [ ] Jarvis consegue responder "que ângulo funcionou melhor em [nicho]?"
- [ ] Dashboard /insights mostra patterns e learnings
- [ ] Busca vetorial retorna resultados relevantes

## Riscos — Fase E

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Learnings ruins (LLM inventa coisas) | Alta | Alto | Exigir evidência quantitativa, usuário pode invalidar |
| Custo de embeddings subir com volume | Média | Baixo | Voyage-3 é barato, cache agressivo |
| pgvector lento com milhões de rows | Baixa (início) | Médio | Índice ivfflat + considerar Qdrant na v3 |

---

# FASE F — Filtros, Polish e Testes

## Objetivo
Finalizar a V2 com filtros consistentes em todas as telas, polish de UX, testes end-to-end, e documentação atualizada.

## Escopo

- Filtros globais padronizados em todas as listagens
- Loading states e empty states em todos os lugares
- Keyboard shortcuts (? para help, Cmd+K para busca)
- Testes E2E do fluxo completo (produto → execução → aprovação → campanha)
- README atualizado, CLAUDE.md revisado
- Pre-launch checklist completo

## Prompt para Claude Code — Fase F

```markdown
Fase final da V2 do AdCraft. Polish geral, testes e documentação.

1. Filtros consistentes:
   - Componente <FilterBar /> reutilizável
   - Aplicar em: /produtos, /demandas, /campanhas, /insights
   - Persistir filtros na URL (?status=active&period=30d)

2. UX polish:
   - Empty states com ilustração + CTA em todas as listagens
   - Skeleton loaders padronizados
   - Toasts de sucesso/erro consistentes
   - Keyboard shortcuts:
     - ? abre modal de shortcuts
     - Cmd+K abre command palette
     - Cmd+/ foca no Jarvis
     - g p vai pra produtos, g d pra demandas, etc

3. Testes E2E (Playwright):
   - Fluxo: criar produto → rodar execução → aprovar step → ver resultado
   - Fluxo: chat com Jarvis → pedir análise → receber resposta com tool use
   - Fluxo: filtrar demandas → abrir uma → re-executar agente

4. Documentação:
   - README.md: setup completo, arquitetura, principais comandos
   - CLAUDE.md: atualizar com mudanças da V2
   - docs/ARCHITECTURE.md: diagrama atualizado
   - docs/JARVIS.md: guia de uso do Jarvis
   - docs/AGENTS.md: lista de agentes, modelos, prompts

5. Pre-launch checklist:
   - [ ] Todos os testes passando em CI
   - [ ] .env.example atualizado
   - [ ] Migrations testadas em ambiente limpo
   - [ ] Logs estruturados (JSON) em produção
   - [ ] Error tracking (Sentry) configurado
   - [ ] Backup do Supabase automatizado
   - [ ] Secrets fora do código
   - [ ] Rate limits configurados (Anthropic, FB Ads, Google Ads)
   - [ ] Rollback plan documentado
```

## Critérios de aceite — Fase F

- [ ] Filtros funcionam e persistem na URL em todas as telas
- [ ] Keyboard shortcuts documentados e funcionais
- [ ] 3 fluxos E2E passando em CI
- [ ] README + CLAUDE.md atualizados
- [ ] Pre-launch checklist 100% completo

---

# 🛡️ ADRs — Architecture Decision Records

## ADR-001 — Migração Gemini → Claude

**Decisão:** Trocar Gemini por Claude (Anthropic) nos agentes de texto/análise.

**Alternativas:**
- Manter Gemini (status quo)
- Usar GPT-4o/5
- Multi-provider (Claude + Gemini + GPT)

**Rationale:** Teste prático demonstrou qualidade superior do Claude para os prompts do AdCraft. Multi-provider aumenta complexidade sem ganho proporcional no estágio atual.

**Trade-off:** Custo do Opus é maior que Gemini. Mitigado com Sonnet default e Opus só em agentes críticos.

---

## ADR-002 — Jarvis como agente Claude com tool use

**Decisão:** Jarvis é um agente Claude Opus 4.7 com 15+ tools, não um chatbot com comandos.

**Alternativas:**
- Chatbot com comandos `/commands` (status atual)
- Jarvis como orquestrador que chama outros agentes (sem tool use direto)

**Rationale:** Usuário quer inteligência aberta igual ao Claude Code. Tool use nativo é o padrão da Anthropic e o mais robusto.

**Trade-off:** Custo por conversa mais alto (Opus + loops). Mitigado com cache de prompt + summarization.

---

## ADR-003 — Embeddings: Voyage-3 em vez de OpenAI

**Decisão:** Usar `voyage-3` para embeddings da memória cumulativa.

**Alternativas:**
- OpenAI text-embedding-3-small
- Anthropic (não tem embeddings nativos)
- Local (sentence-transformers)

**Rationale:** Voyage-3 é recomendado pela Anthropic, barato, e tem qualidade competitiva com OpenAI. Evita dependência adicional.

**Trade-off:** Vendor novo. Mitigado: wrapper em `embeddings.py` permite trocar provider em 1 lugar.

---

# 📊 Priorização e Pré-mortem

## Priorização (RICE simplificado)

| Fase | Reach (1-5) | Impact (1-5) | Confidence (%) | Effort (dias) | Score |
|------|-------------|--------------|----------------|---------------|-------|
| A — Migração Claude | 5 | 5 | 95% | 5 | **4.75** |
| B — Jarvis | 5 | 5 | 80% | 10 | **2.00** |
| C — Tela Demandas | 5 | 4 | 90% | 5 | **3.60** |
| D — Tela Produto | 5 | 4 | 85% | 10 | **1.70** |
| E — Memória | 4 | 5 | 70% | 5 | **2.80** |
| F — Polish | 5 | 2 | 95% | 4 | **2.37** |

**Ordem de execução (já validada com você):** A → B → C → D → E → F

## Pré-mortem: "Esta V2 fracassou. Por quê?"

1. **Migração pro Claude não trouxe a qualidade esperada** → Mitigação: comparar cada agente com teste manual antes de fechar a fase. Se qualidade cair, investigar prompt-by-prompt.

2. **Jarvis virou lento demais por causa do tool use em loop** → Mitigação: limite de 25 iterações, streaming, timeout por tool call, UI mostra progresso.

3. **Custo do Opus estourou o orçamento mensal** → Mitigação: Sonnet como default, Opus só em agentes críticos, dashboard de custos, alertas.

4. **Memória cumulativa gerou learnings ruins e poluiu respostas do Jarvis** → Mitigação: feedback loop (usuário invalida), limite de confidence mínima pra patterns aparecerem.

5. **Tela de Produto ficou pesada e lenta** → Mitigação: lazy load por aba, paginação, skeleton loaders, monitorar Core Web Vitals.

6. **Você perdeu a motivação no meio e o projeto parou em D** → Mitigação: entregar valor em cada fase. Fase A já traz ganho imediato. Não precisa completar tudo pra ter valor.

---

# 🚀 Próximos Passos Imediatos

1. **Salvar este documento** na raiz do projeto como `PLANO_EXECUCAO_V2.md`
2. **Atualizar o CLAUDE.md** adicionando referência à V2
3. **Abrir o Claude Code** no diretório do projeto
4. **Colar o prompt da Fase A** e executar
5. **Ao completar Fase A**, rodar validação manual com produto real
6. **Seguir sequencialmente** para B, C, D, E, F

**Regra de ouro:** não pular pra próxima fase sem fechar os critérios de aceite da atual. Se precisar reorganizar, faça explicitamente (mudança de escopo registrada).

---

**FIM DO PLANO DE EXECUÇÃO V2**

Gerado em 16/04/2026 como thinking partner do João para a refatoração do AdCraft.
