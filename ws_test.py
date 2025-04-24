import asyncio
import logging
import sys
from websocket_client import WebSocketClient

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("WebSocketTest")

async def run_test():
    # Create a client
    client = WebSocketClient(
        server_url="ws://127.0.0.1:8765",
        client_id="test_user",
        auth_token="test_token_12345",
        reconnect_attempts=3
    )
    
    # Register event handlers
    client.on("connection_state", lambda data: logger.info(f"Connection state: {data}"))
    client.on("room_state", lambda data: logger.info(f"Room state received for room: {data.get('room_id')}"))
    client.on("chat", lambda data: logger.info(f"Chat message: {data.get('username')}: {data.get('message')}"))
    client.on("game_update", lambda data: logger.info(f"Game update: {data.get('action')}"))
    
    # Connect to the server
    await client.connect()
    
    try:
        # Join a room
        logger.info("Joining room...")
        await client.join_room("room123")
        
        # Wait for a moment to receive the room state
        await asyncio.sleep(1)
        
        # Send a chat message
        logger.info("Sending chat message...")
        await client.send_chat_message("room123", "Hello from the test client!")
        
        # Send a game action
        logger.info("Sending game action...")
        await client.send_game_action("room123", "call", 50)
        
        # Keep the connection open for a while
        logger.info("Running for 30 seconds...")
        await asyncio.sleep(30)
        
        # Disconnect
        logger.info("Disconnecting...")
        await client.disconnect()
        
    except Exception as e:
        logger.error(f"Error during test: {str(e)}")
        await client.disconnect()

if __name__ == "__main__":
    asyncio.run(run_test()) 