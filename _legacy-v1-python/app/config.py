from functools import lru_cache
from cryptography.fernet import Fernet
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ------------------------------------------------------------------
    # Supabase
    # ------------------------------------------------------------------
    supabase_url: str = Field(..., description="URL do projeto Supabase")
    supabase_anon_key: str = Field(..., description="Chave pública (anon) do Supabase")
    supabase_service_key: str = Field(
        ..., description="Chave de serviço do Supabase — acesso sem RLS, server-side only"
    )

    # ------------------------------------------------------------------
    # Cloudflare R2
    # ------------------------------------------------------------------
    cloudflare_r2_account_id: str = Field("", description="Account ID do Cloudflare R2")
    cloudflare_r2_access_key_id: str = Field("", description="Access key ID do R2")
    cloudflare_r2_secret_access_key: str = Field("", description="Secret access key do R2")
    cloudflare_r2_bucket_name: str = Field("adcraft-media", description="Nome do bucket R2")

    # ------------------------------------------------------------------
    # Segurança — criptografia de credenciais
    # ------------------------------------------------------------------
    credential_encryption_key: str = Field(
        ...,
        description=(
            "Chave Fernet (AES-256-CBC) para criptografar/descriptografar credenciais "
            "de APIs externas na tabela user_credentials. "
            "Gerar com: python -c \"from cryptography.fernet import Fernet; "
            "print(Fernet.generate_key().decode())\""
        ),
    )

    # ------------------------------------------------------------------
    # Redis / Celery
    # ------------------------------------------------------------------
    redis_url: str = Field("redis://redis:6379/0", description="URL de conexão com o Redis")

    # ------------------------------------------------------------------
    # APIs de IA — server-side only, nunca expor ao frontend
    # ------------------------------------------------------------------
    gemini_api_key: str = Field("", description="Chave da API do Google Gemini — nunca expor ao frontend")
    youtube_api_key: str = Field("", description="Chave da YouTube Data API v3")
    meta_app_access_token: str = Field(
        "", description="App access token da Meta para a Ad Library API (sem OAuth de usuário)"
    )

    # ------------------------------------------------------------------
    # Frontend (variáveis públicas — seguro expor)
    # ------------------------------------------------------------------
    next_public_api_url: str = Field("http://localhost:8000", description="URL base da API para o frontend")
    next_public_ws_url: str = Field("ws://localhost:8000", description="URL base do WebSocket para o frontend")
    next_public_supabase_url: str = Field("", description="URL pública do Supabase para o frontend")
    next_public_supabase_anon_key: str = Field("", description="Anon key pública do Supabase para o frontend")

    # ------------------------------------------------------------------
    # Ambiente
    # ------------------------------------------------------------------
    environment: str = Field("development", description="development | production")

    # ------------------------------------------------------------------
    # Modelos Gemini (defaults por tipo de tarefa)
    # ------------------------------------------------------------------
    gemini_model_heavy: str = Field(
        "gemini-3.1-pro-preview",
        description="Modelo para tarefas de raciocínio profundo: Orquestrador, Persona, Ângulo, Roteiro, Copy",
    )
    gemini_model_standard: str = Field(
        "gemini-3.1-pro-preview",
        description="Modelo para tarefas estruturadas: Análise VSL, Viabilidade, Benchmark, Estratégia, Compliance",
    )
    gemini_model_fast: str = Field(
        "gemini-3-flash-preview",
        description="Modelo para tarefas simples: geração de prompt de imagem, UTM",
    )

    # ------------------------------------------------------------------
    # Rate limits (requests/unidades por janela)
    # ------------------------------------------------------------------
    rate_limit_gemini_per_minute: int = Field(15, description="Requisições Gemini API por minuto")
    rate_limit_facebook_ads_per_hour: int = Field(200, description="Requisições Meta Marketing API por hora")
    rate_limit_meta_ad_library_per_hour: int = Field(60, description="Requisições Meta Ad Library API por hora")
    rate_limit_google_ads_per_hour: int = Field(100, description="Requisições Google Ads API por hora")
    rate_limit_youtube_units_per_day: int = Field(10000, description="Unidades de quota YouTube Data API por dia")

    # ------------------------------------------------------------------
    # Propriedades derivadas
    # ------------------------------------------------------------------

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def r2_public_url_base(self) -> str:
        """URL base pública do bucket R2 para construir URLs de ativos."""
        return f"https://pub-{self.cloudflare_r2_account_id}.r2.dev"

    @property
    def r2_configured(self) -> bool:
        """Verifica se as credenciais do R2 estão preenchidas."""
        return bool(self.cloudflare_r2_account_id and self.cloudflare_r2_access_key_id)


@lru_cache
def get_settings() -> Settings:
    """
    Retorna instância singleton das configurações.
    Cache via lru_cache — lê o .env apenas uma vez por processo.
    Uso: from app.config import get_settings; settings = get_settings()
    """
    return Settings()


class CredentialManager:
    """
    Criptografa e descriptografa credenciais de APIs externas em repouso.
    Usa Fernet (AES-256-CBC) com a chave em CREDENTIAL_ENCRYPTION_KEY.

    Regras de segurança:
    - Credenciais nunca trafegam para o frontend
    - Nunca aparecem em logs (configurar mascaramento no logging)
    - Nunca armazenadas em texto puro no banco (tabela user_credentials)
    - A chave de criptografia fica apenas em variável de ambiente
    """

    def __init__(self) -> None:
        key = get_settings().credential_encryption_key
        self._cipher = Fernet(key.encode())

    def encrypt(self, plaintext: str) -> str:
        """Criptografa um valor em texto puro. Retorna string base64 segura."""
        return self._cipher.encrypt(plaintext.encode()).decode()

    def decrypt(self, ciphertext: str) -> str:
        """Descriptografa um valor previamente criptografado com encrypt()."""
        return self._cipher.decrypt(ciphertext.encode()).decode()

    def get_api_key(self, key_name: str, user_id: str) -> str:
        """
        Busca e descriptografa uma credencial do banco para uso server-side.
        Nunca retorna o valor para o frontend — apenas para chamadas internas.

        Raises:
            ValueError: se a credencial não for encontrada para o usuário.
        """
        from app.database import get_supabase

        record = (
            get_supabase()
            .table("user_credentials")
            .select("encrypted_value")
            .eq("user_id", user_id)
            .eq("key_name", key_name)
            .single()
            .execute()
        )

        if not record.data:
            raise ValueError(f"Credencial '{key_name}' não encontrada para o usuário {user_id}")

        return self.decrypt(record.data["encrypted_value"])

    def save_api_key(self, key_name: str, service: str, plaintext: str, user_id: str) -> None:
        """
        Criptografa e salva (ou atualiza) uma credencial no banco.
        Usa upsert para garantir UNIQUE(user_id, key_name).
        """
        from app.database import get_supabase

        get_supabase().table("user_credentials").upsert(
            {
                "user_id": user_id,
                "key_name": key_name,
                "service": service,
                "encrypted_value": self.encrypt(plaintext),
            },
            on_conflict="user_id,key_name",
        ).execute()
