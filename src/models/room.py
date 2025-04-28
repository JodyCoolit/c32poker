from src.models.game import Game
import time
from datetime import datetime, timedelta
from src.models.player import Player

class Room:
    def __init__(self, room_id, name, max_players=8, small_blind=None, big_blind=None, buy_in_min=None, buy_in_max=None, game_duration_hours=2):
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
                        "total_buy_in": player.total_buy_in if hasattr(player, 'total_buy_in') else player.chips  # 传递总买入信息
                    })
            
            print(f"Player info list: {players_info}")
            
            # 检查是否有足够的玩家信息
            if len(players_info) < 2:
                print("有效的玩家信息不足")
                return {"success": False, "message": "有效的玩家信息不足"}
            
            # 创建游戏实例
            print(f"Creating Game instance with players_info: {players_info}")
            self.game = Game(players_info, small_blind=self.small_blind, big_blind=self.big_blind)
            
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
            
        # 计算赢家
        winners = self.game.get_winners()
        pot_per_winner = self.game.pot // len(winners) if winners else 0
        
        # 分配奖金
        for winner in winners:
            if winner.name in self.players:
                self.players[winner.name].chips += pot_per_winner
        
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
                # 添加新玩家到房间
                success, message = self.add_player(username, amount)
                if not success:
                    return {"success": False, "message": message}
                    
                # 设置玩家座位 - 同时设置seat和position属性
                self.players[username].seat = seat_index
                self.players[username].position = seat_index  # 确保position属性也被设置
                print(f"新玩家 {username} 已买入 {amount} 并坐在座位 {seat_index}，position={seat_index}")
                
                # 新玩家的总买入就是初始买入
                total_buy_in = amount
            else:
                # 更新现有玩家的筹码和座位
                self.players[username].chips += amount
                self.players[username].seat = seat_index
                self.players[username].position = seat_index  # 确保position属性也被设置
                
                # 累加总买入金额
                if hasattr(self.players[username], 'total_buy_in'):
                    self.players[username].total_buy_in += amount
                else:
                    # 如果玩家没有total_buy_in属性，则添加一个
                    self.players[username].total_buy_in = self.players[username].chips
                
                total_buy_in = self.players[username].total_buy_in
                print(f"玩家 {username} 已买入 {amount}，总买入: {total_buy_in}，总筹码: {self.players[username].chips}，座位: {seat_index}，position={seat_index}")
                
                # 如果游戏已经开始，也更新game.players中的total_buy_in
                if self.game and hasattr(self.game, 'players'):
                    # 查找玩家在game.players中的索引
                    player_game_idx = None
                    for idx, player in enumerate(self.game.players):
                        if isinstance(player, dict) and player.get('name') == username:
                            player_game_idx = idx
                            break
                        elif hasattr(player, 'name') and player.name == username:
                            player_game_idx = idx
                            break
                    
                    # 更新game.players中的数据
                    if player_game_idx is not None:
                        if isinstance(self.game.players[player_game_idx], dict):
                            # 更新总买入
                            self.game.players[player_game_idx]['total_buy_in'] = total_buy_in
                            # 更新当前筹码
                            self.game.players[player_game_idx]['chips'] = self.players[username].chips
                            print(f"已同步更新game对象中玩家 {username} 的总买入信息: {total_buy_in}")
                        else:
                            # 如果是对象形式，尝试更新属性
                            setattr(self.game.players[player_game_idx], 'total_buy_in', total_buy_in)
                            setattr(self.game.players[player_game_idx], 'chips', self.players[username].chips)
                            print(f"已同步更新game对象中玩家 {username} 的总买入信息: {total_buy_in}")
            
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
            
            player = self.players[username]
            
            # 检查玩家是否有座位 - 检查seat或position属性
            has_seat = hasattr(player, 'seat') and player.seat is not None
            has_position = hasattr(player, 'position') and player.position is not None
            
            if not (has_seat or has_position):
                return {"success": False, "message": "玩家未入座"}
            
            # 记录当前座位以供返回
            previous_seat = player.seat if has_seat else None
            previous_position = player.position if has_position else None
            
            # 使用任一有效座位
            current_seat = previous_seat if previous_seat is not None else previous_position
            
            # 如果游戏正在进行中且玩家是活跃玩家，需要先让玩家弃牌
            if self.game and self.status == "playing":
                # 找到玩家在游戏中的索引
                player_idx = None
                for idx, game_player in enumerate(self.game.players):
                    if game_player['name'] == username:
                        player_idx = idx
                        break
                
                # 如果玩家正在游戏中且是活跃玩家，则需要先弃牌
                if player_idx is not None and player_idx in self.game.active_players:
                    # 这里可以调用游戏的fold方法，或者直接将玩家从活跃列表中移除
                    if hasattr(self.game, 'handle_action'):
                        self.game.handle_action(player_idx, 'fold')
                    elif hasattr(self.game, 'active_players'):
                        self.game.active_players.remove(player_idx)
            
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
            
            # 如果玩家有座位，先让玩家站起
            player = self.players[username]
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
                "chips": chips
            }
            
        except Exception as e:
            import traceback
            print(f"玩家离开房间错误: {str(e)}")
            traceback.print_exc()
            return {"success": False, "message": f"处理离开房间请求时出错: {str(e)}"}
    
    def get_game_history(self):
        """获取游戏历史记录
        
        Returns:
            list: 游戏历史记录列表
        """
        try:
            print(f"获取房间 {self.room_id} 的游戏历史记录")
            
            # 如果没有游戏，返回空列表
            if not self.game:
                print("没有进行中的游戏，返回空历史记录")
                return []
                
            # 如果游戏对象中有 action_history 属性，返回该属性
            if hasattr(self.game, 'action_history'):
                history = self.game.action_history
                print(f"找到游戏历史记录，包含 {len(history)} 条记录")
                
                # 处理历史记录，添加可读的时间戳和动作描述
                formatted_history = []
                for entry in history:
                    # 复制条目，避免修改原始数据
                    formatted_entry = entry.copy()
                    
                    # 添加可读时间戳
                    if 'timestamp' in entry:
                        import datetime
                        formatted_entry['readable_time'] = datetime.datetime.fromtimestamp(
                            entry['timestamp']
                        ).strftime('%Y-%m-%d %H:%M:%S')
                    
                    # 添加可读动作描述
                    action = entry.get('action', '')
                    amount = entry.get('amount', 0)
                    player_idx = entry.get('player_idx', -1)
                    player_name = ""
                    
                    # 获取玩家名称
                    if 0 <= player_idx < len(self.game.players):
                        player_name = self.game.players[player_idx].get('name', f"玩家{player_idx}")
                    
                    # 构建动作描述
                    if action == 'fold':
                        formatted_entry['description'] = f"{player_name} 弃牌"
                    elif action == 'check':
                        formatted_entry['description'] = f"{player_name} 看牌"
                    elif action == 'call':
                        formatted_entry['description'] = f"{player_name} 跟注 {amount}"
                    elif action == 'bet':
                        formatted_entry['description'] = f"{player_name} 下注 {amount}"
                    elif action == 'raise':
                        formatted_entry['description'] = f"{player_name} 加注到 {amount}"
                    elif action == 'all-in':
                        formatted_entry['description'] = f"{player_name} 全押 {amount}"
                    elif action == 'small_blind':
                        formatted_entry['description'] = f"{player_name} 小盲注 {amount}"
                    elif action == 'big_blind':
                        formatted_entry['description'] = f"{player_name} 大盲注 {amount}"
                    elif action == 'discard':
                        formatted_entry['description'] = f"{player_name} 弃牌"
                    else:
                        formatted_entry['description'] = f"{player_name} {action} {amount if amount else ''}"
                    
                    formatted_history.append(formatted_entry)
                
                return formatted_history
            else:
                print("游戏对象没有历史记录属性")
                return []
        except Exception as e:
            import traceback
            print(f"获取游戏历史记录错误: {str(e)}")
            traceback.print_exc()
            return []
    
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