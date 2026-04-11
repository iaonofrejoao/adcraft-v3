"""
Tool Registry — registro central de ferramentas disponíveis para os agentes.

Implementa o padrão da skill backend-python-agents:
  TOOL_DEFINITIONS  — dict mapeando nome → (definição Anthropic, módulo.função)
  AGENT_TOOL_MAP    — dict mapeando agente → lista de ferramentas disponíveis
  get_tools_for_agent(agent_name) → list[dict] para passar ao Claude
  dispatch_tool_call(tool_name, tool_input, ...) → resultado da ferramenta

Todas as ferramentas são definidas com input_schema completo conforme PRD seção 5.
Os executores são importados de forma lazy (via _EXECUTOR_MAP) para evitar
circular imports e falhas por módulos ainda não implementados.

Ferramentas por agente (PRD seção 4):
  product_analyzer:    read_page, transcribe_vsl, extract_structured_data, search_web
  market_researcher:   search_web, search_ad_library, check_google_trends, search_affiliate_platforms
  persona_builder:     search_web, search_youtube_comments, search_amazon_reviews,
                       search_mercadolivre_reviews, read_page, query_niche_memory
  angle_strategist:    search_ad_library, query_niche_memory, query_pattern_intelligence
  benchmark_agent:     search_ad_library, search_youtube_videos, get_youtube_video_comments,
                       get_youtube_transcript, classify_creative_format
  campaign_strategist: query_niche_memory, query_pattern_intelligence
  script_writer:       query_niche_memory
  copy_writer:         (nenhuma)
  character_generator: generate_image, upload_asset
  keyframe_generator:  generate_image, upload_asset
  video_generator:     generate_video_from_image, upload_asset
  creative_director:   concatenate_clips, mix_audio, add_subtitles, export_for_platform,
                       validate_video_quality, generate_srt, upload_asset
  compliance_checker:  (nenhuma)
  utm_builder:         (nenhuma)
  media_buyer_facebook: create_facebook_campaign, create_facebook_adset,
                        upload_creative_to_meta, create_facebook_ad, activate_campaign
  media_buyer_google:  create_google_campaign, create_google_adgroup,
                       create_google_ad, activate_google_campaign
  performance_analyst: get_facebook_campaign_metrics, get_google_campaign_metrics,
                       query_asset_library
  scaler:              pause_facebook_ad, scale_facebook_adset_budget, duplicate_facebook_ad
"""

from __future__ import annotations

import logging
from typing import Any

from app.orchestration.rate_limiter import RateLimiter

logger = logging.getLogger(__name__)


# ===========================================================================
# TOOL DEFINITIONS — definições completas de todas as ferramentas
# Formato: nome → (definição Anthropic, caminho "modulo:funcao" para lazy import)
# ===========================================================================

# ---------------------------------------------------------------------------
# Ferramentas de busca e leitura web
# ---------------------------------------------------------------------------

_READ_PAGE = {
    "name": "read_page",
    "description": (
        "Acessa uma URL e extrai o conteúdo textual estruturado da página. "
        "Use para ler páginas de vendas, fóruns, blogs e qualquer conteúdo web. "
        "Retorna título, texto completo e dados estruturados quando disponíveis."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "url": {
                "type": "string",
                "description": "URL completa da página a ser lida (incluindo https://)."
            },
            "extract_mode": {
                "type": "string",
                "enum": ["text", "structured"],
                "default": "text",
                "description": (
                    "text: extrai apenas o texto limpo da página. "
                    "structured: tenta extrair dados em formato JSON (preços, listas, tabelas)."
                )
            }
        },
        "required": ["url"]
    }
}

_SEARCH_WEB = {
    "name": "search_web",
    "description": (
        "Realiza busca na web e retorna lista de resultados com título, URL e snippet. "
        "Use para pesquisar concorrência, fóruns do nicho, reviews e qualquer informação atual. "
        "Sempre use esta ferramenta antes de fazer afirmações factuais sobre mercados ou produtos."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Consulta de busca. Seja específico — 2 a 6 palavras para melhores resultados."
            },
            "num_results": {
                "type": "integer",
                "default": 5,
                "description": "Número de resultados a retornar. Padrão 5, máximo 10."
            }
        },
        "required": ["query"]
    }
}

_SEARCH_AD_LIBRARY = {
    "name": "search_ad_library",
    "description": (
        "Busca anúncios ativos na Meta Ad Library (Facebook/Instagram). "
        "Use para identificar ângulos, hooks e formatos usados pelos concorrentes. "
        "Anúncios com mais dias rodando indicam criativos vencedores."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "search_terms": {
                "type": "string",
                "description": "Termos de busca para encontrar anúncios do nicho ou produto."
            },
            "ad_reached_countries": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Países alvo (ex: [\"BR\"], [\"US\"]). Use o código ISO 2 letras."
            },
            "min_days_running": {
                "type": "integer",
                "default": 0,
                "description": "Filtra anúncios rodando há pelo menos N dias. Use 30+ para criativos validados."
            },
            "limit": {
                "type": "integer",
                "default": 20,
                "description": "Número máximo de anúncios a retornar."
            }
        },
        "required": ["search_terms", "ad_reached_countries"]
    }
}

_CHECK_GOOGLE_TRENDS = {
    "name": "check_google_trends",
    "description": (
        "Verifica tendência de busca de uma palavra-chave no Google Trends. "
        "Retorna se o interesse está crescendo, estável ou declinando nos últimos 90 dias."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "keyword": {
                "type": "string",
                "description": "Palavra-chave ou frase a pesquisar."
            },
            "geo": {
                "type": "string",
                "description": "Código do país (ex: 'BR', 'US'). Deixe vazio para mundial."
            },
            "timeframe": {
                "type": "string",
                "default": "today 3-m",
                "description": "Período de análise. Padrão: últimos 3 meses."
            }
        },
        "required": ["keyword", "geo"]
    }
}

