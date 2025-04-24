import asyncio
import json
import logging
import time
import uuid
from typing import Dict, Set, Optional, List, Any, Callable, Awaitable

import jwt
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException
from pydantic import BaseModel

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("websocket_server")

# JWT Configuration
SECRET_KEY = "your-secret-key-keep-it-secret"
ALGORITHM = "HS256"

# WebSocket Server State
connected_clients: Dict[str, WebSocket] = {}  # client_id -> websocket
client_rooms: Dict[str, Set[str]] = {}  # client_id -> set of room_ids
room_clients: Dict[str, Set[str]] = {}  # room_id -> set of client_ids
client_user_data: Dict[str, Dict] = {}  # client_id -> user data

# Message handlers
message_handlers: Dict[str, Callable] = {}

# Models
class GameEvent(BaseModel):
    room_id: str
    event_type: str
    data: Dict[str, Any]

class ChatMessage(BaseModel):
    room_id: str
    user_id: str
    username: str
    message: str
    timestamp: float

# Client authentication and connection
async def verify_token(token: str) -> Dict:
    """Verify JWT token and return user data"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.PyJWTError as e:
        logger.error(f"JWT verification failed: {str(e)}")
        raise ValueError(f"Invalid token: {str(e)}")

async def client_connect(websocket: WebSocket, client_id: str, token: str) -> bool:
    """
    Handle new client connection
    """
    try:
        # Verify token
        user_data = await verify_token(token)
        
        # Accept connection
        await websocket.accept()
        
        # Store client connection
        connected_clients[client_id] = websocket
        client_rooms[client_id] = set()
        client_user_data[client_id] = user_data
        
        # Log connection
        logger.info(f"Client {client_id} connected")
        
        # Send welcome message
        await send_message_to_client(client_id, "connected", {
            "client_id": client_id,
            "message": "Connected to game server"
        })
        
        return True
    except ValueError as e:
        # Token verification failed
        await websocket.close(code=4001, reason=str(e))
        logger.warning(f"Client {client_id} auth failed: {str(e)}")
        return False
    except Exception as e:
        # Other errors
        logger.error(f"Error handling client connection: {str(e)}")
        try:
            await websocket.close(code=4000, reason="Internal server error")
        except:
            pass
        return False

async def client_disconnect(client_id: str) -> None:
    """
    Handle client disconnection
    """
    # Get rooms the client was in before removing
    rooms_to_leave = client_rooms.get(client_id, set()).copy()
    
    # Clean up client data
    if client_id in connected_clients:
        del connected_clients[client_id]
    
    if client_id in client_rooms:
        del client_rooms[client_id]
    
    if client_id in client_user_data:
        del client_user_data[client_id]
    
    # Remove client from all rooms
    for room_id in rooms_to_leave:
        await leave_room(client_id, room_id)
    
    logger.info(f"Client {client_id} disconnected")

# Room management
async def join_room(client_id: str, room_id: str) -> bool:
    """
    Add a client to a room
    """
    if client_id not in connected_clients:
        logger.warning(f"Cannot join room: Client {client_id} not connected")
        return False
    
    # Check if room exists in room manager
    # TODO: Add room existence validation with room manager
    
    # Add client to room
    if room_id not in room_clients:
        room_clients[room_id] = set()
    
    room_clients[room_id].add(client_id)
    client_rooms[client_id].add(room_id)
    
    # Notify client they joined the room
    await send_message_to_client(client_id, "room_joined", {
        "room_id": room_id
    })
    
    # Notify other clients in the room
    user_data = client_user_data.get(client_id, {})
    username = user_data.get("username", client_id)
    
    await broadcast_to_room(room_id, "user_joined", {
        "room_id": room_id,
        "user_id": client_id,
        "username": username
    }, exclude_client_id=client_id)
    
    logger.info(f"Client {client_id} joined room {room_id}")
    
    # Send current room state
    await send_room_state(room_id)
    
    return True

async def leave_room(client_id: str, room_id: str) -> bool:
    """
    Remove a client from a room
    """
    # Remove client from room
    if room_id in room_clients and client_id in room_clients[room_id]:
        room_clients[room_id].remove(client_id)
        
        # Clean up empty rooms
        if not room_clients[room_id]:
            del room_clients[room_id]
    
    # Remove room from client
    if client_id in client_rooms and room_id in client_rooms[client_id]:
        client_rooms[client_id].remove(room_id)
    
    # Notify other clients in the room
    if room_id in room_clients:
        user_data = client_user_data.get(client_id, {})
        username = user_data.get("username", client_id)
        
        await broadcast_to_room(room_id, "user_left", {
            "room_id": room_id,
            "user_id": client_id,
            "username": username
        })
    
    logger.info(f"Client {client_id} left room {room_id}")
    
    # Update room state for remaining clients
    if room_id in room_clients:
        await send_room_state(room_id)
    
    return True

async def send_room_state(room_id: str) -> None:
    """
    Send current room state to all clients in the room
    """
    if room_id not in room_clients:
        return
    
    # Get room state from room manager
    # TODO: Add integration with room manager to get actual room state
    room_state = {
        "room_id": room_id,
        "users": []
    }
    
    # Add connected users to room state
    for client_id in room_clients[room_id]:
        user_data = client_user_data.get(client_id, {})
        username = user_data.get("username", client_id)
        room_state["users"].append({
            "user_id": client_id,
            "username": username
        })
    
    # Broadcast room state to all clients in the room
    await broadcast_to_room(room_id, "room_state", room_state)

# Message handling
async def handle_client_message(client_id: str, message_type: str, data: Dict[str, Any]) -> None:
    """
    Process messages from clients and dispatch to appropriate handlers
    """
    try:
        if message_type == "ping":
            # Handle ping message
            await send_message_to_client(client_id, "pong", data)
        
        elif message_type == "join_room" and "room_id" in data:
            # Handle join room request
            room_id = data["room_id"]
            await join_room(client_id, room_id)
        
        elif message_type == "leave_room" and "room_id" in data:
            # Handle leave room request
            room_id = data["room_id"]
            await leave_room(client_id, room_id)
        
        elif message_type == "chat" and "room_id" in data and "message" in data:
            # Handle chat message
            room_id = data["room_id"]
            
            # Verify client is in the room
            if client_id not in client_rooms or room_id not in client_rooms[client_id]:
                await send_message_to_client(client_id, "error", {
                    "message": "Cannot send chat message: Not in room"
                })
                return
            
            # Get user info
            user_data = client_user_data.get(client_id, {})
            username = user_data.get("username", client_id)
            
            # Broadcast chat message to room
            chat_message = {
                "room_id": room_id,
                "user_id": client_id,
                "username": username,
                "message": data["message"],
                "timestamp": time.time()
            }
            
            await broadcast_to_room(room_id, "chat", chat_message)
        
        elif message_type == "game_action" and "room_id" in data and "action" in data:
            # Handle game action
            room_id = data["room_id"]
            
            # Verify client is in the room
            if client_id not in client_rooms or room_id not in client_rooms[client_id]:
                await send_message_to_client(client_id, "error", {
                    "message": "Cannot perform game action: Not in room"
                })
                return
            
            # TODO: Implement game action handling with room manager
            
            # For now, just echo back the action to the room
            user_data = client_user_data.get(client_id, {})
            username = user_data.get("username", client_id)
            
            action_data = {
                "room_id": room_id,
                "user_id": client_id,
                "username": username,
                "action": data["action"],
                "parameters": {k: v for k, v in data.items() if k not in ["room_id", "action"]},
                "timestamp": time.time()
            }
            
            await broadcast_to_room(room_id, "game_action", action_data)
            
        else:
            # Unknown message type
            logger.warning(f"Unknown message type from client {client_id}: {message_type}")
            await send_message_to_client(client_id, "error", {
                "message": f"Unknown message type: {message_type}"
            })
    
    except Exception as e:
        logger.error(f"Error handling message {message_type} from client {client_id}: {str(e)}")
        await send_message_to_client(client_id, "error", {
            "message": f"Server error: {str(e)}"
        })

# Communication utilities
async def send_message_to_client(client_id: str, message_type: str, data: Dict[str, Any]) -> bool:
    """
    Send a message to a specific client
    """
    if client_id not in connected_clients:
        logger.warning(f"Cannot send message: Client {client_id} not connected")
        return False
    
    try:
        message = {
            "type": message_type,
            "data": data
        }
        
        await connected_clients[client_id].send_text(json.dumps(message))
        return True
    except Exception as e:
        logger.error(f"Error sending message to client {client_id}: {str(e)}")
        return False

async def broadcast_to_room(
    room_id: str, 
    message_type: str, 
    data: Dict[str, Any],
    exclude_client_id: Optional[str] = None
) -> None:
    """
    Broadcast a message to all clients in a room
    """
    if room_id not in room_clients:
        return
    
    clients = room_clients[room_id]
    
    for client_id in clients:
        if exclude_client_id and client_id == exclude_client_id:
            continue
        
        await send_message_to_client(client_id, message_type, data)

# Main WebSocket handler
async def websocket_endpoint(websocket: WebSocket):
    """
    Main WebSocket connection handler
    """
    client_id = None
    
    try:
        # Get connection parameters
        query_params = websocket.query_params
        client_id = query_params.get("client_id", str(uuid.uuid4()))
        token = query_params.get("token", "")
        
        # Handle client connection
        if not await client_connect(websocket, client_id, token):
            return
        
        # Message loop
        while True:
            # Wait for message from client
            message_raw = await websocket.receive_text()
            
            try:
                # Parse message
                message = json.loads(message_raw)
                
                # Extract message type and data
                message_type = message.get("type")
                data = message.get("data", {})
                
                if not message_type:
                    logger.warning(f"Received message without type from {client_id}")
                    continue
                
                # Handle message
                await handle_client_message(client_id, message_type, data)
                
            except json.JSONDecodeError:
                logger.warning(f"Received invalid JSON from {client_id}")
                await send_message_to_client(client_id, "error", {
                    "message": "Invalid message format: expected JSON"
                })
            except Exception as e:
                logger.error(f"Error processing message from {client_id}: {str(e)}")
                await send_message_to_client(client_id, "error", {
                    "message": f"Error processing message: {str(e)}"
                })
    
    except WebSocketDisconnect:
        # Normal disconnection
        logger.info(f"WebSocket disconnected for client {client_id}")
    except Exception as e:
        # Unexpected error
        logger.error(f"WebSocket error for client {client_id}: {str(e)}")
    finally:
        # Clean up on disconnect
        if client_id:
            await client_disconnect(client_id)

# Public API for game events
async def send_game_event(event: GameEvent) -> None:
    """
    Send a game event to all clients in a room
    """
    await broadcast_to_room(event.room_id, event.event_type, event.data)

async def send_chat_message(message: ChatMessage) -> None:
    """
    Send a chat message to all clients in a room
    """
    await broadcast_to_room(message.room_id, "chat", {
        "room_id": message.room_id,
        "user_id": message.user_id,
        "username": message.username,
        "message": message.message,
        "timestamp": message.timestamp
    })

def configure_websockets(app: FastAPI) -> None:
    """
    Configure WebSocket routes for a FastAPI application
    """
    @app.websocket("/ws")
    async def websocket_route(websocket: WebSocket):
        await websocket_endpoint(websocket)
    
    logger.info("WebSocket routes configured")

# Additional API methods for the game logic to communicate with the WebSocket server
async def notify_game_state_change(room_id: str, game_state: Dict[str, Any]) -> None:
    """
    Notify all clients in a room about a game state change
    """
    await broadcast_to_room(room_id, "game_state", game_state)

async def notify_player_turn(room_id: str, player_id: str, valid_actions: List[Dict[str, Any]]) -> None:
    """
    Notify a specific player that it's their turn
    """
    await send_message_to_client(player_id, "player_turn", {
        "room_id": room_id,
        "valid_actions": valid_actions,
        "timeout": 30  # Default timeout in seconds
    })

async def notify_game_result(room_id: str, results: Dict[str, Any]) -> None:
    """
    Notify all clients in a room about the game results
    """
    await broadcast_to_room(room_id, "game_result", results)

# Run the WebSocket server as a standalone application
if __name__ == "__main__":
    import uvicorn
    
    app = FastAPI()
    configure_websockets(app)
    
    uvicorn.run(app, host="127.0.0.1", port=8765) 