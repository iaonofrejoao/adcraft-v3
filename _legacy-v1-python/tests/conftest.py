"""
Fixtures compartilhadas entre todos os testes.

Fixtures disponíveis:
    sample_state            — shared_state dict realista (formato do banco)
    sample_state_partial    — shared_state com apenas product preenchido
    mock_supabase           — Mock do cliente Supabase com respostas configuráveis
    mock_r2_upload          — Mock de upload R2 retornando URL permanente fake
    mock_anthropic_client   — Mock do cliente Anthropic
    mock_claude_response    — Fábrica de respostas mockadas com tokens configuráveis
"""

import pytest
from unittest.mock import MagicMock, AsyncMock, patch


# ---------------------------------------------------------------------------
# Shared state fixtures (dict — formato real do banco JSONB)
# ---------------------------------------------------------------------------

@pytest.fixture
def sample_state() -> dict:
    """
    Shared state completo com todos os campos realistas.
    Representa uma execução após o Agente 6 (Estrategista) ter concluído.
    """
    return {
        "product": {
            "name": "Suplemento Detox Pro",
            "niche": "emagrecimento",
            "platform": "hotmart",
            "product_url": "https://example.com/produto",
            "affiliate_link": "https://go.hotmart.com/abc123",
            "commission_percent": 40.0,
            "ticket_price": 197.0,
            "target_country": "BR",
            "target_language": "pt-BR",
            "budget_for_test": 300.0,
            "ad_platforms": ["facebook"],
            "vsl_url": "https://vturb.com/abc",
            "orchestrator_behavior_on_failure": "agent_decides",
        },
        "product_analysis": {
            "main_promise": "Emagreça 10kg em 30 dias sem dieta restritiva",
            "avatar_description": "Mulher 35-50 anos com gordura localizada no abdômen",
            "pain_points_identified": [
                "gordura teimosa que não sai",
                "cansaço com dietas que não funcionam",
                "metabolismo lento",
            ],
            "objections_broken": [
                "Não precisa fazer dieta restritiva",
                "Formula patenteada diferente do mercado",
            ],
            "hooks_used_in_vsl": [
                "Médicos não querem que você saiba disso",
                "O que sua balança não te conta",
            ],
            "offer_details": {
                "price": 197.0,
                "guarantee_days": 30,
                "bonuses": ["Guia de receitas detox", "App de acompanhamento"],
                "cta_text": "Quero meu Detox Pro agora",
            },
            "narrative_structure": "PAS — Problema, Agitação, Solução",
            "vsl_transcription_status": "completed",
            "analysis_confidence": 87,
            "sources": ["vsl_transcript", "https://example.com/produto"],
        },
        "market": {
            "viability_score": 78,
            "viability_verdict": "viable",
            "viability_justification": "Nicho com alto volume de busca e margem positiva de R$78,80 por venda.",
            "competition_level": "medium",
            "ads_running_count": 47,
            "trend_direction": "growing",
            "trend_source": "Google Trends BR — últimos 90 dias",
            "estimated_margin_brl": 78.80,
            "market_warnings": [],
            "data_sources": ["meta_ad_library", "google_trends"],
        },
        "persona": {
            "summary": "Ana, 38 anos, professora do interior de SP. Tem 20kg a perder após dois filhos. "
                       "Tentou low carb e academia sem resultado duradouro. Sente vergonha do corpo "
                       "e quer caber no vestido do casamento da filha.",
            "full_profile": {
                "fictional_name": "Ana",
                "age_range": "35-45",
                "gender": "feminino",
                "location": "interior de São Paulo",
                "income_level": "classe média",
                "education": "superior",
                "occupation": "professora",
            },
            "psychographic": {
                "primary_pain": "gordura teimosa que não sai mesmo fazendo dieta",
                "secondary_pains": ["cansaço constante", "roupas que não servem mais"],
                "primary_desire": "caber no vestido do casamento da minha filha",
                "secondary_desires": ["mais energia", "se sentir atraente"],
                "tried_before": ["dieta low carb", "academia 3x por semana", "shake de proteína"],
                "objections": ["mais um produto que não vai funcionar", "é caro"],
                "language_style": "informal e emocional",
            },
            "verbatim_expressions": [
                "gordura teimosa",
                "tentei de tudo",
                "meu metabolismo é lento",
                "não consigo perder nem 1kg",
            ],
            "data_sources": [
                "https://youtube.com/watch?v=abc",
                "https://amazon.com.br/reviews/xyz",
            ],
        },
        "angle": {
            "primary_angle": "Autoridade traída — médicos sabem o segredo do metabolismo que nunca contaram",
            "angle_type": "betrayed_authority",
            "usp": "Única fórmula com enzima termogênica de origem vegetal aprovada pela ANVISA",
            "emotional_trigger": "indignação + esperança",
            "hooks": [
                {"hook_text": "Médicos não querem que você saiba disso sobre o seu metabolismo", "hook_type": "shocking_statement", "variant_id": "A"},
                {"hook_text": "Por que sua dieta nunca funciona? A resposta te vai chocar", "hook_type": "question", "variant_id": "B"},
                {"hook_text": "Perdi 12kg depois que descobri isso por acaso", "hook_type": "story", "variant_id": "C"},
            ],
            "selected_hook_variant": "A",
            "alternative_angles": ["transformação", "prova social"],
            "angle_rationale": "Ângulo de autoridade traída está subexplorado no nicho vs concorrência.",
        },
        "benchmark": {
            "top_hooks_found": [
                {"hook_text": "Esse truque simples derreti 8kg em 21 dias", "source": "facebook_ad", "source_url": "https://fb.ad/1", "days_running": 45, "format": "ugc"},
                {"hook_text": "Nutricionista revelou o que ninguém te conta sobre dieta", "source": "youtube_video", "source_url": "https://yt.be/x1", "days_running": 0, "format": "vsl"},
            ],
            "dominant_formats": ["ugc", "vsl"],
            "dominant_narrative_structures": ["pas", "storytelling"],
            "audience_verbatim": ["gordura teimosa", "metabolismo lento", "tentei tudo"],
            "references_count": 23,
            "pending_knowledge_approval": [],
        },
        "strategy": {
            "creative_format": "ugc",
            "funnel_stage": "conversion",
            "campaign_objective": "conversions",
            "narrative_structure": "pas",
            "video_duration_seconds": 60,
            "aspect_ratios": ["9x16", "1x1"],
            "target_roas": 3.0,
            "min_ctr_percent": 1.5,
            "max_cpm_brl": 25.0,
            "max_cpa_brl": 60.0,
            "daily_budget_total_brl": 100.0,
            "budget_per_adset_brl": 33.33,
            "recommended_adsets": 3,
            "rationale": "UGC com PAS por alta concorrência e ângulo de autoridade traída.",
        },
        "scripts": {
            "scripts": [
                {
                    "script_id": "script-uuid-001",
                    "variant_id": "A",
                    "hook_text": "Médicos não querem que você saiba disso sobre o seu metabolismo",
                    "full_script": "Hook: Médicos não querem... [roteiro completo aqui]",
                    "scene_breakdown": [
                        {"scene_number": 1, "duration_seconds": 5, "description": "Mulher olhando espelho", "dialogue": "Médicos não querem...", "visual_direction": "close-up rosto surpreso"},
                        {"scene_number": 2, "duration_seconds": 8, "description": "Gráfico de metabolismo", "dialogue": "Seu metabolismo está...", "visual_direction": "infográfico animado"},
                    ],
                    "total_duration_seconds": 62,
                    "word_count": 180,
                }
            ],
            "selected_script_id": "script-uuid-001",
        },
        "copy": {
            "headlines": [
                {"text": "Queime gordura teimosa em 30 dias", "char_count": 36, "variant_id": "H1", "platform": "facebook"},
                {"text": "O segredo do metabolismo revelado", "char_count": 34, "variant_id": "H2", "platform": "facebook"},
            ],
            "body_copy_short": "Descubra o método que está ajudando mulheres a perder gordura teimosa sem dieta.",
            "body_copy_long": "Se você tentou de tudo e não consegue perder aquela gordura teimosa, saiba que existe um motivo científico para isso...",
            "cta_options": ["Quero conhecer", "Ver agora", "Saiba mais"],
            "selected_headline": "Queime gordura teimosa em 30 dias",
            "selected_body": "Descubra o método que está ajudando mulheres a perder gordura teimosa sem dieta.",
            "selected_cta": "Quero conhecer",
        },
        "character": {
            "character_asset_id": "char-asset-001",
            "character_url": "https://pub-r2.example.com/characters/char-001.png",
            "character_prompt_used": "Brazilian woman, 40 years old, friendly smile, casual clothes",
            "all_variations": [
                {"asset_id": "char-asset-001", "url": "https://pub-r2.example.com/characters/char-001.png", "selected": True}
            ],
        },
        "keyframes": {
            "keyframes": [
                {"asset_id": "kf-001", "scene_number": 1, "image_url": "https://pub-r2.example.com/keyframes/kf-001.png", "approved": True, "prompt_used": "woman looking at mirror, surprised"},
                {"asset_id": "kf-002", "scene_number": 2, "image_url": "https://pub-r2.example.com/keyframes/kf-002.png", "approved": True, "prompt_used": "metabolism infographic animated"},
            ],
        },
        "video_clips": {
            "clips": [
                {"asset_id": "clip-001", "scene_number": 1, "video_url": "https://pub-r2.example.com/clips/clip-001.mp4", "duration_seconds": 5, "approved": True},
                {"asset_id": "clip-002", "scene_number": 2, "video_url": "https://pub-r2.example.com/clips/clip-002.mp4", "duration_seconds": 8, "approved": True},
            ],
        },
        "final_creatives": {
            "creatives": [
                {
                    "asset_id": "creative-001",
                    "video_url": "https://pub-r2.example.com/creatives/final-9x16.mp4",
                    "aspect_ratio": "9x16",
                    "duration_seconds": 62,
                    "has_subtitles": True,
                    "has_narration": False,
                    "quality_score": 87,
                    "quality_passed": True,
                    "quality_issues": [],
                    "marketing_metadata": {
                        "angle_type": "betrayed_authority",
                        "hook_text": "Médicos não querem que você saiba disso",
                        "narrative_structure": "pas",
                        "format": "ugc",
                    },
                }
            ],
        },
        "compliance": {
            "facebook_approved": True,
            "google_approved": True,
            "issues": [],
            "overall_approved": True,
        },
        "tracking": {
            "utm_parameters": {
                "utm_source": "facebook",
                "utm_medium": "cpc",
                "utm_campaign": "detox-pro-ugc",
                "utm_content": "hook-autoridade-traida-v1",
            },
            "final_affiliate_url": "https://go.hotmart.com/abc123?utm_source=facebook&utm_medium=cpc",
        },
        "facebook_campaign": {
            "campaign_id": "fb-camp-001",
            "adset_ids": ["fb-adset-001", "fb-adset-002"],
            "ad_ids": ["fb-ad-001", "fb-ad-002"],
            "status": "paused",
            "launched_at": None,
        },
        "google_campaign": {
            "campaign_id": "gg-camp-001",
            "adgroup_ids": ["gg-ag-001"],
            "ad_ids": ["gg-ad-001"],
            "status": "paused",
            "launched_at": None,
        },
        "performance": {
            "last_analyzed_at": None,
            "metrics": {},
            "winning_asset_ids": [],
            "losing_asset_ids": [],
            "diagnosis": None,
            "recommended_action": None,
        },
        "execution_meta": {
            "total_cost_usd": 0.0,
            "total_tokens_used": 0,
            "nodes_completed": 0,
            "nodes_total": 18,
            "approval_pending_node": None,
            "quality_warnings": [],
            "last_error": None,
        },
    }


