"""
Tool: search_ad_library

Busca anúncios ativos na Meta Ad Library (Facebook/Instagram).
Conforme PRD seção 5 e skill api-integration.md.

Autenticação: META_APP_ACCESS_TOKEN — app token (sem OAuth de usuário).
Rate limit:   RateLimiter central, chave "meta_ad_library", 60 req/hora.
Erro 429:     backoff + 1 retry (quota gerida pelo RateLimiter antes da chamada).
Outros erros: para e notifica (RuntimeError).
"""

import asyncio
import logging
import os
from datetime import UTC, datetime, timedelta

import httpx

from app.orchestration.rate_limiter import RateLimiter

logger = logging.getLogger(__name__)

_rate_limiter = RateLimiter()

# ---------------------------------------------------------------------------
# Definição da tool para Claude tool_use
# ---------------------------------------------------------------------------

SEARCH_AD_LIBRARY_TOOL: dict = {
    "name": "search_ad_library",
    "description": (
        "Busca anúncios ativos na Meta Ad Library (Facebook e Instagram). "
        "Use para identificar ângulos e formatos que os concorrentes estão usando, "
        "descobrir anúncios com longa duração de exibição (indicativo de lucro) e "
        "coletar referências de criativos vencedores no nicho. "
        "Não retorna métricas de performance (spend, alcance) — esses dados são privados. "
        "Retorna copy, data de criação, página anunciante e URL do preview do anúncio."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "search_terms": {
                "type": "string",
                "description": (
                    "Termo de busca para encontrar anúncios. "
                    "Use o nome do produto, nicho ou palavra-chave do mercado. "
                    "Exemplos: 'suplemento detox', 'curso emagrecimento', 'creatina'."
                ),
            },
            "ad_reached_countries": {
                "type": "array",
                "items": {"type": "string"},
                "description": (
                    "Lista de códigos de país ISO 3166-1 alpha-2 onde o anúncio foi exibido. "
                    "Exemplos: ['BR'], ['BR', 'PT'], ['US']. Obrigatório."
                ),
            },
            "min_days_running": {
                "type": "integer",
                "description": (
                    "Filtra apenas anúncios rodando há pelo menos este número de dias. "
                    "Anúncios com longa duração são indicativos de campanhas lucrativas. "
                    "Default 0 (sem filtro). Use 30 para benchmarks de criativos vencedores."
                ),
                "default": 0,
                "minimum": 0,
            },
            "limit": {
                "type": "integer",
                "description": "Número máximo de anúncios a retornar. Default 20, máximo 50.",
                "default": 20,
                "minimum": 1,
                "maximum": 50,
            },
        },
        "required": ["search_terms", "ad_reached_countries"],
    },
}


# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------

_AD_LIBRARY_URL = "https://graph.facebook.com/v19.0/ads_archive"
_TIMEOUT_SECONDS: float = 15.0
_RETRY_WAIT_SECONDS: float = 60.0  # espera após 429 antes de 1 retry

_DEFAULT_FIELDS = [
    "id",
    "ad_creation_time",
    "ad_delivery_start_time",
    "ad_creative_bodies",
    "ad_creative_link_descriptions",
    "ad_creative_link_titles",
    "ad_snapshot_url",
    "page_name",
    "page_id",
]

_PLACEHOLDER_VALUES = frozenset({
    "",
    "seu-token-aqui",
    "your-token-here",
    "placeholder",
    "change-me",
    "changeme",
    "xxxx",
    "todo",
    "none",
    "null",
})


def _is_placeholder(value: str) -> bool:
    return value.strip().lower() in _PLACEHOLDER_VALUES


# ---------------------------------------------------------------------------
# Função principal
# ---------------------------------------------------------------------------

