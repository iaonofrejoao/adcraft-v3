import { Page, Text, View } from '@react-pdf/renderer'
import { C, S } from '../styles'

interface FunnelStage {
  budget_percent: number
  creative_type:  string
  objective:      string
  kpi_target:     string
}

interface TargetAudience {
  name:           string
  platform:       string
  targeting_type: string
  funnel_stage:   string
  description:    string
  interests?:     string[]
}

interface CampaignKPIs {
  target_cpa_brl:           number
  target_roas:              number
  target_ctr_percent:       number
  target_hook_rate_percent?: number
  max_cpm_brl?:             number
}

type PolicyWarning = string | { category?: string; severity?: string; description?: string }

export interface CampaignData {
  campaign_objective:             string
  primary_platform:               string
  platform_rationale:             string
  secondary_platforms:            (string | { platform: string; rationale?: string })[]
  policy_warnings:                PolicyWarning[]
  budget_warnings:                (string | { description?: string })[]
  target_audiences:               TargetAudience[]
  funnel_stages:                  Record<string, FunnelStage>
  recommended_daily_budget_brl:   number
  budget_calculation:             string
  launch_sequence:                string[]
  kpis:                           CampaignKPIs
  angle_to_use?:                  string
}

const PLATFORM_LABELS: Record<string, string> = {
  facebook: 'Facebook / Instagram',
  google:   'Google Ads',
  tiktok:   'TikTok',
  youtube:  'YouTube',
}

function toWarningText(w: PolicyWarning): string {
  if (typeof w === 'string') return w
  const parts: string[] = []
  if (w.severity)    parts.push(`[${w.severity.toUpperCase()}]`)
  if (w.category)    parts.push(w.category)
  if (w.description) parts.push(w.description)
  return parts.join(' — ')
}

function toPlatformLabel(p: string | { platform: string }): string {
  const key = typeof p === 'string' ? p : p.platform
  return PLATFORM_LABELS[key] ?? key
}

interface CampaignSectionProps {
  data: CampaignData
  productName: string
  sku: string
  createdAt: string
}

