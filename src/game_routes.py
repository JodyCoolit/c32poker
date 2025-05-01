from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, Body, Query, Depends, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
from src.managers.room_manager import get_instance
from src.database.db_manager import DBManager
import uuid
import json
import gc
import jwt
import os
from datetime import datetime, timedelta
import time
import traceback
import asyncio
import threading
import logging

from src.models.player import Player
from src.models.game import Game

# 创建路由器实例
router = APIRouter(
    tags=["game"]
)

# 获取数据库管理器实例
db_manager = DBManager()

# 由 main.py 注入的 room_manager 实例
room_manager = get_instance()  # 默认值，将在 main.py 中被覆盖

# JWT密钥
SECRET_KEY = "c32poker_secret_key"  # 与api_routes.py中的密钥保持一致
ALGORITHM = "HS256"

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer())):
    """验证JWT token"""
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="无效的认证凭证")
        return username
    except (jwt.exceptions.InvalidTokenError, jwt.exceptions.InvalidSignatureError, jwt.exceptions.DecodeError):
        raise HTTPException(
            status_code=401,
            detail="无效的认证凭证",
            headers={"WWW-Authenticate": "Bearer"},
        )

# 定义数据模型
class GameAction(BaseModel):
    room_id: str
    username: str
    action: str  # "fold", "call", "raise", "check"
    amount: Optional[int] = 0

class GameState(BaseModel):
    pot: int
    community_cards: List[str]
    current_bet: int
    button_position: int
    current_actor: str
    players: List[Dict[str, Any]]
    is_game_over: bool
    winners: List[str] = []

# WebSocket连接管理器
class ConnectionManager:
    def __init__(self):
        self.active_connections = {}  # username -> WebSocket
        self.connection_status = {}   # username -> "connected" | "disconnected"
        self.room_players = {}        # room_id -> list of usernames
        self.active_game_rooms = []   # list of room_ids with active games
        self.cached_rooms = {}        # room_id -> Room object (cached)
        self.reconnection_attempts: Dict[str, int] = {}
        self.max_reconnect_attempts = 5
        
    async def connect(self, websocket: WebSocket, user_id: str):
        """Accept a websocket connection and store it"""
        try:
            await websocket.accept()
            self.active_connections[user_id] = websocket
            self.connection_status[user_id] = "connected"
            self.reconnection_attempts[user_id] = 0
            
            print(f"WebSocket connected for user: {user_id}")
            
            # Notify user of successful connection
            try:
                await websocket.send_json({
                    "type": "connection_status",
                    "status": "connected",
                    "message": "Successfully connected to server"
                })
            except Exception as e:
                print(f"Error sending connection confirmation: {str(e)}")
        except Exception as e:
            print(f"Error accepting WebSocket connection: {str(e)}")
            
    async def reconnect(self, websocket: WebSocket, user_id: str):
        """Handle reconnection attempt"""
        if user_id not in self.reconnection_attempts:
            self.reconnection_attempts[user_id] = 0
            
        self.reconnection_attempts[user_id] += 1
        
        if self.reconnection_attempts[user_id] <= self.max_reconnect_attempts:
            self.connection_status[user_id] = "reconnecting"
            print(f"Reconnection attempt {self.reconnection_attempts[user_id]} for user {user_id}")
            
            try:
                await websocket.accept()
                self.active_connections[user_id] = websocket
                self.connection_status[user_id] = "connected"
                
                # Reset reconnection counter on successful reconnect
                self.reconnection_attempts[user_id] = 0
                
                # Notify of successful reconnection
                await websocket.send_json({
                    "type": "connection_status",
                    "status": "reconnected",
                    "message": "Successfully reconnected to server"
                })
                
                print(f"User {user_id} successfully reconnected")
                return True
            except Exception as e:
                print(f"Error during reconnection: {str(e)}")
                return False
        else:
            print(f"Max reconnection attempts reached for user {user_id}")
            self.connection_status[user_id] = "disconnected"
            return False
        
    def disconnect(self, user_id: str):
        """Handle client disconnection"""
        if user_id in self.active_connections:
            print(f"WebSocket disconnected for user: {user_id}")
            del self.active_connections[user_id]
            self.connection_status[user_id] = "disconnected"
            
    async def send_to_user(self, user_id: str, message: dict):
        """Send message to specific user"""
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_json(message)
                return True
            except Exception as e:
                print(f"Error sending message to user {user_id}: {str(e)}")
                # Handle potential disconnection
                self.connection_status[user_id] = "disconnected"
                return False
        return False
            
    async def broadcast_to_room(self, room_id: str, message: dict):
        """Broadcast message to all players in a room"""
        # Use cached room if available, otherwise get from room_manager
        room = self.cached_rooms.get(room_id)
        if not room:
            room = room_manager.get_room(room_id)
            if room:
                # Update cache with this room
                self.cached_rooms[room_id] = room
                
        if room:
            failed_users = []
            
            for username in room.players:
                success = await self.send_to_user(username, message)
                if not success and username in self.active_connections:
                    failed_users.append(username)
            
            # Remove connections that failed to receive message
            for username in failed_users:
                print(f"Failed to send to {username}, marking as disconnected")
                self.connection_status[username] = "disconnected"
                if username in self.active_connections:
                    del self.active_connections[username]

    async def broadcast_timer_updates(self):
        """Broadcast timer updates to all relevant rooms with active games"""
        try:
            # Use cached room objects instead of querying get_room for each room
            for room_id in self.active_game_rooms:
                room = self.cached_rooms.get(room_id)
                if room and room.game and room.game.turn_timer:
                    # Get the current turn time remaining
                    time_remaining = room.game.get_turn_time_remaining()
                    current_player_idx = room.game.current_player_idx
                    
                    if current_player_idx < len(room.game.players):
                        current_player = room.game.players[current_player_idx]["name"]
                        
                        # Send timer update to all players in the room
                        timer_message = {
                            "type": "timer_update",
                            "data": {
                                "room_id": room_id,
                                "current_player": current_player,
                                "time_remaining": time_remaining,
                                "betting_round": room.game.betting_round,
                                "timestamp": time.time()
                            }
                        }
                        
                        await self.broadcast_to_room(room_id, timer_message)
        except Exception as e:
            print(f"Error broadcasting timer updates: {str(e)}")
            import traceback
            traceback.print_exc()

# 创建WebSocket连接管理器实例
ws_manager = ConnectionManager()

# 确保导出路由器
__all__ = ['router', 'ws_manager']