_SEARCH_AFFILIATE_PLATFORMS = {
    "name": "search_affiliate_platforms",
    "description": (
        "Busca produtos similares e métricas de performance em plataformas de afiliado "
        "(Hotmart, ClickBank, Monetizze). Retorna temperatura, EPC e comissão média do nicho."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "niche": {
                "type": "string",
                "description": "Nome do nicho a pesquisar (ex: 'emagrecimento', 'renda extra')."
            },
            "platforms": {
                "type": "array",
                "items": {"type": "string"},
                "default": ["hotmart", "clickbank"],
                "description": "Plataformas a consultar."
            }
        },
        "required": ["niche"]
    }
}

# ---------------------------------------------------------------------------
# Ferramentas de YouTube
# ---------------------------------------------------------------------------

_SEARCH_YOUTUBE_VIDEOS = {
    "name": "search_youtube_videos",
    "description": (
        "Busca vídeos no YouTube por relevância ou engajamento. "
        "Use para encontrar referências de criativos vencedores e benchmarks do nicho. "
        "ATENÇÃO: custa 100 unidades de quota por chamada (limite diário: 10.000 unidades)."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Consulta de busca para os vídeos."
            },
            "max_results": {
                "type": "integer",
                "default": 10,
                "description": "Número máximo de vídeos a retornar."
            },
            "order": {
                "type": "string",
                "enum": ["relevance", "viewCount", "date"],
                "default": "relevance",
                "description": "Critério de ordenação. viewCount retorna os mais vistos."
            }
        },
        "required": ["query"]
    }
}

_GET_YOUTUBE_VIDEO_COMMENTS = {
    "name": "get_youtube_video_comments",
    "description": (
        "Extrai os comentários mais relevantes de um vídeo do YouTube. "
        "Use para capturar a linguagem real do público — expressões verbatim, dores e desejos. "
        "Custa 1 unidade de quota por chamada."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "video_id": {
                "type": "string",
                "description": "ID do vídeo do YouTube (parte final da URL após v=)."
            },
            "max_results": {
                "type": "integer",
                "default": 100,
                "description": "Número máximo de comentários a extrair."
            }
        },
        "required": ["video_id"]
    }
}

_SEARCH_YOUTUBE_COMMENTS = {
    "name": "search_youtube_comments",
    "description": (
        "Busca vídeos no YouTube relacionados a uma query e extrai comentários do mais relevante. "
        "Atalho que combina search_youtube_videos + get_youtube_video_comments. "
        "Use para capturar linguagem real do público sobre um tema ou problema específico."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Tema a pesquisar (ex: 'relatos de quem perdeu peso', 'reviews detox')."
            },
            "max_results": {
                "type": "integer",
                "default": 50,
                "description": "Número máximo de comentários a retornar."
            }
        },
        "required": ["query"]
    }
}

_GET_YOUTUBE_TRANSCRIPT = {
    "name": "get_youtube_transcript",
    "description": (
        "Extrai a transcrição/legendas de um vídeo do YouTube. "
        "Use para analisar a estrutura de hook e narrativa de vídeos de referência. "
        "Retorna None se o vídeo não tiver legendas públicas."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "video_id": {
                "type": "string",
                "description": "ID do vídeo do YouTube."
            },
            "language": {
                "type": "string",
                "default": "pt",
                "description": "Idioma preferido para as legendas (código ISO, ex: 'pt', 'en')."
            }
        },
        "required": ["video_id"]
    }
}

# ---------------------------------------------------------------------------
# Ferramentas de reviews e memória
# ---------------------------------------------------------------------------

_SEARCH_AMAZON_REVIEWS = {
    "name": "search_amazon_reviews",
    "description": (
        "Extrai reviews de produtos similares na Amazon para capturar linguagem real "
        "do público. Retorna os reviews mais úteis com rating, título e texto completo."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Nome ou tipo de produto a pesquisar."
            },
            "country": {
                "type": "string",
                "default": "BR",
                "description": "País da Amazon (BR, US, MX). BR usa amazon.com.br."
            },
            "max_results": {
                "type": "integer",
                "default": 20,
                "description": "Número máximo de reviews a retornar."
            }
        },
        "required": ["query"]
    }
}

_SEARCH_MERCADOLIVRE_REVIEWS = {
    "name": "search_mercadolivre_reviews",
    "description": (
        "Extrai reviews de produtos similares no Mercado Livre. "
        "Especialmente útil para nichos brasileiros — captura linguagem coloquial do público."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Nome ou tipo de produto a pesquisar."
            },
            "max_results": {
                "type": "integer",
                "default": 20,
                "description": "Número máximo de reviews a retornar."
            }
        },
        "required": ["query"]
    }
}

_QUERY_NICHE_MEMORY = {
    "name": "query_niche_memory",
    "description": (
        "Consulta a base de conhecimento acumulada sobre um nicho. "
        "Retorna hooks validados, ângulos que performaram, expressões verbatim aprovadas "
        "e padrões de audiência. Use sempre antes de pesquisas externas — dados já validados "
        "são mais confiáveis que dados novos."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "niche": {
                "type": "string",
                "description": "Nome do nicho a consultar (ex: 'emagrecimento', 'renda extra')."
            },
            "memory_type": {
                "type": "string",
                "description": (
                    "Tipo de memória a filtrar: hook_pattern, angle_type, audience_verbatim, "
                    "format_preference, objection, cta_pattern. Deixe vazio para todos os tipos."
                )
            }
        },
        "required": ["niche"]
    }
}

