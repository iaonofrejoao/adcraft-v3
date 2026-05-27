# Plano de Execução — Geração de Vídeo AdCraft v3

> Última atualização: 2026-05-25
> Objetivo: produzir criativos de vídeo 9:16, 30-45s, qualidade profissional para tráfego pago no Facebook.

---

## Visão geral

O sistema combina três fontes de conteúdo visual:
1. **Persona com lip sync** — avatar gerado por IA que fala o script diretamente para a câmera (estilo UGC creator)
2. **Cenas 3D / gráficas** — geradas por IA quando o storyboard indicar, com narração em VO
3. **UGC do TikTok** — vídeos reais de pessoas usando o produto, aprovados manualmente pelo usuário

O usuário dispara a geração por combinação de copy (Hook + Body + CTA) clicando em **"Gerar Vídeo"** na tela de copies. A aba **"Criativos"** exibe a fila, o progresso e os vídeos prontos.

---

## Toolchain — decisões finais

| Função | Ferramenta | Observação |
|--------|-----------|------------|
| Geração de fotos da persona | **Flux 1.1 Pro** via Replicate | 6 poses (frente, 3/4, close) |
| Avatar falando (lip sync) | **HeyGen** | Upload das fotos → avatar customizado → `heygen_avatar_id` |
| Voz da persona | **ElevenLabs** | Vozes pré-construídas (sem clonagem), escolha por perfil (gênero, sotaque, energia) |
| Cenas 3D / animadas | **Kling AI** | Image-to-video ou text-to-video conforme storyboard |
| VO nas cenas 3D | **ElevenLabs** | Chamada separada da voz da persona |
| Scraping TikTok | **yt-dlp** | Por hashtag + palavra-chave do nicho |
| Scoring de UGC | **Gemini Vision** | Analisa thumbnail + descrição, pontua aderência 0–1 |
| Composição final | **FFmpeg + MoviePy** | Ordena cenas, mixagem de áudio, overlays |
| Legendas karaoke | **faster-whisper** | Word-level timing, bold branco + stroke preto |
| Música de fundo | Biblioteca local (Epidemic Sound / Pixabay) | Copyright-free, ducking automático a -18dB |

---

## Estrutura do criativo (template 30-45s, 9:16)

```
0s  – 3s   HOOK VISUAL
           Persona olha direto para câmera, frase de impacto.
           Corte abrupto. Música entra junto.

3s  – 12s  AGITAÇÃO DO PROBLEMA
           Persona falando (HeyGen lip sync).
           Intercala com UGC clip 1 como B-roll.

12s – 25s  SOLUÇÃO + DEMONSTRAÇÃO
           Cena 3D do produto (Kling + VO ElevenLabs).
           UGC clip 2 (pessoa usando o produto).
           Persona reage / valida.

25s – 35s  PROVA SOCIAL
           UGC clips 3-4 (resultados reais).
           Texto overlay: depoimentos, números, resultados.

35s – 42s  CTA DIRETO
           Persona fala CTA + urgência.
           Última tela: produto + link.
```

---

## Banco de dados — novas tabelas

```sql
-- Setup visual/vocal da persona (criado 1x por produto)
CREATE TABLE persona_assets (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id          UUID REFERENCES products(id) ON DELETE CASCADE,
  pipeline_id         UUID REFERENCES pipelines(id),
  photos              JSONB,            -- array de URLs das 6 fotos geradas pelo Flux
  heygen_avatar_id    TEXT,             -- ID do avatar no HeyGen
  elevenlabs_voice_id TEXT,             -- ID da voz escolhida no ElevenLabs
  status              TEXT DEFAULT 'creating', -- 'creating' | 'ready' | 'failed'
  error_message       TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  completed_at        TIMESTAMPTZ
);

-- Vídeos coletados do TikTok (UGC)
CREATE TABLE tiktok_videos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       UUID REFERENCES products(id) ON DELETE CASCADE,
  tiktok_url       TEXT NOT NULL,
  tiktok_video_id  TEXT,
  author_handle    TEXT,
  description      TEXT,
  views_count      INTEGER,
  likes_count      INTEGER,
  relevance_score  DECIMAL(3,2),       -- score Gemini Vision 0.00–1.00
  status           TEXT DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  local_path       TEXT,               -- caminho do arquivo baixado
  thumbnail_url    TEXT,
  duration_seconds INTEGER,
  created_at       TIMESTAMPTZ DEFAULT now(),
  reviewed_at      TIMESTAMPTZ
);

-- Vídeos finais por combinação de copy
CREATE TABLE final_videos (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id           UUID REFERENCES products(id) ON DELETE CASCADE,
  pipeline_id          UUID REFERENCES pipelines(id),
  copy_combination_id  UUID NOT NULL,   -- referência ao hook+body+cta
  status               TEXT DEFAULT 'queued',
    -- 'queued' | 'generating_persona' | 'generating_scenes'
    -- | 'processing_ugc' | 'composing' | 'adding_captions' | 'ready' | 'failed'
  progress_step        TEXT,            -- usado para barra de progresso no frontend
  video_url            TEXT,            -- URL pública do vídeo final
  thumbnail_url        TEXT,
  duration_seconds     DECIMAL(5,2),
  composition_config   JSONB,           -- ordem das cenas, clipes usados, config de pacing
  error_message        TEXT,
  created_at           TIMESTAMPTZ DEFAULT now(),
  completed_at         TIMESTAMPTZ
);
```

