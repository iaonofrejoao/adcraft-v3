"""
AdCraft — Shared State Pydantic Models
=======================================
Representação tipada do campo JSONB `shared_state` da tabela `executions`.

Cada agente lê e escreve em sub-objetos deste estado via ContextBuilder.
Os modelos aqui definidos são a **fonte de verdade** para validação,
serialização e documentação da estrutura de dados compartilhada.

Referência: PRD v1.0 — Seção 6 (Shared State Schema)
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ──────────────────────────────────────────────
# Enumerações
# ──────────────────────────────────────────────

class ExecutionStatus(str, Enum):
    """Status do ciclo de vida de uma execução."""
    PENDING = "pending"
    RUNNING = "running"
    PAUSED_FOR_APPROVAL = "paused_for_approval"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class AffiliatePlatform(str, Enum):
    """Plataformas de afiliado suportadas."""
    HOTMART = "hotmart"
    CLICKBANK = "clickbank"
    MONETIZZE = "monetizze"
    EDUZZ = "eduzz"


class OrchestratorBehavior(str, Enum):
    """Comportamento do orquestrador ao detectar produto inviável."""
    STOP = "stop"
    CONTINUE = "continue"
    AGENT_DECIDES = "agent_decides"


class VSLTranscriptionStatus(str, Enum):
    """Status da transcrição da VSL."""
    COMPLETED = "completed"
    MANUAL_UPLOAD_REQUIRED = "manual_upload_required"
    NOT_PROVIDED = "not_provided"


class ViabilityVerdict(str, Enum):
    """Veredito de viabilidade do mercado."""
    VIABLE = "viable"
    RISKY = "risky"
    NOT_VIABLE = "not_viable"


class CompetitionLevel(str, Enum):
    """Nível de concorrência no mercado."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    SATURATED = "saturated"


class TrendDirection(str, Enum):
    """Direção da tendência de mercado."""
    GROWING = "growing"
    STABLE = "stable"
    DECLINING = "declining"


class CreativeFormat(str, Enum):
    """Formato do criativo principal."""
    UGC = "ugc"
    VSL = "vsl"
    INTERVIEW = "interview"
    PODCAST = "podcast"
    DEMO = "demo"
    TESTIMONIAL = "testimonial"


class FunnelStage(str, Enum):
    """Estágio do funil de campanha."""
    AWARENESS = "awareness"
    CONSIDERATION = "consideration"
    CONVERSION = "conversion"


class CampaignObjective(str, Enum):
    """Objetivo da campanha de ads."""
    CONVERSIONS = "conversions"
    TRAFFIC = "traffic"
    LEADS = "leads"


class NarrativeStructure(str, Enum):
    """Estrutura narrativa do roteiro."""
    PAS = "pas"
    AIDA = "aida"
    BAB = "bab"
    STORYTELLING = "storytelling"
    DIRECT = "direct"


class CampaignStatus(str, Enum):
    """Status de campanha de ads."""
    ACTIVE = "active"
    PAUSED = "paused"


class ComplianceSeverity(str, Enum):
    """Severidade de issue de compliance."""
    WARNING = "warning"
    CRITICAL = "critical"


class RecommendedAction(str, Enum):
    """Ação recomendada pelo analista de performance."""
    SCALE = "scale"
    PAUSE = "pause"
    TEST_NEW_CREATIVE = "test_new_creative"
    ADJUST_AUDIENCE = "adjust_audience"


# ──────────────────────────────────────────────
# Sub-modelos: ProductInfo
# ──────────────────────────────────────────────

class ProductInfo(BaseModel):
    """Dados básicos do produto afiliado informados pelo operador."""

    name: str = Field(..., description="Nome comercial do produto")
    niche: str = Field(..., description="Nicho de mercado do produto")
    platform: AffiliatePlatform = Field(
        ..., description="Plataforma de afiliado onde o produto está hospedado"
    )
    product_url: str = Field(..., description="URL da página de vendas do produtor")
    affiliate_link: str = Field(..., description="Link de afiliado do operador")
    commission_percent: float = Field(
        ..., ge=0, le=100,
        description="Percentual de comissão do afiliado"
    )
    ticket_price: float = Field(
        ..., gt=0, description="Preço do produto em moeda local"
    )
    target_country: str = Field(
        default="BR", description="País-alvo da campanha (ISO 3166-1 alpha-2)"
    )
    target_language: str = Field(
        default="pt-BR", description="Idioma dos criativos e copies"
    )
    budget_for_test: float = Field(
        ..., gt=0, description="Budget total disponível para teste em moeda local"
    )
    ad_platforms: list[str] = Field(
        default_factory=lambda: ["facebook"],
        description="Plataformas de anúncio a utilizar (facebook, google)"
    )
    vsl_url: Optional[str] = Field(
        default=None, description="URL da VSL do produtor (se disponível)"
    )
    orchestrator_behavior_on_failure: OrchestratorBehavior = Field(
        default=OrchestratorBehavior.STOP,
        description="Comportamento do orquestrador quando produto é inviável"
    )


