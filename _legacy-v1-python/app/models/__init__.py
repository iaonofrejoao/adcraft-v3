# app/models/
# Modelos Pydantic para validação de dados de entrada/saída da API
# e para tipagem do shared_state dos agentes.
#
# Módulos:
#   state.py        — ExecutionState (modelo central do shared_state):
#                     ProductInfo, ProductAnalysis, MarketAnalysis, PersonaProfile,
#                     AngleStrategy, BenchmarkData, CampaignStrategy, Scripts,
#                     Copy, Character, Keyframes, VideoClips, FinalCreatives,
#                     Compliance, Tracking, FacebookCampaign, GoogleCampaign,
#                     Performance, ExecutionMeta
#
#   project.py      — CreateProjectRequest, UpdateProjectRequest,
#                     ProjectResponse, ProjectCard, ProjectDetailResponse,
#                     ProductBase, ProductResponse, ProjectStats
#
#   execution.py    — CreateExecutionRequest, ExecutionResponse,
#                     ExecutionDetailResponse, ApproveNodeRequest,
#                     RejectNodeRequest, NodeActionResponse, NodeStatus,
#                     NodeStatusUpdate, CostBreakdownResponse, NodeCostItem
#
#   asset.py        — AssetFilterParams, UpdateAssetRequest, AssetResponse,
#                     AssetCard, AssetDetailResponse, FeedbackEntry,
#                     AssetType, ApprovalStatus, IntegrityStatus
#
#   campaign.py     — CampaignFilterParams, CampaignResponse,
#                     PerformanceSnapshot, CampaignMetricsResponse,
#                     CumulativeMetrics, RefreshMetricsResponse,
#                     LaunchReviewPayload, AdPreview, AdsetPreview
#
#   notification.py — NotificationResponse, NotificationListResponse,
#                     MarkNotificationReadRequest, MarkNotificationReadResponse,
#                     CreateNotification, NotificationType
