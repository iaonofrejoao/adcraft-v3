# GTM — SaaS de Gestão Financeira para Casais
**Codinome de trabalho: Juntos** | Estágio: Pré-MVP | Brasil | Bootstrapped | Gerado em: 2026-05-30

---

## SEÇÃO 1 — Diagnóstico do Produto (Product Clarity)

### Problema central

**Qual dor exata o produto resolve?**
Casais que moram juntos não têm visibilidade compartilhada sobre suas finanças combinadas. O resultado não é apenas desorganização financeira — é conflito relacional recorrente. A falta de transparência e de um sistema neutro de referência força conversas sobre dinheiro a se tornarem negociações de poder em vez de planejamento conjunto.

**Frequência da dor:**
- Diária: 36% dos casais brigam sobre dinheiro pelo menos 1x/semana (Meu Compromisso, 2024)
- Crônica: 49% já esconderam um problema financeiro do parceiro
- Endêmica: 76% das famílias brasileiras terminaram 2024 endividadas (PEIC/CNC)

**Custo atual da dor:**
- Emocional: estresse, distância emocional e erosão de confiança
- Financeiro: duplicação de gastos, perda de prazos, acúmulo de dívida por falta de coordenação — não por falta de renda
- Relacional: ausência de sistema neutro → conversas sobre dinheiro ativam defesa e culpa, não colaboração

**Como o usuário tenta resolver hoje?**
1. Planilha no Google Sheets (abandono em 3–6 semanas)
2. Combinação verbal informal sem rastreamento real
3. Conta conjunta no banco (visibilidade de saldo, sem gestão)
4. ZapGastos via WhatsApp (UX rudimentar, sem visão de casal)
5. Honeydue (sincronização quebrada, sem premium, sem Open Finance BR)
6. Nada — improvisação mês a mês (a maioria)

---

### Solução em 1 frase

**Juntos é o primeiro app de gestão financeira desenhado especificamente para o casal brasileiro — onde os dois têm visibilidade real do dinheiro conjunto, tomam decisões alinhadas e param de brigar por causa de conta.**

---

### Escopo explícito do MVP

**O que FAZ:**
- Conexão das contas de ambos os parceiros via Open Finance (sem digitação manual)
- Dashboard unificado: saldo total, gastos do mês, comprometimento de renda
- Categorização automática dos lançamentos
- Orçamento conjunto por categoria com alertas de estouro
- Meta compartilhada simples com progresso visual
- Histórico de gastos com filtro por pessoa (transparência sem julgamento)
- Notificações push para gastos grandes

**O que NÃO faz no MVP:**
- Hábitos, treinos, dieta, rotina — expansão futura
- Investimentos, carteira de ativos, análise de fundos
- Gestão de dívida complexa
- Versão web — mobile first
- Multi-casal / família extensa
- IA generativa — categorização por regras e ML simples

---

### Por que agora? (Timing de mercado)

1. **Vácuo competitivo:** Zeta encerrou mai/2025. Mint desativado mar/2024. Demanda sem supply.
2. **Open Finance maduro:** 61,9M consentimentos ativos (+45% YoY). Infraestrutura pronta.
3. **Demanda reprimida documentada:** 76% endividadas + 36% brigam semanalmente + vácuo competitivo.
4. **Custo de distribuição orgânica caiu:** TikTok permite alcance de 100k+ sem budget.

---

### Validação de demanda

| Dado | Fonte | O que valida |
|------|-------|--------------|
| 53% citam dinheiro como causa de brigas | Serasa | Frequência e intensidade da dor |
| 36% brigam sobre dinheiro 1x/semana+ | Meu Compromisso, 2024 | Dor recorrente, não pontual |
| 49% esconderam problema financeiro do parceiro | Meu Compromisso, 2024 | Demanda por sistema neutro |
| 76% das famílias endividadas ao final de 2024 | PEIC/CNC | Urgência financeira |
| 61,9M consentimentos Open Finance (+45% YoY) | Banco Central | Infraestrutura disponível |
| Monarch Money cresceu 2.000% pós-Mint | Estimativa setor | Demanda migra quando player some |
| Tandem captou USD 3,7M em jan/2024 | Pitchbook | Investidores validam o segmento |

---

### Jobs-to-be-done mapeados

| JTBD | Frequência | Intensidade |
|------|-----------|------------|
| "Me ajuda a ter a conversa sobre dinheiro sem virar briga" | Mensal | Muito alta |
| "Me mostra onde está indo o dinheiro do casal sem eu ter que perguntar" | Semanal | Alta |
| "Me avisa quando estamos saindo do orçamento antes de ser tarde demais" | Mensal | Alta |
| "Me ajuda a planejar uma meta conjunta (viagem, casa, filhos) de forma realista" | Trimestral | Alta |
| "Faz o meu parceiro engajar no app também — não só eu" | Contínuo | Muito alta |
| "Me dá sensação de que estamos no mesmo time financeiro" | Contínuo | Alta |

> **Insight central:** O JTBD central não é "organizar finanças" — é **"resolver o conflito de dinheiro no relacionamento"**. A gestão financeira é o mecanismo, não o benefício que o usuário compra.

---

## SEÇÃO 2 — ICP e Personas

### ICP Primário

**Perfil demográfico:**
Casal heterossexual ou homoafetivo, 26–35 anos, morando juntos há 6 meses a 3 anos. Renda combinada R$6.000–18.000/mês. Pelo menos um dos dois trabalha em setor formal. Residem em capitais ou cidades médias (200K+ hab.). Pelo menos um já usa algum app de controle financeiro pessoal.

**Por que 26–35 e não 18–25:** 18–25 geralmente ainda não moram juntos. Acima de 35, padrões financeiros mais estabelecidos e resistência a mudança maior.

**Comportamento digital:**
- Consome conteúdo de finanças no Instagram/TikTok (Me Poupe!, Nathalia Arcuri)
- Usa Nubank como banco principal (64% de penetração na faixa)
- Assina 2–4 serviços por assinatura — tem comportamento de assinante
- Pesquisa ativamente quando tem trigger (não é lead passivo)

**Poder de decisão:** Em 80% dos casos, há um parceiro com mais ansiedade sobre finanças — essa é a persona de aquisição. A conversão é individual, mas a ativação é obrigatoriamente em par.

**Triggers de compra:**
1. **Crise pontual** — cartão estourou; briga grande; fim do mês sem entender onde foi o dinheiro
2. **Transição de vida** — foram morar juntos nos últimos 30–60 dias; conversa sobre apartamento ou filho
3. **Conteúdo** — viram vídeo sobre organização financeira para casais e se identificaram
4. **Referência** — amigo casal recomendou

---

### ICP Secundário

Casal 36–45 anos, filhos pequenos (0–8 anos), renda combinada R$12.000–30.000. Processo de compra de imóvel ou financiamento ativo.

**Por que é secundário:** Ciclo de venda mais longo, onboarding mais complexo, menor propensão a mudar comportamento estabelecido. Abordar apenas no scaling.

---

### Anti-ICP

| Perfil | Por que não é ICP |
|--------|------------------|
| Casal em crise severa (dívida > 60% da renda) | Precisam de consultoria, não de app. Alto churn + NPS negativo. |
| Usuário solo | Diferencial de casal não entrega valor. Ativação próxima de zero. |
| Casal que não mora junto | Dor financeira compartilhada não existe ainda. Churn em D+7. |
| Empresário com finanças PJ misturadas | Categorização distorce tudo. MVP não resolve. |

---

### Persona 1 — Ana (o parceiro ansioso)

```
Nome: Ana | 29 anos | Analista de RH em tech | São Paulo
Mora com o namorado Gabriel há 1,5 anos | Renda combinada R$11.800

Motivação: Quer ter a sensação de que ela e Gabriel estão "no mesmo time"
  — construindo algo juntos, não apenas dividindo contas.

Dor: Gabriel não tem o mesmo nível de controle que ela. Ela anota tudo,
  ele gasta sem avisar. Quando tenta conversar, ele interpreta como
  cobrança e a conversa vira briga. Ela se sente sozinha na gestão
  financeira do casal.

Trigger: No fim de março, o cartão conjunto estourou R$900 acima do
  esperado. Briga durou 3 dias. No domingo, pesquisou "app para organizar
  finanças do casal" no Google.

Objeção principal: "Gabriel nunca vai usar. Sou eu que vou ter que
  inserir os gastos dele, e aí não vai funcionar de novo."

Canal preferido: Instagram e TikTok (educativo-emocional).
  Google quando tem trigger de crise.

Disposição a pagar: R$29,90–R$39,90/mês pelo casal.
  Não pagaria por produto que não tem app do parceiro integrado.

Mensagem que ressoa:
  "Pela primeira vez, vocês dois veem o mesmo número.
   Sem cobrar. Sem esconder. Sem briga."

Frame eficaz: posicionar o app como árbitro neutro — não é ela cobrando
  Gabriel. É o app mostrando os dados para os dois.
```

---

### Persona 2 — Rafael (o parceiro técnico/analítico)

```
Nome: Rafael | 33 anos | Engenheiro de software | Florianópolis
Mora com a esposa Camila há 4 anos, casados há 2 | Renda combinada R$16.200
Já usou Mint quando morou nos EUA por 1 ano e sentiu falta depois.

Motivação: Quer controle e previsibilidade. Ansiedade financeira interfere
  no trabalho — quando não sabe como estão as contas, fica inquieto.

Dor: Camila tem gastos variáveis altos que aparecem no extrato sem aviso
  prévio. Rafael não quer controlar — mas quer poder planejar sem surpresa.
  Acordos verbais duram 2–3 semanas e quebram.

Trigger: Tentou Honeydue mas a sincronização quebrou na semana 2 e Camila
  desinstalou. Quando leu sobre Open Finance no Nubank Blog em fev/2025,
  começou a pesquisar apps brasileiros que usassem a API.

Objeção principal: "Já tentei 2 apps e os dois falharam na sincronização.
  Precisa realmente funcionar no Open Finance, senão não adianta."

Canal preferido: Blog técnico, Reddit (r/financaspessoais), Product Hunt.
  Possível via PR em Tecmundo, Infomoney, newsletters de finanças.

Disposição a pagar: R$39,90–R$59,90/mês. Compara com uma sessão de
  psicólogo de casal (R$150–250) — uma ferramenta mensal parece barata.

Mensagem que ressoa:
  "Open Finance conectado. Nenhum gasto surpresa. Os dois informados."

Frame eficaz: confiabilidade técnica + ausência de fricção. O que ele
  compra primeiro é o produto que tecnicamente funciona quando os outros falharam.
```