@pytest.fixture
def sample_state_partial() -> dict:
    """
    State com apenas 'product' preenchido — representa o estado inicial
    antes de qualquer agente ter rodado.
    """
    return {
        "product": {
            "name": "Suplemento Detox Pro",
            "niche": "emagrecimento",
            "platform": "hotmart",
            "product_url": "https://example.com/produto",
            "affiliate_link": "https://go.hotmart.com/abc123",
            "commission_percent": 40.0,
            "ticket_price": 197.0,
            "target_country": "BR",
            "target_language": "pt-BR",
            "budget_for_test": 300.0,
            "ad_platforms": ["facebook"],
            "vsl_url": "https://vturb.com/abc",
        }
    }


# ---------------------------------------------------------------------------
# Fixtures de mock de dependências externas
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_supabase():
    """
    Mock do cliente Supabase.
    Configura a cadeia de chamadas fluentes (table().select().eq().single().execute()).
    """
    with patch("app.database.get_supabase") as mock_get:
        client = MagicMock()
        mock_get.return_value = client

        # Configura execução padrão bem-sucedida
        execute_result = MagicMock()
        execute_result.data = [{"id": "test-id-123"}]

        # Encadeia: .table().select/update/insert().eq().single().execute()
        chain = MagicMock()
        chain.execute.return_value = execute_result
        chain.single.return_value = chain
        chain.eq.return_value = chain
        chain.select.return_value = chain
        chain.update.return_value = chain
        chain.insert.return_value = chain

        client.table.return_value = chain
        client.rpc.return_value = {"shared_state": {}}

        yield client


@pytest.fixture
def mock_r2_upload():
    """Mock do upload para R2. Retorna URL permanente fake."""
    with patch("app.storage.upload_file", new_callable=AsyncMock) as mock:
        mock.return_value = "https://pub-test-r2.example.com/test-folder/test-uuid.mp4"
        yield mock


@pytest.fixture
def mock_gemini_client():
    """Mock do cliente Gemini via patch no módulo genai."""
    with patch("google.genai.Client") as mock_class:
        mock_instance = MagicMock()
        mock_class.return_value = mock_instance
        yield mock_instance


@pytest.fixture
def mock_claude_response():
    """
    Fábrica de respostas mockadas do Claude.

    Uso:
        response = mock_claude_response("texto do output", input_tokens=500)
        response = mock_claude_response('{"key": "value"}', output_tokens=200)
    """
    def _make_response(
        text: str = "",
        input_tokens: int = 500,
        output_tokens: int = 300,
        stop_reason: str = "end_turn",
    ):
        response = MagicMock()
        response.content = [MagicMock(type="text", text=text)]
        response.usage.input_tokens = input_tokens
        response.usage.output_tokens = output_tokens
        response.stop_reason = stop_reason
        return response

    return _make_response
