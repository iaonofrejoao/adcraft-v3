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

// ── Colunas do Kanban de demandas ─────────────────────────────────────────────
export const KANBAN_COLS = [
  { id: 'pending',     label: 'Pendente'     },
  { id: 'in_progress', label: 'Em andamento' },
  { id: 'done',        label: 'Concluído'    },
] as const

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
