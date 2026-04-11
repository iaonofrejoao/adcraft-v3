from functools import lru_cache

from supabase import Client, create_client

from app.config import get_settings


@lru_cache
def get_supabase() -> Client:
    """
    Retorna cliente Supabase singleton usando a service key (acesso sem RLS).
    Usado exclusivamente no backend — nunca expor a service key ao frontend.
    Cache via lru_cache — uma única instância por processo.
    """
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_key)
