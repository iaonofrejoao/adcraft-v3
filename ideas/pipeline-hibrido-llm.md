# Pipeline Híbrido de LLMs — Otimização de Custo/Qualidade

**Status:** Ideia documentada — não implementada  
**Contexto:** Hoje o pipeline usa Claude Sonnet 4.6 em todos os 18 agentes. Custo medido: ~R$60 por produto completo até scripts de vídeo (~1,57M tokens).

---

## Problema

Todos os agentes do pipeline usam o mesmo modelo (Claude Sonnet 4.6) independente da complexidade da tarefa. Agentes que fazem trabalho mecânico (montar storyboard, gerar prompts de keyframe) pagam o mesmo preço que agentes que fazem raciocínio estratégico profundo (angle generator, script writer).

---

## Proposta: roteamento de modelo por agente

A ideia é classificar cada agente por **nível de exigência cognitiva** e atribuir o modelo mais barato que ainda entrega qualidade aceitável.

### Tier 1 — Raciocínio estratégico (Claude Sonnet ou Gemini 2.5 Pro)

Agentes onde a qualidade do output impacta diretamente a conversão. Troca de modelo aqui arrisca perda de receita.

| Agente | Por quê manter modelo premium |
|--------|-------------------------------|
| VSL Analysis | Interpretação de nuance persuasiva, identificação de mecanismo único |
| Avatar Research | Síntese psicográfica profunda, linguagem exata do avatar |
| Angle Generator | Decisão estratégica mais crítica do pipeline — define o posicionamento |
| Campaign Strategy | Raciocínio de mídia paga, KPIs, sequência de lançamento |
| Script Writer | Copy palavra a palavra que vai ao ar — qualidade direta em conversão |
| Copywriting | Hooks, bodies, CTAs — impacto direto em hook rate e CVR |
| Creative Director | Julgamento de qual combinação vai ao ar |
| Compliance Check | Risco legal — erro caro |

### Tier 2 — Síntese estruturada (Gemini 2.5 Pro ou Flash com thinking)

Agentes que transformam inputs bem definidos em outputs estruturados. Menos julgamento, mais organização.

| Agente | Justificativa |
|--------|---------------|
| Market Research | Pesquisa e sumarização — Gemini Pro tem excelente recall e web search |
| Benchmark Intelligence | Análise comparativa de concorrentes — tarefa bem definida |
| Performance Analysis | Interpretação de métricas — inputs estruturados, output estruturado |
| Scaling Strategy | Regras de escala baseadas em dados — pouco julgamento criativo |
| Facebook Ads | Montar estrutura de campanha a partir de copy aprovada |
| Google Ads | Idem |
| UTM Builder | Tarefa puramente mecânica — poderia até ser código determinístico |

### Tier 3 — Transformação mecânica (Gemini 2.5 Flash sem thinking)

Agentes que recebem inputs completos e produzem outputs formatados sem necessidade de raciocínio criativo.

| Agente | Justificativa |
|--------|---------------|
| Character Generator | Preencher campos de descrição física a partir do avatar — template-driven |
| Keyframe Generator | Construir prompts VEO 3 seguindo estrutura fixa + character_anchor |
| Video Maker | Integrar e organizar artefatos existentes — sem geração de conteúdo novo |

---

## Estimativa de custo com roteamento híbrido

Assumindo ~1,57M tokens totais e a distribuição abaixo:

| Tier | Tokens estimados | Modelo | Custo USD |
|------|-----------------|--------|-----------|
| Tier 1 (8 agentes) | ~800k | Claude Sonnet 4.6 | ~$5,30 |
| Tier 2 (7 agentes) | ~500k | Gemini 2.5 Pro | ~$1,24 |
| Tier 3 (3 agentes × 8 combos) | ~270k | Gemini 2.5 Flash | ~$0,06 |
| **Total** | **~1,57M** | **Híbrido** | **~$6,60** |

**Economia vs. Claude puro:** ~$3,77 por produto (~36% de redução)  
**Em reais:** de ~R$60 → ~R$38 por produto

A economia cresce proporcionalmente com o volume de produtos processados.

---

## Como implementar

### 1. Parâmetro `model` no skill de cada agente

Cada skill em `.claude/skills/agents/<agente>.md` ganharia um campo no frontmatter:

```yaml
---
name: keyframe-generator
model: gemini-2.5-flash
tier: 3
---
```

### 2. Orquestrador lê o model do skill antes de spawnar

No fluxo de execução do pipeline, antes de spawnar cada subagente:

```typescript
const skill = readSkill(agentName)
const model = skill.frontmatter.model ?? 'claude-sonnet-4-6' // fallback Claude
spawnAgent({ model, prompt: buildPrompt(skill, context) })
```

### 3. Adapter de API por modelo

Criar um `workers/lib/llm-router.ts` que recebe `{ model, prompt }` e roteia para:
- `anthropic.messages.create()` se modelo for Claude
- `google.generativeai` se modelo for Gemini

O `scripts/artifact/save.ts` já é agnóstico de modelo — não precisa mudar.

### 4. Fallback automático

Se o modelo Gemini falhar ou retornar JSON inválido após 2 tentativas, fazer fallback automático para Claude com log de warning. Isso protege o pipeline de inconsistências de API.

---

## Riscos e considerações

| Risco | Mitigação |
|-------|-----------|
| Gemini Flash gera JSON fora do schema | Validação de schema obrigatória antes de salvar artefato |
| Diferença de qualidade no character/keyframe impacta o script | Testar lado a lado antes de colocar em produção |
| Latência maior na API do Google em horários de pico | Retry com backoff exponencial no llm-router |
| Mudanças de preço da Anthropic/Google | Revisar tier assignments semestralmente |

---

## Próximos passos (quando for implementar)

1. [ ] Testar character-generator e keyframe-generator com Gemini 2.5 Flash em produto real — comparar output lado a lado com Claude
2. [ ] Testar market-research com Gemini 2.5 Pro — avaliar qualidade do avatar e dados de mercado
3. [ ] Criar `workers/lib/llm-router.ts` com suporte a Anthropic + Google GenAI
4. [ ] Adicionar campo `model` no frontmatter dos skills Tier 2 e Tier 3
5. [ ] Adicionar validação de schema JSON antes de cada `save.ts`
6. [ ] Medir custo real do híbrido em 3 produtos e comparar com estimativa
