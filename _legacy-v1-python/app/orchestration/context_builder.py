"""
ContextBuilder — extrai apenas os campos necessários do shared_state para cada agente.

Regra obrigatória (PRD seção 4, Regra 4 e Regra 8):
  Nunca passe o shared_state completo para um agente.
  Cada agente recebe apenas os campos que precisa.
  Isso reduz uso de tokens, previne vazamento de dados sensíveis
  (ex: affiliate_link não chega ao Agente de Viabilidade) e mantém
  o contexto focado na tarefa do agente.

Cada método corresponde a um agente e retorna exatamente os campos
listados em "Context consumed" na seção 4 do PRD.
"""

from typing import Any


def _get(state: dict, *keys: str, default: Any = None) -> Any:
    """Acessa um campo aninhado do shared_state com segurança."""
    node = state
    for key in keys:
        if not isinstance(node, dict):
            return default
        node = node.get(key, default)
        if node is None:
            return default
    return node


def _selected_script(state: dict) -> dict:
    """Retorna o script selecionado da lista de scripts."""
    selected_id = _get(state, "scripts", "selected_script_id")
    scripts = _get(state, "scripts", "scripts", default=[])
    for s in scripts:
        if s.get("script_id") == selected_id:
            return s
    return scripts[0] if scripts else {}


