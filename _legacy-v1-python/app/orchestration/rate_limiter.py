import asyncio
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta, timezone
from typing import Callable, Awaitable


# ---------------------------------------------------------------------------
# Configuração de limites por API (PRD seção 13.5)
# Cada entrada define: janela de tempo e quota máxima nessa janela.
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class ApiLimit:
    max_cost:       int    # unidades máximas na janela
    window_seconds: int    # duração da janela em segundos
    alert_at:       int    # emite alerta quando usage >= este valor (0 = sem alerta)


_API_LIMITS: dict[str, ApiLimit] = {
    "gemini":          ApiLimit(max_cost=15,     window_seconds=60,    alert_at=0),
    "facebook_ads":    ApiLimit(max_cost=200,     window_seconds=3600,  alert_at=0),
    "meta_ad_library": ApiLimit(max_cost=60,      window_seconds=3600,  alert_at=0),
    "google_ads":      ApiLimit(max_cost=100,     window_seconds=3600,  alert_at=0),
    "youtube_data":    ApiLimit(max_cost=10_000,  window_seconds=86400, alert_at=8_000),
    "web_search":      ApiLimit(max_cost=60,      window_seconds=60,    alert_at=0),
    "image_generation":ApiLimit(max_cost=100,     window_seconds=3600,  alert_at=0),
    "video_generation":ApiLimit(max_cost=50,      window_seconds=3600,  alert_at=0),
}


# ---------------------------------------------------------------------------
# Estruturas de dados
# ---------------------------------------------------------------------------

@dataclass
class _UsageEntry:
    timestamp: datetime
    cost:      int


@dataclass
class QueueStatus:
    api_name:        str
    used:            int
    limit:           int
    window_seconds:  int
    queue_position:  int        # posição na fila de espera (0 = não está em fila)
    wait_seconds:    int        # estimativa de espera em segundos


# ---------------------------------------------------------------------------
# RateLimiter
# ---------------------------------------------------------------------------

# Tipo do callback de evento de fila — recebe QueueStatus, usado para emitir
# eventos WebSocket e atualizar o tooltip do nó no canvas.
QueueEventCallback = Callable[[str, QueueStatus], Awaitable[None]]


