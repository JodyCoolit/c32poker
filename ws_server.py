import asyncio
import json
import logging
import sys
import time
import uuid
from datetime import datetime
from typing import Dict, List, Set, Optional, Any

import websockets
from websockets.server import WebSocketServerProtocol

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)

logger = logging.getLogger("WS_Server")

# Global state
connected_clients: Dict[str, WebSocketServerProtocol] = {}
rooms: Dict[str, Dict[str, Any]] = {}
client_rooms: Dict[str, Set[str]] = {}  # client_id -> set of room_ids

class GameServer:
    def __init__(self, host: str = "127.0.0.1", port: int = 8765):
        self.host = host
        self.port = port
        self.server = None
    
    async def handle_client(self, websocket: WebSocketServerProtocol, path: str):
        """Handle a client connection."""
        client_id = None
        
        try:
            # Wait for authentication message
            auth_message = await websocket.recv()
            auth_data = json.loads(auth_message)
            
            if auth_data.get("type") != "auth":
                await websocket.send(json.dumps({
                    "type": "error",
                    "message": "First message must be authentication"
                }))
                return
            
            client_id = auth_data.get("client_id")
            token = auth_data.get("token")
            
            # Simple token validation (in a real app, verify JWT)
            if not client_id or not token:
                await websocket.send(json.dumps({
                    "type": "error",
                    "message": "Invalid authentication data"
                }))
                return
                
            # Register client
            connected_clients[client_id] = websocket
            client_rooms[client_id] = set()
            
            logger.info(f"Client connected: {client_id}")
            
            # Main message loop
            async for message in websocket:
                await self.process_message(client_id, message)
                
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"Connection closed for client: {client_id}")
        except Exception as e:
            logger.error(f"Error handling client: {str(e)}")
        finally:
            # Clean up when the client disconnects
            if client_id:
                await self.handle_client_disconnect(client_id)
    
    async def process_message(self, client_id: str, message: str):
        """Process a message from a client."""
        try:
            data = json.loads(message)
            message_type = data.get("type")
            
            if message_type == "ping":
                # Handle ping message
                await self.send_to_client(client_id, {
                    "type": "pong",
                    "timestamp": data.get("timestamp", time.time())
                })
            elif message_type == "join_room":
                # Handle room join request
                await self.handle_join_room(client_id, data)
            elif message_type == "leave_room":
                # Handle room leave request
                await self.handle_leave_room(client_id, data)
            elif message_type == "chat":
                # Handle chat message
                await self.handle_chat_message(client_id, data)
            elif message_type == "game_action":
                # Handle game action
                await self.handle_game_action(client_id, data)
            else:
                # Handle unknown message type
                logger.warning(f"Unknown message type from {client_id}: {message_type}")
                await self.send_to_client(client_id, {
                    "type": "error",
                    "message": f"Unknown message type: {message_type}"
                })
                
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON from {client_id}: {message}")
            await self.send_to_client(client_id, {
                "type": "error",
                "message": "Invalid JSON message"
            })
        except Exception as e:
            logger.error(f"Error processing message from {client_id}: {str(e)}")
            await self.send_to_client(client_id, {
                "type": "error",
                "message": f"Server error: {str(e)}"
            })
    
    async def handle_join_room(self, client_id: str, data: Dict[str, Any]):
        """Handle a client joining a room."""
        room_id = data.get("room_id")
        
        if not room_id:
            await self.send_to_client(client_id, {
                "type": "error",
                "message": "Room ID is required"
            })
            return
            
        # Create room if it doesn't exist
        if room_id not in rooms:
            rooms[room_id] = {
                "id": room_id,
                "name": f"Room {room_id}",
                "created_at": datetime.now().isoformat(),
                "host": client_id,
                "players": [],
                "game_state": {
                    "status": "waiting",
                    "turn": None,
                    "pot": 0,
                    "community_cards": []
                },
                "messages": []
            }
            
        # Add client to room
        if client_id not in rooms[room_id]["players"]:
            rooms[room_id]["players"].append(client_id)
            
        # Add room to client's rooms
        client_rooms[client_id].add(room_id)
        
        # Send room state to client
        await self.send_room_state(room_id)
        
        # Notify other clients in room
        await self.broadcast_to_room(room_id, {
            "type": "player_joined",
            "room_id": room_id,
            "player_id": client_id,
            "timestamp": datetime.now().isoformat()
        }, exclude_client=client_id)
        
        logger.info(f"Client {client_id} joined room {room_id}")
    
    async def handle_leave_room(self, client_id: str, data: Dict[str, Any]):
        """Handle a client leaving a room."""
        room_id = data.get("room_id")
        
        if not room_id or room_id not in rooms:
            await self.send_to_client(client_id, {
                "type": "error",
                "message": "Invalid room ID"
            })
            return
            
        # Remove client from room
        if client_id in rooms[room_id]["players"]:
            rooms[room_id]["players"].remove(client_id)
            
        # Remove room from client's rooms
        if client_id in client_rooms and room_id in client_rooms[client_id]:
            client_rooms[client_id].remove(room_id)
            
        # Update host if needed
        if rooms[room_id]["host"] == client_id and rooms[room_id]["players"]:
            rooms[room_id]["host"] = rooms[room_id]["players"][0]
            
        # Delete room if empty
        if not rooms[room_id]["players"]:
            del rooms[room_id]
            logger.info(f"Room {room_id} deleted (empty)")
        else:
            # Send updated room state to remaining clients
            await self.send_room_state(room_id)
            
            # Notify other clients in room
            await self.broadcast_to_room(room_id, {
                "type": "player_left",
                "room_id": room_id,
                "player_id": client_id,
                "timestamp": datetime.now().isoformat()
            })
            
        logger.info(f"Client {client_id} left room {room_id}")
    
    async def handle_chat_message(self, client_id: str, data: Dict[str, Any]):
        """Handle a chat message from a client."""
        room_id = data.get("room_id")
        message = data.get("message")
        
        if not room_id or room_id not in rooms:
            await self.send_to_client(client_id, {
                "type": "error",
                "message": "Invalid room ID"
            })
            return
            
        if not message:
            await self.send_to_client(client_id, {
                "type": "error",
                "message": "Message cannot be empty"
            })
            return
            
        # Add message to room history
        chat_message = {
            "id": str(uuid.uuid4()),
            "room_id": room_id,
            "sender": client_id,
            "message": message,
            "timestamp": datetime.now().isoformat()
        }
        
        rooms[room_id]["messages"].append(chat_message)
        
        # Broadcast to all clients in the room
        await self.broadcast_to_room(room_id, {
            "type": "chat",
            "room_id": room_id,
            "sender": client_id,
            "message": message,
            "timestamp": chat_message["timestamp"]
        })
        
        logger.info(f"Chat in room {room_id} from {client_id}: {message}")
    
    async def handle_game_action(self, client_id: str, data: Dict[str, Any]):
        """Handle a game action from a client."""
        room_id = data.get("room_id")
        action = data.get("action")
        amount = data.get("amount")
        
        if not room_id or room_id not in rooms:
            await self.send_to_client(client_id, {
                "type": "error",
                "message": "Invalid room ID"
            })
            return
            
        if not action:
            await self.send_to_client(client_id, {
                "type": "error",
                "message": "Action is required"
            })
            return
            
        # Simple game state update
        game_state = rooms[room_id]["game_state"]
        
        # Update game state based on action
        if action == "start":
            game_state["status"] = "playing"
            game_state["turn"] = client_id
            game_state["pot"] = 0
            game_state["community_cards"] = []
            
            logger.info(f"Game started in room {room_id}")
        elif action == "fold":
            game_state["turn"] = self._get_next_player(room_id, client_id)
            logger.info(f"Player {client_id} folded in room {room_id}")
        elif action == "call":
            game_state["pot"] += amount or 0
            game_state["turn"] = self._get_next_player(room_id, client_id)
            logger.info(f"Player {client_id} called in room {room_id}")
        elif action == "raise":
            if not amount:
                await self.send_to_client(client_id, {
                    "type": "error",
                    "message": "Amount is required for raise action"
                })
                return
                
            game_state["pot"] += amount
            game_state["turn"] = self._get_next_player(room_id, client_id)
            logger.info(f"Player {client_id} raised {amount} in room {room_id}")
        elif action == "check":
            game_state["turn"] = self._get_next_player(room_id, client_id)
            logger.info(f"Player {client_id} checked in room {room_id}")
        else:
            await self.send_to_client(client_id, {
                "type": "error",
                "message": f"Unknown action: {action}"
            })
            return
            
        # Send updated game state to all clients in the room
        await self.send_room_state(room_id)
    
    def _get_next_player(self, room_id: str, current_player: str) -> Optional[str]:
        """Get the next player in turn order."""
        players = rooms[room_id]["players"]
        if not players:
            return None
            
        try:
            current_index = players.index(current_player)
            next_index = (current_index + 1) % len(players)
            return players[next_index]
        except ValueError:
            return players[0] if players else None
    
    async def handle_client_disconnect(self, client_id: str):
        """Clean up when a client disconnects."""
        if client_id in connected_clients:
            del connected_clients[client_id]
            
        # Leave all rooms
        if client_id in client_rooms:
            rooms_to_leave = list(client_rooms[client_id])
            for room_id in rooms_to_leave:
                if room_id in rooms:
                    data = {"room_id": room_id}
                    await self.handle_leave_room(client_id, data)
                    
            del client_rooms[client_id]
            
        logger.info(f"Client disconnected: {client_id}")
    
    async def send_to_client(self, client_id: str, message: Dict[str, Any]) -> bool:
        """Send a message to a specific client."""
        if client_id not in connected_clients:
            return False
            
        try:
            await connected_clients[client_id].send(json.dumps(message))
            return True
        except Exception as e:
            logger.error(f"Error sending message to {client_id}: {str(e)}")
            return False
    
    async def broadcast_to_room(self, room_id: str, message: Dict[str, Any], exclude_client: Optional[str] = None) -> None:
        """Broadcast a message to all clients in a room."""
        if room_id not in rooms:
            return
            
        for player_id in rooms[room_id]["players"]:
            if exclude_client and player_id == exclude_client:
                continue
                
            await self.send_to_client(player_id, message)
    
    async def send_room_state(self, room_id: str) -> None:
        """Send the current room state to all clients in the room."""
        if room_id not in rooms:
            return
            
        room_data = {
            "type": "room_state",
            "room_id": room_id,
            "name": rooms[room_id]["name"],
            "host": rooms[room_id]["host"],
            "players": rooms[room_id]["players"],
            "created_at": rooms[room_id]["created_at"],
            "game_state": rooms[room_id]["game_state"],
            "timestamp": datetime.now().isoformat()
        }
        
        for player_id in rooms[room_id]["players"]:
            await self.send_to_client(player_id, room_data)
    
    async def start(self):
        """Start the WebSocket server."""
        logger.info(f"Starting WebSocket server on {self.host}:{self.port}")
        
        self.server = await websockets.serve(
            self.handle_client, 
            self.host, 
            self.port
        )
        
        logger.info(f"WebSocket server started on ws://{self.host}:{self.port}")
        
        # Keep the server running
        await self.server.wait_closed()
    
    async def stop(self):
        """Stop the WebSocket server."""
        if self.server:
            self.server.close()
            await self.server.wait_closed()
            logger.info("WebSocket server stopped")

async def main():
    """Run the WebSocket server."""
    server = GameServer()
    
    try:
        await server.start()
    except KeyboardInterrupt:
        logger.info("Server interrupted")
    except Exception as e:
        logger.error(f"Server error: {str(e)}")
    finally:
        await server.stop()

if __name__ == "__main__":
    asyncio.run(main()) 