from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.database import get_supabase
from app.models.project import (
    CreateProjectRequest,
    ProjectCard,
    ProjectDetailResponse,
    ProjectResponse,
    ProjectStats,
    ProductResponse,
    UpdateProjectRequest,
)

router = APIRouter()

def get_current_user_id() -> str:
    """Retorna o ID do usuário atual. Na v1.0, pega o primeiro usuário do banco."""
    supabase = get_supabase()
    result = supabase.table("users").select("id").limit(1).execute()
    if not result.data:
        # Cria um usuário inicial caso a base esteja limpa
        new_user = supabase.table("users").insert({
            "email": "admin@adcraft.local",
            "name": "Admin AdCraft"
        }).execute()
        return new_user.data[0]["id"]
    return result.data[0]["id"]


@router.get("/", response_model=list[ProjectCard])
def list_projects(user_id: str = Depends(get_current_user_id)):
    """Lista todos os projetos ativos do usuário."""
    supabase = get_supabase()
    # Para o ProjectCard precisamos de stats agregados. Na v1.0, fazemos um select nas relações.
    result = (
        supabase.table("projects")
        .select(
            "id, name, created_at, updated_at, deleted_at, "
            "product:products(name, platform, target_language, niche:niches(name))"
        )
        .eq("user_id", user_id)
        .is_("deleted_at", "null")
        .order("updated_at", desc=True)
        .execute()
    )

    projects = []
    for row in result.data:
        # Prepara estatísticas fake para listagem (a ser substituído por view ou RPC real no futuro)
        stats = ProjectStats(
            executions_count=0,
            creatives_count=0,
            active_campaigns_count=0,
            avg_roas=None,
            total_spend_brl=0.0
        )
        
        product = row.get("product") or {}
        niche = product.get("niche") or {}
        
        card = ProjectCard(
            id=row["id"],
            name=row["name"],
            product_name=product.get("name", "Desconhecido"),
            niche_name=niche.get("name"),
            platform=product.get("platform", "hotmart"),
            target_language=product.get("target_language", "pt-BR"),
            status_badge="idle",
            stats=stats,
            last_updated=datetime.fromisoformat(row["updated_at"]),
            created_at=datetime.fromisoformat(row["created_at"]),
        )
        projects.append(card)
        
    return projects


@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(req: CreateProjectRequest, user_id: str = Depends(get_current_user_id)):
    """Cria um novo projeto e o produto associado."""
    supabase = get_supabase()
    
    niche_id = None
    if req.niche_name:
        # Busca nicho por slug aproximado ou cria
        slug = req.niche_name.lower().replace(" ", "-")
        niche_result = supabase.table("niches").select("id").eq("slug", slug).execute()
        if niche_result.data:
            niche_id = niche_result.data[0]["id"]
        else:
            new_niche = supabase.table("niches").insert({
                "name": req.niche_name,
                "slug": slug,
                "status": "untrained"
            }).execute()
            niche_id = new_niche.data[0]["id"]
            
    product_data = req.product.model_dump()
    product_data["user_id"] = user_id
    if niche_id:
        product_data["niche_id"] = niche_id
        
    prod_result = supabase.table("products").insert(product_data).execute()
    if not prod_result.data:
        raise HTTPException(status_code=500, detail="Erro ao criar produto")
    
    created_product = prod_result.data[0]
    
    project_payload = req.model_dump(exclude={"product", "niche_name"})
    project_payload["user_id"] = user_id
    project_payload["product_id"] = created_product["id"]
    
    # Orquestrador é Enum, passando .value explicitamente se necessário
    if hasattr(project_payload.get("orchestrator_behavior_on_failure"), "value"):
        project_payload["orchestrator_behavior_on_failure"] = project_payload["orchestrator_behavior_on_failure"].value
        
    proj_result = supabase.table("projects").insert(project_payload).execute()
    if not proj_result.data:
        raise HTTPException(status_code=500, detail="Erro ao criar projeto")
        
    created_project = proj_result.data[0]
    
    product_resp = ProductResponse(**created_product)
    
    return ProjectResponse(
        id=created_project["id"],
        user_id=created_project["user_id"],
        name=created_project["name"],
        product=product_resp,
        template_id=created_project.get("template_id"),
        ad_account_facebook=created_project.get("ad_account_facebook"),
        ad_account_google=created_project.get("ad_account_google"),
        budget_for_test=created_project.get("budget_for_test"),
        orchestrator_behavior_on_failure=created_project.get("orchestrator_behavior_on_failure", "agent_decides"),
        created_at=datetime.fromisoformat(created_project["created_at"]),
        updated_at=datetime.fromisoformat(created_project["updated_at"]),
    )


