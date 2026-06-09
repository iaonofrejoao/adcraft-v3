import React from 'react'
import { Page, Text, View } from '@react-pdf/renderer'
import { C, S } from '../styles'

interface Competitor {
  name:               string
  product_name?:      string
  estimated_ads_count?: number
  primary_angle?:     string
  price_range?:       string
  offer_structure?:   { price?: string; guarantee?: string; payment_options?: string; bonuses?: string[] }
  social_proof_type?: string
  strengths?:         string[]
  weaknesses?:        string[]
  source?:            string
}

export interface BenchmarkData {
  competitors:               Competitor[]
  market_gaps?:              string[]
  winning_angles_in_market?: string[]
  recommendations?:          string[]
}

interface BenchmarkSectionProps {
  data: BenchmarkData
  productName: string
  sku: string
  createdAt: string
}

function CompetitorCard({ comp, index }: { comp: Competitor; index: number }) {
  return (
    <View style={[S.card, { marginBottom: 10 }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <View style={{
              width: 20,
              height: 20,
              borderRadius: 4,
              backgroundColor: C.sectionHeaderBg,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Text style={{ fontSize: 8, color: C.brand, fontFamily: 'Helvetica-Bold' }}>
                {String(index + 1).padStart(2, '0')}
              </Text>
            </View>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, color: C.textPrimary }}>
              {comp.name}
            </Text>
          </View>
          {comp.product_name && (
            <Text style={{ fontSize: 8, color: C.textMuted }}>{comp.product_name}</Text>
          )}
        </View>
        {typeof comp.estimated_ads_count === 'number' && (
          <View style={{ backgroundColor: C.infoBg, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3 }}>
            <Text style={{ fontSize: 7.5, color: C.info, fontFamily: 'Helvetica-Bold' }}>
              ~{comp.estimated_ads_count} anúncios
            </Text>
          </View>
        )}
      </View>

      {/* Grid de métricas */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        {comp.primary_angle && (
          <View style={{ flex: 1, backgroundColor: C.purpleBg, borderRadius: 4, padding: 7 }}>
            <Text style={{ fontSize: 7, color: C.purple, fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>ÂNGULO PRINCIPAL</Text>
            <Text style={{ fontSize: 8, color: C.textPrimary }}>{comp.primary_angle}</Text>
          </View>
        )}
        {comp.price_range && (
          <View style={{ flex: 1, backgroundColor: C.successBg, borderRadius: 4, padding: 7 }}>
            <Text style={{ fontSize: 7, color: C.success, fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>PREÇO</Text>
            <Text style={{ fontSize: 8, color: C.textPrimary }}>{comp.price_range}</Text>
          </View>
        )}
        {comp.offer_structure?.guarantee && (
          <View style={{ flex: 1, backgroundColor: C.warningBg, borderRadius: 4, padding: 7 }}>
            <Text style={{ fontSize: 7, color: C.warning, fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>GARANTIA</Text>
            <Text style={{ fontSize: 8, color: C.textPrimary }}>{comp.offer_structure.guarantee}</Text>
          </View>
        )}
      </View>

      {/* Pontos fortes / fracos */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {comp.strengths?.length && (
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 7.5, color: C.success, fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>PONTOS FORTES</Text>
            {comp.strengths.slice(0, 3).map((s, i) => (
              <View key={i} style={S.bulletRow}>
                <Text style={[S.bulletDot, { color: C.success }]}>+</Text>
                <Text style={[S.bulletText, { fontSize: 7.5 }]}>{s}</Text>
              </View>
            ))}
          </View>
        )}
        {comp.weaknesses?.length && (
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 7.5, color: C.danger, fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>FRAQUEZAS</Text>
            {comp.weaknesses.slice(0, 3).map((w, i) => (
              <View key={i} style={S.bulletRow}>
                <Text style={[S.bulletDot, { color: C.danger }]}>−</Text>
                <Text style={[S.bulletText, { fontSize: 7.5 }]}>{w}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  )
}

export function BenchmarkSection({ data, productName, sku, createdAt }: BenchmarkSectionProps) {
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
        <Text style={S.sectionNumber}>03</Text>
        <Text style={S.sectionTitle}>INTELIGÊNCIA COMPETITIVA</Text>
        <Text style={S.sectionSubtitle}>Gerado em {date}</Text>
      </View>

      {/* Gaps de mercado */}
      {(data.market_gaps?.length ?? 0) > 0 && (
        <View style={[S.card, { marginBottom: 12, borderLeftWidth: 3, borderLeftColor: C.brand }]}>
          <Text style={[S.cardTitle, { color: C.brandDark }]}>Gaps de Mercado Identificados</Text>
          {data.market_gaps!.map((gap, i) => (
            <View key={i} style={S.bulletRow}>
              <Text style={[S.bulletDot, { color: C.brand }]}>→</Text>
              <Text style={S.bulletText}>{gap}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Competidores */}
      {data.competitors?.slice(0, 4).map((comp, i) => (
        <CompetitorCard key={i} comp={comp} index={i} />
      ))}

      {/* Ângulos vencedores no mercado */}
      {(data.winning_angles_in_market?.length ?? 0) > 0 && (
        <View style={S.card}>
          <Text style={S.cardTitle}>Ângulos Vencedores no Mercado</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {data.winning_angles_in_market!.map((angle, i) => (
              <View key={i} style={{
                backgroundColor: C.purpleBg,
                borderRadius: 4,
                paddingHorizontal: 8,
                paddingVertical: 4,
              }}>
                <Text style={{ fontSize: 8, color: C.purple }}>{angle}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </Page>
  )
}
