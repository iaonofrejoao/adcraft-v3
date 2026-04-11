"""
tests/integration/test_execution_engine.py

Testes de integração do ExecutionEngine — motor de orquestração do fluxo de agentes.

Cenários cobertos:
  1. Execução sequencial dos agentes 1 ao 8 (nodes 1–8)
  2. Persistência do shared_state após cada nó (write_field_direct chamado por nó)
  3. Comportamento de checkpoint: pausa aguardando aprovação humana
  4. Retomada após falha no agente 5 (deve continuar do node-5, não do node-1)
  5. Paralelismo: nodes 8 e 9 rodando simultaneamente (asyncio.gather)

Estratégia de mock:
  - _AGENT_MODULE_MAP e _load_agent  → agentes Fake sem dependência de módulos reais
  - app.database.get_supabase        → Supabase totalmente mockado (cadeia fluente)
  - StateManager                     → mockado para controlar load/write/statuses
  - CostTracker / RateLimiter        → mockados para evitar dependências
"""

import asyncio
import sys
import pytest
from copy import deepcopy
from unittest.mock import MagicMock, patch

# ---------------------------------------------------------------------------
# Pre-import stubs — evita ModuleNotFoundError em ambientes sem os pacotes
# ---------------------------------------------------------------------------

def _stub(name: str) -> MagicMock:
    """Registra MagicMock como módulo em sys.modules se não existir."""
    if name not in sys.modules:
        mod = MagicMock()
        mod.__name__ = name
        sys.modules[name] = mod
    return sys.modules[name]


_stub("supabase").Client = MagicMock
_stub("supabase").create_client = MagicMock(return_value=MagicMock())
_stub("supabase.lib")
_stub("supabase.lib.client_options")
_stub("postgrest")
_stub("postgrest.exceptions")
_stub("gotrue")
_stub("httpx")
_stub("storage3")
_stub("realtime")
_stub("google")
_stub("google.genai")
_stub("google.genai.types")

# ---------------------------------------------------------------------------
# Agora é seguro importar módulos da app
# ---------------------------------------------------------------------------
from app.orchestration.executor import ExecutionEngine  # noqa: E402


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_supabase_mock(
    node_statuses: dict | None = None,
    shared_state: dict | None = None,
    node_config: dict | None = None,
    template_snapshot: dict | None = None,
) -> MagicMock:
    """Mock do cliente Supabase com cadeia fluente e dados configuráveis."""
    client = MagicMock()

    def _make_chain(data):
        chain = MagicMock()
        result = MagicMock()
        result.data = data
        chain.execute.return_value = result
        chain.single.return_value = chain
        chain.eq.return_value = chain
        chain.select.return_value = chain
        chain.update.return_value = chain
        chain.insert.return_value = chain
        chain.upsert.return_value = chain
        return chain

    exec_data = {
        "node_config": node_config or {},
        "template_snapshot": template_snapshot or {},
        "user_id": "user-test-001",
        "shared_state": shared_state or {},
        "node_statuses": node_statuses or {},
        "status": "pending",
    }
    exec_chain = _make_chain(exec_data)
    notif_chain = _make_chain([{"id": "n-1"}])

    def _router(table_name: str):
        return exec_chain if table_name == "executions" else notif_chain

    client.table.side_effect = _router
    client.rpc.return_value = {"shared_state": shared_state or {}}
    return client


def _sequential_template(node_ids: list[str]) -> dict:
    """Template sequencial node_ids[0] → … → node_ids[-1]."""
    return {
        "nodes": [{"id": nid} for nid in node_ids],
        "edges": [
            {"source": node_ids[i], "target": node_ids[i + 1]}
            for i in range(len(node_ids) - 1)
        ],
    }


def _parallel_template(
    prefix: list[str],
    parallel: list[str],
    suffix: list[str],
) -> dict:
    """Template: prefix sequencial → N nós paralelos → suffix sequencial."""
    all_nodes = prefix + parallel + suffix
    edges = []
    for i in range(len(prefix) - 1):
        edges.append({"source": prefix[i], "target": prefix[i + 1]})
    if prefix:
        for p in parallel:
            edges.append({"source": prefix[-1], "target": p})
    if suffix:
        for p in parallel:
            edges.append({"source": p, "target": suffix[0]})
        for i in range(len(suffix) - 1):
            edges.append({"source": suffix[i], "target": suffix[i + 1]})
    return {"nodes": [{"id": nid} for nid in all_nodes], "edges": edges}


def _make_cost_tracker() -> MagicMock:
    ct = MagicMock()
    ct.total_cost_usd = 0.0
    ct.total_tokens = 0
    ct.node_cost.return_value = None
    return ct


