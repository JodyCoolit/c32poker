import asyncio
import json
import websockets
import time
import logging
import sys
from typing import Optional, Dict, List, Any, Callable, Union, Coroutine, Tuple

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("WebSocketClient")

class WebSocketClient:
    """
    A WebSocket client for game rooms and real-time communication.
    
    This client handles:
    - Connection to WebSocket server with token authentication
    - Automatic reconnection with backoff
    - Event-based architecture for handling server messages
    - Room joining, leaving and chat
    - Game actions
    """
    
    def __init__(
        self,
        server_url: str,
        client_id: str,
        auth_token: str,
        reconnect_attempts: int = 5,
        reconnect_delay: int = 3,
        ping_interval: int = 30
    ):
        self.server_url = server_url
        self.client_id = client_id
        self.auth_token = auth_token
        self.reconnect_attempts = reconnect_attempts
        self.reconnect_delay = reconnect_delay
        self.ping_interval = ping_interval
        
        # Connection state
        self.websocket = None
        self.connected = False
        self.connection_task = None
        self.ping_task = None
        self.stopping = False
        
        # Event handlers
        self.event_handlers: Dict[str, List[Callable[[str, Dict[str, Any]], Coroutine]]] = {}
        
        # Current rooms
        self.rooms: List[str] = []
    
    def on(self, event_type: str, handler: Callable[[str, Dict[str, Any]], Coroutine]) -> None:
        """Register an event handler for a specific event type."""
        if event_type not in self.event_handlers:
            self.event_handlers[event_type] = []
        self.event_handlers[event_type].append(handler)
    
    def remove_handler(self, event_type: str, handler: Callable) -> bool:
        """Remove an event handler for a specific event type."""
        if event_type not in self.event_handlers:
            return False
        
        if handler in self.event_handlers[event_type]:
            self.event_handlers[event_type].remove(handler)
            return True
        return False
    
    async def connect(self) -> bool:
        """Connect to the WebSocket server."""
        if self.connection_task and not self.connection_task.done():
            logger.warning("Connection already in progress")
            return False
        
        self.stopping = False
        self.connection_task = asyncio.create_task(self._maintain_connection())
        return True
    
    async def disconnect(self) -> None:
        """Disconnect from the WebSocket server."""
        self.stopping = True
        
        # Cancel ping task if running
        if self.ping_task and not self.ping_task.done():
            self.ping_task.cancel()
            try:
                await self.ping_task
            except asyncio.CancelledError:
                pass
        
        # Close websocket connection if open
        if self.websocket:
            await self.websocket.close()
            self.websocket = None
        
        # Cancel connection task if running
        if self.connection_task and not self.connection_task.done():
            self.connection_task.cancel()
            try:
                await self.connection_task
            except asyncio.CancelledError:
                pass
        
        self.connected = False
        logger.info("Disconnected from WebSocket server")
        
        # Trigger disconnected event
        await self._trigger_event("disconnected", {"reason": "Client disconnect request"})
    
    async def _maintain_connection(self) -> None:
        """Maintain connection to the WebSocket server with automatic reconnection."""
        retry_count = 0
        
        while not self.stopping and retry_count < self.reconnect_attempts:
            try:
                # Connect to the server
                connection_url = f"{self.server_url}?client_id={self.client_id}&token={self.auth_token}"
                async with websockets.connect(connection_url) as websocket:
                    self.websocket = websocket
                    self.connected = True
                    retry_count = 0  # Reset retry counter on successful connection
                    
                    # Start ping task
                    self.ping_task = asyncio.create_task(self._ping_loop())
                    
                    logger.info(f"Connected to WebSocket server: {self.server_url}")
                    await self._trigger_event("connected", {"server": self.server_url})
                    
                    # Process incoming messages
                    async for message in websocket:
                        if self.stopping:
                            break
                        
                        await self._process_message(message)
                    
                    # Connection closed normally
                    self.connected = False
                    self.websocket = None
                    
                    if not self.stopping:
                        await self._trigger_event("disconnected", {"reason": "Connection closed"})
            
            except (websockets.exceptions.ConnectionClosed, websockets.exceptions.WebSocketException, ConnectionError) as e:
                self.connected = False
                self.websocket = None
                
                if self.ping_task and not self.ping_task.done():
                    self.ping_task.cancel()
                    try:
                        await self.ping_task
                    except asyncio.CancelledError:
                        pass
                
                if self.stopping:
                    break
                
                retry_count += 1
                wait_time = self.reconnect_delay * (1.5 ** (retry_count - 1))  # Exponential backoff
                
                logger.warning(f"Connection error: {str(e)}. Reconnecting in {wait_time:.1f}s (attempt {retry_count}/{self.reconnect_attempts})")
                await self._trigger_event("connection_error", {"error": str(e), "attempt": retry_count})
                
                # Wait before reconnecting
                await asyncio.sleep(wait_time)
        
        # Failed to reconnect after max attempts
        if not self.stopping and retry_count >= self.reconnect_attempts:
            logger.error("Failed to connect after maximum reconnection attempts")
            await self._trigger_event("disconnected", {"reason": "Max reconnection attempts exceeded"})
    
    async def _ping_loop(self) -> None:
        """Send periodic ping messages to keep the connection alive."""
        while self.connected and not self.stopping:
            try:
                await asyncio.sleep(self.ping_interval)
                if self.connected and self.websocket:
                    await self._send_message("ping", {})
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in ping loop: {str(e)}")
                if self.connected:  # Only try to trigger if we're still connected
                    await self._trigger_event("error", {"source": "ping", "error": str(e)})
    
    async def _process_message(self, raw_message: str) -> None:
        """Process an incoming WebSocket message."""
        try:
            message = json.loads(raw_message)
            if not isinstance(message, dict):
                logger.warning(f"Received non-dictionary message: {raw_message[:100]}...")
                return
            
            event_type = message.get("type")
            if not event_type:
                logger.warning(f"Received message without type: {raw_message[:100]}...")
                return
            
            data = message.get("data", {})
            
            # Handle ping/pong specially
            if event_type == "pong":
                await self._trigger_event("pong", {"timestamp": time.time()})
                return
            
            # Handle other message types
            await self._trigger_event(event_type, data)
            
        except json.JSONDecodeError:
            logger.error(f"Failed to parse message: {raw_message[:100]}...")
        except Exception as e:
            logger.error(f"Error processing message: {str(e)}")
            await self._trigger_event("error", {"source": "message_processing", "error": str(e)})
    
    async def _trigger_event(self, event_type: str, data: Dict[str, Any]) -> None:
        """Trigger all registered handlers for an event type."""
        handlers = self.event_handlers.get(event_type, [])
        
        if not handlers:
            logger.debug(f"No handlers for event: {event_type}")
            return
        
        for handler in handlers:
            try:
                await handler(event_type, data)
            except Exception as e:
                logger.error(f"Error in event handler for {event_type}: {str(e)}")
    
    async def _send_message(self, message_type: str, data: Dict[str, Any]) -> bool:
        """Send a message to the WebSocket server."""
        if not self.connected or not self.websocket:
            logger.warning(f"Cannot send message '{message_type}': Not connected")
            return False
        
        message = {
            "type": message_type,
            "data": data
        }
        
        try:
            await self.websocket.send(json.dumps(message))
            return True
        except Exception as e:
            logger.error(f"Error sending message: {str(e)}")
            await self._trigger_event("error", {"source": "send_message", "error": str(e)})
            return False
    
    # Game-specific methods
    
    async def join_room(self, room_id: str) -> bool:
        """Join a game room."""
        if room_id in self.rooms:
            logger.warning(f"Already in room: {room_id}")
            return True
        
        success = await self._send_message("join_room", {"room_id": room_id})
        if success:
            self.rooms.append(room_id)
        return success
    
    async def leave_room(self, room_id: str) -> bool:
        """Leave a game room."""
        if room_id not in self.rooms:
            logger.warning(f"Not in room: {room_id}")
            return True
        
        success = await self._send_message("leave_room", {"room_id": room_id})
        if success:
            self.rooms.remove(room_id)
        return success
    
    async def send_chat(self, room_id: str, message: str) -> bool:
        """Send a chat message to a room."""
        if room_id not in self.rooms:
            logger.warning(f"Cannot send chat: Not in room {room_id}")
            return False
        
        return await self._send_message("chat", {
            "room_id": room_id,
            "message": message
        })
    
    async def game_action(self, room_id: str, action: str, **kwargs) -> bool:
        """Send a game action to a room."""
        if room_id not in self.rooms:
            logger.warning(f"Cannot send game action: Not in room {room_id}")
            return False
        
        data = {
            "room_id": room_id,
            "action": action,
            **kwargs
        }
        
        return await self._send_message("game_action", data)

# Example usage
async def main():
    client = WebSocketClient(
        server_url="ws://127.0.0.1:8000/ws/",
        client_id="testuser",
        auth_token="your_auth_token"
    )
    
    def on_connect(_):
        print("Connected to server!")
        asyncio.create_task(client.join_room("room123"))
    
    def on_game_update(data):
        print(f"Game update: {data}")
    
    def on_chat(data):
        print(f"Chat: {data['username']}: {data['message']}")
    
    client.on('connect', on_connect)
    client.on('game_update', on_game_update)
    client.on('chat', on_chat)
    
    try:
        await client.connect()
        
        # Keep the client running for a while
        await asyncio.sleep(30)
        
        # Send a test message
        await client.send_chat("room123", "Hello everyone!")
        
        # Keep the client running for a while longer
        await asyncio.sleep(30)
        
    finally:
        await client.disconnect()

if __name__ == "__main__":
    asyncio.run(main()) 