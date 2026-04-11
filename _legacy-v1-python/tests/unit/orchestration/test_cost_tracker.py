"""
Testes unitários para CostTracker.

Verifica:
  - Cálculo de custo em USD por modelo (Opus, Sonnet, Haiku)
  - Acumulação de custo por nó e total da execução
  - Fallback de pricing para modelos desconhecidos
  - Serialização para WebSocket e endpoint /cost
  - Múltiplas tentativas do mesmo nó (soma correta)
"""

import pytest
from app.orchestration.cost_tracker import CostTracker, _price_usd


# ===========================================================================
# Testes de _price_usd (função pura)
# ===========================================================================

class TestPriceUsd:
    """Testa o cálculo de preço isolado — sem estado."""

    def test_opus_input_cost(self):
        """Opus custa $15,00 por milhão de tokens de input."""
        cost = _price_usd("claude-opus-4-6", input_tokens=1_000_000, output_tokens=0)
        assert cost == pytest.approx(15.0, rel=1e-6)

    def test_opus_output_cost(self):
        """Opus custa $75,00 por milhão de tokens de output."""
        cost = _price_usd("claude-opus-4-6", input_tokens=0, output_tokens=1_000_000)
        assert cost == pytest.approx(75.0, rel=1e-6)

    def test_sonnet_pricing(self):
        """Sonnet: $3,00 input / $15,00 output por milhão."""
        cost = _price_usd("claude-sonnet-4-6", input_tokens=1_000_000, output_tokens=1_000_000)
        assert cost == pytest.approx(18.0, rel=1e-6)  # 3 + 15

    def test_haiku_pricing(self):
        """Haiku: $0,80 input / $4,00 output por milhão."""
        cost = _price_usd("claude-haiku-4-5-20251001", input_tokens=1_000_000, output_tokens=1_000_000)
        assert cost == pytest.approx(4.8, rel=1e-6)  # 0.8 + 4.0

    def test_small_call_precision(self):
        """Chamada típica de 800 input + 400 output tokens com Sonnet."""
        cost = _price_usd("claude-sonnet-4-6", input_tokens=800, output_tokens=400)
        expected = (800 / 1_000_000) * 3.0 + (400 / 1_000_000) * 15.0
        assert cost == pytest.approx(expected, rel=1e-6)

    def test_fallback_for_unknown_model(self):
        """Modelo desconhecido usa pricing do Sonnet como fallback."""
        cost_unknown = _price_usd("claude-unknown-model", input_tokens=1000, output_tokens=500)
        cost_sonnet  = _price_usd("claude-sonnet-4-6",    input_tokens=1000, output_tokens=500)
        assert cost_unknown == pytest.approx(cost_sonnet, rel=1e-6)

    def test_zero_tokens(self):
        """Custo zero quando não há tokens."""
        assert _price_usd("claude-opus-4-6", 0, 0) == 0.0

    def test_opus_is_most_expensive(self):
        """Opus deve ser mais caro que Sonnet, que deve ser mais caro que Haiku."""
        tokens = 1000
        cost_opus   = _price_usd("claude-opus-4-6",            tokens, tokens)
        cost_sonnet = _price_usd("claude-sonnet-4-6",           tokens, tokens)
        cost_haiku  = _price_usd("claude-haiku-4-5-20251001",   tokens, tokens)
        assert cost_opus > cost_sonnet > cost_haiku


# ===========================================================================
# Testes de CostTracker
# ===========================================================================

