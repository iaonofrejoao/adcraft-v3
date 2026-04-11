"""
Testes para app/tools/generate_video.py — execute_generate_video_from_image()

Cobre:
  - MockProvider retorna dict com video_bytes, format, duration_seconds
  - duration_seconds clampado entre 2 e 10
  - Provedor desconhecido lança RuntimeError
  - MockProvider selecionado por padrão quando sem variável de ambiente
  - RunwayProvider sem RUNWAY_API_KEY lança RuntimeError
  - KlingProvider sem KLING_API_KEY lança RuntimeError
  - PikaProvider sem PIKA_API_KEY lança RuntimeError
  - RunwayProvider com API mockada: submit task + poll SUCCEEDED + download
  - RunwayProvider com API mockada: task FAILED → RuntimeError
  - KlingProvider com API mockada: submit + poll succeed + download
  - PikaProvider com API mockada: submit + poll completed + download
  - Rate limiter é chamado com chave 'video_generation' e cost=1
"""

import os
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# ---------------------------------------------------------------------------
# Testes — MockProvider (padrão)
# ---------------------------------------------------------------------------

class TestExecuteGenerateVideoMock:

    @pytest.mark.asyncio
    async def test_mock_provider_returns_valid_structure(self):
        """MockProvider deve retornar dict com video_bytes, format e duration_seconds."""
        from app.tools.generate_video import execute_generate_video_from_image

        with patch.dict(os.environ, {"VIDEO_GENERATION_PROVIDER": "mock"}):
            with patch("app.tools.generate_video._rate_limiter") as mock_rl:
                mock_rl.acquire = AsyncMock()
                result = await execute_generate_video_from_image(
                    image_url="https://r2.dev/keyframe-001.png",
                    motion_prompt="Mulher sorri e acena para câmera",
                    duration_seconds=5,
                    aspect_ratio="9:16",
                )

        assert isinstance(result, dict)
        assert "video_bytes" in result
        assert "format" in result
        assert "duration_seconds" in result
        assert result["format"] == "mp4"
        assert isinstance(result["video_bytes"], bytes)
        assert len(result["video_bytes"]) > 0
        assert result["duration_seconds"] == 5

    @pytest.mark.asyncio
    async def test_duration_clamped_to_minimum_2(self):
        """duration_seconds=0 deve ser elevado para 2."""
        from app.tools.generate_video import execute_generate_video_from_image

        with patch.dict(os.environ, {"VIDEO_GENERATION_PROVIDER": "mock"}):
            with patch("app.tools.generate_video._rate_limiter") as mock_rl:
                mock_rl.acquire = AsyncMock()
                result = await execute_generate_video_from_image(
                    image_url="https://r2.dev/kf.png",
                    motion_prompt="Movimento",
                    duration_seconds=0,
                    aspect_ratio="9:16",
                )

        assert result["duration_seconds"] == 2

    @pytest.mark.asyncio
    async def test_duration_clamped_to_maximum_10(self):
        """duration_seconds=60 deve ser reduzido para 10."""
        from app.tools.generate_video import execute_generate_video_from_image

        with patch.dict(os.environ, {"VIDEO_GENERATION_PROVIDER": "mock"}):
            with patch("app.tools.generate_video._rate_limiter") as mock_rl:
                mock_rl.acquire = AsyncMock()
                result = await execute_generate_video_from_image(
                    image_url="https://r2.dev/kf.png",
                    motion_prompt="Movimento",
                    duration_seconds=60,
                    aspect_ratio="1:1",
                )

        assert result["duration_seconds"] == 10

    @pytest.mark.asyncio
    async def test_rate_limiter_called_with_video_generation_key(self):
        """Rate limiter deve ser chamado com chave 'video_generation' e cost=1."""
        from app.tools.generate_video import execute_generate_video_from_image

        with patch.dict(os.environ, {"VIDEO_GENERATION_PROVIDER": "mock"}):
            with patch("app.tools.generate_video._rate_limiter") as mock_rl:
                mock_rl.acquire = AsyncMock()
                await execute_generate_video_from_image(
                    image_url="https://r2.dev/kf.png",
                    motion_prompt="Teste",
                    duration_seconds=5,
                    aspect_ratio="9:16",
                )

        mock_rl.acquire.assert_called_once_with("video_generation", cost=1)

    @pytest.mark.asyncio
    async def test_all_aspect_ratios_accepted(self):
        """Todos os aspect ratios (9:16, 16:9, 1:1) devem funcionar sem erro."""
        from app.tools.generate_video import execute_generate_video_from_image

        for ratio in ["9:16", "16:9", "1:1"]:
            with patch.dict(os.environ, {"VIDEO_GENERATION_PROVIDER": "mock"}):
                with patch("app.tools.generate_video._rate_limiter") as mock_rl:
                    mock_rl.acquire = AsyncMock()
                    result = await execute_generate_video_from_image(
                        image_url="https://r2.dev/kf.png",
                        motion_prompt="Teste",
                        duration_seconds=5,
                        aspect_ratio=ratio,
                    )
            assert result["format"] == "mp4"


