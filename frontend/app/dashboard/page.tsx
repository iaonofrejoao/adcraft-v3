'use client'
import Link from 'next/link'
import {
  Package,
  Zap,
  CheckCircle2,
  DollarSign,
  ArrowRight,
  Film,
  Brain,
  Library,
  MonitorPlay,
  Clock,
} from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AdCraftLogoMark } from '@/components/layout/AdCraftLogo'
import { useDashboard, pipelineProductName, type RecentPipeline } from '@/hooks/useDashboard'
import { cn } from '@/lib/utils'

// ── helpers ───────────────────────────────────────────────────────────────────

const GOAL_LABEL: Record<string, string> = {
  full:         'Pipeline Completo',
  pesquisa:     'Pesquisa',
  criativo:     'Criativo',
  lancamento:   'Lançamento',
  market_only:  'Mercado',
  avatar_only:  'Avatar',
  angles_only:  'Ângulos',
  copy_only:    'Copy',
  creative_full:'Criativo Full',
}

const STATUS_STYLE: Record<string, string> = {
  running:   'text-[#60A5FA] bg-[rgba(59,130,246,0.12)]',
  completed: 'text-[#4ADE80] bg-[rgba(34,197,94,0.12)]',
  failed:    'text-[#F87171] bg-[rgba(239,68,68,0.12)]',
  pending:   'text-[#A1A1AA] bg-[rgba(161,161,170,0.12)]',
  paused:    'text-[#FCD34D] bg-[rgba(245,158,11,0.12)]',
}

const STATUS_DOT: Record<string, string> = {
  running:   'bg-[#60A5FA] animate-pulse',
  completed: 'bg-[#4ADE80]',
  failed:    'bg-[#F87171]',
  pending:   'bg-[#A1A1AA]',
  paused:    'bg-[#FCD34D]',
}