def _make_state_manager(base_state: dict, node_statuses: dict | None = None) -> MagicMock:
    sm = MagicMock()
    sm.load.return_value = deepcopy(base_state)
    sm.load_node_statuses.return_value = node_statuses or {}
    return sm


# Mapeamento campo do state → nome do agente (de _STATE_FIELD_OWNERS)
# O executor usa agent.name para encontrar o campo via _get_field_name()
_FIELD_TO_AGENT_NAME: dict[str, str] = {
    "product":           "orchestrator",
    "product_analysis":  "product_analyzer",
    "market":            "market_researcher",
    "persona":           "persona_builder",
    "angle":             "angle_strategist",
    "benchmark":         "benchmark_agent",
    "strategy":          "campaign_strategist",
    "scripts":           "script_writer",
    "copy":              "copy_writer",
    "character":         "character_generator",
    "keyframes":         "keyframe_generator",
    "video_clips":       "video_generator",
    "final_creatives":   "creative_director",
    "compliance":        "compliance_checker",
    "tracking":          "utm_builder",
    "facebook_campaign": "media_buyer_facebook",
    "google_campaign":   "media_buyer_google",
    "performance":       "performance_analyst",
    "execution_meta":    "orchestrator",
}


def _make_fake_agent(node_id: str, field: str, value: dict, log: list | None = None):
    """
    Retorna uma instância de agente fake que:
    - Registra chamadas em log (pelo node_id)
    - Escreve field=value no state retornado
    """
    class FakeAgent:
        _nid = node_id
        _field = field
        _value = value
        _log = log
        # name deve corresponder ao valor em _STATE_FIELD_OWNERS para que
        # o executor consiga mapear de volta o campo via _get_field_name().
        name = _FIELD_TO_AGENT_NAME.get(field, field)

        def __init__(self, model="test"):
            pass

        async def run(self, **kw):
            state = kw.get("state", {})
            if self._log is not None:
                self._log.append(self._nid)
            updated = deepcopy(state)
            updated[self._field] = self._value
            return updated, {
                "agent_name": self.name,
                "auto_eval_passed": True,
                "attempts": 1,
            }

    return FakeAgent()


def _make_load_agent_side_effect(
    node_field_map: dict,
    agents_log: list | None = None,
) -> callable:
    """
    Retorna side_effect para patch de ExecutionEngine._load_agent.
    O executor chama _load_agent(agent_class_name, model) onde agent_class_name
    vem do _NODE_AGENT_MAP. Mapeamos pelo campo de estado (field).
    """
    from app.orchestration.executor import _NODE_AGENT_MAP
    class_to_node = {v: k for k, v in _NODE_AGENT_MAP.items()}

    def _side_effect(agent_class_name: str, model: str):
        node_id = class_to_node.get(agent_class_name)
        if node_id and node_id in node_field_map:
            field, value = node_field_map[node_id]
            return _make_fake_agent(node_id, field, value, agents_log)
        # Fallback genérico para nós não mapeados no teste
        dummy = MagicMock()
        async def _dummy_run(**kw):
            state = kw.get("state", {})
            return deepcopy(state), {"agent_name": "dummy", "auto_eval_passed": True, "attempts": 1}
        dummy.run = _dummy_run
        dummy.name = agent_class_name.lower()
        return dummy

    return _side_effect


# ---------------------------------------------------------------------------
# Fixture base
# ---------------------------------------------------------------------------

@pytest.fixture
def base_state() -> dict:
    return {
        "product": {
            "name": "Produto Teste Engine",
            "niche": "saude",
            "platform": "hotmart",
            "ticket_price": 197.0,
            "ad_platforms": ["facebook"],
            "target_language": "pt-BR",
            "budget_for_test": 300.0,
            "affiliate_link": "https://hotmart.com/teste",
            "orchestrator_behavior_on_failure": "agent_decides",
        }
    }


# ---------------------------------------------------------------------------
# 1. Execução sequencial dos agentes 1 ao 8
# ---------------------------------------------------------------------------

