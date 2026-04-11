from dataclasses import dataclass, field
from datetime import UTC, datetime


# ---------------------------------------------------------------------------
# Tabela de preços por modelo (USD por milhão de tokens)
# Atualizar conforme pricing do Google Gemini
# ---------------------------------------------------------------------------

_PRICING_PER_MILLION: dict[str, dict[str, float]] = {
    # Gemini 3.1 Pro
    "gemini-3.1-pro-preview": {
        "input":  2.50,
        "output": 10.00,
    },
    # Gemini 3.0 Flash
    "gemini-3-flash-preview": {
        "input":  0.15,
        "output": 0.60,
    },
}

# Fallback para modelos não mapeados: usa o preço do Gemini Pro
_FALLBACK_PRICING = _PRICING_PER_MILLION["gemini-3.1-pro-preview"]


def _price_usd(model: str, input_tokens: int, output_tokens: int) -> float:
    """Calcula custo em USD dado o modelo e os tokens consumidos."""
    pricing = _PRICING_PER_MILLION.get(model, _FALLBACK_PRICING)
    input_cost  = (input_tokens  / 1_000_000) * pricing["input"]
    output_cost = (output_tokens / 1_000_000) * pricing["output"]
    return round(input_cost + output_cost, 8)


# ---------------------------------------------------------------------------
# Estruturas de dados
# ---------------------------------------------------------------------------

@dataclass
class CallRecord:
    """Registro de uma única chamada ao Claude API."""
    agent_name:    str
    node_id:       str
    model:         str
    input_tokens:  int
    output_tokens: int
    cost_usd:      float
    attempt:       int
    recorded_at:   datetime = field(default_factory=lambda: datetime.now(UTC))


@dataclass
class NodeCost:
    """Custo agregado de um nó (pode ter múltiplas chamadas em retentativas)."""
    node_id:       str
    agent_name:    str
    input_tokens:  int = 0
    output_tokens: int = 0
    cost_usd:      float = 0.0
    calls:         int = 0


# ---------------------------------------------------------------------------
# CostTracker
# ---------------------------------------------------------------------------

class CostTracker:
    """
    Rastreia tokens consumidos e custo em USD por agente/nó durante
    uma execução. Mantém totais por nó e total geral da execução.

    Uso:
        tracker = CostTracker(execution_id="uuid")
        tracker.record(agent_name="persona_builder", node_id="node-3",
                       input_tokens=800, output_tokens=400,
                       model="claude-opus-4-6")
        print(tracker.total_cost_usd)       # custo acumulado da execução
        print(tracker.node_cost("node-3"))  # custo daquele nó específico
    """

    def __init__(self, execution_id: str) -> None:
        self.execution_id = execution_id
        self._calls: list[CallRecord] = []
        self._nodes: dict[str, NodeCost] = {}

    # ------------------------------------------------------------------
    # Registro
    # ------------------------------------------------------------------

    def record(
        self,
        agent_name: str,
        input_tokens: int,
        output_tokens: int,
        model: str,
        node_id: str = "",
        attempt: int = 1,
    ) -> float:
        """
        Registra uma chamada ao Claude API e retorna o custo calculado.

        Args:
            agent_name:    Nome do agente (ex: "persona_builder").
            input_tokens:  Tokens de entrada reportados por response.usage.
            output_tokens: Tokens de saída reportados por response.usage.
            model:         Model ID usado na chamada (ex: "claude-opus-4-6").
            node_id:       ID do nó React Flow correspondente (opcional).
            attempt:       Número da tentativa automática (1 = primeira).

        Returns:
            Custo desta chamada em USD.
        """
        cost = _price_usd(model, input_tokens, output_tokens)

        call = CallRecord(
            agent_name=agent_name,
            node_id=node_id or agent_name,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=cost,
            attempt=attempt,
        )
        self._calls.append(call)

        # Agrega no nó
        nid = call.node_id
        if nid not in self._nodes:
            self._nodes[nid] = NodeCost(node_id=nid, agent_name=agent_name)
        node = self._nodes[nid]
        node.input_tokens  += input_tokens
        node.output_tokens += output_tokens
        node.cost_usd      = round(node.cost_usd + cost, 8)
        node.calls         += 1

        return cost

    # ------------------------------------------------------------------
    # Leitura de totais
    # ------------------------------------------------------------------

    @property
    def total_cost_usd(self) -> float:
        """Custo total acumulado da execução em USD."""
        return round(sum(c.cost_usd for c in self._calls), 8)

    @property
    def total_input_tokens(self) -> int:
        return sum(c.input_tokens for c in self._calls)

    @property
    def total_output_tokens(self) -> int:
        return sum(c.output_tokens for c in self._calls)

    @property
    def total_tokens(self) -> int:
        return self.total_input_tokens + self.total_output_tokens

    def node_cost(self, node_id: str) -> NodeCost | None:
        """Retorna o custo agregado de um nó específico."""
        return self._nodes.get(node_id)

    # ------------------------------------------------------------------
    # Serialização — persistência e WebSocket
    # ------------------------------------------------------------------

    def breakdown(self) -> list[dict]:
        """
        Retorna custo detalhado por nó para o endpoint
        GET /executions/{id}/cost e para o painel do canvas.
        """
        return [
            {
                "node_id":       n.node_id,
                "agent_name":    n.agent_name,
                "input_tokens":  n.input_tokens,
                "output_tokens": n.output_tokens,
                "total_tokens":  n.input_tokens + n.output_tokens,
                "cost_usd":      n.cost_usd,
                "calls":         n.calls,
            }
            for n in self._nodes.values()
        ]

    def summary(self) -> dict:
        """
        Resumo para persistência em executions.total_cost_usd
        e executions.total_tokens ao final da execução.
        """
        return {
            "total_cost_usd":      self.total_cost_usd,
            "total_tokens":        self.total_tokens,
            "total_input_tokens":  self.total_input_tokens,
            "total_output_tokens": self.total_output_tokens,
            "nodes":               self.breakdown(),
        }

    def websocket_event(self, node_id: str) -> dict:
        """
        Evento emitido via WebSocket após cada chamada para atualizar
        o custo em tempo real no canvas (tipo: cost_update).
        Consumido pelo hook useCostTracker no frontend.
        """
        node = self._nodes.get(node_id)
        return {
            "type":           "cost_update",
            "node_id":        node_id,
            "node_cost_usd":  node.cost_usd if node else 0.0,
            "node_tokens":    (node.input_tokens + node.output_tokens) if node else 0,
            "total_cost_usd": self.total_cost_usd,
            "total_tokens":   self.total_tokens,
        }
