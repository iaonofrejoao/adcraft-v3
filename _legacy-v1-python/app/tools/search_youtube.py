"""
Tools: search_youtube_videos · get_youtube_video_comments · get_youtube_transcript

Acesso à YouTube Data API v3 e captions de vídeos públicos.
Conforme PRD seção 5 e skill api-integration.md.

Autenticação: YOUTUBE_API_KEY em variável de ambiente (sem OAuth).
Rate limit:   RateLimiter central, chave "youtube_data", 10.000 unidades/dia.
              Alerta automático ao atingir 8.000 unidades (configurado no RateLimiter).

Quota por operação:
  search.list          → 100 unidades  (+ 1 de videos.list para statistics)
  commentThreads.list  →   1 unidade
  get_transcript       →   0 unidades  (usa youtube-transcript-api, sem quota)

Erro de quota excedida (403 quotaExceeded): levanta YouTubeQuotaExceededError.
O agente captura e sinaliza benchmark_source="cached" usando a memória de nicho.
"""

import logging
import os
from datetime import UTC, datetime

import httpx

from app.orchestration.rate_limiter import RateLimiter

logger = logging.getLogger(__name__)

_rate_limiter = RateLimiter()

_YOUTUBE_BASE = "https://www.googleapis.com/youtube/v3"
_TIMEOUT_SECONDS: float = 10.0

_PLACEHOLDER_VALUES = frozenset({
    "", "sua-chave-aqui", "your-api-key", "placeholder",
    "change-me", "changeme", "xxxx", "todo", "none", "null",
})


# ---------------------------------------------------------------------------
# Exceção específica para quota excedida
# Capturada pelo BenchmarkAgent para usar memória de nicho como fallback.
# ---------------------------------------------------------------------------

class YouTubeQuotaExceededError(RuntimeError):
    """
    Lançada quando a YouTube Data API retorna 403 quotaExceeded.
    Permite que o agente trate o caso especificamente sem crashar o fluxo.
    """


# ---------------------------------------------------------------------------
# Definições das tools para Claude tool_use
# ---------------------------------------------------------------------------

SEARCH_YOUTUBE_VIDEOS_TOOL: dict = {
    "name": "search_youtube_videos",
    "description": (
        "Busca vídeos no YouTube por relevância ou engajamento. "
        "Use para encontrar referências de criativos vencedores no nicho, "
        "vídeos virais de concorrentes e conteúdo com alto engajamento do público-alvo. "
        "Retorna video_id (necessário para buscar comentários e transcrição), "
        "título, descrição, contagem de visualizações, canal e data de publicação. "
        "Custa 100 unidades de quota da YouTube API — use com moderação."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": (
                    "Consulta de busca. Seja específico. "
                    "Exemplos: 'suplemento detox antes depois depoimento', "
                    "'emagrecimento relato real 2024'."
                ),
            },
            "max_results": {
                "type": "integer",
                "description": "Número de vídeos a retornar. Default 10, máximo 50.",
                "default": 10,
                "minimum": 1,
                "maximum": 50,
            },
            "order": {
                "type": "string",
                "enum": ["relevance", "viewCount", "date"],
                "default": "relevance",
                "description": (
                    "'relevance': mais relevantes para a query (padrão). "
                    "'viewCount': mais assistidos (útil para identificar criativos virais). "
                    "'date': mais recentes."
                ),
            },
        },
        "required": ["query"],
    },
}

GET_YOUTUBE_COMMENTS_TOOL: dict = {
    "name": "get_youtube_video_comments",
    "description": (
        "Extrai os comentários mais relevantes de um vídeo do YouTube. "
        "Use para capturar a linguagem real do público-alvo — expressões verbatim, "
        "dores, objeções e desejos escritos pelos próprios consumidores. "
        "Retorna texto do comentário, autor, curtidas e data. "
        "Se o vídeo tiver comentários desabilitados, retorna lista vazia sem erro. "
        "Custa apenas 1 unidade de quota."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "video_id": {
                "type": "string",
                "description": (
                    "ID do vídeo no YouTube (11 caracteres). "
                    "Obtido via search_youtube_videos ou da URL "
                    "youtube.com/watch?v={video_id}."
                ),
            },
            "max_results": {
                "type": "integer",
                "description": "Número de comentários a retornar. Default 100, máximo 100.",
                "default": 100,
                "minimum": 1,
                "maximum": 100,
            },
        },
        "required": ["video_id"],
    },
}

