from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.database import get_supabase
from app.api.projects import get_current_user_id
from app.models.execution import (
    ApproveNodeRequest,
    CostBreakdownResponse,
    CreateExecutionRequest,
    ExecutionDetailResponse,
    ExecutionResponse,
    NodeActionResponse,
    NodeCostItem,
    RejectNodeRequest,
)
from app.workers.execution_tasks import run_execution, resume_execution

router = APIRouter()

@router.post("/", response_model=ExecutionResponse, status_code=status.HTTP_201_CREATED)
def create_execution(req: CreateExecutionRequest, user_id: str = Depends(get_current_user_id)):
    """Cria e enfileira uma nova execução (retorna imediatamente, execução Celery)."""
    supabase = get_supabase()
    
    # 1. Checa validade do projeto
    proj_result = supabase.table("projects").select("id").eq("id", req.project_id).eq("user_id", user_id).is_("deleted_at", "null").execute()
    if not proj_result.data:
        raise HTTPException(status_code=404, detail="Projeto inválido ou não encontrado.")
    
    # Placeholder template snapshot e node_config. Em um fluxo real, viria do template_id do projeto.
    # Como PRD 1.0 usa fallback padrão para Kahn's algorithm, instanciamos nodes vazios.
    execution_data = {
        "project_id": req.project_id,
        "user_id": user_id,
        "source_execution_ids": req.source_execution_ids,
        "template_snapshot": {},
        "shared_state": {},
        "node_statuses": {},
        "node_config": req.node_config_overrides,
        "status": "pending",
        "total_cost_usd": 0.0,
        "total_tokens": 0,
    }
    
    exec_result = supabase.table("executions").insert(execution_data).execute()
    if not exec_result.data:
        raise HTTPException(status_code=500, detail="Falha ao criar execução")
        
    created = exec_result.data[0]
    execution_id = created["id"]
    
    # 2. Enfileira no Celery
    task = run_execution.delay(execution_id)
    
    # 3. Salva Task ID e atualiza status para pending (ou running quando pegar pelo celery na v1.0)
    supabase.table("executions").update({"celery_task_id": task.id}).eq("id", execution_id).execute()
    created["celery_task_id"] = task.id
    
    # Calc nodes_completed (0 for mock now)
    return ExecutionResponse(
        id=created["id"],
        project_id=created["project_id"],
        user_id=created["user_id"],
        status=created["status"],
        source_execution_ids=created.get("source_execution_ids", []),
        celery_task_id=created.get("celery_task_id"),
        total_cost_usd=created.get("total_cost_usd", 0.0),
        total_tokens=created.get("total_tokens", 0),
        nodes_completed=0,
        nodes_total=0,
        started_at=None,
        completed_at=None,
        created_at=datetime.fromisoformat(created["created_at"]),
        updated_at=datetime.fromisoformat(created["updated_at"]),
    )

@router.get("/{execution_id}", response_model=ExecutionDetailResponse)
def get_execution(execution_id: str, user_id: str = Depends(get_current_user_id)):
    """Retorna estado completo da execução."""
    supabase = get_supabase()
    result = supabase.table("executions").select("*").eq("id", execution_id).eq("user_id", user_id).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Execução não encontrada")
        
    row = result.data[0]
    return getattr(ExecutionDetailResponse, "model_validate", ExecutionDetailResponse)(row)

@router.get("/{execution_id}/cost", response_model=CostBreakdownResponse)
def get_execution_cost(execution_id: str, user_id: str = Depends(get_current_user_id)):
    """Retorna breakdown de custo por nó."""
    supabase = get_supabase()
    result = supabase.table("executions").select("total_cost_usd, total_tokens, node_statuses").eq("id", execution_id).eq("user_id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Execução não encontrada")
        
    row = result.data[0]
    nodes = []
    
    node_statuses = row.get("node_statuses", {})
    for n_id, n_data in node_statuses.items():
        if isinstance(n_data, dict):
            nodes.append(NodeCostItem(
                node_id=n_id,
                agent_name=n_data.get("agent_name", ""),
                model=n_data.get("model", ""),
                cost_usd=n_data.get("cost_usd", 0.0),
                tokens_input=n_data.get("tokens_used", 0),  # approximation 
                tokens_output=0,
                attempts=n_data.get("attempt", 1),
                duration_seconds=None
            ))
            
    return CostBreakdownResponse(
        execution_id=execution_id,
        total_cost_usd=row.get("total_cost_usd", 0.0),
        total_tokens=row.get("total_tokens", 0),
        nodes=nodes
    )

