'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

export interface Task {
  id: string
  pipeline_id: string
  agent_name: string
  mode: string | null
  status: string
  retry_count: number
  error: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  pipeline?: { goal: string; product?: { name: string; sku: string } }
}

export interface UseTasksReturn {
  tasks: Task[]
  isLoading: boolean
  tasksByStatus: Record<string, Task[]>
}

export function useTasks(): UseTasksReturn {
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Carga inicial
  useEffect(() => {
    fetch('/api/tasks?limit=100&order=created_at.desc')
      .then((r) => r.json())
      .then((d) => setTasks(d.tasks ?? d ?? []))
      .catch((err) => console.error('[useTasks] fetch failed', err))
      .finally(() => setIsLoading(false))
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
          try {
            if (payload.eventType === 'INSERT') {
              setTasks((prev) => [payload.new as Task, ...prev])
            } else if (payload.eventType === 'UPDATE') {
              const updated = payload.new as Task
              setTasks((prev) =>
                prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)),
              )
            }
          } catch (err) {
            console.error('[useTasks] realtime payload error', err)
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const tasksByStatus = tasks.reduce<Record<string, Task[]>>((acc, task) => {
    if (!acc[task.status]) acc[task.status] = []
    acc[task.status].push(task)
    return acc
  }, {})

  return { tasks, isLoading, tasksByStatus }
}