# ──────────────────────────────────────────────
# Sub-modelos: ProductAnalysis (Agente 1)
# ──────────────────────────────────────────────

class OfferDetails(BaseModel):
    """Detalhes da oferta extraídos da VSL / página de vendas."""

    price: float = Field(default=0.0, ge=0, description="Preço do produto")
    guarantee_days: int = Field(default=0, ge=0, description="Dias de garantia")
    bonuses: list[str] = Field(default_factory=list, description="Bônus oferecidos")
    cta_text: str = Field(default="", description="Texto do CTA principal da página")


class ProductAnalysis(BaseModel):
    """Resultado da análise da VSL e página de vendas pelo Agente 1."""

    main_promise: str = Field(
        default="", description="Transformação central prometida pelo produto"
    )
    avatar_description: str = Field(
        default="", description="Descrição do público-alvo na VSL do produtor"
    )
    pain_points_identified: list[str] = Field(
        default_factory=list, description="Dores identificadas na comunicação"
    )
    objections_broken: list[str] = Field(
        default_factory=list, description="Objeções que a VSL tenta quebrar"
    )
    hooks_used_in_vsl: list[str] = Field(
        default_factory=list, description="Frases de impacto encontradas na VSL"
    )
    offer_details: OfferDetails = Field(
        default_factory=OfferDetails, description="Detalhes estruturados da oferta"
    )
    narrative_structure: str = Field(
        default="", description="Arco emocional / estrutura narrativa da VSL"
    )
    vsl_transcription_status: VSLTranscriptionStatus = Field(
        default=VSLTranscriptionStatus.NOT_PROVIDED,
        description="Status da transcrição da VSL"
    )
    analysis_confidence: int = Field(
        default=0, ge=0, le=100,
        description="Confiança da análise (0-100)"
    )
    sources: list[str] = Field(
        default_factory=list,
        description="Fontes utilizadas (URLs ou 'vsl_transcript')"
    )


# ──────────────────────────────────────────────
# Sub-modelos: MarketAnalysis (Agente 2)
# ──────────────────────────────────────────────

class MarketAnalysis(BaseModel):
    """Resultado da análise de viabilidade de mercado pelo Agente 2."""

    viability_score: int = Field(
        default=0, ge=0, le=100,
        description="Score de viabilidade de 0 a 100"
    )
    viability_verdict: ViabilityVerdict = Field(
        default=ViabilityVerdict.RISKY,
        description="Veredito: viable, risky ou not_viable"
    )
    viability_justification: str = Field(
        default="", description="Justificativa textual do laudo de viabilidade"
    )
    competition_level: CompetitionLevel = Field(
        default=CompetitionLevel.MEDIUM,
        description="Nível de concorrência no nicho"
    )
    ads_running_count: int = Field(
        default=0, ge=0,
        description="Quantidade de anúncios ativos encontrados no nicho"
    )
    trend_direction: TrendDirection = Field(
        default=TrendDirection.STABLE,
        description="Direção da tendência de busca"
    )
    trend_source: str = Field(
        default="", description="Fonte da tendência (ex: Google Trends BR)"
    )
    estimated_margin_brl: float = Field(
        default=0.0, description="Margem estimada por venda em BRL"
    )
    market_warnings: list[str] = Field(
        default_factory=list, description="Alertas não bloqueantes sobre o mercado"
    )
    data_sources: list[str] = Field(
        default_factory=list, description="Fontes de dados consultadas"
    )


# ──────────────────────────────────────────────
# Sub-modelos: PersonaProfile (Agente 3)
# ──────────────────────────────────────────────

