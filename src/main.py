from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, Header, Query, HTTPException
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
import json
import time
import asyncio
import jwt
import traceback
from typing import Optional, Dict, Any

# First get the RoomManager instance
from src.managers.room_manager import get_instance, GLOBAL_ROOMS
room_manager = get_instance()
print(f"Main room_manager instance id: {id(room_manager)}")
rooms = room_manager.get_all_rooms()
print(f"Initial rooms: {rooms}")

# Import websocket manager
from src.websocket_manager import ws_manager

# Then import route modules
from src.api_routes import routers as api_routers
from src.room_routes import router as room_router
from src.game_routes import router as game_router
from src.bug_routes import bug_router

# Import the timer update task from game.py
from src.models.game import timer_update_task

# Inject room_manager instance to route modules
import src.room_routes as room_routes
import src.game_routes as game_routes
room_routes.room_manager = room_manager
game_routes.room_manager = room_manager

# Authentication settings
SECRET_KEY = "c32poker_secret_key"  # Match the key in api_routes.py
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24小时，与api_routes.py保持一致

# Define startup event
async def startup_event():
    print("Application starting...")
    rooms = room_manager.get_all_rooms()
    print(f"Rooms at startup: {rooms}")
    
    # Start timer update task from game.py
    asyncio.create_task(timer_update_task())
    print("Timer update task started")

# Define shutdown event
async def shutdown_event():
    print("Application stopping...")
    rooms = room_manager.get_all_rooms()
    print(f"Rooms at shutdown: {rooms}")

app = FastAPI(
    title="C32 Poker API",
    description="Poker Game Backend API",
    version="1.0.0"
)

# Register event handlers
app.add_event_handler("startup", startup_event)
app.add_event_handler("shutdown", shutdown_event)

# Add CORS support
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
for router in api_routers:
    app.include_router(router, prefix="/api")  # API-related routes

app.include_router(room_router, prefix="/api")  # Room-related routes
app.include_router(game_router, prefix="/api")  # Game-related routes
app.include_router(bug_router, prefix="/api")  # Bug report routes

# Helper function to check if the provided token is valid
def verify_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        return username
    except Exception as e:
        print(f"Token verification error: {str(e)}")
        return None

# WebSocket Connection Manager
@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    try:
        # Check if this is a reconnection
        if client_id in ws_manager.connection_status and ws_manager.connection_status[client_id] == "disconnected":
            print(f"Client {client_id} attempting to reconnect")
            reconnect_success = await ws_manager.reconnect(websocket, client_id)
            if not reconnect_success:
                print(f"Reconnection failed for client {client_id}")
                return
        else:
            # New connection
            await ws_manager.connect(websocket, client_id)
        
        # Send initial state to the client
        try:
            room_manager_instance = get_instance()
            rooms = room_manager_instance.get_all_rooms()
            
            # Find rooms this user is in
            user_rooms = []
            for room_id, room in rooms.items():
                if client_id in room.players:
                    # Add client to room in websocket manager
                    ws_manager.add_client_to_room(room_id, client_id)
                    
                    user_rooms.append({
                        "room_id": room_id,
                        "name": room.name,
                        "status": room.status
                    })
            
            # Send user's current state
            if user_rooms:
                await websocket.send_json({
                    "type": "connection_state",
                    "data": {
                        "rooms": user_rooms
                    }
                })
        except Exception as e:
            print(f"Error sending initial state: {str(e)}")
        
        # Main message loop
        while True:
            try:
                # Check connection status, if disconnected exit the loop
                if websocket.client_state.value == 2:  # WebSocketState.DISCONNECTED = 2
                    print(f"WebSocket already disconnected, stopping message loop: {client_id}")
                    break
                    
                data = await websocket.receive_json()
                
                # Process message based on type
                if data.get("type") == "ping":
                    # Handle ping/heartbeat
                    await websocket.send_json({
                        "type": "pong",
                        "timestamp": time.time()
                    })
                
                elif data.get("type") == "chat":
                    # Chat message
                    room_id = data.get("room_id")
                    username = data.get("username")
                    message = data.get("message")
                    
                    # Broadcast chat message to room
                    await ws_manager.broadcast_to_room(
                        room_id,
                        {
                            "type": "chat",
                            "data": {
                                "player": username,
                                "message": message,
                                "timestamp": time.time()
                            }
                        }
                    )
                
                elif data.get("type") == "join_room":
                    # Player joining room
                    room_id = data.get("room_id")
                    username = data.get("username")
                    
                    # Add client to room in websocket manager
                    ws_manager.add_client_to_room(room_id, client_id)
                    
                    # Broadcast player join notification
                    await ws_manager.broadcast_to_room(
                        room_id,
                        {
                            "type": "player_joined",
                            "data": {
                                "player_id": client_id,
                                "player_name": username,
                                "timestamp": time.time()
                            }
                        }
                    )
                
            except WebSocketDisconnect:
                print(f"WebSocket disconnected for client: {client_id}")
                ws_manager.disconnect(client_id)
                break
            except Exception as e:
                print(f"Error in websocket message processing: {str(e)}")
                traceback.print_exc()
                
    except WebSocketDisconnect:
        print(f"WebSocket disconnected for client: {client_id}")
        ws_manager.disconnect(client_id)
    except Exception as e:
        print(f"Unexpected error in websocket handling: {str(e)}")
        traceback.print_exc()
        try:
            ws_manager.disconnect(client_id)
        except:
            pass

