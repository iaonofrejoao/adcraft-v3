"""
Testes unitários para RateLimiter.

Verifica:
  - Isolamento de quota entre APIs diferentes (YouTube não bloqueia Facebook)
  - Controle de cota dentro da janela deslizante
  - Expiração de entradas fora da janela
  - Rejeição de API não mapeada
  - Alerta de quota para YouTube (alert_at=8000)
  - can_proceed() não bloqueia
  - status() retorna estrutura correta para a UI
"""

import asyncio
import logging
from datetime import UTC, datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.orchestration.rate_limiter import RateLimiter, _API_LIMITS, _UsageEntry


# ===========================================================================
# Fixtures
# ===========================================================================

@pytest.fixture
def limiter() -> RateLimiter:
    """RateLimiter limpo para cada teste."""
    return RateLimiter()


# ===========================================================================
# Testes de isolamento entre APIs
# ===========================================================================

class TestApiIsolation:
    """APIs diferentes não competem pela mesma cota — regra fundamental."""

    def test_exhausting_youtube_does_not_block_facebook(self, limiter):
        """Quota do YouTube esgotada não deve impedir chamadas ao Facebook Ads."""
        youtube_limit = _API_LIMITS["youtube_data"]
        # Preenche a quota do YouTube com uma entrada enorme
        limiter._usage["youtube_data"].append(
            _UsageEntry(timestamp=datetime.now(UTC), cost=youtube_limit.max_cost)
        )

        assert limiter.can_proceed("youtube_data", cost=1) is False
        assert limiter.can_proceed("facebook_ads", cost=1) is True

    def test_exhausting_anthropic_does_not_block_meta_ad_library(self, limiter):
        """Quota da Anthropic esgotada não impede busca na Ad Library."""
        anthropic_limit = _API_LIMITS["anthropic"]
        limiter._usage["anthropic"].append(
            _UsageEntry(timestamp=datetime.now(UTC), cost=anthropic_limit.max_cost)
        )

        assert limiter.can_proceed("anthropic", cost=1) is False
        assert limiter.can_proceed("meta_ad_library", cost=1) is True

    def test_all_apis_start_with_full_quota(self, limiter):
        """Sem registros, todas as APIs devem ter quota disponível."""
        for api_name in _API_LIMITS:
            assert limiter.can_proceed(api_name, cost=1) is True, (
                f"API '{api_name}' deveria ter quota disponível no início"
            )

    def test_each_api_has_its_own_counter(self, limiter):
        """Consumo de uma API não afeta o contador de outra."""
        limiter._usage["facebook_ads"].append(
            _UsageEntry(timestamp=datetime.now(UTC), cost=100)
        )

        facebook_status = limiter.status("facebook_ads")
        google_status   = limiter.status("google_ads")

        assert facebook_status.used == 100
        assert google_status.used == 0


# ===========================================================================
# Testes de controle de cota
# ===========================================================================

class TestQuotaControl:
    """Testa o controle de cota dentro da janela deslizante."""

    def test_can_proceed_when_under_limit(self, limiter):
        """Deve permitir chamada quando o uso está abaixo do limite."""
        limit = _API_LIMITS["facebook_ads"]
        limiter._usage["facebook_ads"].append(
            _UsageEntry(timestamp=datetime.now(UTC), cost=limit.max_cost - 10)
        )
        assert limiter.can_proceed("facebook_ads", cost=5) is True

    def test_cannot_proceed_when_at_limit(self, limiter):
        """Deve bloquear quando uso + custo excede o limite."""
        limit = _API_LIMITS["facebook_ads"]
        limiter._usage["facebook_ads"].append(
            _UsageEntry(timestamp=datetime.now(UTC), cost=limit.max_cost)
        )
        assert limiter.can_proceed("facebook_ads", cost=1) is False

    def test_cannot_proceed_when_cost_would_exceed_limit(self, limiter):
        """Deve bloquear quando o custo da chamada sozinho ultrapassaria o limite."""
        limit = _API_LIMITS["facebook_ads"]
        limiter._usage["facebook_ads"].append(
            _UsageEntry(timestamp=datetime.now(UTC), cost=limit.max_cost - 5)
        )
        # Custo de 10 ultrapassaria: (max-5) + 10 > max
        assert limiter.can_proceed("facebook_ads", cost=10) is False

    def test_youtube_cost_unit_matters(self, limiter):
        """YouTube cobra por unidade — search custa 100, comentário custa 1."""
        youtube_limit = _API_LIMITS["youtube_data"]
        # Registra 99 searches (99 * 100 = 9900 unidades)
        for _ in range(99):
            limiter._usage["youtube_data"].append(
                _UsageEntry(timestamp=datetime.now(UTC), cost=100)
            )

        # Ainda cabe um comentário (custo=1, total ficaria 9901)
        assert limiter.can_proceed("youtube_data", cost=1) is True
        # Mas não cabe outro search (custo=100, total ficaria 10000 — exatamente no limite)
        assert limiter.can_proceed("youtube_data", cost=100) is True
        # Uma unidade a mais bloquearia
        limiter._usage["youtube_data"].append(
            _UsageEntry(timestamp=datetime.now(UTC), cost=1)
        )
        assert limiter.can_proceed("youtube_data", cost=100) is False