---

## SEÇÃO 3 — Posicionamento e Mensagem

### Framework April Dunford (Obviously Awesome) — 5 componentes

**1. Categoria alternativa**
Os clientes não chegam pensando "preciso de um app financeiro". Chegam pensando:
- "Preciso ter uma conversa sobre dinheiro com meu parceiro sem virar briga"
- "Preciso entender onde foi o dinheiro esse mês antes que vire briga"

Alternativas reais: combinação verbal + planilha abandonada (80%), app individual, conta bancária conjunta sem gestão, nada.

> **Implicação:** o produto não compete com outros apps financeiros. Compete com a ausência de sistema.

**2. Capacidades únicas**
- **Open Finance BR real** — padrão regulatório do Banco Central, não scraping. Honeydue e ZapGastos não têm isso.
- **Design de casal, não de indivíduo** — tudo construído para dois. Dashboard é "nossas finanças", não "minha conta + a conta dela".
- **O árbitro neutro** — dados iguais para os dois, simultaneamente. Remove o elemento de poder das conversas sobre dinheiro.
- **Ativação do parceiro menos engajado** — onboarding conjunto como modo principal, não feature opcional.

**3. Valor entregue**
Benefício primário: o casal para de brigar sobre dinheiro porque os dois têm a mesma informação, ao mesmo tempo, sem que ninguém precise cobrar ninguém. Isso é benefício relacional — e por isso o LTV potencial é alto. Ninguém cancela o app que melhorou a qualidade do seu relacionamento.

**4. Características do cliente**
Para casais que já moram juntos (dor real e presente), onde pelo menos um tem comportamento de rastreamento (maturidade digital mínima) e onde a relação ainda está em construção de confiança (26–35 anos, primeiros 1–5 anos morando juntos).

**5. Contexto de mercado — Por que agora**
1. Vácuo: Zeta (mai/2025) + Mint (mar/2024). Janela fecha em 12–18 meses.
2. Open Finance em massa crítica: 61,9M consentimentos (+45% YoY).
3. Geração 26–35 quer transparência e ferramentas que apoiem o relacionamento.

---

### Tagline

> **"O dinheiro de vocês dois. No mesmo lugar."**

Alternativas testáveis: "Sem briga. Com plano." | "Finanças que funcionam para dois."

---

### Pitches

**10 segundos:**
"Juntos é o app de finanças para casais. Os dois conectam as contas, veem tudo em tempo real e param de ter surpresa no fim do mês."

**30 segundos:**
"53% dos casais brasileiros dizem que dinheiro é a principal causa de briga. O problema quase nunca é falta de dinheiro — é falta de visibilidade compartilhada. Um gasta sem o outro saber, a conta estoura, começa a briga.

Juntos resolve isso: os dois conectam suas contas via Open Finance, veem um dashboard único das finanças do casal, e recebem alertas juntos antes que o problema aconteça.

Não é mais você cobrando ele. É o app mostrando para os dois ao mesmo tempo."

**2 minutos:**
"Tem um dado que nunca me saiu da cabeça: 49% dos brasileiros já esconderam um problema financeiro do parceiro. Quase metade. Não porque são desonestos — mas porque não tinham um espaço seguro para falar sobre dinheiro sem virar acusação.

O dinheiro é a principal causa de brigas em relacionamentos no Brasil. 36% dos casais brigam sobre isso pelo menos uma vez por semana. E na maioria dos casos, o problema não é quanto se ganha — é que cada um vive numa versão diferente da realidade financeira do casal.

Ela sabe que o cartão está no limite. Ele acha que ainda tem folga. Ela tenta conversar. Ele se sente cobrado. A conversa vira briga. Repete todo mês.

Juntos existe para acabar com esse ciclo. É um app de gestão financeira desenhado do zero para casais — não um app pessoal com função de compartilhamento grudada depois. Os dois conectam suas contas via Open Finance — a API regulatória do Banco Central — e imediatamente enxergam um painel único: saldo real do casal, gastos por categoria, orçamento conjunto, metas compartilhadas.

A diferença não é tecnológica. É psicológica. Quando os dois veem o mesmo número, ao mesmo tempo, a conversa sobre dinheiro muda de tom. Não é mais 'você gastou demais' — é 'olha o que o app está mostrando'.

Estamos lançando agora porque a janela existe: o Zeta encerrou em maio de 2025. O Mint saiu em 2024. O Open Finance brasileiro acaba de cruzar 61 milhões de consentimentos ativos.

Se você mora com alguém, essa conversa vai acontecer. Prefira tê-la com dados na mesa."

---

### Hierarquia de mensagens

```
MENSAGEM PRIMÁRIA:
"O dinheiro de vocês dois. No mesmo lugar."

  → PARA ANA (parceiro ansioso):
  "Você não precisa mais carregar as finanças do casal sozinha.
   Agora vocês dois veem a mesma coisa, ao mesmo tempo."

    → Instagram/TikTok:
    "Quando ele gasta sem avisar, você descobre pelo extrato.
     E aí a briga começa. Tem outro jeito."

    → Google (busca ativa):
    "App de finanças para casais — Open Finance, dashboard conjunto,
     sem sincronização quebrada."

  → PARA RAFAEL (parceiro técnico):
  "Open Finance conectado. Sem scraping. Sem inserção manual.
   Nenhum gasto surpresa. Os dois informados."

    → Reddit/comunidades técnicas:
    "Finalmente um app BR de casal que usa Open Finance de verdade."

    → Newsletter/blog:
    "Por que todos os apps de finanças para casais falharam —
     e como o Open Finance muda o jogo em 2025"
```

---

### 5 temas editoriais

| # | Tema | Formato | Exemplos |
|---|------|---------|---------|
| 1 | **O dinheiro que ninguém fala** (quebra de tabu) | Carrossel, TikTok "você sabia que..." | "5 conversas sobre dinheiro que todo casal precisa ter antes de morar junto" |
| 2 | **Histórias de casal e dinheiro** (identificação) | Micro-histórias, depoimentos | "A briga do cartão de crédito — e o que aprendemos depois" |
| 3 | **Open Finance explicado para humanos** (credibilidade) | Artigo, vídeo explicativo | "Como funciona a conexão sem precisar dar senha para ninguém" |
| 4 | **Dinheiro e relacionamento** (psicologia + finanças) | Podcast 10–15min, entrevista | "O que uma terapeuta de casais pensa sobre dinheiro e relacionamento" |
| 5 | **Vida adulta de dois** (lifestyle + trigger) | Guia prático, checklist | "O checklist financeiro para antes de morar junto" |

> Temas 1 e 5 capturam audiência no topo. Tema 2 cria identificação. Temas 3 e 4 constroem credibilidade. Nenhum dos cinco é sobre o app diretamente — sustentam o posicionamento sem ser propaganda.

---

## SEÇÃO 4 — Análise Competitiva (Competitive Moat)

### 4.1 Fichas de Concorrentes

**Honeydue**
- Preço: Gratuito | Status: Adquirido, time 1–10 pessoas
- Pontos fortes: Marca reconhecida no nicho; pioneiro da categoria; notificações de gasto do parceiro em tempo real
- Pontos fracos: Sincronização bancária quebrada; zero suporte; produto estagnado desde 2022; sem premium; zero presença no Brasil (sem Open Finance BR, sem bancos BR integrados)
- Risco competitivo: **Baixo** — não opera no Brasil, produto deteriorando

**Zeta (extinto)**
- Preço: Gratuito | Status: Encerrou mai/2025
- Pontos fortes: Produto bem desenhado para casais modernos; foco em "money dates"
- Risco competitivo: **Nenhum** — oportunidade de capturar usuários órfãos

**Tandem**
- Preço: $10–12/casal/mês (~R$55–65) | Status: Ativo, USD 3,7M captados jan/2024
- Pontos fortes: Único player direto pago e sustentável; foco explícito em casais; metas conjuntas
- Pontos fracos: Android rudimentar (3,1/5 vs. iOS 4,4/5 — crítico no Brasil com ~80% Android); operação 100% anglófona; base <50K usuários estimados
- Risco competitivo: **Médio** — modelo validado, mas barreira de idioma + Android + localização cria janela de 18–24 meses antes de possível entrada no Brasil

**Monarch Money**
- Preço: $14,99/mês | Status: Cresceu 2.000% pós-Mint
- Pontos fracos: Não é para casais — colaboração é feature secundária; preço USD inacessível para renda média BR; sem suporte em português
- Risco competitivo: **Baixo para BR**

**YNAB**
- Preço: $14,99/mês | Status: Líder em engajamento
- Pontos fracos: Curva de aprendizado altíssima; metodologia rígida; preço USD; sem foco em casal
- Risco competitivo: **Baixo para BR**

**Splitwise**
- Preço: Freemium | Status: 50M+ contas globais
- Pontos fracos: Resolve apenas divisão de despesas — não planejamento; conversão paga ~2%
- Risco competitivo: **Médio** — alta penetração no BR como "primeiro app financeiro de casal", mas baixo overlap funcional

**Noh (BR)**
- Preço: Conta digital gratuita | Status: Ativo
- Pontos fortes: Conta conjunta real com BACEN autorizado; presença no BR
- Pontos fracos: Sem gamificação; sem hábitos; interface bancária genérica; não resolve planejamento financeiro conjunto
- Risco competitivo: **Médio** — poderia adicionar features de gestão, mas foco regulatório cria inércia

**Mobills (BR) — risco a monitorar**
- Preço: R$14,90–19,90/mês | Status: 10M+ downloads, ~300–500K pagantes estimados
- Pontos fracos: Foco 100% individual; sem features de casal; sem gamificação
- Risco competitivo: **Alto se pivotarem para casal** — têm distribuição, Open Finance integrado, marca e base instalada. **Monitorar trimestralmente.**

---

### 4.2 Mapa de Posicionamento

Eixos: **Foco no casal** (Individual ↔ Nativo para casais) × **Profundidade** (Divisão de despesas ↔ Planejamento completo)

```
                     PLANEJAMENTO COMPLETO
                             │
           YNAB              │              [JUNTOS]
        Monarch Money        │         Tandem (sem BR)
           Mobills           │
        Organizze            │
                             │
INDIVIDUAL ──────────────────┼──────────────────── NATIVO PARA CASAIS
                             │
        ZapGastos            │       Honeydue (dormindo)
                             │       Noh (bancário)
        Goodbudget           │       Zeta (extinto) ← VÁCUO
                             │       Splitwise
              DIVISÃO DE DESPESAS / BANCÁRIO
```

