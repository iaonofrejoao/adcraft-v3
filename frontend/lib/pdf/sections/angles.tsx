import { Page, Text, View } from '@react-pdf/renderer'
import { C, S, angleTypeColor } from '../styles'

export interface AngleHook {
  hook_text:  string
  hook_type:  'question' | 'shocking_statement' | 'story' | 'fact'
  variant_id: string
}

export interface AnglesData {
  primary_angle:         string
  angle_type:            string
  usp:                   string
  emotional_trigger:     string
  hooks:                 AngleHook[]
  selected_hook_variant: string
  alternative_angles:    string[]
  angle_rationale:       string
}

const ANGLE_TYPE_LABELS: Record<string, string> = {
  betrayed_authority: 'Autoridade Traída',
  transformation:     'Transformação',
  social_proof:       'Prova Social',
  novelty:            'Novidade',
  fear:               'Medo',
  curiosity:          'Curiosidade',
  identification:     'Identificação',
}

const HOOK_TYPE_LABELS: Record<string, string> = {
  question:           'Pergunta',
  shocking_statement: 'Declaração Chocante',
  story:              'História',
  fact:               'Fato',
}

const HOOK_TYPE_COLORS: Record<string, { text: string; bg: string }> = {
  question:           { text: C.info,    bg: C.infoBg    },
  shocking_statement: { text: C.danger,  bg: C.dangerBg  },
  story:              { text: C.purple,  bg: C.purpleBg  },
  fact:               { text: C.success, bg: C.successBg },
}

interface AnglesSectionProps {
  data: AnglesData
  productName: string
  sku: string
  createdAt: string
}

export function AnglesSection({ data, productName, sku, createdAt }: AnglesSectionProps) {
  const date = new Date(createdAt).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
  const ac = angleTypeColor(data.angle_type)

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
        <Text style={S.sectionNumber}>04</Text>
        <Text style={S.sectionTitle}>ÂNGULOS E POSICIONAMENTO</Text>
        <Text style={S.sectionSubtitle}>Gerado em {date}</Text>
      </View>

      {/* Ângulo campeão */}
      <View style={{ backgroundColor: C.sectionHeaderBg, borderRadius: 8, padding: 16, marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
          <View style={{
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 4,
            backgroundColor: ac.bg,
            marginRight: 8,
          }}>
            <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: ac.text }}>
              {ANGLE_TYPE_LABELS[data.angle_type] ?? data.angle_type}
            </Text>
          </View>
          <Text style={{ fontSize: 8, color: C.textMutedInv }}>Ângulo Campeão</Text>
        </View>
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 13, color: C.textInverse, lineHeight: 1.4 }}>
          {data.primary_angle}
        </Text>
      </View>

      {/* USP + Gatilho emocional */}
      <View style={S.row2}>
        <View style={[S.col, S.card]}>
          <Text style={[S.cardTitle, { color: C.warning }]}>USP — Diferencial Único</Text>
          <Text style={S.bodyText}>{data.usp}</Text>
        </View>
        <View style={[S.col, S.card]}>
          <Text style={[S.cardTitle, { color: C.danger }]}>Gatilho Emocional</Text>
          <Text style={S.bodyText}>{data.emotional_trigger}</Text>
        </View>
      </View>

      {/* Raciocínio estratégico */}
      {data.angle_rationale && (
        <View style={[S.card, { marginBottom: 12 }]}>
          <Text style={S.cardTitle}>Raciocínio Estratégico</Text>
          <Text style={S.bodyText}>{data.angle_rationale}</Text>
        </View>
      )}

      {/* Hooks de abertura */}
      {data.hooks?.length > 0 && (
        <View style={S.card}>
          <Text style={S.cardTitle}>Hooks de Abertura — {data.hooks.length} Variantes</Text>
          {data.hooks.map((hook, i) => {
            const hc = HOOK_TYPE_COLORS[hook.hook_type] ?? { text: C.textSecondary, bg: C.surface }
            const isSelected = hook.variant_id === data.selected_hook_variant
            return (
              <View key={i} style={{
                backgroundColor: isSelected ? `${C.brand}10` : C.surfaceAlt,
                borderRadius: 6,
                padding: 10,
                marginBottom: 6,
                borderWidth: isSelected ? 1 : 0,
                borderColor: isSelected ? `${C.brand}40` : 'transparent',
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                  <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, backgroundColor: isSelected ? C.brand : C.surfaceDark, marginRight: 6 }}>
                    <Text style={{ fontSize: 7, color: isSelected ? C.white : C.textMuted, fontFamily: 'Helvetica-Bold' }}>
                      {hook.variant_id}
                    </Text>
                  </View>
                  <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, backgroundColor: hc.bg }}>
                    <Text style={{ fontSize: 7, color: hc.text, fontFamily: 'Helvetica-Bold' }}>
                      {HOOK_TYPE_LABELS[hook.hook_type] ?? hook.hook_type}
                    </Text>
                  </View>
                  {isSelected && (
                    <View style={{ marginLeft: 6 }}>
                      <Text style={{ fontSize: 7, color: C.brand, fontFamily: 'Helvetica-Bold' }}>★ Selecionado</Text>
                    </View>
                  )}
                </View>
                <Text style={[S.italic, { color: C.textPrimary }]}>
                  "{hook.hook_text}"
                </Text>
              </View>
            )
          })}
        </View>
      )}

      {/* Ângulos alternativos */}
      {data.alternative_angles?.length > 0 && (
        <View style={[S.card, { marginTop: 2 }]}>
          <Text style={S.cardTitle}>Ângulos Alternativos</Text>
          {data.alternative_angles.map((angle, i) => (
            <View key={i} style={S.bulletRow}>
              <Text style={S.bulletDot}>•</Text>
              <Text style={S.bulletText}>{angle}</Text>
            </View>
          ))}
        </View>
      )}
    </Page>
  )
}
