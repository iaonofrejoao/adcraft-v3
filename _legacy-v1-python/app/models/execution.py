"""
AdCraft — Execution Models
===========================
Pydantic schemas para request/response dos endpoints de Execution.

Referência: PRD v1.0 — Seção 7 (tabela executions) e Seção 8 (API /executions)

Endpoints cobertos:
  POST   /executions                    → ExecutionResponse
  GET    /executions/{id}               → ExecutionDetailResponse
  GET    /executions/{id}/cost          → CostBreakdownResponse
  POST   /executions/{id}/approve-node  → NodeActionResponse
  POST   /executions/{id}/reject-node   → NodeActionResponse
  POST   /executions/{id}/resume        → ExecutionResponse
  POST   /executions/{id}/cancel        → ExecutionResponse
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field

from .state import ExecutionState, ExecutionStatus


# ──────────────────────────────────────────────
# Criação de execução
# ──────────────────────────────────────────────

class CreateExecutionRequest(BaseModel):
    """
    Payload para POST /executions.

    Cria uma nova execução assíncrona via Celery.
    O caller recebe o ID imediatamente e acompanha via WebSocket.
    """

    project_id: str = Field(
        ..., description="UUID do projeto para criar a execução"
    )
    source_execution_ids: list[str] = Field(
        default_factory=list,
        description=(
            "UUIDs de execuções anteriores cujos ativos serão reutilizados. "
            "Usado para execuções compostas (ex: novo hook + personagem existente)."
        )
    )
    node_config_overrides: dict[str, Any] = Field(
        default_factory=dict,
        description=(
            "Overrides de configuração por nó. "
            "Ex: { 'agent_7': { 'model': 'claude-opus-4-6', 'quantity': 3 } }"
        )
    )


# ──────────────────────────────────────────────
# Ações sobre nós
# ──────────────────────────────────────────────

class ApproveNodeRequest(BaseModel):
    """
    Payload para POST /executions/{id}/approve-node.

    Aprova o output de um nó e libera o próximo na sequência.
    """

    node_id: str = Field(..., description="ID do nó a ser aprovado")
    feedback: Optional[str] = Field(
        default=None,
        description="Feedback opcional ao aprovar (approved_with_feedback)"
    )
    selected_variant_ids: list[str] = Field(
        default_factory=list,
        description=(
            "IDs das variações selecionadas (quando o nó gera múltiplas). "
            "Ex: seleção de personagem, seleção de keyframes específicos."
        )
    )


class RejectNodeRequest(BaseModel):
    """
    Payload para POST /executions/{id}/reject-node.

    Rejeita o output com feedback obrigatório. O agente reexecuta
    com o feedback incorporado ao contexto.
    """

    node_id: str = Field(..., description="ID do nó a ser rejeitado")
    feedback: str = Field(
        ..., min_length=1,
        description="Feedback obrigatório explicando o motivo da reprovação"
    )


class NodeActionResponse(BaseModel):
    """Resposta de ação sobre um nó (aprovação ou rejeição)."""

    execution_id: str
    node_id: str
    action: str = Field(..., description="approve | reject")
    new_node_status: str = Field(
        ..., description="Novo status do nó após a ação"
    )
    next_node_id: Optional[str] = Field(
        default=None,
        description="ID do próximo nó desbloqueado (se aprovado)"
    )
    message: str = Field(default="", description="Mensagem informativa")


# ──────────────────────────────────────────────
# Status de nó (tempo real via WebSocket/Realtime)
# ──────────────────────────────────────────────

class NodeStatus(BaseModel):
    """
    Status em tempo real de um nó individual.

    Publicado via Supabase Realtime e WebSocket para atualização
    do canvas do React Flow no frontend.
    """

    node_id: str = Field(..., description="ID do nó no template")
    status: str = Field(
        default="idle",
        description="idle | running | waiting_approval | approved | failed | disabled"
    )
    agent_name: Optional[str] = Field(
        default=None, description="Nome do agente executando"
    )
    model: Optional[str] = Field(
        default=None, description="Modelo de IA em uso"
    )
    cost_usd: float = Field(
        default=0.0, ge=0, description="Custo acumulado deste nó em USD"
    )
    tokens_used: int = Field(
        default=0, ge=0, description="Tokens consumidos por este nó"
    )
    attempt: int = Field(
        default=1, ge=1, description="Número da tentativa atual"
    )
    tooltip_message: Optional[str] = Field(
        default=None,
        description=(
            "Mensagem de tooltip exibida no hover. "
            "Ex: 'Aguardando API: YouTube Data · Posição 2 · ~45 segundos'"
        )
    )
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None


class NodeStatusUpdate(BaseModel):
    """
    Evento de atualização de status de nó.

    Enviado via WebSocket em /ws/execution/{execution_id}.
    """

    execution_id: str
    node_statuses: dict[str, NodeStatus] = Field(
        ..., description="Mapa de node_id → status atualizado"
    )
    timestamp: datetime


# ──────────────────────────────────────────────
# Respostas de execução
# ──────────────────────────────────────────────

class ExecutionResponse(BaseModel):
    """
    Representação padrão de execução (criação, resume, cancel).

    Não inclui o shared_state completo — use ExecutionDetailResponse.
    """

    id: str = Field(..., description="UUID da execução")
    project_id: str
    user_id: str
    status: ExecutionStatus
    source_execution_ids: list[str] = Field(default_factory=list)
    celery_task_id: Optional[str] = None
    total_cost_usd: float = Field(default=0.0, ge=0)
    total_tokens: int = Field(default=0, ge=0)
    nodes_completed: int = Field(default=0, ge=0)
    nodes_total: int = Field(default=0, ge=0)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class ExecutionDetailResponse(BaseModel):
    """
    Resposta completa de GET /executions/{id}.

    Inclui o shared_state completo e os status de todos os nós.
    """

    id: str
    project_id: str
    user_id: str
    status: ExecutionStatus
    source_execution_ids: list[str] = Field(default_factory=list)
    template_snapshot: dict[str, Any] = Field(
        default_factory=dict,
        description="Snapshot do template no momento de criação"
    )
    shared_state: ExecutionState = Field(
        default_factory=ExecutionState,
        description="Estado compartilhado completo (PRD Seção 6)"
    )
    node_statuses: dict[str, NodeStatus] = Field(
        default_factory=dict,
        description="Status em tempo real de cada nó"
    )
    node_config: dict[str, Any] = Field(
        default_factory=dict,
        description=(
            "Configurações por nó: approval_required, model, quantity, active"
        )
    )
    total_cost_usd: float = Field(default=0.0, ge=0)
    total_tokens: int = Field(default=0, ge=0)
    celery_task_id: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


# ──────────────────────────────────────────────
# Custo por nó
# ──────────────────────────────────────────────

class NodeCostItem(BaseModel):
    """Custo individual de um nó na execução."""

    node_id: str = Field(..., description="ID do nó")
    agent_name: str = Field(default="", description="Nome do agente")
    model: str = Field(default="", description="Modelo utilizado")
    cost_usd: float = Field(default=0.0, ge=0)
    tokens_input: int = Field(default=0, ge=0, description="Tokens de entrada")
    tokens_output: int = Field(default=0, ge=0, description="Tokens de saída")
    attempts: int = Field(default=1, ge=1, description="Número de tentativas")
    duration_seconds: Optional[float] = Field(
        default=None, ge=0, description="Duração da execução em segundos"
    )


class CostBreakdownResponse(BaseModel):
    """
    Resposta de GET /executions/{id}/cost.

    Breakdown detalhado de custo por nó.
    """

    execution_id: str
    total_cost_usd: float = Field(default=0.0, ge=0)
    total_tokens: int = Field(default=0, ge=0)
    nodes: list[NodeCostItem] = Field(
        default_factory=list, description="Custo detalhado por nó"
    )
