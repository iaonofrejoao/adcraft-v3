---
name: websocket-realtime
description: >
  Implement real-time communication between frontend and backend using WebSockets
  and Supabase Realtime for live status updates, node execution progress, notifications,
  and bidirectional data flow in AI agent platforms. Use this skill whenever building
  real-time features including live node status, execution progress, cost counters,
  notifications, or any UI that updates without page refresh. Triggers on: WebSocket,
  real-time, live updates, Supabase Realtime, execution progress, node status,
  reconnect, or any feature that requires the frontend to reflect backend changes instantly.
---

# WebSocket + Supabase Realtime

Skill para implementar comunicação em tempo real entre o frontend Next.js e o backend FastAPI,
cobrindo status de execução de agentes, notificações e reconexão automática.

---

## Estratégia de Tempo Real do AdCraft

O sistema usa duas camadas de tempo real com propósitos distintos:

**Supabase Realtime** — para mudanças de estado persistidas no banco (status de execução, notificações, conclusão de fluxo). Confiável, persistente, funciona mesmo se o browser estava fechado.

**WebSocket direto (FastAPI)** — para eventos de alta frequência durante a execução (custo acumulando token a token, fila de API, progresso interno de um agente). Mais rápido mas não persistido.

---

## Supabase Realtime — Status de Execução

### Backend — publicar mudança de status

```python
# app/orchestration/executor.py
from app.database import get_supabase

async def update_node_status(
    execution_id: str,
    node_id: str,
    status: str,
    cost_usd: float | None = None,
    tooltip_message: str | None = None
) -> None:
    """
    Atualiza o status de um nó no banco.
    O Supabase Realtime publica automaticamente para o frontend.
    """
    supabase = get_supabase()

    update_data = {
        "node_statuses": {
            node_id: {
                "status": status,
                "updated_at": "now()",
                "cost_usd": cost_usd,
                "tooltip_message": tooltip_message,
            }
        }
    }

    supabase.table("executions") \
        .update(update_data) \
        .eq("id", execution_id) \
        .execute()
```

### Frontend — hook de status dos nós

```tsx
// hooks/useNodeStatus.ts
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

interface NodeStatus {
  status: string
  costUsd?: number
  tooltipMessage?: string
}

export function useNodeStatus(executionId: string) {
  const [nodeStatuses, setNodeStatuses] = useState<Record<string, NodeStatus>>({})
  const supabase = createClient()

  useEffect(() => {
    if (!executionId) return

    // Busca estado inicial
    supabase
      .from('executions')
      .select('node_statuses')
      .eq('id', executionId)
      .single()
      .then(({ data }) => {
        if (data?.node_statuses) {
          setNodeStatuses(data.node_statuses)
        }
      })

    // Inscreve para atualizações em tempo real
    const channel = supabase
      .channel(`execution:${executionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'executions',
          filter: `id=eq.${executionId}`,
        },
        (payload) => {
          if (payload.new?.node_statuses) {
            setNodeStatuses(payload.new.node_statuses)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [executionId])

  return { nodeStatuses }
}
```

---

## WebSocket Direto — FastAPI

### Backend — endpoint WebSocket

```python
# app/api/websocket.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.orchestration.connection_manager import ConnectionManager

router = APIRouter()
manager = ConnectionManager()

@router.websocket("/ws/execution/{execution_id}")
async def execution_websocket(websocket: WebSocket, execution_id: str):
    """
    WebSocket para eventos de alta frequência durante execução.
    Envia: custo acumulando, fila de API, progresso de token.
    """
    await manager.connect(execution_id, websocket)
    try:
        while True:
            # Mantém conexão viva com ping/pong
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(execution_id, websocket)
```

```python
# app/orchestration/connection_manager.py
from fastapi import WebSocket
from collections import defaultdict
import json