_QUERY_PATTERN_INTELLIGENCE = {
    "name": "query_pattern_intelligence",
    "description": (
        "Consulta padrões de performance que transcendem nichos. "
        "Retorna dados como: ângulo X tem ROAS médio Y em nichos de saúde, "
        "formato UGC converte Z% mais que VSL para ticket abaixo de R$197."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "pattern_type": {
                "type": "string",
                "description": (
                    "Tipo de padrão: angle_type, creative_format, narrative_structure, "
                    "hook_type, audience_gender, audience_age_range."
                )
            },
            "filter_value": {
                "type": "string",
                "description": "Valor específico a filtrar (ex: 'ugc', 'betrayed_authority')."
            }
        },
        "required": ["pattern_type"]
    }
}

_CLASSIFY_CREATIVE_FORMAT = {
    "name": "classify_creative_format",
    "description": (
        "Classifica o formato de um criativo a partir do texto ou URL do anúncio. "
        "Retorna: ugc, vsl, interview, podcast, demo, testimonial."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "content": {
                "type": "string",
                "description": "Texto da copy do anúncio, transcrição ou URL do criativo."
            }
        },
        "required": ["content"]
    }
}

# ---------------------------------------------------------------------------
# Ferramentas de transcrição e extração
# ---------------------------------------------------------------------------

_TRANSCRIBE_VSL = {
    "name": "transcribe_vsl",
    "description": (
        "Transcreve o áudio de uma VSL (Vídeo de Vendas) e retorna o texto com timestamps. "
        "Suporta URLs do YouTube, Vturb e Panda Video. "
        "Se a extração for impossível (DRM), retorna status: manual_upload_required."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "url_or_file_path": {
                "type": "string",
                "description": "URL da VSL (YouTube, Vturb, Panda) ou caminho local do arquivo de vídeo/áudio."
            },
            "language": {
                "type": "string",
                "default": "pt",
                "description": "Idioma do áudio para melhorar a transcrição (código ISO, ex: 'pt', 'en')."
            }
        },
        "required": ["url_or_file_path"]
    }
}

_EXTRACT_STRUCTURED_DATA = {
    "name": "extract_structured_data",
    "description": (
        "Extrai dados estruturados de um texto livre usando um schema JSON como guia. "
        "Use após read_page ou transcribe_vsl para converter texto em campos organizados."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "text": {
                "type": "string",
                "description": "Texto bruto de onde extrair os dados."
            },
            "schema": {
                "type": "object",
                "description": "Schema JSON descrevendo os campos a extrair e seus tipos."
            }
        },
        "required": ["text", "schema"]
    }
}

# ---------------------------------------------------------------------------
# Ferramentas de geração de mídia
# ---------------------------------------------------------------------------

_GENERATE_IMAGE = {
    "name": "generate_image",
    "description": (
        "Gera imagem a partir de prompt de texto, opcionalmente usando imagem de referência. "
        "Use para criar personagens base e keyframes de cada cena do roteiro."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "prompt": {
                "type": "string",
                "description": "Descrição detalhada da imagem a gerar. Seja específico sobre aparência, ambiente, iluminação e estilo."
            },
            "reference_image_url": {
                "type": "string",
                "description": "URL de imagem de referência para manter consistência visual (ex: URL do personagem base)."
            },
            "aspect_ratio": {
                "type": "string",
                "default": "9:16",
                "description": "Proporção da imagem. Ex: '9:16' para stories, '1:1' para feed quadrado, '16:9' para landscape."
            },
            "quantity": {
                "type": "integer",
                "default": 1,
                "description": "Número de variações a gerar. Padrão 1, máximo 10."
            }
        },
        "required": ["prompt"]
    }
}

_GENERATE_VIDEO_FROM_IMAGE = {
    "name": "generate_video_from_image",
    "description": (
        "Gera um clipe de vídeo a partir de uma imagem inicial (image-to-video). "
        "Use o keyframe aprovado de cada cena para gerar o clipe correspondente."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "image_url": {
                "type": "string",
                "description": "URL do keyframe (imagem inicial do clipe)."
            },
            "motion_prompt": {
                "type": "string",
                "description": "Descrição do movimento a animar. Ex: 'mulher caminhando suavemente, câmera leve aproximação'."
            },
            "duration_seconds": {
                "type": "integer",
                "description": "Duração do clipe em segundos (conforme scene_breakdown)."
            },
            "aspect_ratio": {
                "type": "string",
                "description": "Proporção do vídeo. Ex: '9x16', '1x1', '16x9'."
            }
        },
        "required": ["image_url", "motion_prompt", "duration_seconds", "aspect_ratio"]
    }
}

_UPLOAD_ASSET = {
    "name": "upload_asset",
    "description": (
        "Faz upload de arquivo para o Cloudflare R2 e retorna URL permanente. "
        "IMPORTANTE: registra automaticamente o metadado no banco — operação atômica. "
        "Use para salvar imagens e vídeos gerados."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "file_bytes_base64": {
                "type": "string",
                "description": "Conteúdo do arquivo em base64."
            },
            "file_extension": {
                "type": "string",
                "description": "Extensão do arquivo sem ponto (ex: 'mp4', 'png', 'jpg')."
            },
            "folder": {
                "type": "string",
                "description": "Pasta no R2 (ex: 'characters', 'keyframes', 'clips')."
            },
            "content_type": {
                "type": "string",
                "description": "MIME type do arquivo (ex: 'video/mp4', 'image/png')."
            }
        },
        "required": ["file_bytes_base64", "file_extension", "folder", "content_type"]
    }
}

