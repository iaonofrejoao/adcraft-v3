"""
Tool: generate_video_from_image

Gera clipe de vídeo a partir de imagem inicial (image-to-video).
Conforme PRD seção 5.

Arquitetura de plugin (PRD seção 3.2):
  "A arquitetura usa o padrão de plugin — cada serviço implementa a mesma
   interface, permitindo troca sem alteração dos agentes."

Provedor ativo: variável de ambiente VIDEO_GENERATION_PROVIDER
  "mock"   → MockVideoProvider   (padrão — sem custo, retorna MP4 mínimo)
  "runway" → RunwayVideoProvider (Runway Gen-3 Alpha)
  "kling"  → KlingVideoProvider  (Kling v1.6)
  "pika"   → PikaVideoProvider   (Pika 2.0)

Rate limit: RateLimiter central, chave "video_generation", 1 req por chamada.
Erro:       Para e notifica — não usa fallback automático (conforme PRD).
"""

import base64
import logging
import os
from abc import ABC, abstractmethod

import httpx

from app.orchestration.rate_limiter import RateLimiter

logger = logging.getLogger(__name__)

_rate_limiter = RateLimiter()

# ---------------------------------------------------------------------------
# Definição da tool para Claude tool_use
# ---------------------------------------------------------------------------

GENERATE_VIDEO_TOOL: dict = {
    "name": "generate_video_from_image",
    "description": (
        "Gera clipe de vídeo a partir de uma imagem inicial (image-to-video). "
        "Usa o primeiro frame (keyframe) como base e anima a cena conforme o "
        "motion_prompt descrito. Use para criar os clipes de cada cena do roteiro, "
        "mantendo a personagem consistente entre as cenas. "
        "Retorna os bytes do vídeo gerado em formato MP4."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "image_url": {
                "type": "string",
                "description": (
                    "URL da imagem de partida (keyframe). "
                    "Deve ser a URL permanente no R2 do keyframe aprovado. "
                    "A personagem na imagem será mantida no vídeo gerado."
                ),
            },
            "motion_prompt": {
                "type": "string",
                "description": (
                    "Descrição do movimento e ação na cena. "
                    "Inclua: o que o personagem faz, movimentos de câmera, "
                    "expressões, ambiente e atmosfera. "
                    "Exemplo: Mulher olha diretamente para a câmera, acena "
                    "levemente e sorri com confiança. Câmera estática. "
                    "Iluminação quente e aconchegante."
                ),
            },
            "duration_seconds": {
                "type": "integer",
                "description": (
                    "Duração do clipe em segundos. "
                    "Deve corresponder à duração da cena no roteiro. "
                    "Valores típicos: 3 a 10 segundos por cena."
                ),
                "minimum": 2,
                "maximum": 10,
            },
            "aspect_ratio": {
                "type": "string",
                "enum": ["9:16", "16:9", "1:1"],
                "description": (
                    "'9:16' para Reels/Stories (padrão para criativos). "
                    "'16:9' para YouTube/banners. "
                    "'1:1' para feed quadrado."
                ),
            },
        },
        "required": ["image_url", "motion_prompt", "duration_seconds", "aspect_ratio"],
    },
}


# ---------------------------------------------------------------------------
# Interface abstrata do provedor (plugin pattern)
# ---------------------------------------------------------------------------

class VideoGenerationProvider(ABC):
    """
    Interface que todo provedor de geração de vídeo deve implementar.
    Trocar de provedor = trocar VIDEO_GENERATION_PROVIDER sem alterar agentes.
    """

    @abstractmethod
    async def generate(
        self,
        image_url: str,
        motion_prompt: str,
        duration_seconds: int,
        aspect_ratio: str,
    ) -> dict:
        """
        Gera vídeo a partir de imagem e retorna os bytes.

        Returns:
            { "video_bytes": bytes, "format": "mp4", "duration_seconds": int }
        """


# ---------------------------------------------------------------------------
# Mock Provider — desenvolvimento sem custo de API
# ---------------------------------------------------------------------------

# MP4 mínimo válido (ftyp + mdat vazio) — gerado com:
#   ffmpeg -f lavfi -i color=black:s=64x64:d=1 -c:v libx264 -f mp4 /tmp/m.mp4
# Codificado em base64 para embutir sem arquivo externo.
_MOCK_MP4_B64 = (
    "AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAvltZGF0AAAC"
    "rmWQIARAAAABkGSJ/xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADhh"
    "bW92aWUAAABsbXZoZAAAAADXpVTl16VU5QAAJxAAABdwAAEAAAEAAAAAAAAAAAAAAAAA"
    "AQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAgAAABh0cmFrAAAAXHRraGQAAAAD16VU5delVOUAAAABAAAAAABdcA"
    "AAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAAHbWRpYQAAAAEAAAAA"
)

