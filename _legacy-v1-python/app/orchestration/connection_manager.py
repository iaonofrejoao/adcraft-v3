"""
ConnectionManager — gerencia conexões WebSocket ativas por execução.

Responsável pelos eventos de alta frequência durante a execução dos agentes:
  - Custo acumulando token a token (type: "cost_update")
  - Status de fila de API e tempo de espera (type: "queue_status")

Complementa o Supabase Realtime, que cuida de mudanças de estado persistidas
no banco (status dos nós, notificações). O WebSocket cobre eventos efêmeros
que não precisam ser gravados em banco (PRD seção 8 — WebSocket).

Suporta múltiplas conexões por execução (ex: usuário com múltiplas abas abertas).
Conexões mortas são removidas silenciosamente no próximo broadcast.

Uso (a partir de um agente ou do executor):
    from app.orchestration.connection_manager import manager

    await manager.send_cost_update(
        execution_id="uuid",
        node_id="node-3",
        tokens=1200,
        cost_usd=0.0024,
        total_cost_usd=0.0312,
    )
"""

import json
import logging
from collections import defaultdict

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Gerencia conexões WebSocket ativas agrupadas por execution_id.

    Instância singleton usada pelo endpoint /ws/execution/{execution_id}
    e pelos agentes/executor para broadcast de eventos em tempo real.
    """

    def __init__(self) -> None:
        # execution_id → lista de WebSockets conectados (suporte a múltiplas abas)
        self.active: dict[str, list[WebSocket]] = defaultdict(list)

    # ------------------------------------------------------------------
    # Gerenciamento de conexão
    # ------------------------------------------------------------------

    async def connect(self, execution_id: str, websocket: WebSocket) -> None:
        """
        Aceita e registra uma nova conexão WebSocket para a execução.
        Chamado pelo endpoint /ws/execution/{execution_id}.
        """
        await websocket.accept()
        self.active[execution_id].append(websocket)
        logger.debug(
            "WebSocket conectado: execução=%s total_conexões=%d",
            execution_id,
            len(self.active[execution_id]),
        )

    def disconnect(self, execution_id: str, websocket: WebSocket) -> None:
        """
        Remove uma conexão da lista de ativos.
        Chamado quando o cliente fecha a aba ou a conexão cai.
        """
        connections = self.active.get(execution_id, [])
        if websocket in connections:
            connections.remove(websocket)
        logger.debug(
            "WebSocket desconectado: execução=%s conexões_restantes=%d",
            execution_id,
            len(connections),
        )

    # ------------------------------------------------------------------
    # Broadcast genérico
    # ------------------------------------------------------------------

    async def broadcast(self, execution_id: str, event: dict) -> None:
        """
        Envia um evento JSON para todas as conexões ativas de uma execução.
        Remove silenciosamente conexões mortas.
        """
        connections = self.active.get(execution_id, [])
        if not connections:
            return

        payload = json.dumps(event, ensure_ascii=False)
        dead: list[WebSocket] = []

        for ws in connections:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)

        for ws in dead:
            if ws in self.active[execution_id]:
                self.active[execution_id].remove(ws)

    # ------------------------------------------------------------------
    # Eventos tipados
    # ------------------------------------------------------------------

    async def send_cost_update(
        self,
        execution_id: str,
        node_id: str,
        tokens: int,
        cost_usd: float,
        total_cost_usd: float,
    ) -> None:
        """
        Emite o evento "cost_update" em tempo real após cada chamada ao Claude.

        Consumido pelo hook useCostTracker no frontend para atualizar o contador
        de custo no rodapé do canvas e no tooltip do nó (PRD seção 10.3).

        Args:
            execution_id:   UUID da execução em andamento.
            node_id:        ID do nó que gerou o custo (ex: "node-3").
            tokens:         Total de tokens consumidos nesta chamada.
            cost_usd:       Custo desta chamada em USD.
            total_cost_usd: Custo acumulado total da execução em USD.
        """
        await self.broadcast(execution_id, {
            "type":           "cost_update",
            "node_id":        node_id,
            "tokens":         tokens,
            "cost_usd":       round(cost_usd, 6),
            "total_cost_usd": round(total_cost_usd, 6),
        })

    async def send_queue_status(
        self,
        execution_id: str,
        node_id: str,
        api_name: str,
        queue_position: int,
        wait_seconds: int,
    ) -> None:
        """
        Emite o evento "queue_status" quando um nó está aguardando cota de API.

        Consumido pelo hook useWebSocket no frontend para exibir o tooltip
        "Aguardando API: YouTube Data · Posição 2 · ~45 segundos" no nó
        em espera no canvas (PRD seção 10.3).

        Args:
            execution_id:   UUID da execução em andamento.
            node_id:        ID do nó que está aguardando (ex: "node-5").
            api_name:       Nome da API na fila (ex: "youtube_data", "facebook_ads").
            queue_position: Posição na fila de rate limiting (1 = próximo a executar).
            wait_seconds:   Estimativa de espera em segundos até a cota estar disponível.
        """
        await self.broadcast(execution_id, {
            "type":           "queue_status",
            "node_id":        node_id,
            "api_name":       api_name,
            "queue_position": queue_position,
            "wait_seconds":   wait_seconds,
        })


# ---------------------------------------------------------------------------
# Instância singleton — compartilhada entre o endpoint WebSocket e os agentes
# ---------------------------------------------------------------------------

manager = ConnectionManager()