# ---------------------------------------------------------------------------
# Ferramentas FFmpeg (montagem de vídeo local)
# ---------------------------------------------------------------------------

_CONCATENATE_CLIPS = {
    "name": "concatenate_clips",
    "description": "Une múltiplos clipes de vídeo em ordem na sequência do roteiro.",
    "input_schema": {
        "type": "object",
        "properties": {
            "clip_urls": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Lista de URLs dos clipes no R2, na ordem de concatenação."
            },
            "output_filename": {
                "type": "string",
                "default": "concat_output.mp4",
                "description": "Nome do arquivo de saída."
            }
        },
        "required": ["clip_urls"]
    }
}

_MIX_AUDIO = {
    "name": "mix_audio",
    "description": "Adiciona narração e trilha de fundo ao vídeo. Narração em 100%, trilha em 15%.",
    "input_schema": {
        "type": "object",
        "properties": {
            "video_url": {
                "type": "string",
                "description": "URL do vídeo base (sem áudio ou com áudio original)."
            },
            "narration_url": {
                "type": "string",
                "description": "URL do arquivo de narração (mp3/wav). Opcional."
            },
            "music_url": {
                "type": "string",
                "description": "URL da trilha de fundo (mp3). Opcional. Volume fixado em 15%."
            }
        },
        "required": ["video_url"]
    }
}

_ADD_SUBTITLES = {
    "name": "add_subtitles",
    "description": "Insere legendas no vídeo (hardcoded/burn). Texto branco com contorno preto.",
    "input_schema": {
        "type": "object",
        "properties": {
            "video_url": {
                "type": "string",
                "description": "URL do vídeo."
            },
            "srt_content": {
                "type": "string",
                "description": "Conteúdo do arquivo SRT com timestamps e texto das legendas."
            }
        },
        "required": ["video_url", "srt_content"]
    }
}

_EXPORT_FOR_PLATFORM = {
    "name": "export_for_platform",
    "description": "Exporta o vídeo no aspect ratio correto para cada plataforma de anúncio.",
    "input_schema": {
        "type": "object",
        "properties": {
            "video_url": {
                "type": "string",
                "description": "URL do vídeo a exportar."
            },
            "aspect_ratio": {
                "type": "string",
                "description": "Aspect ratio alvo: '9x16' (Reels/Stories), '1x1' (feed), '16x9' (YouTube)."
            }
        },
        "required": ["video_url", "aspect_ratio"]
    }
}

_VALIDATE_VIDEO_QUALITY = {
    "name": "validate_video_quality",
    "description": (
        "Valida se o vídeo atende aos requisitos mínimos para veiculação como anúncio pago. "
        "Verifica: duração (5-120s), resolução (≥720p), fps (≥24), tamanho (<500MB), presença de áudio."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "video_url": {
                "type": "string",
                "description": "URL do vídeo a validar."
            }
        },
        "required": ["video_url"]
    }
}

_GENERATE_SRT = {
    "name": "generate_srt",
    "description": "Gera arquivo de legendas SRT sincronizado a partir do roteiro e duração total.",
    "input_schema": {
        "type": "object",
        "properties": {
            "script_text": {
                "type": "string",
                "description": "Texto completo do roteiro (full_script)."
            },
            "duration_seconds": {
                "type": "number",
                "description": "Duração total do vídeo em segundos."
            },
            "words_per_line": {
                "type": "integer",
                "default": 7,
                "description": "Número de palavras por linha de legenda."
            }
        },
        "required": ["script_text", "duration_seconds"]
    }
}

# ---------------------------------------------------------------------------
# Ferramentas Facebook Ads (Meta Marketing API v19)
# ---------------------------------------------------------------------------

_CREATE_FACEBOOK_CAMPAIGN = {
    "name": "create_facebook_campaign",
    "description": (
        "Cria campanha no Facebook Ads SEMPRE em status PAUSED. "
        "NUNCA crie em status ativo — a ativação ocorre apenas após aprovação humana explícita."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "ad_account_id": {
                "type": "string",
                "description": "ID da conta de anúncio do Facebook (sem 'act_', ex: '123456789')."
            },
            "name": {
                "type": "string",
                "description": "Nome da campanha (ex: 'DetoxPro-UGC-AutoridadeTraida-v1')."
            },
            "objective": {
                "type": "string",
                "description": "Objetivo da campanha: OUTCOME_SALES, OUTCOME_LEADS, OUTCOME_TRAFFIC."
            }
        },
        "required": ["ad_account_id", "name", "objective"]
    }
}

_CREATE_FACEBOOK_ADSET = {
    "name": "create_facebook_adset",
    "description": "Cria conjunto de anúncios (adset) dentro de uma campanha do Facebook.",
    "input_schema": {
        "type": "object",
        "properties": {
            "campaign_id": {
                "type": "string",
                "description": "ID da campanha pai."
            },
            "name": {
                "type": "string",
                "description": "Nome do conjunto."
            },
            "targeting": {
                "type": "object",
                "description": "Configuração de público: age_min, age_max, genders, geo_locations, interests."
            },
            "daily_budget_cents": {
                "type": "integer",
                "description": "Budget diário em centavos BRL (ex: R$33,33 = 3333)."
            },
            "optimization_goal": {
                "type": "string",
                "default": "OFFSITE_CONVERSIONS",
                "description": "Meta de otimização do conjunto."
            }
        },
        "required": ["campaign_id", "name", "targeting", "daily_budget_cents"]
    }
}