GET_YOUTUBE_TRANSCRIPT_TOOL: dict = {
    "name": "get_youtube_transcript",
    "description": (
        "Obtém a transcrição completa de um vídeo do YouTube. "
        "Use para extrair o roteiro de vídeos de referência, analisar estrutura narrativa "
        "e identificar hooks verbatim de criativos vencedores. "
        "Funciona com legendas automáticas e manuais em português e inglês. "
        "Retorna None se o vídeo não tiver legendas disponíveis. "
        "Não consome quota da YouTube API."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "video_id": {
                "type": "string",
                "description": (
                    "ID do vídeo no YouTube (11 caracteres). "
                    "Obtido via search_youtube_videos."
                ),
            },
        },
        "required": ["video_id"],
    },
}


# ---------------------------------------------------------------------------
# execute_search_youtube_videos
# ---------------------------------------------------------------------------

async def execute_search_youtube_videos(
    query: str,
    max_results: int = 10,
    order: str = "relevance",
) -> list[dict]:
    """
    Busca vídeos no YouTube e retorna metadados completos incluindo view_count.

    Faz duas chamadas à API:
      1. /search  (cost=100) — retorna IDs e dados básicos do snippet
      2. /videos  (cost=1)   — retorna estatísticas (view_count) em batch

    Args:
        query:       Consulta de busca.
        max_results: Número de resultados (1–50).
        order:       "relevance" | "viewCount" | "date".

    Returns:
        [{ video_id, title, description, view_count, channel_name, published_at }]

    Raises:
        YouTubeQuotaExceededError: quota diária excedida — agente usa niche memory.
        RuntimeError: outros erros de API.
    """
    max_results = max(1, min(max_results, 50))

    await _rate_limiter.acquire("youtube_data", cost=100)

    api_key = os.environ.get("YOUTUBE_API_KEY", "")
    if _is_placeholder(api_key):
        logger.debug("search_youtube_videos: chave placeholder — mock para %r", query)
        return _mock_videos(query, max_results)

    # Passo 1 — busca IDs e snippet
    search_items = await _search_request(query, max_results, order, api_key)
    if not search_items:
        return []

    video_ids = [
        item["id"]["videoId"]
        for item in search_items
        if item.get("id", {}).get("videoId")
    ]

    # Passo 2 — busca statistics em batch (cost=1, absorvido)
    stats_by_id = await _videos_statistics(video_ids, api_key)

    results = []
    for item in search_items:
        vid = item.get("id", {}).get("videoId", "")
        snippet = item.get("snippet", {})
        stats = stats_by_id.get(vid, {})
        results.append({
            "video_id":     vid,
            "title":        snippet.get("title", ""),
            "description":  snippet.get("description", ""),
            "channel_name": snippet.get("channelTitle", ""),
            "published_at": snippet.get("publishedAt", ""),
            "view_count":   int(stats.get("viewCount", 0)),
        })

    return results


async def _search_request(
    query: str, max_results: int, order: str, api_key: str
) -> list[dict]:
    params = {
        "part":       "snippet",
        "q":          query,
        "type":       "video",
        "maxResults": max_results,
        "order":      order,
        "key":        api_key,
    }
    data = await _youtube_get("/search", params)
    return data.get("items", [])


async def _videos_statistics(video_ids: list[str], api_key: str) -> dict[str, dict]:
    """Busca statistics de múltiplos vídeos em uma única chamada (cost=1)."""
    if not video_ids:
        return {}
    params = {
        "part": "statistics",
        "id":   ",".join(video_ids),
        "key":  api_key,
    }
    data = await _youtube_get("/videos", params)
    return {
        item["id"]: item.get("statistics", {})
        for item in data.get("items", [])
    }


# ---------------------------------------------------------------------------
# execute_get_youtube_comments
# ---------------------------------------------------------------------------