class ContextBuilder:
    """
    Extrai contexto mínimo do shared_state para cada agente.

    Uso:
        cb = ContextBuilder()
        context = cb.for_product_analyzer(shared_state)
        context = cb.for_persona_builder(shared_state)
        ...
    """

    # ------------------------------------------------------------------
    # Agente 1 — Analisador de VSL e Página
    # ------------------------------------------------------------------

    def for_product_analyzer(self, state: dict) -> dict:
        """Primeiro agente do fluxo — recebe dados brutos do produto."""
        return {
            "product_name":      _get(state, "product", "name"),
            "product_url":       _get(state, "product", "product_url"),
            "affiliate_link":    _get(state, "product", "affiliate_link"),
            "vsl_url":           _get(state, "product", "vsl_url"),
            "target_language":   _get(state, "product", "target_language"),
        }

    # ------------------------------------------------------------------
    # Agente 2 — Analisador de Viabilidade
    # ------------------------------------------------------------------

    def for_market_researcher(self, state: dict) -> dict:
        return {
            "product_name":      _get(state, "product", "name"),
            "niche":             _get(state, "product", "niche"),
            "ticket_price":      _get(state, "product", "ticket_price"),
            "commission_percent":_get(state, "product", "commission_percent"),
            "target_country":    _get(state, "product", "target_country"),
            "main_promise":      _get(state, "product_analysis", "main_promise"),
        }

    # ------------------------------------------------------------------
    # Agente 3 — Construtor de Persona e Público
    # ------------------------------------------------------------------

    def for_persona_builder(self, state: dict) -> dict:
        return {
            "product_name":           _get(state, "product", "name"),
            "niche":                  _get(state, "product", "niche"),
            "target_country":         _get(state, "product", "target_country"),
            "target_language":        _get(state, "product", "target_language"),
            "main_promise":           _get(state, "product_analysis", "main_promise"),
            "pain_points_identified": _get(state, "product_analysis", "pain_points_identified", default=[]),
            "avatar_description":     _get(state, "product_analysis", "avatar_description"),
            "competition_level":      _get(state, "market", "competition_level"),
        }

    # ------------------------------------------------------------------
    # Agente 4 — Estrategista de Nicho e Ângulo
    # ------------------------------------------------------------------

    def for_angle_strategist(self, state: dict) -> dict:
        return {
            "product_name":        _get(state, "product", "name"),
            "main_promise":        _get(state, "product_analysis", "main_promise"),
            "objections_broken":   _get(state, "product_analysis", "objections_broken", default=[]),
            "competition_level":   _get(state, "market", "competition_level"),
            "ads_running_count":   _get(state, "market", "ads_running_count", default=0),
            "persona_summary":     _get(state, "persona", "summary"),
            "primary_pain":        _get(state, "persona", "psychographic", "primary_pain"),
            "persona_objections":  _get(state, "persona", "psychographic", "objections", default=[]),
            "verbatim_expressions":_get(state, "persona", "verbatim_expressions", default=[]),
        }

    # ------------------------------------------------------------------
    # Agente 5 — Inteligência de Benchmark
    # ------------------------------------------------------------------

    def for_benchmark_agent(self, state: dict) -> dict:
        return {
            "niche":           _get(state, "product", "niche"),
            "target_country":  _get(state, "product", "target_country"),
            "target_language": _get(state, "product", "target_language"),
            "angle_type":      _get(state, "angle", "angle_type"),
        }

    # ------------------------------------------------------------------
    # Agente 6 — Estrategista de Campanha
    # ------------------------------------------------------------------

    def for_campaign_strategist(self, state: dict) -> dict:
        return {
            "ticket_price":                  _get(state, "product", "ticket_price"),
            "commission_percent":             _get(state, "product", "commission_percent"),
            "budget_for_test":               _get(state, "product", "budget_for_test"),
            "ad_platforms":                  _get(state, "product", "ad_platforms", default=[]),
            "target_language":               _get(state, "product", "target_language"),
            "viability_score":               _get(state, "market", "viability_score"),
            "persona_summary":               _get(state, "persona", "summary"),
            "primary_angle":                 _get(state, "angle", "primary_angle"),
            "angle_type":                    _get(state, "angle", "angle_type"),
            "dominant_formats":              _get(state, "benchmark", "dominant_formats", default=[]),
            "dominant_narrative_structures": _get(state, "benchmark", "dominant_narrative_structures", default=[]),
        }

    # ------------------------------------------------------------------
    # Agente 7 — Roteirista e Criador de Hooks
    # ------------------------------------------------------------------

    def for_script_writer(self, state: dict) -> dict:
        return {
            "product_name":        _get(state, "product", "name"),
            "target_language":     _get(state, "product", "target_language"),
            "main_promise":        _get(state, "product_analysis", "main_promise"),
            "offer_details":       _get(state, "product_analysis", "offer_details", default={}),
            "persona_summary":     _get(state, "persona", "summary"),
            "primary_pain":        _get(state, "persona", "psychographic", "primary_pain"),
            "persona_objections":  _get(state, "persona", "psychographic", "objections", default=[]),
            "verbatim_expressions":_get(state, "persona", "verbatim_expressions", default=[]),
            "primary_angle":       _get(state, "angle", "primary_angle"),
            "selected_hook_variant":_get(state, "angle", "selected_hook_variant"),
            "hooks":               _get(state, "angle", "hooks", default=[]),
            "creative_format":     _get(state, "strategy", "creative_format"),
            "narrative_structure": _get(state, "strategy", "narrative_structure"),
            "video_duration_seconds": _get(state, "strategy", "video_duration_seconds", default=60),
            "top_hooks_found":     _get(state, "benchmark", "top_hooks_found", default=[]),
        }

    # ------------------------------------------------------------------
    # Agente 8 — Copywriter
    # ------------------------------------------------------------------

    def for_copy_writer(self, state: dict) -> dict:
        return {
            "product_name":         _get(state, "product", "name"),
            "affiliate_link":       _get(state, "product", "affiliate_link"),
            "target_language":      _get(state, "product", "target_language"),
            "ad_platforms":         _get(state, "product", "ad_platforms", default=[]),
            "main_promise":         _get(state, "product_analysis", "main_promise"),
            "cta_text_from_vsl":    _get(state, "product_analysis", "offer_details", "cta_text"),
            "persona_summary":      _get(state, "persona", "summary"),
            "verbatim_expressions": _get(state, "persona", "verbatim_expressions", default=[]),
            "selected_hook_variant":_get(state, "angle", "selected_hook_variant"),
            "hooks":                _get(state, "angle", "hooks", default=[]),
            "selected_script_id":   _get(state, "scripts", "selected_script_id"),
        }

    # ------------------------------------------------------------------
    # Agente 9 — Gerador de Personagem Base
    # ------------------------------------------------------------------

    def for_character_generator(self, state: dict) -> dict:
        return {
            "niche":           _get(state, "product", "niche"),
            "gender":          _get(state, "persona", "full_profile", "gender"),
            "age_range":       _get(state, "persona", "full_profile", "age_range"),
            "creative_format": _get(state, "strategy", "creative_format"),
        }

    # ------------------------------------------------------------------
    # Agente 10 — Gerador de Keyframes
    # ------------------------------------------------------------------

    def for_keyframe_generator(self, state: dict) -> dict:
        script = _selected_script(state)
        return {
            "selected_script_id":    _get(state, "scripts", "selected_script_id"),
            "scene_breakdown":       script.get("scene_breakdown", []),
            "character_url":         _get(state, "character", "character_url"),
            "character_prompt_used": _get(state, "character", "character_prompt_used"),
        }

    # ------------------------------------------------------------------
    # Agente 11 — Gerador de Vídeo por Cena
    # ------------------------------------------------------------------

    def for_video_generator(self, state: dict) -> dict:
        script = _selected_script(state)
        return {
            "keyframes":       _get(state, "keyframes", "keyframes", default=[]),
            "scene_breakdown": script.get("scene_breakdown", []),
            "aspect_ratios":   _get(state, "strategy", "aspect_ratios", default=["9x16"]),
        }

    # ------------------------------------------------------------------
    # Agente 12 — Diretor de Criativo
    # ------------------------------------------------------------------

    def for_creative_director(self, state: dict) -> dict:
        script = _selected_script(state)
        return {
            "clips":                  _get(state, "video_clips", "clips", default=[]),
            "full_script":            script.get("full_script", ""),
            "scene_breakdown":        script.get("scene_breakdown", []),
            "aspect_ratios":          _get(state, "strategy", "aspect_ratios", default=["9x16"]),
            "video_duration_seconds": _get(state, "strategy", "video_duration_seconds", default=60),
            "dominant_formats":       _get(state, "benchmark", "dominant_formats", default=[]),
            "top_hooks_found":        _get(state, "benchmark", "top_hooks_found", default=[]),
            "selected_hook_variant":  _get(state, "angle", "selected_hook_variant"),
        }

    # ------------------------------------------------------------------
    # Agente 13 — Verificador de Compliance
    # ------------------------------------------------------------------

    def for_compliance_checker(self, state: dict) -> dict:
        return {
            "niche":             _get(state, "product", "niche"),
            "ad_platforms":      _get(state, "product", "ad_platforms", default=[]),
            "main_promise":      _get(state, "product_analysis", "main_promise"),
            "selected_headline": _get(state, "copy", "selected_headline"),
            "selected_body":     _get(state, "copy", "selected_body"),
            "selected_cta":      _get(state, "copy", "selected_cta"),
            "creatives":         _get(state, "final_creatives", "creatives", default=[]),
        }

    # ------------------------------------------------------------------
    # Agente 14 — Estruturador de UTM e Link
    # ------------------------------------------------------------------

    def for_utm_builder(self, state: dict) -> dict:
        return {
            "affiliate_link":  _get(state, "product", "affiliate_link"),
            "product_name":    _get(state, "product", "name"),
            "ad_platforms":    _get(state, "product", "ad_platforms", default=[]),
            "angle_type":      _get(state, "angle", "angle_type"),
            "creative_format": _get(state, "strategy", "creative_format"),
        }

    # ------------------------------------------------------------------
    # Agente 15 — Media Buyer Facebook Ads
    # ------------------------------------------------------------------

    def for_media_buyer_facebook(self, state: dict) -> dict:
        return {
            # Campanha
            "campaign_objective":   _get(state, "strategy", "campaign_objective"),
            "daily_budget_brl":     _get(state, "strategy", "daily_budget_total_brl"),
            "budget_per_adset_brl": _get(state, "strategy", "budget_per_adset_brl"),
            "recommended_adsets":   _get(state, "strategy", "recommended_adsets", default=3),
            "aspect_ratios":        _get(state, "strategy", "aspect_ratios", default=["9x16"]),
            # Público
            "target_country":       _get(state, "product", "target_country"),
            "persona_demographics": _get(state, "persona", "full_profile", default={}),
            "primary_pain":         _get(state, "persona", "psychographic", "primary_pain"),
            # Criativos e copy
            "creatives":            _get(state, "final_creatives", "creatives", default=[]),
            "selected_headline":    _get(state, "copy", "selected_headline"),
            "selected_body":        _get(state, "copy", "selected_body"),
            "selected_cta":         _get(state, "copy", "selected_cta"),
            # Rastreamento
            "final_affiliate_url":  _get(state, "tracking", "final_affiliate_url"),
            "utm_parameters":       _get(state, "tracking", "utm_parameters", default={}),
        }

    # ------------------------------------------------------------------
    # Agente 16 — Media Buyer Google Ads
    # ------------------------------------------------------------------

    def for_media_buyer_google(self, state: dict) -> dict:
        return {
            # Campanha
            "campaign_objective":  _get(state, "strategy", "campaign_objective"),
            "daily_budget_brl":    _get(state, "strategy", "daily_budget_total_brl"),
            "target_language":     _get(state, "product", "target_language"),
            "target_country":      _get(state, "product", "target_country"),
            # Copy (RSA — Responsive Search Ads)
            "headlines":           _get(state, "copy", "headlines", default=[]),
            "body_copy_short":     _get(state, "copy", "body_copy_short"),
            "body_copy_long":      _get(state, "copy", "body_copy_long"),
            # Rastreamento
            "final_affiliate_url": _get(state, "tracking", "final_affiliate_url"),
            "utm_parameters":      _get(state, "tracking", "utm_parameters", default={}),
            # Ângulo (para naming da campanha)
            "angle_type":          _get(state, "angle", "angle_type"),
            "creative_format":     _get(state, "strategy", "creative_format"),
        }

    # ------------------------------------------------------------------
    # Agente 17 — Analista de Performance
    # ------------------------------------------------------------------

    def for_performance_analyst(self, state: dict) -> dict:
        return {
            # Campanhas ativas
            "facebook_campaign":  _get(state, "facebook_campaign", default={}),
            "google_campaign":    _get(state, "google_campaign", default={}),
            # Metas de performance definidas na estratégia
            "target_roas":        _get(state, "strategy", "target_roas"),
            "min_ctr_percent":    _get(state, "strategy", "min_ctr_percent"),
            "max_cpm_brl":        _get(state, "strategy", "max_cpm_brl"),
            "max_cpa_brl":        _get(state, "strategy", "max_cpa_brl"),
            # Ativos para correlacionar com performance
            "creatives":          _get(state, "final_creatives", "creatives", default=[]),
            "selected_hook_variant": _get(state, "angle", "selected_hook_variant"),
            "angle_type":         _get(state, "angle", "angle_type"),
            # Histórico (preenchido pelo próprio agente em runs anteriores)
            "previous_performance": _get(state, "performance", default={}),
        }

    # ------------------------------------------------------------------
    # Agente 18 — Escalador
    # ------------------------------------------------------------------

    def for_scaler(self, state: dict) -> dict:
        return {
            "facebook_campaign":    _get(state, "facebook_campaign", default={}),
            "google_campaign":      _get(state, "google_campaign", default={}),
            "winning_asset_ids":    _get(state, "performance", "winning_asset_ids", default=[]),
            "losing_asset_ids":     _get(state, "performance", "losing_asset_ids", default=[]),
            "diagnosis":            _get(state, "performance", "diagnosis"),
            "recommended_action":   _get(state, "performance", "recommended_action"),
            "budget_per_adset_brl": _get(state, "strategy", "budget_per_adset_brl"),
            "target_roas":          _get(state, "strategy", "target_roas"),
        }