_UPLOAD_CREATIVE_TO_META = {
    "name": "upload_creative_to_meta",
    "description": "Faz upload do vídeo criativo para a biblioteca de mídia do Meta antes de criar o anúncio.",
    "input_schema": {
        "type": "object",
        "properties": {
            "video_url": {
                "type": "string",
                "description": "URL pública do vídeo no R2."
            },
            "ad_account_id": {
                "type": "string",
                "description": "ID da conta de anúncio."
            },
            "title": {
                "type": "string",
                "description": "Título do vídeo na biblioteca do Meta."
            }
        },
        "required": ["video_url", "ad_account_id"]
    }
}

_CREATE_FACEBOOK_AD = {
    "name": "create_facebook_ad",
    "description": "Cria anúncio dentro de um adset do Facebook com criativo e copy.",
    "input_schema": {
        "type": "object",
        "properties": {
            "adset_id": {
                "type": "string",
                "description": "ID do conjunto de anúncios pai."
            },
            "creative_id": {
                "type": "string",
                "description": "ID do criativo na biblioteca do Meta (obtido via upload_creative_to_meta)."
            },
            "headline": {
                "type": "string",
                "description": "Headline do anúncio (máx 40 caracteres para Facebook)."
            },
            "body": {
                "type": "string",
                "description": "Texto principal do anúncio."
            },
            "cta_type": {
                "type": "string",
                "description": "Tipo do CTA: LEARN_MORE, SHOP_NOW, SIGN_UP, GET_OFFER."
            },
            "destination_url": {
                "type": "string",
                "description": "URL de destino com parâmetros UTM."
            }
        },
        "required": ["adset_id", "creative_id", "headline", "body", "cta_type", "destination_url"]
    }
}

_ACTIVATE_CAMPAIGN = {
    "name": "activate_campaign",
    "description": (
        "Ativa uma campanha do Facebook Ads. "
        "ATENÇÃO: só chamar após aprovação humana explícita na tela de revisão de lançamento. "
        "Nunca chamar automaticamente — aguardar confirmação do usuário."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "campaign_id": {
                "type": "string",
                "description": "ID da campanha a ativar."
            }
        },
        "required": ["campaign_id"]
    }
}

# ---------------------------------------------------------------------------
# Ferramentas Google Ads
# ---------------------------------------------------------------------------

_CREATE_GOOGLE_CAMPAIGN = {
    "name": "create_google_campaign",
    "description": (
        "Cria campanha no Google Ads SEMPRE em status PAUSED. "
        "NUNCA ative automaticamente — aguardar aprovação humana."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "customer_id": {
                "type": "string",
                "description": "ID do cliente Google Ads (sem hífens, ex: '1234567890')."
            },
            "name": {
                "type": "string",
                "description": "Nome da campanha."
            },
            "objective": {
                "type": "string",
                "description": "Objetivo: SALES, LEADS, WEBSITE_TRAFFIC."
            },
            "daily_budget_micros": {
                "type": "integer",
                "description": "Budget diário em micros BRL (R$100,00 = 100_000_000)."
            }
        },
        "required": ["customer_id", "name", "objective", "daily_budget_micros"]
    }
}

_CREATE_GOOGLE_ADGROUP = {
    "name": "create_google_adgroup",
    "description": "Cria grupo de anúncios dentro de uma campanha do Google Ads.",
    "input_schema": {
        "type": "object",
        "properties": {
            "campaign_id": {
                "type": "string",
                "description": "ID da campanha pai."
            },
            "name": {
                "type": "string",
                "description": "Nome do grupo de anúncios."
            },
            "keywords": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Lista de palavras-chave para segmentação."
            }
        },
        "required": ["campaign_id", "name"]
    }
}

_CREATE_GOOGLE_AD = {
    "name": "create_google_ad",
    "description": "Cria anúncio RSA (Responsive Search Ad) no Google Ads.",
    "input_schema": {
        "type": "object",
        "properties": {
            "adgroup_id": {
                "type": "string",
                "description": "ID do grupo de anúncios pai."
            },
            "headlines": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Lista de headlines (máx 30 chars cada, mínimo 3, máximo 15)."
            },
            "descriptions": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Lista de descrições (máx 90 chars cada, mínimo 2, máximo 4)."
            },
            "final_url": {
                "type": "string",
                "description": "URL de destino com parâmetros UTM."
            }
        },
        "required": ["adgroup_id", "headlines", "descriptions", "final_url"]
    }
}

_ACTIVATE_GOOGLE_CAMPAIGN = {
    "name": "activate_google_campaign",
    "description": (
        "Ativa uma campanha do Google Ads. "
        "ATENÇÃO: só chamar após aprovação humana explícita. Nunca ativar automaticamente."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "campaign_id": {
                "type": "string",
                "description": "ID da campanha Google Ads a ativar."
            }
        },
        "required": ["campaign_id"]
    }
}

# ---------------------------------------------------------------------------
# Ferramentas de métricas de performance
# ---------------------------------------------------------------------------

_GET_FACEBOOK_CAMPAIGN_METRICS = {
    "name": "get_facebook_campaign_metrics",
    "description": "Lê métricas de performance de uma campanha do Facebook Ads para o período especificado.",
    "input_schema": {
        "type": "object",
        "properties": {
            "campaign_id": {
                "type": "string",
                "description": "ID da campanha no Facebook Ads."
            },
            "date_range": {
                "type": "string",
                "default": "yesterday",
                "description": "Período: 'yesterday', 'last_7d', 'last_30d' ou 'YYYY-MM-DD,YYYY-MM-DD'."
            }
        },
        "required": ["campaign_id"]
    }
}

