import uuid
from functools import lru_cache

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from app.config import get_settings


@lru_cache
def get_r2_client():
    """
    Retorna cliente boto3 configurado para o Cloudflare R2 (S3-compatible).
    Cache via lru_cache — uma única conexão por processo.
    """
    settings = get_settings()
    return boto3.client(
        "s3",
        endpoint_url=f"https://{settings.cloudflare_r2_account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.cloudflare_r2_access_key_id,
        aws_secret_access_key=settings.cloudflare_r2_secret_access_key,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


async def upload_file(
    file_content: bytes,
    file_extension: str,
    folder: str,
    content_type: str,
) -> str:
    """
    Faz upload de um arquivo para o Cloudflare R2 e retorna a URL pública permanente.

    Garantia de atomicidade: se o upload falhar, lança exceção imediatamente.
    O chamador deve capturar e NÃO salvar metadados no banco — nunca estado parcial.

    Args:
        file_content:   Bytes do arquivo a ser enviado.
        file_extension: Extensão sem ponto (ex: "mp4", "png", "mp3").
        folder:         Pasta dentro do bucket (ex: "executions/uuid", "final_creatives").
        content_type:   MIME type do arquivo (ex: "video/mp4", "image/png").

    Returns:
        URL pública permanente no formato:
        https://pub-{account_id}.r2.dev/{folder}/{uuid}.{extension}

    Raises:
        ClientError: se o upload falhar por erro do R2 (credenciais, bucket, rede).
        RuntimeError: se as credenciais do R2 não estiverem configuradas.
    """
    settings = get_settings()

    if not settings.r2_configured:
        raise RuntimeError(
            "Credenciais do Cloudflare R2 não configuradas. "
            "Preencha CLOUDFLARE_R2_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID "
            "e CLOUDFLARE_R2_SECRET_ACCESS_KEY no arquivo .env"
        )

    file_key = f"{folder}/{uuid.uuid4()}.{file_extension}"

    get_r2_client().put_object(
        Bucket=settings.cloudflare_r2_bucket_name,
        Key=file_key,
        Body=file_content,
        ContentType=content_type,
    )

    return f"{settings.r2_public_url_base}/{file_key}"


async def delete_file(file_url: str) -> None:
    """
    Remove um arquivo do Cloudflare R2.

    ATENÇÃO: chamado apenas por ação explícita do usuário (hard delete).
    Nunca deletar automaticamente — registros com deleted_at preenchido
    mantêm o arquivo no R2 para eventual recuperação.

    Args:
        file_url: URL pública retornada por upload_file().

    Raises:
        ValueError: se a URL não pertencer ao bucket configurado.
        ClientError: se a deleção falhar no R2.
    """
    settings = get_settings()
    base = settings.r2_public_url_base

    if not file_url.startswith(base):
        raise ValueError(
            f"URL '{file_url}' não pertence ao bucket configurado ({base}). "
            "Deleção cancelada por segurança."
        )

    file_key = file_url.removeprefix(f"{base}/")

    get_r2_client().delete_object(
        Bucket=settings.cloudflare_r2_bucket_name,
        Key=file_key,
    )


async def file_exists(file_url: str) -> bool:
    """
    Verifica se um arquivo existe no R2 sem baixá-lo (HEAD request).
    Usado pelo job de verificação de integridade (assets.integrity_status).

    Args:
        file_url: URL pública retornada por upload_file().

    Returns:
        True se o arquivo existir, False se não existir (404).

    Raises:
        ClientError: para erros que não sejam 404 (ex: credenciais inválidas).
    """
    settings = get_settings()
    base = settings.r2_public_url_base

    if not file_url.startswith(base):
        return False

    file_key = file_url.removeprefix(f"{base}/")

    try:
        get_r2_client().head_object(
            Bucket=settings.cloudflare_r2_bucket_name,
            Key=file_key,
        )
        return True
    except ClientError as e:
        if e.response["Error"]["Code"] == "404":
            return False
        raise
