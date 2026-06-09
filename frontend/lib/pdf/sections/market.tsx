import { Page, Text, View } from '@react-pdf/renderer'
import { C, S, scoreColor, competitionColor, trendColor } from '../styles'

export interface MarketData {
  viability_score:         number
  viability_verdict:       'viable' | 'not_viable'
  viability_justification: string
  competition_level:       'low' | 'medium' | 'high' | 'saturated'
  ads_running_count:       number | 'data_unavailable'
  trend_direction:         'growing' | 'stable' | 'declining'
  trend_source?:           string
  estimated_margin_brl:    number | 'data_unavailable'
  market_warnings?:        string[]
  data_sources?:           string[]
}

const COMPETITION_LABELS: Record<string, string> = {
  low: 'Baixa', medium: 'Média', high: 'Alta', saturated: 'Saturada',
}

const TREND_LABELS: Record<string, string> = {
  growing: 'Crescendo', stable: 'Estável', declining: 'Declinando',
}

interface MarketSectionProps {
  data: MarketData
  productName: string
  sku: string
  createdAt: string
}

export function MarketSection({ data, productName, sku, createdAt }: MarketSectionProps) {
  const sc = scoreColor(data.viability_score)
  const cc = competitionColor(data.competition_level)
  const tc = trendColor(data.trend_direction)

  const margin = typeof data.estimated_margin_brl === 'number'
    ? `R$ ${data.estimated_margin_brl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    : 'Não disponível'

  const adsCount = typeof data.ads_running_count === 'number'
    ? data.ads_running_count.toLocaleString('pt-BR')
    : 'Não disponível'

  const date = new Date(createdAt).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })

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
        <Text style={S.sectionNumber}>01</Text>
        <Text style={S.sectionTitle}>ANÁLISE DE MERCADO E VIABILIDADE</Text>
        <Text style={S.sectionSubtitle}>Gerado em {date}</Text>
      </View>

      {/* Score de viabilidade */}
      <View style={{
        backgroundColor: sc.bg,
        borderRadius: 8,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'flex-start',
      }}>
        {/* Score circle */}
        <View style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: C.white,
          borderWidth: 3,
          borderColor: sc.text,
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: 16,
          flexShrink: 0,
        }}>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 26, color: sc.text }}>
            {data.viability_score}
          </Text>
          <Text style={{ fontSize: 6.5, color: sc.text, letterSpacing: 1, fontFamily: 'Helvetica-Bold' }}>
            SCORE
          </Text>
        </View>

        {/* Verdict */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <View style={{
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 4,
              backgroundColor: data.viability_verdict === 'viable' ? C.success : C.danger,
              marginRight: 8,
            }}>
              <Text style={{ fontSize: 7.5, color: C.white, fontFamily: 'Helvetica-Bold' }}>
                {data.viability_verdict === 'viable' ? 'VIÁVEL' : 'NÃO VIÁVEL'}
              </Text>
            </View>
          </View>
          <Text style={{ fontSize: 9, color: C.textPrimary, lineHeight: 1.5 }}>
            {data.viability_justification}
          </Text>
        </View>
      </View>

      {/* Grid 2 colunas: Mercado + Financeiro */}
      <View style={S.row2}>
        {/* Coluna Mercado e Concorrência */}
        <View style={[S.col, S.card]}>
          <Text style={S.cardTitle}>Mercado e Concorrência</Text>

          <View style={S.metricRow}>
            <Text style={S.metricLabel}>Nível de competição</Text>
            <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 3, backgroundColor: cc.bg }}>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: cc.text }}>
                {COMPETITION_LABELS[data.competition_level] ?? data.competition_level}
              </Text>
            </View>
          </View>

          <View style={S.metricRow}>
            <Text style={S.metricLabel}>Anúncios ativos (estimativa)</Text>
            <Text style={S.metricValue}>{adsCount}</Text>
          </View>

          <View style={[S.metricRow, { borderBottomWidth: 0 }]}>
            <Text style={S.metricLabel}>Tendência do mercado</Text>
            <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: tc }}>
              {TREND_LABELS[data.trend_direction] ?? data.trend_direction}
            </Text>
          </View>
        </View>

        {/* Coluna Financeiro */}
        <View style={[S.col, S.card]}>
          <Text style={S.cardTitle}>Dados Financeiros</Text>

          <View style={S.metricRow}>
            <Text style={S.metricLabel}>Margem estimada (BRL)</Text>
            <Text style={S.metricValue}>{margin}</Text>
          </View>

          <View style={[S.metricRow, { borderBottomWidth: 0 }]}>
            <Text style={S.metricLabel}>Análise realizada em</Text>
            <Text style={S.metricValue}>{date}</Text>
          </View>
        </View>
      </View>

      {/* Alertas de mercado */}
      {(data.market_warnings?.length ?? 0) > 0 && (
        <View style={{
          backgroundColor: C.warningBg,
          borderRadius: 6,
          padding: 14,
          marginBottom: 10,
          borderLeftWidth: 3,
          borderLeftColor: C.warning,
        }}>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9, color: C.warning, marginBottom: 8 }}>
            Alertas de Mercado
          </Text>
          {data.market_warnings!.map((w, i) => (
            <View key={i} style={S.bulletRow}>
              <Text style={[S.bulletDot, { color: C.warning }]}>•</Text>
              <Text style={[S.bulletText, { color: C.textPrimary }]}>{w}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Fontes */}
      {(data.data_sources?.length ?? 0) > 0 && (
        <View style={S.card}>
          <Text style={S.cardTitle}>Fontes Pesquisadas</Text>
          {data.data_sources!.map((url, i) => {
            let display = url
            try { display = new URL(url).hostname.replace('www.', '') } catch {}
            return (
              <View key={i} style={S.bulletRow}>
                <Text style={S.bulletDot}>→</Text>
                <Text style={[S.bulletText, { color: C.info }]}>{display}</Text>
              </View>
            )
          })}
        </View>
      )}
    </Page>
  )
}