O quadrante superior direito está essencialmente vazio no Brasil. Essa é a posição a ocupar.

---

### 4.3 Moat do Produto (construção em camadas)

| Camada | Moat | Defensabilidade | Tempo |
|--------|------|----------------|-------|
| 1 | Timing / first-mover no vácuo BR | Baixa (temporária) | Agora |
| 2 | Open Finance + histórico bilateral | Alta | 6–12 meses |
| 3 | Gamificação + história emocional do casal | Média-Alta | 12–18 meses |
| 4 | Data moat comportamental de casal | Alta | 18–24 meses |
| 5 | Expansão de categoria (hábitos, treinos) | Alta | 24+ meses |

---

### 4.4 Tabela de Funcionalidades: Juntos vs. Top 3

| Funcionalidade | Juntos | Tandem | Mobills | Splitwise |
|----------------|--------|--------|---------|-----------|
| Foco explícito em casais | ✅ | ✅ | ❌ | Parcial |
| Disponível em PT-BR | ✅ | ❌ | ✅ | ✅ |
| Open Finance BR | ✅ (roadmap) | ❌ | ✅ | ❌ |
| Android robusto | ✅ | ❌ (3.1/5) | ✅ | ✅ |
| Orçamento conjunto | ✅ | ✅ | ❌ | ❌ |
| Metas financeiras conjuntas | ✅ | ✅ | Individual | ❌ |
| Gamificação e streaks | ✅ | ❌ | ❌ | ❌ |
| Benchmarks vs. casais similares | ✅ (data moat) | ❌ | ❌ | ❌ |
| Hábitos / saúde (roadmap) | 2026 | ❌ | ❌ | ❌ |
| Suporte em português | ✅ | ❌ | ✅ | ✅ |
| Preço acessível BR | ✅ | ❌ (USD) | ✅ | ✅ |

**Onde o produto PERDE honestamente no lançamento:**
- Vs. Tandem: chat financeiro integrado (Tandem tem; produto não tem no MVP)
- Vs. Mobills: volume e granularidade de relatórios (5+ anos de refinamento de UX)
- Vs. Splitwise: rede de efeito viral já estabelecida (50M usuários vs. zero)

---

## SEÇÃO 5 — Modelo de Negócio e Pricing

### 5.1 Modelo: Freemium com trial forçado do tier pago

**Justificativa:**
1. **Dinâmica de dois lados:** produto requer que DOIS usuários ativem. Paid-only cria dupla barreira. Freemium permite que um convide o outro sem fricção financeira.
2. **Comportamento fintech BR:** conversão freemium→pago em fintech B2C BR: 5–8%. Com 10.000 ativos = 500–800 pagantes — suficiente para validar antes de escalar.
3. **Planos anuais anti-churn:** reduzem churn em 51%. CTA primário sempre no anual.

---

### 5.2 Estrutura de Tiers

**Casal Livre — R$0**
- Para quem: Casais em fase de descoberta
- Inclui: Registro manual de transações (até 50/mês combinados); 1 conta bancária via Open Finance; visão do mês atual; 3 categorias; 1 meta conjunta; resumo mensal básico
- Não inclui: Histórico além de 3 meses; relatórios visuais; gamificação; metas ilimitadas; contas ilimitadas; notificações inteligentes; benchmarks
- Gatilhos de upgrade: histórico > 3 meses; 2ª conta bancária; 50 transações/mês; 2ª meta

---

**⭐ Casal Pro [TIER HERO] — R$29,90/mês | R$239,90/ano (R$19,99/mês)**
- Para quem: ICP primário — casal 26–35 anos, renda R$6K–15K, primeiro app de finanças conjuntas
- Inclui: Transações ilimitadas; contas ilimitadas via Open Finance BR; histórico completo; relatórios visuais completos (gráficos de tendência, heatmap, comparativo mês a mês); gamificação completa (streaks, nível do casal, badges, celebrações); metas ilimitadas com projeção de data; notificações inteligentes; benchmarks vs. casais similares; exportação CSV/PDF; suporte via chat 24h úteis
- Não inclui: Consultoria 1:1; corretoras; IR conjunto; hábitos/saúde (roadmap 2026)

---

**Família — R$49,90/mês | R$399,90/ano — lançar em Q3, não no MVP**
- Para quem: ICP secundário — casal com filhos, planejamento de imóvel
- Inclui: Tudo do Pro + até 4 membros da família + relatórios consolidados + integração com corretoras (XP, NuInvest, Rico) + simulador de financiamento + suporte prioritário 4h úteis

> **Nota de lançamento:** MVP com apenas Casal Livre + Casal Pro. Menos opções = menos paralisia de decisão.

---

### 5.3 Métricas Financeiras Projetadas

**ARPU blended:** (65% × R$29,90) + (35% × R$19,99) = **R$26,43/mês**

| Métrica | Conservador | Base | Otimista |
|---------|------------|------|---------|
| Conversão freemium → pago | 3% | 5,5% | 8% |
| Churn mensal (pagantes) | 6% | 3,5% | 2% |
| ARPU mensal (blended) | R$24,00 | R$26,43 | R$28,00 |
| LTV (lifetime, 1/churn × ARPU) | R$400 | R$755 | R$1.400 |
| CAC target máximo (LTV:CAC 3:1) | R$133 | R$252 | R$467 |
| CAC realista bootstrapped (orgânico) | R$30–50 | R$50–80 | R$50–80 |
| LTV:CAC ratio | 5:1–8:1 | 9:1–15:1 | 17:1–28:1 |
| Payback period | 18 meses | 10 meses | 6 meses |
| Break-even pagantes (custo fixo R$15K/mês) | ~625 | ~568 | ~536 |
| ARR projetado ano 1 (500 pagantes) | R$144K | R$158K | R$168K |

> **Risco crítico:** churn > 5% + conversão < 3% simultaneamente cria LTV < R$300. Focar obsessivamente em reduzir churn antes de ligar paid.

---

### 5.4 Psicologia de Pricing

**Apresentação:** 2 colunas no lançamento (Livre + Pro). Âncora: R$29,90/mês em destaque. Toggle "Pagar anualmente" = "Economize R$119 — 4 meses grátis". Preço anual como "R$19,99/mês" (não R$239,90/ano). Badge do tier hero: "Mais popular entre os casais".

**Velvet rope features mais eficazes:**

| Feature | Por que é o gatilho certo |
|---------|-----------------------------|
| Histórico além de 3 meses | Usuário descobre no final do trimestre |
| Gráficos de tendência | Após 30 dias, quer entender o padrão — ícone visível mas bloqueado |
| Badges e nível do casal | Vê a barra de progresso mas não desbloqueia |
| Benchmarks vs. outros casais | "Será que a gente gasta mais que a média?" — mostra prévia, bloqueia detalhe |
| 2ª conta bancária | Quem tem Nubank + conta do salário precisa desta |

**Ancoragem contextual no paywall:** nunca mostrar apenas preço. Mostrar: o que PERDERIA sem upgrade (framing de perda) + quanto o casal já economizou/registrou + "Menos que um jantar fora por mês para os dois".

---

### 5.5 Estratégia de Preço por Fase

| Fase | Preço | Estratégia |
|------|-------|-----------|
| Lançamento D0–D+90 | R$19,90/mês | Early adopters com lock-in forever — urgência e prova social |
| Beta público D+90–D+180 | R$24,90/mês | Transição gradual |
| Preço definitivo D+180+ | R$29,90/mês | Preço de mercado |
| Revisão anual (12 meses) | R$34,90/mês | Se NPS > 50 e churn < 3% |

**Argumento decisivo:** R$29,90 **por casal** é R$14,95 por pessoa — abaixo do que Mobills e Organizze cobram individualmente, com proposta de valor muito maior. O enquadramento "por casal" é obrigatório em toda comunicação de preço.

---

## SEÇÃO 6 — Estratégia de Canais

### Mix de Canais por Fase

| Fase | Foco | Canais ativos | Orçamento |
|------|------|--------------|-----------|
| **Mês 0–3 (pré-lançamento)** | Audiência + waitlist | TikTok orgânico, Instagram, Email, Reddit/FB, Finfluencers nano (troca) | R$0–300 |
| **Mês 3–6 (beta fechado)** | Ativação + feedback | Todos Tier 1 + YouTube (início), Podcast (primeiras aparições), PR (pitches) | R$0–1.000/mês |
| **Mês 6–12 (lançamento público)** | Aquisição + conversão | Todos orgânicos + Referral in-app + Blog/SEO gerando tráfego | R$0–2.000/mês |
| **Mês 12–24 (scaling)** | Eficiência + escala | Tudo acima + Meta Ads + Open Finance parceria | R$5.000–20.000/mês |

---

### Canal 1 — TikTok Orgânico [TIER 1]

- **CAC:** próximo de zero | **Volume:** 800–3.000 usuários/mês (maturidade mês 6–9)
- **Por que TikTok primeiro:** distribuição orgânica estrutural — vídeos de contas novas chegam a 100k+ views sem seguidores. Para bootstrapped, é o único canal que dá alcance massivo sem pagar.

**Táticas:**
1. **"Casal transparency series"** — confissão financeira a dois, câmera frontal, tom íntimo. Formato explode por ser tabu + voyeurismo financeiro + identificação.
2. **"Antes e depois de ver o extrato conjunto"** — screenshot real de conta desorganizada vs. categorizado no app. Narração do problema e solução. CTA para waitlist.
3. **Duetos/stitch com finfluencers** — quando finfluencer grande postar sobre "dinheiro em relacionamentos", stitch respondendo imediatamente.
4. **Comentários estratégicos nos top vídeos do nicho** — buscar #dinheiro casal, #financas pessoais. Aparecer como autoridade nos comentários antes de ter audiência própria.
5. **POV trend financeira** — "POV: Você abriu o extrato do mês com seu parceiro pela primeira vez" com áudio viral do momento.

**Frequência:** 4–5 vídeos/semana | **Métrica de sucesso:** mês 6 → 3.000 seguidores, 1 vídeo viral (>100k), 200+ cadastros na waitlist

---

### Canal 2 — Instagram Reels [TIER 1]

- **CAC:** R$0–5 | **Volume:** 300–1.200 usuários/mês (maturidade mês 8–12)
- Canal de amplificação e conversão, não de descoberta (distribuição orgânica menor que TikTok para contas novas)