---

## Novos agents / scripts

### Skills de agentes

```
.claude/skills/agents/
  ├── persona-visual-generator.md   # Flux (fotos) + HeyGen (avatar) + ElevenLabs (voz)
  ├── ugc-scraper.md                 # yt-dlp + Gemini Vision scoring
  ├── scene-generator.md             # HeyGen (persona falando) + Kling (cenas 3D)
  └── video-compositor.md            # FFmpeg: monta, mixa áudio, legenda, exporta
```

### Scripts de execução

```
scripts/video/
  ├── setup-persona.ts              # Roda 1x por produto: Flux → HeyGen → ElevenLabs
  ├── scrape-ugc.ts                 # Busca e pontua vídeos TikTok por produto/nicho
  ├── process-video-queue.ts        # Pega combinações 'queued' e orquestra toda a geração
  ├── generate-scenes.ts            # HeyGen (lip sync) + Kling (3D) por cena do storyboard
  └── compose-final.ts              # FFmpeg: ordena, mixa, legenda, exporta 9:16 1080p
```

---

## Mudanças no frontend

### Nova aba — "Vídeo TikTok" (em `/products/[sku]`)

- Grid de cards com: thumbnail, handle do autor, views, score de relevância, duração
- Botão **Aprovar** (verde) → `status: 'approved'`
- Botão **Rejeitar** (vermelho) → `status: 'rejected'` + exclui arquivo local
- Badge "Em uso" quando o clipe foi incluído em algum vídeo final
- Filtro por status: Pendente | Aprovados | Rejeitados

### Nova aba — "Criativos" (em `/products/[sku]`)

```
┌──────────────────────────────────────────────────────────────┐
│ CRIATIVOS                                          [2 prontos]│
├──────────────────────────────────────────────────────────────┤
│  EM FILA (1)                                                  │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ Hook A · Body 2 · CTA 1              [Na fila...]    │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  GERANDO (1)                                                  │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ Hook B · Body 1 · CTA 2                              │    │
│  │ ██████████░░░░░░  Adicionando legendas...  75%       │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  PRONTOS (2)                                                  │
│  ┌────────────┐  ┌────────────┐                              │
│  │ [thumbnail]│  │ [thumbnail]│                              │
│  │   42s  ▶  │  │   38s  ▶  │                              │
│  │ Hook A·B1  │  │ Hook C·B2  │                              │
│  │ [↓ Baixar] │  │ [↓ Baixar] │                              │
│  └────────────┘  └────────────┘                              │
└──────────────────────────────────────────────────────────────┘
```

- Progresso em tempo real via **Supabase Realtime** (coluna `status` + `progress_step`)
- Player inline ao clicar no thumbnail
- Botão "Baixar" exporta o `.mp4` original

### Botão "Gerar Vídeo" na aba Copies

- Aparece em cada card de combinação (Hook + Body + CTA)
- Estados: `Gerar Vídeo` → `Na fila` → `Gerando...` → `Ver vídeo`
- Desabilitado se persona_assets ainda não estiver com `status: 'ready'`
- Tooltip ao hover: "Configure a persona do produto antes de gerar vídeos" (se sem persona)

---

## Fluxo de processamento completo

```
[USUÁRIO clica "Gerar Vídeo"]
       │
       ▼
INSERT final_videos (status: 'queued', copy_combination_id)
       │
       ▼
[ULTRON: "Processa vídeos na fila para produto X"]
       │
       ├─ Verifica persona_assets
       │     Se não existe → roda setup-persona.ts primeiro
       │
       ├─ Lê script + storyboard da combinação
       │
       ├─ Para cada cena do storyboard:
       │     Tipo "persona_falando"  → ElevenLabs (áudio) → HeyGen (lip sync) → clip
       │     Tipo "cena_3d"          → Kling (text/image-to-video) → clip + VO ElevenLabs
       │     Tipo "ugc"              → busca approved tiktok_videos → trim FFmpeg → clip
       │
       ├─ UPDATE final_videos status: 'composing'
       │
       ├─ FFmpeg: ordena clips por storyboard
       │     Mix áudio: voz + VO + música -18dB + SFX de corte
       │     Legendas word-by-word (faster-whisper → FFmpeg overlay)
       │     Exporta 9:16, 1080p, H.264, ~30-45s
       │
       └─ UPDATE final_videos (status: 'ready', video_url, thumbnail_url, duration_seconds)
```