class TestSequentialExecution:
    """Agentes 1–8 devem ser disparados em ordem, cada um escrevendo seu campo."""

    @pytest.mark.asyncio
    async def test_agents_1_to_8_run_in_order(self, base_state):
        """
        Com template node-1→…→node-8 (approval_required=False),
        todos os 8 agentes devem ser chamados em sequência e o resultado
        deve ser status='completed'.
        """
        node_ids = [f"node-{i}" for i in range(1, 9)]
        template = _sequential_template(node_ids)
        node_config = {nid: {"approval_required": False, "active": True} for nid in node_ids}
        execution_id = "exec-seq-001"

        node_field_map = {
            "node-1": ("product_analysis", {"main_promise": "Emagreça X kg"}),
            "node-2": ("market", {"viability_score": 80, "viability_verdict": "viable"}),
            "node-3": ("persona", {"summary": "Persona A"}),
            "node-4": ("angle", {"primary_angle": "Autoridade traída"}),
            "node-5": ("benchmark", {"top_hooks_found": []}),
            "node-6": ("strategy", {"max_cpa_brl": 60.0}),
            "node-7": ("scripts", {"scripts": []}),
            "node-8": ("copy", {"headlines": []}),
        }

        agents_called: list[str] = []
        load_agent_fn = _make_load_agent_side_effect(node_field_map, agents_called)
        supabase = _make_supabase_mock(
            node_config=node_config,
            template_snapshot=template,
            shared_state=deepcopy(base_state),
        )

        with patch("app.orchestration.executor.get_supabase", return_value=supabase), \
             patch.object(ExecutionEngine, "_requires_approval", return_value=False), \
             patch.object(ExecutionEngine, "_load_agent", side_effect=load_agent_fn), \
             patch("app.orchestration.executor.CostTracker", return_value=_make_cost_tracker()), \
             patch("app.orchestration.executor.RateLimiter", return_value=MagicMock()), \
             patch("app.orchestration.executor.StateManager",
                   return_value=_make_state_manager(base_state)):
            engine = ExecutionEngine()
            result = await engine.run(execution_id)

        assert result["status"] == "completed", f"Esperado 'completed', obtido: {result}"
        assert len(agents_called) == 8, f"Esperado 8 agentes, chamados: {agents_called}"

        expected_order = [f"node-{i}" for i in range(1, 9)]
        assert agents_called == expected_order, f"Ordem errada: {agents_called}"

    @pytest.mark.asyncio
    async def test_completed_result_contains_expected_keys(self, base_state):
        """O resultado de uma execução bem-sucedida deve conter os campos padrão."""
        node_ids = ["node-3", "node-4"]
        template = _sequential_template(node_ids)
        node_config = {nid: {"approval_required": False, "active": True} for nid in node_ids}
        execution_id = "exec-seq-keys-001"

        node_field_map = {
            "node-3": ("persona", {"summary": "P"}),
            "node-4": ("angle", {"primary_angle": "A"}),
        }
        load_agent_fn = _make_load_agent_side_effect(node_field_map)
        supabase = _make_supabase_mock(
            node_config=node_config,
            template_snapshot=template,
            shared_state=deepcopy(base_state),
        )

        with patch("app.orchestration.executor.get_supabase", return_value=supabase), \
             patch.object(ExecutionEngine, "_requires_approval", return_value=False), \
             patch.object(ExecutionEngine, "_load_agent", side_effect=load_agent_fn), \
             patch("app.orchestration.executor.CostTracker", return_value=_make_cost_tracker()), \
             patch("app.orchestration.executor.RateLimiter", return_value=MagicMock()), \
             patch("app.orchestration.executor.StateManager",
                   return_value=_make_state_manager(base_state)):
            engine = ExecutionEngine()
            result = await engine.run(execution_id)

        assert result["status"] == "completed"
        assert "execution_id" in result
        assert "nodes_completed" in result
        assert "total_cost_usd" in result
        assert result["nodes_completed"] == 2


# ---------------------------------------------------------------------------
# 2. Persistência do estado após cada nó
# ---------------------------------------------------------------------------

