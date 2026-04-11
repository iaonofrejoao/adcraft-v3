"""
Testes para app/tools/generate_image.py — execute_generate_image()

Cobre:
  - MockProvider retorna lista de dicts com image_bytes e format
  - quantity clampado entre 1 e 10
  - Provedor desconhecido lança RuntimeError
  - FluxProvider sem FLUX_API_KEY lança RuntimeError
  - IdeogramProvider sem IDEOGRAM_API_KEY lança RuntimeError
  - FalProvider sem FAL_API_KEY lança RuntimeError
  - Rate limiter é chamado com chave correta
  - Provedor selecionado via variável de ambiente
"""

import os
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# ---------------------------------------------------------------------------
# Testes — MockProvider (padrão)
# ---------------------------------------------------------------------------

class TestExecuteGenerateImageMock:

    @pytest.mark.asyncio
    async def test_mock_provider_returns_valid_structure(self):
        """MockProvider deve retornar lista com dicts contendo image_bytes e format."""
        from app.tools.generate_image import execute_generate_image

        with patch.dict(os.environ, {"IMAGE_GENERATION_PROVIDER": "mock"}):
            with patch("app.tools.generate_image._rate_limiter") as mock_rl:
                mock_rl.acquire = AsyncMock()
                results = await execute_generate_image(
                    prompt="Mulher sorrindo, fundo branco, estúdio"
                )

        assert isinstance(results, list)
        assert len(results) == 1
        first = results[0]
        assert "image_bytes" in first
        assert "format" in first
        assert first["format"] == "png"
        assert isinstance(first["image_bytes"], bytes)
        assert len(first["image_bytes"]) > 0

    @pytest.mark.asyncio
    async def test_mock_provider_respects_quantity(self):
        """MockProvider deve retornar exatamente `quantity` imagens."""
        from app.tools.generate_image import execute_generate_image

        with patch.dict(os.environ, {"IMAGE_GENERATION_PROVIDER": "mock"}):
            with patch("app.tools.generate_image._rate_limiter") as mock_rl:
                mock_rl.acquire = AsyncMock()
                results = await execute_generate_image(
                    prompt="Personagem consistente para anúncio",
                    quantity=3,
                )

        assert len(results) == 3

    @pytest.mark.asyncio
    async def test_quantity_clamped_to_minimum_1(self):
        """quantity=0 deve ser silenciosamente elevado para 1."""
        from app.tools.generate_image import execute_generate_image

        with patch.dict(os.environ, {"IMAGE_GENERATION_PROVIDER": "mock"}):
            with patch("app.tools.generate_image._rate_limiter") as mock_rl:
                mock_rl.acquire = AsyncMock()
                results = await execute_generate_image(
                    prompt="Teste",
                    quantity=0,
                )

        assert len(results) == 1

    @pytest.mark.asyncio
    async def test_quantity_clamped_to_maximum_10(self):
        """quantity=50 deve ser reduzido para 10."""
        from app.tools.generate_image import execute_generate_image

        with patch.dict(os.environ, {"IMAGE_GENERATION_PROVIDER": "mock"}):
            with patch("app.tools.generate_image._rate_limiter") as mock_rl:
                mock_rl.acquire = AsyncMock()
                results = await execute_generate_image(
                    prompt="Teste",
                    quantity=50,
                )

        assert len(results) == 10

    @pytest.mark.asyncio
    async def test_rate_limiter_called_with_correct_key(self):
        """Rate limiter deve ser chamado com chave 'image_generation'."""
        from app.tools.generate_image import execute_generate_image

        with patch.dict(os.environ, {"IMAGE_GENERATION_PROVIDER": "mock"}):
            with patch("app.tools.generate_image._rate_limiter") as mock_rl:
                mock_rl.acquire = AsyncMock()
                await execute_generate_image(prompt="Teste", quantity=2)

        mock_rl.acquire.assert_called_once_with("image_generation", cost=2)

    @pytest.mark.asyncio
    async def test_accepts_reference_image_url(self):
        """Deve aceitar reference_image_url sem erro (MockProvider ignora, não falha)."""
        from app.tools.generate_image import execute_generate_image

        with patch.dict(os.environ, {"IMAGE_GENERATION_PROVIDER": "mock"}):
            with patch("app.tools.generate_image._rate_limiter") as mock_rl:
                mock_rl.acquire = AsyncMock()
                results = await execute_generate_image(
                    prompt="Personagem em nova cena",
                    reference_image_url="https://r2.dev/character-base.png",
                )

        assert len(results) == 1

    @pytest.mark.asyncio
    async def test_default_aspect_ratio_is_1x1(self):
        """Aspect ratio padrão deve ser 1:1 sem erros."""
        from app.tools.generate_image import execute_generate_image

        with patch.dict(os.environ, {"IMAGE_GENERATION_PROVIDER": "mock"}):
            with patch("app.tools.generate_image._rate_limiter") as mock_rl:
                mock_rl.acquire = AsyncMock()
                # Não passa aspect_ratio — usa default
                results = await execute_generate_image(prompt="Teste")

        assert len(results) == 1


# ---------------------------------------------------------------------------
# Testes — Seleção de Provedor
# ---------------------------------------------------------------------------