@router.post("/{execution_id}/approve-node", response_model=NodeActionResponse)
def approve_node(execution_id: str, req: ApproveNodeRequest, user_id: str = Depends(get_current_user_id)):
    """Aprova o output de um nó e continua o fluxo."""
    supabase = get_supabase()
    # Verifica owner
    exists = supabase.table("executions").select("id, status, node_statuses").eq("id", execution_id).eq("user_id", user_id).execute()
    if not exists.data:
        raise HTTPException(status_code=404, detail="Execução não encontrada")
        
    node_statuses = exists.data[0].get("node_statuses", {})
    if req.node_id in node_statuses:
        node_statuses[req.node_id]["status"] = "approved"
        # Pode armazenar selected_variant_ids ou feedback em backend_state
    
    supabase.table("executions").update({"node_statuses": node_statuses}).eq("id", execution_id).execute()
    
    # Chama engine.resume do celery
    resume_execution.delay(execution_id)
    
    return NodeActionResponse(
        execution_id=execution_id,
        node_id=req.node_id,
        action="approve",
        new_node_status="approved",
        next_node_id=None,
        message="Aprovação aceita. Retomando pipeline paralelo.",
    )

@router.post("/{execution_id}/reject-node", response_model=NodeActionResponse)
def reject_node(execution_id: str, req: RejectNodeRequest, user_id: str = Depends(get_current_user_id)):
    """Rejeita o output de um nó com feedback."""
    supabase = get_supabase()
    # Verifica owner
    exists = supabase.table("executions").select("id, status, node_statuses").eq("id", execution_id).eq("user_id", user_id).execute()
    if not exists.data:
        raise HTTPException(status_code=404, detail="Execução não encontrada")
        
    node_statuses = exists.data[0].get("node_statuses", {})
    if req.node_id in node_statuses:
        node_statuses[req.node_id]["status"] = "failed"
        # O backend trata feedback injetando via context posteriormente
        
    supabase.table("executions").update({"node_statuses": node_statuses}).eq("id", execution_id).execute()
    
    # Em rejeição ele não resume automático para continuar. Se ele resume, manda rodar a exception do ExecutionEngine
    resume_execution.delay(execution_id)
    
    return NodeActionResponse(
        execution_id=execution_id,
        node_id=req.node_id,
        action="reject",
        new_node_status="failed",
        next_node_id=req.node_id,
        message="Rejeição efetuada. Retomando node re-run.",
    )

@router.post("/{execution_id}/resume", response_model=ExecutionResponse)
def run_resume(execution_id: str, user_id: str = Depends(get_current_user_id)):
    """Retoma uma execução que está pausada/falha."""
    supabase = get_supabase()
    exists = supabase.table("executions").select("*").eq("id", execution_id).eq("user_id", user_id).execute()
    if not exists.data:
        raise HTTPException(status_code=404, detail="Execução não encontrada")
        
    # atualiza status e trigger task
    supabase.table("executions").update({"status": "running"}).eq("id", execution_id).execute()
    task = resume_execution.delay(execution_id)
    
    updated = exists.data[0]
    updated["status"] = "running"
    
    return ExecutionResponse(
        id=updated["id"],
        project_id=updated["project_id"],
        user_id=updated["user_id"],
        status=updated["status"],  # type: ignore
        source_execution_ids=updated.get("source_execution_ids", []),
        celery_task_id=task.id,
        total_cost_usd=updated.get("total_cost_usd", 0.0),
        total_tokens=updated.get("total_tokens", 0),
        nodes_completed=0,
        nodes_total=0,
        started_at=updated.get("started_at"),
        completed_at=updated.get("completed_at"),
        created_at=datetime.fromisoformat(updated["created_at"]),
        updated_at=datetime.fromisoformat(updated["updated_at"]),
    )

@router.post("/{execution_id}/cancel", response_model=ExecutionResponse)
def cancel_execution(execution_id: str, user_id: str = Depends(get_current_user_id)):
    """Cancela a execução."""
    supabase = get_supabase()
    exists = supabase.table("executions").select("*").eq("id", execution_id).eq("user_id", user_id).execute()
    if not exists.data:
        raise HTTPException(status_code=404, detail="Execução não encontrada")
        
    supabase.table("executions").update({"status": "cancelled"}).eq("id", execution_id).execute()
    
    # Celery task cancelation not directly implemented yet, but updating state stops the engine logic loop.
    updated = exists.data[0]
    updated["status"] = "cancelled"
    
    return ExecutionResponse(
        id=updated["id"],
        project_id=updated["project_id"],
        user_id=updated["user_id"],
        status=updated["status"],  # type: ignore
        source_execution_ids=updated.get("source_execution_ids", []),
        celery_task_id=updated.get("celery_task_id"),
        total_cost_usd=updated.get("total_cost_usd", 0.0),
        total_tokens=updated.get("total_tokens", 0),
        nodes_completed=0,
        nodes_total=0,
        started_at=updated.get("started_at"),
        completed_at=updated.get("completed_at"),
        created_at=datetime.fromisoformat(updated["created_at"]),
        updated_at=datetime.fromisoformat(updated["updated_at"]),
    )
