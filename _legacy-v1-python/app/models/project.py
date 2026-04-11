"""
AdCraft — Project Models
========================
Pydantic schemas para request/response dos endpoints de Project.

Referência: PRD v1.0 — Seção 7 (tabelas products, projects) e Seção 8 (API /projects)

Endpoints cobertos:
  GET    /projects           → list[ProjectCard]
  POST   /projects           → ProjectResponse
  GET    /projects/{id}      → ProjectDetailResponse
  PATCH  /projects/{id}      → ProjectResponse
  DELETE /projects/{id}      → (204)
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field

from .state import AffiliatePlatform, OrchestratorBehavior


# ──────────────────────────────────────────────
# Produto (sub-recurso do projeto)
# ──────────────────────────────────────────────

class ProductBase(BaseModel):
    """Campos comuns de produto usados em criação e atualização."""

    name: str = Field(..., min_length=1, max_length=255, description="Nome comercial do produto")
    platform: AffiliatePlatform = Field(..., description="Plataforma de afiliado")
    product_url: str = Field(..., description="URL da página de vendas do produtor")
    affiliate_link: str = Field(..., description="Link de afiliado do operador")
    commission_percent: float = Field(..., ge=0, le=100, description="Percentual de comissão")
    ticket_price: float = Field(..., gt=0, description="Preço do produto em moeda local")
    target_country: str = Field(default="BR", max_length=10, description="País-alvo (ISO 3166-1)")
    target_language: str = Field(default="pt-BR", max_length=20, description="Idioma dos criativos")
    vsl_url: Optional[str] = Field(default=None, description="URL da VSL do produtor")


class ProductResponse(BaseModel):
    """Representação de produto retornada pela API."""

    id: str = Field(..., description="UUID do produto")
    user_id: str = Field(..., description="UUID do dono")
    niche_id: Optional[str] = Field(default=None, description="UUID do nicho associado")
    name: str
    platform: str
    product_url: str
    affiliate_link: str
    commission_percent: float
    ticket_price: float
    target_country: str
    target_language: str
    vsl_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# ──────────────────────────────────────────────
# Criação de projeto
# ──────────────────────────────────────────────

class CreateProjectRequest(BaseModel):
    """
    Payload para POST /projects.

    Inclui dados do produto embutidos — o backend cria o produto
    junto com o projeto na mesma transação.
    """

    # Dados do projeto
    name: str = Field(
        ..., min_length=1, max_length=255,
        description="Nome do projeto (ex: 'Suplemento Detox Pro')"
    )
    template_id: Optional[str] = Field(
        default=None,
        description="UUID do template a usar. Se omitido, usa o template padrão."
    )
    ad_account_facebook: Optional[str] = Field(
        default=None, max_length=100,
        description="ID da conta de anúncio no Facebook Ads"
    )
    ad_account_google: Optional[str] = Field(
        default=None, max_length=100,
        description="ID da conta de anúncio no Google Ads"
    )
    budget_for_test: float = Field(
        ..., gt=0,
        description="Budget total disponível para teste em moeda local"
    )
    ad_platforms: list[str] = Field(
        default_factory=lambda: ["facebook"],
        description="Plataformas de anúncio: facebook, google"
    )
    orchestrator_behavior_on_failure: OrchestratorBehavior = Field(
        default=OrchestratorBehavior.AGENT_DECIDES,
        description="Comportamento do orquestrador quando produto é inviável"
    )

    # Dados do produto (embutido)
    product: ProductBase = Field(
        ..., description="Dados do produto afiliado"
    )
    niche_name: Optional[str] = Field(
        default=None,
        description="Nome do nicho. Será criado automaticamente se não existir."
    )


class UpdateProjectRequest(BaseModel):
    """
    Payload para PATCH /projects/{id}.

    Todos os campos são opcionais — atualiza apenas o que for enviado.
    """

    name: Optional[str] = Field(
        default=None, min_length=1, max_length=255,
        description="Novo nome do projeto"
    )
    ad_account_facebook: Optional[str] = Field(
        default=None, max_length=100,
        description="Nova conta de anúncio Facebook"
    )
    ad_account_google: Optional[str] = Field(
        default=None, max_length=100,
        description="Nova conta de anúncio Google"
    )
    budget_for_test: Optional[float] = Field(
        default=None, gt=0,
        description="Novo budget de teste"
    )
    orchestrator_behavior_on_failure: Optional[OrchestratorBehavior] = Field(
        default=None,
        description="Novo comportamento do orquestrador"
    )


# ──────────────────────────────────────────────
# Respostas de projeto
# ──────────────────────────────────────────────

class ProjectResponse(BaseModel):
    """
    Representação de projeto retornada em criação e atualização.
    Inclui dados do produto embutido.
    """

    id: str = Field(..., description="UUID do projeto")
    user_id: str = Field(..., description="UUID do dono")
    name: str
    product: ProductResponse = Field(..., description="Produto associado")
    template_id: Optional[str] = None
    ad_account_facebook: Optional[str] = None
    ad_account_google: Optional[str] = None
    budget_for_test: Optional[float] = None
    orchestrator_behavior_on_failure: str
    created_at: datetime
    updated_at: datetime


class ProjectStats(BaseModel):
    """Estatísticas agregadas exibidas no card e na detail view."""

    executions_count: int = Field(default=0, ge=0, description="Total de execuções")
    creatives_count: int = Field(default=0, ge=0, description="Total de criativos gerados")
    active_campaigns_count: int = Field(default=0, ge=0, description="Campanhas ativas")
    avg_roas: Optional[float] = Field(default=None, description="ROAS médio das campanhas")
    total_spend_brl: float = Field(default=0.0, ge=0, description="Gasto total em BRL")


class ProjectCard(BaseModel):
    """
    Representação compacta de projeto para listagem (GET /projects).

    Inclui estatísticas agregadas para exibição nos cards.
    """

    id: str
    name: str
    product_name: str = Field(..., description="Nome do produto")
    niche_name: Optional[str] = Field(default=None, description="Nome do nicho")
    platform: str = Field(..., description="Plataforma de afiliado")
    target_language: str = Field(default="pt-BR")
    status_badge: str = Field(
        default="idle",
        description="Badge visual: idle, running, paused, completed, failed"
    )
    stats: ProjectStats = Field(default_factory=ProjectStats)
    last_updated: datetime = Field(..., description="updated_at do projeto")
    created_at: datetime


class ProjectDetailResponse(BaseModel):
    """
    Resposta completa de GET /projects/{id}.

    Inclui dados do produto, estatísticas, e lista de execuções recentes.
    """

    id: str
    user_id: str
    name: str
    product: ProductResponse
    template_id: Optional[str] = None
    ad_account_facebook: Optional[str] = None
    ad_account_google: Optional[str] = None
    budget_for_test: Optional[float] = None
    orchestrator_behavior_on_failure: str
    stats: ProjectStats = Field(default_factory=ProjectStats)
    recent_executions: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Últimas 5 execuções resumidas (id, status, created_at)"
    )
    created_at: datetime
    updated_at: datetime
