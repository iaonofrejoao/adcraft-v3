# AdCraft v3 — Mapa de Agentes e Fluxos de Interação

## Visão Geral do Pipeline

```mermaid
flowchart TD
    USER(["Usuário\n▶ product_id"])

    subgraph F1["── FASE 1: PESQUISA ──"]
        direction TB
        A1["**1. VSL Analysis**\n→ artefato: product"]
        A2["**2. Market Research**\n→ artefato: market"]
        A3["**3. Avatar Research**\n→ artefato: avatar"]
        A5["**5. Benchmark Intelligence**\n→ artefato: benchmark"]
        A4["**4. Angle Generator**\n→ artefato: angles"]
        A6["**6. Campaign Strategy**\n→ artefato: campaign_strategy"]
    end

    subgraph F2["── FASE 2: CRIATIVO ──"]
        direction TB
        A8["**8. Copywriting**\n→ artefato: copy_components"]
        A7["**7. Script Writer**\n→ artefato: script"]
        A9["**9. Character Generator**\n→ artefato: character"]
        A10["**10. Keyframe Generator**\n→ artefato: keyframes"]
        A12["**12. Creative Director**\n→ artefato: creative_brief"]
        A11["**11. Video Maker**\n→ artefato: video_assets"]
    end

    subgraph F3["── FASE 3: LANÇAMENTO ──"]
        direction TB
        A13["**13. Compliance Check**\n→ artefato: compliance_results"]
        A14["**14. UTM Builder**\n→ artefato: utms"]
        A15["**15. Facebook Ads**\n→ artefato: facebook_ads"]
        A16["**16. Google Ads**\n→ artefato: google_ads"]
        A17["**17. Performance Analysis**\n→ artefato: performance_report"]
        A18["**18. Scaling Strategy**\n→ artefato: scaling_plan"]
    end

    USER --> A1
    A1 --> A2 & A3
    A1 --> A5
    A2 --> A5
    A2 & A3 & A5 --> A4
    A1 --> A4
    A4 & A2 & A3 & A5 --> A6
    A1 --> A6

    A6 --> A8 & A7 & A9
    A3 & A4 --> A8
    A4 & A3 & A1 --> A7
    A3 & A4 & A1 --> A9
    A7 & A9 --> A10
    A6 --> A10
    A8 & A7 & A9 & A10 --> A12
    A3 & A4 & A6 --> A12
    A7 & A10 & A12 & A8 & A1 --> A11

    A12 --> A13 & A14
    A8 & A1 --> A13
    A6 & A1 --> A14
    A13 & A14 --> A15 & A16
    A6 & A8 --> A15
    A6 & A2 & A1 & A3 --> A16
    A15 & A16 --> A17
    A6 & A12 --> A17
    A17 --> A18
    A6 & A3 & A5 --> A18
```

---

## Fase 1 — Pesquisa (Detalhado)

```mermaid
flowchart LR
    IN(["VSL URL\nProduto\nNicho"])

    IN --> VSL

    VSL["**VSL Analysis** #1\nLê landing page\nExtrai: promise, mecanismo,\ndores, oferta, prova social"]

    VSL -->|product| MR["**Market Research** #2\nMargem bruta\nGoogle Trends\nFB Ad Library\nViability score 0-100"]

    VSL -->|product| AR["**Avatar Research** #3\nYouTube reviews\nFóruns / Reddit\nReclameAqui\nVerbatim expressions"]

    VSL & MR -->|product + market| BI["**Benchmark Intelligence** #5\nFB Ad Library\nGoogle Transparency\nVSLs dos concorrentes\nMarket gaps"]

    VSL & MR & AR & BI -->|product + market\n+ avatar + benchmark| AG["**Angle Generator** #4\nÂngulo lateral vs concorrência\nUSP tangível\n3 hooks (H1/H2/H3)"]

    AG & MR & AR & BI & VSL -->|todos os artefatos| CS["**Campaign Strategy** #6\nPlataforma primária\nPúblicos (frio/morno/quente)\nBudget + KPIs\nLaunch sequence 4 fases"]
```

---

## Fase 2 — Criativo (Detalhado)