_GET_GOOGLE_CAMPAIGN_METRICS = {
    "name": "get_google_campaign_metrics",
    "description": "Lê métricas de performance de uma campanha do Google Ads para o período especificado.",
    "input_schema": {
        "type": "object",
        "properties": {
            "campaign_id": {
                "type": "string",
                "description": "ID da campanha no Google Ads."
            },
            "date_range": {
                "type": "string",
                "default": "YESTERDAY",
                "description": "Período: YESTERDAY, LAST_7_DAYS, LAST_30_DAYS."
            }
        },
        "required": ["campaign_id"]
    }
}

_QUERY_ASSET_LIBRARY = {
    "name": "query_asset_library",
    "description": "Consulta ativos aprovados de um projeto para correlacionar com dados de performance.",
    "input_schema": {
        "type": "object",
        "properties": {
            "project_id": {
                "type": "string",
                "description": "UUID do projeto."
            },
            "asset_type": {
                "type": "string",
                "description": "Tipo de ativo: final_video, hook, script, copy, character. Deixe vazio para todos."
            }
        },
        "required": ["project_id"]
    }
}

# ---------------------------------------------------------------------------
# Ferramentas de escala (Agente 18)
# ---------------------------------------------------------------------------

_PAUSE_FACEBOOK_AD = {
    "name": "pause_facebook_ad",
    "description": (
        "Pausa um anúncio perdedor no Facebook Ads. "
        "ATENÇÃO: requer aprovação humana antes de executar."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "ad_id": {"type": "string", "description": "ID do anúncio a pausar."}
        },
        "required": ["ad_id"]
    }
}

_SCALE_FACEBOOK_ADSET_BUDGET = {
    "name": "scale_facebook_adset_budget",
    "description": (
        "Aumenta o budget diário de um conjunto de anúncios vencedor. "
        "ATENÇÃO: requer aprovação humana antes de executar."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "adset_id": {"type": "string", "description": "ID do conjunto de anúncios."},
            "new_daily_budget_cents": {
                "type": "integer",
                "description": "Novo budget diário em centavos BRL."
            }
        },
        "required": ["adset_id", "new_daily_budget_cents"]
    }
}

_DUPLICATE_FACEBOOK_AD = {
    "name": "duplicate_facebook_ad",
    "description": (
        "Duplica um anúncio vencedor para um novo conjunto de anúncios (novo público). "
        "ATENÇÃO: requer aprovação humana antes de executar."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "ad_id": {"type": "string", "description": "ID do anúncio a duplicar."},
            "new_adset_id": {"type": "string", "description": "ID do novo conjunto de destino."}
        },
        "required": ["ad_id", "new_adset_id"]
    }
}


# ===========================================================================
# TOOL_DEFINITIONS — mapeamento central: nome → (definição, "modulo:função")
# Os executores são carregados de forma lazy via _get_executor()
# ===========================================================================

