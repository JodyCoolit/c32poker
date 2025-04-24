from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from typing import Dict
import json
from managers.room_manager import RoomManager
from database.db_manager import DBManager

app = FastAPI()
room_manager = RoomManager()
db_manager = DBManager()

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        
    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        
    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
            
    async def broadcast_to_room(self, room_id: str, message: dict):
        room = room_manager.get_room(room_id)
        if room:
            for username in room.players:
                if username in self.active_connections:
                    await self.active_connections[username].send_json(message)

manager = ConnectionManager()

@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_json()
            
            if data["type"] == "game_action":
                room = room_manager.get_room(data["room_id"])
                if room and room.game:
                    # Handle game actions (bet, fold, etc.)
                    await handle_game_action(room, data)
                    
            elif data["type"] == "chat":
                # Handle chat messages
                await manager.broadcast_to_room(
                    data["room_id"],
                    {
                        "type": "chat",
                        "user": user_id,
                        "message": data["message"]
                    }
                )
                
    except WebSocketDisconnect:
        manager.disconnect(user_id)

async def handle_game_action(room, data):
    action = data["action"]
    player = data["username"]
    amount = data.get("amount", 0)
    
    if room.game.handle_action(player, action, amount):
        # Broadcast updated game state
        await manager.broadcast_to_room(
            room.room_id,
            {
                "type": "game_state",
                "state": room.game.get_state()
            }
        )