**Táticas:**
1. **Reaproveitamento sistemático do TikTok** — todo vídeo vai para Reels 24h depois sem watermark (SnapTik)
2. **Stories diários** — enquetes financeiras de casal para engajamento e dados de ICP ("Vocês têm conta conjunta? [SIM] [NÃO]")
3. **Carrossel educativo semanal** — 7–10 slides, formato checklist. Save rate alto = alcance orgânico prolongado
4. **DM automation (ManyChat gratuito)** — entregar link de waitlist quando alguém comentar "quero" ou "link"
5. **Collab posts com nano-influencers** (5k–30k seguidores) do nicho "vida a dois" — sem pagamento, só troca de visibilidade

**Frequência:** 3 Reels/semana + 1–2 Stories/dia + 1 carrossel/semana

---

### Canal 3 — YouTube [TIER 2] — iniciar no mês 3

- **CAC:** R$0 | **Volume:** 100–400 usuários/mês (maturidade mês 12–18) | Conteúdo perene

**Táticas:**
1. **Série "Finanças a dois na prática"** — 8 episódios documentando jornada de casal real (beta user)
2. **Vídeos de busca de alta intenção** — "conta conjunta banco digital casal", "como dividir contas com namorado", "planilha financas casal"
3. **Comparativos honestos** — "Testamos 5 apps de finanças para casal: qual é o melhor em 2025?"
4. **Colaboração com canais de relacionamento** (10k–50k inscritos) como convidado
5. **Clipping para TikTok/Reels** — cada YouTube gera 5–8 clips, multiplicando o ROI de produção

---

### Canal 4 — SEO / Blog [TIER 2] — iniciar no mês 2

**10 artigos prioritários:**
1. "O que é Open Finance e o que muda para casais" (~1.200 buscas/mês, baixa dificuldade)
2. "Zeta encerrou: as melhores alternativas para casais em 2025" (~800/mês, alta intenção)
3. "Como dividir as contas do casal sem brigar" (~3.400/mês)
4. "Planilha de finanças do casal: por que apps são melhores"
5. "Metas financeiras para casais: como estabelecer e cumprir juntos"
+ 5 artigos de clusters similares

**Ferramenta:** Calculadora interativa "Quanto cada um deve pagar de aluguel?" embedada no blog — gera backlinks naturais e alta taxa de compartilhamento.

---

### Canal 5 — Reddit e Grupos Facebook [TIER 1] — executar imediatamente

- **CAC:** R$0 | **Regra de ouro:** nunca postar o produto. Primeiros 30 dias: só ajudar.

**Táticas:**
1. **Alerta de palavras-chave diário** via F5Bot.com (gratuito): "dinheiro casal", "conta conjunta", "dividir contas namorado". Responder em até 2 horas.
2. **Thread de "pesquisa" legítima** — "Estou pesquisando sobre gestão financeira de casais para um projeto. Alguém teria 5 minutos?" Nunca mencionar o produto.
3. **Resposta com profundidade acima da média** — a resposta mais completa do thread gera upvotes e distribuição orgânica para 50k+ membros do sub.
4. **Grupos Facebook de nicho** — "Finanças Pessoais Brasil" (>100k), "Casamentos Reais Brasil", participar com conteúdo educativo.

---

### Canal 6 — Finfluencers de Casal [TIER 1] — prospectar semana 3

- **CAC:** R$10–40 | **Volume:** 300–1.500 usuários/mês (5–10 parcerias ativas)

**Tiers de influencer:**
- **Tier A** (nano, 3k–15k): 20 perfis — Pro vitalício em troca de 1 post + 3 Stories
- **Tier B** (micro, 15k–80k): 10 perfis — Pro + menção no blog + comissão R$15/signup
- **Tier C** (médio, 80k–300k): 3–5 perfis — pagar R$500–2.000 após PMF

**Identificar via:** busca no TikTok por "finanças casal", "vida a dois dinheiro" + hashtags #casalorganizado, #financasacasal no Instagram.

**Briefing:** enviar os dados da Serasa ("53% brigam por dinheiro") e pedir que contem a PRÓPRIA história. Conteúdo autêntico converte 3x mais que publi roteirizada.

---

### Canal 7 — Email Marketing / Waitlist [TIER 1] — configurar semana 1

- **CAC:** R$0–2 | **Por que é Tier 1:** é o único ativo permanente antes de ter produto.

**Sequência de 5 emails (14 dias):**
- Email 1 (imediato): Confirmação + posição na fila + missão do produto
- Email 3 (dia 3): "A pesquisa que mudou a forma como vemos dinheiro de casal" (dados Serasa)
- Email 5 (dia 7): Bastidores do produto — screenshot real em construção
- Email 8 (dia 10): "Estamos selecionando 50 casais para o beta — você quer ser um deles?"
- Email 12 (dia 14): Conteúdo de valor + urgência da fila

**Gamificação da waitlist:** Viral Loops ou implementação manual — indicar outros casais sobe na fila. "Você está na posição 347. Compartilhe com 2 amigos e sobe para a posição 89."

---

### Canal 8 — Programa de Referral In-App [TIER 2] — implementar antes do lançamento

- **CAC:** R$0–15 | **K-factor target:** 0.3 (cada 10 usuários traz 3 novos)

**Mecânica:** "Convide um casal" — link único que abre landing page personalizada: "O [Nome] e [Parceiro] te convidaram para ver juntos que vocês gastaram R$X em [categoria] esse mês." Dados reais + curiosidade = alta conversão.

**Recompensa bilateral:** quem convida ganha 30 dias Pro grátis. Quem aceita começa com 30 dias Pro. Gatilho: mostrar CTA no pico emocional positivo (após primeira meta atingida), não em banner genérico.

---

### Canal 9 — Meta Ads [TIER 3] — ativar apenas após checklist obrigatório

**Checklist antes de ligar o orçamento (todos obrigatórios):**
- NPS > 40
- D30 retention > 30%
- Conversão freemium → pago > 5%
- LTV:CAC projetado > 3:1 com CAC alvo de R$50
- Pelo menos 1 criativo orgânico com >100k views no TikTok

**Creative strategy quando ativar:** UGC — vídeos reais de casais beta, não anúncios produzidos. CTR 4x maior que criativos de marca em fintech.

---

### Flywheel de Crescimento

```
LOOP 1 — CONTEÚDO → AUDIÊNCIA → USUÁRIOS
Fundador cria conteúdo sobre dinheiro de casal
  → Views + compartilhamentos (identificação com a dor)
  → Usuário vai para bio → waitlist/app
  → Usuário ativa → gera dados de uso
  → Dados de uso viram novos conteúdos
  → (volta ao início)

LOOP 2 — PRODUTO → REFERRAL → CRESCIMENTO VIRAL
Casal usa o produto e resolve problema
  → Momento "aha" emocional
  → App solicita indicação no pico positivo
  → Casal indica outro casal (contexto social reforça credibilidade)
  → Novo casal ativa + replica o ciclo
  → (volta ao início)

LOOP 3 — DADOS → AUTORIDADE → DISTRIBUIÇÃO
Base gera dados anonimizados de finanças de casais BR
  → Dados viram pesquisas proprietárias (PR, conteúdo)
  → Imprensa cobre → novos usuários chegam
  → Mais usuários = mais dados
  → (volta ao início)

OS 3 LOOPS SE ALIMENTAM MUTUAMENTE:
Conteúdo do Loop 1 → usa dados do Loop 3
Usuários do Loop 1 → alimentam referral do Loop 2
Referral do Loop 2 → gera mais dados para Loop 3
Dados do Loop 3 → fortalecem conteúdo do Loop 1
```

---

### Primeiros 10 vídeos TikTok — hooks e títulos

| # | Hook/Título | Formato | Semana |
|---|------------|---------|--------|
| 1 | "Quanto vocês gastam por mês sem saber? A gente descobriu o nosso e ficamos em choque. [Número nos primeiros 3s]" | Câmera frontal | 1 |
| 2 | "A briga de dinheiro que quase terminou nosso relacionamento — e o que mudou depois" | Confissão | 1 |
| 3 | "Como dividir aluguel quando um ganha mais que o outro? O método que nenhuma planilha te ensina" | Tutorial | 1 |
| 4 | "A gente usou o mesmo cartão por 8 meses sem saber quanto cada um gastava. Isso mudou tudo" | Antes/depois | 2 |
| 5 | "Stitch @[finfluencer]: Concordo com tudo — mas esse ponto aqui é o que mais vejo casais errando" | Dueto | 2 |
| 6 | "POV: Você propõe para seu parceiro fazerem um orçamento conjunto. A reação dele/dela:" | POV + áudio viral | 2 |
| 7 | "Pesquisei 200 casais brasileiros sobre finanças. O resultado foi deprimente — e revelador" | Dado proprietário | 3 |
| 8 | "Vocês perguntaram: como a gente lida quando um quer economizar e o outro quer gastar? A resposta honesta" | Comment mining | 3 |
| 9 | "R$347 por mês. Esse foi o dinheiro que a gente estava jogando fora sem perceber. Veja como" | Número específico + curiosidade | 3 |
| 10 | "O app de gestão financeira para casais que existia nos EUA fechou em maio. A gente está construindo o brasileiro — e você pode ser o primeiro a usar" | Timing + urgência | 4 |

**Métricas de referência por vídeo:**

| Métrica | Fraca | Boa | Excelente |
|---------|-------|-----|-----------|
| Taxa de conclusão (TikTok) | < 30% | 40–55% | > 60% |
| Taxa de compartilhamento | < 0,5% | 1–2% | > 3% |
| Taxa de save (carrossel IG) | < 3% | 5–10% | > 12% |
| Cliques no link da bio por vídeo | < 10 | 30–80 | > 100 |

---

## SEÇÃO 7 — Estratégia de Lançamento

### FASE 0 — Pré-lançamento (D-90 a D-0)

**Objetivos mensuráveis:**

| Objetivo | Target mínimo (go/no-go) | Target ideal |
|----------|--------------------------|--------------|
| E-mails na waitlist | 1.500 | 3.000 |
| Casais completos na waitlist (ambos cadastrados) | 400 pares | 900 pares |
| Seguidores orgânicos (Instagram + TikTok) | 500 | 2.000 |
| Entrevistas de validação | 30 | 60 |
| Press pickups garantidos para D0 | 2 veículos | 5 veículos |

