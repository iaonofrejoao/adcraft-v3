---
name: go-to-market-engineer
description: >
  Executa análises completas de produto e estratégias de Go-to-Market para produtos SaaS.
  Use quando o usuário pedir: análise de produto, posicionamento, pricing, estratégia de lançamento,
  canais de aquisição, persona, jornada do usuário, ICP, competitive moat, métricas de GTM,
  plano de lançamento, pitch deck outline, ou qualquer combinação dessas tarefas.
  Sempre use este skill quando o pedido envolver "preparar o GTM", "analisar o produto para lançamento",
  "definir posicionamento", "definir canais", "plano de lançamento", mesmo que o usuário não use
  exatamente esses termos.
---

# Go-to-Market Engineer

Skill para produzir análises de produto e estratégias de GTM completas, acionáveis e baseadas em dados.
O output deve ser específico o suficiente para uma equipe de produto e marketing executar sem precisar de reuniões de alinhamento adicionais.

---

## Quando usar este skill

- Produto novo sendo lançado (0 → 1)
- Produto existente entrando em novo mercado ou vertical
- Repositionamento de produto após feedback de mercado
- Expansão de modelo de monetização
- Análise de concorrência antes de decisões de produto

---

## Estrutura obrigatória de output

Sempre produzir as seções nesta ordem. Nunca pular seções.

---

### 1. Diagnóstico do Produto (Product Clarity)

Antes de qualquer GTM, o produto precisa ser claro. Documentar:

**Problema central:**
- Qual dor exata o produto resolve?
- Quão frequente é essa dor? (diária, semanal, mensal)
- Qual o custo atual da dor para o usuário? (tempo, dinheiro, estresse)
- O usuário já tenta resolver esse problema hoje? Como?

**Solução:**
- O que o produto faz em uma frase (elevator pitch de 10 segundos)
- O que o produto NÃO faz (escopo explícito)
- Por que agora? (timing de mercado — por que esta solução é possível/relevante hoje e não há 5 anos)

**Validação de demanda:**
- Evidências de demanda (pesquisas, entrevistas, dados de mercado)
- Proxy de demanda (ex: buscas no Google, fóruns, comunidades)
- Jobs-to-be-done mapeados com evidências

---

### 2. ICP e Personas (Ideal Customer Profile)

**ICP primário** (o cliente que ativa mais rápido, paga mais, churna menos):
- Perfil demográfico específico (não genérico — não "adultos entre 25-45")
- Comportamento digital (onde passa tempo online, quais apps usa)
- Maturidade com o problema (já tentou outras soluções? Qual?)
- Poder de decisão de compra (quem paga? quem usa? são a mesma pessoa?)
- Trigger de compra (o que faz o ICP buscar uma solução agora?)

**ICPs secundários** (se existirem):
- Por que são secundários e não primários?
- Vale abordar no lançamento ou apenas no scaling?

**Anti-ICP** (quem NÃO é o cliente ideal):
- Segmentos que consomem suporte mas não pagam
- Segmentos com churn estruturalmente alto para este produto

**Para cada persona, documentar:**
```
Nome da persona: [Nome fictício]
Perfil: [Idade, ocupação, situação de vida]
Motivação principal: [O que quer alcançar]
Dor principal: [O que mais a frustra hoje]
Trigger de compra: [O que a faz buscar uma solução]
Objeção principal: [Por que não compra imediatamente]
Canal preferido: [Onde é mais alcançável]
Disposição a pagar: [Faixa de preço aceitável]
Mensagem que ressoa: [Frase ou frame que quebra a objeção]
```

---

### 3. Posicionamento e Mensagem (Positioning)

**Framework de posicionamento** (baseado em April Dunford — Obviously Awesome):

1. **Categoria alternativa** — O que o cliente usaria se o produto não existisse?
2. **Capacidades únicas** — O que o produto faz que os alternativos não fazem?
3. **Valor entregue** — Qual benefício específico essas capacidades criam?
4. **Características do cliente** — Para quem esse valor importa mais?
5. **Contexto de mercado** — Qual tendência ou mudança torna este produto relevante agora?

**Tagline e pitch:**
- Tagline (máximo 8 palavras)
- Pitch de 10 segundos (o que é + para quem + benefício principal)
- Pitch de 30 segundos (problema + solução + diferencial + CTA)
- Pitch de 2 minutos (história completa com contexto, solução, prova, CTA)

**Hierarquia de mensagens:**
```
Mensagem primária: [Para toda comunicação de marca]
  → Mensagem por segmento 1: [Adaptação para ICP primário]
  → Mensagem por segmento 2: [Adaptação para ICP secundário]
    → Mensagem por canal: [Adaptação por canal de distribuição]
```