class TestStatePersistencePerNode:
    """write_field_direct deve ser invocado após cada nó com o campo correto."""

    @pytest.mark.asyncio
    async def test_state_accumulated_after_each_node(self, base_state):
        """
        O shared_state acumulado via write_field_direct deve conter os campos
        escritos por cada agente após a conclusão.
        """
        node_ids = ["node-1", "node-2", "node-3"]
        template = _sequential_template(node_ids)
        node_config = {nid: {"approval_required": False, "active": True} for nid in node_ids}
        execution_id = "exec-persist-001"

        node_field_map = {
            "node-1": ("product_analysis", {"main_promise": "Teste"}),
            "node-2": ("market", {"viability_score": 75, "viability_verdict": "viable"}),
            "node-3": ("persona", {"summary": "Persona básica"}),
        }

        accumulated = deepcopy(base_state)
        sm = MagicMock()
        sm.load.side_effect = lambda: deepcopy(accumulated)
        sm.load_node_statuses.return_value = {}
        def _write(field, value, **kw):
            accumulated[field] = value
        sm.write_field_direct.side_effect = _write

        load_agent_fn = _make_load_agent_side_effect(node_field_map)
        supabase = _make_supabase_mock(
            node_config=node_config,
            template_snapshot=template,
            shared_state=deepcopy(base_state),
        )

        with patch("app.orchestration.executor.get_supabase", return_value=supabase), \
             patch.object(ExecutionEngine, "_requires_approval", return_value=False), \
             patch.object(ExecutionEngine, "_load_agent", side_effect=load_agent_fn), \
             patch("app.orchestration.executor.CostTracker", return_value=_make_cost_tracker()), \
             patch("app.orchestration.executor.RateLimiter", return_value=MagicMock()), \
             patch("app.orchestration.executor.StateManager", return_value=sm):
            engine = ExecutionEngine()
            result = await engine.run(execution_id)

        assert result["status"] == "completed"

        for _, (field, _) in node_field_map.items():
            assert field in accumulated, (
                f"Campo '{field}' não foi escrito. Acumulado: {list(accumulated.keys())}"
            )

    @pytest.mark.asyncio
    async def test_persist_cost_summary_called_after_each_node(self, base_state):
        """persist_cost_summary deve ser chamado ao menos N vezes para N nós."""
        node_ids = ["node-3", "node-4"]
        template = _sequential_template(node_ids)
        node_config = {nid: {"approval_required": False, "active": True} for nid in node_ids}
        execution_id = "exec-persist-cost-001"

        node_field_map = {
            "node-3": ("persona", {"summary": "P"}),
            "node-4": ("angle", {"primary_angle": "A"}),
        }

        sm = _make_state_manager(base_state)
        load_agent_fn = _make_load_agent_side_effect(node_field_map)
        supabase = _make_supabase_mock(
            node_config=node_config,
            template_snapshot=template,
            shared_state=deepcopy(base_state),
        )

        with patch("app.orchestration.executor.get_supabase", return_value=supabase), \
             patch.object(ExecutionEngine, "_requires_approval", return_value=False), \
             patch.object(ExecutionEngine, "_load_agent", side_effect=load_agent_fn), \
             patch("app.orchestration.executor.CostTracker", return_value=_make_cost_tracker()), \
             patch("app.orchestration.executor.RateLimiter", return_value=MagicMock()), \
             patch("app.orchestration.executor.StateManager", return_value=sm):
            engine = ExecutionEngine()
            await engine.run(execution_id)

        # Chamado uma vez por nó + uma vez ao completar = N+1 mínimo
        assert sm.persist_cost_summary.call_count >= len(node_ids)

    @pytest.mark.asyncio
    async def test_each_node_status_updated_to_approved(self, base_state):
        """update_node_status deve ser chamado com 'approved' para cada nó."""
        node_ids = ["node-3", "node-6"]
        template = _sequential_template(node_ids)
        node_config = {nid: {"approval_required": False, "active": True} for nid in node_ids}
        execution_id = "exec-persist-status-001"

        node_field_map = {
            "node-3": ("persona", {"summary": "P"}),
            "node-6": ("strategy", {"max_cpa_brl": 60.0}),
        }

        sm = _make_state_manager(base_state)
        load_agent_fn = _make_load_agent_side_effect(node_field_map)
        supabase = _make_supabase_mock(
            node_config=node_config,
            template_snapshot=template,
            shared_state=deepcopy(base_state),
        )

        with patch("app.orchestration.executor.get_supabase", return_value=supabase), \
             patch.object(ExecutionEngine, "_requires_approval", return_value=False), \
             patch.object(ExecutionEngine, "_load_agent", side_effect=load_agent_fn), \
             patch("app.orchestration.executor.CostTracker", return_value=_make_cost_tracker()), \
             patch("app.orchestration.executor.RateLimiter", return_value=MagicMock()), \
             patch("app.orchestration.executor.StateManager", return_value=sm):
            engine = ExecutionEngine()
            await engine.run(execution_id)

        calls = sm.update_node_status.call_args_list
        nodes_set_approved = {
            c.kwargs.get("node_id") or (c.args[0] if c.args else None)
            for c in calls
            if (c.kwargs.get("status") or (c.args[1] if len(c.args) > 1 else "")) == "approved"
        }
        for nid in node_ids:
            assert nid in nodes_set_approved, (
                f"Nó {nid} não teve status 'approved'. Status calls: {calls}"
            )


# ---------------------------------------------------------------------------
# 3. Comportamento de checkpoint (pausa aguardando aprovação)
# ---------------------------------------------------------------------------

