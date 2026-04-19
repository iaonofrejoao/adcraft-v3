# Plano de Execução — Saneamento e Escala dos Agentes AdCraft v2

**Data:** 2026-04-19  
**Objetivo:** Resolver todos os débitos técnicos dos skills de agentes de forma definitiva, preparando o pipeline para escala de produto.

---

## Como usar este plano

Cada bloco é independente e pode ser delegado a um sub-agente Claude Code separado.  
Execute **Bloco A primeiro** — os outros blocos dependem dos campos corretos que ele define.  
Cada tarefa tem um critério de "done" verificável.

---

## Bloco A — Bugs Críticos de Campo (quebra silenciosa de dados)

**Prioridade: MÁXIMA. Sem isso, o pipeline produz lixo silenciosamente.**

### A1 — Alinhar campos `product` entre vsl-analysis e consumidores

**Problema:** `vsl-analysis.md` produz campos com nomes diferentes dos que os agentes consumidores leem.

| Campo produzido (vsl-analysis) | Campo lido (errado) | Agentes afetados |
|---|---|---|
| `main_promise` | `main_claim` | benchmark-intelligence, script-writer |
| `ticket_price` | `price` | benchmark-intelligence, script-writer |
| `vsl_url` | `platform` (como URL de destino) | utm-builder |
| *(campo ausente)* | `niche` | benchmark-intelligence, character-generator |

**Ação:**  
1. Em `vsl-analysis.md`: adicionar campo `niche` ao output schema (string, ex: "emagrecimento feminino 40+")  
2. Em `benchmark-intelligence.md`: substituir `product.main_claim` → `product.main_promise` e `product.price` → `product.ticket_price`  
3. Em `script-writer.md`: substituir `product.main_claim` → `product.main_promise` e `product.price` → `product.ticket_price`  
4. Em `utm-builder.md`: documentar que `base_url` vem de `product.vsl_url` (não `product.platform`)  

**Critério de done:** Buscar `main_claim` e `product.price` em todos os skills — resultado zero.

---

### A2 — Corrigir dependência no pipeline YAML

**Problema:** `utm_builder` no YAML tem `depends_on: [campaign_strategy]`, mas o skill lê `creative_brief.combinations_ranked`. Isso faz o agente rodar antes de ter as tags de criativo aprovadas.

**Ação:**  
Em `full-pipeline.yaml`, linha do `utm_builder`:
```yaml
# ANTES:
depends_on: [campaign_strategy]

# DEPOIS:
depends_on: [campaign_strategy, creative_director]
```

Remover do `parallel_group: pre_launch` pois não pode mais rodar em paralelo com `compliance_check`.

**Critério de done:** Pipeline YAML refletindo dependência correta. UTM builder não roda antes de creative_director.

---

## Bloco B — Schema Formais Incompletos

**Prioridade: ALTA. Campos sem contrato formal causam interpretações divergentes entre agentes.**

### B1 — Definir schema formal de `policy_warnings` em campaign-strategy

**Problema:** `campaign_strategy.policy_warnings` é um array mas sem tipagem. `creative_director` (agent 12) e `facebook_ads` (agent 15) iteram sobre ele e tomam decisões — formato desconhecido = comportamento imprevisível.

**Ação:**  
Em `campaign-strategy.md`, seção Output, definir:
```json
"policy_warnings": [
  {
    "platform": "facebook",
    "category": "health_claims | financial | adult | before_after",
    "description": "O que evitar — instrução concreta",
    "severity": "critical | warning"
  }
]
```

Atualizar `creative-director.md` para iterar sobre esse schema ao verificar `compliance_issues`.

**Critério de done:** Schema de `policy_warnings` documentado com enum de `category` e `severity`.

---

### B2 — Adicionar `approved_tags` e `rejected_tags` ao output de compliance-check

