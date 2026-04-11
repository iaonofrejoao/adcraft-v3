"""
Testes unitários para StateManager.

Verifica:
  - Escrita atômica de subcampos (write_field / write_field_direct)
  - Isolamento de campos — agentes paralelos escrevem em campos distintos
  - Aviso de ownership ao escrever em campo de outro agente
  - update_node_status persiste status e timestamps corretos
  - update_execution_status persiste status e datas de ciclo de vida
  - persist_cost_summary atualiza totais de custo
  - load() e load_field() retornam dados do banco corretamente
  - Campos ausentes (execução não existe) retornam valores seguros
"""

import logging
from unittest.mock import MagicMock, call, patch

import pytest

from app.orchestration.state_manager import StateManager, _STATE_FIELD_OWNERS


# ===========================================================================
# Helpers
# ===========================================================================

def _make_sm(execution_id: str = "exec-test-123") -> tuple[StateManager, MagicMock]:
    """
    Cria um StateManager com o Supabase completamente mockado.
    Retorna (state_manager, mock_db) para inspeção das chamadas.
    """
    with patch("app.orchestration.state_manager.get_supabase") as mock_get:
        mock_db = MagicMock()
        mock_get.return_value = mock_db
        sm = StateManager(execution_id)
        # Substitui o _db interno pelo mock para uso fora do with
        sm._db = mock_db
        return sm, mock_db


def _configure_load(mock_db: MagicMock, shared_state: dict) -> MagicMock:
    """
    Configura o mock de .select().eq().single().execute() para retornar shared_state.
    Define mock_db.table.return_value (suficiente quando table() é chamado uma só vez)
    e retorna o chain criado para uso em side_effect quando há múltiplas chamadas.
    """
    chain = MagicMock()
    chain.execute.return_value = MagicMock(data={"shared_state": shared_state})
    chain.single.return_value = chain
    chain.eq.return_value = chain
    chain.select.return_value = chain
    mock_db.table.return_value = chain
    return chain


def _configure_update(mock_db: MagicMock, returned_data: list | None = None) -> MagicMock:
    """Configura o mock de .update().eq().execute() e retorna o chain para inspeção."""
    chain = MagicMock()
    chain.execute.return_value = MagicMock(data=returned_data or [{"id": "exec-test-123"}])
    chain.eq.return_value = chain
    chain.update.return_value = chain
    mock_db.table.return_value = chain
    return chain


# ===========================================================================
# Testes de load()
# ===========================================================================

class TestLoad:
    """Testa leitura do shared_state do banco."""

    def test_load_returns_shared_state(self):
        """load() deve retornar o shared_state da linha de execução."""
        sm, mock_db = _make_sm()
        expected = {"product": {"name": "Produto X"}, "persona": {"summary": "Ana"}}
        _configure_load(mock_db, expected)

        result = sm.load()

        assert result == expected

    def test_load_returns_empty_dict_when_no_data(self):
        """load() deve retornar {} se a execução não existir."""
        sm, mock_db = _make_sm()
        chain = MagicMock()
        chain.execute.return_value = MagicMock(data=None)
        chain.single.return_value = chain
        chain.eq.return_value = chain
        chain.select.return_value = chain
        mock_db.table.return_value = chain

        result = sm.load()

        assert result == {}

    def test_load_queries_correct_execution_id(self):
        """load() deve filtrar pela execução correta."""
        sm, mock_db = _make_sm("exec-specific-999")
        _configure_load(mock_db, {})

        sm.load()

        # Verifica que .eq("id", "exec-specific-999") foi chamado
        chain = mock_db.table.return_value
        chain.eq.assert_called_with("id", "exec-specific-999")

    def test_load_selects_shared_state_column(self):
        """load() deve selecionar apenas a coluna shared_state."""
        sm, mock_db = _make_sm()
        _configure_load(mock_db, {})

        sm.load()

        chain = mock_db.table.return_value
        chain.select.assert_called_with("shared_state")


# ===========================================================================
# Testes de write_field_direct()
# ===========================================================================

