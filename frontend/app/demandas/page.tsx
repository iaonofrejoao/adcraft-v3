'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { StatusBadge } from '@/components/ui/StatusBadge'

// ── Tipos ────────────────────��──────────────────────────────────────────���─────

interface Task {
  id:           string
  pipeline_id:  string
  agent_name:   string
  mode:         string | null
  status:       string
  retry_count:  number
  error:        string | null
  started_at:   string | null
  completed_at: string | null
  created_at:   string
  pipeline?:    { goal: string; product?: { name: string; sku: string } }
}

// ── Colunas do Kanban ─────────────────────────────────────────────────────────

const KANBAN_COLS: { id: string; label: string; statuses: string[] }[] = [
  { id: 'backlog',  label: 'Backlog',    statuses: ['pending', 'waiting'] },
  { id: 'running',  label: 'Executando', statuses: ['running'] },
  { id: 'done',     label: 'Concluído',  statuses: ['completed', 'skipped'] },
  { id: 'failed',   label: 'Falha',      statuses: ['failed'] },
]

const AGENT_ICONS: Record<string, string> = {
  avatar_research:    '👤',
  market_research:    '📊',
  angle_generator:    '🎯',
  copy_hook_generator:'✍️',
  anvisa_compliance:  '⚖️',
  video_maker:        '🎬',
  niche_curator:      '🏷️',
}

// ── Página ─────────────────────────────────────────────────────────────────────

export default function DemandasPage() {
  const [tasks,   setTasks]   = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  // Carga inicial
  useEffect(() => {
    fetch('/api/tasks?limit=100&order=created_at.desc')
      .then((r) => r.json())
      .then((d) => setTasks(d.tasks ?? d ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Realtime via Supabase
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('tasks_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setTasks((prev) => [payload.new as Task, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Task
            setTasks((prev) => prev.map((t) => t.id === updated.id ? { ...t, ...updated } : t))
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b shrink-0"
        style={{ borderColor: 'var(--border-default)', background: 'var(--surface-page)' }}>
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Demandas</h1>
          <span className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: 'var(--brand-subtle)', color: 'var(--brand-primary)' }}>
            Realtime
          </span>
        </div>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {tasks.filter((t) => t.status === 'running').length} tasks em execução
        </p>
      </header>

      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <span className="animate-pulse text-sm" style={{ color: 'var(--text-muted)' }}>Carregando…</span>
        </div>
      ) : (
        /* Kanban board */
        <div className="flex-1 overflow-x-auto px-4 py-4">
          <div className="flex gap-4 h-full min-w-max">
            {KANBAN_COLS.map((col) => {
              const colTasks = tasks.filter((t) => col.statuses.includes(t.status))
              return (
                <KanbanColumn
                  key={col.id}
                  label={col.label}
                  tasks={colTasks}
                  highlight={col.id === 'running'}
                />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── KanbanColumn ─────────────────────────────────��────────────────────────────

function KanbanColumn({ label, tasks, highlight }: { label: string; tasks: Task[]; highlight?: boolean }) {
  return (
    <div className="flex flex-col w-72 shrink-0 rounded-xl overflow-hidden"
      style={{ background: 'var(--surface-sidebar)', border: highlight ? '1px solid var(--brand-primary)' : '1px solid var(--border-default)' }}>
      <div className="px-4 py-2.5 flex items-center justify-between border-b"
        style={{ borderColor: 'var(--border-default)' }}>
        <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</h3>
        <span className="text-xs px-1.5 py-0.5 rounded-full"
          style={{ background: 'var(--surface-card)', color: 'var(--text-secondary)' }}>
          {tasks.length}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {tasks.length === 0 ? (
          <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>
            Vazio
          </p>
        ) : (
          tasks.map((task) => <TaskCard key={task.id} task={task} />)
        )}
      </div>
    </div>
  )
}

// ── TaskCard ────────────────────────────────────────���─────────────────────────

function TaskCard({ task }: { task: Task }) {
  const icon    = AGENT_ICONS[task.agent_name] ?? '🤖'
  const isRunning = task.status === 'running'

  // Duração
  let duration: string | null = null
  if (task.started_at && task.completed_at) {
    const ms = new Date(task.completed_at).getTime() - new Date(task.started_at).getTime()
    duration = ms < 60000 ? `${(ms / 1000).toFixed(1)}s` : `${(ms / 60000).toFixed(1)}m`
  }

  return (
    <div className="rounded-xl border px-3 py-2.5"
      style={{
        background:   'var(--surface-card)',
        borderColor:  isRunning ? 'var(--brand-primary)' : 'var(--border-default)',
        boxShadow:    isRunning ? '0 0 0 1px var(--brand-primary)' : 'none',
      }}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`text-base ${isRunning ? 'animate-pulse-slow' : ''}`}>{icon}</span>
        <span className="text-xs font-medium flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
          {task.agent_name.replace(/_/g, ' ')}
        </span>
        <StatusBadge status={task.status as 'running' | 'completed' | 'failed' | 'pending' | 'waiting' | 'skipped'} />
      </div>

      {task.pipeline && (
        <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
          {task.pipeline.goal}
          {task.pipeline.product && ` · @${task.pipeline.product.sku}`}
        </p>
      )}

      {task.mode && (
        <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>modo: {task.mode}</span>
      )}

      {task.retry_count > 0 && (
        <p className="text-xs mt-1" style={{ color: 'var(--status-warning)' }}>
          retry #{task.retry_count}
        </p>
      )}

      {task.error && (
        <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--status-error)' }}>
          {task.error}
        </p>
      )}

      <div className="flex items-center justify-between mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
        <span>{new Date(task.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
        {duration && <span className="font-mono">{duration}</span>}
      </div>
    </div>
  )
}
