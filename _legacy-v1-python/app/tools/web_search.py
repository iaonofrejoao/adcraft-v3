"""
Tool: search_web

Realiza busca na web e retorna resultados estruturados.
Conforme PRD seção 5 — usa Serper API por padrão (configurável via WEB_SEARCH_PROVIDER).

Rate limit: gerenciado pelo RateLimiter central com chave "web_search".
Credencial: WEB_SEARCH_API_KEY em variável de ambiente.
Se a credencial for placeholder, retorna dados mockados realistas
para que o desenvolvimento local funcione sem custo de API.
"""

import logging
import os

import httpx

from app.orchestration.rate_limiter import RateLimiter

logger = logging.getLogger(__name__)

# Singleton compartilhado entre chamadas — mantém o contador de quota correto.
_rate_limiter = RateLimiter()


# ---------------------------------------------------------------------------
# Definição da tool para Claude tool_use
# ---------------------------------------------------------------------------

WEB_SEARCH_TOOL: dict = {
    "name": "search_web",
    "description": (
        "Realiza busca na web e retorna lista de resultados relevantes. "
        "Use para pesquisar informações sobre mercados, produtos, concorrentes, "
        "tendências de nicho e qualquer dado factual externo ao contexto. "
        "Toda afirmação factual deve ser embasada em resultados desta tool — "
        "nunca invente dados que deveriam vir de uma busca real."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": (
                    "Consulta de busca. Seja específico — 2 a 6 palavras produzem "
                    "os melhores resultados. "
                    "Exemplos: 'suplemento detox mercado brasil 2024', "
                    "'anúncios emagrecimento facebook concorrentes'."
                ),
            },
            "num_results": {
                "type": "integer",
                "description": "Número de resultados a retornar. Default 5, máximo 10.",
                "default": 5,
                "minimum": 1,
                "maximum": 10,
            },
        },
        "required": ["query"],
    },
}


# ---------------------------------------------------------------------------
# Detecção de credencial placeholder
# ---------------------------------------------------------------------------

