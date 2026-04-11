import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

from app.main import app

client = TestClient(app)

@pytest.fixture
def mock_supabase_api():
    """Mock unificado para todos os routers da API."""
    with patch("app.api.projects.get_supabase") as m_proj, \
         patch("app.api.executions.get_supabase") as m_exec, \
         patch("app.api.assets.get_supabase") as m_ast, \
         patch("app.api.campaigns.get_supabase") as m_camp, \
         patch("app.api.niches.get_supabase") as m_niche:
        
        mock_instance = MagicMock()
        m_proj.return_value = mock_instance
        m_exec.return_value = mock_instance
        m_ast.return_value = mock_instance
        m_camp.return_value = mock_instance
        m_niche.return_value = mock_instance
        yield mock_instance

@pytest.fixture
def mock_celery_tasks_api():
    """Mock de tasks do Celery disparadas pelas rotas."""
    with patch("app.api.executions.run_execution") as m_run, \
         patch("app.api.executions.resume_execution") as m_resume, \
         patch("app.api.campaigns.run_daily_performance") as m_perf:
        
        m_run.delay.return_value.id = "mock-task-1"
        m_resume.delay.return_value.id = "mock-task-2"
        m_perf.delay.return_value.id = "mock-task-3"
        yield m_run, m_resume, m_perf

# -----------------
# Projects
# -----------------
def test_list_projects(mock_supabase_api):
    # Mock chain: select -> eq -> is_ -> order -> execute -> data
    chain = mock_supabase_api.table.return_value.select.return_value.eq.return_value.is_.return_value.order.return_value
    chain.execute.return_value.data = []
    
    response = client.get("/projects/")
    assert response.status_code == 200
    assert response.json() == []

# -----------------
# Executions
# -----------------
def test_create_execution(mock_supabase_api, mock_celery_tasks_api):
    # 1. projeto existe
    mock_supabase_api.table.return_value.select.return_value.eq.return_value.eq.return_value.is_.return_value.execute.return_value.data = [{"id": "proj-1"}]
    
    # 2. insert sucess
    mock_supabase_api.table.return_value.insert.return_value.execute.return_value.data = [{
        "id": "exec-1", "project_id": "proj-1", "user_id": "user-1", "status": "pending", 
        "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-01-01T00:00:00Z"
    }]
    
    payload = {"project_id": "proj-1", "source_execution_ids": [], "node_config_overrides": {}}
    response = client.post("/executions/", json=payload)
    
    assert response.status_code == 201
    assert response.json()["id"] == "exec-1"
    assert response.json()["celery_task_id"] == "mock-task-1"

# -----------------
# Assets
# -----------------
def test_list_assets(mock_supabase_api):
    chain = mock_supabase_api.table.return_value.select.return_value.eq.return_value.is_.return_value.order.return_value.range.return_value
    chain.execute.return_value.data = []
    
    response = client.get("/assets/")
    assert response.status_code == 200
    assert response.json() == []

# -----------------
# Campaigns
# -----------------
def test_list_campaigns(mock_supabase_api):
    chain = mock_supabase_api.table.return_value.select.return_value.eq.return_value.order.return_value.range.return_value
    chain.execute.return_value.data = []
    
    response = client.get("/campaigns/")
    assert response.status_code == 200
    assert response.json() == []

def test_refresh_campaign_metrics(mock_supabase_api, mock_celery_tasks_api):
    # campanha existe
    mock_supabase_api.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [{"id": "camp-1"}]
    
    response = client.post("/campaigns/camp-1/refresh-metrics")
    assert response.status_code == 200
    assert response.json()["celery_task_id"] == "mock-task-3"

# -----------------
# Niches
# -----------------
def test_list_niches(mock_supabase_api):
    mock_supabase_api.table.return_value.select.return_value.order.return_value.execute.return_value.data = []
    
    response = client.get("/niches/")
    assert response.status_code == 200
    assert response.json() == []

# -----------------
# Assistant
# -----------------
def test_assistant_query():
    response = client.post("/assistant/query", json={"query": "olá robô"})
    assert response.status_code == 200
    assert response.json()["context_used"] == ["mock_fallback_v1"]

# -----------------
# WebSocket Handshake Simulation via fastapi TestClient
# -----------------
def test_websocket_connection():
    with client.websocket_connect("/ws/execution/exec-123") as websocket:
        # Testa a manutenção de conexao ping pong do endpoint websocket
        websocket.send_text("ping")
        data = websocket.receive_text()
        assert data == "pong"