class TestCostTrackerRecord:
    """Testa o registro de chamadas e acumulação de custos."""

    def test_record_returns_cost_of_single_call(self):
        """record() deve retornar o custo calculado daquela chamada."""
        tracker = CostTracker("exec-001")
        cost = tracker.record(
            agent_name="persona_builder",
            input_tokens=800,
            output_tokens=400,
            model="claude-sonnet-4-6",
        )
        expected = _price_usd("claude-sonnet-4-6", 800, 400)
        assert cost == pytest.approx(expected, rel=1e-6)

    def test_total_cost_accumulates_across_calls(self):
        """total_cost_usd deve somar os custos de todas as chamadas."""
        tracker = CostTracker("exec-001")
        cost1 = tracker.record("agent_a", 1000, 500, "claude-sonnet-4-6")
        cost2 = tracker.record("agent_b", 800, 400, "claude-opus-4-6")
        assert tracker.total_cost_usd == pytest.approx(cost1 + cost2, rel=1e-6)

    def test_total_tokens_accumulates(self):
        """total_tokens deve somar input + output de todas as chamadas."""
        tracker = CostTracker("exec-001")
        tracker.record("agent_a", 1000, 500, "claude-sonnet-4-6")
        tracker.record("agent_b", 800, 400, "claude-sonnet-4-6")
        assert tracker.total_input_tokens == 1800
        assert tracker.total_output_tokens == 900
        assert tracker.total_tokens == 2700

    def test_node_cost_aggregates_multiple_calls(self):
        """Múltiplas chamadas ao mesmo node_id devem ser somadas."""
        tracker = CostTracker("exec-001")
        tracker.record("script_writer", 500, 300, "claude-opus-4-6", node_id="node-7", attempt=1)
        tracker.record("script_writer", 400, 200, "claude-opus-4-6", node_id="node-7", attempt=2)

        node = tracker.node_cost("node-7")
        assert node is not None
        assert node.calls == 2
        assert node.input_tokens == 900
        assert node.output_tokens == 500
        expected_cost = _price_usd("claude-opus-4-6", 500, 300) + _price_usd("claude-opus-4-6", 400, 200)
        assert node.cost_usd == pytest.approx(expected_cost, rel=1e-6)

    def test_node_cost_returns_none_for_unknown_node(self):
        """node_cost() deve retornar None para nó que nunca foi registrado."""
        tracker = CostTracker("exec-001")
        assert tracker.node_cost("node-99") is None

    def test_node_cost_uses_agent_name_as_default_id(self):
        """Quando node_id não é fornecido, usa agent_name como ID do nó."""
        tracker = CostTracker("exec-001")
        tracker.record("persona_builder", 800, 400, "claude-sonnet-4-6")
        node = tracker.node_cost("persona_builder")
        assert node is not None
        assert node.agent_name == "persona_builder"

    def test_independent_nodes_dont_share_cost(self):
        """Custos de nós diferentes não se misturam."""
        tracker = CostTracker("exec-001")
        tracker.record("agent_a", 1000, 500, "claude-opus-4-6",   node_id="node-1")
        tracker.record("agent_b", 500,  200, "claude-haiku-4-5-20251001", node_id="node-2")

        node1 = tracker.node_cost("node-1")
        node2 = tracker.node_cost("node-2")

        assert node1.input_tokens == 1000
        assert node2.input_tokens == 500
        assert node1.cost_usd != node2.cost_usd


class TestCostTrackerSerialization:
    """Testa métodos de serialização para WebSocket e banco."""

    def test_breakdown_contains_all_nodes(self):
        """breakdown() deve listar todos os nós com pelo menos uma chamada."""
        tracker = CostTracker("exec-001")
        tracker.record("agent_a", 100, 50, "claude-sonnet-4-6", node_id="node-1")
        tracker.record("agent_b", 200, 80, "claude-sonnet-4-6", node_id="node-2")

        breakdown = tracker.breakdown()
        node_ids = [item["node_id"] for item in breakdown]
        assert "node-1" in node_ids
        assert "node-2" in node_ids

    def test_breakdown_item_has_required_fields(self):
        """Cada item do breakdown deve ter todos os campos esperados pelo frontend."""
        tracker = CostTracker("exec-001")
        tracker.record("persona_builder", 800, 400, "claude-sonnet-4-6", node_id="node-3")

        breakdown = tracker.breakdown()
        assert len(breakdown) == 1
        item = breakdown[0]

        required_fields = {"node_id", "agent_name", "input_tokens", "output_tokens", "total_tokens", "cost_usd", "calls"}
        assert required_fields.issubset(item.keys())

    def test_summary_totals_match_properties(self):
        """summary() deve retornar os mesmos valores das properties."""
        tracker = CostTracker("exec-001")
        tracker.record("agent_a", 1000, 500, "claude-opus-4-6",   node_id="node-1")
        tracker.record("agent_b", 800,  400, "claude-sonnet-4-6", node_id="node-2")

        summary = tracker.summary()
        assert summary["total_cost_usd"]      == tracker.total_cost_usd
        assert summary["total_tokens"]        == tracker.total_tokens
        assert summary["total_input_tokens"]  == tracker.total_input_tokens
        assert summary["total_output_tokens"] == tracker.total_output_tokens
        assert len(summary["nodes"]) == 2

    def test_websocket_event_structure(self):
        """websocket_event() deve retornar o formato esperado pelo hook useCostTracker."""
        tracker = CostTracker("exec-001")
        tracker.record("persona_builder", 800, 400, "claude-sonnet-4-6", node_id="node-3")

        event = tracker.websocket_event("node-3")

        assert event["type"] == "cost_update"
        assert event["node_id"] == "node-3"
        assert event["node_cost_usd"] > 0
        assert event["node_tokens"] == 1200  # 800 + 400
        assert event["total_cost_usd"] == tracker.total_cost_usd

    def test_websocket_event_for_unknown_node_returns_zeros(self):
        """websocket_event() para nó sem chamadas retorna zeros (não lança exceção)."""
        tracker = CostTracker("exec-001")
        event = tracker.websocket_event("node-99")

        assert event["type"] == "cost_update"
        assert event["node_cost_usd"] == 0.0
        assert event["node_tokens"] == 0

    def test_empty_tracker_totals_are_zero(self):
        """Tracker sem registros deve retornar zeros em todos os totais."""
        tracker = CostTracker("exec-001")
        assert tracker.total_cost_usd == 0.0
        assert tracker.total_tokens == 0
        assert tracker.breakdown() == []