class PersonaFullProfile(BaseModel):
    """Perfil demográfico da persona."""

    fictional_name: str = Field(default="", description="Nome fictício da persona")
    age_range: str = Field(default="", description="Faixa etária (ex: 35-45)")
    gender: str = Field(default="", description="Gênero da persona")
    location: str = Field(default="", description="Localização geográfica")
    income_level: str = Field(default="", description="Nível de renda")
    education: str = Field(default="", description="Nível de escolaridade")
    occupation: str = Field(default="", description="Ocupação profissional")


class PersonaPsychographic(BaseModel):
    """Perfil psicográfico da persona."""

    primary_pain: str = Field(
        default="",
        description="Dor principal — em palavras do próprio público"
    )
    secondary_pains: list[str] = Field(
        default_factory=list, description="Dores secundárias"
    )
    primary_desire: str = Field(
        default="",
        description="Desejo principal — em palavras do próprio público"
    )
    secondary_desires: list[str] = Field(
        default_factory=list, description="Desejos secundários"
    )
    tried_before: list[str] = Field(
        default_factory=list,
        description="O que o público já tentou e não funcionou"
    )
    objections: list[str] = Field(
        default_factory=list,
        description="Razões de resistência à compra"
    )
    language_style: str = Field(
        default="", description="Estilo de linguagem do público (ex: informal)"
    )


class PersonaProfile(BaseModel):
    """Persona completa do comprador ideal construída pelo Agente 3."""

    summary: str = Field(
        default="",
        description="Versão comprimida (3-4 frases) para injeção de contexto"
    )
    full_profile: PersonaFullProfile = Field(
        default_factory=PersonaFullProfile,
        description="Perfil demográfico completo"
    )
    psychographic: PersonaPsychographic = Field(
        default_factory=PersonaPsychographic,
        description="Perfil psicográfico completo"
    )
    verbatim_expressions: list[str] = Field(
        default_factory=list,
        description="Frases reais extraídas de comentários e reviews"
    )
    data_sources: list[str] = Field(
        default_factory=list, description="URLs das fontes consultadas"
    )


# ──────────────────────────────────────────────
# Sub-modelos: AngleStrategy (Agente 4)
# ──────────────────────────────────────────────

class HookVariation(BaseModel):
    """Uma variação de hook para teste A/B."""

    hook_text: str = Field(..., description="Frase completa de abertura")
    hook_type: str = Field(
        default="question",
        description="Tipo do hook: question, shocking_statement, story, fact"
    )
    variant_id: str = Field(default="A", description="Identificador da variante")


class AngleStrategy(BaseModel):
    """Ângulo criativo e hooks definidos pelo Agente 4."""

    primary_angle: str = Field(
        default="", description="Descrição do ângulo criativo principal"
    )
    angle_type: str = Field(
        default="",
        description=(
            "Tipo do ângulo: betrayed_authority, transformation, "
            "social_proof, novelty, fear, curiosity, identification"
        )
    )
    usp: str = Field(
        default="",
        description="Unique Selling Proposition — diferencial no anúncio"
    )
    emotional_trigger: str = Field(
        default="", description="Emoção primária ativada pelo ângulo"
    )
    hooks: list[HookVariation] = Field(
        default_factory=list, description="Variações de hook para teste A/B"
    )
    selected_hook_variant: str = Field(
        default="A", description="Variante selecionada"
    )
    alternative_angles: list[str] = Field(
        default_factory=list,
        description="Ângulos descartados, preservados para uso futuro"
    )
    angle_rationale: str = Field(
        default="", description="Justificativa da seleção do ângulo"
    )


# ──────────────────────────────────────────────
# Sub-modelos: BenchmarkData (Agente 5)
# ──────────────────────────────────────────────

class BenchmarkHook(BaseModel):
    """Referência de hook encontrado em criativos vencedores."""

    hook_text: str = Field(default="", description="Texto do hook encontrado")
    source: str = Field(
        default="",
        description="Origem: facebook_ad ou youtube_video"
    )
    source_url: str = Field(default="", description="URL da referência")
    days_running: int = Field(
        default=0, ge=0, description="Dias que o anúncio está rodando"
    )
    format: str = Field(default="ugc", description="Formato do criativo")