---

## Sprints de implementação

### Sprint 1 — Fundação de dados e UGC ✅
**Objetivo:** usuário já consegue coletar e aprovar UGC antes da geração estar pronta.

- [x] Migration: criar tabelas `persona_assets`, `tiktok_videos`, `final_videos`
- [x] `scripts/video/scrape-ugc.ts` — yt-dlp + Gemini Vision scoring
- [x] Frontend: aba **"Vídeo TikTok"** — grid, approve/reject, badge "Em uso"
- [x] Hook `useTikTokVideos` em `hooks/useTikTokVideos.ts`

### Sprint 2 — Setup da persona ✅
**Objetivo:** persona visual e vocal configurada, reutilizável em todos os vídeos do produto.

- [x] `scripts/video/setup-persona.ts` — Flux (fotos) → HeyGen (avatar) → ElevenLabs (voz)
- [x] Skill `.claude/skills/agents/persona-visual-generator.md`
- [x] UI: `PersonaStatusBadge` no header do produto — foto gerada + badge Ready/Pending/Creating/Failed + botão de setup

### Sprint 3 — Geração de cenas ✅
**Objetivo:** cada cena do storyboard vira um clip de vídeo.

- [x] `scripts/video/generate-scenes.ts` — HeyGen (lip sync) + Kling (3D)
- [x] Skill `.claude/skills/agents/scene-generator.md`
- [x] Integração ElevenLabs para VO das cenas 3D

### Sprint 4 — Composição e entrega ✅
**Objetivo:** clips montados em vídeo final com legendas e pacing profissional.

- [x] `scripts/video/compose-final.ts` — FFmpeg + faster-whisper (opcional) + fallback script timing
- [x] Skill `.claude/skills/agents/video-compositor.md`
- [x] Templates de pacing: hook/CTA sem fade, cortes abruptos em todas as seções
- [x] `scripts/video/process-video-queue.ts` — orquestrador da fila completa

### Sprint 5 — Frontend completo ✅
**Objetivo:** experiência de ponta a ponta sem sair da interface.

- [x] Frontend: aba **"Criativos"** — fila + barra de progresso Realtime + player + download
- [x] Frontend: botão **"Gerar Vídeo"** nas combinações de copy
- [x] Hook `useFinalVideos` em `hooks/useFinalVideos.ts`
- [x] Supabase Realtime: subscribe em `final_videos` por `product_id`
- [x] API route `GET/POST /api/products/[sku]/final-videos`
- [x] `GerarVideoButton` — state machine (Gerar → Na fila → Gerando → Ver vídeo / Tentar novamente)

---

## Integrações externas necessárias (API keys)

| Serviço | Variável de ambiente | Uso |
|---------|---------------------|-----|
| Replicate | `REPLICATE_API_TOKEN` | Flux 1.1 Pro (fotos da persona) |
| HeyGen | `HEYGEN_API_KEY` | Avatar + lip sync |
| ElevenLabs | `ELEVENLABS_API_KEY` | Síntese de voz + VO |
| Kling AI | `KLING_API_KEY` | Cenas 3D / animadas |
| Gemini | `GEMINI_API_KEY` | Já existe — scoring UGC |

---

## Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| TikTok bloqueia scraping agressivo | Delay entre requests, rotação de user-agent, máx. 20 vídeos por busca |
| HeyGen demora 5-10 min por clip | Processar cenas em paralelo quando não há dependência entre elas |
| Kling rejeita prompt de cena 3D | Fallback: gerar imagem estática com Flux e animar com Kling image-to-video |
| Música com copyright no export | Usar apenas biblioteca local pré-aprovada; nunca baixar da internet automaticamente |
| faster-whisper lento sem GPU | Rodar em modelo `base` para legendas (rápido), `large-v3` apenas se qualidade exigir |

---

## Referências internas

- Storyboard gerado por: `.claude/skills/agents/keyframe-generator.md`
- Script de cada combinação: tabela `copy_combinations` + artefato `script` em `product_knowledge`
- Design system frontend: `.claude/skills/dev/frontend-adcraft.md`
- UX e estados de UI: `.claude/skills/dev/ux-ui-adcraft.md`
- Referência FFmpeg: `.claude/skills/dev/ffmpeg-video.md`