# ---------------------------------------------------------------------------
# Testes — Seleção de Provedor
# ---------------------------------------------------------------------------

class TestVideoProviderSelection:

    def test_unknown_provider_raises_runtime_error(self):
        """Provedor desconhecido deve lançar RuntimeError."""
        from app.tools.generate_video import get_video_provider

        with pytest.raises(RuntimeError, match="desconhecido|unknown"):
            get_video_provider("provedor_inexistente")

    def test_mock_provider_selected_by_default(self):
        """Sem variável de ambiente, mock deve ser o provedor padrão."""
        from app.tools.generate_video import get_video_provider, MockVideoProvider

        env_without = {k: v for k, v in os.environ.items()
                       if k != "VIDEO_GENERATION_PROVIDER"}
        with patch.dict(os.environ, env_without, clear=True):
            provider = get_video_provider()

        assert isinstance(provider, MockVideoProvider)

    def test_env_var_selects_correct_provider(self):
        """VIDEO_GENERATION_PROVIDER=runway deve retornar RunwayVideoProvider."""
        from app.tools.generate_video import get_video_provider, RunwayVideoProvider

        with patch.dict(os.environ, {"VIDEO_GENERATION_PROVIDER": "runway"}):
            provider = get_video_provider()

        assert isinstance(provider, RunwayVideoProvider)

    def test_explicit_name_overrides_env(self):
        """Argumento explícito deve sobrepor variável de ambiente."""
        from app.tools.generate_video import get_video_provider, KlingVideoProvider

        with patch.dict(os.environ, {"VIDEO_GENERATION_PROVIDER": "mock"}):
            provider = get_video_provider("kling")

        assert isinstance(provider, KlingVideoProvider)


# ---------------------------------------------------------------------------
# Testes — Provedores reais sem credencial
# ---------------------------------------------------------------------------

