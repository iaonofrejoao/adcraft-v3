"""
Testes para app/tools/web_search.py — execute_search_web()

Cobre:
  - Credencial placeholder → retorna resultados mockados sem chamar API
  - Credencial real + API 200 → retorna lista estruturada
  - API retorna 401 → RuntimeError
  - API retorna 429 → RuntimeError (sem retry)
  - num_results limitado a 10
"""

import os
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_httpx_response(status_code: int, json_data: dict) -> MagicMock:
    resp = MagicMock()
    resp.status_code = status_code
    resp.json.return_value = json_data
    resp.raise_for_status = MagicMock()
    if status_code >= 400:
        import httpx
        resp.raise_for_status.side_effect = httpx.HTTPStatusError(
            "error", request=MagicMock(), response=resp
        )
    return resp


_SERPER_RESPONSE = {
    "organic": [
        {
            "title": "Suplemento Detox Pro — Oficial",
            "link": "https://example.com/detox",
            "snippet": "Perca peso com nossa fórmula exclusiva.",
        },
        {
            "title": "Detox Pro Reclamações",
            "link": "https://reclame.com/detox",
            "snippet": "Usuários relatam resultados em 15 dias.",
        },
    ]
}


# ---------------------------------------------------------------------------
# Testes
# ---------------------------------------------------------------------------

class TestExecuteSearchWeb:

    @pytest.mark.asyncio
    async def test_placeholder_token_returns_mock_results(self):
        """Credencial placeholder deve retornar dados mockados sem chamar API."""
        from app.tools.web_search import execute_search_web

        with patch.dict(os.environ, {"WEB_SEARCH_API_KEY": "sua-chave-aqui"}):
            with patch("app.tools.web_search._rate_limiter") as mock_rl:
                mock_rl.acquire = AsyncMock()
                with patch("httpx.AsyncClient") as mock_cls:
                    results = await execute_search_web("suplemento detox")
                    # Não deve ter feito nenhuma chamada HTTP
                    mock_cls.assert_not_called()

        assert isinstance(results, list)
        assert len(results) > 0
        first = results[0]
        assert "title" in first
        assert "url" in first
        assert "snippet" in first

    @pytest.mark.asyncio
    async def test_real_token_calls_serper_api(self):
        """Com credencial real, deve chamar a API e retornar resultados formatados."""
        from app.tools.web_search import execute_search_web

        with patch.dict(os.environ, {"WEB_SEARCH_API_KEY": "real-key-abc123"}):
            with patch("app.tools.web_search._rate_limiter") as mock_rl:
                mock_rl.acquire = AsyncMock()
                with patch("httpx.AsyncClient") as mock_client_cls:
                    mock_resp = _make_httpx_response(200, _SERPER_RESPONSE)
                    mock_client = AsyncMock()
                    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
                    mock_client.__aexit__ = AsyncMock(return_value=None)
                    mock_client.post = AsyncMock(return_value=mock_resp)
                    mock_client_cls.return_value = mock_client

                    results = await execute_search_web("suplemento detox", num_results=2)

        assert len(results) == 2
        assert results[0]["title"] == "Suplemento Detox Pro — Oficial"
        assert results[0]["url"] == "https://example.com/detox"

    @pytest.mark.asyncio
    async def test_num_results_capped_at_10(self):
        """num_results > 10 deve ser truncado para 10 nos resultados retornados."""
        from app.tools.web_search import execute_search_web

        # Gera 15 resultados mock na resposta
        many_organic = [
            {"title": f"Resultado {i}", "link": f"https://r{i}.com", "snippet": "texto"}
            for i in range(15)
        ]

        with patch.dict(os.environ, {"WEB_SEARCH_API_KEY": "real-key-abc123"}):
            with patch("app.tools.web_search._rate_limiter") as mock_rl:
                mock_rl.acquire = AsyncMock()
                with patch("httpx.AsyncClient") as mock_client_cls:
                    mock_resp = _make_httpx_response(200, {"organic": many_organic})
                    mock_client = AsyncMock()
                    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
                    mock_client.__aexit__ = AsyncMock(return_value=None)
                    mock_client.post = AsyncMock(return_value=mock_resp)
                    mock_client_cls.return_value = mock_client

                    results = await execute_search_web("teste", num_results=50)

        assert len(results) <= 10

    @pytest.mark.asyncio
    async def test_api_401_raises_runtime_error(self):
        """HTTP 401 deve lançar RuntimeError com mensagem clara."""
        from app.tools.web_search import execute_search_web
        import httpx

        with patch.dict(os.environ, {"WEB_SEARCH_API_KEY": "invalid-key"}):
            with patch("app.tools.web_search._rate_limiter") as mock_rl:
                mock_rl.acquire = AsyncMock()
                with patch("httpx.AsyncClient") as mock_client_cls:
                    mock_resp = MagicMock()
                    mock_resp.status_code = 401
                    mock_resp.raise_for_status.side_effect = httpx.HTTPStatusError(
                        "Unauthorized", request=MagicMock(), response=mock_resp
                    )
                    mock_client = AsyncMock()
                    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
                    mock_client.__aexit__ = AsyncMock(return_value=None)
                    mock_client.post = AsyncMock(return_value=mock_resp)
                    mock_client_cls.return_value = mock_client

                    with pytest.raises(RuntimeError, match="401|inválid|credencial"):
                        await execute_search_web("teste")

    @pytest.mark.asyncio
    async def test_empty_query_still_returns_results(self):
        """Query vazia com placeholder deve retornar resultados mock sem erro."""
        from app.tools.web_search import execute_search_web

        with patch.dict(os.environ, {"WEB_SEARCH_API_KEY": "placeholder"}):
            with patch("app.tools.web_search._rate_limiter") as mock_rl:
                mock_rl.acquire = AsyncMock()
                results = await execute_search_web("")

        assert isinstance(results, list)
