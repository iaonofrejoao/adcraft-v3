"""
AdCraft — Asset Models
=======================
Pydantic schemas para request/response dos endpoints de Asset.

Referência: PRD v1.0 — Seção 7 (tabela assets) e Seção 8 (API /assets)

Endpoints cobertos:
  GET    /assets           → list[AssetCard]
  GET    /assets/{id}      → AssetDetailResponse
  PATCH  /assets/{id}      → AssetResponse
  DELETE /assets/{id}      → (204)
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


# ──────────────────────────────────────────────
# Enumerações
# ──────────────────────────────────────────────

class AssetType(str, Enum):
    """Tipo de ativo gerado pela plataforma."""
    CHARACTER = "character"
    KEYFRAME = "keyframe"
    VIDEO_CLIP = "video_clip"
    FINAL_VIDEO = "final_video"
    SCRIPT = "script"
    COPY = "copy"
    HOOK = "hook"
    AUDIO_NARRATION = "audio_narration"


class ApprovalStatus(str, Enum):
    """Status de aprovação de um ativo."""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    APPROVED_WITH_FEEDBACK = "approved_with_feedback"


class IntegrityStatus(str, Enum):
    """Status de integridade do arquivo no R2."""
    VALID = "valid"
    ORPHAN = "orphan"
    CORRUPTED = "corrupted"


# ──────────────────────────────────────────────
# Histórico de feedback (sub-modelo)
# ──────────────────────────────────────────────

class FeedbackEntry(BaseModel):
    """Uma entrada no histórico de feedback de um ativo."""

    attempt: int = Field(..., ge=1, description="Número da tentativa")
    feedback: str = Field(default="", description="Texto do feedback")
    auto_eval_passed: bool = Field(
        default=True,
        description="Se a auto-avaliação do agente passou nesta tentativa"
    )
    created_at: datetime = Field(
        ..., description="Quando o feedback foi dado"
    )


# ──────────────────────────────────────────────
# Query params e filtros
# ──────────────────────────────────────────────

class AssetFilterParams(BaseModel):
    """
    Query parameters para GET /assets.

    Todos os campos são opcionais — filtros combinados com AND.
    """

    project_id: Optional[str] = Field(
        default=None, description="Filtrar por projeto"
    )
    product_id: Optional[str] = Field(
        default=None, description="Filtrar por produto"
    )
    execution_id: Optional[str] = Field(
        default=None, description="Filtrar por execução"
    )
    asset_type: Optional[AssetType] = Field(
        default=None, description="Filtrar por tipo de ativo"
    )
    approval_status: Optional[ApprovalStatus] = Field(
        default=None, description="Filtrar por status de aprovação"
    )
    limit: int = Field(default=50, ge=1, le=200, description="Máximo de resultados")
    offset: int = Field(default=0, ge=0, description="Offset para paginação")


# ──────────────────────────────────────────────
# Atualização de ativo
# ──────────────────────────────────────────────

class UpdateAssetRequest(BaseModel):
    """
    Payload para PATCH /assets/{id}.

    Usado para atualizar o status de aprovação de um ativo.
    """

    approval_status: Optional[ApprovalStatus] = Field(
        default=None, description="Novo status de aprovação"
    )
    feedback: Optional[str] = Field(
        default=None, description="Feedback ao aprovar/rejeitar"
    )
    marketing_metadata: Optional[dict[str, Any]] = Field(
        default=None,
        description="Atualizar metadados de marketing (merge parcial)"
    )


# ──────────────────────────────────────────────
# Respostas de ativo
# ──────────────────────────────────────────────

class AssetResponse(BaseModel):
    """Representação padrão de ativo retornada pela API."""

    id: str = Field(..., description="UUID do ativo")
    user_id: str
    project_id: str
    product_id: str
    execution_id: str
    asset_type: AssetType
    file_url: Optional[str] = Field(
        default=None, description="URL permanente no Cloudflare R2"
    )
    file_extension: Optional[str] = None
    file_size_bytes: Optional[int] = None
    approval_status: ApprovalStatus
    approved_at: Optional[datetime] = None
    marketing_metadata: dict[str, Any] = Field(default_factory=dict)
    integrity_status: str = Field(default="valid")
    created_at: datetime
    updated_at: datetime


class AssetCard(BaseModel):
    """
    Representação compacta de ativo para listagem (GET /assets).

    Usada na Biblioteca de ativos com grid visual.
    """

    id: str
    asset_type: AssetType
    file_url: Optional[str] = None
    file_extension: Optional[str] = None
    approval_status: ApprovalStatus
    project_name: str = Field(default="", description="Nome do projeto (join)")
    execution_number: int = Field(
        default=0, ge=0,
        description="Número sequencial da execução dentro do projeto"
    )

    # Metadados de marketing resumidos (para exibição nos cards)
    angle_type: Optional[str] = None
    hook_text: Optional[str] = None
    format: Optional[str] = None
    confidence_score: Optional[int] = None

    created_at: datetime


class AssetDetailResponse(BaseModel):
    """
    Resposta completa de GET /assets/{id}.

    Inclui histórico de feedback e metadados completos.
    """

    id: str
    user_id: str
    project_id: str
    product_id: str
    execution_id: str
    asset_type: AssetType
    file_url: Optional[str] = None
    file_extension: Optional[str] = None
    file_size_bytes: Optional[int] = None
    approval_status: ApprovalStatus
    approved_at: Optional[datetime] = None
    feedback_history: list[FeedbackEntry] = Field(
        default_factory=list,
        description="Histórico completo de tentativas e feedbacks"
    )
    marketing_metadata: dict[str, Any] = Field(
        default_factory=dict,
        description=(
            "Metadados de marketing: angle_type, emotional_trigger, "
            "hook_text, narrative_structure, format, duration_seconds, "
            "pain_addressed, cta_text, confidence_score"
        )
    )
    integrity_status: str = Field(default="valid")
    created_at: datetime
    updated_at: datetime