TOOL_DEFINITIONS: dict[str, tuple[dict, str]] = {
    # busca e leitura web
    "read_page":                  (_READ_PAGE,                  "app.tools.read_page:execute_read_page"),
    "search_web":                 (_SEARCH_WEB,                 "app.tools.web_search:execute_search_web"),
    "search_ad_library":          (_SEARCH_AD_LIBRARY,          "app.tools.search_ad_library:execute_search_ad_library"),
    "check_google_trends":        (_CHECK_GOOGLE_TRENDS,        "app.tools.web_search:execute_check_google_trends"),
    "search_affiliate_platforms": (_SEARCH_AFFILIATE_PLATFORMS, "app.tools.web_search:execute_search_affiliate_platforms"),
    # YouTube
    "search_youtube_videos":       (_SEARCH_YOUTUBE_VIDEOS,       "app.tools.search_youtube:execute_search_youtube_videos"),
    "get_youtube_video_comments":  (_GET_YOUTUBE_VIDEO_COMMENTS,  "app.tools.search_youtube:execute_get_youtube_comments"),
    "search_youtube_comments":     (_SEARCH_YOUTUBE_COMMENTS,     "app.tools.search_youtube:execute_search_youtube_comments"),
    "get_youtube_transcript":      (_GET_YOUTUBE_TRANSCRIPT,      "app.tools.search_youtube:execute_get_youtube_transcript"),
    # reviews e memória
    "search_amazon_reviews":       (_SEARCH_AMAZON_REVIEWS,       "app.tools.web_search:execute_search_amazon_reviews"),
    "search_mercadolivre_reviews": (_SEARCH_MERCADOLIVRE_REVIEWS, "app.tools.web_search:execute_search_mercadolivre_reviews"),
    "query_niche_memory":          (_QUERY_NICHE_MEMORY,          "app.tools.memory_tools:execute_query_niche_memory"),
    "query_pattern_intelligence":  (_QUERY_PATTERN_INTELLIGENCE,  "app.tools.memory_tools:execute_query_pattern_intelligence"),
    "classify_creative_format":    (_CLASSIFY_CREATIVE_FORMAT,    "app.tools.extract_structured:execute_classify_creative_format"),
    # transcrição e extração
    "transcribe_vsl":              (_TRANSCRIBE_VSL,              "app.tools.transcribe_vsl:execute_transcribe_vsl"),
    "extract_structured_data":     (_EXTRACT_STRUCTURED_DATA,     "app.tools.extract_structured:execute_extract_structured_data"),
    # geração de mídia
    "generate_image":              (_GENERATE_IMAGE,              "app.tools.generate_image:execute_generate_image"),
    "generate_video_from_image":   (_GENERATE_VIDEO_FROM_IMAGE,   "app.tools.generate_video:execute_generate_video_from_image"),
    "upload_asset":                (_UPLOAD_ASSET,                "app.tools.storage_r2:execute_upload_asset"),
    # FFmpeg — wrappers URL-based (execute_* em render_video_ffmpeg.py)
    "concatenate_clips":           (_CONCATENATE_CLIPS,           "app.tools.render_video_ffmpeg:execute_concatenate_clips"),
    "mix_audio":                   (_MIX_AUDIO,                   "app.tools.render_video_ffmpeg:execute_mix_audio"),
    "add_subtitles":               (_ADD_SUBTITLES,               "app.tools.render_video_ffmpeg:execute_add_subtitles"),
    "export_for_platform":         (_EXPORT_FOR_PLATFORM,         "app.tools.render_video_ffmpeg:execute_export_for_platform"),
    "validate_video_quality":      (_VALIDATE_VIDEO_QUALITY,      "app.tools.render_video_ffmpeg:execute_validate_video_quality"),
    "generate_srt":                (_GENERATE_SRT,                "app.tools.render_video_ffmpeg:execute_generate_srt"),
    # Facebook Ads
    "create_facebook_campaign":    (_CREATE_FACEBOOK_CAMPAIGN,    "app.tools.facebook_ads:execute_create_facebook_campaign"),
    "create_facebook_adset":       (_CREATE_FACEBOOK_ADSET,       "app.tools.facebook_ads:execute_create_facebook_adset"),
    "upload_creative_to_meta":     (_UPLOAD_CREATIVE_TO_META,     "app.tools.facebook_ads:execute_upload_creative_to_meta"),
    "create_facebook_ad":          (_CREATE_FACEBOOK_AD,          "app.tools.facebook_ads:execute_create_facebook_ad"),
    "activate_campaign":           (_ACTIVATE_CAMPAIGN,           "app.tools.facebook_ads:execute_activate_campaign"),
    # Google Ads
    "create_google_campaign":      (_CREATE_GOOGLE_CAMPAIGN,      "app.tools.google_ads:execute_create_google_campaign"),
    "create_google_adgroup":       (_CREATE_GOOGLE_ADGROUP,       "app.tools.google_ads:execute_create_google_adgroup"),
    "create_google_ad":            (_CREATE_GOOGLE_AD,            "app.tools.google_ads:execute_create_google_ad"),
    "activate_google_campaign":    (_ACTIVATE_GOOGLE_CAMPAIGN,    "app.tools.google_ads:execute_activate_google_campaign"),
    # métricas de performance
    "get_facebook_campaign_metrics": (_GET_FACEBOOK_CAMPAIGN_METRICS, "app.tools.facebook_ads:execute_get_facebook_campaign_metrics"),
    "get_google_campaign_metrics":   (_GET_GOOGLE_CAMPAIGN_METRICS,   "app.tools.google_ads:execute_get_google_campaign_metrics"),
    "query_asset_library":           (_QUERY_ASSET_LIBRARY,           "app.tools.memory_tools:execute_query_asset_library"),
    # escala
    "pause_facebook_ad":             (_PAUSE_FACEBOOK_AD,             "app.tools.facebook_ads:execute_pause_facebook_ad"),
    "scale_facebook_adset_budget":   (_SCALE_FACEBOOK_ADSET_BUDGET,   "app.tools.facebook_ads:execute_scale_facebook_adset_budget"),
    "duplicate_facebook_ad":         (_DUPLICATE_FACEBOOK_AD,         "app.tools.facebook_ads:execute_duplicate_facebook_ad"),
}


# ===========================================================================
# AGENT_TOOL_MAP — ferramentas disponíveis por agente (PRD seção 4)
# ===========================================================================

AGENT_TOOL_MAP: dict[str, list[str]] = {
    "product_analyzer": [
        "read_page",
        "transcribe_vsl",
        "extract_structured_data",
        "search_web",
    ],
    "market_researcher": [
        "search_web",
        "search_ad_library",
        "check_google_trends",
        "search_affiliate_platforms",
    ],
    "persona_builder": [
        "search_web",
        "search_youtube_comments",
        "search_amazon_reviews",
        "search_mercadolivre_reviews",
        "read_page",
        "query_niche_memory",
    ],
    "angle_strategist": [
        "search_ad_library",
        "query_niche_memory",
        "query_pattern_intelligence",
    ],
    "benchmark_agent": [
        "search_ad_library",
        "search_youtube_videos",
        "get_youtube_video_comments",
        "get_youtube_transcript",
        "classify_creative_format",
    ],
    "campaign_strategist": [
        "query_niche_memory",
        "query_pattern_intelligence",
    ],
    "script_writer": [
        "query_niche_memory",
    ],
    "copy_writer": [],
    "character_generator": [
        "generate_image",
        "upload_asset",
    ],
    "keyframe_generator": [
        "generate_image",
        "upload_asset",
    ],
    "video_generator": [
        "generate_video_from_image",
        "upload_asset",
    ],
    "creative_director": [
        "concatenate_clips",
        "mix_audio",
        "add_subtitles",
        "export_for_platform",
        "validate_video_quality",
        "generate_srt",
        "upload_asset",
    ],
    "compliance_checker": [],
    "utm_builder": [],
    "media_buyer_facebook": [
        "create_facebook_campaign",
        "create_facebook_adset",
        "upload_creative_to_meta",
        "create_facebook_ad",
        "activate_campaign",
    ],
    "media_buyer_google": [
        "create_google_campaign",
        "create_google_adgroup",
        "create_google_ad",
        "activate_google_campaign",
    ],
    "performance_analyst": [
        "get_facebook_campaign_metrics",
        "get_google_campaign_metrics",
        "query_asset_library",
    ],
    "scaler": [
        "pause_facebook_ad",
        "scale_facebook_adset_budget",
        "duplicate_facebook_ad",
    ],
}


