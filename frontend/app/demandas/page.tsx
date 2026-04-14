'use client'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTasks } from '@/hooks/useTasks'
import { KanbanBoard } from '@/components/demandas-kanban'

function DemandasContent() {
  const searchParams = useSearchParams()
  const filterPipelineId = searchParams.get('pipeline') ?? undefined
  const { tasks, isLoading, tasksByStatus } = useTasks()

  return (
    <KanbanBoard
      tasks={tasks}
      isLoading={isLoading}
      tasksByStatus={tasksByStatus}
      filterPipelineId={filterPipelineId}
    />
  )
}

export default function DemandasPage() {
  return (
    <Suspense>
      <DemandasContent />
    </Suspense>
  )
}