class TestVideoProvidersWithoutCredentials:

    @pytest.mark.asyncio
    async def test_runway_without_api_key_raises(self):
        """RunwayVideoProvider sem RUNWAY_API_KEY deve lançar RuntimeError."""
        from app.tools.generate_video import RunwayVideoProvider

        env = {k: v for k, v in os.environ.items() if k != "RUNWAY_API_KEY"}
        with patch.dict(os.environ, env, clear=True):
            provider = RunwayVideoProvider()
            with pytest.raises(RuntimeError, match="RUNWAY_API_KEY"):
                await provider.generate(
                    image_url="https://r2.dev/kf.png",
                    motion_prompt="Teste",
                    duration_seconds=5,
                    aspect_ratio="9:16",
                )

    @pytest.mark.asyncio
    async def test_kling_without_api_key_raises(self):
        """KlingVideoProvider sem KLING_API_KEY deve lançar RuntimeError."""
        from app.tools.generate_video import KlingVideoProvider

        env = {k: v for k, v in os.environ.items() if k != "KLING_API_KEY"}
        with patch.dict(os.environ, env, clear=True):
            provider = KlingVideoProvider()
            with pytest.raises(RuntimeError, match="KLING_API_KEY"):
                await provider.generate(
                    image_url="https://r2.dev/kf.png",
                    motion_prompt="Teste",
                    duration_seconds=5,
                    aspect_ratio="9:16",
                )

    @pytest.mark.asyncio
    async def test_pika_without_api_key_raises(self):
        """PikaVideoProvider sem PIKA_API_KEY deve lançar RuntimeError."""
        from app.tools.generate_video import PikaVideoProvider

        env = {k: v for k, v in os.environ.items() if k != "PIKA_API_KEY"}
        with patch.dict(os.environ, env, clear=True):
            provider = PikaVideoProvider()
            with pytest.raises(RuntimeError, match="PIKA_API_KEY"):
                await provider.generate(
                    image_url="https://r2.dev/kf.png",
                    motion_prompt="Teste",
                    duration_seconds=5,
                    aspect_ratio="9:16",
                )


# ---------------------------------------------------------------------------
# Testes — RunwayProvider com API mockada
# ---------------------------------------------------------------------------

class TestRunwayProviderWithMockedApi:

    @pytest.mark.asyncio
    async def test_runway_submit_poll_download_success(self):
        """Runway: submit task → poll SUCCEEDED → download → retorna bytes."""
        from app.tools.generate_video import RunwayVideoProvider

        fake_mp4 = b"\x00\x00\x00\x08ftypisom"

        submit_resp = MagicMock()
        submit_resp.json.return_value = {"id": "task-runway-123"}
        submit_resp.raise_for_status = MagicMock()

        poll_resp = MagicMock()
        poll_resp.json.return_value = {
            "status": "SUCCEEDED",
            "output": ["https://cdn.runway/video-output.mp4"],
        }
        poll_resp.raise_for_status = MagicMock()

        download_resp = MagicMock()
        download_resp.content = fake_mp4
        download_resp.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.post = AsyncMock(return_value=submit_resp)
        mock_client.get = AsyncMock(side_effect=[poll_resp, download_resp])

        with patch.dict(os.environ, {"RUNWAY_API_KEY": "real-runway-key"}):
            with patch("httpx.AsyncClient", return_value=mock_client):
                with patch("asyncio.sleep", new_callable=AsyncMock):
                    provider = RunwayVideoProvider()
                    result = await provider.generate(
                        image_url="https://r2.dev/kf.png",
                        motion_prompt="Personagem sorri",
                        duration_seconds=5,
                        aspect_ratio="9:16",
                    )

        assert result["video_bytes"] == fake_mp4
        assert result["format"] == "mp4"
        assert result["duration_seconds"] == 5

    @pytest.mark.asyncio
    async def test_runway_task_failed_raises_runtime_error(self):
        """Runway: task FAILED deve lançar RuntimeError."""
        from app.tools.generate_video import RunwayVideoProvider

        submit_resp = MagicMock()
        submit_resp.json.return_value = {"id": "task-fail-123"}
        submit_resp.raise_for_status = MagicMock()

        poll_resp = MagicMock()
        poll_resp.json.return_value = {
            "status": "FAILED",
            "failure": "Content policy violation",
        }
        poll_resp.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.post = AsyncMock(return_value=submit_resp)
        mock_client.get = AsyncMock(return_value=poll_resp)

        with patch.dict(os.environ, {"RUNWAY_API_KEY": "real-runway-key"}):
            with patch("httpx.AsyncClient", return_value=mock_client):
                with patch("asyncio.sleep", new_callable=AsyncMock):
                    provider = RunwayVideoProvider()
                    with pytest.raises(RuntimeError, match="falhou"):
                        await provider.generate(
                            image_url="https://r2.dev/kf.png",
                            motion_prompt="Teste",
                            duration_seconds=5,
                            aspect_ratio="9:16",
                        )

    @pytest.mark.asyncio
    async def test_runway_duration_mapped_to_5_or_10(self):
        """Runway suporta 5s ou 10s: duration<=5 → 5s, duration>5 → 10s."""
        from app.tools.generate_video import RunwayVideoProvider

        fake_mp4 = b"\x00\x00\x00\x08ftyp"

        submit_resp = MagicMock()
        submit_resp.json.return_value = {"id": "task-123"}
        submit_resp.raise_for_status = MagicMock()

        poll_resp = MagicMock()
        poll_resp.json.return_value = {
            "status": "SUCCEEDED",
            "output": ["https://cdn.runway/video.mp4"],
        }
        poll_resp.raise_for_status = MagicMock()

        download_resp = MagicMock()
        download_resp.content = fake_mp4
        download_resp.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.post = AsyncMock(return_value=submit_resp)
        mock_client.get = AsyncMock(side_effect=[poll_resp, download_resp])

        with patch.dict(os.environ, {"RUNWAY_API_KEY": "real-key"}):
            with patch("httpx.AsyncClient", return_value=mock_client):
                with patch("asyncio.sleep", new_callable=AsyncMock):
                    provider = RunwayVideoProvider()
                    result = await provider.generate(
                        image_url="https://r2.dev/kf.png",
                        motion_prompt="Teste",
                        duration_seconds=8,
                        aspect_ratio="9:16",
                    )

        # Duration > 5 → Runway maps to 10
        assert result["duration_seconds"] == 10