**Artefatos a produzir:**

**1. Landing page de waitlist**
- URL: escolher domínio com nome que remeta a casal + finanças (ex: `dupla.app`, `junto.finance`)
- Headline A/B: Versão A: "O app que o Zeta deveria ter sido" | Versão B: "Dinheiro de casal é diferente. Finalmente um app que entende isso."
- Seções obrigatórias: problema em 3 pontos visuais + mockup do MVP + barra de progresso da waitlist ("847 casais já na fila") + FAQ com "meus dados são seguros?" e "O que é Open Finance?"
- Referral integrado: após cadastro, página com link único ("Suba na fila indicando outros casais")
- Pixel Meta + Google Tag Manager instalados desde D-90 (mesmo sem ads — para criar audiência de remarketing gratuita)
- Tech: Framer (gratuito) ou Next.js na Vercel | Build: máximo 3 dias

**2. Sequência de e-mail pós-cadastro (6 emails)**
- Email 1 (imediato): Confirmação + posição na fila + missão do produto
- Email 2 (D+2): "Como o Zeta desapontou 200.000 casais" — história + gancho emocional
- Email 3 (D+7): Bastidores do produto — screenshot real em construção
- Email 4 (D+14): "Você pode ajudar a moldar o produto" — link para entrevista de 20min
- Email 5 (D+21): "5 erros financeiros que casais cometem no primeiro ano juntos"
- Email 6 (D+30): "Beta fechado abre em X dias — sua posição na fila"
- Ferramenta: Brevo (gratuito até 300 emails/dia) | Taxa de abertura alvo: > 45%

**3. Press kit (disponível em `/imprensa`)**
- Release 1 página PT + EN
- Screenshots do app em alta resolução (mockups ok em D-90, app real em D-30)
- Logo em SVG + PNG (fundo branco e transparente)
- Foto do fundador(a) em alta resolução
- Dados de mercado com fontes (61,9M consentimentos Open Finance, crescimento PIX, etc.)
- 3 depoimentos de beta testers
- Bio do fundador(a) em 50 e 150 palavras

**4. Comunidade de embaixadores antecipados**
- Grupo WhatsApp/Telegram privado "Fundadores do [Nome]" — primeiros 50–100 casais mais engajados
- Benefícios: acesso antecipado ao beta + badge permanente + 12 meses Pro gratuito + canal direto com fundador
- Critério de seleção: abriu todos os emails OU respondeu entrevista OU indicou 2 casais

**5. SEO — 10 artigos de blog** (publicar de D-60 em diante, 1/semana)
- "Zeta encerrou: as melhores alternativas para casais em 2025"
- "Como dividir as contas do casal sem brigar"
- "O que é Open Finance e o que muda para casais"
- "Apps de controle financeiro para casais: comparativo 2025"
+ 6 artigos de cauda longa com volume validado no Ubersuggest/Ahrefs free

---

**Critério de go/no-go — Fase 0 → Fase 1:**

GO se:
- Waitlist >= 1.500 emails com >= 400 pares completos
- >= 30 entrevistas, com >= 70% dizendo "precisaria disso" ou "pagaria por isso"
- MVP funcional com: login de casal + visão financeira compartilhada + 1 meta conjunta
- Pelo menos 1 press pickup garantido para a semana de lançamento

NO-GO (adiamento de 30 dias) se:
- Waitlist < 1.000 emails
- MVP com bugs críticos no fluxo de onboarding

---

### FASE 1 — Beta Fechado (D-0 a D+60)

**Perfil obrigatório do beta tester:**
- Casal com os dois parceiros dispostos a usar (sem exceção)
- Smartphone Android ou iOS atualizado (últimos 2 anos)
- Renda familiar combinada >= R$4.000/mês
- Dispostos a participar de 2 calls de feedback (D+7 e D+45)

**Composição dos 150 casais-alvo:**
- 40% — ex-usuários Zeta (recrutamento via grupos Facebook, Reddit, comunidades)
- 25% — casais da waitlist com maior engajamento
- 20% — grupo de embaixadores antecipados
- 15% — rede pessoal do fundador(a) (para acesso fácil a feedback qualitativo)

**Timeline de abertura:** 50 casais na semana 1 → 50 na semana 2 → 50 na semana 4 (abertura gradual para corrigir bugs antes de escalar)

---

**Métricas de ativação do beta (go/no-go para lançamento público):**

| Métrica | Threshold go/no-go | Target ideal |
|---------|-------------------|--------------|
| Ativação D1 — casal completo conectou contas | >= 35% | >= 55% |
| Ativação D7 — casal com >= 1 meta criada | >= 25% | >= 40% |
| Retenção D7 (ambos os parceiros retornaram) | >= 40% | >= 60% |
| Retenção D30 (1 login/semana de ambos) | >= 25% | >= 40% |
| NPS ao final do beta (D+45) | >= 40 | >= 55 |
| Conversão free → pago voluntária no beta | >= 8% | >= 15% |
| Bugs críticos abertos ao final do beta | 0 | 0 |

---

**Loops de feedback no beta:**

- **Semana 1 — Onboarding call (30min, primeiros 30 casais):** fundador(a) assiste o casal usar via compartilhamento de tela. Perguntas: "Qual foi a parte mais difícil?" / "O que você esperava e não tem?" / "Você recomendaria agora?"
- **D+7 — NPS intermediário (email automático):** NPS padrão + "Qual a única coisa que mudaria hoje?" Meta de resposta: >= 60%
- **D+14 — Entrevistas qualitativas (30 casais):** 10 mais engajados + 10 menos engajados + 10 que tentaram pagar
- **D+30 — Check de retenção:** Dashboard PostHog self-hosted (gratuito). Se D30 < 20%: reunião de emergência de produto
- **D+45 — NPS final + call de fechamento para quem converteu para pago:** entender o trigger de conversão

---

**Critério de go/no-go — Beta → Lançamento Público:**

GO (todos obrigatórios):
- Retenção D30 >= 25% (casal com ambos retornando)
- NPS >= 40
- Zero bugs críticos no fluxo de onboarding e Open Finance
- Open Finance funcionando para os 4 maiores bancos: Itaú, Bradesco, BB, Nubank
- Pelo menos 3 histórias de sucesso documentadas de casais beta (com números reais)

NO-GO (adiamento de 30 dias):
- NPS < 35 | Retenção D30 < 20% | Erros Open Finance > 15% das conexões

---

### FASE 2 — Lançamento Público (D+60 a D+180)

**Semana de lançamento — roteiro completo:**

```
D-14:
  - Post LinkedIn anunciando data: "daqui a 2 semanas, o app que 200.000
    casais estavam esperando abre para o público"
  - Contato final com jornalistas: enviar press kit + exclusiva para 1
    veículo principal (Exame, Infomoney ou Seu Dinheiro)
  - Briefing dos 20 embaixadores: "no dia D0, postem seu story com esse link"
  - Atualizar landing page: contador regressivo de 14 dias
  - Setup de suporte: Crisp (gratuito até 2 agentes) + FAQ completo
  - Testar servidor: aguenta 10x o tráfego esperado? (loader.io)

D-7:
  - Thread Twitter/X: "em 7 dias, abre o [nome]. Aqui está o que
    construímos e por quê" — 12 tweets com bastidores, dados de beta
  - TikTok: vídeo 60s com depoimento real de casal beta
  - ProductHunt upcoming: aparecer na lista "coming soon"
  - Email para toda waitlist: "em 7 dias você vai receber seu convite"
  - Enviar assets para todos os influenciadores confirmados

D-3:
  - Instagram Reels: "3 dias" — números do beta (X casais, X% ativo semanalmente)
  - Contato final com jornalistas: confirmar embargo e horário (alvo: 8h do D0)
  - Testar fluxo completo de cadastro 10 vezes
  - Preparar respostas para comentários negativos prováveis ("é seguro?",
    "vai fechar igual ao Zeta?", "por que pagar?")
  - Garantir que Brevo aguenta 5.000 emails em 24h sem throttle

D-1:
  - Email para waitlist: "amanhã é o dia" — tom pessoal do fundador(a),
    sem imagens, sem design. Parecer email de pessoa para pessoa.
  - Stories Instagram + TikTok: "amanhã às 8h o link abre"
  - Avisar grupo de embaixadores: "amanhã às 8h, postem o story"

D0 (8h):
  - Disparar email para toda waitlist (embaixadores primeiro, depois lista completa)
  - Publicar no ProductHunt (rascunho pronto desde D-1)
  - Post LinkedIn + thread Twitter/X de lançamento
  - Stories coordenados: fundador(a) + 20 embaixadores ao mesmo tempo
  - Matéria no veículo com exclusiva (8h)

D0 (13h):
  - Monitorar em tempo real: cadastros, erros de servidor, tickets
  - Responder 100% dos comentários em até 2 horas
  - Update Twitter/X: "X cadastros nas primeiras 4 horas"
  - Enviar release para imprensa sem exclusiva (Infomoney, Startups.com.br, NeoFeed)

D0 (19h):
  - TikTok/Reels: reação ao primeiro dia — números reais, tom autêntico
  - Email para embaixadores: atualização dos números do dia
  - Monitorar erros de Open Finance, taxa de completude de onboarding

D+1:
  - Responder todas as menções, comentários, DMs do D0
  - DM pessoal do fundador(a) para os 10–20 usuários mais engajados do D0
  - Post LinkedIn com número de cadastros D0
  - Verificar: ativação D1 >= 35%? Se não, intervir no onboarding.

D+3:
  - TikTok/Reels com primeiro depoimento real de usuário da Fase 2
  - Verificar retenção D3 — alvo >= 50% dos casais que ativaram
  - Artigo no blog: "o que aprendemos nos primeiros 3 dias com X casais"

D+7:
  - Review completo de métricas da semana 1:
    • Total de cadastros • Taxa de ativação D1 e D7 • Retenção D7
    • Conversões free → pago • NPS médio • Top 3 bugs • Top 3 features pedidas
  - Thread de transparência Twitter/X com números da semana 1

D+14:
  - Validar: retenção D14 >= 30%? Se não, sprint de produto em retenção
  - Avaliar primeiras conversões free → pago: qual feature foi o gatilho?
  - Contato com potencial parceiro 1 (corretoras de valores)
```

---

**Ângulo da campanha de PR:**

*Título principal:* "O app brasileiro que quer ser o 'Duolingo das finanças de casal' — e chegou na hora certa"

