from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status, Query

from app.database import get_supabase
from app.api.projects import get_current_user_id
from app.models.asset import (
    ApprovalStatus,
    AssetCard,
    AssetDetailResponse,
    AssetResponse,
    AssetType,
    UpdateAssetRequest,
)

router = APIRouter()

@router.get("/", response_model=list[AssetCard])
def list_assets(
    project_id: str | None = Query(None),
    product_id: str | None = Query(None),
    execution_id: str | None = Query(None),
    asset_type: AssetType | None = Query(None),
    approval_status: ApprovalStatus | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user_id: str = Depends(get_current_user_id)
):
    """Lista ativos com base nos filtros da AssetFilterParams."""
    supabase = get_supabase()
    
    query = supabase.table("assets").select("*, projects(name), executions(id)").eq("user_id", user_id).is_("deleted_at", "null")
    
    if project_id:
        query = query.eq("project_id", project_id)
    if product_id:
        query = query.eq("product_id", product_id)
    if execution_id:
        query = query.eq("execution_id", execution_id)
    if asset_type:
        query = query.eq("asset_type", asset_type.value)
    if approval_status:
        query = query.eq("approval_status", approval_status.value)
        
    result = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    
    assets = []
    for row in result.data:
        marketing_metadata = row.get("marketing_metadata", {})
        
        card = AssetCard(
            id=row["id"],
            asset_type=row["asset_type"],
            file_url=row.get("file_url"),
            file_extension=row.get("file_extension"),
            approval_status=row["approval_status"],
            project_name=row.get("projects", {}).get("name", ""),
            execution_number=0,  # mock sequence
            angle_type=marketing_metadata.get("angle_type"),
            hook_text=marketing_metadata.get("hook_text"),
            format=marketing_metadata.get("format"),
            confidence_score=marketing_metadata.get("confidence_score"),
            created_at=datetime.fromisoformat(row["created_at"])
        )
        assets.append(card)
        
    return assets

@router.get("/{asset_id}", response_model=AssetDetailResponse)
def get_asset(asset_id: str, user_id: str = Depends(get_current_user_id)):
    """Retorna ativo incluindo feedback history."""
    supabase = get_supabase()
    result = supabase.table("assets").select("*").eq("id", asset_id).eq("user_id", user_id).is_("deleted_at", "null").execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Ativo não encontrado")
    
    row = result.data[0]
    return getattr(AssetDetailResponse, "model_validate", AssetDetailResponse)(row)

@router.patch("/{asset_id}", response_model=AssetResponse)
def update_asset(asset_id: str, req: UpdateAssetRequest, user_id: str = Depends(get_current_user_id)):
    """Atualiza o asset e processa feedbacks passados."""
    supabase = get_supabase()
    exists = supabase.table("assets").select("*").eq("id", asset_id).eq("user_id", user_id).is_("deleted_at", "null").execute()
    if not exists.data:
        raise HTTPException(status_code=404, detail="Ativo não encontrado")
        
    row = exists.data[0]
    updates = {}
    
    if req.approval_status:
        updates["approval_status"] = req.approval_status.value
        if req.approval_status == ApprovalStatus.APPROVED:
            updates["approved_at"] = datetime.utcnow().isoformat()
            
    if req.feedback:
        history = row.get("feedback_history", [])
        history.append({
            "attempt": len(history) + 1,
            "feedback": req.feedback,
            "auto_eval_passed": True,
            "created_at": datetime.utcnow().isoformat()
        })
        updates["feedback_history"] = history
        
    if req.marketing_metadata:
        updates["marketing_metadata"] = {**(row.get("marketing_metadata", {})), **req.marketing_metadata}
        
    if not updates:
        raise HTTPException(status_code=400, detail="Sem atualizações fornecidas")
        
    updated = supabase.table("assets").update(updates).eq("id", asset_id).execute()
    
    return getattr(AssetResponse, "model_validate", AssetResponse)(updated.data[0])

@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_asset(asset_id: str, user_id: str = Depends(get_current_user_id)):
    """Aplica soft delete na entrada de dados."""
    supabase = get_supabase()
    exists = supabase.table("assets").select("id").eq("id", asset_id).eq("user_id", user_id).is_("deleted_at", "null").execute()
    if not exists.data:
        raise HTTPException(status_code=404, detail="Ativo não encontrado")
        
    supabase.table("assets").update({"deleted_at": datetime.utcnow().isoformat()}).eq("id", asset_id).execute()
    return None