async def execute_search_ad_library(
    search_terms: str,
    ad_reached_countries: list[str],
    min_days_running: int = 0,
    limit: int = 20,
) -> list[dict]:
    """
    Executa a tool search_ad_library.

    Args:
        search_terms:         Termo de busca para a Ad Library.
        ad_reached_countries: Países onde o anúncio foi exibido (ISO 3166-1 alpha-2).
        min_days_running:     Filtro pós-chamada: mantém apenas anúncios com
                              ad_delivery_start_time <= hoje - min_days_running.
        limit:                Máximo de resultados retornados.

    Returns:
        Lista de dicts com campos: id, page_name, ad_creative_bodies,
        ad_creative_link_titles, ad_creation_time, ad_delivery_start_time,
        ad_snapshot_url, page_id, days_running.

    Raises:
        RuntimeError: em erros permanentes (4xx exceto 429, 5xx).
    """
    limit = max(1, min(limit, 50))

    await _rate_limiter.acquire("meta_ad_library", cost=1)

    token = os.environ.get("META_APP_ACCESS_TOKEN", "")

    if _is_placeholder(token):
        logger.debug(
            "search_ad_library: token placeholder — retornando mock para %r",
            search_terms,
        )
        return _mock_results(search_terms, ad_reached_countries, min_days_running, limit)

    results = await _call_ad_library(search_terms, ad_reached_countries, limit, token)

    if min_days_running > 0:
        results = _filter_by_days_running(results, min_days_running)

    return results[:limit]


# ---------------------------------------------------------------------------
# Chamada à Meta Ad Library API
# ---------------------------------------------------------------------------

async def _call_ad_library(
    search_terms: str,
    countries: list[str],
    limit: int,
    token: str,
) -> list[dict]:
    """
    Faz GET /ads_archive com retry único em caso de 429.
    Levanta RuntimeError para erros permanentes.
    """
    params = {
        "search_terms":        search_terms,
        "ad_reached_countries": ",".join(countries),
        "ad_type":             "ALL",
        "fields":              ",".join(_DEFAULT_FIELDS),
        "limit":               limit,
        "access_token":        token,
    }

    for attempt in (1, 2):
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
                response = await client.get(_AD_LIBRARY_URL, params=params)
        except httpx.TimeoutException as exc:
            raise RuntimeError(
                f"search_ad_library: timeout ao chamar Meta Ad Library API."
            ) from exc
        except httpx.RequestError as exc:
            raise RuntimeError(
                f"search_ad_library: falha de rede — {exc}"
            ) from exc

        if response.status_code == 200:
            break

        if response.status_code == 429 and attempt == 1:
            logger.warning(
                "search_ad_library: HTTP 429 recebido — aguardando %.0fs antes de retry.",
                _RETRY_WAIT_SECONDS,
            )
            await asyncio.sleep(_RETRY_WAIT_SECONDS)
            continue

        if response.status_code == 401:
            raise RuntimeError(
                "search_ad_library: META_APP_ACCESS_TOKEN inválido ou expirado (HTTP 401)."
            )
        if response.status_code == 403:
            raise RuntimeError(
                "search_ad_library: acesso negado à Ad Library API (HTTP 403). "
                "Verifique se o app tem permissão 'ads_read'."
            )

        raise RuntimeError(
            f"search_ad_library: Meta Ad Library API retornou HTTP {response.status_code}. "
            f"Body: {response.text[:300]}"
        )

    data: list[dict] = response.json().get("data", [])
    return [_normalize(ad) for ad in data]


def _normalize(ad: dict) -> dict:
    """Normaliza um item da API para o formato de output da tool."""
    return {
        "id":                         ad.get("id", ""),
        "page_name":                  ad.get("page_name", ""),
        "page_id":                    ad.get("page_id", ""),
        "ad_creative_bodies":         ad.get("ad_creative_bodies") or [],
        "ad_creative_link_titles":    ad.get("ad_creative_link_titles") or [],
        "ad_creative_link_descriptions": ad.get("ad_creative_link_descriptions") or [],
        "ad_creation_time":           ad.get("ad_creation_time", ""),
        "ad_delivery_start_time":     ad.get("ad_delivery_start_time", ""),
        "ad_snapshot_url":            ad.get("ad_snapshot_url", ""),
        "days_running":               _calc_days_running(ad.get("ad_delivery_start_time")),
    }


def _calc_days_running(start_time: str | None) -> int:
    """Calcula quantos dias o anúncio está rodando a partir da data de início."""
    if not start_time:
        return 0
    try:
        start = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
        return (datetime.now(UTC) - start).days
    except (ValueError, TypeError):
        return 0