# ---------------------------------------------------------------------------
# Testes — KlingProvider com API mockada
# ---------------------------------------------------------------------------

class TestKlingProviderWithMockedApi:

    @pytest.mark.asyncio
    async def test_kling_submit_poll_download_success(self):
        """Kling: submit → poll succeed → download → retorna bytes."""
        from app.tools.generate_video import KlingVideoProvider

        fake_mp4 = b"\x00\x00\x00\x08ftypisom"

        submit_resp = MagicMock()
        submit_resp.json.return_value = {"data": {"task_id": "kling-task-001"}}
        submit_resp.raise_for_status = MagicMock()

        poll_resp = MagicMock()
        poll_resp.json.return_value = {
            "data": {
                "task_status": "succeed",
                "task_result": {
                    "videos": [{"url": "https://cdn.kling/output.mp4"}]
                },
            }
        }
        poll_resp.raise_for_status = MagicMock()

        download_resp = MagicMock()
        download_resp.content = fake_mp4
        download_resp.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.post = AsyncMock(return_value=submit_resp)
        mock_client.get = AsyncMock(side_effect=[poll_resp, download_resp])

        with patch.dict(os.environ, {"KLING_API_KEY": "real-kling-key"}):
            with patch("httpx.AsyncClient", return_value=mock_client):
                with patch("asyncio.sleep", new_callable=AsyncMock):
                    provider = KlingVideoProvider()
                    result = await provider.generate(
                        image_url="https://r2.dev/kf.png",
                        motion_prompt="Personagem caminha",
                        duration_seconds=5,
                        aspect_ratio="9:16",
                    )

        assert result["video_bytes"] == fake_mp4
        assert result["format"] == "mp4"
        assert result["duration_seconds"] == 5


# ---------------------------------------------------------------------------
# Testes — PikaProvider com API mockada
# ---------------------------------------------------------------------------

