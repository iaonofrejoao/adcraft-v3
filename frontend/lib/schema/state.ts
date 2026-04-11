import { z } from "zod";

// ──────────────────────────────────────────────
// Enumerações
// ──────────────────────────────────────────────

export const ExecutionStatusEnum = z.enum([
  "pending",
  "running",
  "paused_for_approval",
  "completed",
  "failed",
  "cancelled",
]);
export type ExecutionStatus = z.infer<typeof ExecutionStatusEnum>;

export const AffiliatePlatformEnum = z.enum(["hotmart", "clickbank", "monetizze", "eduzz"]);
export type AffiliatePlatform = z.infer<typeof AffiliatePlatformEnum>;

export const OrchestratorBehaviorEnum = z.enum(["stop", "continue", "agent_decides"]);
export type OrchestratorBehavior = z.infer<typeof OrchestratorBehaviorEnum>;

export const VSLTranscriptionStatusEnum = z.enum([
  "completed",
  "manual_upload_required",
  "not_provided",
]);
export type VSLTranscriptionStatus = z.infer<typeof VSLTranscriptionStatusEnum>;

export const ViabilityVerdictEnum = z.enum(["viable", "risky", "not_viable"]);
export type ViabilityVerdict = z.infer<typeof ViabilityVerdictEnum>;

export const CompetitionLevelEnum = z.enum(["low", "medium", "high", "saturated"]);
export type CompetitionLevel = z.infer<typeof CompetitionLevelEnum>;

export const TrendDirectionEnum = z.enum(["growing", "stable", "declining"]);
export type TrendDirection = z.infer<typeof TrendDirectionEnum>;

export const CreativeFormatEnum = z.enum([
  "ugc",
  "vsl",
  "interview",
  "podcast",
  "demo",
  "testimonial",
]);
export type CreativeFormat = z.infer<typeof CreativeFormatEnum>;

export const FunnelStageEnum = z.enum(["awareness", "consideration", "conversion"]);
export type FunnelStage = z.infer<typeof FunnelStageEnum>;

export const CampaignObjectiveEnum = z.enum(["conversions", "traffic", "leads"]);
export type CampaignObjective = z.infer<typeof CampaignObjectiveEnum>;

export const NarrativeStructureEnum = z.enum([
  "pas",
  "aida",
  "bab",
  "storytelling",
  "direct",
]);
export type NarrativeStructure = z.infer<typeof NarrativeStructureEnum>;

export const CampaignStatusEnum = z.enum(["active", "paused"]);
export type CampaignStatus = z.infer<typeof CampaignStatusEnum>;

export const ComplianceSeverityEnum = z.enum(["warning", "critical"]);
export type ComplianceSeverity = z.infer<typeof ComplianceSeverityEnum>;

export const RecommendedActionEnum = z.enum([
  "scale",
  "pause",
  "test_new_creative",
  "adjust_audience",
]);
export type RecommendedAction = z.infer<typeof RecommendedActionEnum>;

// ──────────────────────────────────────────────
// Sub-modelos: ProductInfo
// ──────────────────────────────────────────────

export const ProductInfoSchema = z.object({
  name: z.string(),
  niche: z.string(),
  platform: AffiliatePlatformEnum,
  product_url: z.string(),
  affiliate_link: z.string(),
  commission_percent: z.number().min(0).max(100),
  ticket_price: z.number().positive(),
  target_country: z.string().default("BR"),
  target_language: z.string().default("pt-BR"),
  budget_for_test: z.number().positive(),
  ad_platforms: z.array(z.string()).default(["facebook"]),
  vsl_url: z.string().nullable().default(null),
  orchestrator_behavior_on_failure: OrchestratorBehaviorEnum.default("stop"),
});
export type ProductInfo = z.infer<typeof ProductInfoSchema>;

// ──────────────────────────────────────────────
// Sub-modelos: ProductAnalysis (Agente 1)
// ──────────────────────────────────────────────

export const OfferDetailsSchema = z.object({
  price: z.number().min(0).default(0.0),
  guarantee_days: z.number().min(0).default(0),
  bonuses: z.array(z.string()).default([]),
  cta_text: z.string().default(""),
});
export type OfferDetails = z.infer<typeof OfferDetailsSchema>;

