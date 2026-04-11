from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.orchestration.connection_manager import manager

router = APIRouter()

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
