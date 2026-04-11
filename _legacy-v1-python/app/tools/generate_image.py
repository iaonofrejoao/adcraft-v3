"""
Tool: generate_image

Gera imagem a partir de prompt, opcionalmente usando imagem de referência.
Conforme PRD seção 5.

Arquitetura de plugin (PRD seção 3.2):
  "A arquitetura usa o padrão de plugin — cada serviço implementa a mesma
   interface, permitindo troca sem alteração dos agentes."

Provedor ativo: variável de ambiente IMAGE_GENERATION_PROVIDER
  "mock"     → MockImageProvider      (padrão — sem custo, retorna PNG 1×1)
  "flux"     → FluxImageProvider      (Flux.1 — Black Forest Labs)
  "ideogram" → IdeogramImageProvider  (Ideogram v2)
  "fal"      → FalImageProvider       (fal.ai — vários modelos)

Rate limit: RateLimiter central, chave "image_generation", 100 req/hora.
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

GENERATE_IMAGE_TOOL: dict = {
    "name": "generate_image",
    "description": (
        "Gera imagem a partir de um prompt textual detalhado. "
        "Aceita opcionalmente uma imagem de referência para manter consistência "
        "visual (ex: personagem já gerada). "
        "Use para criar personagens, keyframes de cenas e variações de criativos. "
        "Retorna os bytes da imagem gerada em formato PNG."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "prompt": {
                "type": "string",
                "description": (
                    "Descrição detalhada da imagem a ser gerada. "
                    "Inclua: sujeito, ambiente, iluminação, estilo visual, "
                    "expressão, roupas e ângulo de câmera. "
                    "Quanto mais específico, melhor o resultado."
                ),
            },
            "reference_image_url": {
                "type": "string",
                "description": (
                    "URL de imagem de referência para manter consistência visual "
                    "(ex: personagem gerada na etapa anterior). "
                    "Opcional — omita para geração sem referência."
                ),
            },
            "aspect_ratio": {
                "type": "string",
                "enum": ["1:1", "9:16", "16:9", "4:5", "3:4"],
                "default": "1:1",
                "description": (
                    "'1:1' para feed quadrado (padrão). "
                    "'9:16' para Reels/Stories. "
                    "'16:9' para YouTube/banners. "
                    "'4:5' para feed vertical."
                ),
            },
            "quantity": {
                "type": "integer",
                "description": "Número de variações a gerar. Default 1, máximo 10.",
                "default": 1,
                "minimum": 1,
                "maximum": 10,
            },
        },
        "required": ["prompt"],
    },
}


# ---------------------------------------------------------------------------
# Interface abstrata do provedor (plugin pattern)
# ---------------------------------------------------------------------------

class ImageGenerationProvider(ABC):
    """
    Interface que todo provedor de geração de imagem deve implementar.
    Trocar de provedor = trocar IMAGE_GENERATION_PROVIDER sem alterar agentes.
    """

    @abstractmethod
    async def generate(
        self,
        prompt: str,
        reference_image_url: str | None,
        aspect_ratio: str,
        quantity: int,
    ) -> list[dict]:
        """
        Gera imagens e retorna os bytes de cada uma.

        Returns:
            [{ "image_bytes": bytes, "format": "png" }, ...]
        """


# ---------------------------------------------------------------------------
# Mock Provider — desenvolvimento sem custo de API
# ---------------------------------------------------------------------------

# Minimal 1×1 pixel transparent PNG — imagem válida que libraries podem carregar.
_MOCK_PNG_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk"
    "+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
)


class MockImageProvider(ImageGenerationProvider):
    """
    Provedor mock para desenvolvimento local.
    Retorna PNG 1×1 pixel válido sem fazer nenhuma chamada de API.
    O resultado não é visualmente útil mas permite testar o fluxo completo.
    """

    async def generate(
        self,
        prompt: str,
        reference_image_url: str | None,
        aspect_ratio: str,
        quantity: int,
    ) -> list[dict]:
        logger.debug(
            "generate_image [mock]: gerando %d imagem(ns) para prompt %r",
            quantity, prompt[:80],
        )
        return [
            {"image_bytes": _MOCK_PNG_BYTES, "format": "png"}
            for _ in range(quantity)
        ]


# ---------------------------------------------------------------------------
# Flux Provider (Black Forest Labs)
# Credencial: FLUX_API_KEY
# ---------------------------------------------------------------------------

class FluxImageProvider(ImageGenerationProvider):
    """
    Provedor Flux.1 (Black Forest Labs) via fal.ai ou API direta.
    Configure: IMAGE_GENERATION_PROVIDER=flux + FLUX_API_KEY
    """

    _BASE_URL = "https://api.us1.bfl.ai/v1"
    _MODEL = "flux-pro-1.1"

    async def generate(
        self,
        prompt: str,
        reference_image_url: str | None,
        aspect_ratio: str,
        quantity: int,
    ) -> list[dict]:
        api_key = os.environ.get("FLUX_API_KEY", "")
        if not api_key:
            raise RuntimeError(
                "generate_image [flux]: FLUX_API_KEY não configurada. "
                "Adicione ao .env ou use IMAGE_GENERATION_PROVIDER=mock."
            )

        width, height = _aspect_ratio_to_pixels(aspect_ratio)
        results = []

        for i in range(quantity):
            payload: dict = {
                "prompt":        prompt,
                "width":         width,
                "height":        height,
                "output_format": "png",
            }
            if reference_image_url:
                payload["image_prompt"]        = reference_image_url
                payload["image_prompt_strength"] = 0.5

            try:
                async with httpx.AsyncClient(timeout=120.0) as client:
                    # Submete job
                    resp = await client.post(
                        f"{self._BASE_URL}/{self._MODEL}",
                        headers={"X-Key": api_key, "Content-Type": "application/json"},
                        json=payload,
                    )
                    resp.raise_for_status()
                    task_id = resp.json()["id"]

                    # Polling até job completar (max 60 tentativas × 2s)
                    image_url = await _flux_poll_result(client, task_id, api_key)
                    image_bytes = await _download_bytes(client, image_url)

            except httpx.HTTPStatusError as exc:
                raise RuntimeError(
                    f"generate_image [flux]: HTTP {exc.response.status_code} — "
                    f"{exc.response.text[:300]}"
                ) from exc

            results.append({"image_bytes": image_bytes, "format": "png"})

        return results


async def _flux_poll_result(
    client: httpx.AsyncClient, task_id: str, api_key: str
) -> str:
    """Polling do resultado do job Flux. Retorna URL da imagem gerada."""
    import asyncio
    poll_url = f"{FluxImageProvider._BASE_URL}/get_result?id={task_id}"

    for _ in range(60):
        await asyncio.sleep(2)
        resp = await client.get(poll_url, headers={"X-Key": api_key})
        resp.raise_for_status()
        data = resp.json()
        status = data.get("status")

        if status == "Ready":
            return data["result"]["sample"]
        if status in ("Failed", "Error"):
            raise RuntimeError(f"generate_image [flux]: job {task_id} falhou — {data}")

    raise RuntimeError(
        f"generate_image [flux]: timeout aguardando resultado do job {task_id}."
    )


# ---------------------------------------------------------------------------
# Ideogram Provider
# Credencial: IDEOGRAM_API_KEY
# ---------------------------------------------------------------------------

class IdeogramImageProvider(ImageGenerationProvider):
    """
    Provedor Ideogram v2 — forte em texto e tipografia em imagens.
    Configure: IMAGE_GENERATION_PROVIDER=ideogram + IDEOGRAM_API_KEY
    """

    _URL = "https://api.ideogram.ai/generate"

    async def generate(
        self,
        prompt: str,
        reference_image_url: str | None,
        aspect_ratio: str,
        quantity: int,
    ) -> list[dict]:
        api_key = os.environ.get("IDEOGRAM_API_KEY", "")
        if not api_key:
            raise RuntimeError(
                "generate_image [ideogram]: IDEOGRAM_API_KEY não configurada."
            )

        # Ideogram usa nomes de aspect ratio diferentes
        ratio_map = {
            "1:1": "ASPECT_1_1", "9:16": "ASPECT_9_16",
            "16:9": "ASPECT_16_9", "4:5": "ASPECT_4_5", "3:4": "ASPECT_3_4",
        }
        ideogram_ratio = ratio_map.get(aspect_ratio, "ASPECT_1_1")

        payload = {
            "image_request": {
                "prompt":        prompt,
                "aspect_ratio":  ideogram_ratio,
                "model":         "V_2",
                "num_images":    quantity,
                "magic_prompt_option": "AUTO",
            }
        }

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(
                    self._URL,
                    headers={
                        "Api-Key":      api_key,
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
                resp.raise_for_status()
                data = resp.json()

                results = []
                for item in data.get("data", [])[:quantity]:
                    image_bytes = await _download_bytes(client, item["url"])
                    results.append({"image_bytes": image_bytes, "format": "png"})

                return results

        except httpx.HTTPStatusError as exc:
            raise RuntimeError(
                f"generate_image [ideogram]: HTTP {exc.response.status_code} — "
                f"{exc.response.text[:300]}"
            ) from exc


# ---------------------------------------------------------------------------
# fal.ai Provider (suporta Flux, SDXL, outros modelos)
# Credencial: FAL_API_KEY
# ---------------------------------------------------------------------------

class FalImageProvider(ImageGenerationProvider):
    """
    Provedor fal.ai — marketplace de modelos de geração de imagem.
    Configure: IMAGE_GENERATION_PROVIDER=fal + FAL_API_KEY
    Modelo padrão: fal-ai/flux/dev (configurável via FAL_IMAGE_MODEL)
    """

    async def generate(
        self,
        prompt: str,
        reference_image_url: str | None,
        aspect_ratio: str,
        quantity: int,
    ) -> list[dict]:
        api_key = os.environ.get("FAL_API_KEY", "")
        if not api_key:
            raise RuntimeError(
                "generate_image [fal]: FAL_API_KEY não configurada."
            )

        model = os.environ.get("FAL_IMAGE_MODEL", "fal-ai/flux/dev")
        url = f"https://fal.run/{model}"

        payload = {
            "prompt":           prompt,
            "image_size":       _aspect_ratio_to_fal_size(aspect_ratio),
            "num_images":       quantity,
            "output_format":    "png",
            "enable_safety_checker": False,
        }
        if reference_image_url:
            payload["image_url"] = reference_image_url

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(
                    url,
                    headers={
                        "Authorization": f"Key {api_key}",
                        "Content-Type":  "application/json",
                    },
                    json=payload,
                )
                resp.raise_for_status()
                data = resp.json()

                results = []
                for img in data.get("images", [])[:quantity]:
                    image_bytes = await _download_bytes(client, img["url"])
                    results.append({"image_bytes": image_bytes, "format": "png"})

                return results

        except httpx.HTTPStatusError as exc:
            raise RuntimeError(
                f"generate_image [fal]: HTTP {exc.response.status_code} — "
                f"{exc.response.text[:300]}"
            ) from exc


# ---------------------------------------------------------------------------
# Factory de provedores
# ---------------------------------------------------------------------------

_PROVIDERS: dict[str, type[ImageGenerationProvider]] = {
    "mock":     MockImageProvider,
    "flux":     FluxImageProvider,
    "ideogram": IdeogramImageProvider,
    "fal":      FalImageProvider,
}


def get_image_provider(name: str | None = None) -> ImageGenerationProvider:
    """
    Retorna instância do provedor configurado.

    Ordem de resolução:
      1. Argumento `name` explícito
      2. Variável IMAGE_GENERATION_PROVIDER
      3. "mock" como padrão seguro

    Raises:
        RuntimeError se o nome do provedor não for reconhecido.
    """
    provider_name = (name or os.environ.get("IMAGE_GENERATION_PROVIDER", "mock")).lower()
    cls = _PROVIDERS.get(provider_name)
    if not cls:
        raise RuntimeError(
            f"generate_image: provedor desconhecido '{provider_name}'. "
            f"Disponíveis: {list(_PROVIDERS)}"
        )
    return cls()


# ---------------------------------------------------------------------------
# Função principal (chamada pelo dispatcher de tools)
# ---------------------------------------------------------------------------

async def execute_generate_image(
    prompt: str,
    reference_image_url: str | None = None,
    aspect_ratio: str = "1:1",
    quantity: int = 1,
) -> list[dict]:
    """
    Executa a tool generate_image.

    Args:
        prompt:               Descrição detalhada da imagem.
        reference_image_url:  URL de imagem de referência (opcional).
        aspect_ratio:         "1:1" | "9:16" | "16:9" | "4:5" | "3:4".
        quantity:             Número de variações (1–10).

    Returns:
        [{ "image_bytes": bytes, "format": "png" }, ...]

    Raises:
        RuntimeError: se o provedor retornar erro — sem fallback automático.
    """
    quantity = max(1, min(quantity, 10))

    await _rate_limiter.acquire("image_generation", cost=quantity)

    provider = get_image_provider()
    provider_name = os.environ.get("IMAGE_GENERATION_PROVIDER", "mock")

    logger.info(
        "generate_image: provedor=%s aspect_ratio=%s quantity=%d prompt=%r",
        provider_name, aspect_ratio, quantity, prompt[:80],
    )

    return await provider.generate(
        prompt=prompt,
        reference_image_url=reference_image_url,
        aspect_ratio=aspect_ratio,
        quantity=quantity,
    )


# ---------------------------------------------------------------------------
# Helpers compartilhados
# ---------------------------------------------------------------------------

async def _download_bytes(client: httpx.AsyncClient, url: str) -> bytes:
    """Baixa conteúdo de uma URL e retorna os bytes."""
    resp = await client.get(url, follow_redirects=True, timeout=60.0)
    resp.raise_for_status()
    return resp.content


def _aspect_ratio_to_pixels(aspect_ratio: str) -> tuple[int, int]:
    """Converte aspect ratio string para dimensões em pixels (múltiplos de 64)."""
    mapping = {
        "1:1":  (1024, 1024),
        "9:16": (768,  1344),
        "16:9": (1344, 768),
        "4:5":  (896,  1120),
        "3:4":  (896,  1184),
    }
    return mapping.get(aspect_ratio, (1024, 1024))


def _aspect_ratio_to_fal_size(aspect_ratio: str) -> str:
    """Converte aspect ratio string para nome de tamanho do fal.ai."""
    mapping = {
        "1:1":  "square_hd",
        "9:16": "portrait_16_9",
        "16:9": "landscape_16_9",
        "4:5":  "portrait_4_3",
        "3:4":  "portrait_4_3",
    }
    return mapping.get(aspect_ratio, "square_hd")
