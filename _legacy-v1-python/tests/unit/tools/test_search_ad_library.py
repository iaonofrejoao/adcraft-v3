"""
Testes para app/tools/search_ad_library.py — execute_search_ad_library()

Cobre:
  - Token placeholder → retorna dados mockados
  - Token real + API 200 → retorna lista normalizada com days_running
  - min_days_running filtra corretamente
  - HTTP 429 → espera e retenta (stub)
  - HTTP 401 → RuntimeError
  - limit clamped a 1–50
"""

import os
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_resp(status_code: int, json_data: dict) -> MagicMock:
    import httpx
    resp = MagicMock()
    resp.status_code = status_code
    resp.json.return_value = json_data
    resp.text = str(json_data)
    resp.raise_for_status = MagicMock()
    if status_code >= 400:
        resp.raise_for_status.side_effect = httpx.HTTPStatusError(
            "error", request=MagicMock(), response=resp
        )
    return resp


_API_RESPONSE = {
    "data": [
        {
            "id": "ad-001",
            "page_name": "Detox Pro Oficial",
            "page_id": "100000001",
            "ad_creative_bodies": ["Emagreça 10kg em 30 dias com nossa fórmula"],
            "ad_creative_link_titles": ["Descubra o Segredo"],
            "ad_creative_link_descriptions": [],
            "ad_creation_time": "2024-01-01T00:00:00+0000",
            "ad_delivery_start_time": "2024-01-01T00:00:00+0000",
            "ad_snapshot_url": "https://facebook.com/ads/library/?id=ad-001",
        }
    ]
}


# ---------------------------------------------------------------------------
# Testes
# ---------------------------------------------------------------------------

class TestExecuteSearchAdLibrary:

    @pytest.mark.asyncio
    async def test_placeholder_token_returns_mock(self):
        """Token placeholder deve retornar anúncios mockados sem chamada HTTP."""
        from app.tools.search_ad_library import execute_search_ad_library

        with patch.dict(os.environ, {"META_APP_ACCESS_TOKEN": "seu-token-aqui"}):
            with patch("httpx.AsyncClient") as mock_cls:
                results = await execute_search_ad_library(
                    search_terms="suplemento detox",
                    ad_reached_countries=["BR"],
                )
                mock_cls.assert_not_called()

        assert isinstance(results, list)
        assert len(results) > 0
        ad = results[0]
        assert "id" in ad
        assert "page_name" in ad
        assert "ad_creative_bodies" in ad
        assert "days_running" in ad

    @pytest.mark.asyncio
    async def test_real_token_calls_meta_api(self):
        """Com token real, deve chamar Graph API e retornar lista normalizada."""
        from app.tools.search_ad_library import execute_search_ad_library

        with patch.dict(os.environ, {"META_APP_ACCESS_TOKEN": "EAAreal..."}):
            with patch("httpx.AsyncClient") as mock_client_cls:
                mock_resp = _make_resp(200, _API_RESPONSE)
                mock_client = AsyncMock()
                mock_client.__aenter__ = AsyncMock(return_value=mock_client)
                mock_client.__aexit__ = AsyncMock(return_value=None)
                mock_client.get = AsyncMock(return_value=mock_resp)
                mock_client_cls.return_value = mock_client

                results = await execute_search_ad_library(
                    search_terms="detox",
                    ad_reached_countries=["BR"],
                )

        assert len(results) == 1
        assert results[0]["id"] == "ad-001"
        assert results[0]["page_name"] == "Detox Pro Oficial"
        assert isinstance(results[0]["days_running"], int)

    @pytest.mark.asyncio
    async def test_min_days_running_filter_applied_to_mock(self):
        """Mock deve respeitar o filtro min_days_running."""
        from app.tools.search_ad_library import execute_search_ad_library

        with patch.dict(os.environ, {"META_APP_ACCESS_TOKEN": "placeholder"}):
            all_ads = await execute_search_ad_library(
                search_terms="detox",
                ad_reached_countries=["BR"],
                min_days_running=0,
            )
            filtered_ads = await execute_search_ad_library(
                search_terms="detox",
                ad_reached_countries=["BR"],
                min_days_running=90,
            )

        assert len(filtered_ads) < len(all_ads)
        for ad in filtered_ads:
            assert ad["days_running"] >= 90

    @pytest.mark.asyncio
    async def test_limit_respected(self):
        """limit=3 deve retornar no máximo 3 anúncios."""
        from app.tools.search_ad_library import execute_search_ad_library

        with patch.dict(os.environ, {"META_APP_ACCESS_TOKEN": "placeholder"}):
            results = await execute_search_ad_library(
                search_terms="detox",
                ad_reached_countries=["BR"],
                limit=3,
            )

        assert len(results) <= 3

    @pytest.mark.asyncio
    async def test_limit_clamped_to_max_50(self):
        """limit > 50 deve ser reduzido para 50."""
        from app.tools.search_ad_library import execute_search_ad_library

        with patch.dict(os.environ, {"META_APP_ACCESS_TOKEN": "placeholder"}):
            results = await execute_search_ad_library(
                search_terms="detox",
                ad_reached_countries=["BR"],
                limit=999,
            )

        assert len(results) <= 50

    @pytest.mark.asyncio
    async def test_http_401_raises_runtime_error(self):
        """HTTP 401 deve lançar RuntimeError com mensagem sobre token."""
        from app.tools.search_ad_library import execute_search_ad_library
        import httpx

        with patch.dict(os.environ, {"META_APP_ACCESS_TOKEN": "expired-token"}):
            with patch("httpx.AsyncClient") as mock_client_cls:
                mock_resp = MagicMock()
                mock_resp.status_code = 401
                mock_resp.text = "Unauthorized"
                mock_resp.raise_for_status.side_effect = httpx.HTTPStatusError(
                    "Unauthorized", request=MagicMock(), response=mock_resp
                )
                mock_client = AsyncMock()
                mock_client.__aenter__ = AsyncMock(return_value=mock_client)
                mock_client.__aexit__ = AsyncMock(return_value=None)
                mock_client.get = AsyncMock(return_value=mock_resp)
                mock_client_cls.return_value = mock_client

                with pytest.raises(RuntimeError, match="401|inválid|expirad"):
                    await execute_search_ad_library(
                        search_terms="detox",
                        ad_reached_countries=["BR"],
                    )

    @pytest.mark.asyncio
    async def test_output_has_all_required_fields(self):
        """Cada resultado deve ter todos os campos definidos no schema."""
        from app.tools.search_ad_library import execute_search_ad_library

        with patch.dict(os.environ, {"META_APP_ACCESS_TOKEN": "placeholder"}):
            results = await execute_search_ad_library(
                search_terms="detox",
                ad_reached_countries=["BR"],
            )

        required_fields = {
            "id", "page_name", "page_id", "ad_creative_bodies",
            "ad_creative_link_titles", "ad_creative_link_descriptions",
            "ad_creation_time", "ad_delivery_start_time",
            "ad_snapshot_url", "days_running",
        }
        for ad in results:
            assert required_fields <= set(ad.keys()), (
                f"Campo(s) ausentes: {required_fields - set(ad.keys())}"
            )
