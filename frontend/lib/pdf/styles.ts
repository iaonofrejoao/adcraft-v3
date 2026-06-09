import { StyleSheet } from '@react-pdf/renderer'

// ── Paleta de cores ────────────────────────────────────────────────────────────
export const C = {
  // Backgrounds
  coverBg:        '#0C0F1A',
  sectionHeaderBg:'#1A2335',
  white:          '#FFFFFF',
  surface:        '#F8FAFC',
  surfaceAlt:     '#EEF2F7',
  surfaceDark:    '#F1F5F9',
  // Texto
  textPrimary:    '#0F172A',
  textSecondary:  '#475569',
  textMuted:      '#94A3B8',
  textInverse:    '#FFFFFF',
  textMutedInv:   '#94A3B8',
  // Marca
  brand:          '#F28705',
  brandLight:     '#FEF3E2',
  brandDark:      '#B86304',
  // Status
  success:        '#059669',
  successBg:      '#D1FAE5',
  warning:        '#D97706',
  warningBg:      '#FEF3C7',
  danger:         '#DC2626',
  dangerBg:       '#FEE2E2',
  info:           '#2563EB',
  infoBg:         '#DBEAFE',
  purple:         '#7C3AED',
  purpleBg:       '#EDE9FE',
  teal:           '#0D9488',
  tealBg:         '#CCFBF1',
  // Bordas
  border:         '#E2E8F0',
  borderLight:    '#F1F5F9',
} as const

// ── Estilos compartilhados ─────────────────────────────────────────────────────
export const S = StyleSheet.create({
  // Layout de página
  page: {
    fontFamily: 'Helvetica',
    backgroundColor: C.white,
    paddingHorizontal: 40,
    paddingTop: 36,
    paddingBottom: 52,
  },
  coverPage: {
    fontFamily: 'Helvetica',
    backgroundColor: C.coverBg,
    padding: 0,
  },

  // Cabeçalho de seção (barra escura)
  sectionHeaderBar: {
    backgroundColor: C.sectionHeaderBg,
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionNumber: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    color: C.brand,
    marginRight: 10,
    letterSpacing: 1,
  },
  sectionTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 13,
    color: C.textInverse,
    letterSpacing: 0.5,
  },
  sectionSubtitle: {
    fontSize: 8.5,
    color: C.textMutedInv,
    marginLeft: 'auto',
  },

  // Cards
  card: {
    backgroundColor: C.surface,
    borderRadius: 6,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardWhite: {
    backgroundColor: C.white,
    borderRadius: 6,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: C.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },

  // Grid 2 colunas
  row2: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  col: {
    flex: 1,
  },

  // Linha label/valor
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
  },
  metricLabel: {
    fontSize: 8.5,
    color: C.textSecondary,
    flex: 1,
  },
  metricValue: {
    fontSize: 8.5,
    color: C.textPrimary,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'right',
  },

  // Textos
  bodyText: {
    fontSize: 9,
    color: C.textSecondary,
    lineHeight: 1.5,
  },
  bodyTextDark: {
    fontSize: 9,
    color: C.textPrimary,
    lineHeight: 1.5,
  },
  caption: {
    fontSize: 7.5,
    color: C.textMuted,
  },
  italic: {
    fontSize: 8.5,
    color: C.textSecondary,
    fontStyle: 'italic',
    lineHeight: 1.5,
  },

  // Badges / pills
  badge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
  },

  // Listas
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  bulletDot: {
    fontSize: 9,
    color: C.textMuted,
    marginRight: 6,
    marginTop: 1,
  },
  bulletText: {
    flex: 1,
    fontSize: 8.5,
    color: C.textSecondary,
    lineHeight: 1.5,
  },

  // Footer fixo em cada página
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: C.borderLight,
    paddingTop: 6,
  },
  footerText: {
    fontSize: 7,
    color: C.textMuted,
  },
  footerBrand: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: C.brand,
  },

  // Divisor
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    marginVertical: 10,
  },
})

// ── Helpers ───────────────────────────────────────────────────────────────────

export function scoreColor(score: number) {
  if (score >= 70) return { text: C.success,  bg: C.successBg  }
  if (score >= 40) return { text: C.warning,  bg: C.warningBg  }
  return               { text: C.danger,   bg: C.dangerBg   }
}

export function competitionColor(level: string) {
  const map: Record<string, { text: string; bg: string }> = {
    low:       { text: C.success, bg: C.successBg },
    medium:    { text: C.warning, bg: C.warningBg },
    high:      { text: C.brand,   bg: C.brandLight },
    saturated: { text: C.danger,  bg: C.dangerBg  },
  }
  return map[level] ?? { text: C.textMuted, bg: C.surfaceAlt }
}

export function trendColor(direction: string) {
  const map: Record<string, string> = {
    growing:  C.success,
    stable:   C.warning,
    declining: C.danger,
  }
  return map[direction] ?? C.textMuted
}

export function angleTypeColor(type: string) {
  const map: Record<string, { text: string; bg: string }> = {
    betrayed_authority: { text: C.danger,   bg: C.dangerBg   },
    transformation:     { text: C.success,  bg: C.successBg  },
    social_proof:       { text: C.info,     bg: C.infoBg     },
    novelty:            { text: C.purple,   bg: C.purpleBg   },
    fear:               { text: C.brand,    bg: C.brandLight },
    curiosity:          { text: C.warning,  bg: C.warningBg  },
    identification:     { text: C.teal,     bg: C.tealBg     },
  }
  return map[type] ?? { text: C.textSecondary, bg: C.surface }
}