_PLACEHOLDER_VALUES = frozenset({
    "",
    "sua-chave-aqui",
    "your-key-here",
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
# Constantes de requisição
# ---------------------------------------------------------------------------

_SERPER_URL = "https://google.serper.dev/search"
_TIMEOUT_SECONDS: float = 10.0


# ---------------------------------------------------------------------------
# Função principal
# ---------------------------------------------------------------------------

async def execute_search_web(
    query: str,
    num_results: int = 5,
) -> list[dict]:
    """
    Executa a tool search_web.

    Chamada pelo dispatcher de tools quando o agente usa search_web.

    Args:
        query:       Consulta de busca.
        num_results: Número de resultados (1–10, default 5).

    Returns:
        Lista de dicts: [{ "title": str, "url": str, "snippet": str }]

    Raises:
        RuntimeError: se a API estiver indisponível (conforme PRD — sem fallback).
    """
    num_results = max(1, min(num_results, 10))

    await _rate_limiter.acquire("web_search", cost=1)

    api_key = os.environ.get("WEB_SEARCH_API_KEY", "")

    if _is_placeholder(api_key):
        logger.debug(
            "search_web: credencial placeholder — retornando mock para %r", query
        )
        return _mock_results(query, num_results)

    return await _call_serper(query, num_results, api_key)


# ---------------------------------------------------------------------------
# Implementação — Serper API
# ---------------------------------------------------------------------------

async def _call_serper(query: str, num_results: int, api_key: str) -> list[dict]:
    """Chama a Serper API e normaliza os resultados para o formato da tool."""
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
            response = await client.post(
                _SERPER_URL,
                headers={
                    "X-API-KEY": api_key,
                    "Content-Type": "application/json",
                },
                json={"q": query, "num": num_results},
            )
    except httpx.TimeoutException as exc:
        raise RuntimeError(
            f"search_web: timeout ao chamar Serper API para query {query!r}."
        ) from exc
    except httpx.RequestError as exc:
        raise RuntimeError(
            f"search_web: falha de rede ao chamar Serper API — {exc}"
        ) from exc

    if response.status_code == 401:
        raise RuntimeError(
            "search_web: credencial WEB_SEARCH_API_KEY inválida ou expirada (HTTP 401)."
        )
    if response.status_code == 429:
        raise RuntimeError(
            "search_web: quota da Serper API esgotada (HTTP 429). "
            "Aguarde o reset da janela ou aumente o plano."
        )
    if response.status_code != 200:
        raise RuntimeError(
            f"search_web: Serper API retornou HTTP {response.status_code}."
        )

    organic: list[dict] = response.json().get("organic", [])

    return [
        {
            "title":   item.get("title", ""),
            "url":     item.get("link", ""),
            "snippet": item.get("snippet", ""),
        }
        for item in organic[:num_results]
    ]


# ---------------------------------------------------------------------------
# Dados mockados realistas
# Usados quando WEB_SEARCH_API_KEY é placeholder — desenvolvimento sem custo.
# ---------------------------------------------------------------------------

def _mock_results(query: str, num_results: int) -> list[dict]:
    """
    Retorna resultados mockados coerentes com o padrão real da API.
    O conteúdo é genérico mas suficientemente realista para que os agentes
    produzam outputs estruturalmente corretos durante o desenvolvimento.
    """
    q = query.strip()
    q_title = q.title()

    templates = [
        {
            "title":   f"{q_title} — Guia Completo 2024",
            "url":     "https://exemplo.com/guia-completo",
            "snippet": (
                f"Tudo o que você precisa saber sobre {q}. "
                "Análise detalhada do mercado, principais players e tendências para 2024."
            ),
        },
        {
            "title":   f"Mercado de {q_title}: Crescimento e Oportunidades",
            "url":     "https://mercadoanalytics.com.br/relatorio",
            "snippet": (
                f"O mercado de {q} apresentou crescimento de 23% em 2023. "
                "Saiba quais produtos lideram as vendas e como se posicionar."
            ),
        },
        {
            "title":   f"Os Melhores Produtos de {q_title} — Ranking Atualizado",
            "url":     "https://rankingprodutos.com.br/lista",
            "snippet": (
                f"Comparativo dos principais produtos de {q} no mercado brasileiro. "
                "Avaliações de consumidores e análise de custo-benefício."
            ),
        },
        {
            "title":   f"{q_title}: O que os Consumidores Dizem",
            "url":     "https://forum.consumidor.com.br/topico",
            "snippet": (
                f"Mais de 1.200 comentários sobre {q}. "
                "Experiências reais, reclamações frequentes e recomendações de quem usou."
            ),
        },
        {
            "title":   f"Como Funciona {q_title} — Evidências e Análise",
            "url":     "https://saude.portal.com.br/artigo",
            "snippet": (
                f"Especialistas explicam o mecanismo de {q} e quais evidências "
                "suportam seu uso. Indicações e contraindicações detalhadas."
            ),
        },
        {
            "title":   f"{q_title} no Facebook Ads — Estratégias que Funcionam",
            "url":     "https://marketingdigital.com.br/facebook-ads",
            "snippet": (
                f"Análise dos anúncios mais eficazes para {q} no Facebook e Instagram. "
                "Ângulos, hooks e formatos com melhor desempenho em 2024."
            ),
        },
        {
            "title":   f"Afiliados de {q_title}: Comissões e Taxa de Conversão",
            "url":     "https://hotmart.com/mercado",
            "snippet": (
                f"Produtos de {q} com maiores comissões e melhores taxas de conversão "
                "nas plataformas de afiliados brasileiras."
            ),
        },
        {
            "title":   f"Tendência de Busca: {q_title} — Google Trends Brasil",
            "url":     "https://trends.google.com.br/trends/explore",
            "snippet": (
                f"Análise da tendência de busca para {q} no Brasil nos últimos 12 meses. "
                "Picos de interesse, sazonalidade e regiões com maior volume."
            ),
        },
        {
            "title":   f"Review: {q_title} Vale a Pena?",
            "url":     "https://reviewhonesto.com.br/analise",
            "snippet": (
                f"Testamos {q} por 30 dias. Análise imparcial: "
                "pontos positivos, negativos e para quem realmente é indicado."
            ),
        },
        {
            "title":   f"{q_title} — Preço, Onde Comprar e Composição",
            "url":     "https://buscaprecos.com.br/produto",
            "snippet": (
                f"Informações completas sobre {q}: preço médio no mercado, "
                "principais pontos de venda online e composição detalhada."
            ),
        },
    ]

    return templates[:num_results]
