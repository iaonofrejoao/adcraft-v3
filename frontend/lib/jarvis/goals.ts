import type { GoalName } from '@/lib/agent-registry'

export const JARVIS_GOALS: {
  command:     string
  goal:        GoalName
  label:       string
  description: string
}[] = [
  { command: '/avatar',  goal: 'avatar_only',  label: 'Avatar',              description: 'Pesquisa do cliente ideal'      },
  { command: '/mercado', goal: 'market_only',  label: 'Pesquisa de mercado', description: 'Mercado e concorrência'         },
  { command: '/angulos', goal: 'angles_only',  label: 'Ângulos',             description: 'Ângulos de marketing'          },
  { command: '/copy',    goal: 'copy_only',    label: 'Gerar copy',          description: 'Hooks, bodies e CTAs'          },
  { command: '/video',   goal: 'creative_full', label: 'Criar vídeo',        description: 'Criativo completo com VEO 3'   },
]