class BenchmarkData(BaseModel):
    """Benchmark de criativos vencedores coletado pelo Agente 5."""

    top_hooks_found: list[BenchmarkHook] = Field(
        default_factory=list,
        description="Hooks encontrados em criativos vencedores"
    )
    dominant_formats: list[str] = Field(
        default_factory=list,
        description="Formatos dominantes encontrados (ugc, vsl, etc.)"
    )
    dominant_narrative_structures: list[str] = Field(
        default_factory=list,
        description="Estruturas narrativas dominantes (pas, storytelling, etc.)"
    )
    audience_verbatim: list[str] = Field(
        default_factory=list,
        description="Expressões reais do público extraídas de comentários"
    )
    references_count: int = Field(
        default=0, ge=0, description="Total de referências coletadas"
    )
    pending_knowledge_approval: list[str] = Field(
        default_factory=list,
        description="UUIDs de referências aguardando aprovação para a base de nicho"
    )


# ──────────────────────────────────────────────
# Sub-modelos: CampaignStrategy (Agente 6)
# ──────────────────────────────────────────────

class CampaignStrategy(BaseModel):
    """Estratégia de campanha definida pelo Agente 6."""

    creative_format: CreativeFormat = Field(
        default=CreativeFormat.UGC,
        description="Formato do criativo principal"
    )
    funnel_stage: FunnelStage = Field(
        default=FunnelStage.CONVERSION,
        description="Estágio do funil"
    )
    campaign_objective: CampaignObjective = Field(
        default=CampaignObjective.CONVERSIONS,
        description="Objetivo da campanha"
    )
    narrative_structure: NarrativeStructure = Field(
        default=NarrativeStructure.PAS,
        description="Estrutura narrativa do roteiro"
    )
    video_duration_seconds: int = Field(
        default=60, gt=0,
        description="Duração alvo do vídeo em segundos"
    )
    aspect_ratios: list[str] = Field(
        default_factory=lambda: ["9x16", "1x1"],
        description="Aspect ratios para exportação"
    )
    target_roas: float = Field(
        default=3.0, gt=0, description="ROAS alvo"
    )
    min_ctr_percent: float = Field(
        default=1.5, ge=0, description="CTR mínimo aceitável (%)"
    )
    max_cpm_brl: float = Field(
        default=25.0, ge=0, description="CPM máximo aceitável em BRL"
    )
    max_cpa_brl: float = Field(
        default=60.0, ge=0, description="CPA máximo aceitável em BRL"
    )
    daily_budget_total_brl: float = Field(
        default=100.0, ge=0, description="Budget diário total em BRL"
    )
    budget_per_adset_brl: float = Field(
        default=33.33, ge=0, description="Budget por conjunto de anúncio em BRL"
    )
    recommended_adsets: int = Field(
        default=3, ge=1, description="Quantidade de ad sets recomendados"
    )
    rationale: str = Field(
        default="", description="Justificativa das decisões estratégicas"
    )


# ──────────────────────────────────────────────
# Sub-modelos: Scripts (Agente 7)
# ──────────────────────────────────────────────

class SceneBreakdown(BaseModel):
    """Uma cena individual do roteiro."""

    scene_number: int = Field(..., ge=1, description="Número sequencial da cena")
    duration_seconds: int = Field(
        ..., gt=0, description="Duração da cena em segundos"
    )
    description: str = Field(
        default="", description="O que acontece visualmente na cena"
    )
    dialogue: str = Field(
        default="", description="O que é dito/narrado na cena"
    )
    visual_direction: str = Field(
        default="", description="Direção visual para geração de imagem"
    )


class ScriptItem(BaseModel):
    """Um roteiro completo com breakdown de cenas."""

    script_id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        description="Identificador único do roteiro"
    )
    variant_id: str = Field(default="A", description="Variante do hook utilizada")
    hook_text: str = Field(default="", description="Texto do hook deste roteiro")
    full_script: str = Field(default="", description="Roteiro completo em texto")
    scene_breakdown: list[SceneBreakdown] = Field(
        default_factory=list, description="Lista de cenas com timing"
    )
    total_duration_seconds: int = Field(
        default=0, ge=0, description="Duração total do roteiro em segundos"
    )
    word_count: int = Field(
        default=0, ge=0, description="Contagem de palavras do roteiro"
    )


class Scripts(BaseModel):
    """Roteiros e hooks gerados pelo Agente 7."""

    scripts: list[ScriptItem] = Field(
        default_factory=list, description="Lista de roteiros gerados"
    )
    selected_script_id: str = Field(
        default="", description="UUID do roteiro selecionado para produção"
    )