async def execute_get_youtube_comments(
    video_id: str,
    max_results: int = 100,
) -> list[dict]:
    """
    Extrai comentários de um vídeo do YouTube.

    Args:
        video_id:    ID do vídeo.
        max_results: Máximo de comentários (1–100).

    Returns:
        [{ author, text, like_count, published_at }]
        Lista vazia se comentários desabilitados.

    Raises:
        YouTubeQuotaExceededError: quota diária excedida.
        RuntimeError: outros erros de API.
    """
    max_results = max(1, min(max_results, 100))

    await _rate_limiter.acquire("youtube_data", cost=1)

    api_key = os.environ.get("YOUTUBE_API_KEY", "")
    if _is_placeholder(api_key):
        logger.debug("get_youtube_comments: chave placeholder — mock para %r", video_id)
        return _mock_comments(video_id, max_results)

    params = {
        "part":       "snippet",
        "videoId":    video_id,
        "maxResults": max_results,
        "order":      "relevance",
        "key":        api_key,
    }

    try:
        data = await _youtube_get("/commentThreads", params)
    except _CommentsDisabledError:
        logger.info(
            "get_youtube_comments: comentários desabilitados para vídeo %s", video_id
        )
        return []

    items = data.get("items", [])
    results = []
    for item in items:
        top = item.get("snippet", {}).get("topLevelComment", {}).get("snippet", {})
        results.append({
            "author":       top.get("authorDisplayName", ""),
            "text":         top.get("textDisplay", ""),
            "like_count":   int(top.get("likeCount", 0)),
            "published_at": top.get("publishedAt", ""),
        })
    return results


# ---------------------------------------------------------------------------
# execute_get_youtube_transcript
# ---------------------------------------------------------------------------

async def execute_get_youtube_transcript(video_id: str) -> dict | None:
    """
    Obtém a transcrição de um vídeo do YouTube.

    Usa youtube-transcript-api (sem consumo de quota da YouTube API).
    Tenta pt-BR → pt → en em ordem de preferência.

    Args:
        video_id: ID do vídeo.

    Returns:
        {
            "transcript":        str,   — texto completo concatenado
            "segments":          list[{ start, duration, text }],
            "language":          str,
            "is_auto_generated": bool,
        }
        None se o vídeo não tiver legendas disponíveis.
    """
    try:
        from youtube_transcript_api import (  # type: ignore[import]
            NoTranscriptFound,
            TranscriptsDisabled,
            YouTubeTranscriptApi,
        )
    except ImportError:
        logger.error(
            "get_youtube_transcript: youtube-transcript-api não instalado. "
            "Execute: pip install youtube-transcript-api"
        )
        return None

    try:
        transcript_list = YouTubeTranscriptApi.list(video_id)

        # Tenta pt-BR → pt → en → qualquer disponível
        transcript = None
        for lang in ("pt-BR", "pt", "en"):
            try:
                transcript = transcript_list.find_transcript([lang])
                break
            except NoTranscriptFound:
                continue

        if transcript is None:
            # Aceita qualquer disponível como último recurso
            all_codes = [t.language_code for t in transcript_list]
            if not all_codes:
                return None
            try:
                transcript = transcript_list.find_transcript([all_codes[0]])
            except NoTranscriptFound:
                return None

        raw_segments = list(transcript.fetch())
        segments = _normalize_yt_segments(raw_segments)
        full_text = " ".join(seg["text"] for seg in segments)

        return {
            "transcript":        full_text,
            "segments":          segments,
            "language":          transcript.language_code,
            "is_auto_generated": transcript.is_generated,
        }

    except TranscriptsDisabled:
        logger.info(
            "get_youtube_transcript: legendas desabilitadas para vídeo %s", video_id
        )
        return None
    except Exception as exc:
        logger.warning(
            "get_youtube_transcript: erro ao obter transcrição de %s — %s",
            video_id, exc,
        )
        return None


# ---------------------------------------------------------------------------
# execute_search_youtube_comments
# Atalho usado pelo PersonaBuilderAgent: busca vídeos e extrai comentários
# do primeiro resultado relevante em uma única chamada.
# ---------------------------------------------------------------------------

async def execute_search_youtube_comments(
    query: str,
    max_results: int = 50,
) -> list[dict]:
    """
    Combina execute_search_youtube_videos + execute_get_youtube_comments.

    Busca vídeos relacionados à query, seleciona o de maior view_count
    e retorna até max_results comentários.
    Retorna lista vazia se nenhum vídeo for encontrado ou comentários estiverem
    desabilitados — nunca lança exceção por ausência de conteúdo.

    Args:
        query:       Tema a pesquisar (ex: "relatos de quem perdeu peso").
        max_results: Número máximo de comentários a retornar.

    Returns:
        [{ "author", "text", "like_count", "published_at" }, ...]
    """
    # Busca os 5 vídeos mais relevantes (custo: 100 unidades de quota)
    videos = await execute_search_youtube_videos(query=query, max_results=5, order="relevance")
    if not videos:
        logger.debug(
            "search_youtube_comments: nenhum vídeo encontrado para %r",
            query,
        )
        return []

    # Seleciona o com mais views para maximizar a quantidade de comentários
    best = max(videos, key=lambda v: v.get("view_count", 0))
    video_id = best["video_id"]

    logger.debug(
        "search_youtube_comments: extraindo comentários de %s (%r)",
        video_id, best.get("title", "")[:60],
    )

    comments = await execute_get_youtube_comments(
        video_id=video_id,
        max_results=max_results,
    )
    return comments