# ===========================================================================
# Testes de janela deslizante (expiração)
# ===========================================================================

class TestSlidingWindow:
    """Entradas fora da janela expiram e liberam quota."""

    def test_expired_entries_are_purged(self, limiter):
        """Entradas mais antigas que window_seconds são ignoradas."""
        limit = _API_LIMITS["gemini"]  # 60 segundos
        old_timestamp = datetime.now(UTC) - timedelta(seconds=limit.window_seconds + 5)

        # Entrada expirada — fora da janela
        limiter._usage["gemini"].append(
            _UsageEntry(timestamp=old_timestamp, cost=limit.max_cost)
        )

        # Deve ter liberado — a entrada expirou
        assert limiter.can_proceed("gemini", cost=1) is True

    def test_recent_entries_are_counted(self, limiter):
        """Entradas dentro da janela são contadas normalmente."""
        limit = _API_LIMITS["gemini"]
        recent_timestamp = datetime.now(UTC) - timedelta(seconds=limit.window_seconds - 5)

        limiter._usage["gemini"].append(
            _UsageEntry(timestamp=recent_timestamp, cost=limit.max_cost)
        )

        # Dentro da janela — deve bloquear
        assert limiter.can_proceed("gemini", cost=1) is False

    def test_current_usage_excludes_expired(self, limiter):
        """_current_usage() não conta entradas expiradas."""
        limit = _API_LIMITS["gemini"]
        old_ts = datetime.now(UTC) - timedelta(seconds=limit.window_seconds + 10)
        new_ts = datetime.now(UTC)

        limiter._usage["anthropic"].append(_UsageEntry(timestamp=old_ts, cost=30))
        limiter._usage["anthropic"].append(_UsageEntry(timestamp=new_ts, cost=10))

        used = limiter._current_usage("anthropic", limit)
        assert used == 10  # Apenas a entrada recente


# ===========================================================================
# Testes de validação de API
# ===========================================================================

class TestApiValidation:
    """Testa rejeição de APIs não mapeadas."""

    @pytest.mark.asyncio
    async def test_acquire_raises_for_unknown_api(self, limiter):
        """acquire() deve lançar ValueError para API não mapeada."""
        with pytest.raises(ValueError, match="não mapeada"):
            await limiter.acquire("api_inventada", cost=1)

    def test_can_proceed_returns_false_for_unknown_api(self, limiter):
        """can_proceed() deve retornar False para API não mapeada (não lança exceção)."""
        result = limiter.can_proceed("api_inventada", cost=1)
        assert result is False

    def test_status_raises_for_unknown_api(self, limiter):
        """status() deve lançar ValueError para API não mapeada."""
        with pytest.raises(ValueError):
            limiter.status("api_inventada")

    def test_all_mapped_apis_are_valid(self, limiter):
        """Todas as APIs em _API_LIMITS devem funcionar em status() sem erro."""
        for api_name in _API_LIMITS:
            status = limiter.status(api_name)
            assert status.api_name == api_name
            assert status.limit > 0


# ===========================================================================
# Testes de alerta de quota
# ===========================================================================