def _filter_by_days_running(ads: list[dict], min_days: int) -> list[dict]:
    """Mantém apenas anúncios com days_running >= min_days."""
    return [ad for ad in ads if ad.get("days_running", 0) >= min_days]


# ---------------------------------------------------------------------------
# Dados mockados realistas
# ---------------------------------------------------------------------------

def _mock_results(
    search_terms: str,
    countries: list[str],
    min_days_running: int,
    limit: int,
) -> list[dict]:
    """
    Retorna anúncios mockados coerentes com o formato real da API.
    Inclui variação de dias rodando para testar o filtro min_days_running.
    """
    country = countries[0] if countries else "BR"
    now = datetime.now(UTC)
    q = search_terms.strip()

    templates = [
        {
            "days": 92,
            "page": f"Suplementos {q.title()} Oficial",
            "bodies": [
                f"Você já tentou de tudo para {q} e não funcionou? "
                "Conheça o método que está transformando a vida de milhares de brasileiros.",
            ],
            "titles": [f"Descubra o Segredo de {q.title()}"],
        },
        {
            "days": 61,
            "page": f"{q.title()} Pro",
            "bodies": [
                f"Médicos estão surpresos com os resultados de {q}. "
                "Veja o que a ciência descobriu recentemente.",
            ],
            "titles": [f"Resultado com {q.title()} em 30 Dias"],
        },
        {
            "days": 45,
            "page": f"Saúde & {q.title()}",
            "bodies": [
                f"Atenção: se você tem {q} e ainda não conhece esta solução, "
                "está perdendo tempo e dinheiro.",
            ],
            "titles": [f"A Verdade sobre {q.title()}"],
        },
        {
            "days": 33,
            "page": f"Academia {q.title()}",
            "bodies": [
                f"Nossa cliente Maria perdeu 12 kg usando {q} sem academia e sem dieta radical. "
                "Veja o depoimento dela.",
            ],
            "titles": [f"Como {q.title()} Mudou Minha Vida"],
        },
        {
            "days": 28,
            "page": f"{q.title()} Natural Brasil",
            "bodies": [
                f"Fórmula exclusiva de {q} com ingredientes 100% naturais. "
                "Sem contraindicações. Aprovado pela ANVISA.",
            ],
            "titles": [f"{q.title()} 100% Natural — Sem Efeitos Colaterais"],
        },
        {
            "days": 21,
            "page": f"Programa {q.title()}",
            "bodies": [
                f"Por que {q} funciona quando outras opções falham? "
                "A resposta está na composição exclusiva desta fórmula.",
            ],
            "titles": [f"A Ciência por Trás de {q.title()}"],
        },
        {
            "days": 14,
            "page": f"{q.title()} Premium",
            "bodies": [
                f"Promoção por tempo limitado: leve 3 {q} e pague 2. "
                "Garantia de 30 dias ou seu dinheiro de volta.",
            ],
            "titles": [f"Oferta Especial — {q.title()} com 33% OFF"],
        },
        {
            "days": 7,
            "page": f"Loja {q.title()}",
            "bodies": [
                f"Novidade: {q} em nova versão turbinada com dose dupla de ativos. "
                "Resultados visíveis em apenas 15 dias.",
            ],
            "titles": [f"Lançamento: Novo {q.title()} Versão 2.0"],
        },
    ]

    results = []
    for i, t in enumerate(templates):
        days = t["days"]
        start_date = now - timedelta(days=days)

        results.append({
            "id":                         f"mock_ad_{i + 1:04d}_{country.lower()}",
            "page_name":                  t["page"],
            "page_id":                    f"10000000{i + 1}",
            "ad_creative_bodies":         t["bodies"],
            "ad_creative_link_titles":    t["titles"],
            "ad_creative_link_descriptions": [],
            "ad_creation_time":           start_date.strftime("%Y-%m-%dT%H:%M:%S+0000"),
            "ad_delivery_start_time":     start_date.strftime("%Y-%m-%dT%H:%M:%S+0000"),
            "ad_snapshot_url":            f"https://www.facebook.com/ads/library/?id=mock_ad_{i + 1:04d}",
            "days_running":               days,
        })

    if min_days_running > 0:
        results = _filter_by_days_running(results, min_days_running)

    return results[:limit]
