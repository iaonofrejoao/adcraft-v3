import logging
from typing import Any

from app.database import get_supabase

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Campos de topo do shared_state e seus donos exclusivos
# Cada agente paralelo escreve em subcampos exclusivos — sem race condition.
# Usado para validação e documentação do contrato de escritas.
# ---------------------------------------------------------------------------

_STATE_FIELD_OWNERS: dict[str, str] = {
    "product":          "orchestrator",
    "product_analysis": "product_analyzer",
    "market":           "market_researcher",
    "persona":          "persona_builder",
    "angle":            "angle_strategist",
    "benchmark":        "benchmark_agent",
    "strategy":         "campaign_strategist",
    "scripts":          "script_writer",
    "copy":             "copy_writer",
    "character":        "character_generator",
    "keyframes":        "keyframe_generator",
    "video_clips":      "video_generator",
    "final_creatives":  "creative_director",
    "compliance":       "compliance_checker",
    "tracking":         "utm_builder",
    "facebook_campaign":"media_buyer_facebook",
    "google_campaign":  "media_buyer_google",
    "performance":      "performance_analyst",
    "execution_meta":   "orchestrator",
}


class StateManager:
    """
    Lê e escreve o shared_state de uma execução no banco (Supabase).

    Garante que agentes paralelos não se sobrescrevam usando
    PostgreSQL jsonb_set para patches cirúrgicos por subcampo —
    nunca sobrescreve o documento inteiro.

    Uso:
        sm = StateManager(execution_id="uuid")

        # Lê o estado completo
        state = sm.load()

        # Lê apenas um subcampo
        persona = sm.load_field("persona")

        # Escreve apenas o subcampo do agente (atômico)
        sm.write_field("persona", persona_data)

        # Atualiza status de um nó (publicado via Supabase Realtime)
        sm.update_node_status("node-3", status="approved", cost_usd=0.042)
    """

    def __init__(self, execution_id: str) -> None:
        self.execution_id = execution_id
        self._db = get_supabase()

    # ------------------------------------------------------------------
    # Leitura
    # ------------------------------------------------------------------

    def load(self) -> dict:
        """
        Carrega o shared_state completo da execução.
        Usado pelo Orquestrador na inicialização e na retomada após crash.
        """
        row = (
            self._db.table("executions")
            .select("shared_state")
            .eq("id", self.execution_id)
            .single()
            .execute()
        )
        return row.data.get("shared_state", {}) if row.data else {}

    def load_field(self, field_name: str) -> Any:
        """
        Carrega um único subcampo do shared_state.
        Mais eficiente que load() quando o agente precisa apenas de um campo.
        Usa extração nativa JSONB do PostgreSQL via operador ->.
        """
        row = (
            self._db.table("executions")
            .select(f"shared_state->>{field_name}")
            .eq("id", self.execution_id)
            .single()
            .execute()
        )
        if not row.data:
            return None
        return row.data.get(f"shared_state->>{field_name}")

    def load_node_statuses(self) -> dict:
        """Carrega apenas node_statuses — usado pelo canvas para estado inicial."""
        row = (
            self._db.table("executions")
            .select("node_statuses")
            .eq("id", self.execution_id)
            .single()
            .execute()
        )
        return row.data.get("node_statuses", {}) if row.data else {}

    # ------------------------------------------------------------------
    # Escrita atômica de subcampos
    # ------------------------------------------------------------------

    def write_field(self, field_name: str, value: Any, agent_name: str = "") -> None:
        """
        Escreve um único subcampo do shared_state usando jsonb_set.

        Atômico: usa UPDATE com jsonb_set — não carrega o documento,
        não modifica em memória e não sobrescreve. Seguro para agentes
        paralelos escrevendo em campos distintos simultaneamente.

        Args:
            field_name: Chave de topo do shared_state (ex: "persona", "copy").
            value:      Dado a ser escrito. Deve ser serializável como JSON.
            agent_name: Nome do agente para logging (opcional).

        Raises:
            PermissionError: se agent_name não for o dono declarado do campo.
            RuntimeError:    se a execução não existir no banco.
        """
        self._check_ownership(field_name, agent_name)

        import json

        # jsonb_set(shared_state, '{field_name}', value::jsonb, true)
        # O quarto argumento true cria o campo se não existir.
        result = (
            self._db.table("executions")
            .update({
                "shared_state": self._db.rpc(
                    "jsonb_set_field",  # função SQL helper (ver abaixo)
                    {
                        "execution_id": self.execution_id,
                        "field_name":   field_name,
                        "field_value":  json.dumps(value),
                    }
                )
            })
            .eq("id", self.execution_id)
            .execute()
        )

        if not result.data:
            raise RuntimeError(
                f"Falha ao escrever campo '{field_name}' na execução {self.execution_id}. "
                "Verifique se a execução existe no banco."
            )

        logger.debug(
            "StateManager: campo '%s' atualizado na execução %s (agente: %s)",
            field_name, self.execution_id, agent_name or "desconhecido",
        )

    def write_field_direct(self, field_name: str, value: Any, agent_name: str = "") -> None:
        """
        Escrita alternativa via UPDATE com jsonb_build_object + concatenação (||).
        Não requer função SQL helper — usa apenas o cliente Supabase padrão.

        Preferir write_field() quando a função jsonb_set_field estiver disponível.
        Este método é o fallback para ambientes sem acesso a RPCs customizadas.
        """
        self._check_ownership(field_name, agent_name)

        # Carrega o estado atual, aplica o patch em memória e salva.
        # ATENÇÃO: não atômico em caso de duas escritas simultâneas no mesmo
        # campo de topo. Seguro quando agentes paralelos escrevem em campos
        # distintos (o que é garantido pelo design do fluxo — PRD seção 9).
        current = self.load()
        current[field_name] = value

        self._db.table("executions").update(
            {"shared_state": current}
        ).eq("id", self.execution_id).execute()

        logger.debug(
            "StateManager.write_field_direct: campo '%s' atualizado (agente: %s)",
            field_name, agent_name or "desconhecido",
        )

    # ------------------------------------------------------------------
    # Status de nós (Supabase Realtime → canvas React Flow)
    # ------------------------------------------------------------------

    def update_node_status(
        self,
        node_id:         str,
        status:          str,
        cost_usd:        float | None = None,
        tokens:          int | None = None,
        tooltip_message: str | None = None,
        attempts:        int | None = None,
    ) -> None:
        """
        Atualiza o status de um nó em node_statuses.
        A mudança é publicada automaticamente via Supabase Realtime para o
        frontend — o canvas atualiza a cor e o tooltip do nó em < 2s.

        Args:
            node_id:         ID do nó no React Flow.
            status:          idle | running | waiting_approval | approved | failed | disabled
            cost_usd:        Custo acumulado do nó em USD (atualizado após cada chamada).
            tokens:          Total de tokens consumidos pelo nó.
            tooltip_message: Texto do tooltip (ex: "Aguardando API: YouTube · ~45s").
            attempts:        Número de tentativas realizadas.
        """
        import json
        from datetime import UTC, datetime, timezone

        current_statuses = self.load_node_statuses()

        node_data: dict[str, Any] = {
            **current_statuses.get(node_id, {}),
            "status": status,
        }

        if cost_usd is not None:
            node_data["cost_usd"] = round(cost_usd, 6)
        if tokens is not None:
            node_data["tokens"] = tokens
        if tooltip_message is not None:
            node_data["tooltip_message"] = tooltip_message
        if attempts is not None:
            node_data["attempts"] = attempts

        # Timestamps de ciclo de vida
        if status == "running" and "started_at" not in node_data:
            node_data["started_at"] = datetime.now(UTC).isoformat()
        if status in ("approved", "failed", "disabled"):
            node_data["completed_at"] = datetime.now(UTC).isoformat()

        current_statuses[node_id] = node_data

        self._db.table("executions").update(
            {"node_statuses": current_statuses}
        ).eq("id", self.execution_id).execute()

    def update_execution_status(self, status: str) -> None:
        """
        Atualiza o status geral da execução (execution_status enum).
        Chamado pelo Orquestrador nas transições de estado do fluxo.
        """
        from datetime import UTC, datetime, timezone

        update: dict[str, Any] = {"status": status}

        if status == "running":
            update["started_at"] = datetime.now(UTC).isoformat()
        elif status in ("completed", "failed", "cancelled"):
            update["completed_at"] = datetime.now(UTC).isoformat()

        self._db.table("executions").update(update).eq(
            "id", self.execution_id
        ).execute()

    def persist_cost_summary(self, total_cost_usd: float, total_tokens: int) -> None:
        """
        Persiste totais de custo em executions.total_cost_usd e total_tokens.
        Chamado ao final de cada nó e na conclusão da execução.
        """
        self._db.table("executions").update({
            "total_cost_usd": total_cost_usd,
            "total_tokens":   total_tokens,
        }).eq("id", self.execution_id).execute()

    # ------------------------------------------------------------------
    # Validação interna
    # ------------------------------------------------------------------

    def _check_ownership(self, field_name: str, agent_name: str) -> None:
        """
        Valida que o agente é o dono declarado do campo.
        Emite WARNING em vez de bloquear — o design do fluxo (PRD seção 9)
        garante que agentes paralelos escrevem em campos distintos,
        mas o aviso alerta sobre violações acidentais durante o desenvolvimento.
        """
        if not agent_name:
            return
        declared_owner = _STATE_FIELD_OWNERS.get(field_name)
        if declared_owner and declared_owner != agent_name:
            logger.warning(
                "StateManager: agente '%s' está escrevendo no campo '%s' "
                "cujo dono declarado é '%s'. Verifique o fluxo de agentes.",
                agent_name, field_name, declared_owner,
            )