**Problema:** `compliance_check` emite `issues[].tag` mas não uma lista clara de aprovados/rejeitados. `facebook_ads`, `google_ads` e `utm_builder` precisam saber por combinação se podem usá-la — atualmente inferem isso da ausência/presença na lista de issues.

**Ação:**  
Em `compliance-check.md`, adicionar ao output:
```json
{
  "facebook_approved": true,
  "google_approved": true,
  "overall_approved": false,
  "approved_tags": ["CITX_v1_H1", "CITX_v1_H2", "CITX_v1_B1", "CITX_v1_B2", "CITX_v1_C1"],
  "rejected_tags": ["CITX_v1_H3"],
  "approved_combinations": ["CITX_v1_H1_B2_C3", "CITX_v1_H2_B1_C3"],
  "rejected_combinations": ["CITX_v1_H3_B1_C3", "CITX_v1_H3_B2_C3"],
  "issues": [ ... ]
}
```

Atualizar `facebook-ads.md` e `google-ads.md` para ler `compliance_results.approved_combinations` em vez de inferir.

**Critério de done:** `facebook_ads` e `google_ads` fazem lookup direto em `approved_combinations` — zero lógica de inferência.

---

### B3 — Formalizar enum de `market_maturity` em benchmark-intelligence

**Problema:** `market_maturity` tem 4 valores válidos listados no campo `###Enums obrigatórios` mas é marcado como campo **opcional** — isso permite que `campaign_strategy` tente ler um campo vazio e tome decisão de plataforma sem dados.

**Ação:**  
Em `benchmark-intelligence.md`: mover `market_maturity` de opcional para **obrigatório**.  
Adicionar fallback: "Se não for possível determinar, usar `crescendo` como default conservador e documentar em `data_sources`."

**Critério de done:** `market_maturity` na seção **Obrigatórios** do benchmark skill.

---

### B4 — Padronizar `clothing_type` em character-generator para keyframe-generator

**Problema:** O template do `character_anchor` em `keyframe-generator.md` usa `{clothing_type}`, mas `character.visual_anchors` não tem esse campo separado — está embutido em `style: "casual clean — white t-shirt"`. O keyframe_generator precisa inferir o tipo de roupa do campo `style`, o que é frágil.

**Ação:**  
Em `character-generator.md`, adicionar `clothing_type` ao schema de `visual_anchors`:
```json
"visual_anchors": {
  "clothing_color": "white",
  "clothing_type": "t-shirt",
  "style_description": "casual clean, no accessories",
  ...
}
```

Atualizar o exemplo completo do output com o novo campo.  
Em `keyframe-generator.md`: confirmar que o template já usa `clothing_color` e `clothing_type` como campos separados.

**Critério de done:** `keyframe_generator` monta o `character_anchor` sem precisar parsear nenhum campo de texto livre.

---

### B5 — Resolver conflito de percentual de CPA target em campaign-strategy

**Problema:** Dois valores conflitantes para o CPA target no mesmo arquivo:
- Metodologia passo 4: `CPA_target = estimated_margin_brl × 0.4`
- Regra obrigatória 4: `target_cpa_brl deve ser ≤ estimated_margin_brl × 0.5`

`performance_analysis` e `scaling_strategy` usam esse número como referência absoluta — 25% de diferença muda completamente o diagnóstico.

**Decisão de negócio:** Adotar **40% como o target** (mais conservador), e 50% como o **teto de emergência** (CPA aceitável mas não ótimo).

**Ação:**  
Em `campaign-strategy.md`:
- Metodologia: `CPA_target = estimated_margin_brl × 0.4` (manter)
- Regra 4: `target_cpa_brl = estimated_margin_brl × 0.4. Teto aceitável: × 0.5`
- Output schema: documentar dois campos: `target_cpa_brl` (40%) e `max_acceptable_cpa_brl` (50%)

Atualizar `performance-analysis.md` para usar `target_cpa_brl` como benchmark e `max_acceptable_cpa_brl` como limite antes de classificar `critical`.