# ===========================================================================
# API pública
# ===========================================================================

def get_tools_for_agent(agent_name: str) -> list[dict]:
    """
    Retorna a lista de definições de ferramentas para um agente específico.
    Pronto para passar diretamente ao parâmetro tools= do cliente Anthropic.

    Args:
        agent_name: Nome do agente (ex: "persona_builder", "script_writer").

    Returns:
        Lista de dicts com as definições das ferramentas (name, description, input_schema).

    Raises:
        KeyError: se alguma ferramenta do mapa não existir em TOOL_DEFINITIONS.
    """
    tool_names = AGENT_TOOL_MAP.get(agent_name, [])
    if not tool_names:
        return []

    definitions = []
    for name in tool_names:
        if name not in TOOL_DEFINITIONS:
            logger.error(
                "Ferramenta '%s' listada em AGENT_TOOL_MAP para agente '%s' "
                "não encontrada em TOOL_DEFINITIONS.",
                name, agent_name,
            )
            raise KeyError(
                f"Ferramenta '{name}' não encontrada em TOOL_DEFINITIONS. "
                f"Adicione a definição antes de usar."
            )
        tool_def = TOOL_DEFINITIONS[name][0]
        
        # Converte o formato do Anthropic (input_schema) para o formato do Gemini FunctionDeclaration (parameters)
        gemini_def = {
            "name": tool_def["name"],
            "description": tool_def["description"],
            "parameters": tool_def["input_schema"]
        }
        definitions.append(gemini_def)

    return definitions


async def dispatch_tool_call(
    tool_name: str,
    tool_input: dict,
    rate_limiter: RateLimiter | None = None,
    execution_id: str = "",
    node_id: str = "",
) -> Any:
    """
    Despacha uma chamada de ferramenta pelo nome e retorna o resultado.
    Chamado pelo BaseAgent._execute_tool_calls() para cada tool_use do Claude.

    Os executores são carregados de forma lazy — módulos não implementados
    geram ValueError claro ao invés de falha na importação no startup.

    Args:
        tool_name:    Nome da ferramenta (deve estar em TOOL_DEFINITIONS).
        tool_input:   Parâmetros extraídos do tool_use do Claude.
        rate_limiter: Para rate limiting nas APIs externas.
        execution_id: Para eventos WebSocket de fila.
        node_id:      Para tooltip do nó no canvas.

    Returns:
        Resultado serializável da ferramenta.

    Raises:
        ValueError: se a ferramenta não estiver em TOOL_DEFINITIONS.
        NotImplementedError: se o módulo executor ainda não estiver implementado.
    """
    if tool_name not in TOOL_DEFINITIONS:
        raise ValueError(
            f"Ferramenta '{tool_name}' não registrada em TOOL_DEFINITIONS. "
            f"Ferramentas disponíveis: {list(TOOL_DEFINITIONS.keys())}"
        )

    _, executor_path = TOOL_DEFINITIONS[tool_name]
    executor = _get_executor(executor_path)

    # Injeta contexto de rate limiting se o executor aceitar esses parâmetros
    import inspect
    sig = inspect.signature(executor)
    extra_kwargs: dict[str, Any] = {}
    if "rate_limiter" in sig.parameters and rate_limiter is not None:
        extra_kwargs["rate_limiter"] = rate_limiter
    if "execution_id" in sig.parameters:
        extra_kwargs["execution_id"] = execution_id
    if "node_id" in sig.parameters:
        extra_kwargs["node_id"] = node_id

    logger.debug("Despachando ferramenta '%s' (executor: %s)", tool_name, executor_path)
    return await executor(**tool_input, **extra_kwargs)


def list_registered_tools() -> list[str]:
    """Retorna os nomes de todas as ferramentas registradas em TOOL_DEFINITIONS."""
    return list(TOOL_DEFINITIONS.keys())


# ===========================================================================
# Utilitário interno — lazy import de executores
# ===========================================================================

_executor_cache: dict[str, Any] = {}


def _get_executor(executor_path: str) -> Any:
    """
    Carrega o executor de forma lazy a partir do caminho "modulo:funcao".
    Armazena em cache após o primeiro carregamento.

    Args:
        executor_path: Caminho no formato "app.tools.modulo:funcao".

    Returns:
        Função executora assíncrona.

    Raises:
        NotImplementedError: se o módulo ou a função não existirem ainda.
    """
    if executor_path in _executor_cache:
        return _executor_cache[executor_path]

    module_path, func_name = executor_path.rsplit(":", 1)

    try:
        import importlib
        module = importlib.import_module(module_path)
    except ImportError as exc:
        raise NotImplementedError(
            f"Módulo '{module_path}' ainda não implementado. "
            f"Crie o arquivo antes de usar a ferramenta. Erro: {exc}"
        ) from exc

    if not hasattr(module, func_name):
        raise NotImplementedError(
            f"Função '{func_name}' não encontrada no módulo '{module_path}'. "
            f"Implemente a função executora."
        )

    func = getattr(module, func_name)
    _executor_cache[executor_path] = func
    return func