class TestCheckpointBehavior:
    """O fluxo pausa quando approval_required=True."""

    @pytest.mark.asyncio
    async def test_pauses_at_mandatory_approval_node1(self, base_state):
        """
        node-1 é _MANDATORY_APPROVAL_NODES. O engine deve pausar
        com status='paused_for_approval' e waiting_node='node-1'.
        """
        node_ids = ["node-1", "node-2", "node-3"]
        template = _sequential_template(node_ids)
        execution_id = "exec-ckpt-001"

        node_field_map = {
            "node-1": ("product_analysis", {"main_promise": "Checkpoint test"}),
            "node-2": ("market", {"viability_score": 80, "viability_verdict": "viable"}),
            "node-3": ("persona", {"summary": "P"}),
        }

        # sem override → node-1 usa defaults (approval_required default = True via _MANDATORY_APPROVAL_NODES)
        supabase = _make_supabase_mock(
            node_config={},
            template_snapshot=template,
            shared_state=deepcopy(base_state),
        )
        load_agent_fn = _make_load_agent_side_effect(node_field_map)

        with patch("app.orchestration.executor.get_supabase", return_value=supabase), \
             patch.object(ExecutionEngine, "_load_agent", side_effect=load_agent_fn), \
             patch("app.orchestration.executor.CostTracker", return_value=_make_cost_tracker()), \
             patch("app.orchestration.executor.RateLimiter", return_value=MagicMock()), \
             patch("app.orchestration.executor.StateManager",
                   return_value=_make_state_manager(base_state)):
            engine = ExecutionEngine()
            result = await engine.run(execution_id)

        assert result["status"] == "paused_for_approval", \
            f"Esperado 'paused_for_approval', obtido: {result['status']}"
        assert result["waiting_node"] == "node-1", \
            f"Esperado pausa em 'node-1', obtido: {result.get('waiting_node')}"

    @pytest.mark.asyncio
    async def test_pauses_at_configured_approval_node3(self, base_state):
        """
        node-3 com approval_required=True; nodes 6 e 7 com False.
        O fluxo deve executar node-3 e pausar sem avançar para node-6.
        """
        node_ids = ["node-3", "node-6", "node-7"]
        template = _sequential_template(node_ids)
        execution_id = "exec-ckpt-002"

        node_config = {
            "node-3": {"approval_required": True, "active": True},
            "node-6": {"approval_required": False, "active": True},
            "node-7": {"approval_required": False, "active": True},
        }

        nodes_executed: list[str] = []
        node_field_map = {
            "node-3": ("persona", {"summary": "P"}),
            "node-6": ("strategy", {"max_cpa_brl": 60.0}),
            "node-7": ("scripts", {"scripts": []}),
        }

        load_agent_fn = _make_load_agent_side_effect(node_field_map, nodes_executed)
        supabase = _make_supabase_mock(
            node_config=node_config,
            template_snapshot=template,
            shared_state=deepcopy(base_state),
        )

        with patch("app.orchestration.executor.get_supabase", return_value=supabase), \
             patch.object(ExecutionEngine, "_load_agent", side_effect=load_agent_fn), \
             patch("app.orchestration.executor.CostTracker", return_value=_make_cost_tracker()), \
             patch("app.orchestration.executor.RateLimiter", return_value=MagicMock()), \
             patch("app.orchestration.executor.StateManager",
                   return_value=_make_state_manager(base_state)):
            engine = ExecutionEngine()
            result = await engine.run(execution_id)

        assert result["status"] == "paused_for_approval"
        assert result["waiting_node"] == "node-3"
        assert "node-3" in nodes_executed, "node-3 deve ter executado antes de pausar"
        assert "node-6" not in nodes_executed, "node-6 não deve ter rodado após pausa"
        assert "node-7" not in nodes_executed, "node-7 não deve ter rodado após pausa"

    @pytest.mark.asyncio
    async def test_execution_status_set_to_paused_for_approval(self, base_state):
        """
        update_execution_status deve ser chamado com 'paused_for_approval'
        quando o fluxo pausa.
        """
        node_ids = ["node-3"]
        template = _sequential_template(node_ids)
        execution_id = "exec-ckpt-status-001"

        node_config = {"node-3": {"approval_required": True, "active": True}}
        node_field_map = {"node-3": ("persona", {"summary": "P"})}

        sm = _make_state_manager(base_state)
        load_agent_fn = _make_load_agent_side_effect(node_field_map)
        supabase = _make_supabase_mock(
            node_config=node_config,
            template_snapshot=template,
            shared_state=deepcopy(base_state),
        )

        with patch("app.orchestration.executor.get_supabase", return_value=supabase), \
             patch.object(ExecutionEngine, "_load_agent", side_effect=load_agent_fn), \
             patch("app.orchestration.executor.CostTracker", return_value=_make_cost_tracker()), \
             patch("app.orchestration.executor.RateLimiter", return_value=MagicMock()), \
             patch("app.orchestration.executor.StateManager", return_value=sm):
            engine = ExecutionEngine()
            await engine.run(execution_id)

        statuses = [
            c.args[0] if c.args else c.kwargs.get("status")
            for c in sm.update_execution_status.call_args_list
        ]
        assert "paused_for_approval" in statuses, (
            f"Status 'paused_for_approval' não foi setado. Statuses: {statuses}"
        )