# Add game-specific WebSocket endpoint, requires token authentication
@app.websocket("/ws/game/{room_id}")
async def game_websocket_endpoint(
    websocket: WebSocket, 
    room_id: str, 
    token: Optional[str] = Query(None)
):
    client_id = None
    
    if not token:
        print(f"Missing token in game WebSocket connection for room {room_id}")
        await websocket.close(code=1008, reason="Missing authentication token")
        return
    
    # Verify token
    try:
        username = verify_token(token)
        if not username:
            print(f"Invalid token in game WebSocket connection for room {room_id}")
            await websocket.close(code=1008, reason="Invalid token")
            return
        
        # Use username as client_id for this connection
        client_id = username
        
        # Check if user is in the room
        room = room_manager.get_room(room_id)
        if not room or username not in room.players:
            print(f"User {username} not in room {room_id}")
            await websocket.close(code=1008, reason="Not a member of this room")
            return
        
        # Accept the connection
        if client_id in ws_manager.connection_status and ws_manager.connection_status[client_id] == "disconnected":
            # Reconnection
            reconnect_success = await ws_manager.reconnect(websocket, client_id)
            if not reconnect_success:
                print(f"Reconnection failed for client {client_id}")
                return
        else:
            # New connection
            await ws_manager.connect(websocket, client_id)
        
        # Add client to room in websocket manager
        ws_manager.add_client_to_room(room_id, client_id)
        
        # Send initial state to client
        game_state = room.get_state() if room else None
        if game_state:
            # Get player's hand if game is active
            player_hand = room.game.get_player_hand(username) if room.game else None
            
            # Send player-specific state including their hand
            await ws_manager.send_player_specific_state(client_id, game_state, player_hand)
        
        # Notify others that player has connected
        await ws_manager.broadcast_to_room(
            room_id,
            {
                "type": "player_connected",
                "data": {
                    "player_id": username,
                    "timestamp": time.time()
                }
            }
        )
        
        # Main message loop
        while True:
            try:
                # Check connection status
                if websocket.client_state.value == 2:  # WebSocketState.DISCONNECTED
                    print(f"WebSocket already disconnected, stopping message loop: {client_id}")
                    break
                
                data = await websocket.receive_json()
                message_type = data.get("type")
                
                # Process different message types
                if message_type == "ping":
                    # Handle ping/heartbeat
                    await websocket.send_json({
                        "type": "pong",
                        "timestamp": time.time()
                    })
                
                elif message_type == "game_action":
                    # Game operation
                    action = data.get("action")
                    amount = data.get("amount", 0)
                    card_index = data.get("card_index", 0)
                    
                    # Validate the room and game exist
                    room = room_manager.get_room(room_id)
                    if not room or not room.game:
                        await websocket.send_json({
                            "type": "error",
                            "data": {
                                "message": "Room or game not found",
                                "timestamp": time.time()
                            }
                        })
                        continue
                    
                    # Process the action
                    result = {"success": False, "message": "Invalid action"}
                    
                    try:
                        # 找到玩家位置索引
                        player_position = None
                        for position, player in room.game.players.items():
                            if player.get('name') == username or player.get('username') == username:
                                player_position = position
                                break
                        
                        if player_position is None:
                            result = {"success": False, "message": "Player not found in game"}
                        else:
                            # 检查是否是当前玩家的回合，或者是否是弃牌操作
                            is_current_player = (player_position == room.game.current_player_idx)
                            
                            # 只有弃牌操作可以在非玩家回合执行
                            if action == "discard":
                                # 使用专门的方法处理弃牌
                                result = room.game.handle_discard(player_position, card_index)
                            elif not is_current_player:
                                result = {"success": False, "message": "Not your turn to act"}
                            else:
                                # 处理其他动作（只有在当前玩家回合才允许）
                                if action == "fold":
                                    result = room.game.handle_action("fold")
                                elif action == "check":
                                    result = room.game.handle_action("check")
                                elif action == "call":
                                    result = room.game.handle_action("call")
                                elif action == "raise":
                                    result = room.game.handle_action("raise", amount)
                                elif action == "bet":
                                    result = room.game.handle_action("bet", amount)
                                else:
                                    result = {"success": False, "message": f"Unknown action: {action}"}
                        
                        # If action was successful, broadcast the new game state
                        if result.get("success"):
                            # Get updated game state
                            updated_state = room.get_state()
                            
                            # 添加调试日志，特别关注弃牌操作
                            print(f"[BROADCAST][game_update]: Action={action}, Player={username}, GameState={updated_state}")
                            
                            # Broadcast game update to all players in the room
                            await ws_manager.broadcast_to_room(
                                room_id,
                                {
                                    "type": "game_update",
                                    "data": {
                                        "action": action,
                                        "player": username,
                                        "amount": amount,
                                        "result": result,
                                        "game_state": updated_state,
                                        "is_key_update": True,
                                        "timestamp": time.time(),
                                        "update_reason": f"player_action_{action}"
                                    }
                                }
                            )
                            
                            # Send player-specific updates (hands)
                            for player_id in room.players:
                                if ws_manager.is_client_connected(player_id):
                                    player_hand = room.game.get_player_hand(player_id)
                                    if player_hand:
                                        await ws_manager.send_player_specific_state(
                                            player_id,
                                            updated_state,
                                            player_hand
                                        )
                        else:
                            # Send error just to the player who made the invalid action
                            await websocket.send_json({
                                "type": "error",
                                "data": {
                                    "message": result.get("message", "Unknown error"),
                                    "timestamp": time.time()
                                }
                            })
                    
                    except Exception as e:
                        print(f"Error processing game action: {str(e)}")
                        traceback.print_exc()
                        await websocket.send_json({
                            "type": "error",
                            "data": {
                                "message": f"Error processing action: {str(e)}",
                                "timestamp": time.time()
                            }
                        })
                
                elif message_type == "room_action":
                    # Room operations (sit down, buy in, etc.)
                    action = data.get("action")
                    target_room_id = data.get("room_id", room_id)  # Default to current room
                    
                    # Validate the room exists
                    room = room_manager.get_room(target_room_id)
                    if not room:
                        await websocket.send_json({
                            "type": "error",
                            "data": {
                                "message": "Room not found",
                                "timestamp": time.time()
                            }
                        })
                        continue
                    
                    # Process the room action
                    result = {"success": False, "message": "Invalid room action"}
                    
                    try:
                        # Handle different room actions
                        if action == "sit_down":
                            # Get seat index from request
                            seat_index = data.get("seat_index")
                            if seat_index is None:
                                result = {"success": False, "message": "Missing seat_index parameter"}
                            else:
                                # Call the room's sit_down method
                                sit_result = room.sit_down(username, int(seat_index))
                                result = {
                                    "success": sit_result.get("success", False),
                                    "message": sit_result.get("message", "Sit down failed")
                                }
                        
                        elif action == "buy_in":
                            # Get amount and seat index from request
                            amount = data.get("amount", 0)
                            seat_index = data.get("seat_index")
                            
                            if not amount or amount <= 0:
                                result = {"success": False, "message": "Invalid buy-in amount"}
                            elif seat_index is None:
                                result = {"success": False, "message": "Missing seat_index parameter"}
                            else:
                                # Call the room's buy_in method
                                buy_in_result = room.player_buy_in(username, float(amount), int(seat_index))
                                result = {
                                    "success": buy_in_result.get("success", False),
                                    "message": buy_in_result.get("message", "Buy-in failed")
                                }
                        
                        elif action == "stand_up":
                            # Call the room's stand_up method
                            stand_up_result = room.stand_up(username)
                            result = {
                                "success": stand_up_result.get("success", False),
                                "message": stand_up_result.get("message", "Stand up failed")
                            }
                        
                        elif action == "start_game":
                            # Verify if the player is the room owner
                            if username != room.owner:
                                result = {"success": False, "message": "Only the room owner can start the game"}
                            else:
                                # Call the room's start_game method
                                start_game_result = room.start_game()
                                result = {
                                    "success": start_game_result.get("success", False),
                                    "message": start_game_result.get("message", "Failed to start game")
                                }
                        
                        elif action == "get_game_history":
                            # Get game history from the room
                            try:
                                # 检查游戏是否已开始
                                if room.game:
                                    history = room.game.get_game_history()
                                else:
                                    # 如果游戏尚未开始，返回空历史记录
                                    history = []
                                
                                result = {
                                    "success": True,
                                    "message": "Game history retrieved",
                                    "history": history  # 现在history是一个包含更多详细信息的对象
                                }
                                
                                # 直接发送给请求的玩家
                                await websocket.send_json({
                                    "type": "game_history",
                                    "data": history  # 直接发送历史数据对象
                                })
                                
                                # 立即返回，避免后续的广播处理
                                continue
                            except Exception as e:
                                import traceback
                                traceback.print_exc()
                                result = {
                                    "success": False,
                                    "message": f"Error retrieving game history: {str(e)}"
                                }
                                # 发送错误消息
                                await websocket.send_json({
                                    "type": "error",
                                    "data": {
                                        "message": result["message"],
                                        "timestamp": time.time()
                                    }
                                })
                                continue
                        
                        elif action == "exit_game":
                            # Call the room's leave method
                            leave_result = room.leave(username)
                            result = {
                                "success": leave_result.get("success", False),
                                "message": leave_result.get("message", "Failed to exit game")
                            }
                        
                        elif action == "change_seat":
                            # Get the new seat index from request
                            new_seat_index = data.get("new_seat_index")
                            if new_seat_index is None:
                                result = {"success": False, "message": "Missing new_seat_index parameter"}
                            else:
                                # Call the room's change_seat method
                                change_seat_result = room.change_seat(username, int(new_seat_index))
                                result = {
                                    "success": change_seat_result.get("success", False),
                                    "message": change_seat_result.get("message", "Seat change failed")
                                }
                        
                        else:
                            result = {"success": False, "message": f"Unknown room action: {action}"}
                        
                        # If action was successful, broadcast the updated room state
                        if result.get("success"):
                            # Get updated room state
                            updated_state = room.get_state()
                            
                            print(f"[BROADCAST][room_update] Room {target_room_id}: Action={action}, Player={username}, Result={result.get('success')}")
                            
                            # Send a room update notification with detailed information
                            await ws_manager.broadcast_to_room(
                                target_room_id,
                                {
                                    "type": "room_update",
                                    "data": {
                                        "action": action,
                                        "player": username,
                                        "result": result,
                                        "room_state": updated_state,
                                        "message": f"玩家{username}执行了{action}操作",
                                        "timestamp": time.time()
                                    }
                                }
                            )
                            
                        else:
                            # Send error to the player who made the invalid action
                            await websocket.send_json({
                                "type": "error",
                                "data": {
                                    "message": result.get("message", "Unknown error"),
                                    "timestamp": time.time()
                                }
                            })
                    
                    except Exception as e:
                        print(f"Error processing room action: {str(e)}")
                        traceback.print_exc()
                        await websocket.send_json({
                            "type": "error",
                            "data": {
                                "message": f"Error processing room action: {str(e)}",
                                "timestamp": time.time()
                            }
                        })
                
                elif message_type == "chat":
                    # Chat message
                    message = data.get("message")
                    
                    # Broadcast chat message to room
                    await ws_manager.broadcast_to_room(
                        room_id,
                        {
                            "type": "chat",
                            "data": {
                                "player": username,
                                "message": message,
                                "timestamp": time.time()
                            }
                        }
                    )
                
            except WebSocketDisconnect:
                print(f"WebSocket disconnected for client: {client_id}")
                ws_manager.disconnect(client_id)
                
                # Notify others that player has disconnected
                await ws_manager.broadcast_to_room(
                    room_id,
                    {
                        "type": "player_disconnected",
                        "data": {
                            "player_id": username,
                            "timestamp": time.time()
                        }
                    }
                )
                break
            except Exception as e:
                print(f"Error in game websocket message processing: {str(e)}")
                traceback.print_exc()
    
    except WebSocketDisconnect:
        if client_id:
            print(f"WebSocket disconnected for client: {client_id}")
            ws_manager.disconnect(client_id)
            
            # Notify others that player has disconnected
            if room_id:
                await ws_manager.broadcast_to_room(
                    room_id,
                    {
                        "type": "player_disconnected",
                        "data": {
                            "player_id": username,
                            "timestamp": time.time()
                        }
                    }
                )
    except Exception as e:
        print(f"Unexpected error in game websocket handling: {str(e)}")
        traceback.print_exc()
        if client_id:
            try:
                ws_manager.disconnect(client_id)
            except:
                pass

# Start the server if running as main script
if __name__ == "__main__":
    uvicorn.run("src.main:app", host="0.0.0.0", port=8000, reload=True)