# ──────────────────────────────────────────────
# Sub-modelos: Copy (Agente 8)
# ──────────────────────────────────────────────

class HeadlineVariation(BaseModel):
    """Uma variação de headline para anúncio."""

    text: str = Field(..., description="Texto da headline")
    char_count: int = Field(default=0, ge=0, description="Contagem de caracteres")
    variant_id: str = Field(default="H1", description="Identificador da variante")
    platform: str = Field(default="facebook", description="Plataforma de destino")


class Copy(BaseModel):
    """Textos de anúncio gerados pelo Agente 8."""

    headlines: list[HeadlineVariation] = Field(
        default_factory=list, description="Variações de headline por plataforma"
    )
    body_copy_short: str = Field(
        default="", description="Body copy curta (até 125 caracteres)"
    )
    body_copy_long: str = Field(
        default="", description="Body copy longa (até 500 caracteres)"
    )
    cta_options: list[str] = Field(
        default_factory=list, description="Opções de CTA"
    )
    selected_headline: str = Field(
        default="", description="Headline selecionada para uso"
    )
    selected_body: str = Field(
        default="", description="Body copy selecionada para uso"
    )
    selected_cta: str = Field(
        default="", description="CTA selecionado para uso"
    )


# ──────────────────────────────────────────────
# Sub-modelos: Character (Agente 9)
# ──────────────────────────────────────────────

class CharacterVariation(BaseModel):
    """Uma variação de personagem gerada."""

    asset_id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        description="UUID do asset no R2"
    )
    url: str = Field(default="", description="URL permanente da imagem no R2")
    selected: bool = Field(default=False, description="Se esta variação foi selecionada")


class Character(BaseModel):
    """Personagem visual consistente gerada pelo Agente 9."""

    character_asset_id: str = Field(
        default="", description="UUID do asset selecionado"
    )
    character_url: str = Field(
        default="", description="URL permanente da imagem selecionada no R2"
    )
    character_prompt_used: str = Field(
        default="", description="Prompt utilizado para gerar a personagem"
    )
    all_variations: list[CharacterVariation] = Field(
        default_factory=list,
        description="Todas as variações geradas para seleção"
    )


# ──────────────────────────────────────────────
# Sub-modelos: Keyframes (Agente 10)
# ──────────────────────────────────────────────

class KeyframeItem(BaseModel):
    """Keyframe (primeiro frame) de uma cena."""

    asset_id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        description="UUID do asset no R2"
    )
    scene_number: int = Field(..., ge=1, description="Número da cena correspondente")
    image_url: str = Field(default="", description="URL da imagem no R2")
    approved: bool = Field(default=False, description="Se o keyframe foi aprovado")
    prompt_used: str = Field(
        default="", description="Prompt utilizado para geração"
    )


class Keyframes(BaseModel):
    """Keyframes de cada cena gerados pelo Agente 10."""

    keyframes: list[KeyframeItem] = Field(
        default_factory=list, description="Lista de keyframes por cena"
    )


# ──────────────────────────────────────────────
# Sub-modelos: VideoClips (Agente 11)
# ──────────────────────────────────────────────

class VideoClipItem(BaseModel):
    """Clipe de vídeo gerado para uma cena."""

    asset_id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        description="UUID do asset no R2"
    )
    scene_number: int = Field(..., ge=1, description="Número da cena correspondente")
    video_url: str = Field(default="", description="URL do vídeo no R2")
    duration_seconds: int = Field(
        default=0, gt=0, description="Duração do clipe em segundos"
    )
    approved: bool = Field(default=False, description="Se o clipe foi aprovado")


class VideoClips(BaseModel):
    """Clipes de vídeo por cena gerados pelo Agente 11."""

    clips: list[VideoClipItem] = Field(
        default_factory=list, description="Lista de clipes por cena"
    )


# ──────────────────────────────────────────────
# Sub-modelos: FinalCreatives (Agente 12)
# ──────────────────────────────────────────────