# ---------------------------------------------------------------------------
# 4. Retomada após falha no agente 5 (deve continuar do 5, não do 1)
# ---------------------------------------------------------------------------

class TestResumeAfterFailure:
    """resume() deve pular nós aprovados e recomeçar do primeiro não aprovado."""

    @pytest.mark.asyncio
    async def test_resume_skips_approved_nodes_1_to_4(self, base_state):
        """
        Nodes 1–4 aprovados. resume() deve pular todos e executar node-5
        em diante.
        """
        node_ids = [f"node-{i}" for i in range(1, 9)]
        template = _sequential_template(node_ids)
        execution_id = "exec-resume-001"

        pre_approved = {f"node-{i}": {"status": "approved"} for i in range(1, 5)}
        node_config = {nid: {"approval_required": False, "active": True} for nid in node_ids}

        field_by_node = {
            "node-1": "product_analysis",
            "node-2": "market",
            "node-3": "persona",
            "node-4": "angle",
            "node-5": "benchmark",
            "node-6": "strategy",
            "node-7": "scripts",
            "node-8": "copy",
        }
        node_field_map = {
            nid: (field_by_node[nid], {"viability_verdict": "viable"} if nid == "node-2" else {})
            for nid in node_ids
        }

        actually_executed: list[str] = []
        load_agent_fn = _make_load_agent_side_effect(node_field_map, actually_executed)
        supabase = _make_supabase_mock(
            node_config=node_config,
            template_snapshot=template,
            shared_state=deepcopy(base_state),
            node_statuses=pre_approved,
        )

        with patch("app.orchestration.executor.get_supabase", return_value=supabase), \
             patch.object(ExecutionEngine, "_requires_approval", return_value=False), \
             patch.object(ExecutionEngine, "_load_agent", side_effect=load_agent_fn), \
             patch("app.orchestration.executor.CostTracker", return_value=_make_cost_tracker()), \
             patch("app.orchestration.executor.RateLimiter", return_value=MagicMock()), \
             patch("app.orchestration.executor.StateManager",
                   return_value=_make_state_manager(base_state, pre_approved)):
            engine = ExecutionEngine()
            result = await engine.resume(execution_id)

        for nid in ["node-1", "node-2", "node-3", "node-4"]:
            assert nid not in actually_executed, \
                f"Nó {nid} foi re-executado indevidamente"

        for nid in ["node-5", "node-6", "node-7", "node-8"]:
            assert nid in actually_executed, \
                f"Nó {nid} deveria ter sido executado durante resume()"

    @pytest.mark.asyncio
    async def test_resume_from_node5_after_explicit_failure(self, base_state):
        """
        node-5 marcado como 'failed'. resume() deve re-executar apenas
        node-5 e pular nodes 1–4 (aprovados).
        """
        node_ids = [f"node-{i}" for i in range(1, 6)]
        template = _sequential_template(node_ids)
        execution_id = "exec-resume-node5-001"

        statuses = {f"node-{i}": {"status": "approved"} for i in range(1, 5)}
        statuses["node-5"] = {"status": "failed"}

        node_config = {nid: {"approval_required": False, "active": True} for nid in node_ids}

        node_field_map = {
            "node-1": ("product_analysis", {}),
            "node-2": ("market", {"viability_score": 80, "viability_verdict": "viable"}),
            "node-3": ("persona", {}),
            "node-4": ("angle", {}),
            "node-5": ("benchmark", {"top_hooks_found": []}),
        }

        executed: list[str] = []
        load_agent_fn = _make_load_agent_side_effect(node_field_map, executed)
        supabase = _make_supabase_mock(
            node_config=node_config,
            template_snapshot=template,
            shared_state=deepcopy(base_state),
            node_statuses=statuses,
        )

        with patch("app.orchestration.executor.get_supabase", return_value=supabase), \
             patch.object(ExecutionEngine, "_requires_approval", return_value=False), \
             patch.object(ExecutionEngine, "_load_agent", side_effect=load_agent_fn), \
             patch("app.orchestration.executor.CostTracker", return_value=_make_cost_tracker()), \
             patch("app.orchestration.executor.RateLimiter", return_value=MagicMock()), \
             patch("app.orchestration.executor.StateManager",
                   return_value=_make_state_manager(base_state, statuses)):
            engine = ExecutionEngine()
            result = await engine.resume(execution_id)

        assert "node-5" in executed, "node-5 deve ser reexecutado após falha"
        for nid in ["node-1", "node-2", "node-3", "node-4"]:
            assert nid not in executed, f"Nó {nid} não deveria ser re-executado"

    @pytest.mark.asyncio
    async def test_resume_result_is_completed_when_success(self, base_state):
        """
        Quando os nós restantes no resume completam com sucesso, o
        resultado final deve ser status='completed'.
        """
        node_ids = ["node-5"]
        template = _sequential_template(node_ids)
        execution_id = "exec-resume-complete-001"

        node_config = {"node-5": {"approval_required": False, "active": True}}
        node_field_map = {"node-5": ("benchmark", {"top_hooks_found": []})}

        load_agent_fn = _make_load_agent_side_effect(node_field_map)
        supabase = _make_supabase_mock(
            node_config=node_config,
            template_snapshot=template,
            shared_state=deepcopy(base_state),
            node_statuses={},
        )

        with patch("app.orchestration.executor.get_supabase", return_value=supabase), \
             patch.object(ExecutionEngine, "_requires_approval", return_value=False), \
             patch.object(ExecutionEngine, "_load_agent", side_effect=load_agent_fn), \
             patch("app.orchestration.executor.CostTracker", return_value=_make_cost_tracker()), \
             patch("app.orchestration.executor.RateLimiter", return_value=MagicMock()), \
             patch("app.orchestration.executor.StateManager",
                   return_value=_make_state_manager(base_state)):
            engine = ExecutionEngine()
            result = await engine.resume(execution_id)

        assert result["status"] == "completed"


