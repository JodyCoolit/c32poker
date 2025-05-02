from src.models.game import Game
import time
from datetime import datetime, timedelta
from src.models.player import Player

# Dictionary to store all rooms with their game references
_games_to_rooms = {}

def get_room_by_game(game_instance):
    """Helper function to get the room that contains a specific game instance"""
    global _games_to_rooms
    return _games_to_rooms.get(id(game_instance))

class Room:
    def __init__(self, room_id, name, max_players=8, small_blind=None, big_blind=None, buy_in_min=None, buy_in_max=None, game_duration_hours=1):
        print(f"Creating Room: id={room_id}, name={name}")
        self.room_id = room_id
        self.name = name
        self.max_players = max_players
        self.players = {}
        self.players_ready = {}
        self.game = None
        self.owner = None  # To be set when first player joins
        self.status = "waiting"  # waiting, playing, finished
        
        # 添加创建时间
        self.created_at = datetime.now()
        self.last_activity_time = datetime.now()
        self.max_idle_time_hours = 0.5  # 未开始游戏的房间最多存在30分钟
        
        # 使用传入的参数而不是硬编码的值
        self.small_blind = small_blind if small_blind is not None else 0.5
        self.big_blind = big_blind if big_blind is not None else 1.0
        self.buy_in_min = buy_in_min if buy_in_min is not None else 100
        self.buy_in_max = buy_in_max if buy_in_max is not None else 1000
        
        # 游戏时间相关
        self.game_duration_hours = game_duration_hours  # 游戏持续时间（小时）
        self.game_start_time = None
        self.game_end_time = None
        print(f"Room created successfully: id={room_id}")
        
    def __getstate__(self):
        """Support for pickle serialization"""
        state = self.__dict__.copy()
        return state
        
    def __setstate__(self, state):
        """Support for pickle deserialization"""
        self.__dict__.update(state)
        
    def add_player(self, username, chips):
        """添加玩家到房间"""
        if len(self.players) >= self.max_players:
            return False, "房间已满"
            
        # Check for existing player in database
        try:
            from src.database.db_manager import DBManager
            db_manager = DBManager()
            user_info = db_manager.get_user_info(username)
        except Exception as e:
            print(f"Error checking user info: {str(e)}")
            # Continue with default logic if database check fails
            
        if username in self.players:
            return False, "已在房间中"
            
        # 创建玩家对象并添加到房间
        player = Player(username, chips)
        self.players[username] = player
        self.players_ready[username] = False  # 默认未就位
        
        # 如果是第一个加入的玩家，设为房主
        if len(self.players) == 1:
            self.owner = username
        
        # 更新最后活动时间
        self.update_activity_time()
            
        return True, "加入成功"
        
    def remove_player(self, username):
        """从房间移除玩家"""
        if username not in self.players:
            return False, 0
            
        player = self.players[username]
        chips = player.chips
        
        # 如果游戏正在进行，玩家弃牌
        if self.game and username in self.game.active_players:
            self.game.active_players.remove(username)
            
        # 从房间移除玩家
        del self.players[username]
        if username in self.players_ready:
            del self.players_ready[username]
        
        # 更新最后活动时间
        self.update_activity_time()
            
        return True, chips
        
    def set_player_ready(self, username, ready=True):
        """设置玩家就位状态"""
        if username in self.players:
            self.players_ready[username] = ready
            # 更新最后活动时间
            self.update_activity_time()
            return True
        return False
        
    def all_players_ready(self):
        """检查是否所有玩家都已就位"""
        if not self.players:
            return False
        return all(self.players_ready.values())
        
    def enough_players_for_game(self):
        """检查是否有足够玩家开始游戏"""
        return len(self.players) >= 2
        
    def start_game(self):
        """开始游戏"""
        try:
            print(f"Starting game in room {self.room_id}")
            
            if not self.enough_players_for_game():
                print("Not enough players to start game")
                return {"success": False, "message": "玩家数量不足"}
            
            # 检查玩家是否已入座和买入
            seated_players_with_chips = 0
            for player_name, player in self.players.items():
                # 检查玩家是否有位置信息和筹码
                has_position = hasattr(player, 'position') and player.position is not None
                has_seat = hasattr(player, 'seat') and player.seat is not None
                
                # 使用position或seat作为位置信息
                player_position = None
                if has_position:
                    player_position = player.position
                elif has_seat:
                    player_position = player.seat
                    # 确保position属性也被设置
                    player.position = player.seat
                
                # 更新日志
                print(f"检查玩家 {player_name}: 位置={player_position}, 筹码={player.chips}")
                
                # 玩家必须有位置和筹码才能参与游戏
                if player_position is not None and player.chips > 0:
                    seated_players_with_chips += 1
            
            # 检查是否有足够的已入座且有筹码的玩家
            if seated_players_with_chips < 2:
                print("未找到足够的已入座且有筹码的玩家")
                return {"success": False, "message": "至少需要2名已入座且有筹码的玩家"}
            
            # 构建玩家信息列表 - 同时确保position信息正确
            players_info = []
            print(f"Building player info, players: {list(self.players.keys())}")
            
            for player_name, player in self.players.items():
                # 确保玩家有position，优先使用position，其次是seat
                if hasattr(player, 'position') and player.position is not None:
                    position = player.position
                elif hasattr(player, 'seat') and player.seat is not None:
                    position = player.seat
                    player.position = player.seat
                else:
                    # 跳过没有位置的玩家
                    print(f"跳过没有位置的玩家 {player_name}")
                    continue
                
                # 只添加有筹码的玩家
                if player.chips > 0:
                    print(f"Adding player {player_name} with {player.chips} chips at position {position}")
                    # 确保传递position信息和total_buy_in信息
                    players_info.append({
                        "name": player_name, 
                        "chips": player.chips,
                        "position": position,
                        "total_buy_in": player.total_buy_in,
                        "pending_buy_in": player.pending_buy_in,
                        "online": True
                    })
            
            print(f"Player info list: {players_info}")
            
            # 检查是否有足够的玩家信息
            if len(players_info) < 2:
                print("有效的玩家信息不足")
                return {"success": False, "message": "有效的玩家信息不足"}
            
            # 创建游戏实例
            print(f"Creating Game instance with players_info: {players_info}")
            self.game = Game(players_info, small_blind=self.small_blind, big_blind=self.big_blind)
            global _games_to_rooms
            _games_to_rooms[id(self.game)] = self
            self.game.start_round() 
            self.status = "playing"
            
            # 设置游戏开始和结束时间
            self.game_start_time = datetime.now()
            self.game_end_time = self.game_start_time + timedelta(hours=self.game_duration_hours)
            print(f"Game started successfully. End time: {self.game_end_time}")
            
            return {"success": True, "message": "游戏开始"}
        except Exception as e:
            import traceback
            print(f"Error in start_game: {str(e)}")
            traceback.print_exc()
            return {"success": False, "message": f"游戏开始失败: {str(e)}"}
        
    def end_game(self):
        """结束游戏"""
        if not self.game:
            return False, "没有进行中的游戏"
        
        # 从映射中移除游戏实例
        global _games_to_rooms
        if id(self.game) in _games_to_rooms:
            del _games_to_rooms[id(self.game)]
        
        # 重置游戏
        self.game = None
        self.status = "finished"
        
        return True, "游戏结束"
        
    def get_remaining_time(self):
        """获取游戏剩余时间（秒）"""
        if not self.game_start_time or not self.game_end_time:
            return 0
            
        now = datetime.now()
        if now > self.game_end_time:
            return 0
            
        return (self.game_end_time - now).total_seconds()
        
    def is_game_time_over(self):
        """检查游戏时间是否结束"""
        if not self.game_start_time or not self.game_end_time:
            return False
            
        return datetime.now() > self.game_end_time
        
    def update_activity_time(self):
        """更新房间最后活动时间"""
        self.last_activity_time = datetime.now()
    
    def is_expiring(self):
        """检查房间是否即将过期（还有5分钟过期）
        
        如果房间未开始游戏且距离过期时间不足5分钟，则返回True
        """
        # 如果游戏已经开始，则不会过期
        if self.game:
            return False
            
        # 计算房间已闲置的时间
        idle_time = datetime.now() - self.last_activity_time
        idle_hours = idle_time.total_seconds() / 3600
        idle_minutes = idle_time.total_seconds() / 60
        
        # 计算离过期还有多少分钟
        minutes_to_expiration = self.max_idle_time_hours * 60 - idle_minutes
        
        # 如果还有不到5分钟过期，且尚未发送过通知，则返回True
        if 0 < minutes_to_expiration < 5:
            print(f"Room {self.room_id} will expire in {minutes_to_expiration:.1f} minutes")
            return True
            
        return False
    
    def is_expired(self):
        """检查房间是否已过期
        
        如果房间未开始游戏且超过最大闲置时间，则认为已过期
        """
        # 如果游戏已经开始，则不会过期
        if self.game:
            return False
            
        # 计算房间已闲置的时间
        idle_time = datetime.now() - self.last_activity_time
        idle_hours = idle_time.total_seconds() / 3600
        idle_minutes = idle_time.total_seconds() / 60
        
        # 如果超过最大闲置时间，则认为房间已过期
        if idle_hours > self.max_idle_time_hours:
            print(f"Room {self.room_id} has expired after {idle_minutes:.1f} minutes of inactivity")
            return True
            
        return False
        
    def player_buy_in(self, username, amount, seat_index):
        """处理玩家买入操作
        
        Args:
            username (str): 玩家用户名
            amount (float): 买入金额
            seat_index (int): 座位索引
            
        Returns:
            dict: 操作结果
        """
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
            
            # 检查座位是否已被占用 - 检查其他玩家的seat或position属性
            for player_name, player in self.players.items():
                if ((hasattr(player, 'seat') and player.seat == seat_index) or
                    (hasattr(player, 'position') and player.position == seat_index)) and player_name != username:
                    return {"success": False, "message": f"座位 {seat_index} 已被玩家 {player_name} 占用"}
            
            # 检查玩家是否已在房间中
            if username not in self.players:
                # 不自动添加玩家，直接返回失败
                return {"success": False, "message": "玩家不在房间中，请先加入房间"}
            
            # 检查玩家是否在当前游戏中活跃
            is_player_active = False
            pending_buy_in = False
            
            # 如果游戏正在进行，检查玩家是否活跃
            if self.game and hasattr(self.game, 'active_players'):
                if seat_index in self.game.active_players:
                    is_player_active = True
                    print(f"玩家 {username} 正在游戏中，暂时不能添加筹码，将在游戏结束后更新")
                    
                    # 记录玩家的买入意图到game.players中，而不是Player对象
                    if seat_index in self.game.players:
                        # 直接累加pending_buy_in，不检查其存在性
                        self.game.players[seat_index]['pending_buy_in'] += amount
                        pending_buy_in = True
                        print(f"记录玩家 {username} 的待处理买入到game.players: {self.game.players[seat_index]['pending_buy_in']}")
            
            # 只有当玩家不在活跃游戏中时，才立即更新筹码
            if not is_player_active:
                # 立即更新玩家筹码
                self.players[username].chips += amount
                print(f"玩家 {username} 不在游戏中，立即更新筹码: +{amount}，总计: {self.players[username].chips}")
            
            # 直接累加总买入金额（无论是否立即更新筹码）
            self.players[username].total_buy_in += amount
            total_buy_in = self.players[username].total_buy_in
            
            # 状态消息
            if pending_buy_in:
                # 从game.players中获取pending_buy_in的值进行显示
                pending_amount = self.game.players[seat_index]['pending_buy_in']
                print(f"玩家 {username} 已记录买入 {amount}，总买入: {total_buy_in}，待处理买入: {pending_amount}，座位: {seat_index}")
            else:
                print(f"玩家 {username} 已买入 {amount}，总买入: {total_buy_in}，总筹码: {self.players[username].chips}，座位: {seat_index}")
            
            # 如果游戏已经开始，也更新game.players中的total_buy_in（不更新筹码，如果玩家在游戏中）
            if self.game and hasattr(self.game, 'players'):
                # 直接通过座位号(position)访问玩家数据，不假设结构类型
                if seat_index in self.game.players:
                    # 更新总买入金额（这个总是更新的）
                    self.game.players[seat_index]['total_buy_in'] = total_buy_in
                    
                    # 只有当玩家不在活跃游戏中时，才更新game中的筹码
                    if not is_player_active:
                        self.game.players[seat_index]['chips'] += amount
                        # 将pending_buy_in置为0，而不是删除
                        self.game.players[seat_index]['pending_buy_in'] = 0
                        print(f"更新game对象中座位 {seat_index} 玩家 {username} 的筹码和总买入")
                    else:
                        print(f"只更新game对象中座位 {seat_index} 玩家 {username} 的总买入，等待游戏结束后处理pending_buy_in: {self.game.players[seat_index].get('pending_buy_in', 0)}")
                else:
                    # 如果座位号不存在，这是一个异常情况，只打印警告
                    print(f"警告: 座位号 {seat_index} 在game.players中不存在，可能是玩家数据结构不一致")
            
            # 更新最后活动时间
            self.update_activity_time()
            
            return {
                "success": True, 
                "message": f"买入成功，总筹码: {self.players[username].chips}",
                "chips": self.players[username].chips,
                "total_buy_in": total_buy_in,  # 返回总买入金额
                "seat": seat_index,
                "position": seat_index  # 在响应中也返回position
            }
            
        except Exception as e:
            import traceback
            print(f"买入操作错误: {str(e)}")
            traceback.print_exc()
            return {"success": False, "message": f"处理买入请求时出错: {str(e)}"}
    
    def sit_down(self, username, seat_index):
        """处理玩家入座操作
        
        Args:
            username (str): 玩家用户名
            seat_index (int): 座位索引
            
        Returns:
            dict: 操作结果
        """
        try:
            print(f"处理入座请求: 玩家={username}, 座位={seat_index}")
            
            # 验证座位是否有效
            if seat_index < 0 or seat_index >= self.max_players:
                return {"success": False, "message": f"无效的座位号 (0-{self.max_players-1})"}
            
            # 检查玩家是否在房间中
            if username not in self.players:
                return {"success": False, "message": "玩家不在房间中"}
            
            player = self.players[username]
            
            # 检查玩家是否已经有座位 - 检查seat或position属性
            has_seat = hasattr(player, 'seat') and player.seat is not None
            has_position = hasattr(player, 'position') and player.position is not None
            
            if has_seat or has_position:
                current_seat = player.seat if has_seat else player.position
                if current_seat == seat_index:
                    return {"success": False, "message": "玩家已经在这个座位上"}
                else:
                    return {"success": False, "message": f"玩家已经坐在座位 {current_seat}，请先站起"}
            
            # 检查座位是否已被占用 - 检查其他玩家的seat或position属性
            for player_name, p in self.players.items():
                if (hasattr(p, 'seat') and p.seat == seat_index) or \
                   (hasattr(p, 'position') and p.position == seat_index):
                    return {"success": False, "message": f"座位 {seat_index} 已被玩家 {player_name} 占用"}
            
            # 分配座位 - 同时设置seat和position属性
            player.seat = seat_index
            player.position = seat_index  # 确保position属性也被设置
            
            # 如果游戏已经开始，设置玩家在游戏中的在线状态和位置
            if self.game and hasattr(self.game, 'players'):
                if seat_index in self.game.players:
                    self.game.players[seat_index]['online'] = True
                    self.game.players[seat_index]['position'] = seat_index
                    print(f"设置游戏中座位 {seat_index} 的玩家 {username} 在线状态为true，位置为{seat_index}")
                else:
                    # 游戏已经开始，但座位号在game.players中不存在，需要添加新玩家数据
                    self.game.players[seat_index] = {
                        'name': username,
                        'chips': player.chips,
                        'position': seat_index,
                        'total_buy_in': player.total_buy_in if hasattr(player, 'total_buy_in') else 0,
                        'pending_buy_in': 0,
                        'online': True,
                        'has_discarded': False,
                        'discarded_card': None,
                        'bet_amount': 0
                    }
                    print(f"游戏已开始，添加新玩家 {username} 到game.players，座位 {seat_index}，筹码 {player.chips}")
            
            # 更新最后活动时间
            self.update_activity_time()
            
            print(f"玩家 {username} 已入座在座位 {seat_index}，同时设置position={seat_index}")
            
            return {
                "success": True,
                "message": "入座成功",
                "seat": seat_index,
                "position": seat_index,  # 在响应中也返回position
                "chips": player.chips
            }
            
        except Exception as e:
            import traceback
            print(f"入座操作错误: {str(e)}")
            traceback.print_exc()
            return {"success": False, "message": f"处理入座请求时出错: {str(e)}"}
            
    def stand_up(self, username):
        """处理玩家站起操作
        
        Args:
            username (str): 玩家用户名
            
        Returns:
            dict: 操作结果
        """
        try:
            print(f"处理站起请求: 玩家={username}")
            
            # 检查玩家是否在房间中
            if username not in self.players:
                return {"success": False, "message": "玩家不在房间中"}
                
            # 获取玩家对象
            player = self.players[username]
            
            # 检查玩家是否有座位
            if not hasattr(player, 'seat') or player.seat is None:
                return {"success": False, "message": "玩家未入座"}
                
            # 记录当前座位号
            current_seat = player.seat
            
            # 检查游戏是否已经开始
            if self.game and self.status == "playing":
                # 如果游戏已经开始，返回失败
                print(f"玩家 {username} 请求站起，但游戏已经开始，无法站起")
                return {"success": False, "message": "游戏进行中，无法站起"}
            
            # 游戏未开始，执行原有的站起逻辑
            
            # 检查游戏是否已经开始但可以站起（例如已弃牌）
            if self.game and hasattr(self.game, 'players') and current_seat in self.game.players:
                # 如果game.players中存在该位置，更新其position为null
                if 'position' in self.game.players[current_seat]:
                    self.game.players[current_seat]['position'] = None
                    print(f"更新游戏中座位 {current_seat} 的玩家 {username} 位置为null")
            
            # 清除玩家座位 - 同时清除seat和position属性
            player.seat = None
            player.position = None  # 确保position属性也被清除
            
            # 更新最后活动时间
            self.update_activity_time()
            
            print(f"玩家 {username} 已站起离开座位 {current_seat}")
            
            return {
                "success": True,
                "message": "站起成功",
                "chips": player.chips,
                "previous_seat": current_seat
            }
            
        except Exception as e:
            import traceback
            print(f"站起操作错误: {str(e)}")
            traceback.print_exc()
            return {"success": False, "message": f"处理站起请求时出错: {str(e)}"}
            
    def leave(self, username):
        """处理玩家离开房间操作
        
        Args:
            username (str): 玩家用户名
            
        Returns:
            dict: 操作结果
        """
        try:
            print(f"处理玩家离开请求: 玩家={username}")
            
            # 检查玩家是否在房间中
            if username not in self.players:
                return {"success": False, "message": "玩家不在房间中"}
            
            # 获取玩家对象
            player = self.players[username]
            
            # 判断游戏是否已经开始
            is_game_started = self.game is not None and self.status == "playing"
            
            if is_game_started:
                # 游戏已开始，只更新在线状态为false，不执行其他逻辑
                print(f"游戏已开始，玩家 {username} 离开，仅设置在线状态为false")
                
                # 找到玩家在游戏中的位置
                player_position = None
                if hasattr(player, 'seat') and player.seat is not None:
                    player_position = player.seat
                
                # 如果在游戏中找到了玩家的位置，更新在线状态
                if player_position is not None and player_position in self.game.players:
                    # 检查players字典中是否有online字段，如果没有则添加
                    if 'online' not in self.game.players[player_position]:
                        self.game.players[player_position]['online'] = False
                    else:
                        # 更新在线状态
                        self.game.players[player_position]['online'] = False
                    
                    print(f"已将游戏中位置 {player_position} 的玩家 {username} 设置为离线状态")
                    
                    # 返回成功
                    return {
                        "success": True,
                        "message": "成功离开房间（游戏中）",
                        "chips": player.chips,
                        "is_game_active": True
                    }
                else:
                    print(f"警告: 未能在游戏中找到玩家 {username} 的位置")
            else:
                # 游戏未开始，正常执行站起和移除逻辑
                print(f"游戏未开始，玩家 {username} 离开，执行正常离开流程")
                
                # 如果玩家有座位，先让玩家站起
                if hasattr(player, 'seat') and player.seat is not None:
                    stand_up_result = self.stand_up(username)
                    if not stand_up_result["success"]:
                        return stand_up_result
                
                # 保存玩家筹码数量
                chips = player.chips
                
                # 从房间中移除玩家
                success, removed_chips = self.remove_player(username)
                if not success:
                    return {"success": False, "message": "移除玩家失败"}
                
                # 如果这是房主离开且房间还有其他玩家，选择新房主
                if username == self.owner and len(self.players) > 0:
                    # 将第一个玩家设为新房主
                    self.owner = next(iter(self.players.keys()))
                    print(f"房主离开，设置新房主: {self.owner}")
                    
                # 更新最后活动时间
                self.update_activity_time()
                
                print(f"玩家 {username} 已离开房间，带走 {chips} 筹码")
                
                return {
                    "success": True,
                    "message": "成功离开房间",
                    "chips": chips,
                    "is_game_active": False
                }
            
        except Exception as e:
            import traceback
            print(f"玩家离开房间错误: {str(e)}")
            traceback.print_exc()
            return {"success": False, "message": f"处理离开房间请求时出错: {str(e)}"}
    
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
                "owner": self.owner,
                "gamePhase": self.game.get_game_phase() if self.game else None  #需保留用于开始游戏时room_update更新gamePhase
            }
            
            # 计算并添加剩余时间
            state["remaining_time"] = self.get_remaining_time()
            
            # 如果游戏尚未开始，仍然提供玩家信息
            if not self.game or self.status != "playing":
                # 添加玩家信息
                state["players"] = []
                for _, player in self.players.items():
                    player_state = {
                        "name": player.name,
                        "chips": player.chips,
                        "total_buy_in": player.total_buy_in,
                    }
                    
                    # 添加座位信息
                    if hasattr(player, 'seat') and player.seat is not None:
                        player_state["position"] = player.seat
                    
                    state["players"].append(player_state)
            
            # 如果游戏已经开始，添加游戏状态
            if self.game:
                game_state = self.game.get_state()
                state["game"] = game_state
                
                # 设置游戏状态标志
                if self.status == "playing":
                    state["is_game_started"] = True
                    
                    # 计算游戏剩余时间
                    if hasattr(self, 'game_start_time') and self.game_start_time and hasattr(self, 'game_end_time') and self.game_end_time:
                        import datetime
                        remaining_time = (self.game_end_time - datetime.datetime.now()).total_seconds()
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

    def change_seat(self, username, new_seat_index):
        """Allow a player to change seats
        
        Args:
            username (str): The player username
            new_seat_index (int): The new seat index to move to
            
        Returns:
            dict: Result of the operation with success status and message
        """
        try:
            # Validate new seat index
            if new_seat_index < 0 or new_seat_index >= self.max_players:
                return {"success": False, "message": f"Invalid seat number: {new_seat_index}"}
            
            # Check if player is in the room
            if username not in self.players:
                return {"success": False, "message": "Player is not in this room"}
            
            # Check if player is seated - 检查seat或position属性
            player = self.players[username]
            has_seat = hasattr(player, 'seat') and player.seat is not None
            has_position = hasattr(player, 'position') and player.position is not None
            
            if not (has_seat or has_position):
                return {"success": False, "message": "Player is not seated"}
            
            # 确定当前座位
            current_seat = player.seat if has_seat else player.position
            
            # If player is in an active game, they can't change seats
            if self.game and hasattr(self.game, 'is_player_active') and self.game.is_player_active(username):
                return {"success": False, "message": "Cannot change seats during an active game"}
            
            # Check if the new seat is already taken - 检查其他玩家的seat或position属性
            for p_name, p in self.players.items():
                if (p_name != username) and ((hasattr(p, 'seat') and p.seat == new_seat_index) or
                                             (hasattr(p, 'position') and p.position == new_seat_index)):
                    return {"success": False, "message": f"Seat {new_seat_index} is already taken"}
            
            # Store the old seat index for reference
            old_seat_index = current_seat
            
            # Change the seat - 同时更新seat和position属性
            player.seat = new_seat_index
            player.position = new_seat_index  # 确保position属性也被更新
            print(f"Player {username} changed seat from {old_seat_index} to {new_seat_index}, position also updated to {new_seat_index}")
            
            # 如果游戏已经开始，更新游戏中的玩家位置信息
            if self.game and hasattr(self.game, 'players'):
                # 如果旧座位号在game.players中存在，需要将玩家数据移到新座位号
                if old_seat_index in self.game.players:
                    # 临时保存玩家数据
                    player_data = self.game.players.pop(old_seat_index, None)
                    if player_data:
                        # 更新位置信息并存入新座位号
                        player_data['position'] = new_seat_index
                        self.game.players[new_seat_index] = player_data
                        print(f"更新游戏中玩家 {username} 的位置从 {old_seat_index} 到 {new_seat_index}")
                elif new_seat_index in self.game.players:
                    # 仅更新位置信息
                    self.game.players[new_seat_index]['position'] = new_seat_index
                    print(f"更新游戏中座位 {new_seat_index} 的玩家位置信息")
            
            return {
                "success": True, 
                "message": f"Changed seat from {old_seat_index} to {new_seat_index}",
                "old_seat": old_seat_index,
                "new_seat": new_seat_index
            }
        except Exception as e:
            import traceback
            traceback.print_exc()
            return {"success": False, "message": f"Error changing seat: {str(e)}"}

    def player_online_status(self, username, is_online):
        """更新玩家在线状态
        
        Args:
            username (str): 玩家用户名
            is_online (bool): 玩家是否在线
            
        Returns:
            bool: 操作是否成功
        """
        try:
            # 检查玩家是否在房间中
            if username not in self.players:
                print(f"玩家 {username} 不在房间中，无法更新在线状态")
                return False
                
            # 如果游戏已经开始，更新游戏中的玩家在线状态
            if self.game:
                # 查找玩家在游戏中的位置
                for position, player in self.game.players.items():
                    if player.get('name') == username:
                        self.game.players[position]['online'] = is_online
                        print(f"已更新游戏中玩家 {username} 在位置 {position} 的在线状态为 {is_online}")
                        break
                
            print(f"已更新玩家 {username} 的在线状态为 {is_online}")
            return True
        except Exception as e:
            print(f"更新玩家在线状态错误: {str(e)}")
            import traceback
            traceback.print_exc()
            return False