class MarketingMetadata(BaseModel):
    """Metadados de marketing do criativo para rastreamento e inteligência."""

    angle_type: str = Field(default="", description="Tipo de ângulo utilizado")
    emotional_trigger: str = Field(
        default="", description="Gatilho emocional ativado"
    )
    hook_text: str = Field(default="", description="Texto do hook usado")
    narrative_structure: str = Field(
        default="", description="Estrutura narrativa utilizada"
    )
    format: str = Field(default="", description="Formato do criativo")
    duration_seconds: int = Field(
        default=0, ge=0, description="Duração do vídeo final"
    )
    pain_addressed: str = Field(
        default="", description="Dor principal endereçada"
    )
    cta_text: str = Field(default="", description="Texto do CTA utilizado")
    confidence_score: int = Field(
        default=0, ge=0, le=100,
        description="Score de confiança do criativo (0-100)"
    )


class CreativeItem(BaseModel):
    """Um criativo final renderizado e pronto para publicação."""

    asset_id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        description="UUID do asset no R2"
    )
    video_url: str = Field(default="", description="URL do vídeo final no R2")
    aspect_ratio: str = Field(default="9x16", description="Aspect ratio do export")
    duration_seconds: int = Field(
        default=0, ge=0, description="Duração do vídeo em segundos"
    )
    has_subtitles: bool = Field(default=False, description="Se possui legendas")
    has_narration: bool = Field(default=False, description="Se possui narração")
    quality_score: int = Field(
        default=0, ge=0, le=100, description="Score de qualidade (0-100)"
    )
    quality_passed: bool = Field(
        default=False, description="Se passou na validação de qualidade"
    )
    quality_issues: list[str] = Field(
        default_factory=list, description="Issues de qualidade encontrados"
    )
    marketing_metadata: MarketingMetadata = Field(
        default_factory=MarketingMetadata,
        description="Metadados de marketing para rastreamento"
    )


class FinalCreatives(BaseModel):
    """Criativos finais renderizados pelo Agente 12 (Diretor)."""

    creatives: list[CreativeItem] = Field(
        default_factory=list, description="Lista de criativos finais"
    )


# ──────────────────────────────────────────────
# Sub-modelos: Compliance (Agente 13)
# ──────────────────────────────────────────────

class ComplianceIssue(BaseModel):
    """Um issue de compliance encontrado na verificação."""

    severity: ComplianceSeverity = Field(
        ..., description="Severidade: warning ou critical"
    )
    element: str = Field(
        default="", description="Elemento afetado: headline, body, video"
    )
    description: str = Field(default="", description="Descrição do problema")
    suggestion: str = Field(
        default="", description="Sugestão de como corrigir"
    )


class Compliance(BaseModel):
    """Resultado da verificação de compliance pelo Agente 13."""

    facebook_approved: bool = Field(
        default=False, description="Se aprovado pelas políticas do Facebook"
    )
    google_approved: bool = Field(
        default=False, description="Se aprovado pelas políticas do Google"
    )
    issues: list[ComplianceIssue] = Field(
        default_factory=list, description="Issues encontrados"
    )
    overall_approved: bool = Field(
        default=False, description="Se aprovado para lançamento"
    )


# ──────────────────────────────────────────────
# Sub-modelos: Tracking (Agente 14)
# ──────────────────────────────────────────────

class UTMParameters(BaseModel):
    """Parâmetros UTM para rastreamento."""

    utm_source: str = Field(default="facebook", description="Fonte do tráfego")
    utm_medium: str = Field(default="cpc", description="Meio de aquisição")
    utm_campaign: str = Field(default="", description="Nome da campanha UTM")
    utm_content: str = Field(default="", description="Conteúdo/variação do anúncio")


class Tracking(BaseModel):
    """Link de afiliado com UTMs gerado pelo Agente 14."""

    utm_parameters: UTMParameters = Field(
        default_factory=UTMParameters,
        description="Parâmetros UTM estruturados"
    )
    final_affiliate_url: str = Field(
        default="", description="Link completo do afiliado com UTMs"
    )


# ──────────────────────────────────────────────
# Sub-modelos: FacebookCampaign (Agente 15)
# ──────────────────────────────────────────────

class FacebookCampaign(BaseModel):
    """Campanha do Facebook Ads criada pelo Agente 15."""

    campaign_id: str = Field(default="", description="ID da campanha no Meta Ads")
    adset_ids: list[str] = Field(
        default_factory=list, description="IDs dos conjuntos de anúncio"
    )
    ad_ids: list[str] = Field(
        default_factory=list, description="IDs dos anúncios"
    )
    status: CampaignStatus = Field(
        default=CampaignStatus.PAUSED, description="Status da campanha"
    )
    launched_at: Optional[datetime] = Field(
        default=None, description="Timestamp de ativação (ISO8601)"
    )


