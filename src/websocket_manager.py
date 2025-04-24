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
        
        # Last message sent to each client (for reconnection)
        self.last_messages: Dict[str, Dict[str, Any]] = {}
        
        # Pending messages for disconnected clients
        self.pending_messages: Dict[str, List[Dict[str, Any]]] = {}
        
        # Message queue for room broadcasts
        self.message_queues: Dict[str, asyncio.Queue] = {}
        
        # Background tasks
        self.background_tasks: Set[asyncio.Task] = set()

    async def connect(self, websocket: WebSocket, client_id: str):
        """
        Accept a new WebSocket connection
        """
        await websocket.accept()
        self.active_connections[client_id] = websocket
        self.connection_status[client_id] = "connected"
        print(f"Client {client_id} connected")
        
        # Initialize empty pending messages list if it doesn't exist
        if client_id not in self.pending_messages:
            self.pending_messages[client_id] = []

    async def reconnect(self, websocket: WebSocket, client_id: str) -> bool:
        """
        Handle a reconnecting client
        """
        try:
            await websocket.accept()
            self.active_connections[client_id] = websocket
            self.connection_status[client_id] = "connected"
            print(f"Client {client_id} reconnected")
            
            # Send any pending messages
            if client_id in self.pending_messages and self.pending_messages[client_id]:
                for message in self.pending_messages[client_id]:
                    try:
                        await websocket.send_json(message)
                        print(f"Sent pending message to {client_id}: {message.get('type')}")
                    except Exception as e:
                        print(f"Error sending pending message to {client_id}: {str(e)}")
                
                # Clear pending messages
                self.pending_messages[client_id] = []
            
            # Send last known state if available
            if client_id in self.last_messages:
                try:
                    await websocket.send_json({
                        "type": "reconnect_state",
                        "data": self.last_messages[client_id]
                    })
                    print(f"Sent reconnect state to {client_id}")
                except Exception as e:
                    print(f"Error sending reconnect state to {client_id}: {str(e)}")
            
            return True
        except Exception as e:
            print(f"Error reconnecting client {client_id}: {str(e)}")
            traceback.print_exc()
            return False

    def disconnect(self, client_id: str):
        """
        Mark a client as disconnected
        """
        if client_id in self.active_connections:
            self.connection_status[client_id] = "disconnected"
            del self.active_connections[client_id]
            print(f"Client {client_id} disconnected")
            
            # Remove from room_players
            for room_id, players in self.room_players.items():
                if client_id in players:
                    players.remove(client_id)
                    print(f"Removed {client_id} from room {room_id}")

    async def send_personal_message(self, message: dict, client_id: str):
        """
        Send a message to a specific client
        """
        if client_id in self.active_connections and self.connection_status.get(client_id) == "connected":
            try:
                await self.active_connections[client_id].send_json(message)
                # Store as last message for this client
                self.store_last_message(client_id, message)
                return True
            except Exception as e:
                print(f"Error sending message to {client_id}: {str(e)}")
                self.add_pending_message(client_id, message)
                return False
        else:
            # Store message for when client reconnects
            self.add_pending_message(client_id, message)
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
                    # Store as last message for this client
                    self.store_last_message(client_id, message)
                else:
                    disconnected_clients.append(client_id)
                    self.add_pending_message(client_id, message)
            except Exception as e:
                print(f"Error broadcasting to {client_id}: {str(e)}")
                disconnected_clients.append(client_id)
                self.add_pending_message(client_id, message)
        
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
                    # Store as last message for this client
                    self.store_last_message(client_id, message)
                except Exception as e:
                    print(f"Error broadcasting to room member {client_id}: {str(e)}")
                    disconnected_clients.append(client_id)
                    self.add_pending_message(client_id, message)
            else:
                disconnected_clients.append(client_id)
                self.add_pending_message(client_id, message)
        
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

    def store_last_message(self, client_id: str, message: dict):
        """
        Store the last message sent to a client for reconnection
        """
        # Only store state and update messages
        if message.get("type") in ["game_state", "room_update", "game_update", "player_action"]:
            if client_id not in self.last_messages:
                self.last_messages[client_id] = {}
            
            message_type = message.get("type")
            self.last_messages[client_id][message_type] = message.get("data", {})

    def add_pending_message(self, client_id: str, message: dict):
        """
        Add a message to the pending queue for a disconnected client
        """
        if client_id not in self.pending_messages:
            self.pending_messages[client_id] = []
        
        # Only store important messages
        if message.get("type") in ["game_state", "room_update", "game_update", "player_action", "chat"]:
            self.pending_messages[client_id].append(message)
            
            # Limit number of pending messages
            if len(self.pending_messages[client_id]) > 50:
                self.pending_messages[client_id] = self.pending_messages[client_id][-50:]

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

    async def send_player_specific_state(self, client_id: str, game_state: dict, player_hand: list = None):
        """
        Send player-specific game state (including their hand)
        """
        # Make a copy of the game state to avoid modifying the original
        player_state = dict(game_state)
        
        # Add player's hand if provided
        if player_hand:
            player_state["my_hand"] = player_hand
        
        await self.send_personal_message({
            "type": "game_state",
            "data": player_state
        }, client_id)

# Create a singleton instance
ws_manager = ConnectionManager() 