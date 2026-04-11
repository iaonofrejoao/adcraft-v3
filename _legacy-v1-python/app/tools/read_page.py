"""
Tool: read_page

Acessa uma URL via HTTP direto e extrai conteúdo textual estruturado da página.
Conforme PRD seção 5 — sem chamadas a APIs externas.

Rate limit próprio: backoff de 2 s entre chamadas consecutivas ao mesmo domínio
(não passa pelo RateLimiter central, conforme PRD).
"""

import asyncio
import json
import logging
from datetime import UTC, datetime
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup, Tag

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Definição da tool para Claude tool_use
# ---------------------------------------------------------------------------

READ_PAGE_TOOL: dict = {
    "name": "read_page",
    "description": (
        "Acessa uma URL via HTTP e extrai o conteúdo textual estruturado da página. "
        "Ideal para ler páginas de venda, landing pages e páginas de produto afiliado. "
        "Retorna título, texto limpo e meta descrição. Em modo 'structured' inclui "
        "também dados JSON-LD (schema.org) e todas as meta tags. "
        "Se a página estiver indisponível ou retornar status ≠ 200, retorna "
        '{"error": "page_unavailable", "url": "..."} sem lançar exceção.'
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "url": {
                "type": "string",
                "description": (
                    "URL completa da página a ser lida, incluindo o esquema "
                    "(ex: https://exemplo.com/produto)."
                ),
            },
            "extract_mode": {
                "type": "string",
                "enum": ["text", "structured"],
                "default": "text",
                "description": (
                    "'text': retorna título, texto limpo e meta descrição (padrão). "
                    "'structured': inclui também dados JSON-LD e todas as meta tags."
                ),
            },
        },
        "required": ["url"],
    },
}


# ---------------------------------------------------------------------------
# Rate limiting por domínio
# PRD seção 5: backoff de 2 s entre chamadas consecutivas ao mesmo domínio.
# Controlado localmente — não usa o RateLimiter central.
# ---------------------------------------------------------------------------

_last_call_by_domain: dict[str, datetime] = {}
_DOMAIN_BACKOFF_SECONDS: float = 2.0


# ---------------------------------------------------------------------------
# Constantes de requisição
# ---------------------------------------------------------------------------

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; AdCraftBot/1.0; +https://adcraft.app/bot)"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
}
_TIMEOUT_SECONDS: float = 15.0
_MAX_CONTENT_BYTES: int = 5 * 1024 * 1024  # 5 MB — evita páginas enormes


# ---------------------------------------------------------------------------
# Função principal
# ---------------------------------------------------------------------------

async def execute_read_page(
    url: str,
    extract_mode: str = "text",
) -> dict:
    """
    Executa a tool read_page: baixa a URL e extrai conteúdo estruturado.

    Chamada pelo dispatcher de tools quando o agente usa read_page.

    Args:
        url:          URL da página a ser lida.
        extract_mode: "text" (padrão) ou "structured".

    Returns:
        Sucesso — extract_mode="text":
            {
                "title":            str,
                "text":             str,
                "meta_description": str,
            }
        Sucesso — extract_mode="structured":
            {
                "title":            str,
                "text":             str,
                "meta_description": str,
                "structured_data":  {
                    "json_ld":   list[dict],   # blocos application/ld+json
                    "meta_tags": dict[str, str],
                }
            }
        Falha:
            { "error": "page_unavailable", "url": str, "reason": str }
    """
    domain = _extract_domain(url)
    await _apply_domain_backoff(domain)

    try:
        async with httpx.AsyncClient(
            headers=_HEADERS,
            follow_redirects=True,
            timeout=_TIMEOUT_SECONDS,
        ) as client:
            response = await client.get(url)

    except httpx.TimeoutException:
        logger.warning("read_page: timeout ao acessar %s", url)
        return {"error": "page_unavailable", "url": url, "reason": "timeout"}
    except httpx.RequestError as exc:
        logger.warning("read_page: erro de rede em %s — %s", url, exc)
        return {"error": "page_unavailable", "url": url, "reason": str(exc)}

    if response.status_code != 200:
        logger.warning("read_page: status %d para %s", response.status_code, url)
        return {
            "error": "page_unavailable",
            "url": url,
            "reason": f"HTTP {response.status_code}",
        }

    content = response.text[:_MAX_CONTENT_BYTES]
    soup = BeautifulSoup(content, "html.parser")

    result: dict = {
        "title":            _extract_title(soup),
        "text":             _extract_text(soup),
        "meta_description": _extract_meta(soup, "description"),
    }

    if extract_mode == "structured":
        result["structured_data"] = {
            "json_ld":   _extract_json_ld(soup),
            "meta_tags": _extract_all_meta(soup),
        }

    return result