class RateLimiter:
    """
    Controle de quota por API com janelas deslizantes independentes.

    Cada API tem sua própria janela — chamadas ao YouTube não competem
    com chamadas ao Facebook. O limite de uma API jamais bloqueia outra.

    Uso:
        limiter = RateLimiter()
        limiter.set_queue_event_callback(ws_manager.send_queue_status)

        async with limiter.acquire("youtube_data", cost=100):
            resultado = await chamar_youtube(...)

    Ou sem context manager:
        await limiter.acquire("facebook_ads")
        resultado = await chamar_facebook(...)
    """

    def __init__(self) -> None:
        # histórico de uso: api_name → lista de entradas com timestamp
        self._usage: dict[str, list[_UsageEntry]] = defaultdict(list)
        # filas de espera por API: api_name → contagem de coroutines aguardando
        self._queues: dict[str, int] = defaultdict(int)
        # callback opcional para emitir eventos WebSocket ao frontend
        self._on_queue_event: QueueEventCallback | None = None
        # lock por API para evitar race condition em async
        self._locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)

    def set_queue_event_callback(self, callback: QueueEventCallback) -> None:
        """
        Registra callback chamado enquanto uma coroutine aguarda na fila.
        Usado pelo ConnectionManager para emitir eventos WebSocket ao canvas.

        Signature do callback:
            async def on_queue(execution_id: str, status: QueueStatus) -> None
        """
        self._on_queue_event = callback

    # ------------------------------------------------------------------
    # Aquisição de quota (interface principal)
    # ------------------------------------------------------------------

    async def acquire(
        self,
        api_name:     str,
        cost:         int = 1,
        execution_id: str = "",
        node_id:      str = "",
    ) -> None:
        """
        Aguarda até que a quota permita a chamada e a registra.

        Bloqueia a coroutine (sem bloquear o event loop) se a quota
        da API estiver esgotada, emitindo eventos de fila a cada iteração.

        Args:
            api_name:     Chave da API (ex: "youtube_data", "facebook_ads").
            cost:         Custo em unidades desta chamada (default 1).
                          YouTube conta por unidade (search=100, comments=1).
            execution_id: Usado no evento WebSocket para identificar o canvas.
            node_id:      Usado no evento WebSocket para o tooltip do nó.

        Raises:
            ValueError: se api_name não estiver mapeado em _API_LIMITS.
        """
        if api_name not in _API_LIMITS:
            raise ValueError(
                f"API '{api_name}' não mapeada no RateLimiter. "
                f"APIs disponíveis: {list(_API_LIMITS)}"
            )

        limit = _API_LIMITS[api_name]

        # Verifica alerta de quota
        self._check_alert(api_name, cost, limit)

        async with self._locks[api_name]:
            while not self._can_proceed(api_name, cost, limit):
                wait_seconds = self._seconds_until_available(api_name, cost, limit)
                self._queues[api_name] += 1
                queue_position = self._queues[api_name]

                status = QueueStatus(
                    api_name=api_name,
                    used=self._current_usage(api_name, limit),
                    limit=limit.max_cost,
                    window_seconds=limit.window_seconds,
                    queue_position=queue_position,
                    wait_seconds=wait_seconds,
                )

                # Emite evento para o canvas mostrar no tooltip do nó
                if self._on_queue_event and execution_id:
                    await self._on_queue_event(execution_id, status)

                # Libera o lock temporariamente para não travar outras coroutines
                self._locks[api_name].release()
                await asyncio.sleep(min(wait_seconds, 5))
                await self._locks[api_name].acquire()

                self._queues[api_name] = max(0, self._queues[api_name] - 1)

            # Quota disponível — registra uso
            self._usage[api_name].append(
                _UsageEntry(timestamp=datetime.now(UTC), cost=cost)
            )
            self._purge_expired(api_name, limit)

    # ------------------------------------------------------------------
    # Consulta de status (sem aguardar)
    # ------------------------------------------------------------------

    def can_proceed(self, api_name: str, cost: int = 1) -> bool:
        """Retorna True se a API tem quota disponível agora, sem bloquear."""
        if api_name not in _API_LIMITS:
            return False
        limit = _API_LIMITS[api_name]
        return self._can_proceed(api_name, cost, limit)

    def status(self, api_name: str) -> QueueStatus:
        """Retorna o status atual de quota de uma API para exibição na UI."""
        limit = _API_LIMITS.get(api_name)
        if not limit:
            raise ValueError(f"API '{api_name}' não mapeada no RateLimiter.")

        return QueueStatus(
            api_name=api_name,
            used=self._current_usage(api_name, limit),
            limit=limit.max_cost,
            window_seconds=limit.window_seconds,
            queue_position=self._queues.get(api_name, 0),
            wait_seconds=self._seconds_until_available(api_name, 1, limit),
        )

    def all_statuses(self) -> list[QueueStatus]:
        """Retorna status de todas as APIs mapeadas."""
        return [self.status(api) for api in _API_LIMITS]

    # ------------------------------------------------------------------
    # Lógica interna
    # ------------------------------------------------------------------

    def _can_proceed(self, api_name: str, cost: int, limit: ApiLimit) -> bool:
        used = self._current_usage(api_name, limit)
        return used + cost <= limit.max_cost

    def _current_usage(self, api_name: str, limit: ApiLimit) -> int:
        """Soma de unidades usadas dentro da janela ativa."""
        self._purge_expired(api_name, limit)
        return sum(e.cost for e in self._usage[api_name])

    def _purge_expired(self, api_name: str, limit: ApiLimit) -> None:
        """Remove entradas fora da janela deslizante."""
        cutoff = datetime.now(UTC) - timedelta(seconds=limit.window_seconds)
        self._usage[api_name] = [
            e for e in self._usage[api_name] if e.timestamp >= cutoff
        ]

    def _seconds_until_available(
        self, api_name: str, cost: int, limit: ApiLimit
    ) -> int:
        """
        Estima quantos segundos até que `cost` unidades fiquem disponíveis.
        Retorna 0 se já disponível.
        """
        if self._can_proceed(api_name, cost, limit):
            return 0

        entries = sorted(self._usage[api_name], key=lambda e: e.timestamp)
        accumulated = 0
        for entry in entries:
            accumulated += entry.cost
            if self._current_usage(api_name, limit) - accumulated + cost <= limit.max_cost:
                elapsed = (datetime.now(UTC) - entry.timestamp).total_seconds()
                remaining = max(0, limit.window_seconds - elapsed)
                return int(remaining) + 1
        return limit.window_seconds

    def _check_alert(self, api_name: str, cost: int, limit: ApiLimit) -> None:
        """
        Loga alerta quando o uso está se aproximando do limite diário.
        Relevante para YouTube Data API (limite de 10.000 unidades/dia).
        """
        if limit.alert_at == 0:
            return
        used = self._current_usage(api_name, limit)
        if used + cost >= limit.alert_at:
            import logging
            logging.getLogger(__name__).warning(
                "RateLimiter: API '%s' atingiu %d/%d unidades na janela "
                "(alerta configurado em %d). Próximas chamadas podem ser bloqueadas.",
                api_name, used + cost, limit.max_cost, limit.alert_at,
            )
