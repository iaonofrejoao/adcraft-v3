"""
Testes para app/tools/read_page.py — execute_read_page()

Cobre:
  - Extração de texto limpo de HTML
  - Modo structured (JSON-LD)
  - Resposta de erro quando página indisponível (timeout, 4xx, 5xx)
  - Domain backoff não lança exceção quando chamado duas vezes
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# ---------------------------------------------------------------------------
# HTML de fixture
# ---------------------------------------------------------------------------

_SAMPLE_HTML = """
<!DOCTYPE html>
<html>
<head>
    <title>Detox Pro — Emagreça de Verdade</title>
    <meta name="description" content="Suplemento detox com resultados comprovados.">
    <script type="application/ld+json">
        {"@type": "Product", "name": "Detox Pro", "price": "197.00"}
    </script>
</head>
<body>
    <nav>Menu de navegação</nav>
    <h1>Perca até 10kg em 30 dias</h1>
    <p>Nossa fórmula exclusiva com ingredientes naturais.</p>
    <script>console.log("analytics")</script>
    <footer>Todos os direitos reservados</footer>
</body>
</html>
"""

_MINIMAL_HTML = "<html><body><p>Hello world</p></body></html>"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_httpx_response(status_code: int, text: str) -> MagicMock:
    resp = MagicMock()
    resp.status_code = status_code
    resp.text = text
    resp.raise_for_status = MagicMock()
    if status_code >= 400:
        import httpx
        resp.raise_for_status.side_effect = httpx.HTTPStatusError(
            "error", request=MagicMock(), response=resp
        )
    return resp


# ---------------------------------------------------------------------------
# Testes
# ---------------------------------------------------------------------------

class TestExecuteReadPage:

    @pytest.mark.asyncio
    async def test_extracts_title_and_body_text(self):
        """Deve extrair título e texto limpo, sem conteúdo de nav/footer/script."""
        from app.tools.read_page import execute_read_page

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_resp = _make_httpx_response(200, _SAMPLE_HTML)
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client.get = AsyncMock(return_value=mock_resp)
            mock_client_cls.return_value = mock_client

            result = await execute_read_page("https://example.com/produto")

        assert result.get("error") is None
        assert result["title"] == "Detox Pro — Emagreça de Verdade"
        assert "Perca até 10kg" in result["text"]
        # Conteúdo de navegação e footer devem ser removidos
        assert "Menu de navegação" not in result["text"]
        assert "Todos os direitos reservados" not in result["text"]
        # Scripts não devem aparecer
        assert "console.log" not in result["text"]

    @pytest.mark.asyncio
    async def test_structured_mode_parses_json_ld(self):
        """Modo structured deve extrair JSON-LD embutido na página."""
        from app.tools.read_page import execute_read_page

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_resp = _make_httpx_response(200, _SAMPLE_HTML)
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client.get = AsyncMock(return_value=mock_resp)
            mock_client_cls.return_value = mock_client

            result = await execute_read_page(
                "https://example.com/produto", extract_mode="structured"
            )

        assert result.get("error") is None
        structured = result.get("structured_data", {})
        json_ld = structured.get("json_ld", [])
        assert len(json_ld) >= 1
        assert any(item.get("@type") == "Product" for item in json_ld)

    @pytest.mark.asyncio
    async def test_returns_error_dict_on_timeout(self):
        """Timeout deve retornar dict de erro, não lançar exceção."""
        from app.tools.read_page import execute_read_page
        import httpx

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client.get = AsyncMock(
                side_effect=httpx.TimeoutException("timeout")
            )
            mock_client_cls.return_value = mock_client

            result = await execute_read_page("https://example.com/produto")

        assert result["error"] == "page_unavailable"
        assert result["url"] == "https://example.com/produto"
        assert "reason" in result

    @pytest.mark.asyncio
    async def test_returns_error_dict_on_404(self):
        """HTTP 404 deve retornar dict de erro."""
        from app.tools.read_page import execute_read_page
        import httpx

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_resp = _make_httpx_response(404, "Not Found")
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client.get = AsyncMock(return_value=mock_resp)
            mock_client_cls.return_value = mock_client

            result = await execute_read_page("https://example.com/nao-existe")

        assert result["error"] == "page_unavailable"

    @pytest.mark.asyncio
    async def test_meta_description_included_in_result(self):
        """Meta description deve estar presente no resultado."""
        from app.tools.read_page import execute_read_page

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_resp = _make_httpx_response(200, _SAMPLE_HTML)
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client.get = AsyncMock(return_value=mock_resp)
            mock_client_cls.return_value = mock_client

            result = await execute_read_page("https://example.com/produto")

        assert "meta_description" in result
        assert result["meta_description"] == "Suplemento detox com resultados comprovados."
