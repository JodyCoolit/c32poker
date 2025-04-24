from src.models.room import Room
from src.models.player import Player
from src.models.game import Game
import uuid
import pickle
import os
import time
import threading
from datetime import datetime, timedelta

# 全局变量存储所有房间
GLOBAL_ROOMS = {}
STATE_FILE = "rooms_state.pickle"
SAVE_INTERVAL = 30  # Save state every 30 seconds
CLEANUP_INTERVAL = 300  # Check for expired rooms every 5 minutes

class RoomManager:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(RoomManager, cls).__new__(cls)
            cls._instance.initialized = False
        return cls._instance
        
    def __init__(self):
        if hasattr(self, 'initialized') and self.initialized:
            return
            
        print("Initializing RoomManager")
        self.initialized = True
        
        # Load saved rooms state if exists
        self.load_state()
        
        # Start background save thread
        self.should_save = True
        self.save_thread = threading.Thread(target=self._background_save)
        self.save_thread.daemon = True
        self.save_thread.start()
        
        # Start background cleanup thread
        self.cleanup_thread = threading.Thread(target=self._background_cleanup)
        self.cleanup_thread.daemon = True
        self.cleanup_thread.start()
        print("Room manager cleanup thread started")
    
    def _background_save(self):
        """Background thread to periodically save state"""
        while self.should_save:
            time.sleep(SAVE_INTERVAL)
            self.save_state()
    
    def _background_cleanup(self):
        """Background thread to periodically check and remove expired rooms"""
        while self.should_save:  # 使用相同的控制标志
            time.sleep(CLEANUP_INTERVAL)
            self.cleanup_expired_rooms()
    
    def cleanup_expired_rooms(self):
        """检查并清理过期的房间"""
        global GLOBAL_ROOMS
        
        try:
            print("Checking for expired rooms...")
            rooms_to_remove = []
            rooms_expiring = []
            
            # 遍历所有房间检查是否过期
            for room_id, room in GLOBAL_ROOMS.items():
                # 检查是否过期
                if hasattr(room, 'is_expired') and room.is_expired():
                    # 记录要删除的房间
                    rooms_to_remove.append(room_id)
                    
                    # 检查过期的房间状态
                    idle_time = datetime.now() - room.last_activity_time
                    idle_minutes = idle_time.total_seconds() / 60
                    print(f"Room {room_id} has been idle for {idle_minutes:.1f} minutes and will be removed")
                    
                    # 尝试发送通知给房间中的所有玩家
                    try:
                        self.notify_room_expiration(room, is_expired=True)
                    except Exception as notify_error:
                        print(f"Error sending expiration notification: {str(notify_error)}")
                
                # 检查房间是否即将过期（5分钟内）
                elif hasattr(room, 'is_expiring') and room.is_expiring():
                    # 记录即将过期的房间
                    rooms_expiring.append(room_id)
                    
                    # 向房间中的玩家发送即将过期的通知
                    try:
                        self.notify_room_expiration(room, is_expired=False)
                    except Exception as notify_error:
                        print(f"Error sending expiring notification: {str(notify_error)}")
            
            # 从GLOBAL_ROOMS中删除过期房间
            for room_id in rooms_to_remove:
                print(f"Removing expired room: {room_id}")
                self.remove_room(room_id)
            
            if rooms_to_remove or rooms_expiring:
                result_message = []
                if rooms_to_remove:
                    result_message.append(f"Removed {len(rooms_to_remove)} expired rooms")
                if rooms_expiring:
                    result_message.append(f"Notified {len(rooms_expiring)} rooms about upcoming expiration")
                
                print(f"{', '.join(result_message)}. Remaining rooms: {len(GLOBAL_ROOMS)}")
                # 保存房间状态
                self.save_state()
            else:
                print("No expired or expiring rooms found")
                
        except Exception as e:
            import traceback
            print(f"Error during room cleanup: {str(e)}")
            traceback.print_exc()
    
    def notify_room_expiration(self, room, is_expired=False):
        """通知房间中的所有玩家房间即将过期或已过期"""
        if not room or not room.players:
            return
            
        try:
            # 导入ws_manager
            from src.game_routes import ws_manager
            
            # 构建通知消息
            message_type = "room_expired" if is_expired else "room_expiring"
            idle_time = datetime.now() - room.last_activity_time
            idle_minutes = idle_time.total_seconds() / 60
            minutes_left = (room.max_idle_time_hours * 60) - idle_minutes if not is_expired else 0
            
            message = (
                f"房间 '{room.name}' 因超过30分钟无活动已被关闭" 
                if is_expired else 
                f"房间 '{room.name}' 将在 {minutes_left:.1f} 分钟后因无活动而关闭"
            )
            
            notification = {
                "type": message_type,
                "data": {
                    "room_id": room.room_id,
                    "room_name": room.name,
                    "message": message,
                    "is_expired": is_expired,
                    "time_left_minutes": minutes_left if not is_expired else 0
                }
            }
            
            # 向房间中的每个玩家发送通知
            for username in room.players.keys():
                try:
                    # 异步发送通知给每个玩家
                    import asyncio
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    loop.run_until_complete(ws_manager.send_to_user(username, notification))
                    loop.close()
                    print(f"Sent {message_type} notification to player: {username}")
                except Exception as user_error:
                    print(f"Failed to notify player {username}: {str(user_error)}")
                    
        except Exception as e:
            print(f"Error in notify_room_expiration: {str(e)}")
    
    def save_state(self):
        """Save rooms state to file"""
        global GLOBAL_ROOMS
        
        try:
            # Create backup of previous state file if it exists
            if os.path.exists(STATE_FILE):
                backup_file = f"{STATE_FILE}.bak"
                if os.path.exists(backup_file):
                    os.remove(backup_file)
                os.rename(STATE_FILE, backup_file)
            
            # Create a serializable copy of the rooms
            serializable_rooms = {}
            for room_id, room in GLOBAL_ROOMS.items():
                room_copy = {}
                # Save basic room properties
                room_copy["room_id"] = room.room_id
                room_copy["name"] = room.name
                room_copy["owner"] = room.owner
                room_copy["max_players"] = room.max_players
                room_copy["small_blind"] = room.small_blind
                room_copy["big_blind"] = room.big_blind
                room_copy["buy_in_min"] = room.buy_in_min
                room_copy["buy_in_max"] = room.buy_in_max
                room_copy["status"] = room.status
                room_copy["game_duration_hours"] = room.game_duration_hours
                room_copy["game_start_time"] = room.game_start_time
                room_copy["game_end_time"] = room.game_end_time
                
                # Save players (excluding thread-specific objects)
                players_data = {}
                for player_name, player in room.players.items():
                    players_data[player_name] = {
                        "name": player.name,
                        "chips": player.chips
                    }
                room_copy["players"] = players_data
                room_copy["players_ready"] = room.players_ready.copy()
                
                # Game state is not saved (will be recreated if needed)
                room_copy["has_game"] = room.game is not None
                
                # Save room properties
                room_copy["created_at"] = room.created_at
                room_copy["last_activity_time"] = room.last_activity_time
                room_copy["max_idle_time_hours"] = room.max_idle_time_hours
                
                serializable_rooms[room_id] = room_copy
            
            # Save serializable state
            with open(STATE_FILE, 'wb') as f:
                pickle.dump(serializable_rooms, f)
            
            print(f"Room state saved successfully. Rooms: {len(GLOBAL_ROOMS)}")
            return True
        except Exception as e:
            import traceback
            print(f"Error saving room state: {str(e)}")
            traceback.print_exc()
            return False
    
    def load_state(self):
        """Load rooms state from file"""
        global GLOBAL_ROOMS
        
        try:
            if os.path.exists(STATE_FILE):
                with open(STATE_FILE, 'rb') as f:
                    loaded_room_data = pickle.load(f)
                
                # Recreate room objects from serializable data
                GLOBAL_ROOMS = {}
                for room_id, room_data in loaded_room_data.items():
                    room = Room(
                        room_id=room_data["room_id"],
                        name=room_data["name"],
                        max_players=room_data["max_players"],
                        small_blind=room_data["small_blind"],
                        big_blind=room_data["big_blind"],
                        buy_in_min=room_data["buy_in_min"],
                        buy_in_max=room_data["buy_in_max"],
                        game_duration_hours=room_data["game_duration_hours"]
                    )
                    
                    # Restore room properties
                    room.owner = room_data["owner"]
                    room.status = room_data["status"]
                    room.game_start_time = room_data["game_start_time"]
                    room.game_end_time = room_data["game_end_time"]
                    
                    # 恢复创建时间和最后活动时间，如果没有则设置为当前时间
                    room.created_at = room_data.get("created_at", datetime.now())
                    room.last_activity_time = room_data.get("last_activity_time", datetime.now())
                    room.max_idle_time_hours = room_data.get("max_idle_time_hours", 1)
                    
                    # Restore players
                    for player_name, player_data in room_data["players"].items():
                        room.players[player_name] = Player(player_data["name"], player_data["chips"])
                    
                    # Restore ready status
                    room.players_ready = room_data["players_ready"].copy()
                    
                    # Note: Game objects are not restored from serialization
                    room.game = None
                    
                    GLOBAL_ROOMS[room_id] = room
                
                print(f"Room state loaded successfully. Rooms: {len(GLOBAL_ROOMS)}")
                return True
            else:
                print("No saved room state found, starting with empty state")
                GLOBAL_ROOMS = {}
                return False
        except Exception as e:
            import traceback
            print(f"Error loading room state: {str(e)}")
            traceback.print_exc()
            
            # Try to load from backup
            try:
                backup_file = f"{STATE_FILE}.bak"
                if os.path.exists(backup_file):
                    with open(backup_file, 'rb') as f:
                        loaded_room_data = pickle.load(f)
                    
                    # Process backup data the same way
                    GLOBAL_ROOMS = {}
                    for room_id, room_data in loaded_room_data.items():
                        try:
                            room = Room(
                                room_id=room_data["room_id"],
                                name=room_data["name"],
                                max_players=room_data.get("max_players", 6),
                                small_blind=room_data.get("small_blind", 0.5),
                                big_blind=room_data.get("big_blind", 1),
                                buy_in_min=room_data.get("buy_in_min", 100),
                                buy_in_max=room_data.get("buy_in_max", 100),
                                game_duration_hours=room_data.get("game_duration_hours", 2)
                            )
                            
                            if "owner" in room_data:
                                room.owner = room_data["owner"]
                            if "status" in room_data:
                                room.status = room_data["status"]
                            if "game_start_time" in room_data:
                                room.game_start_time = room_data["game_start_time"]
                            if "game_end_time" in room_data:
                                room.game_end_time = room_data["game_end_time"]
                            
                            # 恢复创建时间和最后活动时间，如果没有则设置为当前时间
                            room.created_at = room_data.get("created_at", datetime.now())
                            room.last_activity_time = room_data.get("last_activity_time", datetime.now())
                            room.max_idle_time_hours = room_data.get("max_idle_time_hours", 1)
                            
                            # Restore players if available
                            if "players" in room_data:
                                for player_name, player_data in room_data["players"].items():
                                    room.players[player_name] = Player(player_data["name"], player_data["chips"])
                            
                            # Restore ready status if available
                            if "players_ready" in room_data:
                                room.players_ready = room_data["players_ready"].copy()
                            
                            room.game = None
                            GLOBAL_ROOMS[room_id] = room
                        except Exception as e:
                            print(f"Error processing room data from backup: {str(e)}")
                    
                    print(f"Room state loaded from backup. Rooms: {len(GLOBAL_ROOMS)}")
                    return True
            except Exception as e2:
                print(f"Error loading backup state: {str(e2)}")
            
            # If all else fails, start with empty state
            GLOBAL_ROOMS = {}
            return False
        
    def create_room(self, name, host_username, game_duration_hours=2, max_players=8, small_blind=0.5, big_blind=1, buy_in_min=100, buy_in_max=1000):
        """创建一个新房间，并设置房主"""
        global GLOBAL_ROOMS
        
        room_id = str(uuid.uuid4())
        
        room = Room(
            room_id=room_id,
            name=name,
            max_players=max_players,
            small_blind=small_blind,
            big_blind=big_blind,
            buy_in_min=buy_in_min,
            buy_in_max=buy_in_max,
            game_duration_hours=game_duration_hours
        )
        
        # 设置房主
        room.owner = host_username
        
        GLOBAL_ROOMS[room_id] = room
        print(f"已创建房间 {room_id}，房主: {host_username}，当前房间总数: {len(GLOBAL_ROOMS)}")
        
        # Save state after room creation
        self.save_state()
        
        return room
        
    def get_room(self, room_id):
        """获取指定ID的房间"""
        global GLOBAL_ROOMS
        
        # 尝试直接获取
        room = GLOBAL_ROOMS.get(room_id)
        if room:
            return room
            
        # 尝试不同的字符串表示形式
        for key in GLOBAL_ROOMS.keys():
            print(f"Comparing {key} with {room_id}")
            if str(key).lower() == str(room_id).lower():
                return GLOBAL_ROOMS[key]
                
        print(f"Room not found with any method")
        return None
        
    def get_all_rooms(self):
        """获取所有房间"""
        global GLOBAL_ROOMS
        
        return GLOBAL_ROOMS
        
    def add_player_to_room(self, room_id, username):
        """将玩家添加到房间"""
        room = self.get_room(room_id)
        if not room:
            return False
            
        if len(room.players) >= room.max_players:
            return False
            
        if username in room.players:
            return False
            
        # 创建玩家对象并添加到房间
        player = Player(username, 0)
        # 显式设置座位和位置为None，防止自动分配座位
        player.seat = None
        player.position = None
        print(f"Player {username} joined room {room_id} with no seat assigned")
        room.players[username] = player
        return True
        
    def remove_player_from_room(self, room_id, username):
        """从房间移除玩家"""
        global GLOBAL_ROOMS
        
        room = self.get_room(room_id)
        if not room or username not in room.players:
            return False
            
        # 如果游戏正在进行，玩家弃牌
        if room.game and username in room.game.active_players:
            room.game.active_players.remove(username)
            
        # 从房间移除玩家
        del room.players[username]
        
        # 如果房间没有玩家了，删除房间
        if not room.players:
            del GLOBAL_ROOMS[room_id]
            
        return True
        
    def end_game(self, room_id):
        """结束指定房间的游戏并计算结果"""
        room = self.get_room(room_id)
        if not room or not room.game:
            return False
            
        # 获取赢家
        winners = room.game.get_winners()
        
        # 分配奖金
        pot_per_winner = room.game.pot // len(winners) if winners else 0
        for winner in winners:
            # 找到赢家对应的玩家对象并增加筹码
            if winner.name in room.players:
                room.players[winner.name].chips += pot_per_winner
        
        # 清除当前游戏实例
        room.game = None
        
        return True
        
    def list_rooms(self):
        global GLOBAL_ROOMS
        
        return [
            {
                'id': room.room_id,
                'name': room.name,
                'players': len(room.players),
                'max_players': room.max_players,
                'status': room.status
            }
            for room in GLOBAL_ROOMS.values()
        ]

    def get_room_by_name(self, name):
        """通过房间名获取房间"""
        global GLOBAL_ROOMS
        
        for room_id, room in GLOBAL_ROOMS.items():
            if room.name == name:
                return room
        return None

    def remove_room(self, room_id):
        """删除指定ID的房间"""
        global GLOBAL_ROOMS
        
        if room_id in GLOBAL_ROOMS:
            del GLOBAL_ROOMS[room_id]
            print(f"已删除房间 {room_id}，当前房间总数: {len(GLOBAL_ROOMS)}")
            
            # Save state after room removal
            self.save_state()
            
            return True
        return False

    def start_turn_timer(self):
        """Start timer for current player's turn"""
        # 取消现有计时器
        if hasattr(self, 'turn_timer') and self.turn_timer:
            self.turn_timer.cancel()
        
        # 设置计时器开始时间
        print(f"启动计时器，当前玩家: {self.current_player}")
        self.turn_start_time = time.time()
        print(f"turn_start_time设置为: {self.turn_start_time}")
        
        # 创建新计时器
        try:
            self.turn_timer = threading.Timer(self.player_turn_time, self.handle_timeout)
            self.turn_timer.daemon = True
            self.turn_timer.start()
            print(f"计时器启动成功，{self.player_turn_time}秒后超时")
        except Exception as e:
            print(f"启动计时器失败: {e}")

    def advance_player(self):
        try:
            # 找到下一个活跃玩家
            idx = (self.current_player_idx + 1) % len(self.players)
            while idx not in self.active_players:
                idx = (idx + 1) % len(self.players)
            self.current_player_idx = idx
            
            # 更新当前玩家属性
            if 0 <= self.current_player_idx < len(self.players):
                self.current_player = self.players[self.current_player_idx]["name"]
                print(f"切换到玩家 {self.current_player}，准备启动计时器")
                
                # 确保在任何情况下都设置计时器
                print(f"DEBUG: 在advance_player中无条件启动计时器")
                self.turn_start_time = time.time()  # 直接设置，不依赖于start_turn_timer
                
                # 然后再调用start_turn_timer作为备份
                self.start_turn_timer()
                
                print(f"DEBUG: advance_player完成，turn_start_time = {self.turn_start_time}")
            else:
                self.current_player = None
        except Exception as e:
            print(f"advance_player出错: {e}")

    def get_turn_time_remaining(self):
        """获取当前玩家回合剩余时间"""
        # 打印调试信息
        print(f"DEBUG: get_turn_time_remaining被调用，turn_start_time = {self.turn_start_time}")
        
        if not hasattr(self, 'turn_start_time') or self.turn_start_time is None:
            print(f"DEBUG: turn_start_time为None，返回默认时间{self.player_turn_time}秒")
            # 如果计时器未启动，返回默认时间
            return self.player_turn_time
        
        # 计算剩余时间
        elapsed = time.time() - self.turn_start_time
        remaining = max(0, self.player_turn_time - elapsed)
        print(f"DEBUG: 计算剩余时间：已用{elapsed:.1f}秒，剩余{remaining:.1f}秒")
        return round(remaining)

    def handle_timeout(self):
        """Handle case when player's turn timer expires"""
        print(f"DEBUG: 计时器超时触发 - 玩家 {self.current_player} (索引 {self.current_player_idx})")
        
        player_idx = self.current_player_idx
        if player_idx in self.active_players:
            print(f"DEBUG: 处理超时动作 - 玩家 {self.current_player}")
            # ... 处理超时的代码 ...

    def get_state(self):
        """获取房间状态"""
        try:
            state = {
                "room_id": self.room_id,
                "name": self.name,
                "max_players": self.max_players,
                "small_blind": self.small_blind,
                "big_blind": self.big_blind,
                "status": self.status,
                "game_duration_hours": self.game_duration_hours,
                "owner": self.owner
            }
            
            # 计算并添加剩余时间
            state["remaining_time"] = self.get_remaining_time()
            
            # 添加游戏状态
            if self.game:
                game_state = self.game.get_state()
                state["game"] = game_state
                
                # 设置游戏状态标志
                if self.status == "playing":
                    state["is_game_started"] = True
                    
                    # 计算游戏剩余时间
                    if self.game_start_time and self.game_end_time:
                        remaining_time = (self.game_end_time - datetime.now()).total_seconds()
                        state["remaining_time"] = max(0, remaining_time)
                        state["game_end_time"] = self.game_end_time.isoformat()
                else:
                    state["is_game_started"] = False
            
            return state
        except Exception as e:
            import traceback
            print(f"Error in Room.get_state: {str(e)}")
            traceback.print_exc()
            # Return minimal state to prevent crashes
            return {
                "room_id": self.room_id,
                "name": self.name,
                "status": self.status,
                "error": str(e)
            }

    def add_player(self, username, chips):
        """添加玩家到房间"""
        # 检查是否已满
        if len(self.game.players) >= self.max_players:
            return False, "房间已满"
        
        # 检查玩家是否已在游戏中
        player_idx = self.game.get_player_idx(username)
        if player_idx is not None:
            return False, "已在房间中"
        
        # 添加玩家到游戏
        self.game.add_player(username, chips)
        
        # 如果是第一个加入的玩家，设为房主
        if len(self.game.players) == 1:
            self.owner = username
        
        # 更新最后活动时间
        self.update_activity_time()
        
        return True, "加入成功"

    def player_buy_in(self, username, amount, seat_index):
        """处理玩家买入操作"""
        try:
            print(f"处理买入请求: 玩家={username}, 金额={amount}, 座位={seat_index}")
            
            # 验证买入金额
            if amount < self.buy_in_min:
                return {"success": False, "message": f"买入金额不能低于 {self.buy_in_min}"}
            
            if amount > self.buy_in_max:
                return {"success": False, "message": f"买入金额不能高于 {self.buy_in_max}"}
            
            # 验证座位是否有效
            if seat_index < 0 or seat_index >= self.max_players:
                return {"success": False, "message": f"无效的座位号 (0-{self.max_players-1})"}
            
            # 检查座位是否已被占用
            for player in self.game.players:
                if player.get("position") == seat_index and player["name"] != username:
                    return {"success": False, "message": f"座位 {seat_index} 已被玩家 {player['name']} 占用"}
            
            # 检查玩家是否已在游戏中
            player_idx = self.game.get_player_idx(username)
            if player_idx is None:
                # 添加新玩家到游戏
                player_idx = self.game.add_player(username, amount, position=seat_index)
                player = self.game.players[player_idx]
                total_buy_in = amount
                
                print(f"新玩家 {username} 已买入 {amount} 并坐在座位 {seat_index}")
            else:
                # 现有玩家买入更多筹码
                success, player = self.game.player_buy_in(username, amount)
                if not success:
                    return {"success": False, "message": "处理买入失败"}
                
                # 更新玩家位置
                player["position"] = seat_index
                total_buy_in = player["total_buy_in"]
                
                print(f"玩家 {username} 已买入 {amount}，总买入: {total_buy_in}，总筹码: {player['chips']}，座位: {seat_index}")
            
            # 更新最后活动时间
            self.update_activity_time()
            
            return {
                "success": True,
                "message": f"买入成功，总筹码: {player['chips']}",
                "chips": player["chips"],
                "total_buy_in": total_buy_in,
                "seat": seat_index,
                "position": seat_index
            }
            
        except Exception as e:
            import traceback
            print(f"买入操作错误: {str(e)}")
            traceback.print_exc()
            return {"success": False, "message": f"处理买入请求时出错: {str(e)}"}

# 全局单例实例 - 确保所有导入都使用相同的实例
GLOBAL_ROOM_MANAGER = RoomManager()

def get_instance():
    return GLOBAL_ROOM_MANAGER