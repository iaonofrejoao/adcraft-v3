import { Page, Text, View } from '@react-pdf/renderer'
import { C, S } from '../styles'

interface TocSection {
  number: string
  title: string
  subtitle: string
  available: boolean
}

interface TocProps {
  productName: string
  sku: string
  sections: TocSection[]
}

function TocRow({ section }: { section: TocSection }) {
  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: C.borderLight,
      opacity: section.available ? 1 : 0.4,
    }}>
      {/* Número */}
      <View style={{
        width: 32,
        height: 32,
        borderRadius: 6,
        backgroundColor: section.available ? C.sectionHeaderBg : C.surfaceDark,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
      }}>
        <Text style={{
          fontFamily: 'Helvetica-Bold',
          fontSize: 10,
          color: section.available ? C.brand : C.textMuted,
        }}>
          {section.number}
        </Text>
      </View>

      {/* Título e subtítulo */}
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, color: C.textPrimary, marginBottom: 2 }}>
          {section.title}
        </Text>
        <Text style={{ fontSize: 8, color: C.textMuted }}>
          {section.subtitle}
        </Text>
      </View>

      {/* Status */}
      <View style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
        backgroundColor: section.available ? C.successBg : C.surfaceDark,
      }}>
        <Text style={{
          fontSize: 7.5,
          fontFamily: 'Helvetica-Bold',
          color: section.available ? C.success : C.textMuted,
        }}>
          {section.available ? 'Disponível' : 'Sem dados'}
        </Text>
      </View>
    </View>
  )
}

export function TocPage({ productName, sku, sections }: TocProps) {
  const available = sections.filter((s) => s.available).length

  return (
    <Page size="A4" style={S.page}>
      {/* Footer fixo */}
      <View fixed style={S.footer}>
        <Text style={S.footerBrand}>ADCRAFT</Text>
        <Text style={S.footerText}>{productName} · {sku}</Text>
        <Text style={S.footerText} render={({ pageNumber }) => `Pág. ${pageNumber}`} />
      </View>

      {/* Cabeçalho */}
      <View style={{ marginBottom: 24 }}>
        <Text style={{
          fontFamily: 'Helvetica-Bold',
          fontSize: 22,
          color: C.textPrimary,
          marginBottom: 4,
        }}>
          Sumário
        </Text>
        <Text style={{ fontSize: 9, color: C.textMuted }}>
          {available} de {sections.length} seções disponíveis neste estudo
        </Text>
      </View>

      {/* Linha de destaque */}
      <View style={{ width: 40, height: 3, backgroundColor: C.brand, borderRadius: 2, marginBottom: 20 }} />

      {/* Seções */}
      {sections.map((section) => (
        <TocRow key={section.number} section={section} />
      ))}

      {/* Nota de rodapé */}
      <View style={{
        marginTop: 24,
        padding: 12,
        backgroundColor: C.brandLight,
        borderRadius: 6,
        borderLeftWidth: 3,
        borderLeftColor: C.brand,
      }}>
        <Text style={{ fontSize: 8, color: C.brandDark, lineHeight: 1.5 }}>
          Este documento foi gerado automaticamente pelo sistema AdCraft AI com base nas análises
          realizadas pelos agentes de inteligência artificial. As informações refletem o estado
          do estudo no momento da geração e devem ser validadas pela equipe antes de uso em produção.
        </Text>
      </View>
    </Page>
  )
}