# ---------------------------------------------------------------------------
# Helpers de domínio e backoff
# ---------------------------------------------------------------------------

def _extract_domain(url: str) -> str:
    try:
        return urlparse(url).netloc.lower()
    except Exception:
        return url


async def _apply_domain_backoff(domain: str) -> None:
    """
    Aguarda _DOMAIN_BACKOFF_SECONDS entre chamadas consecutivas ao mesmo domínio.
    Evita bloqueio por rate limiting do servidor alvo.
    """
    last = _last_call_by_domain.get(domain)
    if last is not None:
        elapsed = (datetime.now(UTC) - last).total_seconds()
        if elapsed < _DOMAIN_BACKOFF_SECONDS:
            await asyncio.sleep(_DOMAIN_BACKOFF_SECONDS - elapsed)
    _last_call_by_domain[domain] = datetime.now(UTC)


# ---------------------------------------------------------------------------
# Helpers de extração HTML
# ---------------------------------------------------------------------------

def _extract_title(soup: BeautifulSoup) -> str:
    tag = soup.find("title")
    return tag.get_text(strip=True) if tag else ""


def _extract_meta(soup: BeautifulSoup, name: str) -> str:
    """Extrai meta tag por name, com fallback para og:{name}."""
    tag = soup.find("meta", attrs={"name": name})
    if tag and isinstance(tag, Tag):
        return str(tag.get("content", ""))
    tag = soup.find("meta", attrs={"property": f"og:{name}"})
    if tag and isinstance(tag, Tag):
        return str(tag.get("content", ""))
    return ""


def _extract_text(soup: BeautifulSoup) -> str:
    """
    Extrai texto limpo removendo scripts, estilos e elementos de navegação.
    Preserva a ordem de leitura natural do conteúdo principal.
    """
    for tag in soup(["script", "style", "noscript", "nav", "footer", "header", "aside"]):
        if tag.get("type") == "application/ld+json":
            continue  # JSON-LD scripts are needed by _extract_json_ld — preserve them
        tag.decompose()

    raw = soup.get_text(separator="\n", strip=True)
    lines = [line for line in raw.splitlines() if line.strip()]
    return "\n".join(lines)


def _extract_json_ld(soup: BeautifulSoup) -> list[dict]:
    """
    Extrai todos os blocos JSON-LD da página.
    Usado para obter dados estruturados de schema.org (Product, Offer, etc.).
    """
    results = []
    for tag in soup.find_all("script", attrs={"type": "application/ld+json"}):
        try:
            data = json.loads(tag.string or "")
            results.append(data)
        except (json.JSONDecodeError, TypeError):
            pass
    return results


def _extract_all_meta(soup: BeautifulSoup) -> dict[str, str]:
    """Extrai todas as meta tags como {name|property: content}."""
    meta: dict[str, str] = {}
    for tag in soup.find_all("meta"):
        if not isinstance(tag, Tag):
            continue
        key = tag.get("name") or tag.get("property") or tag.get("http-equiv")
        value = tag.get("content", "")
        if key and value:
            meta[str(key)] = str(value)
    return meta
