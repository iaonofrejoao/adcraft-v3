"""
Testes unitários para ContextBuilder.

Verifica:
  - Cada agente recebe apenas os campos que precisa (nenhum campo extra)
  - Campos sensíveis não vazam para agentes que não precisam deles
  - Campos ausentes retornam defaults seguros (None ou [])
  - Agentes de campanha não recebem dados de performance e vice-versa
"""

import pytest

from app.orchestration.context_builder import ContextBuilder


# ===========================================================================
# Fixtures locais
# ===========================================================================

@pytest.fixture
def cb() -> ContextBuilder:
    """ContextBuilder limpo para cada teste."""
    return ContextBuilder()


# ===========================================================================
# Campos proibidos por agente
# Define o que NÃO deve aparecer no contexto de cada agente.
# Previne vazamento de dados sensíveis e reduz uso desnecessário de tokens.
# ===========================================================================

# Campos que NUNCA devem aparecer em nenhum agente de análise/criação
_CAMPAIGN_FIELDS = {
    "campaign_id", "adset_ids", "ad_ids", "facebook_campaign",
    "google_campaign", "external_campaign_id",
}
_PERFORMANCE_FIELDS = {
    "roas", "ctr", "cpc", "cpm", "cpa", "spend", "impressions",
    "winning_asset_ids", "losing_asset_ids", "diagnosis",
}
# Campos financeiros sensíveis que não devem vazar para agentes de benchmark/análise
_SENSITIVE_FINANCIAL = {"affiliate_link", "commission_percent", "budget_for_test"}


def _flatten_keys(d: dict) -> set[str]:
    """Extrai todas as chaves (superficiais) de um dict de contexto."""
    return set(d.keys())


# ===========================================================================
# Testes de isolamento de dados sensíveis
# ===========================================================================

class TestSensitiveFieldIsolation:
    """Campos sensíveis não devem vazar para agentes que não precisam deles."""

    def test_market_researcher_has_no_affiliate_link(self, cb, sample_state):
        """Agente de viabilidade analisa o mercado — não precisa do link de afiliado."""
        ctx = cb.for_market_researcher(sample_state)
        assert "affiliate_link" not in ctx, (
            "affiliate_link não deve ser passado ao market_researcher"
        )

    def test_persona_builder_has_no_financial_data(self, cb, sample_state):
        """Agente de persona constrói perfil psicográfico — sem dados financeiros."""
        ctx = cb.for_persona_builder(sample_state)
        assert "ticket_price" not in ctx
        assert "commission_percent" not in ctx
        assert "budget_for_test" not in ctx

    def test_benchmark_agent_has_no_affiliate_link(self, cb, sample_state):
        """Agente de benchmark busca referências públicas — sem link privado de afiliado."""
        ctx = cb.for_benchmark_agent(sample_state)
        assert "affiliate_link" not in ctx

    def test_script_writer_has_no_campaign_data(self, cb, sample_state):
        """Roteirista cria conteúdo — sem dados de campanha ou métricas."""
        ctx = cb.for_script_writer(sample_state)
        flat = _flatten_keys(ctx)
        assert flat.isdisjoint(_CAMPAIGN_FIELDS), (
            f"Campos de campanha encontrados no contexto do script_writer: "
            f"{flat & _CAMPAIGN_FIELDS}"
        )
        assert flat.isdisjoint(_PERFORMANCE_FIELDS), (
            f"Campos de performance encontrados no contexto do script_writer: "
            f"{flat & _PERFORMANCE_FIELDS}"
        )

    def test_compliance_checker_has_no_campaign_ids(self, cb, sample_state):
        """Compliance verifica copy e criativos — sem IDs internos de campanha."""
        ctx = cb.for_compliance_checker(sample_state)
        flat = _flatten_keys(ctx)
        assert flat.isdisjoint(_CAMPAIGN_FIELDS)

    def test_character_generator_is_minimal(self, cb, sample_state):
        """Gerador de personagem recebe apenas dados de aparência — mínimo absoluto."""
        ctx = cb.for_character_generator(sample_state)
        flat = _flatten_keys(ctx)

        expected = {"niche", "gender", "age_range", "creative_format"}
        assert flat == expected, (
            f"character_generator deve ter exatamente {expected}, mas tem {flat}"
        )


# ===========================================================================
# Testes de presença dos campos corretos
# ===========================================================================

