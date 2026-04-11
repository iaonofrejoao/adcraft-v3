"""
AdCraft — Campaign Models
==========================
Pydantic schemas para request/response dos endpoints de Campaign e Performance.

Referência: PRD v1.0 — Seção 7 (tabelas campaigns, performance_snapshots)
             e Seção 8 (API /campaigns)

Endpoints cobertos:
  GET    /campaigns                       → list[CampaignResponse]
  GET    /campaigns/{id}/metrics          → CampaignMetricsResponse
  POST   /campaigns/{id}/refresh-metrics  → RefreshMetricsResponse
  POST   /campaigns/{id}/pause            → CampaignResponse
  POST   /campaigns/{id}/activate         → CampaignResponse
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


# ──────────────────────────────────────────────
# Query params e filtros
# ──────────────────────────────────────────────

class CampaignFilterParams(BaseModel):
    """
    Query parameters para GET /campaigns.

    Todos os campos são opcionais — filtros combinados com AND.
    """

    project_id: Optional[str] = Field(
        default=None, description="Filtrar por projeto"
    )
    status: Optional[str] = Field(
        default=None, description="Filtrar por status: active, paused"
    )
    platform: Optional[str] = Field(
        default=None, description="Filtrar por plataforma: facebook, google"
    )
    limit: int = Field(default=50, ge=1, le=200, description="Máximo de resultados")
    offset: int = Field(default=0, ge=0, description="Offset para paginação")


# ──────────────────────────────────────────────
# Campanha
# ──────────────────────────────────────────────

class CampaignResponse(BaseModel):
    """
    Representação de campanha retornada pela API.

    Cobre tanto Facebook Ads quanto Google Ads.
    """

    id: str = Field(..., description="UUID interno da campanha")
    user_id: str
    project_id: str
    source_execution_id: str = Field(
        ..., description="UUID da execução que originou a campanha"
    )
    platform: str = Field(
        ..., description="Plataforma: facebook ou google"
    )
    external_campaign_id: Optional[str] = Field(
        default=None,
        description="ID na plataforma externa (Facebook/Google campaign ID)"
    )
    name: str = Field(..., description="Nome da campanha")
    status: str = Field(
        default="paused",
        description="Status: active ou paused"
    )
    daily_budget_brl: Optional[float] = Field(
        default=None, ge=0, description="Budget diário em BRL"
    )
    launched_at: Optional[datetime] = Field(
        default=None, description="Timestamp de ativação"
    )
    paused_at: Optional[datetime] = Field(
        default=None, description="Timestamp da última pausa"
    )
    created_at: datetime
    updated_at: datetime


# ──────────────────────────────────────────────
# Performance Snapshot
# ──────────────────────────────────────────────

class PerformanceSnapshot(BaseModel):
    """
    Snapshot diário de métricas de performance.

    Gerado automaticamente às 5h pelo agente de performance ou
    sob demanda via POST /campaigns/{id}/refresh-metrics.
    """

    id: str = Field(..., description="UUID do snapshot")
    campaign_id: str
    project_id: str
    snapshot_date: date = Field(
        ..., description="Data do snapshot (um por dia por campanha)"
    )
    spend_brl: Optional[float] = Field(default=None, ge=0)
    impressions: Optional[int] = Field(default=None, ge=0)
    clicks: Optional[int] = Field(default=None, ge=0)
    ctr: Optional[float] = Field(
        default=None, ge=0,
        description="Click-through rate (decimal, ex: 0.0200 = 2%)"
    )
    cpc_brl: Optional[float] = Field(default=None, ge=0)
    cpm_brl: Optional[float] = Field(default=None, ge=0)
    conversions: Optional[int] = Field(default=None, ge=0)
    roas: Optional[float] = Field(default=None, ge=0)
    cpa_brl: Optional[float] = Field(default=None, ge=0)
    diagnosis: Optional[str] = Field(
        default=None,
        description="Diagnóstico textual gerado pelo agente de performance"
    )
    created_at: datetime


# ──────────────────────────────────────────────
# Respostas de métricas
# ──────────────────────────────────────────────

class CumulativeMetrics(BaseModel):
    """Métricas acumuladas de uma campanha desde o lançamento."""

    total_spend_brl: float = Field(default=0.0, ge=0)
    total_impressions: int = Field(default=0, ge=0)
    total_clicks: int = Field(default=0, ge=0)
    total_conversions: int = Field(default=0, ge=0)
    avg_ctr: Optional[float] = Field(default=None, ge=0)
    avg_cpc_brl: Optional[float] = Field(default=None, ge=0)
    avg_roas: Optional[float] = Field(default=None, ge=0)
    avg_cpa_brl: Optional[float] = Field(default=None, ge=0)
    days_active: int = Field(default=0, ge=0)


class CampaignMetricsResponse(BaseModel):
    """
    Resposta de GET /campaigns/{id}/metrics.

    Retorna o último snapshot + resumo acumulado.
    """

    campaign_id: str
    campaign_name: str
    platform: str
    status: str
    latest_snapshot: Optional[PerformanceSnapshot] = Field(
        default=None, description="Snapshot mais recente"
    )
    cumulative: CumulativeMetrics = Field(
        default_factory=CumulativeMetrics,
        description="Métricas acumuladas desde o lançamento"
    )
    snapshots_count: int = Field(
        default=0, ge=0, description="Total de snapshots disponíveis"
    )


class RefreshMetricsResponse(BaseModel):
    """
    Resposta de POST /campaigns/{id}/refresh-metrics.

    Confirma que a leitura de métricas foi disparada (Celery task).
    """

    campaign_id: str
    celery_task_id: str = Field(
        ..., description="ID da task Celery para acompanhamento"
    )
    message: str = Field(
        default="Leitura de métricas enfileirada com sucesso",
        description="Mensagem de confirmação"
    )


# ──────────────────────────────────────────────
# Tela de revisão de lançamento
# ──────────────────────────────────────────────

class AdPreview(BaseModel):
    """Preview de um anúncio individual na tela de revisão."""

    ad_id: Optional[str] = Field(default=None, description="ID do anúncio na plataforma")
    creative_url: str = Field(..., description="URL do criativo (vídeo)")
    thumbnail_url: Optional[str] = Field(
        default=None, description="URL do thumbnail"
    )
    headline: str = Field(..., description="Headline do anúncio")
    body: str = Field(..., description="Body copy do anúncio")
    cta: str = Field(..., description="CTA do anúncio")
    final_url: str = Field(..., description="URL de destino com UTMs")


class AdsetPreview(BaseModel):
    """Preview de um conjunto de anúncios na revisão."""

    adset_name: str = Field(..., description="Nome do conjunto")
    targeting_summary: str = Field(
        ..., description="Resumo do público-alvo"
    )
    placement: str = Field(
        default="automatic", description="Posicionamento (automático ou manual)"
    )
    daily_budget_brl: float = Field(..., ge=0, description="Budget diário do conjunto")
    ads: list[AdPreview] = Field(
        default_factory=list, description="Anúncios dentro do conjunto"
    )


class LaunchReviewPayload(BaseModel):
    """
    Dados para a tela de revisão de lançamento (obrigatória antes de ativar).

    Esta é uma tela de confirmação — não um endpoint de criação.
    O operador revisa tudo antes de confirmar a ativação.
    """

    execution_id: str
    platform: str = Field(..., description="facebook ou google")
    campaign_name: str
    campaign_objective: str
    total_daily_budget_brl: float = Field(
        ..., ge=0, description="Budget diário total"
    )
    estimated_3day_spend_brl: float = Field(
        ..., ge=0, description="Estimativa de gasto nos primeiros 3 dias"
    )
    ad_account_id: str = Field(
        ..., description="ID da conta de anúncio que receberá a campanha"
    )
    adsets: list[AdsetPreview] = Field(
        ..., description="Conjuntos de anúncio com seus anúncios"
    )
