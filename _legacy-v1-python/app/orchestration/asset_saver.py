"""
Asset Saver — Persistência atômica R2 + Supabase

Garante a invariante central do PRD (regra #5 do CLAUDE.md):
  "Todo arquivo salvo no R2 deve ter seu metadado salvo no Supabase
   na mesma operação. Use save_asset_atomically(). Nunca salve parcialmente."

Garantia de atomicidade:
  1. UUID pré-gerado antes do primeiro upload — mesmo ID em todas as tentativas.
  2. Upload para R2 com chave determinística baseada no UUID.
  3. INSERT no Supabase com o mesmo UUID como primary key.
  4. Se Supabase falhar → DELETE no R2 (best-effort) + backoff + retry.
  5. Conflito de chave duplicada (23505) → o registro já existe → retorna existente.
  6. Todas as tentativas esgotadas → notifica usuário + RuntimeError.

integrity_status na tabela assets:
  "valid"     — arquivo no R2 e registro no Supabase confirmados (estado normal)
  "orphan"    — arquivo no R2 sem registro confirmado (cleanup falhou entre retries)
  "corrupted" — registro no banco sem arquivo no R2 (nunca deve ocorrer com esta impl.)
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Any

from app.database import get_supabase
from app.storage import delete_file, upload_file

logger = logging.getLogger(__name__)

# Desative em testes para não criar notificações no banco
_NOTIFY_ON_FAILURE: bool = True

_MAX_BACKOFF_SECONDS: float = 32.0


# ---------------------------------------------------------------------------
# Função principal
# ---------------------------------------------------------------------------

async def save_asset_atomically(
    file_content: bytes,
    file_extension: str,
    content_type: str,
    asset_type: str,
    execution_id: str,
    project_id: str,
    product_id: str,
    user_id: str,
    marketing_metadata: dict[str, Any] | None = None,
    max_retries: int = 5,
) -> dict:
    """
    Salva arquivo no Cloudflare R2 e metadados no Supabase atomicamente.

    O mesmo UUID é pré-gerado e usado como:
      - Chave do objeto no R2: {executions/{execution_id}/{asset_id}.{ext}}
      - Primary key do registro na tabela assets

    Isso torna toda a operação idempotente: re-executar com a mesma tentativa
    sobrescreve o mesmo objeto no R2 (sem criar arquivos órfãos extras) e,
    se receber conflito de chave no Supabase, retorna o registro existente.

    Args:
        file_content:       Bytes do arquivo.
        file_extension:     Extensão sem ponto ("mp4", "png", "mp3", "json").
        content_type:       MIME type ("video/mp4", "image/png", etc.).
        asset_type:         Valor do enum asset_type da tabela assets.
                            Ex: "final_video", "character", "keyframe", "script".
        execution_id:       UUID da execução geradora do ativo.
        project_id:         UUID do projeto.
        product_id:         UUID do produto — ativos pertencem ao produto,
                            não ao projeto, para reutilização cross-project.
        user_id:            UUID do usuário (necessário para RLS no Supabase).
        marketing_metadata: Dict com metadados de marketing para a coluna JSONB.
                            Campos: angle_type, emotional_trigger, hook_text,
                            narrative_structure, format, pain_addressed, etc.
        max_retries:        Tentativas antes de desistir. Default 5.

    Returns:
        Dict com a row completa do asset criado: { id, file_url, asset_type, ... }

    Raises:
        RuntimeError: se todas as tentativas falharem. Notificação persistida.
    """
    asset_id = str(uuid.uuid4())
    folder = f"executions/{execution_id}"
    r2_key = f"{folder}/{asset_id}.{file_extension}"
    file_size = len(file_content)
    last_error: Exception | None = None

    for attempt in range(max_retries):
        if attempt > 0:
            delay = min(2.0 ** attempt, _MAX_BACKOFF_SECONDS)
            logger.warning(
                "asset_saver: tentativa %d/%d em %.0fs — asset=%s execution=%s",
                attempt + 1, max_retries, delay, asset_id, execution_id,
            )
            await asyncio.sleep(delay)

        file_url: str | None = None

        # ------------------------------------------------------------------
        # Etapa 1 — Upload para R2
        # ------------------------------------------------------------------
        try:
            file_url = await upload_file(
                file_content=file_content,
                file_extension=file_extension,
                folder=folder,
                content_type=content_type,
                key_override=r2_key,
            )
        except Exception as exc:
            logger.error(
                "asset_saver: upload R2 falhou (tentativa %d/%d) — %s",
                attempt + 1, max_retries, exc,
            )
            last_error = exc
            continue  # Retenta — R2 ainda não tem o arquivo, sem necessidade de cleanup

        # ------------------------------------------------------------------
        # Etapa 2 — INSERT no Supabase
        # ------------------------------------------------------------------
        try:
            supabase = get_supabase()
            result = supabase.table("assets").insert({
                "id":                 asset_id,
                "user_id":            user_id,
                "project_id":         project_id,
                "product_id":         product_id,
                "execution_id":       execution_id,
                "asset_type":         asset_type,
                "file_url":           file_url,
                "file_extension":     file_extension,
                "file_size_bytes":    file_size,
                "integrity_status":   "valid",
                "approval_status":    "pending",
                "marketing_metadata": marketing_metadata or {},
                "feedback_history":   [],
            }).execute()

            if not result.data:
                raise RuntimeError(
                    "Supabase insert retornou data vazia sem lançar exceção."
                )

            logger.info(
                "asset_saver: asset %s salvo com sucesso na tentativa %d/%d "
                "(url=%s, tipo=%s, size=%d bytes)",
                asset_id, attempt + 1, max_retries,
                file_url, asset_type, file_size,
            )
            return result.data[0]

        except Exception as exc:
            last_error = exc

            # Conflito de chave duplicada: o registro já existe (idempotência).
            # Acontece se o INSERT teve sucesso mas a resposta foi perdida.
            if _is_duplicate_key_error(exc):
                logger.info(
                    "asset_saver: asset %s já existe no banco (conflito de chave) "
                    "— retornando registro existente.",
                    asset_id,
                )
                return await _fetch_existing_asset(asset_id)

            logger.error(
                "asset_saver: insert Supabase falhou (tentativa %d/%d) — %s",
                attempt + 1, max_retries, exc,
            )

            # R2 tem o arquivo mas Supabase não confirmou o registro.
            # Tenta remover do R2 para evitar acúmulo de órfãos.
            # Na próxima iteração, o mesmo r2_key será sobrescrito.
            await _cleanup_r2_best_effort(file_url, asset_id)

    # ------------------------------------------------------------------
    # Todas as tentativas esgotadas
    # ------------------------------------------------------------------
    await _notify_failure(
        user_id=user_id,
        execution_id=execution_id,
        asset_id=asset_id,
        error=str(last_error),
    )
    raise RuntimeError(
        f"asset_saver: falhou em {max_retries} tentativas para asset={asset_id} "
        f"execution={execution_id}. Último erro: {last_error}"
    )


# ---------------------------------------------------------------------------
# Variante para ativos de texto (roteiros, copies, hooks)
# ---------------------------------------------------------------------------

async def save_text_asset_atomically(
    content: str | dict | list,
    asset_type: str,
    execution_id: str,
    project_id: str,
    product_id: str,
    user_id: str,
    marketing_metadata: dict[str, Any] | None = None,
    max_retries: int = 5,
) -> dict:
    """
    Variante de save_asset_atomically para ativos de texto.

    Serializa `content` como JSON (UTF-8) e salva no R2 com extensão ".json".
    Usado pelos agentes de roteiro, copy, persona, etc.

    Args:
        content: String, dict ou list. Serializado automaticamente como JSON.
        Demais args: idênticos a save_asset_atomically().
    """
    import json

    if isinstance(content, (dict, list)):
        file_bytes = json.dumps(content, ensure_ascii=False, indent=2).encode("utf-8")
    else:
        # String: tenta parsear como JSON; se falhar, envolve em { content: ... }
        try:
            parsed = json.loads(content)
            file_bytes = json.dumps(parsed, ensure_ascii=False, indent=2).encode("utf-8")
        except (json.JSONDecodeError, TypeError):
            file_bytes = json.dumps(
                {"content": content}, ensure_ascii=False
            ).encode("utf-8")

    return await save_asset_atomically(
        file_content=file_bytes,
        file_extension="json",
        content_type="application/json",
        asset_type=asset_type,
        execution_id=execution_id,
        project_id=project_id,
        product_id=product_id,
        user_id=user_id,
        marketing_metadata=marketing_metadata,
        max_retries=max_retries,
    )


# ---------------------------------------------------------------------------
# Helpers internos
# ---------------------------------------------------------------------------

async def _fetch_existing_asset(asset_id: str) -> dict:
    """
    Busca registro existente no banco em caso de conflito de chave duplicada.
    Garante retorno consistente em operações idempotentes.
    """
    supabase = get_supabase()
    result = (
        supabase.table("assets")
        .select("*")
        .eq("id", asset_id)
        .single()
        .execute()
    )
    if result.data:
        return result.data
    raise RuntimeError(
        f"asset_saver: conflito de chave para {asset_id} "
        "mas registro não encontrado no banco."
    )


async def _cleanup_r2_best_effort(file_url: str, asset_id: str) -> None:
    """
    Tenta deletar o arquivo do R2 após falha no Supabase.

    Best-effort: nunca levanta exceção — apenas loga o resultado.
    Se falhar, o arquivo permanece como órfão. O processo de reconciliação
    periódico (integridade de ativos) detecta e corrige via integrity_status.
    """
    try:
        await delete_file(file_url)
        logger.debug(
            "asset_saver: arquivo R2 removido após falha Supabase (asset=%s)",
            asset_id,
        )
    except Exception as exc:
        logger.warning(
            "asset_saver: cleanup R2 falhou para asset=%s (url=%s) — "
            "arquivo pode estar órfão. Erro: %s",
            asset_id, file_url, exc,
        )


async def _notify_failure(
    user_id: str,
    execution_id: str,
    asset_id: str,
    error: str,
) -> None:
    """
    Persiste notificação de falha permanente na tabela notifications.
    Publicada via Supabase Realtime para o frontend em < 2s.

    Nunca levanta exceção — logging é o fallback se o insert também falhar.
    """
    if not _NOTIFY_ON_FAILURE:
        return

    try:
        supabase = get_supabase()
        supabase.table("notifications").insert({
            "user_id":      user_id,
            "execution_id": execution_id,
            "type":         "failure",
            "title":        "Falha ao salvar ativo gerado",
            "message":      (
                f"Não foi possível salvar o arquivo após múltiplas tentativas. "
                f"Asset ID: {asset_id}. Verifique as credenciais do R2 e Supabase. "
                f"Detalhe: {error[:300]}"
            ),
            "read": False,
        }).execute()
    except Exception as notify_exc:
        logger.error(
            "asset_saver: falha ao criar notificação para user=%s execution=%s — %s",
            user_id, execution_id, notify_exc,
        )


def _is_duplicate_key_error(exc: Exception) -> bool:
    """
    Detecta erro de chave duplicada do PostgreSQL (código 23505).
    Usado para garantir idempotência: se o registro já existe, a operação é sucesso.
    """
    msg = str(exc).lower()
    return (
        "23505" in msg
        or "duplicate key" in msg
        or "unique constraint" in msg
        or "already exists" in msg
    )