```mermaid
flowchart TD
    CS(["campaign_strategy\navatar · angles\nproduct"])

    CS -->|avatar · angles\ncampaign_strategy| CW["**Copywriting** #8\n3 Hooks (H1/H2/H3)\n3 Bodies (B1/B2/B3)\n3 CTAs (C1/C2/C3)\nTags: SKU_v1_H1..."]

    CS -->|angles · avatar\ncampaign_strategy · product| SW["**Script Writer** #7\nFramework: PAS/AIDA/StoryLoop\n5–7 cenas com timing\nNarração + direção visual\ncopy_combination_id"]

    CS -->|avatar · product\nangles| CG["**Character Generator** #9\nPapel: testimonial/narrator/actor\nDescrição física\nPrompts Midjourney + VEO 3"]

    SW & CG -->|script · character\ncampaign_strategy| KG["**Keyframe Generator** #10\nPrompt VEO 3 por cena\nAngulo de câmera\nMovimento + iluminação\ncharacter_anchor fixo"]

    CW & SW & CG & KG -->|todos os criativos| CD["**Creative Director** #12\nScore 0-100 (4 dimensões)\nRanqueia top 3 combinações\nAprova ou bloqueia\napproved_for_production"]

    CD -->|creative_brief\nscript · keyframes\ncopy · product| VM["**Video Maker** #11\nStoryboard de produção\nSubtítulos PT-BR\nÁudio config\nQuality checklist"]
```

### Loops de Revisão (Fase 2)

```mermaid
flowchart LR
    CD{"Creative Director\nscore < 50?"}
    CD -->|aprovado| F3["→ Fase 3"]
    CD -->|bloqueado\n1ª vez| RE1["Refaz agente\nbloqueado"]
    RE1 --> CD
    CD -->|bloqueado\n2ª vez| RE2["Refaz agente\nbloqueado"]
    RE2 --> CD
    CD -->|bloqueado\n3ª vez| ESC["Escalona\npara usuário"]
```

---

## Fase 3 — Lançamento (Detalhado)

```mermaid
flowchart TD
    CD(["creative_brief\ncopy_components\nproduct"])

    CD -->|copy · product\ncreative_brief| CC["**Compliance Check** #13\nANVISA + FB + Google\nApproved/rejected por tag\napproved_combinations HxBxC"]

    CD & CS2(["campaign_strategy\nproduct"]) -->|creative_brief\ncampaign_strategy · product| UTM["**UTM Builder** #14\nConvenção: SKU_obj_AAAAMM\nUTM por plataforma\nURLs rastreadas testáveis"]

    CC & UTM -->|approved_combinations\nutms · campaign_strategy\ncopy| FB["**Facebook Ads** #15\nCBO/ABO\nAd Sets por público\nAnúncios só de copy aprovada\nPixel checklist"]

    CC & UTM -->|approved_combinations\nutms · market · product\navatar| GA["**Google Ads** #16\nSearch / Video / Display\nKeywords 3 camadas\nRSA headlines + descriptions\nExtensões"]

    FB & GA -->|dados reais\n(após 7+ dias)| PA["**Performance Analysis** #17\n4 níveis de diagnóstico\nClassifica: winner/testing/loser\nRecomendações priorizadas"]

    PA -->|performance_report\ncampaign_strategy\navatar · benchmark| SS["**Scaling Strategy** #18\nVertical (budget +20-30%)\nHorizontal (novos públicos)\nStop-loss criteria\nTimeline semanal"]
```

### Loop de Compliance (Fase 3)

```mermaid
flowchart LR
    CC{"top_combination\naprovada?"}
    CC -->|sim| ADS["→ Facebook Ads\n   Google Ads"]
    CC -->|não| NEXT["Usa próxima de\ncombinations_ranked"]
    NEXT --> CC2{"Existe combinação\naprovada?"}
    CC2 -->|sim| ADS
    CC2 -->|não| PAUSE["Pipeline pausa\nAguarda usuário"]
```

---

## Agentes Extras (Fora do Pipeline Principal)