*Por que essa história vende:* referência ao Duolingo é imediatamente compreensível; timing com Zeta + Open Finance dá gancho de oportunidade; é história de produto, não de tecnologia.

*Ângulos alternativos:*
- Exame/Infomoney: "Como o Open Finance está criando uma nova categoria de apps de casal"
- Glamour/Claudia/Marie Claire: "Dinheiro é o maior causador de brigas em casais. Este app brasileiro quer mudar isso"

**Veículos alvo em ordem de prioridade:**
1. Seu Dinheiro (exclusiva) — maior alcance em finanças pessoais, leitores são o ICP exato
2. Exame (embargo simultâneo) — credibilidade institucional
3. Infomoney — segundo maior veículo de finanças pessoais
4. Startups.com.br — comunidade de early adopters tech
5. Fintechs.com.br — cobertura especializada em Open Finance
6. Glamour / Marie Claire (em D+14 após métricas iniciais confirmadas)

---

**Metas de usuários:**

| Marco | Cadastros totais | Casais ativos | Pagantes |
|-------|-----------------|--------------|----------|
| D+30 | 5.000 | 1.500 | 120 |
| D+60 | 12.000 | 3.600 | 400 |
| D+90 | 22.000 | 6.500 | 900 |

---

### FASE 3 — Scaling (D+180 em diante)

**Gatilho para ativar paid acquisition (todos obrigatórios simultaneamente):**
1. LTV:CAC orgânico >= 3:1 calculado com dado real de 90 dias
2. NPS >= 50
3. Retenção D90 >= 20% dos casais ativos
4. MRR >= R$15.000

**Sequência de canais pagos:**
1. **Meta Ads (D+180):** UGC de casais beta como creative. Targeting: retargeting de visitantes + lookalike de pagantes + interesses "finanças pessoais" + "em relacionamento" + recém-mudados. Budget: R$3.000–5.000/mês. CAC target < R$25/lead.
2. **Google Ads Search (D+210):** keywords de intenção alta. Budget: R$2.000/mês.
3. **TikTok Ads (D+240):** Spark Ads amplificando vídeos orgânicos que já performaram. Budget: R$1.500/mês.
4. **Influencer pago micro (D+300):** 5–8 micro influenciadores com contrato de performance. Budget: R$2.000–3.000/mês.

---

## SEÇÃO 8 — Métricas e OKRs

### North Star Metric

**Casais com sessão conjunta semanal ativa** — número de casais onde os dois parceiros fizeram login ao menos uma vez nos últimos 7 dias, calculado toda segunda-feira.

**Por que essa e não outra:**

| Alternativa | Por que não é a NSM |
|------------|---------------------|
| Total de cadastros | Métrica de vaidade |
| MRR | Pode crescer com churn mascarado por novos pagantes |
| DAU individual | Ignora a natureza colaborativa — 1 parceiro usando sem o outro não é o produto funcionando |
| NPS | Lagging indicator — mede satisfação, não uso ativo |

Casais com sessão conjunta semanal têm D30 retention 3x maior. É também proxy de receita (casais ativos convertem para pago em 3x mais frequência).

**Targets da NSM:**
- D+30: 400 casais | D+90: 1.500 | D+180: 4.000 | D+365: 12.000

---

### Árvore de Métricas

```
NORTH STAR: Casais com sessão conjunta semanal ativa
│
├── AQUISIÇÃO — Novos pares cadastrados por semana
│     Definição: casais onde ambos completaram cadastro (e-mail verificado)
│     Target D+90: 500 novos pares/semana
│     Alarme: < 200 pares/semana por 2 semanas consecutivas
│
├── ATIVAÇÃO — Taxa de casais que completaram onboarding em 48h
│     Definição: ambos logaram + 1 conta bancária conectada via Open Finance
│     Target mínimo: 35% dos pares cadastrados
│     Alarme: < 25%
│
├── RETENÇÃO — % de casais ativos na semana N que voltam na semana N+1
│     Weekly retention target: 50% | Alarme: < 40% por 2 semanas
│     D30 retention target: >= 30% dos casais que ativaram
│
├── RECEITA — MRR + conversão free→pago
│     Conversão target: >= 5% | Alarme: < 3%
│     ARPU target: R$27 (blended) | Churn mensal: <= 5%
│     MRR target D+90: R$15.000 | MRR target D+180: R$45.000
│
└── REFERÊNCIA — K-factor + NPS
      K-factor target: >= 0.3
      NPS target D+90: >= 45 | Alarme: < 35
```

---

### OKRs — Primeiros 4 Trimestres

**Q1 — Provar que o produto retém casais e gera desejo de pagar**
```
KR1: Retenção D30 >= 30% no beta fechado (150 casais) — verificar na semana 8
KR2: NPS >= 45 ao final do beta (D+60) — pesquisa Tally em D+50
KR3: Converter >= 15 casais para plano pago voluntariamente durante o beta
```

**Q2 — Lançar publicamente e estabelecer motor de crescimento orgânico**
```
KR1: Atingir 22.000 cadastros totais (pares únicos) até o final do Q2
KR2: Atingir NSM de 1.500 casais com sessão conjunta semanal até o final do Q2
KR3: Atingir MRR de R$15.000 (~560 assinantes pagantes com ARPU R$26,7)
```

**Q3 — Ramp de receita sustentável e primeiros canais pagos**
```
KR1: Atingir MRR de R$45.000 (~1.700 assinantes)
KR2: Ativar Meta Ads com CAC <= R$30 (par ativado) e ROAS >= 1.5x em 90 dias
KR3: Atingir NSM de 4.000 casais com sessão conjunta semanal
```

**Q4 — Flywheel de crescimento — produto viraliza por si mesmo**
```
KR1: Atingir MRR de R$100.000 (~3.700 assinantes)
KR2: K-factor >= 0.4 (40% dos novos usuários vêm de indicações)
KR3: Lançar expansão de produto (hábitos ou relatório de IR) com >= 40% de adoção
     entre usuários ativos D30
```

---

### Dashboard de Early Warning

**1. Taxa de ativação do par em 48h**
- Alarme: < 25%
- Ação: gravar 5 usuários no onboarding via UserTesting → identificar maior ponto de abandono no PostHog → simplificar ou remover o passo → A/B testar nova versão em 72h

**2. Weekly Couple Retention**
- Alarme: < 40% por 2 semanas consecutivas
- Ação: email de reengajamento para casais inativos + push "sua parceira/parceiro viu o resumo da semana, quer ver também?" + se persistir 3 semanas: sprint 100% retenção, pausar features novas

**3. Churn mensal de pagantes**
- Alarme: > 8%
- Ação: ligar para todos os cancelamentos nos últimos 30 dias — meta: falar com >= 10 em 48h → mapear se é churn de ativação ou de engajamento → implementar pausa de assinatura como alternativa ao cancelamento (reduz churn em ~20%)

**4. NPS abaixo de 35**
- Alarme: < 35 em qualquer medição mensal
- Ação: pausar qualquer investimento em crescimento → entrevistar 20 detratores em 1 semana → sprint de produto 2 semanas → re-medir em D+30

**5. Falha de conexão Open Finance > 15%**
- Alarme: > 15% de erros em 24h
- Ação: identificar qual banco está gerando erros → ativar fallback de importação CSV com notificação proativa → contato com parceiro de Open Finance para suporte técnico → status page público

---

### Funil de Conversão Completo

| Etapa | De quem | Taxa esperada | Taxa de alarme | O que testar se abaixo |
|-------|---------|--------------|----------------|------------------------|
| Visitante → Cadastro (1 parceiro) | Visitantes únicos | 8–12% | < 5% | Headline A/B, remover campos, social proof above fold |
| Cadastro → Par completo | 1 parceiro cadastrado | 50–65% | < 40% | Copy do convite com dado real, prazo de expiração do link (48h urgência) |
| Par completo → Ativação | Par completo | 35–45% | < 25% | Reduzir steps (< 5 telas), skip da conexão bancária com demo fictícia |
| Ativação → Aha Moment (meta criada) | Casais ativados | 55–70% | < 45% | In-app prompt para criar meta na sessão de ativação, celebração visual |
| Aha Moment → Pagante | Casais com Aha Moment | 4–7% | < 3% | Qual feature é gatilho de upgrade, velvet rope nas 2–3 features mais valorizadas |
| Pagante → Ativo D30 | Pagantes | 60–70% | < 50% | Resumo do mês no D+28, gamificação de streak, relatório anual em Janeiro |

**Conversão ponta a ponta (visitante → pagante ativo D30):** 0,07% a 0,17% — para 900 pagantes em D+90, precisar de ~530k–1,3M visitantes únicos. Justifica foco absoluto em orgânico de alto volume.

---

## SEÇÃO 9 — Riscos e Planos de Contingência

### Risco 1 — Confiança com dados financeiros

```
Probabilidade: Alta | Impacto: Alto

Sinal de alerta:
- Taxa de conclusão do onboarding na etapa bancária < 40%
- Taxa de desconexão voluntária de banco em D7 > 20%
- Menções com "inseguro", "golpe", "dados" nas reviews
- > 5% das ativações perguntando "vocês guardam minha senha?"

Plano de contingência:
1. Antes do beta: vídeo de 90s mostrando exatamente o que o Open Finance
   acessa e NÃO acessa — exibido na tela ANTES da conexão bancária
   (não como modal opcional)
2. Se alerta disparar: adicionar "Modo Manual" como alternativa —
   registro de transações sem Open Finance
3. Página /seguranca pública com diagrama visual do fluxo de dados +
   certificações + botão funcional de exclusão de dados (LGPD Art. 18)
4. Parceria editorial com finfluencer de alta credibilidade para validação
   pública antes do lançamento — não como anúncio pago, como review editorial
5. SLA público de resposta a incidentes (24h)

Responsável: Fundador. Monitorar: funil de onboarding etapa a etapa
no PostHog, atualizado semanalmente.
```

---

### Risco 2 — Regulatório (LGPD + Banco Central)