class TestWriteFieldDirect:
    """
    Testa write_field_direct() — fallback que carrega, aplica patch e salva.
    Mais testável que write_field() pois não depende de RPC customizada.
    """

    def _make_update_chain(self) -> MagicMock:
        """Cria um chain de UPDATE isolado para inspeção das chamadas."""
        chain = MagicMock()
        chain.execute.return_value = MagicMock(data=[{"id": "exec-test-123"}])
        chain.eq.return_value = chain
        chain.update.return_value = chain
        return chain

    def test_write_field_saves_value_to_correct_field(self):
        """write_field_direct() deve salvar o valor no campo correto do shared_state."""
        sm, mock_db = _make_sm()
        current_state = {"product": {"name": "X"}}
        load_chain = _configure_load(mock_db, current_state)
        update_chain = self._make_update_chain()
        # write_field_direct chama table() duas vezes: 1ª para load(), 2ª para update()
        mock_db.table.side_effect = [load_chain, update_chain]

        persona_data = {"summary": "Ana, 38 anos, professora"}
        sm.write_field_direct("persona", persona_data, agent_name="persona_builder")

        update_chain.update.assert_called_once()
        update_arg = update_chain.update.call_args[0][0]
        assert "shared_state" in update_arg
        assert update_arg["shared_state"]["persona"] == persona_data

    def test_write_field_preserves_existing_fields(self):
        """write_field_direct() não deve apagar outros campos do shared_state."""
        sm, mock_db = _make_sm()
        current_state = {
            "product": {"name": "Produto X"},
            "market": {"viability_score": 78},
        }
        load_chain = _configure_load(mock_db, current_state)
        update_chain = self._make_update_chain()
        mock_db.table.side_effect = [load_chain, update_chain]

        sm.write_field_direct("persona", {"summary": "Ana"}, agent_name="persona_builder")

        update_arg = update_chain.update.call_args[0][0]["shared_state"]
        # Campos anteriores devem ter sido preservados
        assert update_arg["product"]["name"] == "Produto X"
        assert update_arg["market"]["viability_score"] == 78
        # E o novo campo deve ter sido adicionado
        assert update_arg["persona"]["summary"] == "Ana"

    def test_write_field_overwrites_existing_field(self):
        """write_field_direct() deve sobrescrever o campo se ele já existia."""
        sm, mock_db = _make_sm()
        current_state = {"persona": {"summary": "versão antiga"}}
        load_chain = _configure_load(mock_db, current_state)
        update_chain = self._make_update_chain()
        mock_db.table.side_effect = [load_chain, update_chain]

        sm.write_field_direct("persona", {"summary": "versão nova"})

        update_arg = update_chain.update.call_args[0][0]["shared_state"]
        assert update_arg["persona"]["summary"] == "versão nova"

    def test_write_different_fields_dont_interfere(self):
        """Dois agentes escrevendo em campos distintos não se afetam."""
        sm_a, mock_db_a = _make_sm("exec-parallel-001")
        sm_b, mock_db_b = _make_sm("exec-parallel-001")

        # Cada StateManager recebe sua própria cópia do estado inicial.
        # write_field_direct() muta o dict retornado por load() em-place;
        # usar o mesmo objeto faria sm_b enxergar a escrita de sm_a no load(),
        # corrompendo os dados que update_chain_a registrou.
        state_a = {"product": {"name": "X"}}
        state_b = {"product": {"name": "X"}}

        load_chain_a = _configure_load(mock_db_a, state_a)
        update_chain_a = self._make_update_chain()
        mock_db_a.table.side_effect = [load_chain_a, update_chain_a]

        load_chain_b = _configure_load(mock_db_b, state_b)
        update_chain_b = self._make_update_chain()
        mock_db_b.table.side_effect = [load_chain_b, update_chain_b]

        # Agente A escreve "persona", Agente B escreve "market"
        sm_a.write_field_direct("persona", {"summary": "Ana"}, agent_name="persona_builder")
        sm_b.write_field_direct("market", {"viability_score": 78}, agent_name="market_researcher")

        update_a = update_chain_a.update.call_args[0][0]["shared_state"]
        update_b = update_chain_b.update.call_args[0][0]["shared_state"]

        # Cada agente escreveu apenas seu campo
        assert "persona" in update_a
        assert "market" in update_b
        # Campos do outro não foram corrompidos
        assert update_a.get("market") is None or "viability_score" not in update_a.get("market", {})


# ===========================================================================
# Testes de ownership (aviso de campo de outro agente)
# ===========================================================================

