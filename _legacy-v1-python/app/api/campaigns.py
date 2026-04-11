from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status, Query

from app.database import get_supabase
from app.api.projects import get_current_user_id
from app.models.campaign import (
    CampaignResponse,
    CampaignMetricsResponse,
    CumulativeMetrics,
    RefreshMetricsResponse,
)
from app.workers.execution_tasks import run_daily_performance

router = APIRouter()

@router.get("/", response_model=list[CampaignResponse])
def list_campaigns(
    project_id: str | None = Query(None),
    status: str | None = Query(None),
    platform: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user_id: str = Depends(get_current_user_id)
):
    """Lista as campanhas com filtros opcionais."""
    supabase = get_supabase()
    
    query = supabase.table("campaigns").select("*").eq("user_id", user_id)
    if project_id:
        query = query.eq("project_id", project_id)
    if status:
        query = query.eq("status", status)
    if platform:
        query = query.eq("platform", platform)
        
    result = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    
    campaigns = []
    for row in result.data:
        campaigns.append(getattr(CampaignResponse, "model_validate", CampaignResponse)(row))
        
    return campaigns

@router.get("/{campaign_id}/metrics", response_model=CampaignMetricsResponse)
def get_campaign_metrics(campaign_id: str, user_id: str = Depends(get_current_user_id)):
    """Retorna métricas mais recentes e acumulativas."""
    supabase = get_supabase()
    
    camp_result = supabase.table("campaigns").select("*").eq("id", campaign_id).eq("user_id", user_id).execute()
    if not camp_result.data:
        raise HTTPException(status_code=404, detail="Campanha não encontrada")
        
    campaign = camp_result.data[0]
    
    # Busca snapshots
    snaps_result = supabase.table("performance_snapshots").select("*").eq("campaign_id", campaign_id).order("snapshot_date", desc=True).execute()
    snapshots = snaps_result.data
    
    latest = snapshots[0] if snapshots else None
    
    # Calcula aggregados básicos
    total_spend = sum((s.get("spend_brl") or 0.0) for s in snapshots)
    total_imp = sum((s.get("impressions") or 0) for s in snapshots)
    total_clicks = sum((s.get("clicks") or 0) for s in snapshots)
    total_conv = sum((s.get("conversions") or 0) for s in snapshots)
    days_active = len(snapshots)
    
    avg_ctr = (total_clicks / total_imp) if total_imp > 0 else 0.0
    avg_cpc = (total_spend / total_clicks) if total_clicks > 0 else 0.0
    avg_cpa = (total_spend / total_conv) if total_conv > 0 else 0.0
    
    # roas calculation requires conversion value. We simplify below
    avg_roas = None
    if latest and latest.get("roas") is not None:
        avg_roas = sum((s.get("roas") or 0.0) for s in snapshots) / days_active if days_active > 0 else None
        
    cumulative = CumulativeMetrics(
        total_spend_brl=total_spend,
        total_impressions=total_imp,
        total_clicks=total_clicks,
        total_conversions=total_conv,
        avg_ctr=avg_ctr,
        avg_cpc_brl=avg_cpc,
        avg_cpa_brl=avg_cpa,
        avg_roas=avg_roas,
        days_active=days_active
    )
    
    return CampaignMetricsResponse(
        campaign_id=campaign_id,
        campaign_name=campaign["name"],
        platform=campaign["platform"],
        status=campaign["status"],
        latest_snapshot=latest,
        cumulative=cumulative,
        snapshots_count=days_active
    )

@router.post("/{campaign_id}/refresh-metrics", response_model=RefreshMetricsResponse)
def refresh_campaign_metrics(campaign_id: str, user_id: str = Depends(get_current_user_id)):
    """Dispara leitura manual de métricas."""
    supabase = get_supabase()
    camp_result = supabase.table("campaigns").select("id").eq("id", campaign_id).eq("user_id", user_id).execute()
    if not camp_result.data:
        raise HTTPException(status_code=404, detail="Campanha não encontrada")
        
    # a task run_daily_performance na v1 avalia tudo, ou a modificamos depois. Para essa requisição chamamos a global mesmo.
    task = run_daily_performance.delay()
    
    return RefreshMetricsResponse(
        campaign_id=campaign_id,
        celery_task_id=task.id,
        message="Atualização de métricas da campanha em andamento via agente de performance."
    )

@router.post("/{campaign_id}/pause", response_model=CampaignResponse)
def pause_campaign(campaign_id: str, user_id: str = Depends(get_current_user_id)):
    """Pausa uma campanha."""
    supabase = get_supabase()
    camp_result = supabase.table("campaigns").select("*").eq("id", campaign_id).eq("user_id", user_id).execute()
    if not camp_result.data:
        raise HTTPException(status_code=404, detail="Campanha não encontrada")
        
    now = datetime.utcnow().isoformat()
    updated = supabase.table("campaigns").update({"status": "paused", "paused_at": now}).eq("id", campaign_id).execute()
    
    return getattr(CampaignResponse, "model_validate", CampaignResponse)(updated.data[0])

@router.post("/{campaign_id}/activate", response_model=CampaignResponse)
def activate_campaign(campaign_id: str, user_id: str = Depends(get_current_user_id)):
    """Ativa uma campanha. Exige aprovação de lançamento no workflow."""
    supabase = get_supabase()
    camp_result = supabase.table("campaigns").select("*").eq("id", campaign_id).eq("user_id", user_id).execute()
    if not camp_result.data:
        raise HTTPException(status_code=404, detail="Campanha não encontrada")
        
    now = datetime.utcnow().isoformat()
    updated = supabase.table("campaigns").update({"status": "active", "launched_at": now}).eq("id", campaign_id).execute()
    
    return getattr(CampaignResponse, "model_validate", CampaignResponse)(updated.data[0])
