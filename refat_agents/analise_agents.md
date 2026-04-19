---
  Análise Completa dos Agentes AdCraft v2

  Parte 1 — Qualidade Individual por Agente

  ---
  FASE 1 — PESQUISA

  ---
  Agent 1: vsl_analysis — ⭐⭐⭐⭐ (4/5)

  Pontos fortes:
  - É o único agente com zero dependências — ponto de entrada limpo e bem justificado
  - Output schema é detalhado e bem tipado (social_proof, offer_structure com subcampos)
  - data_sources obrigatório garante rastreabilidade

  Problemas identificados:
  - Bug de campo: o artefato produz main_promise, mas script_writer lê main_claim. Esse mismatch vai silenciosamente passar undefined para o  
  roteirista — a promessa central do produto some da narração
  - Bug de campo 2: script_writer também lê product.price, mas o schema real tem ticket_price e offer_structure.price_brl
  - Não tem campo niche explícito, mas character_generator tenta ler product.niche
  - Fallback para VSL em vídeo (WebSearch por reviews) é frágil — pode retornar informação de produto diferente

  Melhoria prioritária: Adicionar niche ao schema de output e alinhar nomes de campos com os agentes consumidores.

  ---
  Agent 2: market_research — ⭐⭐⭐⭐ (4/5)

  Pontos fortes:
  - 5 fontes em ordem de prioridade define claramente onde ir primeiro
  - viability_score (0-100) + viability_verdict são usados corretamente por campaign_strategy com lógica condicional

  Problemas identificados:
  - estimated_margin_brl é calculado aqui, mas toda a estratégia de budget dos próximos 5 agentes depende dele. Não há validação nem
  cross-check desse número
  - competition_level é um enum implícito ("low", "medium", "saturated") mas nunca declarado formalmente no skill

  ---
  Agent 3: avatar_research — ⭐⭐⭐⭐⭐ (5/5)

  O mais bem documentado da fase de pesquisa.

  Pontos fortes:
  - verbatim_expressions é regra obrigatória — garante que a linguagem do avatar real chega até o copywriter, roteirista e keyframes
  - data_sources obrigatório
  - full_profile e psychographic bem separados como subcampos

  Observação menor: full_profile.age_range é usado diretamente por character_generator para definir aparência do personagem — estrutura       
  correta, mas depende de que o formato seja string "35-50" e não outro. Não está documentado o formato exato.

  ---
  Agent 4: benchmark_intelligence — ⭐⭐⭐⭐ (4/5)

  Pontos fortes:
  - Metodologia de 6 fontes com ordem de prioridade rigorosa
  - Casos de borda bem tratados
  - differentiation_opportunities é um campo rico que chega até campaign_strategy e até scaling_strategy

  Problemas identificados:
  - O agente depende de market mas não usa market.viability_score ou market.competition_level para calibrar o nível de profundidade do        
  benchmark. Um mercado saturado deveria exigir benchmark mais agressivo que um mercado em crescimento
  - Produz market_maturity mas não há enum formal declarado para esse campo — campaign_strategy consome o valor e toma decisões baseado nele  

  ---
  Agent 5: angle_generator — ⭐⭐⭐⭐⭐ (5/5)

  Pontos fortes:
  - Regras mais rígidas do pipeline: enums explícitos para angle_type (7 valores) e hook_type (4 valores)
  - selected_hook_variant é o mecanismo que ancora toda a fase criativa — excelente design
  - alternative_angles é usado muito mais tarde pelo scaling_strategy para combater fadiga criativa — continuidade de longo prazo

  Observação: O agente não lê benchmark — pode gerar um ângulo que a concorrência já usa. Idealmente, benchmark.top_competitor_angles deveria 
  ser input aqui.

  ---
  Agent 6: campaign_strategy — ⭐⭐⭐⭐ (4/5)

  Pontos fortes:
  - Lógica de decisão de plataforma baseada em evidência, não preferência
  - Fórmula de budget com cálculo explícito é ótimo
  - 4 fases de launch_sequence com critérios de corte

  Problema crítico identificado:
  - Na metodologia (passo 4): CPA_target = estimated_margin_brl × 0.4
  - Na regra obrigatória (regra 4): target_cpa_brl deve ser ≤ estimated_margin_brl × 0.5
  - No output de exemplo: target_cpa_brl: 72.0 com estimated_margin_brl: 180.0 = 40%
  - Há conflito: 40% na fórmula vs. 50% como teto. Os agentes downstream (performance_analysis, scaling_strategy) usam esse número como       
  referência absoluta. Uma discrepância de 25% no CPA target muda completamente o diagnóstico de "on_track" vs "underperforming"
  - policy_warnings é array no output, mas o campo não tem schema definido (o que vai dentro?). creative_director tenta iterar sobre ele para 
  verificar compliance — vai falhar silenciosamente se o formato for diferente do esperado

  ---
  FASE 2 — CRIATIVO

  ---
  Agent 7: script_writer — ⭐⭐⭐⭐⭐ (5/5)

  O mais completo do pipeline. Serve de blueprint para todos os agentes visuais.

  Pontos fortes:
  - Tabela angle_type → framework narrativo elimina ambiguidade
  - Tabela plataforma → formato + duração elimina julgamento subjetivo
  - visual_direction com mínimo de 15 palavras por cena é excelente — garante que keyframe_generator tem material suficiente
  - emotion_cue enum com 6 valores criado aqui e propagado até keyframe_generator e validado em creative_director — excelente cadeia de       
  continuidade

  Bug de campo (já citado): lê product.main_claim e product.price que não existem no schema do vsl_analysis. Os dados corretos são
  main_promise, ticket_price e offer_structure.price_brl.

  ---
  Agent 8: copywriting — ⭐⭐⭐⭐ (4/5)

  Pontos fortes:
  - Separação de body_short e body_long por tamanho é essencial para múltiplas plataformas
  - Sistema de tags {SKU}_v{N}_{H|B|C}{1-3} é o eixo de rastreabilidade de todo o pipeline — brilhante
  - verbatim_expression obrigatória

  Problema de continuidade:
  - O output não inclui as tags canônicas no JSON (variant_id é H1/H2/H3, não a tag completa CITX_v1_H1). O agente menciona o sistema de tags 
  mas não demonstra aplicação no output. Downstream, creative_director, compliance_check, facebook_ads e utm_builder todos precisam da tag    
  completa
  - Não há campo sku no output — quem monta a tag completa? É implícito demais

  ---
  Agent 9: character_generator — ⭐⭐⭐⭐ (4/5)

  Pontos fortes:
  - Mapeamento angle_type → character_role é muito inteligente — garante que o personagem serve ao ângulo
  - visual_anchors como conceito é o que permite consistência visual entre cenas (sem isso, o keyframe gerador teria que "inventar" o
  personagem a cada cena)
  - Regras de compliance visual (evitar "before/after") bem documentadas

  Problema de continuidade:
  - O template do character_anchor em keyframe_generator é:
  "{age} {gender}, {ethnicity}, {hair}, wearing {clothing_color} {clothing_type}, ..."
  - Mas visual_anchors tem clothing_color: "white" sem um campo clothing_type separado. O keyframe_generator precisa inferir clothing_type a  
  partir do campo style da physical_description. Essa inferência não está documentada e é propensa a erro.
  - style_reference enum tem valor "testimonial" mas character_role também tem valor "testimonial" — dois campos diferentes com o mesmo nome  
  de valor causam confusão semântica

  ---
  Agent 10: keyframe_generator — ⭐⭐⭐⭐⭐ (5/5)

  O agente mais engenheirado do pipeline.

  Pontos fortes:
  - Tabela emotion_cue → camera_angle + expressão + movimento é o coração do agente — elimina toda subjetividade visual
  - Regra "máximo 80 palavras por prompt VEO 3" é bem calibrada
  - character_anchor como string fixa que vai em TODOS os frames é a solução certa para consistência de personagem
  - overlay_suggestion separa corretamente o que é para o editor humano vs. o que é para a IA

  Problema de continuidade identificado:
  - Usa campaign_strategy.primary_platform para definir aspect_ratio, mas a leitura é indireta: vai em script.format primeiro e mapeia para   
  aspect_ratio. Se script_writer gravou format: "vertical_9_16" mas campaign_strategy.primary_platform mudou depois (não pode, mas é frágil), 
  haveria inconsistência. O agente deveria ser mais explícito sobre qual fonte é autoritativa.

  ---
  Agent 11: video_maker — ⭐⭐⭐ (3/5)

  O mais fraco da fase criativa. Notavelmente mais raso que os outros.

  Pontos fortes:
  - Cap de 5 vídeos por execução é uma salvaguarda econômica sensata

  Problemas:
  - Não li o arquivo completo nesta sessão, mas o explore agent reportou apenas ~75 linhas, contra 200+ dos outros agentes. Falta metodologia 
  de execução comparável
  - Não há detalhamento de como o agente integra script, keyframes e copy_components — os três artefatos que consome
  - Potencial duplicação com keyframe_generator: ambos geram prompts VEO 3. Qual é o handoff exato?
  - Output schema video_assets não é documentado com o mesmo rigor dos outros agentes

  ---
  Agent 12: creative_director — ⭐⭐⭐⭐⭐ (5/5)

  Pontos fortes:
  - Sistema de pontuação 0-100 com 4 dimensões claras evita aprovação arbitrária
  - Decision tree binária (score ≥70 sem blocker → approved) é simples e executável
  - production_notes para o operador humano é um toque excelente
  - combinations_ranked com tag completa (PROD_v1_H1_B2_C3) é o que permite rastrear performance por combinação nos agentes posteriores       

  Problema de continuidade:
  - Lê campaign_strategy.policy_warnings mas não tem garantia de que esse campo foi populado com formato adequado pelo agent 6
  - Ao emitir approved_for_production: true com revision_requests, não há um mecanismo para forçar o re-run do agente afetado (copywriting)   
  antes de prosseguir. O pipeline simplesmente segue com a copy original + a nota de revisão — potencialmente lançando copy não-revisada      

  ---
  FASE 3 — LANÇAMENTO

  ---
  Agent 13: compliance_check — ⭐⭐⭐ (3/5)

  O agente com maior gap entre responsabilidade e documentação.

  Pontos fortes:
  - Gate obrigatório antes do lançamento
  - critical vs warning com consequência clara

  Problemas sérios:

  1. Schema de output incompleto para downstream: O output tem issues[].tag, mas não tem um campo status por tag. facebook_ads e google_ads   
  precisam saber se CITX_v1_H1 está aprovado ou rejeitado. O agente atual força os downstream a inferir: "se a tag aparece em issues com      
  severity critical, então rejeitado". Isso não está documentado em nenhum lugar e pode ser interpretado de forma diferente por cada agente.  
  2. Sequência problemática: creative_director aprova combinações baseado em análise interna. compliance_check pode depois rejeitar
  componentes dessas combinações. Não há retorno formal ao creative_director para recalcular combinações — facebook_ads recebe dois artefatos 
  com informações potencialmente conflitantes.
  3. O skill em si tem apenas ~70 linhas — bem menos rigoroso que os outros. Não há exemplos de todos os nichos tratados, cases de borda      
  documentadas apenas parcialmente.

  ---
  Agent 14: utm_builder — ⭐⭐⭐⭐⭐ (5/5)

  Pontos fortes:
  - Convenção canônica limpa e completamente especificada
  - Verificação sintática da URL (sem espaços, único ?, & entre parâmetros)
  - UTMs por estágio de funil (tofu/mofu/bofu) além de UTMs por criativo

  Problema de continuidade:
  - O agente depende de campaign_strategy mas não depende de creative_brief. Isso significa que gera UTMs sem saber quais combinações de      
  criativo foram aprovadas — portanto gera UTMs genéricas ou templates. facebook_ads depois precisa montar a URL final com a creative tag.    
  Essa lógica de montagem não está documentada.

  ---
  Agents 15 e 16: facebook_ads e google_ads — ⭐⭐⭐⭐⭐ (5/5)

  Os mais operacionais do pipeline.

  Pontos fortes:
  - Naming convention rigorosa e autoexplicativa
  - Todos os limites de caracteres por campo documentados
  - setup_notes para pendências manuais antes do lançamento
  - pixel_checklist é um diferencial prático excelente

  Problema compartilhado:
  - Ambos leem compliance_results para filtrar copy aprovada, mas como mencionado no agent 13, o schema de compliance não tem status por tag  
  explícito. Os dois agentes teriam que implementar a mesma lógica de inferência.
  - google_ads não tem special_ad_category equivalente — mas Google tem restrições de categoria (Health & Beauty, Finance) igualmente
  importantes e não documentadas.

  ---
  Agent 17: performance_analysis — ⭐⭐⭐⭐⭐ (5/5)

  Pontos fortes:
  - Árvore de diagnóstico em 6 passos com sequência lógica (CPM → CTR → CPC → conversão → ROAS → frequência) é excelente
  - Regra "nunca classificar loser com <7 dias ou <500 impressões" protege contra decisões precipitadas
  - diagnostic_path no output (ex: "CPM normal → CTR baixo → problema de criativo") é acionável e rastreável

  Problema de continuidade:
  - Depende de dados reais que não vêm do pipeline — é uma ruptura de fluxo deliberada. O arquivo yaml documenta isso com "pode ser executado 
  separadamente", mas não há protocolo documentado para retomar o pipeline depois dessa pausa. Como o operador sabe que pode chamar esse      
  agente? Qual formato de dados ele precisa preparar?

  ---
  Agent 18: scaling_strategy — ⭐⭐⭐⭐⭐ (5/5)

  Pontos fortes:
  - Tabela overall_assessment → scale_recommendation é direta e sem ambiguidade
  - stop_loss_criteria obrigatório protege contra escala destrutiva
  - Regra de isolamento de variável ("testar um elemento por vez") é best practice bem documentada
  - projected_results com margem de incerteza (+10-20%) é honesto

  Observação: No caso de borda "todos os criativos são losers", o agente recomenda "retornar ao script_writer e copywriting com brief de novo 
  ângulo". Mas isso não está formalmente modelado como retorno ao pipeline — é uma instrução em prosa para o operador. Um mecanismo de        
  re-entrada no pipeline seria mais robusto.

  ---
  ---
  Parte 2 — Análise do Fluxo de Continuidade Entre Agentes

  Esta é a parte mais crítica. O pipeline tem 5 categorias de problemas de continuidade.

  ---
  Categoria A — Bugs de Campo (quebram silenciosamente)

  Estes são os mais graves porque passam sem erro visível mas entregam dados errados.

  ┌─────────────────────┬────────────────────┬──────────────────────────────────────────────────┬─────────────────────────────────────┐       
  │    Agente lendo     │     Campo lido     │              Campo real no artefato              │               Efeito                │       
  ├─────────────────────┼────────────────────┼──────────────────────────────────────────────────┼─────────────────────────────────────┤       
  │ script_writer       │ product.main_claim │ product.main_promise                             │ Promessa central ausente do roteiro │       
  ├─────────────────────┼────────────────────┼──────────────────────────────────────────────────┼─────────────────────────────────────┤       
  │ script_writer       │ product.price      │ product.ticket_price / offer_structure.price_brl │ Preço ausente da narração           │       
  ├─────────────────────┼────────────────────┼──────────────────────────────────────────────────┼─────────────────────────────────────┤       
  │ character_generator │ product.niche      │ Campo não existe no schema do vsl_analysis       │ Personagem sem contexto de nicho    │       
  └─────────────────────┴────────────────────┴──────────────────────────────────────────────────┴─────────────────────────────────────┘       

  Correção: Alinhar explicitamente os nomes de campo em cada skill, com referência ao campo exato do artefato de origem.

  ---
  Categoria B — Dependências de Schema Não Documentadas

  Agentes downstream fazem suposições sobre o formato que os upstream produzem, mas essas suposições não estão escritas.

  1. compliance_results → facebook_ads e google_ads

  O compliance produz:
  { "issues": [{ "severity": "critical", "tag": "CITX_v1_H1" }] }

  Mas facebook_ads precisa saber: "o criativo CITX_v1_H1_B2_C3 está aprovado?"

  Para responder isso, o agente precisa:
  1. Decompor a combinação em componentes (H1, B2, C3)
  2. Verificar se algum componente aparece em issues com severity critical
  3. Concluir que a combinação está bloqueada

  Essa lógica não está documentada em nenhum lugar. Um campo approved_tags: ["CITX_v1_H1", "CITX_v1_H2"] e rejected_tags: ["CITX_v1_H3"] no   
  output do compliance tornaria isso trivial.

  2. character.visual_anchors → keyframe_generator template

  O template do keyframe_generator para construir o character_anchor é:
  "{age} {gender}, {ethnicity}, {hair}, wearing {clothing_color} {clothing_type}, {setting}, {lighting}"

  Mas visual_anchors tem clothing_color: "white" sem um clothing_type separado. clothing_type tem que ser extraído do campo style: "casual    
  clean — white t-shirt". Essa inferência não está documentada.

  ---
  Categoria C — Sequência de Aprovação com Conflito Potencial

  Este é o problema estrutural mais sutil do pipeline.

  creative_director (agent 12) → aprova combinações baseado em coerência criativa
  compliance_check  (agent 13) → pode rejeitar componentes dessas combinações
  facebook_ads      (agent 15) → recebe AMBOS os artefatos e precisa reconciliar

  Cenário concreto:
  - creative_director elege top_combination: CITX_v1_H1_B2_C3 com score 82
  - compliance_check detecta que H1 tem claim crítico → overall_approved: false
  - facebook_ads recebe creative_brief.top_combination = CITX_v1_H1_B2_C3 e compliance_results.overall_approved = false

  O facebook_ads skill diz "usar apenas copy aprovada pelo compliance", mas não documenta o que fazer com creative_brief.top_combination      
  quando ela foi bloqueada. O agente teria que silenciosamente ignorar a recomendação do creative director e usar a segunda combinação — mas  
  essa lógica não está explícita.

  Correção sugerida: compliance_check deveria emitir uma lista approved_combinations e rejected_combinations baseada nos componentes
  aprovados/rejeitados, tornando o trabalho do facebook_ads trivial.

  ---
  Categoria D — Ruptura de Fluxo (dados que não existem no pipeline)

  utm_builder depende de campaign_strategy mas não de creative_brief

  O UTM builder roda em paralelo com compliance_check (ambos no parallel_group: pre_launch), mas creative_brief ainda não está disponível para   ele. Portanto, gera UTMs sem saber as creative tags aprovadas.

  A solução atual parece ser que facebook_ads monta a URL final combinando o template de UTM com a creative tag — mas essa lógica de montagem 
  não está documentada em nenhum lugar.

  performance_analysis — ruptura deliberada mas sem protocolo de retomada

  O agente 17 não pode rodar sem dados reais de campanha. Isso é correto e necessário. Mas não existe documentação de:
  - Como o operador fornece os dados (formato CSV esperado? Campos obrigatórios?)
  - Como invocar o agente isoladamente com o contexto do pipeline já salvo
  - Como o pipeline "retoma" a partir do agente 17 após semanas de veiculação

  ---
  Categoria E — Consistência Semântica ao Longo do Pipeline

  Esta categoria avalia se os conceitos se mantêm coerentes do início ao fim.

  O que funciona muito bem:

  ┌────────────────────────────────┬──────────────────────────────────────────────────────────────────────────────────────────────────────┐   
  │            Conceito            │                                         Cadeia de propagação                                         │   
  ├────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────┤   
  │ hook_text do                   │ angles → script_writer (cena 1 exata) → keyframe_generator (emotion_cue do hook) → creative_director │   
  │ selected_hook_variant          │  (dimensão 1)                                                                                        │   
  ├────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────┤   
  │ verbatim_expression            │ avatar_research → copywriting (obrigatório) → script_writer (cena problem/agitation) →               │   
  │                                │ creative_director (dimensão 2)                                                                       │   
  ├────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────┤   
  │ emotion_cue                    │ script_writer (enum de 6 valores) → keyframe_generator (tabela de mapeamento) → creative_director    │   
  │                                │ (dimensão 3, sequência validada)                                                                     │   
  ├────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────┤   
  │ creative_tag                   │ copywriting → creative_director → compliance_check → utm_builder → facebook_ads →                    │   
  │ (CITX_v1_H1_B2_C3)             │ performance_analysis → scaling_strategy                                                              │   
  ├────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────┤   
  │ angle_type                     │ angle_generator → character_generator (mapeamento para character_role) → script_writer (mapeamento   │   
  │                                │ para framework)                                                                                      │   
  ├────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────┤   
  │ alternative_angles             │ angle_generator → scaling_strategy (combate fadiga criativa semanas depois)                          │   
  └────────────────────────────────┴──────────────────────────────────────────────────────────────────────────────────────────────────────┘   

  O que tem lacunas:

  ┌─────────────────────────────────────────┬──────────────────────────────────────────────────────────────────────────────────────────────┐  
  │                  Campo                  │                                           Problema                                           │  
  ├─────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────┤  
  │ campaign_strategy.policy_warnings       │ Campo sem schema definido — creative_director e facebook_ads leem mas não sabem o formato    │  
  │                                         │ esperado                                                                                     │  
  ├─────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────┤  
  │ benchmark.differentiation_opportunities │ Consumido por campaign_strategy e scaling_strategy, mas o formato não é especificado no      │  
  │                                         │ benchmark skill                                                                              │  
  ├─────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────┤  
  │ market_maturity                         │ Usado por campaign_strategy para decisões, mas benchmark_intelligence não tem enum formal    │  
  │                                         │ para esse campo                                                                              │  
  ├─────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────┤  
  │ product.commission_percent              │ Calculado no vsl_analysis mas nunca usado explicitamente por nenhum agente downstream — dead │  
  │                                         │  field                                                                                       │  
  └─────────────────────────────────────────┴──────────────────────────────────────────────────────────────────────────────────────────────┘  

  ---
  Resumo Executivo — O Que Fazer

  🔴 Crítico — Quebra silenciosa de dados

  1. Corrigir nomes de campo em script_writer: main_claim → main_promise, price → ticket_price
  2. Adicionar niche ao output schema do vsl_analysis
  3. Adicionar approved_tags e rejected_tags ao output de compliance_check — elimina toda a ambiguidade downstream

  🟡  Importante — Continuidade e robustez

  4. Definir schema formal de policy_warnings em campaign_strategy
  5. Padronizar o clothing_type em character.visual_anchors como campo separado
  6. Documentar protocolo de retomada do performance_analysis — formato de dados esperado e como re-invocar o pipeline
  7. Resolver o conflito 40% vs 50% de CPA target em campaign_strategy
  8. Documentar lógica de montagem de URL entre utm_builder e facebook_ads

  🟢  Melhorias de qualidade

  9. Expandir video_maker para o mesmo nível de documentação dos outros agentes
  10. Adicionar benchmark como input do angle_generator — hoje o ângulo pode coincidir com a concorrência sem que o agente saiba
  11. Mecanismo formal de re-entrada no pipeline quando creative_director emite revision_requests ou quando scaling_strategy recomenda novos  
  criativos

  ---
  Avaliação geral: O pipeline é conceitualmente excelente — a cadeia emotion_cue → character_anchor → creative_tag é particularmente
  sofisticada. Os bugs críticos são correções de texto nos skills, não redesigns. A maior fragilidade estrutural é o fluxo creative_director →   compliance_check → facebook_ads sem reconciliação explícita.