# ──────────────────────────────────────────────
# Sub-modelos: GoogleCampaign (Agente 16)
# ──────────────────────────────────────────────

class GoogleCampaign(BaseModel):
    """Campanha do Google Ads criada pelo Agente 16."""

    campaign_id: str = Field(default="", description="ID da campanha no Google Ads")
    adgroup_ids: list[str] = Field(
        default_factory=list, description="IDs dos grupos de anúncio"
    )
    ad_ids: list[str] = Field(
        default_factory=list, description="IDs dos anúncios"
    )
    status: CampaignStatus = Field(
        default=CampaignStatus.PAUSED, description="Status da campanha"
    )
    launched_at: Optional[datetime] = Field(
        default=None, description="Timestamp de ativação (ISO8601)"
    )


# ──────────────────────────────────────────────
# Sub-modelos: Performance (Agente 17)
# ──────────────────────────────────────────────

class PerformanceMetrics(BaseModel):
    """Métricas de performance das campanhas de ads."""

    spend_brl: float = Field(default=0.0, ge=0, description="Gasto total em BRL")
    impressions: int = Field(default=0, ge=0, description="Total de impressões")
    clicks: int = Field(default=0, ge=0, description="Total de cliques")
    ctr: float = Field(default=0.0, ge=0, description="Click-through rate (%)")
    cpc_brl: float = Field(default=0.0, ge=0, description="Custo por clique em BRL")
    cpm_brl: float = Field(default=0.0, ge=0, description="CPM em BRL")
    conversions: int = Field(default=0, ge=0, description="Total de conversões")
    roas: float = Field(default=0.0, ge=0, description="Return on ad spend")
    cpa_brl: float = Field(default=0.0, ge=0, description="Custo por aquisição em BRL")


class NextExecutionSuggestion(BaseModel):
    """Sugestão do analista para a próxima execução composta."""

    copy_from_execution_id: Optional[str] = Field(
        default=None, description="UUID de execução para reutilizar copy"
    )
    character_from_execution_id: Optional[str] = Field(
        default=None, description="UUID de execução para reutilizar personagem"
    )
    hook_variant: Optional[str] = Field(
        default=None, description="Variante de hook sugerida"
    )
    rationale: str = Field(
        default="", description="Justificativa da sugestão"
    )


class Performance(BaseModel):
    """Análise de performance das campanhas pelo Agente 17."""

    last_analyzed_at: Optional[datetime] = Field(
        default=None, description="Timestamp da última análise"
    )
    metrics: PerformanceMetrics = Field(
        default_factory=PerformanceMetrics,
        description="Métricas consolidadas"
    )
    winning_asset_ids: list[str] = Field(
        default_factory=list,
        description="UUIDs dos ativos vencedores"
    )
    losing_asset_ids: list[str] = Field(
        default_factory=list,
        description="UUIDs dos ativos perdedores"
    )
    diagnosis: str = Field(
        default="", description="Diagnóstico da performance"
    )
    recommended_action: RecommendedAction = Field(
        default=RecommendedAction.PAUSE,
        description="Ação recomendada"
    )
    next_execution_suggestion: NextExecutionSuggestion = Field(
        default_factory=NextExecutionSuggestion,
        description="Sugestão de nova execução composta"
    )


# ──────────────────────────────────────────────
# Sub-modelos: ExecutionMeta
# ──────────────────────────────────────────────

class QualityWarning(BaseModel):
    """Aviso de qualidade emitido por um agente."""

    agent: str = Field(default="", description="Nome do agente que emitiu")
    message: str = Field(default="", description="Mensagem de aviso")


class LastError(BaseModel):
    """Último erro ocorrido durante a execução."""

    node: str = Field(default="", description="Nó onde ocorreu o erro")
    error_type: str = Field(default="", description="Tipo de erro")
    message: str = Field(default="", description="Mensagem de erro")
    timestamp: Optional[datetime] = Field(
        default=None, description="Quando o erro ocorreu"
    )