```
Probabilidade: Média | Impacto: Alto

Sinal de alerta:
- Consulta pública do Banco Central sobre Open Finance com prazo < 90 dias
- Parceiro de Open Finance comunica mudança de API
- Autuação de ANPD contra fintech com modelo similar

Plano de contingência:
1. Antes do lançamento: contratar advogado especializado em regulação
   fintech para revisão da arquitetura de dados e termos de uso.
   Budget: R$3.000–8.000 (não opcional — é bloqueador de produto)
2. Assinar newsletter do Banco Central e participar de fórum da ABES/
   Fintechlab para acesso antecipado a consultas públicas
3. Arquitetura de contingência: camada de abstração entre Open Finance
   e features do app → "modo manual" como fallback imediato sem
   refatoração total da UI
4. Se Open Finance bloquear: pivotar para importação OFX/CSV enquanto
   a regularização é resolvida
5. Todos os consentimentos documentados e auditáveis (timestamp, versão
   do termo, IP) em tabela separada de audit log — não opcional

Responsável: Fundador. Revisão regulatória trimestral com advogado
contratado. Custo anual: R$6.000–15.000.
```

---

### Risco 3 — CAC alto vs. orçamento bootstrapped

```
Probabilidade: Alta | Impacto: Alto

Sinal de alerta:
- CAC calculado nos primeiros 3 meses > R$80
- LTV:CAC ratio < 2:1 após 6 meses
- Conversão trial/freemium → pago < 3%

Plano de contingência:
1. Estratégia primária: crescimento 100% orgânico e referral nos
   primeiros 6 meses. Zero paid ads antes de LTV:CAC > 3:1.
2. Programa de referral bilateral: casal que convida outro casal ganha
   1 mês grátis no Pro. É o canal principal de aquisição, não feature
   secundária — implementar no MVP.
3. Se CAC > R$80 no paid: pausar imediatamente. Analisar qual etapa
   do funil converte mal antes de reativar gasto.
4. Parceria com cursos de finanças para casais (Hotmart, Eduzz)
   como distribuição com revenue share de 20–30% do plano Pro.
5. Product-led growth: "momento aha" (ver pela primeira vez quanto os
   dois gastam juntos categorizado) deve acontecer ANTES de pedir cartão.

Responsável: Fundador. Monitorar: CAC por canal, LTV projetado por
coorte de ativação mensalmente.
```

---

### Risco 4 — Churn por separação de casais

```
Probabilidade: Média | Impacto: Médio

Sinal de alerta:
- Taxa de "desconexão de parceiro" no app > 8% ao mês
- Churn em cluster (dois usuários cancelando no mesmo dia) > 5%
  das ativações mensais

Plano de contingência:
1. Feature de transição "Modo Solo": quando parceiro desconecta,
   oferecer imediatamente continuação com dados históricos pessoais
   e uso como gestor financeiro individual
2. Pricing do modo Solo: 50% do plano atual por 3 meses como transição
3. Comunicação proativa: email empático ao detectar desconexão.
   Não perguntar o motivo. Apenas oferecer o caminho para continuar.
4. Design: nunca usar linguagem que torne o produto irrecuperável para
   um único usuário. Preferir "Conta compartilhada" (tornável privada)
   a "Conta do casal" (sem saída).

Responsável: Fundador. Métrica: "churn duplo simultâneo" como evento
separado no analytics, monitorado mensalmente.
```

---

### Risco 5 — Baixa adoção de um dos parceiros

```
Probabilidade: Alta | Impacto: Alto

Sinal de alerta:
- Taxa de "convite aceito" < 50% dos pares iniciados
- Tempo entre convite enviado e parceiro ativo > 72 horas
- Sessões de usuário solo > 40% das sessões totais após D+7

Plano de contingência:
1. Fluxo de convite como produto: mensagem personalizada gerada pelo
   app — "João te convidou para ver juntos que vocês gastaram R$X em
   [categoria] esse mês". Usa dado real do usuário que convida para
   criar curiosidade imediata.
2. Preview para o parceiro convidado: landing page personalizada com
   dados agregados (sem transações individuais) do casal. Ele vê o
   valor ANTES de baixar o app.
3. Onboarding assíncrono: produto entrega valor mesmo com apenas um
   usuário ativo enquanto espera o parceiro (projeção de economias
   se o parceiro entrar, benchmark de casais similares).
4. Se parceiro não ativa em 7 dias: sequência de 3 notificações push/
   email para o usuário primário com sugestões de abordagem.
5. Modo solo temporário: usar o app por até 30 dias sozinho com flag
   visual "aguardando parceiro". Após 30 dias sem parceiro, oferecer
   downgrade gracioso para plano pessoal.

Responsável: Fundador. Métrica-chave: "par completamente ativo" (ambos
com >= 1 sessão nos últimos 7 dias) como KPI de ativação principal.
```

---

### Risco 6 — Privacidade intra-casal como barreira

```
Probabilidade: Alta | Impacto: Alto

Sinal de alerta:
- Drop > 35% na tela de "o que será compartilhado com seu parceiro"
- Pesquisa qualitativa retorna menções a "privacidade" ou "medo de
  o parceiro ver" nas sessões de entrevista

Plano de contingência:
1. Design primário: controle granular de privacidade é feature CORE
   — mostrar explicitamente no onboarding, antes da conexão bancária:
   "Você controla o que seu parceiro vê."
   - Categorias que compartilha (você decide quais)
   - Contas que compartilha (pode manter conta pessoal privada)
   - Parceiro vê TOTAIS, não transações individuais (default)
2. "Conta Pessoal Privada": conta bancária marcada como privada —
   aparece nos seus totais pessoais mas não no painel compartilhado
3. Messaging proativo: "Vocês decidem juntos o que compartilham"
   — não "transparência total". Autonomia, não vigilância.
4. A/B test imediato se métrica de drop disparar: texto vs. vídeo
   vs. diagrama interativo na tela de explicação de privacidade.
```

---

### Risco 7 — Concorrente grande entra no segmento

```
Probabilidade: Média (24 meses) / Alta (36+ meses) | Impacto: Alto

Sinal de alerta:
- Job posting de banco/fintech grande para "PM — shared finances"
- Feature leak ou beta não anunciado na loja de apps
- Artigo de imprensa "Nubank estuda feature de casal"

Plano de contingência:
1. Resposta estratégica: não competir em feature parity. Aprofundar
   o que o banco não pode fazer — a camada de relação (metas, gamificação,
   hábitos, rotina). Banco é instituição financeira; produto de casal
   é experiência emocional.
2. Narrativa de PR antecipada: "O [Produto] é para casais o que o
   Duolingo é para idiomas — não é o banco, é a experiência que você
   quer viver." Ter esse ângulo pronto para usar imediatamente.
3. Acelerar roadmap de expansão: quanto mais verticals ativas, mais
   difícil para um banco copiar o produto inteiro.
4. Focar em NPS > 60: usuários que amam o produto são o melhor escudo
   competitivo. Se NPS > 60, os usuários defenderão publicamente.
5. Parceria como alternativa: avaliar parceria de distribuição
   (white-label ou API) antes de tratar como ameaça pura.

Responsável: Google Alerts para "finanças casal app". Revisão
competitiva trimestral.
```

---

### Risco 8 — Parceiro de Open Finance muda preços ou encerra

```
Probabilidade: Média | Impacto: Alto

Plano de contingência:
1. Desde o início: implementar adapter pattern — camada de abstração
   que permite trocar o provider sem reescrever a lógica do produto.
   Custo de dev: +20% no sprint. Custo de não fazer: refatoração total.
2. Contratos com cláusula de saída de 90 dias e preço fixo por 12 meses.
3. Integrar Pluggy E Belvo com fallback automático via adapter.
   Se um cai, o outro assume.
4. Se parceiro encerrar sem aviso: ativar "modo manual" (importação OFX/CSV)
   como feature de emergência. Comunicar com transparência total e prazo
   de 30 dias para restauração.
5. Avaliar integração direta com Banco Central em Q3–Q4 quando volume
   justificar o custo de compliance e certificação.
```

---

### Risco 9 — Produto não encontra PMF nos primeiros 6 meses

```
Probabilidade: Média | Impacto: Alto

Sinal de alerta:
- Retenção D7 < 40% ao final do mês 2 de beta
- NPS < 25 em duas pesquisas consecutivas
- Sean Ellis test: "muito desapontado" < 40% dos respondentes
- Casais ativos (ambos) < 30% da base ao final de 60 dias

Plano de contingência:
1. Diagnóstico ANTES de pivotar: entrevistar 20 casais que churnam
   e 20 que ficam. Não pular esta etapa — pivôs sem entrevistas são apostas.
2. Pivôs ordenados por custo:
   a) Pivô de messaging (mais barato): mesmo produto, muda a comunicação.
      Testar 3 frames: "economize juntos", "pare de brigar por dinheiro",
      "alcancem seus sonhos"
   b) Pivô de onboarding (médio): simplificar para o mínimo. Testar
      sem Open Finance (valor menor, fricção menor)
   c) Pivô de use case (mais caro): se finanças não é o problema principal,
      app de hábitos do casal pode ser o produto real, com finanças como módulo
3. Definir "linha de corte" ANTES do beta começar: se em 6 meses NPS < 30
   E retenção D30 < 25% E conversão pago < 2% — 30 dias para decidir entre
   pivotar ou encerrar. Critério pré-definido evita viés de otimismo.
4. Preservar runway: manter >= 6 meses de runway pessoal antes de iniciar o beta.

Dashboard de PMF: atualizado semanalmente com D7/D30 retention, NPS,
conversão pago, Sean Ellis test.
```

---

### Risco 10 — Viralidade negativa (bug expõe dados financeiros)

```
Probabilidade: Baixa | Impacto: Alto (existencial)

Sinal de alerta:
- Relatório de bug via responsible disclosure
- Post viral com print de dados financeiros de outro usuário
- Aumento anormal de requisições de API em horário fora do pico
- Tickets de suporte com "vi dados de outra pessoa"

Plano de contingência:
1. Antes do beta: pentest obrigatório (R$5.000–15.000) com foco em
   autenticação, isolamento de dados por casal, endpoints Open Finance
   e gestão de tokens. Não é opcional.
2. Plano de crise documentado ANTES de precisar:
   - Quem anuncia: sempre o fundador(a), nunca o suporte
   - Em quanto tempo: dentro de 2 horas da confirmação do incidente
   - Templates de comunicação já escritos e aprovados
3. Se incidente ocorrer:
   a) Desativar a feature afetada imediatamente
   b) Notificar usuários afetados individualmente com detalhe exato
   c) Contratar DPO para notificação à ANPD (prazo LGPD: 72h)
   d) Post-mortem público em 7 dias
4. Responsible Disclosure Program ativo: /security com email dedicado
   e prazo de resposta de 48h
5. Bug bounty simbólico (R$200–500 por vulnerabilidade crítica) para
   incentivar disclosure responsável

Exercício de simulação de crise: uma vez por trimestre.
```