**Critério de done:** Um único valor de CPA target por produto, sem ambiguidade.

---

## Bloco C — Fluxo de Aprovação Criativa (gap estrutural)

**Prioridade: ALTA. Hoje existe conflito potencial entre creative_director e compliance.**

### C1 — Reconciliação entre creative_director e compliance_check

**Problema:** `creative_director` aprova combinações com `approved_for_production: true`. Depois, `compliance_check` pode rejeitar componentes dessas combinações. `facebook_ads` recebe os dois artefatos com informações conflitantes e não tem protocolo para reconciliar.

**Ação:**  
1. Em `creative-director.md`: adicionar instrução explícita:  
   > "O `approved_for_production: true` emitido aqui é aprovação **criativa** — a aprovação final depende do `compliance_check`. O agent `facebook_ads` usará `compliance_results.approved_combinations` como fonte autoritativa final."

2. Em `facebook-ads.md`: documentar ordem de precedência explícita:  
   > "Fonte autoritativa para quais combinações lançar: `compliance_results.approved_combinations`. O `creative_brief.top_combination` é a recomendação criativa — se a top_combination estiver em `approved_combinations`, usar ela. Se não, usar a próxima em `combinations_ranked` que esteja aprovada."

3. Em `compliance-check.md`: adicionar ao sistema de prompt:  
   > "Ao emitir `rejected_combinations`, verificar se a `creative_brief.top_combination` está entre elas. Se sim, adicionar nota em `compliance_notes`: 'top_combination bloqueada — fallback para segunda opção ranqueada'."

**Critério de done:** `facebook_ads` nunca precisa tomar decisão por inferência — encontra a resposta diretamente em `approved_combinations`.

---

### C2 — Protocolo de re-run quando creative_director bloqueia

**Problema:** Quando `creative_director` emite `approved_for_production: false` com `revision_requests`, o pipeline não tem protocolo para re-invocar o agente indicado. Hoje é uma nota em prosa para o operador.

**Ação:**  
Em `_pipeline.md`: adicionar seção "Loops de revisão":

```
Se creative_director.approved_for_production = false:
  1. Ler revision_requests[].agent para saber qual agente re-rodar
  2. Invocar o agente indicado com o mesmo pipeline_id e task_id novo
  3. Salvar novo artefato com incremento de versão (v2, v3...)
  4. Re-invocar creative_director com os novos artefatos
  5. Máximo 2 loops de revisão — se ainda bloqueado, escalar para o usuário

Se compliance_check.overall_approved = false E creative_brief.approved_for_production = true:
  1. Verificar approved_combinations — se array não-vazio, prosseguir com essas combinações
  2. Se approved_combinations vazio: pausar pipeline e notificar usuário
```

**Critério de done:** `_pipeline.md` documenta os loops de revisão com critério de parada.

---

## Bloco D — Agent video-maker (sub-documentado)

**Prioridade: MÉDIA. Funciona minimamente mas está muito abaixo do padrão dos outros agentes.**

### D1 — Expandir video-maker ao nível dos outros agentes

**Problema:** `video-maker.md` tem ~75 linhas contra 200+ dos outros. Falta:
- Metodologia de execução (como transforma script + keyframes em storyboard)
- Handoff explícito com keyframe_generator (o que video_maker não precisa refazer)
- Tabela de `section → subtitle placement`
- Casos de borda
- Critérios de qualidade

**Ação:**  
Reescrever `video-maker.md` adicionando:

1. **Metodologia clara**: o video_maker não gera prompts VEO 3 do zero — lê os `veo3_prompt_en` de `keyframes` e os usa diretamente, adicionando `subtitle_text` (do copy aprovado) e `visual_notes` (instruções para o editor)