class ExecutionMeta(BaseModel):
    """Metadados operacionais da execução."""

    total_cost_usd: float = Field(
        default=0.0, ge=0,
        description="Custo total da execução em USD (APIs de IA)"
    )
    total_tokens_used: int = Field(
        default=0, ge=0, description="Total de tokens consumidos"
    )
    nodes_completed: int = Field(
        default=0, ge=0, description="Quantidade de nós já concluídos"
    )
    nodes_total: int = Field(
        default=18, ge=0, description="Quantidade total de nós no template"
    )
    approval_pending_node: Optional[str] = Field(
        default=None,
        description="Nome do nó aguardando aprovação humana"
    )
    quality_warnings: list[QualityWarning] = Field(
        default_factory=list,
        description="Avisos de qualidade emitidos pelos agentes"
    )
    last_error: Optional[LastError] = Field(
        default=None, description="Último erro ocorrido"
    )


# ──────────────────────────────────────────────
# Modelo raiz: ExecutionState
# ──────────────────────────────────────────────

class ExecutionState(BaseModel):
    """
    Shared state completo de uma execução.

    Este é o registro JSONB armazenado na coluna `shared_state` da tabela
    `executions`. Cada agente lê e escreve em sub-objetos deste estado.

    O ContextBuilder extrai apenas os campos necessários para cada agente
    antes de cada chamada, garantindo contexto mínimo conforme regra global.
    """

    model_config = {"populate_by_name": True}

    # Identificadores da execução
    execution_id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        description="UUID da execução"
    )
    project_id: str = Field(
        default="", description="UUID do projeto"
    )
    template_id: str = Field(
        default="", description="UUID do template de fluxo utilizado"
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        description="Timestamp de criação"
    )
    status: ExecutionStatus = Field(
        default=ExecutionStatus.PENDING,
        description="Status do ciclo de vida da execução"
    )

    # Sub-estados dos agentes (populados sequencialmente)
    product: Optional[ProductInfo] = Field(
        default=None,
        description="Dados do produto informados pelo operador"
    )
    product_analysis: ProductAnalysis = Field(
        default_factory=ProductAnalysis,
        description="Análise da VSL e página — Agente 1"
    )
    market: MarketAnalysis = Field(
        default_factory=MarketAnalysis,
        description="Análise de viabilidade de mercado — Agente 2"
    )
    persona: PersonaProfile = Field(
        default_factory=PersonaProfile,
        description="Persona do comprador ideal — Agente 3"
    )
    angle: AngleStrategy = Field(
        default_factory=AngleStrategy,
        description="Ângulo criativo e hooks — Agente 4"
    )
    benchmark: BenchmarkData = Field(
        default_factory=BenchmarkData,
        description="Benchmark de criativos vencedores — Agente 5"
    )
    strategy: CampaignStrategy = Field(
        default_factory=CampaignStrategy,
        description="Estratégia de campanha — Agente 6"
    )
    scripts: Scripts = Field(
        default_factory=Scripts,
        description="Roteiros e hooks — Agente 7"
    )
    copy: Copy = Field(
        default_factory=Copy,
        description="Textos de anúncio — Agente 8"
    )
    character: Character = Field(
        default_factory=Character,
        description="Personagem visual — Agente 9"
    )
    keyframes: Keyframes = Field(
        default_factory=Keyframes,
        description="Keyframes por cena — Agente 10"
    )
    video_clips: VideoClips = Field(
        default_factory=VideoClips,
        description="Clipes de vídeo — Agente 11"
    )
    final_creatives: FinalCreatives = Field(
        default_factory=FinalCreatives,
        description="Criativos finais — Agente 12"
    )
    compliance: Compliance = Field(
        default_factory=Compliance,
        description="Verificação de compliance — Agente 13"
    )
    tracking: Tracking = Field(
        default_factory=Tracking,
        description="UTM e link de afiliado — Agente 14"
    )
    facebook_campaign: FacebookCampaign = Field(
        default_factory=FacebookCampaign,
        description="Campanha Facebook Ads — Agente 15"
    )
    google_campaign: GoogleCampaign = Field(
        default_factory=GoogleCampaign,
        description="Campanha Google Ads — Agente 16"
    )
    performance: Performance = Field(
        default_factory=Performance,
        description="Análise de performance — Agente 17"
    )
    execution_meta: ExecutionMeta = Field(
        default_factory=ExecutionMeta,
        description="Metadados operacionais da execução"
    )