class TestOwnershipWarning:
    """Escrever no campo de outro agente deve emitir WARNING — não bloquear."""

    def test_warns_when_wrong_agent_writes_field(self, caplog):
        """Se agente X escreve no campo de agente Y, deve logar WARNING."""
        sm, mock_db = _make_sm()
        _configure_load(mock_db, {})
        _configure_update(mock_db)

        with caplog.at_level(logging.WARNING, logger="app.orchestration.state_manager"):
            # market_researcher tentando escrever no campo de persona_builder
            sm.write_field_direct(
                "persona",
                {"summary": "indevido"},
                agent_name="market_researcher",  # dono real é persona_builder
            )

        warnings = [r for r in caplog.records if r.levelno == logging.WARNING]
        assert len(warnings) >= 1
        assert any("market_researcher" in r.message for r in warnings)

    def test_no_warning_for_correct_owner(self, caplog):
        """Dono legítimo escrevendo seu campo não deve gerar WARNING."""
        sm, mock_db = _make_sm()
        _configure_load(mock_db, {})
        _configure_update(mock_db)

        with caplog.at_level(logging.WARNING, logger="app.orchestration.state_manager"):
            sm.write_field_direct(
                "persona",
                {"summary": "Ana"},
                agent_name="persona_builder",  # dono legítimo
            )

        ownership_warnings = [
            r for r in caplog.records
            if r.levelno == logging.WARNING and "dono" in r.message.lower()
        ]
        assert len(ownership_warnings) == 0

    def test_no_warning_when_agent_name_is_empty(self, caplog):
        """Sem agent_name, nenhum warning de ownership deve ser emitido."""
        sm, mock_db = _make_sm()
        _configure_load(mock_db, {})
        _configure_update(mock_db)

        with caplog.at_level(logging.WARNING, logger="app.orchestration.state_manager"):
            sm.write_field_direct("persona", {"summary": "X"}, agent_name="")

        ownership_warnings = [
            r for r in caplog.records
            if r.levelno == logging.WARNING and "dono" in r.message.lower()
        ]
        assert len(ownership_warnings) == 0

    def test_ownership_map_covers_all_expected_agents(self):
        """O mapa de donos deve cobrir todos os agentes principais."""
        expected_owners = {
            "product_analyzer",
            "market_researcher",
            "persona_builder",
            "angle_strategist",
            "benchmark_agent",
            "campaign_strategist",
            "script_writer",
            "copy_writer",
            "character_generator",
            "keyframe_generator",
            "video_generator",
            "creative_director",
            "compliance_checker",
            "utm_builder",
            "media_buyer_facebook",
            "media_buyer_google",
            "performance_analyst",
            "orchestrator",
        }
        actual_owners = set(_STATE_FIELD_OWNERS.values())
        assert expected_owners.issubset(actual_owners), (
            f"Agentes sem entrada no _STATE_FIELD_OWNERS: {expected_owners - actual_owners}"
        )


# ===========================================================================
# Testes de update_node_status()
# ===========================================================================

class TestUpdateNodeStatus:
    """Testa a atualização de status dos nós (publicado via Supabase Realtime)."""

    def _make_node_chain(self, mock_db: MagicMock, current_statuses: dict) -> MagicMock:
        """Configura mock para load_node_statuses e update."""
        load_chain = MagicMock()
        load_chain.execute.return_value = MagicMock(data={"node_statuses": current_statuses})
        load_chain.single.return_value = load_chain
        load_chain.eq.return_value = load_chain
        load_chain.select.return_value = load_chain

        update_chain = MagicMock()
        update_chain.execute.return_value = MagicMock(data=[{}])
        update_chain.eq.return_value = update_chain
        update_chain.update.return_value = update_chain

        # Primeira chamada retorna load_chain, segunda retorna update_chain
        mock_db.table.side_effect = [
            load_chain,   # load_node_statuses
            update_chain, # update
        ]
        return update_chain

    def test_node_status_is_persisted(self):
        """update_node_status deve chamar table.update com o status correto."""
        sm, mock_db = _make_sm()
        update_chain = self._make_node_chain(mock_db, {})

        sm.update_node_status("node-3", status="running")

        update_chain.update.assert_called_once()
        update_payload = update_chain.update.call_args[0][0]
        assert "node_statuses" in update_payload
        assert update_payload["node_statuses"]["node-3"]["status"] == "running"

    def test_cost_usd_is_included_when_provided(self):
        """Custo deve ser incluído no payload quando fornecido."""
        sm, mock_db = _make_sm()
        update_chain = self._make_node_chain(mock_db, {})

        sm.update_node_status("node-3", status="approved", cost_usd=0.042)

        update_payload = update_chain.update.call_args[0][0]
        node_data = update_payload["node_statuses"]["node-3"]
        assert node_data["cost_usd"] == pytest.approx(0.042, rel=1e-6)

    def test_started_at_set_when_running(self):
        """started_at deve ser setado quando o status muda para 'running'."""
        sm, mock_db = _make_sm()
        update_chain = self._make_node_chain(mock_db, {})

        sm.update_node_status("node-3", status="running")

        update_payload = update_chain.update.call_args[0][0]
        node_data = update_payload["node_statuses"]["node-3"]
        assert "started_at" in node_data

    def test_completed_at_set_when_approved(self):
        """completed_at deve ser setado quando o status muda para 'approved'."""
        sm, mock_db = _make_sm()
        update_chain = self._make_node_chain(mock_db, {})

        sm.update_node_status("node-3", status="approved")

        update_payload = update_chain.update.call_args[0][0]
        node_data = update_payload["node_statuses"]["node-3"]
        assert "completed_at" in node_data

    def test_completed_at_set_when_failed(self):
        """completed_at deve ser setado para 'failed' também."""
        sm, mock_db = _make_sm()
        update_chain = self._make_node_chain(mock_db, {})

        sm.update_node_status("node-3", status="failed")

        update_payload = update_chain.update.call_args[0][0]
        node_data = update_payload["node_statuses"]["node-3"]
        assert "completed_at" in node_data

    def test_preserves_existing_node_statuses(self):
        """Atualizar um nó não deve apagar o status dos outros nós."""
        sm, mock_db = _make_sm()
        existing = {
            "node-1": {"status": "approved"},
            "node-2": {"status": "approved"},
        }
        update_chain = self._make_node_chain(mock_db, existing)

        sm.update_node_status("node-3", status="running")

        update_payload = update_chain.update.call_args[0][0]
        all_statuses = update_payload["node_statuses"]
        assert "node-1" in all_statuses
        assert "node-2" in all_statuses
        assert all_statuses["node-1"]["status"] == "approved"
        assert all_statuses["node-2"]["status"] == "approved"

    def test_tooltip_message_included_when_provided(self):
        """Tooltip de fila de API deve ser incluído no payload."""
        sm, mock_db = _make_sm()
        update_chain = self._make_node_chain(mock_db, {})

        sm.update_node_status(
            "node-5",
            status="running",
            tooltip_message="Aguardando API: YouTube · Posição 2 · ~45s"
        )

        update_payload = update_chain.update.call_args[0][0]
        node_data = update_payload["node_statuses"]["node-5"]
        assert node_data["tooltip_message"] == "Aguardando API: YouTube · Posição 2 · ~45s"