export function CampaignSection({ data, productName, sku, createdAt }: CampaignSectionProps) {
  const date = new Date(createdAt).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })

  const budgetFmt = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  return (
    <Page size="A4" style={S.page}>
      {/* Footer */}
      <View fixed style={S.footer}>
        <Text style={S.footerBrand}>ADCRAFT</Text>
        <Text style={S.footerText}>{productName} · {sku}</Text>
        <Text style={S.footerText} render={({ pageNumber }) => `Pág. ${pageNumber}`} />
      </View>

      {/* Cabeçalho da seção */}
      <View style={S.sectionHeaderBar}>
        <Text style={S.sectionNumber}>05</Text>
        <Text style={S.sectionTitle}>ESTRATÉGIA DE CAMPANHA</Text>
        <Text style={S.sectionSubtitle}>Gerado em {date}</Text>
      </View>

      {/* Objetivo e plataformas */}
      <View style={[S.card, { marginBottom: 12 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={S.cardTitle}>Objetivo da Campanha</Text>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: C.textPrimary }}>
              {data.campaign_objective}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <View style={{ backgroundColor: C.sectionHeaderBg, borderRadius: 4, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 4 }}>
              <Text style={{ fontSize: 8, color: C.brand, fontFamily: 'Helvetica-Bold' }}>
                {PLATFORM_LABELS[data.primary_platform] ?? data.primary_platform}
              </Text>
            </View>
            <Text style={{ fontSize: 7.5, color: C.textMuted }}>Plataforma principal</Text>
          </View>
        </View>
        {data.platform_rationale && (
          <Text style={S.bodyText}>{data.platform_rationale}</Text>
        )}
        {data.secondary_platforms?.length > 0 && (
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <Text style={{ fontSize: 7.5, color: C.textMuted, marginRight: 2 }}>Plataformas secundárias:</Text>
            {data.secondary_platforms.map((p, i) => (
              <View key={i} style={{ backgroundColor: C.surfaceDark, borderRadius: 3, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ fontSize: 7.5, color: C.textSecondary }}>{toPlatformLabel(p)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Budget + KPIs */}
      <View style={S.row2}>
        <View style={[S.col, S.card]}>
          <Text style={S.cardTitle}>Budget Recomendado</Text>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 18, color: C.brand, marginBottom: 4 }}>
            {budgetFmt(data.recommended_daily_budget_brl)}/dia
          </Text>
          {data.budget_calculation && (
            <Text style={[S.caption, { lineHeight: 1.4 }]}>{data.budget_calculation}</Text>
          )}
        </View>

        <View style={[S.col, S.card]}>
          <Text style={S.cardTitle}>KPIs Alvo</Text>
          {data.kpis?.target_cpa_brl && (
            <View style={S.metricRow}>
              <Text style={S.metricLabel}>CPA alvo</Text>
              <Text style={S.metricValue}>{budgetFmt(data.kpis.target_cpa_brl)}</Text>
            </View>
          )}
          {data.kpis?.target_roas && (
            <View style={S.metricRow}>
              <Text style={S.metricLabel}>ROAS alvo</Text>
              <Text style={S.metricValue}>{data.kpis.target_roas}×</Text>
            </View>
          )}
          {data.kpis?.target_ctr_percent && (
            <View style={S.metricRow}>
              <Text style={S.metricLabel}>CTR alvo</Text>
              <Text style={S.metricValue}>{data.kpis.target_ctr_percent}%</Text>
            </View>
          )}
          {data.kpis?.target_hook_rate_percent && (
            <View style={[S.metricRow, { borderBottomWidth: 0 }]}>
              <Text style={S.metricLabel}>Hook Rate alvo</Text>
              <Text style={S.metricValue}>{data.kpis.target_hook_rate_percent}%</Text>
            </View>
          )}
        </View>
      </View>

      {/* Sequência de lançamento */}
      {data.launch_sequence?.length > 0 && (
        <View style={[S.card, { marginBottom: 12 }]}>
          <Text style={S.cardTitle}>Sequência de Lançamento</Text>
          {data.launch_sequence.map((step, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 }}>
              <View style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: C.brand,
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: 8,
                flexShrink: 0,
                marginTop: 1,
              }}>
                <Text style={{ fontSize: 8, color: C.white, fontFamily: 'Helvetica-Bold' }}>{i + 1}</Text>
              </View>
              <Text style={[S.bodyText, { flex: 1, paddingTop: 2 }]}>{step}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Públicos-alvo */}
      {data.target_audiences?.length > 0 && (
        <View style={S.card}>
          <Text style={S.cardTitle}>Públicos-Alvo ({data.target_audiences.length})</Text>
          {data.target_audiences.slice(0, 3).map((aud, i) => (
            <View key={i} style={{
              backgroundColor: C.surfaceAlt,
              borderRadius: 5,
              padding: 8,
              marginBottom: 6,
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9, color: C.textPrimary }}>
                  {aud.name}
                </Text>
                <View style={{ backgroundColor: C.infoBg, borderRadius: 3, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 7, color: C.info, fontFamily: 'Helvetica-Bold' }}>
                    {PLATFORM_LABELS[aud.platform] ?? aud.platform} · {aud.funnel_stage}
                  </Text>
                </View>
              </View>
              <Text style={[S.caption, { lineHeight: 1.4 }]}>{aud.description}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Alertas de política */}
      {data.policy_warnings?.length > 0 && (
        <View style={{
          backgroundColor: C.dangerBg,
          borderRadius: 6,
          padding: 12,
          marginTop: 8,
          borderLeftWidth: 3,
          borderLeftColor: C.danger,
        }}>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8.5, color: C.danger, marginBottom: 6 }}>
            Alertas de Política de Anúncios
          </Text>
          {data.policy_warnings.map((w, i) => (
            <View key={i} style={S.bulletRow}>
              <Text style={[S.bulletDot, { color: C.danger }]}>!</Text>
              <Text style={[S.bulletText, { color: C.textPrimary }]}>{toWarningText(w)}</Text>
            </View>
          ))}
        </View>
      )}
    </Page>
  )
}