export const ProductAnalysisSchema = z.object({
  main_promise: z.string().default(""),
  avatar_description: z.string().default(""),
  pain_points_identified: z.array(z.string()).default([]),
  objections_broken: z.array(z.string()).default([]),
  hooks_used_in_vsl: z.array(z.string()).default([]),
  offer_details: OfferDetailsSchema.default({}),
  narrative_structure: z.string().default(""),
  vsl_transcription_status: VSLTranscriptionStatusEnum.default("not_provided"),
  analysis_confidence: z.number().min(0).max(100).default(0),
  sources: z.array(z.string()).default([]),
});
export type ProductAnalysis = z.infer<typeof ProductAnalysisSchema>;

// ──────────────────────────────────────────────
// Sub-modelos: MarketAnalysis (Agente 2)
// ──────────────────────────────────────────────

export const MarketAnalysisSchema = z.object({
  viability_score: z.number().min(0).max(100).default(0),
  viability_verdict: ViabilityVerdictEnum.default("risky"),
  viability_justification: z.string().default(""),
  competition_level: CompetitionLevelEnum.default("medium"),
  ads_running_count: z.number().min(0).default(0),
  trend_direction: TrendDirectionEnum.default("stable"),
  trend_source: z.string().default(""),
  estimated_margin_brl: z.number().default(0.0),
  market_warnings: z.array(z.string()).default([]),
  data_sources: z.array(z.string()).default([]),
});
export type MarketAnalysis = z.infer<typeof MarketAnalysisSchema>;

// ──────────────────────────────────────────────
// Sub-modelos: PersonaProfile (Agente 3)
// ──────────────────────────────────────────────

export const PersonaFullProfileSchema = z.object({
  fictional_name: z.string().default(""),
  age_range: z.string().default(""),
  gender: z.string().default(""),
  location: z.string().default(""),
  income_level: z.string().default(""),
  education: z.string().default(""),
  occupation: z.string().default(""),
});
export type PersonaFullProfile = z.infer<typeof PersonaFullProfileSchema>;

export const PersonaPsychographicSchema = z.object({
  primary_pain: z.string().default(""),
  secondary_pains: z.array(z.string()).default([]),
  primary_desire: z.string().default(""),
  secondary_desires: z.array(z.string()).default([]),
  tried_before: z.array(z.string()).default([]),
  objections: z.array(z.string()).default([]),
  language_style: z.string().default(""),
});
export type PersonaPsychographic = z.infer<typeof PersonaPsychographicSchema>;

export const PersonaProfileSchema = z.object({
  summary: z.string().default(""),
  full_profile: PersonaFullProfileSchema.default({}),
  psychographic: PersonaPsychographicSchema.default({}),
  verbatim_expressions: z.array(z.string()).default([]),
  data_sources: z.array(z.string()).default([]),
});
export type PersonaProfile = z.infer<typeof PersonaProfileSchema>;

// ──────────────────────────────────────────────
// Sub-modelos: AngleStrategy (Agente 4)
// ──────────────────────────────────────────────

export const HookVariationSchema = z.object({
  hook_text: z.string(),
  hook_type: z.string().default("question"),
  variant_id: z.string().default("A"),
});
export type HookVariation = z.infer<typeof HookVariationSchema>;

export const AngleStrategySchema = z.object({
  primary_angle: z.string().default(""),
  angle_type: z.string().default(""),
  usp: z.string().default(""),
  emotional_trigger: z.string().default(""),
  hooks: z.array(HookVariationSchema).default([]),
  selected_hook_variant: z.string().default("A"),
  alternative_angles: z.array(z.string()).default([]),
  angle_rationale: z.string().default(""),
});
export type AngleStrategy = z.infer<typeof AngleStrategySchema>;

// ──────────────────────────────────────────────
// Sub-modelos: BenchmarkData (Agente 5)
// ──────────────────────────────────────────────

export const BenchmarkHookSchema = z.object({
  hook_text: z.string().default(""),
  source: z.string().default(""),
  source_url: z.string().default(""),
  days_running: z.number().min(0).default(0),
  format: z.string().default("ugc"),
});
export type BenchmarkHook = z.infer<typeof BenchmarkHookSchema>;

export const BenchmarkDataSchema = z.object({
  top_hooks_found: z.array(BenchmarkHookSchema).default([]),
  dominant_formats: z.array(z.string()).default([]),
  dominant_narrative_structures: z.array(z.string()).default([]),
  audience_verbatim: z.array(z.string()).default([]),
  references_count: z.number().min(0).default(0),
  pending_knowledge_approval: z.array(z.string()).default([]),
});
export type BenchmarkData = z.infer<typeof BenchmarkDataSchema>;

