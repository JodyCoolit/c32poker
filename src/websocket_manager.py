import asyncio
from fastapi import WebSocket
from typing import Dict, List, Any, Optional, Set
import time
import traceback
import json

class ConnectionManager:
    def __init__(self):
        # Map of client_id to WebSocket connection
        self.active_connections: Dict[str, WebSocket] = {}
        
        # Track connection status of each client
        self.connection_status: Dict[str, str] = {}  # "connected", "disconnected"
        
        # Map of room_id to list of client_ids
        self.room_players: Dict[str, List[str]] = {}
        
        # Message queue for room broadcasts
        self.message_queues: Dict[str, asyncio.Queue] = {}
        
        # Background tasks
        self.background_tasks: Set[asyncio.Task] = set()
        
        # 跟踪每个玩家当前活跃的房间
        self.player_active_room: Dict[str, str] = {}  # username -> active_room_id

    async def _handle_connection(self, websocket: WebSocket, client_id: str, room_id: str) -> bool:
        """
        处理websocket连接逻辑，用于connect和reconnect的共享代码
        """
        try:
            await websocket.accept()
            self.active_connections[client_id] = websocket
            self.connection_status[client_id] = "connected"
            
            # 更新玩家活跃房间
            self.player_active_room[client_id] = room_id
            # 确保玩家被添加到房间的玩家列表中
            self.add_client_to_room(room_id, client_id)
            print(f"Client {client_id} connected to room {room_id}")
            
            return True
        except Exception as e:
            print(f"Error handling connection for client {client_id}: {str(e)}")
            traceback.print_exc()
            return False

    async def connect(self, websocket: WebSocket, client_id: str, room_id: str):
        """
        接受一个新的WebSocket连接，并处理单一活跃连接
        """
        # 检查玩家是否在其他房间有活跃连接
        if client_id in self.player_active_room:
            old_room_id = self.player_active_room[client_id]
            if old_room_id != room_id:
                print(f"Client {client_id} already connected to room {old_room_id}, moving to room {room_id}")
                # 从旧房间移除玩家
                self.remove_client_from_room(old_room_id, client_id)
        
        # 处理连接
        return await self._handle_connection(websocket, client_id, room_id)

    async def reconnect(self, websocket: WebSocket, client_id: str, room_id: str) -> bool:
        """
        处理重新连接的客户端，确保只能重连到之前的活跃房间或指定的新房间
        """
        # 检查玩家是否有先前的活跃房间
        if client_id in self.player_active_room:
            old_room_id = self.player_active_room[client_id]
            if old_room_id != room_id:
                print(f"Client {client_id} attempting to reconnect to different room: old={old_room_id}, new={room_id}")
                # 允许重连到新房间，但会从旧房间移除
                self.remove_client_from_room(old_room_id, client_id)
        
        # 处理重连
        return await self._handle_connection(websocket, client_id, room_id)

    def disconnect(self, client_id: str):
        """
        将客户端标记为断开连接
        """
        if client_id in self.active_connections:
            self.connection_status[client_id] = "disconnected"
            del self.active_connections[client_id]
            print(f"Client {client_id} disconnected")
            
            # 保留玩家活跃房间信息用于重连
            # 不从player_active_room中删除
            
            # 但从房间玩家列表中移除（仍可通过player_active_room重连）
            for room_id, players in self.room_players.items():
                if client_id in players:
                    players.remove(client_id)
                    print(f"Marked {client_id} as disconnected from room {room_id}")

    async def force_disconnect(self, client_id: str, reason: str = "Disconnected by server"):
        """
        强制断开客户端连接
        """
        if client_id in self.active_connections:
            try:
                websocket = self.active_connections[client_id]
                await websocket.close(code=1000, reason=reason)
                print(f"Forcibly disconnected client {client_id}: {reason}")
            except Exception as e:
                print(f"Error forcibly disconnecting client {client_id}: {str(e)}")
            finally:
                self.disconnect(client_id)
                
    def get_client_room(self, client_id: str) -> Optional[str]:
        """
        获取客户端当前所在的活跃房间
        """
        return self.player_active_room.get(client_id)

    async def send_personal_message(self, message: dict, client_id: str):
        """
        Send a message to a specific client
        """
        if client_id in self.active_connections and self.connection_status.get(client_id) == "connected":
            try:
                await self.active_connections[client_id].send_json(message)
                return True
            except Exception as e:
                print(f"Error sending message to {client_id}: {str(e)}")
                return False
        else:
            # 客户端不在线，消息无法发送
            return False

    async def broadcast(self, message: dict):
        """
        Broadcast a message to all connected clients
        """
        disconnected_clients = []
        for client_id, connection in list(self.active_connections.items()):
            try:
                if self.connection_status.get(client_id) == "connected":
                    await connection.send_json(message)
                else:
                    disconnected_clients.append(client_id)
            except Exception as e:
                print(f"Error broadcasting to {client_id}: {str(e)}")
                disconnected_clients.append(client_id)
        
        return disconnected_clients

    async def broadcast_to_room(self, room_id: str, message: dict):
        """
        Broadcast a message to all clients in a specific room
        """
        if room_id not in self.room_players:
            print(f"No players in room {room_id}")
            return []
        
        disconnected_clients = []
        for client_id in list(self.room_players.get(room_id, [])):
            # Check if client is connected
            if client_id in self.active_connections and self.connection_status.get(client_id) == "connected":
                try:
                    await self.active_connections[client_id].send_json(message)
                except Exception as e:
                    print(f"Error broadcasting to room member {client_id}: {str(e)}")
                    disconnected_clients.append(client_id)
            else:
                disconnected_clients.append(client_id)
        
        return disconnected_clients

    def add_client_to_room(self, room_id: str, client_id: str):
        """
        Add a client to a room for broadcasting
        """
        if room_id not in self.room_players:
            self.room_players[room_id] = []
        
        if client_id not in self.room_players[room_id]:
            self.room_players[room_id].append(client_id)
            print(f"Added {client_id} to room {room_id}")
            return True
        return False

    def remove_client_from_room(self, room_id: str, client_id: str):
        """
        Remove a client from a room
        """
        if room_id in self.room_players and client_id in self.room_players[room_id]:
            self.room_players[room_id].remove(client_id)
            print(f"Removed {client_id} from room {room_id}")
            return True
        return False

    async def start_room_broadcaster(self, room_id: str):
        """
        Start a background task to broadcast messages to a room
        """
        if room_id not in self.message_queues:
            self.message_queues[room_id] = asyncio.Queue()
            
            # Create a new task for this room
            task = asyncio.create_task(self._room_broadcaster(room_id))
            self.background_tasks.add(task)
            task.add_done_callback(lambda t: self.background_tasks.remove(t))
            
            print(f"Started room broadcaster for room {room_id}")
            return True
        return False

    async def _room_broadcaster(self, room_id: str):
        """
        Background task to process and broadcast messages for a room
        """
        try:
            while True:
                # Get message from queue
                message = await self.message_queues[room_id].get()
                
                # Check for shutdown signal
                if message.get("type") == "_shutdown":
                    print(f"Shutting down room broadcaster for room {room_id}")
                    break
                
                # Broadcast message to room
                await self.broadcast_to_room(room_id, message)
                
                # Mark task as done
                self.message_queues[room_id].task_done()
                
                # Small delay to prevent hammering
                await asyncio.sleep(0.01)
        except asyncio.CancelledError:
            print(f"Room broadcaster for room {room_id} cancelled")
        except Exception as e:
            print(f"Error in room broadcaster for room {room_id}: {str(e)}")
            traceback.print_exc()
        finally:
            if room_id in self.message_queues:
                del self.message_queues[room_id]

    async def queue_room_message(self, room_id: str, message: dict):
        """
        Queue a message for broadcasting to a room
        """
        if room_id not in self.message_queues:
            await self.start_room_broadcaster(room_id)
        
        await self.message_queues[room_id].put(message)
        return True

    async def shutdown_room_broadcaster(self, room_id: str):
        """
        Shut down the broadcaster for a room
        """
        if room_id in self.message_queues:
            await self.message_queues[room_id].put({"type": "_shutdown"})
            print(f"Sent shutdown signal to room broadcaster for room {room_id}")
            return True
        return False

    async def get_active_clients(self, room_id: Optional[str] = None) -> List[str]:
        """
        Get a list of active client IDs, optionally filtered by room
        """
        if room_id:
            return [client_id for client_id in self.room_players.get(room_id, []) 
                    if client_id in self.active_connections and 
                    self.connection_status.get(client_id) == "connected"]
        else:
            return [client_id for client_id, status in self.connection_status.items() 
                    if status == "connected"]

    def is_client_connected(self, client_id: str) -> bool:
        """
        Check if a client is currently connected
        """
        return (client_id in self.active_connections and 
                self.connection_status.get(client_id) == "connected")

    async def send_player_specific_state(self, client_id: str, player_hand: list = None):
        """
        Send player-specific game state (including their hand)
        """
        # Make a copy of the game state to avoid modifying the original
        player_hand_state = {}
        
        player_hand_state["my_hand"] = player_hand[0]
        player_hand_state["discarded_card"] = player_hand[1]
        
        await self.send_personal_message({
            "type": "player_hand",
            "data": player_hand_state
        }, client_id)

# Create a singleton instance
ws_manager = ConnectionManager() 