**Temas de conteúdo que reforçam o posicionamento:**
- 3–5 temas editoriais que sustentam a mensagem sem ser propaganda direta

---

### 4. Análise Competitiva (Competitive Moat)

Para cada concorrente direto e indireto:

```
Concorrente: [Nome]
Categoria: [Direto / Indireto / Substituto]
Preço: [Tier e valor]
Pontos fortes: [O que fazem bem]
Pontos fracos: [Onde falham — especificidade máxima]
Base de usuários: [Tamanho estimado]
Crescimento: [Acelerando / estável / declinando]
Risco competitivo: [Alto / Médio / Baixo + justificativa]
```

**Mapa de posicionamento:**
Definir 2 eixos de diferenciação relevantes para o mercado e posicionar todos os concorrentes vs. o produto sendo lançado.

**Moat do produto:**
- Qual vantagem defensável o produto tem que concorrentes terão dificuldade de copiar?
- Categorias de moat: rede de dados, efeito de rede, switching cost, brand, regulatório, tecnológico

**Tabela de funcionalidades:**
Comparar produto vs. top 3 concorrentes em funcionalidades-chave — honestamente, incluindo onde os concorrentes são superiores.

---

### 5. Modelo de Negócio e Pricing

**Modelo de monetização:**
- Modelo escolhido: freemium / trial / paid-only / usage-based / seat-based / outcome-based
- Justificativa baseada no comportamento do ICP e nos benchmarks do mercado

**Estrutura de tiers:**

Para cada tier:
```
Nome do tier:
Preço mensal / anual:
Desconto anual (%):
Para quem é (persona):
O que inclui:
O que NÃO inclui (que o próximo tier tem):
Limite / gatilho de upgrade:
```

**Métricas financeiras projetadas:**

| Métrica | Conservador | Base | Otimista |
|---------|------------|------|---------|
| Conversão freemium → pago | % | % | % |
| Churn mensal | % | % | % |
| ARPU (receita média por usuário) | R$ | R$ | R$ |
| LTV (12 meses) | R$ | R$ | R$ |
| CAC target máximo | R$ | R$ | R$ |
| LTV:CAC ratio | x | x | x |
| Payback period | meses | meses | meses |
| Break-even de usuários pagantes | # | # | # |

**Psicologia de pricing:**
- Como os preços são apresentados (âncora, decoy, anuidade destacada)
- Qual tier deve ser o "hero" (mais visível e recomendado)
- Quais features são "velvet rope" (excluídas do free para criar pull para pago)

---

### 6. Estratégia de Canais (Channel Strategy)

Para cada canal, documentar:

```
Canal:
Tipo: [Orgânico / Pago / Parceria / PR / Community]
Custo estimado de setup:
CAC esperado: R$
Volume potencial: usuários/mês
Tempo para resultado: semanas/meses
Esforço de manutenção: Alto / Médio / Baixo
Adequação ao ICP: Alta / Média / Baixa
Prioridade de execução: Tier 1 / Tier 2 / Tier 3
Táticas específicas: [3–5 ações concretas]
Métrica de sucesso: [KPI específico]
```

**Mix de canais recomendado por fase:**

| Fase | Foco | Canais ativos | Orçamento |
|------|------|--------------|-----------|
| 0–3 meses (pré-lançamento) | Audiência + waitlist | ... | ... |
| 3–6 meses (beta) | Ativação + feedback | ... | ... |
| 6–12 meses (lançamento) | Aquisição + conversão | ... | ... |
| 12–24 meses (scaling) | Eficiência + escala | ... | ... |

**Flywheel de crescimento:**
Descrever o loop de crescimento autossustentável que o produto pode criar (ex: usuário convida parceiro → parceiro ativa → parceiro convida amigos → ...)

---

### 7. Estratégia de Lançamento (Launch Plan)

**Fase 0 — Pré-lançamento (D-90 a D-0):**
- Objetivos mensuráveis (ex: 2.000 e-mails na waitlist)
- Artefatos a produzir (landing page, waitlist, conteúdo, press kit)
- Canais ativos nessa fase
- Critério de go/no-go para próxima fase

**Fase 1 — Beta fechado (D-0 a D+60):**
- Critério de seleção de beta testers
- Número alvo de casais/usuários no beta
- Métricas de ativação que precisam ser atingidas
- Loops de feedback (entrevistas, NPS, registros de suporte)
- Critério de go/no-go para lançamento público

**Fase 2 — Lançamento público (D+60 a D+180):**
- Sequência de atividades de lançamento (dia a dia da semana de lançamento)
- Parceiros e influenciadores envolvidos
- Campanha de PR (ângulo da história, veículos alvo)
- Meta de usuários em 30 / 60 / 90 dias
- Orçamento de marketing para esta fase