class TestProviderSelection:

    def test_unknown_provider_raises_runtime_error(self):
        """Provedor desconhecido deve lançar RuntimeError imediatamente."""
        from app.tools.generate_image import get_image_provider

        with pytest.raises(RuntimeError, match="desconhecido|unknown"):
            get_image_provider("provedor_inexistente")

    def test_mock_provider_selected_by_default(self):
        """Sem variável de ambiente, mock deve ser o provedor padrão."""
        from app.tools.generate_image import get_image_provider, MockImageProvider

        env_without_provider = {k: v for k, v in os.environ.items()
                                 if k != "IMAGE_GENERATION_PROVIDER"}
        with patch.dict(os.environ, env_without_provider, clear=True):
            provider = get_image_provider()

        assert isinstance(provider, MockImageProvider)

    def test_env_var_selects_correct_provider(self):
        """IMAGE_GENERATION_PROVIDER=flux deve retornar FluxImageProvider."""
        from app.tools.generate_image import get_image_provider, FluxImageProvider

        with patch.dict(os.environ, {"IMAGE_GENERATION_PROVIDER": "flux"}):
            provider = get_image_provider()

        assert isinstance(provider, FluxImageProvider)

    def test_explicit_name_overrides_env(self):
        """Argumento explícito deve sobrepor variável de ambiente."""
        from app.tools.generate_image import get_image_provider, IdeogramImageProvider

        with patch.dict(os.environ, {"IMAGE_GENERATION_PROVIDER": "mock"}):
            provider = get_image_provider("ideogram")

        assert isinstance(provider, IdeogramImageProvider)


# ---------------------------------------------------------------------------
# Testes — Provedores reais sem credencial (sem chamada HTTP)
# ---------------------------------------------------------------------------

class TestProvidersWithoutCredentials:

    @pytest.mark.asyncio
    async def test_flux_without_api_key_raises(self):
        """FluxImageProvider sem FLUX_API_KEY deve lançar RuntimeError."""
        from app.tools.generate_image import FluxImageProvider

        env = {k: v for k, v in os.environ.items() if k != "FLUX_API_KEY"}
        with patch.dict(os.environ, env, clear=True):
            provider = FluxImageProvider()
            with pytest.raises(RuntimeError, match="FLUX_API_KEY"):
                await provider.generate(
                    prompt="Teste",
                    reference_image_url=None,
                    aspect_ratio="1:1",
                    quantity=1,
                )

    @pytest.mark.asyncio
    async def test_ideogram_without_api_key_raises(self):
        """IdeogramImageProvider sem IDEOGRAM_API_KEY deve lançar RuntimeError."""
        from app.tools.generate_image import IdeogramImageProvider

        env = {k: v for k, v in os.environ.items() if k != "IDEOGRAM_API_KEY"}
        with patch.dict(os.environ, env, clear=True):
            provider = IdeogramImageProvider()
            with pytest.raises(RuntimeError, match="IDEOGRAM_API_KEY"):
                await provider.generate(
                    prompt="Teste",
                    reference_image_url=None,
                    aspect_ratio="1:1",
                    quantity=1,
                )

    @pytest.mark.asyncio
    async def test_fal_without_api_key_raises(self):
        """FalImageProvider sem FAL_API_KEY deve lançar RuntimeError."""
        from app.tools.generate_image import FalImageProvider

        env = {k: v for k, v in os.environ.items() if k != "FAL_API_KEY"}
        with patch.dict(os.environ, env, clear=True):
            provider = FalImageProvider()
            with pytest.raises(RuntimeError, match="FAL_API_KEY"):
                await provider.generate(
                    prompt="Teste",
                    reference_image_url=None,
                    aspect_ratio="1:1",
                    quantity=1,
                )


# ---------------------------------------------------------------------------
# Testes — Flux Provider com API mockada
# ---------------------------------------------------------------------------

class TestFluxProviderWithMockedApi:

    @pytest.mark.asyncio
    async def test_flux_submits_job_and_polls(self):
        """FluxProvider deve submeter job e fazer polling até Ready."""
        from app.tools.generate_image import FluxImageProvider
        import httpx

        fake_png = b"\x89PNG\r\n"  # PNG header mínimo

        submit_resp = MagicMock()
        submit_resp.json.return_value = {"id": "job-flux-123"}
        submit_resp.raise_for_status = MagicMock()

        poll_resp = MagicMock()
        poll_resp.json.return_value = {
            "status": "Ready",
            "result": {"sample": "https://cdn.bfl.ai/output.png"}
        }
        poll_resp.raise_for_status = MagicMock()

        download_resp = MagicMock()
        download_resp.content = fake_png
        download_resp.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        # post → submit, get[0] → poll Ready, get[1] → download
        mock_client.post = AsyncMock(return_value=submit_resp)
        mock_client.get = AsyncMock(side_effect=[poll_resp, download_resp])

        with patch.dict(os.environ, {"FLUX_API_KEY": "real-flux-key"}):
            with patch("httpx.AsyncClient", return_value=mock_client):
                with patch("asyncio.sleep", new_callable=AsyncMock):
                    provider = FluxImageProvider()
                    results = await provider.generate(
                        prompt="Personagem para anúncio",
                        reference_image_url=None,
                        aspect_ratio="1:1",
                        quantity=1,
                    )

        assert len(results) == 1
        assert results[0]["image_bytes"] == fake_png
        assert results[0]["format"] == "png"
