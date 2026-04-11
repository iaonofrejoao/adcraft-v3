from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends

from app.api.projects import get_current_user_id

router = APIRouter()

class AssistantQuery(BaseModel):
    query: str = Field(..., description="A pergunta formatada em linguagem natural")

class AssistantResponse(BaseModel):
    response: str = Field(..., description="A resposta detalhada enviada pelo assistente")
    context_used: list[str] = Field(default_factory=list, description="Fontes contextuais pesquisadas no banco")

@router.post("/query", response_model=AssistantResponse)
def query_assistant(req: AssistantQuery, user_id: str = Depends(get_current_user_id)):
    """Recebe pergunta em texto e retorna a resposta consultando o banco. Isolado por usuário."""
    # Como PRD 12.2 dita, deveremos ter um AssistantQueryBuilder, que no futuro traduz natural language em queries filtradas por user_id.
    # Ex: AssistantQueryBuilder(user_id=user_id).execute(req.query)
    
    # Na v1, podemos ter um fallback simples.
    # Exemplo mock, para não depender de um sistema NLP complexo imediatamente antes de implementá-lo via Gemini tools.
    
    # ... Inserir integração real de Gemini com function calling apontando para get_supabase() ...
    return AssistantResponse(
        response=f"Esta funcionalidade analisaria a frase '{req.query}' e mapearia em queries do banco relativas à sua conta. Em implementação.",
        context_used=["mock_fallback_v1"]
    )