class TestRequiredFieldsPresent:
    """Cada agente deve receber os campos que o PRD lista em 'Context consumed'."""

    def test_product_analyzer_required_fields(self, cb, sample_state):
        ctx = cb.for_product_analyzer(sample_state)
        assert "product_name" in ctx
        assert "product_url" in ctx
        assert "affiliate_link" in ctx
        assert "vsl_url" in ctx
        assert "target_language" in ctx

    def test_market_researcher_required_fields(self, cb, sample_state):
        ctx = cb.for_market_researcher(sample_state)
        assert "product_name" in ctx
        assert "niche" in ctx
        assert "ticket_price" in ctx
        assert "commission_percent" in ctx
        assert "target_country" in ctx
        assert "main_promise" in ctx

    def test_persona_builder_required_fields(self, cb, sample_state):
        ctx = cb.for_persona_builder(sample_state)
        assert "product_name" in ctx
        assert "niche" in ctx
        assert "target_country" in ctx
        assert "target_language" in ctx
        assert "main_promise" in ctx
        assert "pain_points_identified" in ctx
        assert "competition_level" in ctx

    def test_angle_strategist_required_fields(self, cb, sample_state):
        ctx = cb.for_angle_strategist(sample_state)
        assert "product_name" in ctx
        assert "main_promise" in ctx
        assert "persona_summary" in ctx
        assert "primary_pain" in ctx
        assert "verbatim_expressions" in ctx
        assert "competition_level" in ctx

    def test_benchmark_agent_required_fields(self, cb, sample_state):
        ctx = cb.for_benchmark_agent(sample_state)
        assert "niche" in ctx
        assert "target_country" in ctx
        assert "target_language" in ctx
        assert "angle_type" in ctx

    def test_campaign_strategist_required_fields(self, cb, sample_state):
        ctx = cb.for_campaign_strategist(sample_state)
        assert "ticket_price" in ctx
        assert "commission_percent" in ctx
        assert "budget_for_test" in ctx
        assert "ad_platforms" in ctx
        assert "viability_score" in ctx
        assert "persona_summary" in ctx
        assert "dominant_formats" in ctx

    def test_script_writer_required_fields(self, cb, sample_state):
        ctx = cb.for_script_writer(sample_state)
        assert "product_name" in ctx
        assert "persona_summary" in ctx
        assert "primary_pain" in ctx
        assert "verbatim_expressions" in ctx
        assert "primary_angle" in ctx
        assert "hooks" in ctx
        assert "creative_format" in ctx
        assert "narrative_structure" in ctx
        assert "video_duration_seconds" in ctx

    def test_copy_writer_required_fields(self, cb, sample_state):
        ctx = cb.for_copy_writer(sample_state)
        assert "product_name" in ctx
        assert "affiliate_link" in ctx      # Copywriter precisa — inclui no CTA
        assert "ad_platforms" in ctx
        assert "persona_summary" in ctx
        assert "verbatim_expressions" in ctx
        assert "selected_hook_variant" in ctx

    def test_utm_builder_required_fields(self, cb, sample_state):
        ctx = cb.for_utm_builder(sample_state)
        assert "affiliate_link" in ctx
        assert "product_name" in ctx
        assert "ad_platforms" in ctx
        assert "angle_type" in ctx
        assert "creative_format" in ctx

    def test_media_buyer_facebook_required_fields(self, cb, sample_state):
        ctx = cb.for_media_buyer_facebook(sample_state)
        assert "campaign_objective" in ctx
        assert "daily_budget_brl" in ctx
        assert "target_country" in ctx
        assert "creatives" in ctx
        assert "selected_headline" in ctx
        assert "final_affiliate_url" in ctx

    def test_performance_analyst_required_fields(self, cb, sample_state):
        ctx = cb.for_performance_analyst(sample_state)
        assert "facebook_campaign" in ctx
        assert "google_campaign" in ctx
        assert "target_roas" in ctx
        assert "min_ctr_percent" in ctx
        assert "max_cpa_brl" in ctx

    def test_scaler_required_fields(self, cb, sample_state):
        ctx = cb.for_scaler(sample_state)
        assert "winning_asset_ids" in ctx
        assert "losing_asset_ids" in ctx
        assert "diagnosis" in ctx
        assert "recommended_action" in ctx
        assert "target_roas" in ctx


# ===========================================================================
# Testes de valores corretos extraídos
# ===========================================================================