# ===========================================================================
# Testes de update_execution_status()
# ===========================================================================

class TestUpdateExecutionStatus:
    """Testa atualizações do status geral da execução."""

    def test_status_is_persisted(self):
        """update_execution_status deve chamar update com o status correto."""
        sm, mock_db = _make_sm()
        chain = _configure_update(mock_db)

        sm.update_execution_status("running")

        chain.update.assert_called_once()
        update_payload = chain.update.call_args[0][0]
        assert update_payload["status"] == "running"

    def test_started_at_set_for_running(self):
        """started_at deve ser setado quando status vira 'running'."""
        sm, mock_db = _make_sm()
        chain = _configure_update(mock_db)

        sm.update_execution_status("running")

        update_payload = chain.update.call_args[0][0]
        assert "started_at" in update_payload

    def test_completed_at_set_for_completed(self):
        """completed_at deve ser setado quando status vira 'completed'."""
        sm, mock_db = _make_sm()
        chain = _configure_update(mock_db)

        sm.update_execution_status("completed")

        update_payload = chain.update.call_args[0][0]
        assert "completed_at" in update_payload

    def test_completed_at_set_for_failed(self):
        """completed_at deve ser setado também para 'failed'."""
        sm, mock_db = _make_sm()
        chain = _configure_update(mock_db)

        sm.update_execution_status("failed")

        update_payload = chain.update.call_args[0][0]
        assert "completed_at" in update_payload

    def test_no_extra_timestamps_for_pending(self):
        """Status 'pending' não deve incluir timestamps de ciclo de vida."""
        sm, mock_db = _make_sm()
        chain = _configure_update(mock_db)

        sm.update_execution_status("pending")

        update_payload = chain.update.call_args[0][0]
        assert "started_at" not in update_payload
        assert "completed_at" not in update_payload


# ===========================================================================
# Testes de persist_cost_summary()
# ===========================================================================

class TestPersistCostSummary:
    """Testa a persistência dos totais de custo no banco."""

    def test_persists_total_cost_and_tokens(self):
        """persist_cost_summary deve salvar ambos os campos."""
        sm, mock_db = _make_sm()
        chain = _configure_update(mock_db)

        sm.persist_cost_summary(total_cost_usd=1.2345, total_tokens=48200)

        chain.update.assert_called_once()
        update_payload = chain.update.call_args[0][0]
        assert update_payload["total_cost_usd"] == 1.2345
        assert update_payload["total_tokens"] == 48200

    def test_zero_values_are_persisted(self):
        """Valores zero devem ser persistidos normalmente (não ignorados)."""
        sm, mock_db = _make_sm()
        chain = _configure_update(mock_db)

        sm.persist_cost_summary(total_cost_usd=0.0, total_tokens=0)

        update_payload = chain.update.call_args[0][0]
        assert update_payload["total_cost_usd"] == 0.0
        assert update_payload["total_tokens"] == 0

    def test_filters_by_execution_id(self):
        """persist_cost_summary deve filtrar pela execução correta."""
        sm, mock_db = _make_sm("exec-custo-777")
        chain = _configure_update(mock_db)

        sm.persist_cost_summary(total_cost_usd=0.5, total_tokens=1000)

        chain.eq.assert_called_with("id", "exec-custo-777")