```mermaid
flowchart LR
    TIK(["Vídeos TikTok\naprovados pelo usuário"])
    TIK --> UGC["**UGC Analyzer**\nGemini Vision\nExtrai: hook_type, visual_style,\nangle_inspiration\n→ ugc_reference"]
    UGC -->|busca vetorial| AG["Angle Generator #4\nBenchmark Intelligence #5"]

    PIPE(["≥ 5 execution_learnings\nvalidados"])
    PIPE --> NC["**Niche Curator**\nConsolida learnings por categoria\nAtualiza confiança\nAposenta learnings obsoletos\n→ niche_learnings (Supabase)"]
    NC -->|learnings do nicho| NEXT_PIPE["Próximos pipelines\ndo mesmo nicho"]
```

---

## Matriz de Artefatos

| # | Agente | Artefato produzido | Consumido por |
|---|--------|--------------------|---------------|
| 1 | VSL Analysis | `product` | 2, 3, 4, 5, 6, 7, 9, 11, 13, 14, 16 |
| 2 | Market Research | `market` | 4, 5, 6, 16, 18 |
| 3 | Avatar Research | `avatar` | 4, 6, 7, 8, 9, 12, 16, 18 |
| 5 | Benchmark Intelligence | `benchmark` | 4, 6, 18 |
| 4 | Angle Generator | `angles` | 6, 7, 8, 9, 12 |
| 6 | Campaign Strategy | `campaign_strategy` | 7, 8, 9, 10, 12, 14, 15, 16, 17, 18 |
| 8 | Copywriting | `copy_components` | 11, 12, 13, 15 |
| 7 | Script Writer | `script` | 10, 11, 12 |
| 9 | Character Generator | `character` | 10, 11 |
| 10 | Keyframe Generator | `keyframes` | 11, 12 |
| 12 | Creative Director | `creative_brief` | 11, 13, 14, 15, 17 |
| 11 | Video Maker | `video_assets` | _(output final)_ |
| 13 | Compliance Check | `compliance_results` | 15, 16 |
| 14 | UTM Builder | `utms` | 15, 16 |
| 15 | Facebook Ads | `facebook_ads` | 17 |
| 16 | Google Ads | `google_ads` | 17 |
| 17 | Performance Analysis | `performance_report` | 18 |
| 18 | Scaling Strategy | `scaling_plan` | _(output final)_ |

---

## Regras Críticas de Fluxo

```mermaid
flowchart TD
    R1["REGRA 1\nMercado-alvo obrigatório\ntarget_country + target_language\ninjetados em TODOS os agentes"]
    R2["REGRA 2\nCopy aprovada\nFB Ads e Google Ads usam\nEXCLUSIVAMENTE\ncompliance_results.approved_combinations"]
    R3["REGRA 3\nDiferenciação obrigatória\nangle_generator NUNCA replica\nbenchmark.winning_angles_in_market"]
    R4["REGRA 4\nFontes reais exigidas\nmarket, avatar, benchmark\nrequerem WebSearch/WebFetch\nNUNCA inventar números"]
    R5["REGRA 5\nQualidade de vídeo\ncenas script = keyframes\nsubtítulos em PT-BR\nprompts VEO 3 em inglês"]
```

---

## Paralelismo de Execução

```mermaid
gantt
    title Ordem de execução dos agentes
    dateFormat X
    axisFormat Agente %s

    section Fase 1
    1 - VSL Analysis         :a1, 0, 1
    2 - Market Research      :a2, after a1, 1
    3 - Avatar Research      :a3, after a1, 1
    5 - Benchmark Intel.     :a5, after a2, 1
    4 - Angle Generator      :a4, after a5, 1
    6 - Campaign Strategy    :a6, after a4, 1

    section Fase 2
    7 - Script Writer        :a7, after a6, 1
    8 - Copywriting          :a8, after a6, 1
    9 - Character Generator  :a9, after a6, 1
    10 - Keyframe Generator  :a10, after a7, 1
    12 - Creative Director   :a12, after a10, 1
    11 - Video Maker         :a11, after a12, 1

    section Fase 3
    13 - Compliance Check    :a13, after a12, 1
    14 - UTM Builder         :a14, after a12, 1
    15 - Facebook Ads        :a15, after a13, 1
    16 - Google Ads          :a16, after a13, 1
    17 - Performance Anal.   :a17, after a15, 1
    18 - Scaling Strategy    :a18, after a17, 1
```
