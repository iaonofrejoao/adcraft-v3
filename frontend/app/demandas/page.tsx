'use client'
import { useTasks } from '@/hooks/useTasks'
import { KanbanBoard } from '@/components/demandas-kanban'

export default function DemandasPage() {
  const { tasks, isLoading, tasksByStatus } = useTasks()

  return (
    <KanbanBoard
      tasks={tasks}
      isLoading={isLoading}
      tasksByStatus={tasksByStatus}
    />
  )
}