class TestPikaProviderWithMockedApi:

    @pytest.mark.asyncio
    async def test_pika_submit_poll_download_success(self):
        """Pika: submit → poll completed → download → retorna bytes."""
        from app.tools.generate_video import PikaVideoProvider

        fake_mp4 = b"\x00\x00\x00\x08ftypisom"

        submit_resp = MagicMock()
        submit_resp.json.return_value = {"data": {"id": "pika-task-001"}}
        submit_resp.raise_for_status = MagicMock()

        poll_resp = MagicMock()
        poll_resp.json.return_value = {
            "data": {
                "status": "completed",
                "video": {"url": "https://cdn.pika/output.mp4"},
            }
        }
        poll_resp.raise_for_status = MagicMock()

        download_resp = MagicMock()
        download_resp.content = fake_mp4
        download_resp.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.post = AsyncMock(return_value=submit_resp)
        mock_client.get = AsyncMock(side_effect=[poll_resp, download_resp])

        with patch.dict(os.environ, {"PIKA_API_KEY": "real-pika-key"}):
            with patch("httpx.AsyncClient", return_value=mock_client):
                with patch("asyncio.sleep", new_callable=AsyncMock):
                    provider = PikaVideoProvider()
                    result = await provider.generate(
                        image_url="https://r2.dev/kf.png",
                        motion_prompt="Personagem olha para câmera",
                        duration_seconds=5,
                        aspect_ratio="1:1",
                    )

        assert result["video_bytes"] == fake_mp4
        assert result["format"] == "mp4"
        # Pika max 5s
        assert result["duration_seconds"] == 5

    @pytest.mark.asyncio
    async def test_pika_duration_capped_at_5(self):
        """Pika suporta max 5s: duration=10 deve ser reduzido para 5."""
        from app.tools.generate_video import PikaVideoProvider

        fake_mp4 = b"\x00\x00\x00\x08ftyp"

        submit_resp = MagicMock()
        submit_resp.json.return_value = {"data": {"id": "pika-task-002"}}
        submit_resp.raise_for_status = MagicMock()

        poll_resp = MagicMock()
        poll_resp.json.return_value = {
            "data": {
                "status": "completed",
                "video": {"url": "https://cdn.pika/out.mp4"},
            }
        }
        poll_resp.raise_for_status = MagicMock()

        download_resp = MagicMock()
        download_resp.content = fake_mp4
        download_resp.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.post = AsyncMock(return_value=submit_resp)
        mock_client.get = AsyncMock(side_effect=[poll_resp, download_resp])

        with patch.dict(os.environ, {"PIKA_API_KEY": "real-pika-key"}):
            with patch("httpx.AsyncClient", return_value=mock_client):
                with patch("asyncio.sleep", new_callable=AsyncMock):
                    provider = PikaVideoProvider()
                    result = await provider.generate(
                        image_url="https://r2.dev/kf.png",
                        motion_prompt="Teste",
                        duration_seconds=10,
                        aspect_ratio="9:16",
                    )

        assert result["duration_seconds"] == 5


# ---------------------------------------------------------------------------
# Testes — Helpers
# ---------------------------------------------------------------------------

class TestVideoHelpers:

    def test_aspect_ratio_to_runway_mapping(self):
        """Mapeamento de aspect ratio para formato Runway."""
        from app.tools.generate_video import _aspect_ratio_to_runway

        assert _aspect_ratio_to_runway("9:16") == "720:1280"
        assert _aspect_ratio_to_runway("16:9") == "1280:720"
        assert _aspect_ratio_to_runway("1:1") == "960:960"
        # Desconhecido → fallback para 720:1280
        assert _aspect_ratio_to_runway("4:3") == "720:1280"

    def test_aspect_ratio_to_kling_passthrough(self):
        """Mapeamento de aspect ratio para Kling (passthrough)."""
        from app.tools.generate_video import _aspect_ratio_to_kling

        assert _aspect_ratio_to_kling("9:16") == "9:16"
        assert _aspect_ratio_to_kling("16:9") == "16:9"
        assert _aspect_ratio_to_kling("1:1") == "1:1"
        # Desconhecido → fallback
        assert _aspect_ratio_to_kling("4:3") == "9:16"