class TestExtractedValues:
    """Os valores extraídos devem corresponder ao shared_state."""

    def test_product_analyzer_values(self, cb, sample_state):
        ctx = cb.for_product_analyzer(sample_state)
        assert ctx["product_name"] == "Suplemento Detox Pro"
        assert ctx["target_language"] == "pt-BR"

    def test_market_researcher_values(self, cb, sample_state):
        ctx = cb.for_market_researcher(sample_state)
        assert ctx["ticket_price"] == 197.0
        assert ctx["commission_percent"] == 40.0
        assert ctx["target_country"] == "BR"

    def test_persona_builder_extracts_competition_level(self, cb, sample_state):
        ctx = cb.for_persona_builder(sample_state)
        assert ctx["competition_level"] == "medium"

    def test_angle_strategist_extracts_verbatim(self, cb, sample_state):
        ctx = cb.for_angle_strategist(sample_state)
        assert isinstance(ctx["verbatim_expressions"], list)
        assert len(ctx["verbatim_expressions"]) > 0

    def test_script_writer_extracts_video_duration(self, cb, sample_state):
        ctx = cb.for_script_writer(sample_state)
        assert ctx["video_duration_seconds"] == 60

    def test_keyframe_generator_extracts_scene_breakdown(self, cb, sample_state):
        """Deve extrair o scene_breakdown do script selecionado, não de todos."""
        ctx = cb.for_keyframe_generator(sample_state)
        assert "scene_breakdown" in ctx
        assert isinstance(ctx["scene_breakdown"], list)
        assert len(ctx["scene_breakdown"]) > 0


# ===========================================================================
# Testes de defaults seguros para campos ausentes
# ===========================================================================

class TestSafeDefaults:
    """Campos ausentes no state devem retornar defaults seguros (não lançar exceção)."""

    def test_missing_fields_return_none_not_exception(self, cb, sample_state_partial):
        """Estado parcial (só product) não deve causar erro em nenhum método."""
        # Esses agentes leem campos que não existem no state parcial
        # Nenhum deve lançar KeyError ou AttributeError
        cb.for_product_analyzer(sample_state_partial)
        cb.for_market_researcher(sample_state_partial)
        cb.for_persona_builder(sample_state_partial)
        cb.for_angle_strategist(sample_state_partial)

    def test_lists_default_to_empty_list(self, cb, sample_state_partial):
        """Campos de lista ausentes devem retornar [] e não None."""
        ctx = cb.for_angle_strategist(sample_state_partial)
        assert ctx["verbatim_expressions"] == []
        assert ctx["persona_objections"] == []
        assert ctx["objections_broken"] == []

    def test_campaign_strategist_defaults_for_missing_benchmark(self, cb, sample_state_partial):
        """Campos de benchmark ausentes devem retornar listas vazias."""
        ctx = cb.for_campaign_strategist(sample_state_partial)
        assert ctx["dominant_formats"] == []
        assert ctx["dominant_narrative_structures"] == []

    def test_keyframe_generator_fallback_when_no_scripts(self, cb, sample_state_partial):
        """Sem scripts, scene_breakdown deve ser lista vazia — não exceção."""
        ctx = cb.for_keyframe_generator(sample_state_partial)
        assert ctx["scene_breakdown"] == []

    def test_scaler_defaults_for_missing_performance(self, cb, sample_state_partial):
        ctx = cb.for_scaler(sample_state_partial)
        assert ctx["winning_asset_ids"] == []
        assert ctx["losing_asset_ids"] == []


# ===========================================================================
# Teste de fronteira entre agentes de lançamento e análise
# ===========================================================================

class TestAgentBoundaries:
    """Agentes de lançamento e análise não devem compartilhar contexto."""

    def test_performance_analyst_has_no_copy_fields(self, cb, sample_state):
        """Analista de performance não precisa da copy dos anúncios."""
        ctx = cb.for_performance_analyst(sample_state)
        assert "selected_headline" not in ctx
        assert "body_copy" not in ctx
        assert "selected_cta" not in ctx

    def test_scaler_has_no_creative_content(self, cb, sample_state):
        """Escalador trabalha com IDs e orçamentos — não com conteúdo criativo."""
        ctx = cb.for_scaler(sample_state)
        assert "selected_headline" not in ctx
        assert "verbatim_expressions" not in ctx
        assert "hooks" not in ctx

    def test_benchmark_agent_has_no_strategy_data(self, cb, sample_state):
        """Benchmark coleta dados externos — estratégia ainda não existe nesse momento."""
        ctx = cb.for_benchmark_agent(sample_state)
        assert "campaign_objective" not in ctx
        assert "daily_budget" not in ctx
        assert "target_roas" not in ctx

    def test_compliance_checker_has_no_financial_data(self, cb, sample_state):
        """Compliance verifica conteúdo — não precisa de dados financeiros."""
        ctx = cb.for_compliance_checker(sample_state)
        assert "ticket_price" not in ctx
        assert "commission_percent" not in ctx
        assert "budget_for_test" not in ctx

    def test_character_generator_has_no_angle_or_copy(self, cb, sample_state):
        """Gerador de personagem visual não recebe dados de copy ou ângulo."""
        ctx = cb.for_character_generator(sample_state)
        assert "hooks" not in ctx
        assert "selected_headline" not in ctx
        assert "primary_angle" not in ctx
        assert "verbatim_expressions" not in ctx