class TestQuotaAlert:
    """Testa emissão de alerta de quota para YouTube (alert_at=8000)."""

    def test_youtube_alert_logged_at_threshold(self, limiter, caplog):
        """Deve logar WARNING quando YouTube atingir alert_at=8000 unidades."""
        limit = _API_LIMITS["youtube_data"]
        assert limit.alert_at == 8_000  # Confirma configuração

        # Usa 7900 unidades
        limiter._usage["youtube_data"].append(
            _UsageEntry(timestamp=datetime.now(UTC), cost=7900)
        )

        # Chama _check_alert com custo de 100 (total ficaria 8000 — na fronteira)
        with caplog.at_level(logging.WARNING):
            limiter._check_alert("youtube_data", cost=100, limit=limit)

        assert any("youtube_data" in record.message for record in caplog.records)

    def test_no_alert_below_threshold(self, limiter, caplog):
        """Não deve logar WARNING abaixo do alert_at."""
        limit = _API_LIMITS["youtube_data"]
        limiter._usage["youtube_data"].append(
            _UsageEntry(timestamp=datetime.now(UTC), cost=100)
        )

        with caplog.at_level(logging.WARNING):
            limiter._check_alert("youtube_data", cost=1, limit=limit)

        # Nenhum warning de quota
        quota_warnings = [r for r in caplog.records if "youtube_data" in r.message and "alerta" in r.message.lower()]
        assert len(quota_warnings) == 0

    def test_apis_without_alert_never_warn(self, limiter, caplog):
        """APIs com alert_at=0 não devem nunca logar alerta de quota."""
        limit = _API_LIMITS["anthropic"]
        assert limit.alert_at == 0  # Confirma que não tem alerta

        limiter._usage["anthropic"].append(
            _UsageEntry(timestamp=datetime.now(UTC), cost=limit.max_cost - 1)
        )

        with caplog.at_level(logging.WARNING):
            limiter._check_alert("anthropic", cost=1, limit=limit)

        # Nenhum warning de quota da Anthropic
        assert not any("anthropic" in r.message and "alerta" in r.message.lower() for r in caplog.records)


# ===========================================================================
# Testes de acquire() assíncrono
# ===========================================================================

class TestAcquireAsync:
    """Testa o comportamento assíncrono do acquire()."""

    @pytest.mark.asyncio
    async def test_acquire_registers_usage(self, limiter):
        """acquire() deve registrar o uso após permitir a chamada."""
        await limiter.acquire("facebook_ads", cost=1)

        assert limiter._current_usage("facebook_ads", _API_LIMITS["facebook_ads"]) == 1

    @pytest.mark.asyncio
    async def test_acquire_multiple_calls_accumulate(self, limiter):
        """Múltiplos acquire() devem acumular o uso."""
        for _ in range(5):
            await limiter.acquire("facebook_ads", cost=10)

        assert limiter._current_usage("facebook_ads", _API_LIMITS["facebook_ads"]) == 50

    @pytest.mark.asyncio
    async def test_queue_callback_called_when_blocked(self, limiter):
        """Callback de fila deve ser chamado quando a quota está esgotada."""
        limit = _API_LIMITS["web_search"]
        # Esgota a quota
        limiter._usage["web_search"].append(
            _UsageEntry(timestamp=datetime.now(UTC), cost=limit.max_cost)
        )

        callback = AsyncMock()
        limiter.set_queue_event_callback(callback)

        # Libera após um tick — simula expiração
        async def _release_after_tick():
            await asyncio.sleep(0.01)
            # Simula expiração limpando o usage
            limiter._usage["web_search"].clear()

        # Roda os dois em paralelo
        await asyncio.gather(
            limiter.acquire("web_search", cost=1, execution_id="exec-1"),
            _release_after_tick(),
        )

        # Callback deve ter sido chamado pelo menos uma vez
        assert callback.called


# ===========================================================================
# Testes de status() para UI
# ===========================================================================

class TestStatusMethod:
    """Testa o retorno de status para exibição no canvas."""

    def test_status_returns_correct_used(self, limiter):
        """status() deve retornar o uso atual correto."""
        limiter._usage["google_ads"].append(
            _UsageEntry(timestamp=datetime.now(UTC), cost=25)
        )
        status = limiter.status("google_ads")
        assert status.used == 25

    def test_status_returns_correct_limit(self, limiter):
        """status() deve retornar o limite conforme _API_LIMITS."""
        status = limiter.status("google_ads")
        assert status.limit == _API_LIMITS["google_ads"].max_cost

    def test_status_queue_position_zero_when_not_waiting(self, limiter):
        """queue_position deve ser 0 quando não há fila."""
        status = limiter.status("facebook_ads")
        assert status.queue_position == 0

    def test_all_statuses_returns_all_apis(self, limiter):
        """all_statuses() deve retornar status para todas as APIs mapeadas."""
        all_statuses = limiter.all_statuses()
        api_names = {s.api_name for s in all_statuses}
        assert api_names == set(_API_LIMITS.keys())
