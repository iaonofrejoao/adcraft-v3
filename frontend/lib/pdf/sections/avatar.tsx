import { Page, Text, View } from '@react-pdf/renderer'
import { C, S } from '../styles'

export interface AvatarData {
  summary: string
  full_profile: {
    fictional_name: string
    age_range:      string
    gender:         string
    location:       string
    income_level:   string
    education:      string
    occupation:     string
  }
  psychographic: {
    primary_pain:      string
    secondary_pains:   string[]
    primary_desire:    string
    secondary_desires: string[]
    tried_before:      string[]
    objections:        string[]
    language_style:    string
  }
  verbatim_expressions: string[]
  data_sources?:        string[]
}

interface AvatarSectionProps {
  data: AvatarData
  productName: string
  sku: string
  createdAt: string
}

function ProfileItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={S.metricRow}>
      <Text style={S.metricLabel}>{label}</Text>
      <Text style={{ fontSize: 8.5, color: C.textPrimary, maxWidth: '60%', textAlign: 'right' }}>{value}</Text>
    </View>
  )
}

function ListItems({ items, accentColor }: { items: string[]; accentColor?: string }) {
  if (!items?.length) return null
  return (
    <View>
      {items.map((item, i) => (
        <View key={i} style={S.bulletRow}>
          <Text style={[S.bulletDot, { color: accentColor ?? C.textMuted }]}>•</Text>
          <Text style={S.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  )
}

export function AvatarSection({ data, productName, sku, createdAt }: AvatarSectionProps) {
  const date = new Date(createdAt).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
  const p = data.full_profile
  const ps = data.psychographic

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
        <Text style={S.sectionNumber}>02</Text>
        <Text style={S.sectionTitle}>AVATAR DO CLIENTE</Text>
        <Text style={S.sectionSubtitle}>Gerado em {date}</Text>
      </View>

      {/* Sumário do avatar */}
      <View style={[S.card, { marginBottom: 12 }]}>
        <Text style={S.cardTitle}>Perfil em Resumo</Text>
        <Text style={S.bodyText}>{data.summary}</Text>
      </View>

      {/* Grid: Perfil + Psicografia */}
      <View style={S.row2}>
        {/* Perfil demográfico */}
        <View style={[S.col, S.card]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <View style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: C.infoBg,
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 8,
            }}>
              <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.info }}>
                {p.fictional_name?.charAt(0)?.toUpperCase() ?? 'A'}
              </Text>
            </View>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, color: C.textPrimary }}>
              {p.fictional_name}
            </Text>
          </View>
          <ProfileItem label="Faixa etária"  value={p.age_range}    />
          <ProfileItem label="Gênero"        value={p.gender}       />
          <ProfileItem label="Localização"   value={p.location}     />
          <ProfileItem label="Renda"         value={p.income_level} />
          <ProfileItem label="Escolaridade"  value={p.education}    />
          <ProfileItem label="Profissão"     value={p.occupation}   />
        </View>

        {/* Dores e Desejos */}
        <View style={S.col}>
          <View style={[S.card, { marginBottom: 8 }]}>
            <Text style={[S.cardTitle, { color: C.danger }]}>Dor Principal</Text>
            <Text style={S.bodyTextDark}>{ps.primary_pain}</Text>
          </View>
          <View style={S.card}>
            <Text style={[S.cardTitle, { color: C.success }]}>Desejo Principal</Text>
            <Text style={S.bodyTextDark}>{ps.primary_desire}</Text>
          </View>
        </View>
      </View>

      {/* Dores secundárias + Desejos secundários */}
      <View style={S.row2}>
        {ps.secondary_pains?.length > 0 && (
          <View style={[S.col, S.card]}>
            <Text style={[S.cardTitle, { color: C.danger }]}>Dores Secundárias</Text>
            <ListItems items={ps.secondary_pains} accentColor={C.danger} />
          </View>
        )}
        {ps.secondary_desires?.length > 0 && (
          <View style={[S.col, S.card]}>
            <Text style={[S.cardTitle, { color: C.success }]}>Desejos Secundários</Text>
            <ListItems items={ps.secondary_desires} accentColor={C.success} />
          </View>
        )}
      </View>

      {/* Objeções + Tentativas anteriores */}
      <View style={S.row2}>
        {ps.objections?.length > 0 && (
          <View style={[S.col, S.card]}>
            <Text style={[S.cardTitle, { color: C.warning }]}>Objeções de Compra</Text>
            <ListItems items={ps.objections} accentColor={C.warning} />
          </View>
        )}
        {ps.tried_before?.length > 0 && (
          <View style={[S.col, S.card]}>
            <Text style={S.cardTitle}>Já Tentou Antes</Text>
            <ListItems items={ps.tried_before} />
          </View>
        )}
      </View>

      {/* Linguagem + Expressões verbatim */}
      {ps.language_style && (
        <View style={[S.card, { marginBottom: 10 }]}>
          <Text style={S.cardTitle}>Estilo de Linguagem</Text>
          <Text style={S.bodyText}>{ps.language_style}</Text>
        </View>
      )}

      {data.verbatim_expressions?.length > 0 && (
        <View style={S.card}>
          <Text style={S.cardTitle}>Expressões Verbatim — Como o Avatar Fala</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {data.verbatim_expressions.map((expr, i) => (
              <View key={i} style={{
                backgroundColor: C.surfaceDark,
                borderRadius: 4,
                paddingHorizontal: 8,
                paddingVertical: 4,
                maxWidth: '100%',
              }}>
                <Text style={{ fontSize: 8, color: C.textSecondary, fontStyle: 'italic' }}>
                  "{expr}"
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </Page>
  )
}