// ──────────────────────────────────────────────
// Sub-modelos: CampaignStrategy (Agente 6)
// ──────────────────────────────────────────────

export const CampaignStrategySchema = z.object({
  creative_format: CreativeFormatEnum.default("ugc"),
  funnel_stage: FunnelStageEnum.default("conversion"),
  campaign_objective: CampaignObjectiveEnum.default("conversions"),
  narrative_structure: NarrativeStructureEnum.default("pas"),
  video_duration_seconds: z.number().positive().default(60),
  aspect_ratios: z.array(z.string()).default(["9x16", "1x1"]),
  target_roas: z.number().positive().default(3.0),
  min_ctr_percent: z.number().min(0).default(1.5),
  max_cpm_brl: z.number().min(0).default(25.0),
  max_cpa_brl: z.number().min(0).default(60.0),
  daily_budget_total_brl: z.number().min(0).default(100.0),
  budget_per_adset_brl: z.number().min(0).default(33.33),
  recommended_adsets: z.number().min(1).default(3),
  rationale: z.string().default(""),
});
export type CampaignStrategy = z.infer<typeof CampaignStrategySchema>;

// ──────────────────────────────────────────────
// Sub-modelos: Scripts (Agente 7)
// ──────────────────────────────────────────────

export const SceneBreakdownSchema = z.object({
  scene_number: z.number().min(1),
  duration_seconds: z.number().positive(),
  description: z.string().default(""),
  dialogue: z.string().default(""),
  visual_direction: z.string().default(""),
});
export type SceneBreakdown = z.infer<typeof SceneBreakdownSchema>;

export const ScriptItemSchema = z.object({
  script_id: z.string().uuid(),
  variant_id: z.string().default("A"),
  hook_text: z.string().default(""),
  full_script: z.string().default(""),
  scene_breakdown: z.array(SceneBreakdownSchema).default([]),
  total_duration_seconds: z.number().min(0).default(0),
  word_count: z.number().min(0).default(0),
});
export type ScriptItem = z.infer<typeof ScriptItemSchema>;

export const ScriptsSchema = z.object({
  scripts: z.array(ScriptItemSchema).default([]),
  selected_script_id: z.string().default(""),
});
export type Scripts = z.infer<typeof ScriptsSchema>;

// ──────────────────────────────────────────────
// Sub-modelos: Copy (Agente 8)
// ──────────────────────────────────────────────

export const HeadlineVariationSchema = z.object({
  text: z.string(),
  char_count: z.number().min(0).default(0),
  variant_id: z.string().default("H1"),
  platform: z.string().default("facebook"),
});
export type HeadlineVariation = z.infer<typeof HeadlineVariationSchema>;

export const CopySchema = z.object({
  headlines: z.array(HeadlineVariationSchema).default([]),
  body_copy_short: z.string().default(""),
  body_copy_long: z.string().default(""),
  cta_options: z.array(z.string()).default([]),
  selected_headline: z.string().default(""),
  selected_body: z.string().default(""),
  selected_cta: z.string().default(""),
});
export type Copy = z.infer<typeof CopySchema>;

// ──────────────────────────────────────────────
// Sub-modelos: Character (Agente 9)
// ──────────────────────────────────────────────

export const CharacterVariationSchema = z.object({
  asset_id: z.string().uuid(),
  url: z.string().default(""),
  selected: z.boolean().default(false),
});
export type CharacterVariation = z.infer<typeof CharacterVariationSchema>;

export const CharacterSchema = z.object({
  character_asset_id: z.string().default(""),
  character_url: z.string().default(""),
  character_prompt_used: z.string().default(""),
  all_variations: z.array(CharacterVariationSchema).default([]),
});
export type Character = z.infer<typeof CharacterSchema>;

// ──────────────────────────────────────────────
// Sub-modelos: Keyframes (Agente 10)
// ──────────────────────────────────────────────

export const KeyframeItemSchema = z.object({
  asset_id: z.string().uuid(),
  scene_number: z.number().min(1),
  image_url: z.string().default(""),
  approved: z.boolean().default(false),
  prompt_used: z.string().default(""),
});
export type KeyframeItem = z.infer<typeof KeyframeItemSchema>;