2. **Tabela de integração copy → storyboard**:
   | Cena (section) | Fonte do subtitle | Fonte do veo3_prompt |
   |---|---|---|
   | `hook` | `hooks[selected_variant].hook_text` | `keyframes[cena1].veo3_prompt_en` |
   | `problem` | Narração da cena (script) | `keyframes[cena2].veo3_prompt_en` |
   | `mechanism` | Narração + USP | `keyframes[cena3].veo3_prompt_en` |
   | `proof` | Body_short do body aprovado | `keyframes[cena4].veo3_prompt_en` |
   | `cta` | CTA aprovado | `keyframes[cena5].veo3_prompt_en` + overlay_suggestion |

3. **Critérios de qualidade**: mesma tabela padrão dos outros agentes

4. **Casos de borda**: produto sem personagem, roteiro <15s, plataforma TikTok

**Critério de done:** `video-maker.md` com metodologia, casos de borda e critérios de qualidade na mesma profundidade dos agentes 7-10.

---

## Bloco E — Completude de Contexto Entre Agentes

**Prioridade: MÉDIA. Melhora a qualidade do output, não corrige quebras.**

### E1 — Adicionar benchmark como input do angle-generator

**Problema:** `angle_generator` pode gerar um ângulo que todos os concorrentes já usam — sem ler `benchmark.winning_angles_in_market`, o agente opera no escuro.

**Ação:**  
Em `angle-generator.md`, seção "Contexto necessário":
```
- Artefato `benchmark` (benchmark_intelligence) — `winning_angles_in_market`, `differentiation_opportunities`
```

Adicionar regra obrigatória:
> "REGRA 6: Verificar `benchmark.winning_angles_in_market`. O `primary_angle` NÃO pode ser idêntico a nenhum dos ângulos vencedores listados — se coincidir, ajustar para uma variação lateral. Documentar em `angle_rationale` por que este ângulo se diferencia do mercado."

Em `full-pipeline.yaml`, adicionar `benchmark_intelligence` às dependências de `angle_generator`:
```yaml
depends_on: [vsl_analysis, market_research, avatar_research, benchmark_intelligence]
```

**Critério de done:** `angle_generator` lê `benchmark` e nunca produz ângulo idêntico a um concorrente.

---

### E2 — Protocolo de dados para performance-analysis

**Problema:** O agente 17 precisa de dados reais de campanha mas não há protocolo documentado de como fornecê-los — nem formato de CSV, nem como re-invocar o pipeline após semanas de veiculação.

**Ação:**  
Em `performance-analysis.md`, adicionar seção "Como fornecer dados ao agente":

```markdown
## Como invocar este agente

Este agente é o único do pipeline que requer dados externos (não gerados por outros agentes).

### Formato de dados aceitos

**Opção A — CSV do Facebook Ads Manager:**
Exportar relatório com colunas: Nome do anúncio, Gasto (BRL), Impressões, Cliques, Compras, CTR, CPM, Frequência, Visualizações de 3s (para vídeo)
Período mínimo: 7 dias. Recomendado: 14 dias.

**Opção B — Dados colados manualmente:**
Fornecer por ad set e por criativo (usando o naming convention AdCraft):
- Nome: [naming convention]
- Gasto: R$XX
- Impressões: XX
- Cliques: XX
- Conversões: XX
- Hook rate: XX% (se vídeo)

### Como invocar

"Analisa performance do pipeline [pipeline_id] — dados abaixo:
[colar dados]"

O agente vai cruzar os dados fornecidos com os artefatos `campaign_strategy`, 
`facebook_ads` e `creative_brief` já salvos no pipeline_id.
```

**Critério de done:** Qualquer operador consegue invocar o agent 17 sem ambiguidade sobre o formato de dados.

---

### E3 — Protocolo de re-entrada para scaling_strategy → novos criativos

**Problema:** Quando `scaling_strategy` recomenda "retornar ao script_writer e copywriting com novo ângulo", não há protocolo formalizado de como criar um novo pipeline ou re-usar o pipeline existente.

**Ação:**  
Em `scaling-strategy.md`, substituir instrução em prosa por protocolo:

```markdown
## Quando todos os criativos são losers

Ao emitir `scale_recommendation: maintain` por ausência de winner:

`new_pipeline_instructions`:
```
Criar novo pipeline de fase criativa apenas:
npx tsx scripts/pipeline/create.ts --product-id <uuid> --type criativo --parent-pipeline <pipeline_id>

Briefing para script_writer e copywriting:
- angle_type alternativo: usar `angles.alternative_angles[0]`
- Manter artefatos de pesquisa do pipeline pai (product, market, avatar, benchmark)
- Justificativa no script_rationale: "Novo ângulo — ângulo anterior [ângulo] não converteu"
```
```

**Critério de done:** Operador consegue criar pipeline criativo de retest sem perder o contexto de pesquisa do pipeline original.

---

## Bloco F — Campos Dead e Clareza Semântica

**Prioridade: BAIXA. Limpeza que evita confusão futura.**

### F1 — Documentar `product.commission_percent` como campo de rastreamento

**Problema:** `commission_percent` está no output do `vsl_analysis` mas nenhum agente o usa explicitamente. Pode ser usado por `campaign_strategy` para calcular margem do afiliado — mas não está documentado.

**Ação:**  
Em `campaign-strategy.md`, metodologia passo 4, adicionar:
> "Se o produto for de afiliado: `estimated_margin_brl = ticket_price × (commission_percent / 100)`. Usar este valor para a fórmula de budget."

### F2 — Desambiguar `style_reference: "testimonial"` vs `character_role: "testimonial"`

**Problema:** Dois campos distintos com mesmo valor `"testimonial"` geram confusão semântica. `style_reference` refere-se ao estilo visual do vídeo; `character_role` refere-se ao papel narrativo do personagem.

**Ação:**  
Em `character-generator.md`, renomear enum de `style_reference` de `"testimonial"` para `"ugc_testimonial"` para diferenciá-lo visualmente do `character_role`.

Atualizar `keyframe-generator.md` para usar o novo valor no `style_suffix` correspondente.

---

## Sequência de Execução Recomendada

```
Semana 1 (débitos que quebram o pipeline):
  ├── A1 — Corrigir campos product (2h)
  ├── A2 — Corrigir YAML utm_builder (15min)
  ├── B2 — Schema approved_tags no compliance (1h)
  └── B5 — Resolver conflito CPA 40% vs 50% (30min)

Semana 2 (contratos formais entre agentes):
  ├── B1 — Schema policy_warnings (1h)
  ├── B3 — market_maturity obrigatório (30min)
  ├── B4 — clothing_type separado em character (45min)
  └── C1 — Protocolo de precedência compliance vs creative_director (2h)

Semana 3 (robustez operacional):
  ├── C2 — Loops de revisão em _pipeline.md (2h)
  ├── D1 — Expandir video-maker (3h)
  └── E1 — benchmark como input de angle_generator + YAML (1h)

Semana 4 (protocolo de uso e limpeza):
  ├── E2 — Protocolo de dados para performance_analysis (1h)
  ├── E3 — Protocolo re-entrada scaling → criativo (1h)
  ├── F1 — commission_percent documentado (20min)
  └── F2 — Desambiguar style_reference (30min)
```

---

## Critério Global de Conclusão

O plano está completo quando:

1. `grep -r "main_claim\|product\.price\b" .claude/skills/` → resultado zero
2. `compliance_results.approved_combinations` existe em todos os pipelines gerados
3. `full-pipeline.yaml`: `utm_builder.depends_on` inclui `creative_director`
4. `full-pipeline.yaml`: `angle_generator.depends_on` inclui `benchmark_intelligence`
5. `_pipeline.md` documenta loops de revisão com critério de parada
6. `video-maker.md` tem seções: Metodologia, Casos de borda, Critérios de qualidade
7. `performance-analysis.md` tem seção "Como invocar este agente"
8. Nenhum skill usa a palavra `main_claim` para referenciar o artefato product