---

## SEÇÃO 10 — Roadmap de Produto Alinhado ao GTM

### Critérios de Priorização

**ATIVAÇÃO (prioridade máxima — Q1 e Q2):** sem ativação, nenhuma outra métrica existe. Para produto de casal, ativação = "ambos os parceiros conectaram banco e viram o primeiro relatório juntos". Qualquer feature que aumenta a taxa de par completamente ativo em > 5% entra antes de qualquer feature de retenção.

**RETENÇÃO (alta — Q2 e Q3):** reter é mais barato que adquirir. D30 < 25% indica que o produto não criou hábito. Features de retenção entram quando ativação > 50% e primeiras 100 pairs ativas mostram padrão semanal.

**CONVERSÃO (alta — Q2 e Q3):** freemium sem conversão é produto gratuito. Só faz sentido construir velvet rope após saber quais features o usuário mais valoriza (dado do beta).

**NOVO SEGMENTO (baixa — Q4+):** expansão antes de PMF no core é o erro mais comum. Hard rule: nenhuma feature de novo segmento entra antes de Q3.

---

### Tabela de Roadmap (24 meses)

| Trimestre | Feature | Por que agora (GTM reason) | Impacto esperado | Métrica |
|-----------|---------|---------------------------|-----------------|---------|
| **Q1** | Onboarding de par com Open Finance (< 5 min) | Feature existencial. Cada minuto a mais custa ~15% de conclusão. | Ativação de par > 50% | Par ativo D7 |
| **Q1** | Dashboard compartilhado: totais por categoria + saldo conjunto | Primeiro "momento aha". Razão pela qual o usuário indicará o produto. | NPS > 30 no beta | NPS, sessões semanais |
| **Q1** | Sistema de convite com preview personalizado (dados reais do casal) | Parceiro precisa ver valor ANTES de instalar. Convite com dado real converte > 50% vs. < 20% convite genérico. | Conversão de convite > 50% | Taxa de par ativo / convite enviado |
| **Q1** | Controle de privacidade granular (conta privada, categoria oculta) | Barreira #1 de onboarding. Sem isso, 49% dos usuários potenciais não conectam banco. | Queda no drop do onboarding | Conclusão de onboarding > 60% |
| **Q1** | Programa de referral bilateral (1 mês grátis por casal convidado) | Canal principal de aquisição bootstrapped. Crescimento orgânico desde D0. | K-factor > 0.5 | Casais adquiridos por referral |
| **Q2** | Metas financeiras conjuntas (viagem, apartamento, fundo de emergência) | Sem meta, usuário deixa de abrir o app após ver o dashboard 3 vezes. Meta cria recorrência semanal. | D30 retention +8pp | Retenção D30, sessões semanais |
| **Q2** | Alertas e notificações inteligentes (gasto acima da média, meta atingida) | Retorno ao app sem depender da memória do usuário. Principal driver de DAU em apps de finanças pessoais. | DAU/MAU > 0.3 | DAU/MAU |
| **Q2** | Velvet rope Pro (relatórios históricos + categorias personalizadas) | Com dados do beta, já sabemos quais features os usuários mais pedem. Ativar paywall nas top 2–3. Meta: 5% de conversão. | Conversão pago > 5% | MRR |
| **Q2** | Modo Solo (parceiro inativo ou separação) | Reter usuário mesmo quando parceiro desconecta. Evitar churn duplo. | Redução de churn duplo em 40% | Churn por desconexão |
| **Q3** | Relatório mensal compartilhado (PDF exportável) | Feature de conversão Pro + ferramenta de indicação. Casais que compartilham o relatório são o canal de maior LTV. | MRR +3pp, referrals orgânicos | MRR |
| **Q3** | Gamificação: streaks, conquistas conjuntas, ranking mensal | D90 retention sem gamificação < 15%; com gamificação sobe para 25–35%. Referência: Duolingo (D30 = 47%). | D90 retention > 25% | D90 retention |
| **Q3** | Benchmark anônimo vs. casais similares | Dado contextual que faz o usuário retornar ao app para se comparar. Alto engajamento, baixo custo de implementação. | +20% em sessões mensais | Sessões/usuário/mês |
| **Q3** | Tier Família (R$49,90) — até 3 adultos + filho > 18 | Expansão de segmento adjacente. ARPU sobe R$15 sem custo de aquisição adicional. | ARPU +R$15 | ARPU, MRR |
| **Q4** | Hábitos financeiros do casal (check-in semanal, desafios mensais) | Gatilho: NPS > 50 e D90 > 30% no core. Primeira expansão vertical. Upsell para Pro+. | ARPU +R$10, D90 +5pp | ARPU, retenção |
| **Q5** (M13–15) | Rotina do casal: planejamento semanal e tarefas domésticas | 30% dos usuários usam metas para organizar rotina não-financeira (signal nos dados de uso). | ARPU +R$12 | ARPU, expansão de mercado |
| **Q5** | Marketplace financeiro: CDB, seguro residencial (comissão) | Ativar apenas quando NPS > 55 e base > 5.000 pagantes. | Nova linha de receita (15–20% do MRR) | Revenue por canal |
| **Q6** (M16–18) | Treinos compartilhados: metas físicas do casal | Gatilho: engajamento em hábitos > 40% da base ativa. Add-on R$9,90/mês. | ARPU +R$10 | ARPU, retenção multi-vertical |
| **Q7–Q8** (M19–24) | Dieta e nutrição conjunta | Gatilho: base > 10.000 casais, NPS > 55, feature request > 500 casais. | ARPU +R$8 | ARPU |
| **Q8** (M22–24) | Coaching de relacionamento (conteúdo + sessões ao vivo) | Referência: Lasting (US$29,99/mês). Maior ARPU potencial. Tier premium R$89,90–149,90. | ARPU potencial +R$40–80 | ARPU, LTV por coorte |

---

### MVP Mínimo para o Beta

**Incluso (sem isso o teste não é válido):**

| Feature | Justificativa |
|---------|--------------|
| Cadastro + criação de conta do casal | Estrutural |
| Fluxo de convite com preview personalizado | Testar hipótese central: parceiro ativa quando vê dado real antes de instalar? |
| Conexão bancária via Open Finance (1 banco por usuário no beta) | Testar diferencial técnico. Se onboarding < 5 min não funciona no beta, não funciona no lançamento. |
| Dashboard compartilhado: saldo total + gastos por categoria (últimos 30 dias) | O "momento aha" — sem isso não há como medir se o produto entrega valor |
| Controle de privacidade básico (conta privada, categoria oculta) | Bloqueador de adoção identificado. Não pode ficar para depois. |
| Notificação de convite pendente (push + email) | Sem isso, o parceiro não ativa. |
| Feedback in-app (NPS + pergunta aberta) | O beta existe para coletar dados. |

**Excluído do beta:**

| Feature | Justificativa |
|---------|--------------|
| Metas conjuntas | Feature de retenção, não de prova de ativação |
| Gamificação | Beta é curto demais para medir o efeito de longo prazo |
| Plano pago | Paywall distorce dados de ativação. O objetivo é aprender, não monetizar. |
| Multi-banco por usuário | Testar com 1 banco valida o fluxo. Multi-banco entra pós-beta. |
| Hábitos, rotina, treinos, dieta, coaching | Fora de escopo até PMF financeiro ser validado |

---

### Expansão Vertical — Estratégia de Módulos

| Vertical | Gatilho | Como apresentar | ARPU esperado | Risco | Referência |
|----------|---------|----------------|--------------|-------|-----------|
| **Hábitos financeiros** | NPS > 50 + D90 > 30% + 40% dos usuários pedem | Dentro do Pro (sem custo adicional), depois vira Pro+ | +R$10 (via novo tier) | Baixo — ainda são finanças | Qapital, Honeydue Goals |
| **Rotina e hábitos do casal** | 30% dos usuários usam metas para tarefas não-financeiras | Add-on R$9,90/mês | +R$9,90 | Médio-alto — mudança de categoria | Paired (US, 8M downloads) |
| **Treinos compartilhados** | Hábitos com DAU/MAU > 0.25 por 2 trimestres | Add-on R$9,90/mês ou integrado em tier "Vida Completa" | +R$9,90 | Médio-alto — categoria diferente | Strava (social), Couples App |
| **Dieta e nutrição** | Base > 10.000 casais, NPS > 55, compliance de dados de saúde mapeado | Add-on R$8,90/mês | +R$8,90 | Alto — categoria de saúde | Yazio (25M usuários), Cronometer |
| **Coaching de relacionamento** | Base > 15.000 casais, NPS > 60, 3+ terapeutas parceiros | Tier premium separado R$89,90–149,90/mês | +R$40–80 | Médio — qualidade dos coaches determina NPS | Lasting ($29,99/mês, 4M usuários) |

---

### Monetização Adicional no Longo Prazo

**1. Marketplace Financeiro (ativar em Q5–Q6)**
- Produtos: CDB, seguro residencial, previdência (comissão por produto vendido)
- Regras de não comprometer confiança: disclosure completo, curadoria de 2–3 produtos por categoria (não marketplace aberto), opt-out fácil, dados nunca usados para targeting sem consentimento explícito
- Revenue potencial com 5.000 casais: R$80.000–200.000/ano (~15–30% do MRR de assinaturas)

**2. Coaching ao Vivo (ativar em Q7–Q8)**
- Modelo: 30% take rate por sessão. Coach recebe 70%.
- Revenue potencial: 200 casais × 1 sessão/mês × R$75 take rate = R$15.000/mês adicional
- Regra: publicar o split de forma transparente. Coaches verificados e certificados publicamente.

**3. Dados Anonimizados B2B (nunca antes de 20.000 casais ativos + NPS > 65)**
- Compradores: institutos de pesquisa, universidades, fintechs, seguradoras
- Nunca: partidos políticos, empresas de crédito para scoring individual
- Hard rule: não ultrapassar 10% do revenue total. Manter incentivo de produto intacto.
- Revenue potencial: R$50.000–200.000/ano com 20.000 casais

---

> **Regra de ouro do roadmap:** nunca trabalhar em mais de 2 features simultaneamente. Em caso de dúvida, voltar para a pergunta: "isso aumenta a chance de ambos os parceiros abrirem o app essa semana?" Se a resposta for não, a feature espera.

---

*Documento gerado em 2026-05-30 via skill `go-to-market-engineer.md`*
*5 agentes paralelos | 10 seções | ~50.000 tokens de análise*
