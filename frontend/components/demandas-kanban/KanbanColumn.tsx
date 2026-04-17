import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TaskCard } from './TaskCard'
import type { Task } from '@/hooks/useTasks'

export interface KanbanColumnProps {
  id: string
  label: string
  icon: LucideIcon
  colorClass: string
  tasks: Task[]
  onCardClick?: (pipelineId: string) => void
}

export function KanbanColumn({ label, icon: Icon, colorClass, tasks, onCardClick }: KanbanColumnProps) {
  return (
    <div className="w-[280px] shrink-0 flex flex-col min-h-0 h-full">
      {/* Cabeçalho da coluna */}
      <div className="flex items-center gap-2 mb-4 px-1 shrink-0">
        <Icon size={16} strokeWidth={1.5} className={colorClass} />
        <span className={cn('font-bold text-[13px] uppercase tracking-wide', colorClass)}>
          {label}
        </span>
        <span className="font-mono text-[12px] text-[#6B6460] ml-0.5">
          ({tasks.length})
        </span>
      </div>

      {/* Cards com scroll independente */}
      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full pr-1">
          <div className="space-y-4 pr-1 pb-4">
            {tasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#584237]/20 p-6 text-center">
                <p className="text-[12px] text-[#6B6460]">Nenhuma tarefa</p>
              </div>
            ) : (
              tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onClick={() => onCardClick?.(task.pipeline_id)}
              />
            ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