try:
    _MOCK_MP4_BYTES = base64.b64decode(_MOCK_MP4_B64)
except Exception:
    # Fallback ainda mais mínimo se o base64 acima não decodificar corretamente
    _MOCK_MP4_BYTES = b"\x00\x00\x00\x08ftypisom"


class MockVideoProvider(VideoGenerationProvider):
    """
    Provedor mock para desenvolvimento local.
    Retorna bytes de MP4 mínimo sem fazer nenhuma chamada de API.
    O resultado não é visualmente útil mas permite testar o fluxo completo.
    """

    async def generate(
        self,
        image_url: str,
        motion_prompt: str,
        duration_seconds: int,
        aspect_ratio: str,
    ) -> dict:
        logger.debug(
            "generate_video [mock]: gerando clipe %ds para imagem %s",
            duration_seconds, image_url[:80],
        )
        return {
            "video_bytes": _MOCK_MP4_BYTES,
            "format": "mp4",
            "duration_seconds": duration_seconds,
        }


# ---------------------------------------------------------------------------
# Runway Gen-3 Alpha Provider
# Credencial: RUNWAY_API_KEY
# Docs: https://docs.dev.runwayml.com/
# ---------------------------------------------------------------------------

class RunwayVideoProvider(VideoGenerationProvider):
    """
    Provedor Runway Gen-3 Alpha — state-of-the-art em image-to-video.
    Configure: VIDEO_GENERATION_PROVIDER=runway + RUNWAY_API_KEY
    """

    _BASE_URL = "https://api.dev.runwayml.com/v1"
    _MODEL = "gen3a_turbo"

    async def generate(
        self,
        image_url: str,
        motion_prompt: str,
        duration_seconds: int,
        aspect_ratio: str,
    ) -> dict:
        api_key = os.environ.get("RUNWAY_API_KEY", "")
        if not api_key:
            raise RuntimeError(
                "generate_video [runway]: RUNWAY_API_KEY não configurada. "
                "Adicione ao .env ou use VIDEO_GENERATION_PROVIDER=mock."
            )

        # Runway suporta 5s ou 10s
        runway_duration = 10 if duration_seconds > 5 else 5

        payload = {
            "model": self._MODEL,
            "promptImage": image_url,
            "promptText": motion_prompt,
            "duration": runway_duration,
            "ratio": _aspect_ratio_to_runway(aspect_ratio),
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                # Submete task
                resp = await client.post(
                    f"{self._BASE_URL}/image_to_video",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                        "X-Runway-Version": "2024-11-06",
                    },
                    json=payload,
                )
                resp.raise_for_status()
                task_id = resp.json()["id"]

                # Polling até conclusão (max 60 tentativas × 5s)
                video_url = await _runway_poll_result(client, task_id, api_key)
                video_bytes = await _download_bytes(client, video_url)

        except httpx.HTTPStatusError as exc:
            raise RuntimeError(
                f"generate_video [runway]: HTTP {exc.response.status_code} — "
                f"{exc.response.text[:300]}"
            ) from exc

        return {
            "video_bytes": video_bytes,
            "format": "mp4",
            "duration_seconds": runway_duration,
        }


async def _runway_poll_result(
    client: httpx.AsyncClient,
    task_id: str,
    api_key: str,
) -> str:
    """Polling do resultado da task Runway. Retorna URL do vídeo gerado."""
    import asyncio

    for _ in range(60):
        await asyncio.sleep(5)
        resp = await client.get(
            f"https://api.dev.runwayml.com/v1/tasks/{task_id}",
            headers={
                "Authorization": f"Bearer {api_key}",
                "X-Runway-Version": "2024-11-06",
            },
        )
        resp.raise_for_status()
        data = resp.json()
        status = data.get("status")

        if status == "SUCCEEDED":
            outputs = data.get("output", [])
            if outputs:
                return outputs[0]
            raise RuntimeError(
                f"generate_video [runway]: task {task_id} concluiu mas sem output."
            )
        if status in ("FAILED", "CANCELLED"):
            raise RuntimeError(
                f"generate_video [runway]: task {task_id} falhou — {data.get('failure', data)}"
            )

    raise RuntimeError(
        f"generate_video [runway]: timeout aguardando task {task_id}."
    )


