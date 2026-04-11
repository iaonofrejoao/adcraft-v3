"""
AdCraft — Notification Models
==============================
Pydantic schemas para request/response de notificações.

Referência: PRD v1.0 — Seção 7 (tabela notifications)

Notificações são criadas internamente pelo backend e publicadas
via Supabase Realtime. Apenas dois tipos:
  - failure:    erro em algum nó da execução
  - completion: fluxo concluído com sucesso
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ──────────────────────────────────────────────
# Enumerações
# ──────────────────────────────────────────────

class NotificationType(str, Enum):
    """Tipos de notificação suportados."""
    FAILURE = "failure"
    COMPLETION = "completion"


# ──────────────────────────────────────────────
# Respostas
# ──────────────────────────────────────────────

class NotificationResponse(BaseModel):
    """Representação de notificação retornada pela API."""

    id: str = Field(..., description="UUID da notificação")
    user_id: str
    execution_id: Optional[str] = Field(
        default=None, description="UUID da execução associada"
    )
    type: NotificationType = Field(
        ..., description="Tipo: failure ou completion"
    )
    title: str = Field(
        ..., max_length=255, description="Título curto da notificação"
    )
    message: str = Field(..., description="Corpo completo da mensagem")
    read: bool = Field(default=False, description="Se já foi lida")
    created_at: datetime


class NotificationListResponse(BaseModel):
    """Lista de notificações com contagem de não lidas."""

    notifications: list[NotificationResponse] = Field(
        default_factory=list
    )
    unread_count: int = Field(
        default=0, ge=0, description="Total de notificações não lidas"
    )
    total_count: int = Field(
        default=0, ge=0, description="Total de notificações"
    )


# ──────────────────────────────────────────────
# Ações
# ──────────────────────────────────────────────

class MarkNotificationReadRequest(BaseModel):
    """Payload para marcar notificação(ões) como lida(s)."""

    notification_ids: list[str] = Field(
        ..., min_length=1,
        description="UUIDs das notificações a marcar como lidas"
    )


class MarkNotificationReadResponse(BaseModel):
    """Resposta de marcação de notificações como lidas."""

    marked_count: int = Field(
        ..., ge=0, description="Quantidade marcada como lida"
    )
    unread_remaining: int = Field(
        ..., ge=0, description="Quantidade restante não lida"
    )


# ──────────────────────────────────────────────
# Criação interna (não exposta na API pública)
# ──────────────────────────────────────────────

class CreateNotification(BaseModel):
    """
    Schema interno para criação de notificação pelo backend.

    NÃO é exposto como endpoint da API — usado pelo sistema
    de orquestração ao detectar conclusão ou falha.
    """

    user_id: str = Field(..., description="UUID do usuário a notificar")
    execution_id: Optional[str] = Field(
        default=None, description="UUID da execução relacionada"
    )
    type: NotificationType = Field(..., description="failure ou completion")
    title: str = Field(
        ..., max_length=255,
        description="Título da notificação"
    )
    message: str = Field(
        ..., description="Corpo da mensagem com detalhes do evento"
    )