export const KeyframesSchema = z.object({
  keyframes: z.array(KeyframeItemSchema).default([]),
});
export type Keyframes = z.infer<typeof KeyframesSchema>;

// ──────────────────────────────────────────────
// Sub-modelos: VideoClips (Agente 11)
// ──────────────────────────────────────────────

export const VideoClipItemSchema = z.object({
  asset_id: z.string().uuid(),
  scene_number: z.number().min(1),
  video_url: z.string().default(""),
  duration_seconds: z.number().positive().default(0),
  approved: z.boolean().default(false),
});
export type VideoClipItem = z.infer<typeof VideoClipItemSchema>;

export const VideoClipsSchema = z.object({
  clips: z.array(VideoClipItemSchema).default([]),
});
export type VideoClips = z.infer<typeof VideoClipsSchema>;

// ──────────────────────────────────────────────
// Sub-modelos: FinalCreatives (Agente 12)
// ──────────────────────────────────────────────

export const MarketingMetadataSchema = z.object({
  angle_type: z.string().default(""),
  emotional_trigger: z.string().default(""),
  hook_text: z.string().default(""),
  narrative_structure: z.string().default(""),
  format: z.string().default(""),
  duration_seconds: z.number().min(0).default(0),
  pain_addressed: z.string().default(""),
  cta_text: z.string().default(""),
  confidence_score: z.number().min(0).max(100).default(0),
});
export type MarketingMetadata = z.infer<typeof MarketingMetadataSchema>;

export const CreativeItemSchema = z.object({
  asset_id: z.string().uuid(),
  video_url: z.string().default(""),
  aspect_ratio: z.string().default("9x16"),
  duration_seconds: z.number().min(0).default(0),
  has_subtitles: z.boolean().default(false),
  has_narration: z.boolean().default(false),
  quality_score: z.number().min(0).max(100).default(0),
  quality_passed: z.boolean().default(false),
  quality_issues: z.array(z.string()).default([]),
  marketing_metadata: MarketingMetadataSchema.default({}),
});
export type CreativeItem = z.infer<typeof CreativeItemSchema>;

export const FinalCreativesSchema = z.object({
  creatives: z.array(CreativeItemSchema).default([]),
});
export type FinalCreatives = z.infer<typeof FinalCreativesSchema>;

// ──────────────────────────────────────────────
// Sub-modelos: Compliance (Agente 13)
// ──────────────────────────────────────────────

export const ComplianceIssueSchema = z.object({
  severity: ComplianceSeverityEnum,
  element: z.string().default(""),
  description: z.string().default(""),
  suggestion: z.string().default(""),
});
export type ComplianceIssue = z.infer<typeof ComplianceIssueSchema>;

export const ComplianceSchema = z.object({
  facebook_approved: z.boolean().default(false),
  google_approved: z.boolean().default(false),
  issues: z.array(ComplianceIssueSchema).default([]),
  overall_approved: z.boolean().default(false),
});
export type Compliance = z.infer<typeof ComplianceSchema>;

// ──────────────────────────────────────────────
// Sub-modelos: Tracking (Agente 14)
// ──────────────────────────────────────────────

export const UTMParametersSchema = z.object({
  utm_source: z.string().default("facebook"),
  utm_medium: z.string().default("cpc"),
  utm_campaign: z.string().default(""),
  utm_content: z.string().default(""),
});
export type UTMParameters = z.infer<typeof UTMParametersSchema>;

export const TrackingSchema = z.object({
  utm_parameters: UTMParametersSchema.default({}),
  final_affiliate_url: z.string().default(""),
});
export type Tracking = z.infer<typeof TrackingSchema>;

// ──────────────────────────────────────────────
// Sub-modelos: FacebookCampaign (Agente 15)
// ──────────────────────────────────────────────

export const FacebookCampaignSchema = z.object({
  campaign_id: z.string().default(""),
  adset_ids: z.array(z.string()).default([]),
  ad_ids: z.array(z.string()).default([]),
  status: CampaignStatusEnum.default("paused"),
  launched_at: z.string().nullable().default(null),
});
export type FacebookCampaign = z.infer<typeof FacebookCampaignSchema>;

// ──────────────────────────────────────────────
// Sub-modelos: GoogleCampaign (Agente 16)
// ──────────────────────────────────────────────