# ---------------------------------------------------------------------------
# Kling Provider (Kuaishou)
# Credencial: KLING_API_KEY
# Docs: https://docs.qingque.cn/d/home/eZQDvDfhO_PplT7jcSljTNobE
# ---------------------------------------------------------------------------

class KlingVideoProvider(VideoGenerationProvider):
    """
    Provedor Kling v1.6 (Kuaishou) — forte em consistência de personagem.
    Configure: VIDEO_GENERATION_PROVIDER=kling + KLING_API_KEY
    """

    _BASE_URL = "https://api.klingai.com/v1"

    async def generate(
        self,
        image_url: str,
        motion_prompt: str,
        duration_seconds: int,
        aspect_ratio: str,
    ) -> dict:
        api_key = os.environ.get("KLING_API_KEY", "")
        if not api_key:
            raise RuntimeError(
                "generate_video [kling]: KLING_API_KEY não configurada."
            )

        # Kling suporta 5s ou 10s
        kling_duration = "10" if duration_seconds > 5 else "5"

        payload = {
            "model_name": "kling-v1-6",
            "image": image_url,
            "prompt": motion_prompt,
            "duration": kling_duration,
            "aspect_ratio": _aspect_ratio_to_kling(aspect_ratio),
            "mode": "std",
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                # Submete task
                resp = await client.post(
                    f"{self._BASE_URL}/videos/image2video",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
                resp.raise_for_status()
                data = resp.json()
                task_id = data["data"]["task_id"]

                # Polling
                video_url = await _kling_poll_result(client, task_id, api_key)
                video_bytes = await _download_bytes(client, video_url)

        except httpx.HTTPStatusError as exc:
            raise RuntimeError(
                f"generate_video [kling]: HTTP {exc.response.status_code} — "
                f"{exc.response.text[:300]}"
            ) from exc

        return {
            "video_bytes": video_bytes,
            "format": "mp4",
            "duration_seconds": int(kling_duration),
        }


async def _kling_poll_result(
    client: httpx.AsyncClient,
    task_id: str,
    api_key: str,
) -> str:
    """Polling do resultado da task Kling. Retorna URL do vídeo gerado."""
    import asyncio

    for _ in range(60):
        await asyncio.sleep(5)
        resp = await client.get(
            f"https://api.klingai.com/v1/videos/image2video/{task_id}",
            headers={"Authorization": f"Bearer {api_key}"},
        )
        resp.raise_for_status()
        data = resp.json()
        task_status = data.get("data", {}).get("task_status")

        if task_status == "succeed":
            videos = data["data"].get("task_result", {}).get("videos", [])
            if videos:
                return videos[0]["url"]
            raise RuntimeError(
                f"generate_video [kling]: task {task_id} concluiu sem vídeo."
            )
        if task_status == "failed":
            raise RuntimeError(
                f"generate_video [kling]: task {task_id} falhou — "
                f"{data['data'].get('task_status_msg', data)}"
            )

    raise RuntimeError(
        f"generate_video [kling]: timeout aguardando task {task_id}."
    )


# ---------------------------------------------------------------------------
# Pika Provider (Pika Labs)
# Credencial: PIKA_API_KEY
# ---------------------------------------------------------------------------

class PikaVideoProvider(VideoGenerationProvider):
    """
    Provedor Pika 2.0 — bom para vídeos curtos de até 5s com movimento natural.
    Configure: VIDEO_GENERATION_PROVIDER=pika + PIKA_API_KEY
    """

    _BASE_URL = "https://api.pika.art/v1"

    async def generate(
        self,
        image_url: str,
        motion_prompt: str,
        duration_seconds: int,
        aspect_ratio: str,
    ) -> dict:
        api_key = os.environ.get("PIKA_API_KEY", "")
        if not api_key:
            raise RuntimeError(
                "generate_video [pika]: PIKA_API_KEY não configurada."
            )

        payload = {
            "image": image_url,
            "promptText": motion_prompt,
            "options": {
                "aspectRatio": aspect_ratio,
                "frameRate": 24,
                "duration": min(duration_seconds, 5),  # Pika max 5s
            },
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{self._BASE_URL}/generate/image",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
                resp.raise_for_status()
                data = resp.json()
                task_id = data["data"]["id"]

                video_url = await _pika_poll_result(client, task_id, api_key)
                video_bytes = await _download_bytes(client, video_url)

        except httpx.HTTPStatusError as exc:
            raise RuntimeError(
                f"generate_video [pika]: HTTP {exc.response.status_code} — "
                f"{exc.response.text[:300]}"
            ) from exc

        return {
            "video_bytes": video_bytes,
            "format": "mp4",
            "duration_seconds": min(duration_seconds, 5),
        }


async def _pika_poll_result(
    client: httpx.AsyncClient,
    task_id: str,
    api_key: str,
) -> str:
    """Polling do resultado da task Pika. Retorna URL do vídeo gerado."""
    import asyncio

    for _ in range(60):
        await asyncio.sleep(5)
        resp = await client.get(
            f"https://api.pika.art/v1/generate/{task_id}",
            headers={"Authorization": f"Bearer {api_key}"},
        )
        resp.raise_for_status()
        data = resp.json()
        status = data.get("data", {}).get("status")

        if status == "completed":
            video_url = data["data"].get("video", {}).get("url")
            if video_url:
                return video_url
            raise RuntimeError(
                f"generate_video [pika]: task {task_id} concluiu sem URL de vídeo."
            )
        if status == "failed":
            raise RuntimeError(
                f"generate_video [pika]: task {task_id} falhou."
            )

    raise RuntimeError(
        f"generate_video [pika]: timeout aguardando task {task_id}."
    )


# ---------------------------------------------------------------------------
# Factory de provedores
# ---------------------------------------------------------------------------

_PROVIDERS: dict[str, type[VideoGenerationProvider]] = {
    "mock":   MockVideoProvider,
    "runway": RunwayVideoProvider,
    "kling":  KlingVideoProvider,
    "pika":   PikaVideoProvider,
}


def get_video_provider(name: str | None = None) -> VideoGenerationProvider:
    """
    Retorna instância do provedor configurado.

    Ordem de resolução:
      1. Argumento `name` explícito
      2. Variável VIDEO_GENERATION_PROVIDER
      3. "mock" como padrão seguro

    Raises:
        RuntimeError se o nome do provedor não for reconhecido.
    """
    provider_name = (name or os.environ.get("VIDEO_GENERATION_PROVIDER", "mock")).lower()
    cls = _PROVIDERS.get(provider_name)
    if not cls:
        raise RuntimeError(
            f"generate_video: provedor desconhecido '{provider_name}'. "
            f"Disponíveis: {list(_PROVIDERS)}"
        )
    return cls()


# ---------------------------------------------------------------------------
# Função principal (chamada pelo dispatcher de tools)
# ---------------------------------------------------------------------------

async def execute_generate_video_from_image(
    image_url: str,
    motion_prompt: str,
    duration_seconds: int,
    aspect_ratio: str,
) -> dict:
    """
    Executa a tool generate_video_from_image.

    Args:
        image_url:        URL permanente da imagem de partida (keyframe no R2).
        motion_prompt:    Descrição do movimento e ação a animar.
        duration_seconds: Duração do clipe (2–10 segundos).
        aspect_ratio:     "9:16" | "16:9" | "1:1".

    Returns:
        { "video_bytes": bytes, "format": "mp4", "duration_seconds": int }

    Raises:
        RuntimeError: se o provedor retornar erro — sem fallback automático.
    """
    duration_seconds = max(2, min(duration_seconds, 10))

    await _rate_limiter.acquire("video_generation", cost=1)

    provider = get_video_provider()
    provider_name = os.environ.get("VIDEO_GENERATION_PROVIDER", "mock")

    logger.info(
        "generate_video: provedor=%s aspect_ratio=%s duration=%ds image=%s",
        provider_name, aspect_ratio, duration_seconds, image_url[:80],
    )

    return await provider.generate(
        image_url=image_url,
        motion_prompt=motion_prompt,
        duration_seconds=duration_seconds,
        aspect_ratio=aspect_ratio,
    )


# ---------------------------------------------------------------------------
# Helpers compartilhados
# ---------------------------------------------------------------------------

async def _download_bytes(client: httpx.AsyncClient, url: str) -> bytes:
    """Baixa conteúdo de uma URL e retorna os bytes."""
    resp = await client.get(url, follow_redirects=True, timeout=120.0)
    resp.raise_for_status()
    return resp.content


def _aspect_ratio_to_runway(aspect_ratio: str) -> str:
    """Converte aspect ratio string para o formato do Runway."""
    mapping = {
        "9:16": "720:1280",
        "16:9": "1280:720",
        "1:1":  "960:960",
    }
    return mapping.get(aspect_ratio, "720:1280")


def _aspect_ratio_to_kling(aspect_ratio: str) -> str:
    """Converte aspect ratio string para o formato do Kling."""
    mapping = {
        "9:16": "9:16",
        "16:9": "16:9",
        "1:1":  "1:1",
    }
    return mapping.get(aspect_ratio, "9:16")