# ---------------------------------------------------------------------------
# HTTP helper central para YouTube Data API v3
# ---------------------------------------------------------------------------

def _normalize_yt_segments(raw) -> list[dict]:
    """
    Converte segmentos do youtube-transcript-api para o formato PRD {start, end, text}.

    Compatível com dict (versões antigas) e FetchedTranscriptSnippet dataclass (v1.2.4+).
    """
    result = []
    for seg in raw:
        if isinstance(seg, dict):
            start = float(seg.get("start", 0))
            duration = float(seg.get("duration", 0))
            text = seg.get("text", "")
        else:  # FetchedTranscriptSnippet dataclass (v1.2.4+)
            start = float(getattr(seg, "start", 0))
            duration = float(getattr(seg, "duration", 0))
            text = getattr(seg, "text", "")
        result.append({
            "start": round(start, 2),
            "end":   round(start + duration, 2),
            "text":  text.strip(),
        })
    return result


class _CommentsDisabledError(Exception):
    """Sinaliza internamente que comentários estão desabilitados no vídeo."""


async def _youtube_get(endpoint: str, params: dict) -> dict:
    """
    Faz GET na YouTube Data API e trata erros de forma centralizada.

    Raises:
        YouTubeQuotaExceededError: 403 com reason quotaExceeded.
        _CommentsDisabledError:   403 com reason commentsDisabled.
        RuntimeError:             outros erros de API ou rede.
    """
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
            response = await client.get(_YOUTUBE_BASE + endpoint, params=params)
    except httpx.TimeoutException as exc:
        raise RuntimeError(
            f"YouTube API: timeout em {endpoint}."
        ) from exc
    except httpx.RequestError as exc:
        raise RuntimeError(
            f"YouTube API: falha de rede em {endpoint} — {exc}"
        ) from exc

    if response.status_code == 200:
        return response.json()

    # Trata erros semânticos do JSON de erro do YouTube
    if response.status_code in (400, 403, 404):
        try:
            error_body = response.json()
            errors = error_body.get("error", {}).get("errors", [])
            reason = errors[0].get("reason", "") if errors else ""
        except Exception:
            reason = ""

        if reason == "quotaExceeded":
            raise YouTubeQuotaExceededError(
                "YouTube Data API: quota diária de 10.000 unidades excedida. "
                "Usando memória de nicho como fallback."
            )
        if reason == "commentsDisabled":
            raise _CommentsDisabledError()
        if reason == "videoNotFound":
            raise RuntimeError(f"YouTube API: vídeo não encontrado em {endpoint}.")

    if response.status_code == 400:
        raise RuntimeError(
            f"YouTube API: requisição inválida em {endpoint} — {response.text[:300]}"
        )

    raise RuntimeError(
        f"YouTube API: HTTP {response.status_code} em {endpoint}."
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _is_placeholder(value: str) -> bool:
    return value.strip().lower() in _PLACEHOLDER_VALUES


# ---------------------------------------------------------------------------
# Dados mockados realistas
# ---------------------------------------------------------------------------

def _mock_videos(query: str, max_results: int) -> list[dict]:
    q = query.strip()
    now = datetime.now(UTC)

    templates = [
        {"title": f"{q.title()} — Minha Transformação em 30 Dias",
         "desc":  f"Neste vídeo mostro minha experiência real com {q}. Resultados surpreendentes.",
         "views": 1_240_000, "channel": "Vida Saudável Brasil"},
        {"title": f"VERDADE sobre {q.title()} — Funciona mesmo?",
         "desc":  f"Resolvi testar {q} por 60 dias. Veja o que aconteceu comigo.",
         "views": 876_500, "channel": "Canal da Mari"},
        {"title": f"{q.title()}: O Guia Definitivo 2024",
         "desc":  f"Tudo que você precisa saber sobre {q} explicado de forma simples.",
         "views": 543_200, "channel": "Dr. Saúde Online"},
        {"title": f"Como Perdi 15kg com {q.title()} SEM Academia",
         "desc":  f"Depoimento real de como {q} mudou minha vida. Método passo a passo.",
         "views": 432_100, "channel": "Motivação Fit"},
        {"title": f"CUIDADO com {q.title()} — O que ninguém te conta",
         "desc":  f"Antes de comprar {q} veja este vídeo. Informação importante.",
         "views": 389_700, "channel": "Alerta Saúde"},
        {"title": f"Review Honesto: {q.title()} Vale a Pena em 2024?",
         "desc":  f"Comprei e testei {q} durante um mês. Minha avaliação completa.",
         "views": 287_400, "channel": "Testa Comigo"},
        {"title": f"Receita Caseira com {q.title()} que Viralizo",
         "desc":  f"Combinação incrível usando {q} que todo mundo está fazendo.",
         "views": 198_300, "channel": "Receitas Naturais"},
        {"title": f"{q.title()} e Dieta Mediterrânea — Resultados Dobrados",
         "desc":  f"Aprenda a combinar {q} com alimentação saudável para mais resultados.",
         "views": 143_200, "channel": "Nutrição Prática"},
        {"title": f"Cientistas Descobriram: {q.title()} Funciona de Verdade",
         "desc":  f"Estudo recente comprova eficácia de {q}. Veja as evidências científicas.",
         "views": 97_600, "channel": "Ciência Explicada"},
        {"title": f"Médico Explica: {q.title()} tem Base Científica?",
         "desc":  f"Dr. João Silva analisa as evidências sobre {q} e dá sua opinião.",
         "views": 76_400, "channel": "Medicina de Verdade"},
    ]

    results = []
    for i, t in enumerate(templates[:max_results]):
        days_ago = (i + 1) * 37
        pub_date = datetime(
            now.year, now.month, 1, tzinfo=UTC
        ).isoformat().replace("+00:00", "Z")

        results.append({
            "video_id":     f"mock_{i + 1:03d}_yt_id",
            "title":        t["title"],
            "description":  t["desc"],
            "channel_name": t["channel"],
            "published_at": pub_date,
            "view_count":   t["views"],
        })

    return results


def _mock_comments(video_id: str, max_results: int) -> list[dict]:
    templates = [
        {"text": "Tentei de tudo para emagrecer e nada funcionava. Depois que comecei a usar fiquei impressionada com os resultados em tão pouco tempo!", "likes": 342},
        {"text": "Essa gordura teimosa do abdômen me incomodava há anos. Finalmente achei algo que realmente funciona para mim.", "likes": 287},
        {"text": "Minha médica ficou surpresa com os resultados no exame. Recomendo demais para quem está na mesma situação que eu estava.", "likes": 231},
        {"text": "Já tinha desistido de vez. Achei que era metabolismo lento mesmo. Mas resolvi tentar mais uma vez e agora não paro mais.", "likes": 198},
        {"text": "O que me convenceu foi que não precisei cortar o que gosto de comer. Só adicionei isso na minha rotina e o resultado veio.", "likes": 176},
        {"text": "Comprei desconfiada achando que era mais uma promessa. Me surpreendi demais. Vale cada centavo.", "likes": 154},
        {"text": "Tenho 47 anos e estava achando que nunca mais ia conseguir usar roupas menores. Que felicidade ter encontrado isso!", "likes": 143},
        {"text": "Comecei há 3 semanas e já sinto diferença nas roupas. Meu marido também notou a diferença e ele nunca fala nada kkk", "likes": 132},
        {"text": "Demorei pra acreditar mas os resultados falam por si só. Minhas amigas perguntam o segredo toda semana.", "likes": 118},
        {"text": "Fiz academia durante 2 anos sem resultado satisfatório. Em 6 semanas com isso consegui mais do que em 2 anos.", "likes": 97},
        {"text": "Quem tem problema de compulsão alimentar como eu vai entender o quanto é difícil. Isso me ajudou a controlar.", "likes": 89},
        {"text": "Estava com vergonha de ir à praia. Na semana passada fui e me senti confiante pela primeira vez em anos.", "likes": 78},
    ]

    results = []
    for i, t in enumerate(templates[:max_results]):
        results.append({
            "author":       f"Usuária Anônima {i + 1}",
            "text":         t["text"],
            "like_count":   t["likes"],
            "published_at": f"2024-0{(i % 9) + 1}-{(i % 28) + 1:02d}T10:00:00Z",
        })

    return results
