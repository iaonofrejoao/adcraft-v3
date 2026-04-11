from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, Field

from fastapi import APIRouter, Depends, HTTPException, status, Query
from app.database import get_supabase
from app.api.projects import get_current_user_id

router = APIRouter()

# ----------------------------------------------------
# Pydantic Schemas - Nichos & Queue
# ----------------------------------------------------
class NicheResponse(BaseModel):
    id: str
    name: str
    slug: str
    status: str
    trained_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

class NicheTrainResponse(BaseModel):
    niche_id: str
    message: str

class KnowledgeItemResponse(BaseModel):
    id: str
    niche_id: str
    execution_id: Optional[str] = None
    content: str
    memory_type: str
    source_url: Optional[str] = None
    auto_score: float
    auto_score_rationale: Optional[str] = None
    status: str
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime

class KnowledgeActionResponse(BaseModel):
    id: str
    status: str
    message: str

# ----------------------------------------------------
# Endpoints
# ----------------------------------------------------

@router.get("/", response_model=list[NicheResponse])
def list_niches():
    """Lista todos os nichos com status de treinamento."""
    supabase = get_supabase()
    result = supabase.table("niches").select("*").order("created_at").execute()
    
    return [NicheResponse(**row) for row in result.data]

@router.post("/{niche_id}/train", response_model=NicheTrainResponse)
def train_niche(niche_id: str):
    """Inicia treinamento do nicho (atualiza para 'training' e enfileiraria task)."""
    supabase = get_supabase()
    
    exists = supabase.table("niches").select("id").eq("id", niche_id).execute()
    if not exists.data:
        raise HTTPException(status_code=404, detail="Nicho não encontrado")
        
    # Na v1, podemos marcar como 'training' e o Celery job coletaria dados e depois colocaria 'trained'
    supabase.table("niches").update({"status": "training"}).eq("id", niche_id).execute()
    
    # Exemplo: run_niche_training.delay(niche_id)
    return NicheTrainResponse(
        niche_id=niche_id,
        message="Treinamento de nicho iniciado via Celery task (simulado na v1)."
    )

@router.get("/{niche_id}/knowledge-queue", response_model=list[KnowledgeItemResponse])
def get_knowledge_queue(niche_id: str):
    """Lista itens aguardando aprovação na fila de conhecimento do nicho."""
    supabase = get_supabase()
    
    exists = supabase.table("niches").select("id").eq("id", niche_id).execute()
    if not exists.data:
        raise HTTPException(status_code=404, detail="Nicho não encontrado")
        
    result = supabase.table("knowledge_approval_queue").select("*").eq("niche_id", niche_id).eq("status", "pending_approval").order("created_at").execute()
    
    return [KnowledgeItemResponse(**row) for row in result.data]

# Note that the PRD specifies /knowledge/{id}/approve instead of /niches/knowledge/{id}/approve
# Since the router prefix is usually /niches, we can override or just map relative routes.
# Wait, if this router is mounted at /niches, then POST /knowledge/... is wrong here.
# I will map POST /{niche_id}/knowledge/{queue_id}/approve or simply /knowledge/{id}/approve by creating a flat route at app level?
# The PRD section 8 says: POST /knowledge/{id}/approve
# Let's just create a secondary router or map it inside main.py? 
# Better: I will just use APIRouter() and we already register `niches` with prefix `/niches`.
# So I'll put it at `/queue/{item_id}/approve` and change the paths or just override the prefix in main.
# Actually, I will explicitly define the path override using prefix="".

router_knowledge = APIRouter()

@router_knowledge.post("/{item_id}/approve", response_model=KnowledgeActionResponse)
def approve_knowledge(item_id: str, user_id: str = Depends(get_current_user_id)):
    """Aprova item para a base de conhecimento (niche_memory)."""
    supabase = get_supabase()
    
    item = supabase.table("knowledge_approval_queue").select("*").eq("id", item_id).execute()
    if not item.data:
        raise HTTPException(status_code=404, detail="Item de conhecimento não encontrado na fila")
        
    row = item.data[0]
    
    if row["status"] != "pending_approval":
        raise HTTPException(status_code=400, detail="Item não está pendente de aprovação")
        
    # Inicia transferencia para niche_memory
    memory_data = {
        "niche_id": row["niche_id"],
        "memory_type": row["memory_type"],
        "content": row["content"],
        "confidence_score": row["auto_score"], # initial base uses auto_score
        "source_url": row.get("source_url"),
        "knowledge_status": "approved",
        "approved_by_user_id": user_id
    }
    supabase.table("niche_memory").insert(memory_data).execute()
    
    # Atualiza a fila
    now = datetime.utcnow().isoformat()
    supabase.table("knowledge_approval_queue").update({
        "status": "approved",
        "reviewed_by": user_id,
        "reviewed_at": now
    }).eq("id", item_id).execute()
    
    # Verifica se esse era o ultimo a ser aprovado para checkar o nicho como 'trained', ignorando lógica complexa por enquanto
    
    return KnowledgeActionResponse(id=item_id, status="approved", message="Item aprovado e inserido na base de conhecimento.")

@router_knowledge.post("/{item_id}/reject", response_model=KnowledgeActionResponse)
def reject_knowledge(item_id: str, user_id: str = Depends(get_current_user_id)):
    """Rejeita item da fila de conhecimento."""
    supabase = get_supabase()
    
    item = supabase.table("knowledge_approval_queue").select("id, status").eq("id", item_id).execute()
    if not item.data:
        raise HTTPException(status_code=404, detail="Item de conhecimento não encontrado na fila")
        
    if item.data[0]["status"] != "pending_approval":
        raise HTTPException(status_code=400, detail="Item não está pendente de aprovação")
        
    now = datetime.utcnow().isoformat()
    supabase.table("knowledge_approval_queue").update({
        "status": "rejected",
        "reviewed_by": user_id,
        "reviewed_at": now
    }).eq("id", item_id).execute()
    
    return KnowledgeActionResponse(id=item_id, status="rejected", message="Item rejeitado mantido para auditoria.")
