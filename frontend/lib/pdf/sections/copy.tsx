import { Page, Text, View } from '@react-pdf/renderer'
import { C, S } from '../styles'

export interface CopyComponent {
  component_type: string
  tag:            string
  content:        string
  rationale?:     string | null
  register?:      string | null
  intensity?:     string | null
  approval_status?: string | null
}

interface CopySectionProps {
  hooks:       CopyComponent[]
  bodies:      CopyComponent[]
  ctas:        CopyComponent[]
  productName: string
  sku:         string
}

const TYPE_META: Record<string, { label: string; color: string; bg: string; number: string }> = {
  hook: { label: 'Hook',   color: C.danger,  bg: C.dangerBg,  number: '01' },
  body: { label: 'Body',   color: C.info,    bg: C.infoBg,    number: '02' },
  cta:  { label: 'CTA',    color: C.success, bg: C.successBg, number: '03' },
}

const INTENSITY_COLORS: Record<string, string> = {
  low:    C.success,
  medium: C.warning,
  high:   C.danger,
}

const APPROVAL_META: Record<string, { color: string; label: string }> = {
  approved: { color: C.success, label: 'Aprovado' },
  rejected: { color: C.danger,  label: 'Rejeitado' },
  pending:  { color: C.warning, label: 'Pendente'  },
}

function CopyCard({ comp }: { comp: CopyComponent }) {
  const meta   = TYPE_META[comp.component_type]
  const apMeta = APPROVAL_META[comp.approval_status ?? 'pending']

  return (
    <View style={{
      backgroundColor: C.white,
      borderRadius: 6,
      padding: 10,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: C.border,
      borderLeftWidth: 3,
      borderLeftColor: meta?.color ?? C.brand,
    }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, backgroundColor: meta?.bg ?? C.surface }}>
            <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: meta?.color ?? C.textMuted }}>
              {comp.tag}
            </Text>
          </View>
          {comp.register && (
            <Text style={{ fontSize: 7.5, color: C.textMuted }}>{comp.register}</Text>
          )}
          {comp.intensity && (
            <View style={{ paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3, backgroundColor: C.surface }}>
              <Text style={{ fontSize: 7, color: INTENSITY_COLORS[comp.intensity] ?? C.textMuted, fontFamily: 'Helvetica-Bold' }}>
                {comp.intensity}
              </Text>
            </View>
          )}
        </View>
        {apMeta && (
          <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, backgroundColor: `${apMeta.color}15` }}>
            <Text style={{ fontSize: 7, color: apMeta.color, fontFamily: 'Helvetica-Bold' }}>
              {apMeta.label}
            </Text>
          </View>
        )}
      </View>

      {/* Conteúdo */}
      <Text style={{ fontSize: 9, color: C.textPrimary, lineHeight: 1.5, marginBottom: comp.rationale ? 6 : 0 }}>
        {comp.content}
      </Text>

      {/* Rationale */}
      {comp.rationale && (
        <Text style={{ fontSize: 7.5, color: C.textMuted, fontStyle: 'italic', lineHeight: 1.4, borderTopWidth: 1, borderTopColor: C.borderLight, paddingTop: 5 }}>
          Estratégia: {comp.rationale}
        </Text>
      )}
    </View>
  )
}

function CopyGroup({ components, type }: { components: CopyComponent[]; type: string }) {
  if (!components.length) return null
  const meta = TYPE_META[type]

  return (
    <View style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <View style={{ width: 3, height: 16, backgroundColor: meta?.color ?? C.brand, borderRadius: 2, marginRight: 8 }} />
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: C.textPrimary }}>
          {meta?.label ?? type}s
        </Text>
        <View style={{ marginLeft: 8, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 3, backgroundColor: meta?.bg ?? C.surface }}>
          <Text style={{ fontSize: 7.5, color: meta?.color ?? C.textMuted, fontFamily: 'Helvetica-Bold' }}>
            {components.length} variante{components.length !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>
      {components.map((comp, i) => (
        <CopyCard key={i} comp={comp} />
      ))}
    </View>
  )
}

export function CopySection({ hooks, bodies, ctas, productName, sku }: CopySectionProps) {
  const total = hooks.length + bodies.length + ctas.length

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
        <Text style={S.sectionNumber}>06</Text>
        <Text style={S.sectionTitle}>COMPONENTES DE COPY</Text>
        <Text style={S.sectionSubtitle}>{total} componentes gerados</Text>
      </View>

      {/* Legenda */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
        {Object.entries(TYPE_META).map(([type, meta]) => (
          <View key={type} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: meta.color }} />
            <Text style={{ fontSize: 8, color: C.textMuted }}>{meta.label}s</Text>
          </View>
        ))}
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {Object.entries(APPROVAL_META).map(([status, m]) => (
            <View key={status} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: m.color }} />
              <Text style={{ fontSize: 7.5, color: C.textMuted }}>{m.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <CopyGroup components={hooks}  type="hook" />
      <CopyGroup components={bodies} type="body" />
      <CopyGroup components={ctas}   type="cta"  />

      {total === 0 && (
        <View style={{ alignItems: 'center', paddingVertical: 40 }}>
          <Text style={{ fontSize: 10, color: C.textMuted }}>
            Nenhum componente de copy gerado para este produto
          </Text>
        </View>
      )}
    </Page>
  )
}