const STATUS_LABEL: Record<string, string> = {
  running:   'Rodando',
  completed: 'Concluído',
  failed:    'Falhou',
  pending:   'Aguardando',
  paused:    'Pausado',
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m    = Math.floor(diff / 60_000)
  if (m < 1)   return 'agora'
  if (m < 60)  return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h`
  const d = Math.floor(h / 24)
  return `${d}d`
}

function formatCost(usd: number): string {
  return `$${usd.toFixed(2)}`
}

function todayLabel(): string {
  return new Date().toLocaleDateString('pt-BR', {
    weekday: 'short',
    day:     'numeric',
    month:   'short',
    year:    'numeric',
  })
}

// ── sub-components ────────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ReactNode
  label: string
  value: string | number
  sub?: string
  loading?: boolean
}

function KpiCard({ icon, label, value, sub, loading }: KpiCardProps) {
  return (
    <div className="bg-[#201F20] rounded-lg p-4 flex flex-col gap-3 border border-[#584237]/10">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[#9E9489] uppercase tracking-widest">{label}</span>
        <span className="text-[#9E9489]">{icon}</span>
      </div>
      {loading ? (
        <div className="h-8 w-20 bg-[#2A2829] rounded animate-pulse" />
      ) : (
        <span className="text-3xl font-semibold font-mono text-[#E8E3DD] tracking-tight leading-none">
          {value}
        </span>
      )}
      {sub && (
        <span className="text-xs text-[#6B6460]">{sub}</span>
      )}
    </div>
  )
}

interface PipelineRowProps {
  pipeline: RecentPipeline
}

function PipelineRow({ pipeline }: PipelineRowProps) {
  const status = pipeline.status ?? 'pending'
  const dot    = STATUS_DOT[status]   ?? STATUS_DOT.pending
  const badge  = STATUS_STYLE[status] ?? STATUS_STYLE.pending
  const name   = pipelineProductName(pipeline)
  const goal   = GOAL_LABEL[pipeline.goal] ?? pipeline.goal

  return (
    <Link
      href={`/api/pipelines/${pipeline.id}`}
      className="flex items-center gap-3 px-4 py-3 rounded hover:bg-[#2A2829] transition-colors duration-150 group"
    >
      <span className={cn('w-2 h-2 rounded-full shrink-0', dot)} />

      <div className="flex-1 min-w-0">
        <p className="text-sm text-[#E8E3DD] truncate font-medium">{name}</p>
        <p className="text-xs text-[#6B6460] truncate">{goal}</p>
      </div>

      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium shrink-0', badge)}>
        {STATUS_LABEL[status] ?? status}
      </span>

      {pipeline.cost_so_far_usd != null && pipeline.cost_so_far_usd > 0 && (
        <span className="text-xs font-mono text-[#6B6460] shrink-0">
          {formatCost(pipeline.cost_so_far_usd)}
        </span>
      )}

      <span className="text-xs font-mono text-[#6B6460] shrink-0 w-6 text-right">
        {relativeTime(pipeline.updated_at)}
      </span>

      <ArrowRight
        size={14}
        strokeWidth={1.5}
        className="text-[#6B6460] opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0"
      />
    </Link>
  )
}

const QUICK_LINKS = [
  { href: '/products',    label: 'Produtos',          Icon: Package,     sub: 'Gerenciar catálogo' },
  { href: '/creatives',   label: 'Criativos',         Icon: Film,        sub: 'Scripts e vídeos'   },
  { href: '/biblioteca',  label: 'Vídeos TikTok',     Icon: Library,     sub: 'Biblioteca UGC'     },
  { href: '/anuncios-fb', label: 'Anúncios Facebook', Icon: MonitorPlay, sub: 'Ad Library'         },
  { href: '/insights',    label: 'Memória',           Icon: Brain,       sub: 'Learnings e nichos' },
]

// ── page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { stats, isLoading } = useDashboard()

  return (
    <ScrollArea className="flex-1 h-full">
      <div className="min-h-full bg-[#131314] px-8 py-8 space-y-8 max-w-5xl mx-auto">

        {/* ── Page header ── */}
        <header className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <AdCraftLogoMark size={36} />
            <div>
              <h1 className="text-xl font-semibold text-[#E8E3DD] tracking-tight leading-tight">
                Dashboard
              </h1>
              <p className="text-xs text-[#6B6460] font-mono capitalize mt-0.5">
                {todayLabel()}
              </p>
            </div>
          </div>

          <Link
            href="/products"
            className="flex items-center gap-1.5 text-xs text-[#9E9489] hover:text-[#E8E3DD] transition-colors duration-150 bg-[#201F20] px-3 py-2 rounded"
          >
            <Package size={14} strokeWidth={1.5} />
            Novo produto
          </Link>
        </header>

        {/* ── KPI cards ── */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            icon={<Package size={16} strokeWidth={1.5} />}
            label="Produtos"
            value={stats.products_total}
            sub="ativos no sistema"
            loading={isLoading}
          />
          <KpiCard
            icon={<Zap size={16} strokeWidth={1.5} />}
            label="Pipelines"
            value={stats.pipelines_running}
            sub="rodando agora"
            loading={isLoading}
          />
          <KpiCard
            icon={<CheckCircle2 size={16} strokeWidth={1.5} />}
            label="Concluídos"
            value={stats.pipelines_completed_30d}
            sub="nos últimos 30 dias"
            loading={isLoading}
          />
          <KpiCard
            icon={<DollarSign size={16} strokeWidth={1.5} />}
            label="Custo 30d"
            value={isLoading ? '—' : formatCost(stats.total_cost_30d_usd)}
            sub="em pipelines executados"
            loading={isLoading}
          />
        </section>

        {/* ── Bottom split ── */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Recent activity — 2/3 */}
          <div className="md:col-span-2 bg-[#201F20] rounded-lg border border-[#584237]/10 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#584237]/10">
              <Clock size={14} strokeWidth={1.5} className="text-[#9E9489]" />
              <h2 className="text-xs font-medium text-[#9E9489] uppercase tracking-widest">
                Atividade Recente
              </h2>
            </div>

            {isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-10 bg-[#2A2829] rounded animate-pulse" />
                ))}
              </div>
            ) : stats.recent_pipelines.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center gap-2">
                <Zap size={28} strokeWidth={1} className="text-[#353436]" />
                <p className="text-sm text-[#6B6460]">Nenhum pipeline ainda</p>
                <p className="text-xs text-[#6B6460]">Execute um pipeline em qualquer produto para ver a atividade aqui.</p>
              </div>
            ) : (
              <div className="py-1">
                {stats.recent_pipelines.map((p) => (
                  <PipelineRow key={p.id} pipeline={p} />
                ))}
              </div>
            )}
          </div>

          {/* Quick links — 1/3 */}
          <div className="bg-[#201F20] rounded-lg border border-[#584237]/10 overflow-hidden">
            <div className="px-4 py-3 border-b border-[#584237]/10">
              <h2 className="text-xs font-medium text-[#9E9489] uppercase tracking-widest">
                Acesso Rápido
              </h2>
            </div>

            <nav className="py-1">
              {QUICK_LINKS.map(({ href, label, Icon, sub }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 px-4 py-3 rounded mx-1 hover:bg-[#2A2829] transition-colors duration-150 group"
                >
                  <Icon size={16} strokeWidth={1.5} className="text-[#9E9489] group-hover:text-[#F28705] transition-colors duration-150 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-[#E8E3DD] font-medium leading-tight">{label}</p>
                    <p className="text-xs text-[#6B6460] leading-tight">{sub}</p>
                  </div>
                  <ArrowRight
                    size={14}
                    strokeWidth={1.5}
                    className="ml-auto text-[#6B6460] opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0"
                  />
                </Link>
              ))}
            </nav>
          </div>

        </section>
      </div>
    </ScrollArea>
  )
}