# ---------------------------------------------------------------------------
# 5. Paralelismo de nodes 8 e 9 rodando simultaneamente
# ---------------------------------------------------------------------------

class TestParallelExecution:
    """Nodes 8 e 9 em wave paralela devem rodar via asyncio.gather."""

    @pytest.mark.asyncio
    async def test_nodes_8_and_9_start_before_either_ends(self, base_state):
        """
        Com asyncio.sleep(0.05) em cada agente paralelo, ambos devem
        iniciar antes de qualquer um terminar — provando paralelismo real.
        """
        template = _parallel_template(
            prefix=["node-7"],
            parallel=["node-8", "node-9"],
            suffix=["node-13"],
        )
        execution_id = "exec-parallel-001"

        node_config = {
            "node-7":  {"approval_required": False, "active": True},
            "node-8":  {"approval_required": False, "active": True},
            "node-9":  {"approval_required": False, "active": True},
            "node-13": {"approval_required": False, "active": True},
        }

        log: list[str] = []

        class ScriptFake:
            name = "script_writer"
            def __init__(self, model="test"): pass
            async def run(self, **kw):
                state = kw.get("state", {})
                updated = deepcopy(state)
                updated["scripts"] = {"scripts": []}
                return updated, {"agent_name": self.name, "auto_eval_passed": True, "attempts": 1}

        class CopyFake:
            name = "copy_writer"
            def __init__(self, model="test"): pass
            async def run(self, **kw):
                state = kw.get("state", {})
                log.append("node-8-start")
                await asyncio.sleep(0.05)
                log.append("node-8-end")
                updated = deepcopy(state)
                updated["copy"] = {"headlines": []}
                return updated, {"agent_name": self.name, "auto_eval_passed": True, "attempts": 1}

        class CharFake:
            name = "character_generator"
            def __init__(self, model="test"): pass
            async def run(self, **kw):
                state = kw.get("state", {})
                log.append("node-9-start")
                await asyncio.sleep(0.05)
                log.append("node-9-end")
                updated = deepcopy(state)
                updated["character"] = {"character_asset_id": "char-001"}
                return updated, {"agent_name": self.name, "auto_eval_passed": True, "attempts": 1}

        class ComplianceFake:
            name = "compliance_checker"
            def __init__(self, model="test"): pass
            async def run(self, **kw):
                state = kw.get("state", {})
                updated = deepcopy(state)
                updated["compliance"] = {"overall_approved": True}
                return updated, {"agent_name": self.name, "auto_eval_passed": True, "attempts": 1}

        from app.orchestration.executor import _NODE_AGENT_MAP
        agent_classes = {
            _NODE_AGENT_MAP.get("node-7"):  ScriptFake,
            _NODE_AGENT_MAP.get("node-8"):  CopyFake,
            _NODE_AGENT_MAP.get("node-9"):  CharFake,
            _NODE_AGENT_MAP.get("node-13"): ComplianceFake,
        }

        def _load_agent_parallel(class_name: str, model: str):
            cls = agent_classes.get(class_name)
            if cls:
                return cls()
            dummy = MagicMock()
            async def _dummy(**kw):
                state = kw.get("state", {})
                return deepcopy(state), {"agent_name": "dummy", "auto_eval_passed": True, "attempts": 1}
            dummy.run = _dummy
            dummy.name = "dummy"
            return dummy

        supabase = _make_supabase_mock(
            node_config=node_config,
            template_snapshot=template,
            shared_state=deepcopy(base_state),
        )

        with patch("app.orchestration.executor.get_supabase", return_value=supabase), \
             patch.object(ExecutionEngine, "_requires_approval", return_value=False), \
             patch.object(ExecutionEngine, "_load_agent", side_effect=_load_agent_parallel), \
             patch("app.orchestration.executor.CostTracker", return_value=_make_cost_tracker()), \
             patch("app.orchestration.executor.RateLimiter", return_value=MagicMock()), \
             patch("app.orchestration.executor.StateManager",
                   return_value=_make_state_manager(base_state)):
            engine = ExecutionEngine()
            result = await engine.run(execution_id)

        assert result["status"] == "completed", f"Esperado 'completed', obtido: {result}"

        assert "node-8-start" in log
        assert "node-9-start" in log
        assert "node-8-end" in log
        assert "node-9-end" in log

        # Com gather paralelo, os dois starts devem aparecer antes dos ends
        first_two = log[:2]
        assert "node-8-start" in first_two and "node-9-start" in first_two, (
            f"Os dois agentes deveriam ter iniciado juntos. Log: {log}"
        )

    @pytest.mark.asyncio
    async def test_parallel_nodes_write_to_exclusive_fields(self, base_state):
        """
        Nodes 8 e 9 escrevem em 'copy' e 'character' respectivamente.
        Ambos os campos devem estar presentes e íntegros no estado final.
        """
        template = _parallel_template(
            prefix=["node-7"],
            parallel=["node-8", "node-9"],
            suffix=[],
        )
        execution_id = "exec-parallel-fields-001"

        node_config = {
            "node-7": {"approval_required": False, "active": True},
            "node-8": {"approval_required": False, "active": True},
            "node-9": {"approval_required": False, "active": True},
        }

        accumulated = deepcopy(base_state)
        sm = MagicMock()
        sm.load.side_effect = lambda: deepcopy(accumulated)
        sm.load_node_statuses.return_value = {}
        def _write(field, value, **kw):
            accumulated[field] = value
        sm.write_field_direct.side_effect = _write

        from app.orchestration.executor import _NODE_AGENT_MAP

        class ScriptFake:
            name = "script_writer"
            def __init__(self, m="test"): pass
            async def run(self, **kw):
                state = kw.get("state", {})
                u = deepcopy(state); u["scripts"] = {"scripts": []}
                return u, {"agent_name": self.name, "auto_eval_passed": True, "attempts": 1}

        class CopyFake:
            name = "copy_writer"
            def __init__(self, m="test"): pass
            async def run(self, **kw):
                state = kw.get("state", {})
                u = deepcopy(state)
                u["copy"] = {"headlines": ["Headline Exclusivo"], "body": "exclusivo"}
                return u, {"agent_name": self.name, "auto_eval_passed": True, "attempts": 1}

        class CharFake:
            name = "character_generator"
            def __init__(self, m="test"): pass
            async def run(self, **kw):
                state = kw.get("state", {})
                u = deepcopy(state)
                u["character"] = {"character_asset_id": "char-exclusive-001"}
                return u, {"agent_name": self.name, "auto_eval_passed": True, "attempts": 1}

        classes = {
            _NODE_AGENT_MAP.get("node-7"): ScriptFake,
            _NODE_AGENT_MAP.get("node-8"): CopyFake,
            _NODE_AGENT_MAP.get("node-9"): CharFake,
        }

        def _load(class_name, model):
            cls = classes.get(class_name)
            if cls:
                return cls()
            dummy = MagicMock()
            async def _d(**kw):
                state = kw.get("state", {})
                return deepcopy(state), {"agent_name": "dummy", "auto_eval_passed": True, "attempts": 1}
            dummy.run = _d
            dummy.name = "dummy"
            return dummy

        supabase = _make_supabase_mock(
            node_config=node_config,
            template_snapshot=template,
            shared_state=deepcopy(base_state),
        )

        with patch("app.orchestration.executor.get_supabase", return_value=supabase), \
             patch.object(ExecutionEngine, "_requires_approval", return_value=False), \
             patch.object(ExecutionEngine, "_load_agent", side_effect=_load), \
             patch("app.orchestration.executor.CostTracker", return_value=_make_cost_tracker()), \
             patch("app.orchestration.executor.RateLimiter", return_value=MagicMock()), \
             patch("app.orchestration.executor.StateManager", return_value=sm):
            engine = ExecutionEngine()
            result = await engine.run(execution_id)

        assert result["status"] == "completed"

        assert "copy" in accumulated, "Campo 'copy' ausente"
        assert "character" in accumulated, "Campo 'character' ausente"
        assert accumulated["copy"]["headlines"] == ["Headline Exclusivo"]
        assert accumulated["character"]["character_asset_id"] == "char-exclusive-001"