@router.get("/{project_id}", response_model=ProjectDetailResponse)
def get_project(project_id: str, user_id: str = Depends(get_current_user_id)):
    """Retorna projeto com estatísticas e detalhes completos."""
    supabase = get_supabase()
    
    result = (
        supabase.table("projects")
        .select("*, product:products(*)")
        .eq("id", project_id)
        .eq("user_id", user_id)
        .is_("deleted_at", "null")
        .execute()
    )
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
        
    proj_data = result.data[0]
    product_data = proj_data.pop("product", {})
    if not product_data:
        raise HTTPException(status_code=404, detail="Produto associado não encontrado")
        
    product_resp = ProductResponse(**product_data)
    
    # Execuções recentes
    execs_result = (
        supabase.table("executions")
        .select("id, status, created_at")
        .eq("project_id", project_id)
        .order("created_at", desc=True)
        .limit(5)
        .execute()
    )
    
    stats = ProjectStats(
        executions_count=0,
        creatives_count=0,
        active_campaigns_count=0,
        avg_roas=None,
        total_spend_brl=0.0
    )
    
    return ProjectDetailResponse(
        id=proj_data["id"],
        user_id=proj_data["user_id"],
        name=proj_data["name"],
        product=product_resp,
        template_id=proj_data.get("template_id"),
        ad_account_facebook=proj_data.get("ad_account_facebook"),
        ad_account_google=proj_data.get("ad_account_google"),
        budget_for_test=proj_data.get("budget_for_test"),
        orchestrator_behavior_on_failure=proj_data.get("orchestrator_behavior_on_failure", "agent_decides"),
        stats=stats,
        recent_executions=execs_result.data or [],
        created_at=datetime.fromisoformat(proj_data["created_at"]),
        updated_at=datetime.fromisoformat(proj_data["updated_at"]),
    )


@router.patch("/{project_id}", response_model=ProjectResponse)
def update_project(project_id: str, req: UpdateProjectRequest, user_id: str = Depends(get_current_user_id)):
    """Atualiza as configurações do projeto."""
    supabase = get_supabase()
    
    updates = req.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")
        
    if "orchestrator_behavior_on_failure" in updates and hasattr(updates["orchestrator_behavior_on_failure"], "value"):
        updates["orchestrator_behavior_on_failure"] = updates["orchestrator_behavior_on_failure"].value
        
    # Check if exists
    exists = supabase.table("projects").select("id, product_id").eq("id", project_id).eq("user_id", user_id).is_("deleted_at", "null").execute()
    if not exists.data:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
        
    # Update project
    result = supabase.table("projects").update(updates).eq("id", project_id).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Falha ao atualizar projeto")
        
    updated_proj = result.data[0]
    
    # Needs product inside ProjectResponse
    prod_result = supabase.table("products").select("*").eq("id", updated_proj["product_id"]).execute()
    product_resp = ProductResponse(**prod_result.data[0])
    
    return ProjectResponse(
        id=updated_proj["id"],
        user_id=updated_proj["user_id"],
        name=updated_proj["name"],
        product=product_resp,
        template_id=updated_proj.get("template_id"),
        ad_account_facebook=updated_proj.get("ad_account_facebook"),
        ad_account_google=updated_proj.get("ad_account_google"),
        budget_for_test=updated_proj.get("budget_for_test"),
        orchestrator_behavior_on_failure=updated_proj.get("orchestrator_behavior_on_failure", "agent_decides"),
        created_at=datetime.fromisoformat(updated_proj["created_at"]),
        updated_at=datetime.fromisoformat(updated_proj["updated_at"]),
    )


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: str, user_id: str = Depends(get_current_user_id)):
    """Apaga logicamente (soft delete) o projeto."""
    supabase = get_supabase()
    
    exists = supabase.table("projects").select("id").eq("id", project_id).eq("user_id", user_id).is_("deleted_at", "null").execute()
    if not exists.data:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
        
    supabase.table("projects").update({"deleted_at": datetime.utcnow().isoformat()}).eq("id", project_id).execute()
    
    return None