**Fase 3 — Scaling (D+180 em diante):**
- Gatilho para escalar paid acquisition (ex: NPS > 50, LTV:CAC > 3:1)
- Canais pagos a ativar e sequência
- Parcerias estratégicas a desenvolver
- Expansões de produto que suportam crescimento

**Semana de lançamento — roteiro dia a dia:**
```
D-7: [Ação]
D-3: [Ação]
D-1: [Ação]
D0 (manhã): [Ação]
D0 (tarde): [Ação]
D+1: [Ação]
D+7: [Review]
```

---

### 8. Métricas e OKRs (North Star + KPIs)

**North Star Metric:**
- Qual métrica única captura o valor entregue ao usuário E o crescimento do negócio?
- Justificativa: por que essa e não outra?

**Árvore de métricas:**
```
North Star: [Métrica]
  ├── Aquisição: [Métrica de volume de entrada]
  ├── Ativação: [Métrica de primeiro valor entregue]
  ├── Retenção: [Métrica de retorno]
  ├── Receita: [Métrica de monetização]
  └── Referência: [Métrica de crescimento viral]
```

**OKRs por trimestre (primeiros 12 meses):**

```
Q1 — Objetivo: [...]
  KR1: [Métrica mensurável + target]
  KR2: [Métrica mensurável + target]
  KR3: [Métrica mensurável + target]

Q2 — Objetivo: [...]
  ...

Q3 — Objetivo: [...]
  ...

Q4 — Objetivo: [...]
  ...
```

**Dashboard de early warning:**
Métricas que, se sinalizar problema, exigem decisão imediata:
- Métrica de ativação: se < X%, revisar onboarding
- Churn D7: se > X%, revisar proposta de valor
- Conversão free→pago: se < X%, revisar tier ou velvet rope
- NPS: se < X, pausar aquisição paga e focar produto

---

### 9. Riscos e Planos de Contingência

Para cada risco identificado:

```
Risco: [Descrição]
Probabilidade: Alta / Média / Baixa
Impacto: Alto / Médio / Baixo
Sinal de alerta: [O que indicaria que esse risco está se materializando]
Plano de contingência: [Ação concreta se o risco ocorrer]
Responsável: [Quem monitora]
```

---

### 10. Roadmap de Produto Alinhado ao GTM

Mostrar como o roadmap de produto suporta a estratégia de GTM:

| Trimestre | Feature | Por que agora (GTM reason) | Impacto esperado |
|-----------|---------|--------------------------|-----------------|
| Q1 | ... | ... | ... |
| Q2 | ... | ... | ... |
| Q3 | ... | ... | ... |
| Q4 | ... | ... | ... |

**Critérios de priorização:**
- Feature aumenta ativação? → Alta prioridade Q1
- Feature aumenta retenção? → Alta prioridade Q2
- Feature aumenta conversão pago? → Prioridade Q2–Q3
- Feature abre novo segmento? → Prioridade Q3+

---

## Padrões de output

**Seja específico, nunca genérico.** "Usar redes sociais" está errado. "Publicar 3x/semana no TikTok com vídeos de 45–60s mostrando o before/after de casais que usaram o app no primeiro mês, com CTA para waitlist no primeiro frame" está correto.

**Use dados sempre que possível.** Benchmarks de mercado, estatísticas de comportamento do consumidor, dados de concorrentes. Cite a fonte.

**Priorize explicitamente.** Não liste 20 canais como se fossem equivalentes. Diga qual é Tier 1, qual é Tier 2, qual é Tier 3, e por quê.

**Inclua o "por quê não".** Para cada decisão de posicionamento ou canal, justificar brevemente por que as alternativas foram descartadas.

**O GTM termina quando a equipe sabe o que fazer amanhã.** Se o output não gera ação imediata, está incompleto.

---

## Coleta de contexto

Antes de escrever o GTM, extrair ou perguntar:

1. Qual é o produto? (o que faz, para quem, como)
2. Qual o estágio atual? (ideia, MVP, beta, lançado)
3. Qual o orçamento disponível para marketing? (zero, bootstrapped, seed, série A+)
4. Quais canais o fundador/time já tem acesso? (audiência, rede, expertise)
5. Qual o mercado geográfico inicial? (Brasil only, LATAM, global)
6. Existe produto/receita hoje? (se sim, quais métricas atuais)
7. Qual o horizonte de planejamento? (3 meses, 12 meses, 24 meses)

Se a conversa já contém essas informações, extrair diretamente — não fazer perguntas já respondidas.

---

## Referências internas

Ao executar este skill, consultar se disponível:
- Estudo de mercado já realizado na conversa → usar dados existentes
- PRD do produto → extrair capacidades e diferenciais
- Feedback de usuários → usar como validação do posicionamento