class ConnectionManager:
    def __init__(self):
        # Múltiplas conexões por execução (múltiplas abas)
        self.active: dict[str, list[WebSocket]] = defaultdict(list)

    async def connect(self, execution_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active[execution_id].append(websocket)

    def disconnect(self, execution_id: str, websocket: WebSocket):
        self.active[execution_id].remove(websocket)

    async def broadcast(self, execution_id: str, event: dict):
        """Envia evento para todas as conexões daquela execução."""
        dead = []
        for ws in self.active.get(execution_id, []):
            try:
                await ws.send_text(json.dumps(event))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.active[execution_id].remove(ws)

    async def send_cost_update(
        self,
        execution_id: str,
        node_id: str,
        tokens: int,
        cost_usd: float,
        total_cost_usd: float
    ):
        await self.broadcast(execution_id, {
            "type": "cost_update",
            "node_id": node_id,
            "tokens": tokens,
            "cost_usd": cost_usd,
            "total_cost_usd": total_cost_usd,
        })

    async def send_queue_status(
        self,
        execution_id: str,
        node_id: str,
        api_name: str,
        queue_position: int,
        wait_seconds: int
    ):
        await self.broadcast(execution_id, {
            "type": "queue_status",
            "node_id": node_id,
            "api_name": api_name,
            "queue_position": queue_position,
            "wait_seconds": wait_seconds,
        })
```

### Frontend — hook WebSocket com reconexão automática

```tsx
// hooks/useWebSocket.ts
'use client'
import { useEffect, useRef, useCallback } from 'react'

interface WebSocketEvent {
  type: 'cost_update' | 'queue_status'
  node_id: string
  [key: string]: any
}

interface UseWebSocketOptions {
  onCostUpdate?: (nodeId: string, costUsd: number, totalCostUsd: number) => void
  onQueueStatus?: (nodeId: string, apiName: string, waitSeconds: number) => void
}

export function useWebSocket(executionId: string, options: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()
  const isUnmountingRef = useRef(false)

  const connect = useCallback(() => {
    if (isUnmountingRef.current) return

    const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL}/ws/execution/${executionId}`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      console.log(`WebSocket conectado para execução ${executionId}`)
      // Ping periódico para manter conexão viva
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send('ping')
        }
      }, 30000)
      ws.addEventListener('close', () => clearInterval(pingInterval))
    }

    ws.onmessage = (event) => {
      const data: WebSocketEvent = JSON.parse(event.data)

      switch (data.type) {
        case 'cost_update':
          options.onCostUpdate?.(data.node_id, data.cost_usd, data.total_cost_usd)
          break
        case 'queue_status':
          options.onQueueStatus?.(data.node_id, data.api_name, data.wait_seconds)
          break
      }
    }

    ws.onclose = () => {
      if (!isUnmountingRef.current) {
        // Reconecta após 3 segundos
        reconnectTimeoutRef.current = setTimeout(connect, 3000)
      }
    }

    ws.onerror = () => ws.close()
  }, [executionId, options])

  useEffect(() => {
    isUnmountingRef.current = false
    connect()

    return () => {
      isUnmountingRef.current = true
      clearTimeout(reconnectTimeoutRef.current)
      wsRef.current?.close()
    }
  }, [connect])
}
```

---

## Notificações via Supabase Realtime

```tsx
// hooks/useNotifications.ts
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

interface Notification {
  id: string
  type: 'failure' | 'completion'
  title: string
  message: string
  execution_id: string
  read: boolean
  created_at: string
}

export function useNotifications(userId: string) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const supabase = createClient()

  useEffect(() => {
    // Busca notificações não lidas
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('read', false)
      .order('created_at', { ascending: false })
      .then(({ data }) => setNotifications(data || []))

    // Inscreve para novas notificações
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setNotifications(prev => [payload.new as Notification, ...prev])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  const markAsRead = async (notificationId: string) => {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)

    setNotifications(prev =>
      prev.filter(n => n.id !== notificationId)
    )
  }

  return { notifications, unreadCount: notifications.length, markAsRead }
}
```

### Backend — publicar notificação

```python
# app/orchestration/notifier.py
from app.database import get_supabase

async def notify_completion(execution_id: str, user_id: str, total_cost_usd: float):
    supabase = get_supabase()
    supabase.table("notifications").insert({
        "user_id": user_id,
        "execution_id": execution_id,
        "type": "completion",
        "title": "Execução concluída",
        "message": f"Fluxo finalizado com sucesso. Custo total: ${total_cost_usd:.4f}",
        "read": False,
    }).execute()

async def notify_failure(execution_id: str, user_id: str, node_name: str, error: str):
    supabase = get_supabase()
    supabase.table("notifications").insert({
        "user_id": user_id,
        "execution_id": execution_id,
        "type": "failure",
        "title": f"Falha no nó: {node_name}",
        "message": error,
        "read": False,
    }).execute()
```

---

## Tabela de notificações (SQL)

```sql
CREATE TABLE notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  execution_id UUID REFERENCES executions(id) ON DELETE SET NULL,
  type         VARCHAR(50) NOT NULL CHECK (type IN ('failure', 'completion')),
  title        VARCHAR(255) NOT NULL,
  message      TEXT NOT NULL,
  read         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_unread
  ON notifications(user_id) WHERE read = FALSE;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_notifications" ON notifications
  FOR ALL USING (user_id = auth.uid());

COMMENT ON TABLE notifications IS
  'Notificações de conclusão e falha de execuções. Publicadas via Supabase Realtime para o frontend.';
```