export const GoogleCampaignSchema = z.object({
  campaign_id: z.string().default(""),
  adgroup_ids: z.array(z.string()).default([]),
  ad_ids: z.array(z.string()).default([]),
  status: CampaignStatusEnum.default("paused"),
  launched_at: z.string().nullable().default(null),
});
export type GoogleCampaign = z.infer<typeof GoogleCampaignSchema>;

// ──────────────────────────────────────────────
// Sub-modelos: Performance (Agente 17)
// ──────────────────────────────────────────────

export const PerformanceMetricsSchema = z.object({
  spend_brl: z.number().min(0).default(0.0),
  impressions: z.number().min(0).default(0),
  clicks: z.number().min(0).default(0),
  ctr: z.number().min(0).default(0.0),
  cpc_brl: z.number().min(0).default(0.0),
  cpm_brl: z.number().min(0).default(0.0),
  conversions: z.number().min(0).default(0),
  roas: z.number().min(0).default(0.0),
  cpa_brl: z.number().min(0).default(0.0),
});
export type PerformanceMetrics = z.infer<typeof PerformanceMetricsSchema>;

export const NextExecutionSuggestionSchema = z.object({
  copy_from_execution_id: z.string().nullable().default(null),
  character_from_execution_id: z.string().nullable().default(null),
  hook_variant: z.string().nullable().default(null),
  rationale: z.string().default(""),
});
export type NextExecutionSuggestion = z.infer<typeof NextExecutionSuggestionSchema>;

export const PerformanceSchema = z.object({
  last_analyzed_at: z.string().nullable().default(null),
  metrics: PerformanceMetricsSchema.default({}),
  winning_asset_ids: z.array(z.string()).default([]),
  losing_asset_ids: z.array(z.string()).default([]),
  diagnosis: z.string().default(""),
  recommended_action: RecommendedActionEnum.default("pause"),
  next_execution_suggestion: NextExecutionSuggestionSchema.default({}),
});
export type Performance = z.infer<typeof PerformanceSchema>;

// ──────────────────────────────────────────────
// Sub-modelos: ExecutionMeta
// ──────────────────────────────────────────────

export const QualityWarningSchema = z.object({
  agent: z.string().default(""),
  message: z.string().default(""),
});
export type QualityWarning = z.infer<typeof QualityWarningSchema>;

export const LastErrorSchema = z.object({
  node: z.string().default(""),
  error_type: z.string().default(""),
  message: z.string().default(""),
  timestamp: z.string().nullable().default(null),
});
export type LastError = z.infer<typeof LastErrorSchema>;

export const ExecutionMetaSchema = z.object({
  total_cost_usd: z.number().min(0).default(0.0),
  total_tokens_used: z.number().min(0).default(0),
  nodes_completed: z.number().min(0).default(0),
  nodes_total: z.number().min(0).default(18),
  approval_pending_node: z.string().nullable().default(null),
  quality_warnings: z.array(QualityWarningSchema).default([]),
  last_error: LastErrorSchema.nullable().default(null),
});
export type ExecutionMeta = z.infer<typeof ExecutionMetaSchema>;

// ──────────────────────────────────────────────
// Modelo raiz: ExecutionState
// ──────────────────────────────────────────────

export const ExecutionStateSchema = z.object({
  execution_id: z.string().uuid(),
  project_id: z.string().default(""),
  template_id: z.string().default(""),
  created_at: z.string(),
  status: ExecutionStatusEnum.default("pending"),

  product: ProductInfoSchema.nullable().default(null),
  product_analysis: ProductAnalysisSchema.default({}),
  market: MarketAnalysisSchema.default({}),
  persona: PersonaProfileSchema.default({}),
  angle: AngleStrategySchema.default({}),
  benchmark: BenchmarkDataSchema.default({}),
  strategy: CampaignStrategySchema.default({}),
  scripts: ScriptsSchema.default({}),
  copy: CopySchema.default({}),
  character: CharacterSchema.default({}),
  keyframes: KeyframesSchema.default({}),
  video_clips: VideoClipsSchema.default({}),
  final_creatives: FinalCreativesSchema.default({}),
  compliance: ComplianceSchema.default({}),
  tracking: TrackingSchema.default({}),
  facebook_campaign: FacebookCampaignSchema.default({}),
  google_campaign: GoogleCampaignSchema.default({}),
  performance: PerformanceSchema.default({}),
  execution_meta: ExecutionMetaSchema.default({}),
});
export type ExecutionState = z.infer<typeof ExecutionStateSchema>;
