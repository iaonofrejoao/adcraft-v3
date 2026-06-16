// ── User padrão (temporário até auth) ────────────────────────────────────────
export const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001'

// ── Plataformas de afiliado ───────────────────────────────────────────────────
export const AFFILIATE_PLATFORMS = [
  'hotmart',
  'clickbank',
  'monetizze',
  'eduzz',
] as const

export type AffiliatePlatform = typeof AFFILIATE_PLATFORMS[number]

// ── Defaults de produto ───────────────────────────────────────────────────────
export const PRODUCT_DEFAULTS = {
  commissionPercent: 30,
  ticketPrice: 97,
} as const

// ── Países/idiomas suportados ─────────────────────────────────────────────────
export const COUNTRIES = [
  { code: 'BR', flag: '🇧🇷', label: 'Brasil',         language: 'pt-BR' },
  { code: 'PT', flag: '🇵🇹', label: 'Portugal',        language: 'pt-PT' },
  { code: 'US', flag: '🇺🇸', label: 'Estados Unidos',  language: 'en-US' },
  { code: 'GB', flag: '🇬🇧', label: 'Reino Unido',     language: 'en-GB' },
  { code: 'ES', flag: '🇪🇸', label: 'Espanha',         language: 'es-ES' },
  { code: 'MX', flag: '🇲🇽', label: 'México',          language: 'es-MX' },
  { code: 'AR', flag: '🇦🇷', label: 'Argentina',       language: 'es-AR' },
  { code: 'CO', flag: '🇨🇴', label: 'Colômbia',        language: 'es-CO' },
  { code: 'CL', flag: '🇨🇱', label: 'Chile',           language: 'es-CL' },
  { code: 'PE', flag: '🇵🇪', label: 'Peru',            language: 'es-PE' },
  { code: 'FR', flag: '🇫🇷', label: 'França',          language: 'fr-FR' },
  { code: 'DE', flag: '🇩🇪', label: 'Alemanha',        language: 'de-DE' },
  { code: 'IT', flag: '🇮🇹', label: 'Itália',          language: 'it-IT' },
] as const

export type CountryCode = typeof COUNTRIES[number]['code']

// ── Ícones de agentes (mapeamento slug → nome Lucide) ─────────────────────────
export const AGENT_ICONS: Record<string, string> = {
  'avatar-research':   'Users',
  'market-research':   'BarChart2',
  'angle-generator':   'Lightbulb',
  'copy-hook':         'Zap',
  'copy-body':         'FileText',
  'copy-cta':          'MousePointerClick',
  'anvisa-compliance': 'ShieldCheck',
  'video-maker':       'Film',
  'niche-curator':     'BookOpen',
}

// ── Status de tasks/pipelines ─────────────────────────────────────────────────
export const TASK_STATUS = {
  pending:  'pending',
  running:  'running',
  done:     'done',
  failed:   'failed',
  paused:   'paused',
} as const

export type TaskStatus = keyof typeof TASK_STATUS
