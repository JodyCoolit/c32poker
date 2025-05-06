import random
import uuid
import time
import threading
import datetime
import logging
import asyncio
import traceback
from concurrent.futures import ThreadPoolExecutor
from asyncio import get_event_loop_policy, run_coroutine_threadsafe

from src.models.deck import Deck
from src.models.player import Player
from src.utils.hand_evaluator import HandEvaluator
# 导入WebSocket管理器
from src.websocket_manager import ws_manager

# 配置日志
logging.basicConfig(
    level=logging.INFO,  # 默认日志级别，生产环境可设为WARNING
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("poker_server.log"),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger("poker")

# 辅助函数：在新的事件循环中执行异步任务
def run_async_in_new_loop(coro):
    """在新的事件循环中执行异步协程任务
    
    Args:
        coro: 要执行的异步协程
        
    Returns:
        协程执行的结果
    """
    try:
        # 创建新的事件循环
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        # 在新事件循环中执行协程
        result = loop.run_until_complete(coro)
        
        # 关闭事件循环
        loop.close()
        
        return result
    except Exception as e:
        print(f"Error executing async task in new loop: {str(e)}")
        traceback.print_exc()
        return None

class Game:
    def __init__(self, players_info, small_blind=None, big_blind=None, player_turn_time=30):
        """初始化游戏对象，但不开始游戏"""
        try:
            print(f"Initializing Game with players_info: {players_info}")
            
            # 定义最大支持的玩家数量
            self.MAX_PLAYERS = 8
            
            # 生成初始的手牌ID
            self.handid = str(uuid.uuid4())
            
            # 初始化游戏参数
            self.small_blind = small_blind if small_blind is not None else 0.5
            self.big_blind = big_blind if big_blind is not None else 1
            self.player_turn_time = player_turn_time 
            # 初始化数据结构
            self.players = {}
            for player_info in players_info:
                position = player_info["position"]
                self.players[position] = player_info
                # 初始化玩家弃牌状态
                self.players[position]["has_discarded"] = False
                self.players[position]["discarded_card"] = None
                # 记录玩家初始筹码数
                self.players[position]["initial_chips"] = player_info["chips"]
            
            # 按照位置从小到大排序active_players
            self.active_players = sorted([position for position, player in self.players.items() if player["chips"] > 0 and player["online"]])
            # 记录游戏开始时的玩家数量，用于决定行动顺序规则
            self.initial_player_count = len(self.active_players)
            print(f"游戏开始时的玩家数量: {self.initial_player_count}")
            self.pot = 0
            self.current_bet = 0
            self.community_cards = []
            self.betting_round = 0
            self.dealer_idx = random.choice(self.active_players)
            self.current_player_idx = self.dealer_idx
            self.last_player_to_raise = None
            
            # 使用字典初始化 player_acted，键为玩家位置，只包含筹码大于0的玩家
            self.player_acted = {position: False for position in self.active_players}
            
            # 初始化评估器和历史记录
            self.hand_evaluator = HandEvaluator()
            self.action_history = []
            self.game_history = []  # 存储已完成的游戏历史记录
            
            # 初始化计时器相关字段
            self.turn_timer = None
            self.hand_end_timer = None
            self.next_hand_timer = None
            self.turn_start_time = None
            self.hand_complete = False
            self.hand_winners = []
            self.current_player = None
            
            print("Game object initialized, ready to start round")
        except Exception as e:
            print(f"Error in Game.__init__: {str(e)}")
            traceback.print_exc()
            raise
    
    def __getstate__(self):
        """Support for pickle serialization"""
        return self.__dict__
    
    def __setstate__(self, state):
        """Support for pickle deserialization"""
        self.__dict__.update(state)
    
    def deal_cards(self):
        """Deal cards to all players"""
        print("Dealing cards to players")
        self.deck.shuffle()
        
        # 定义排序函数，用于对牌进行排序
        def sort_cards(cards):
            # 牌面大小顺序：A(最大)到2(最小)
            rank_order = {
                'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10, '9': 9, '8': 8,
                '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2
            }
            
            # 花色顺序：黑桃(s)>红心(h)>梅花(c)>方块(d)
            suit_order = {'s': 4, 'h': 3, 'c': 2, 'd': 1}
            
            # 自定义排序键函数
            def card_sort_key(card):
                rank = card.rank
                # 获取suit的值，处理Suit枚举类型
                suit = card.suit.value if hasattr(card.suit, 'value') else str(card.suit)
                return (-rank_order.get(rank, 0), -suit_order.get(suit, 0))
            
            # 返回排序后的牌
            return sorted(cards, key=card_sort_key)
        
        # Deal three cards to each player
        for position in self.active_players:
            card1 = self.deck.deal()
            card2 = self.deck.deal()
            card3 = self.deck.deal()
            print(f"Dealt cards to player position {position}: {card1}, {card2}, {card3}")
            
            # 对牌进行排序
            sorted_cards = sort_cards([card1, card2, card3])
            
            # 保存排序后的牌
            self.players[position]["hand"] = [
                card.to_dict() for card in sorted_cards
            ]
    
    def post_blinds(self):
        """Post small and big blinds"""
        print(f"\n=== POSTING BLINDS ===")
        
        # Show chips before blinds
        for position, player in self.players.items():
            print(f"Before blinds: {player['name']} has {player['chips']} chips")
        
        # 设置庄家位置 - 不下注
        button_idx = self.dealer_idx
        
        # 特殊处理两人游戏，确保庄家与小盲位不同人
        if len(self.players) == 2:
            # 在两人游戏中，庄家是小盲，另一位是大盲
            small_blind_idx = button_idx
            big_blind_idx = [pos for pos in self.active_players if pos != button_idx][0]  # 另一个活跃玩家
            
            print(f"两人游戏 - Button/SB位置: {button_idx} ({self.players[button_idx]['name']})")
            print(f"两人游戏 - BB位置: {big_blind_idx} ({self.players[big_blind_idx]['name']})")
        else:
            # 三人或更多玩家时使用正常规则
            active_positions = self.active_players
            button_position_index = active_positions.index(button_idx)
            small_blind_idx = active_positions[(button_position_index + 1) % len(active_positions)]
            big_blind_idx = active_positions[(button_position_index + 2) % len(active_positions)]
            print(f"Button position: {button_idx} ({self.players[button_idx]['name']}) - No blind posted")
        
        # 小盲下注
        if small_blind_idx in self.active_players:
            small_blind_amount = min(self.small_blind, self.players[small_blind_idx]["chips"])
            self.players[small_blind_idx]['bet_amount'] = small_blind_amount
            self.players[small_blind_idx]["chips"] -= small_blind_amount
            print(f"Small Blind: Player {small_blind_idx} ({self.players[small_blind_idx]['name']}) posts {small_blind_amount}, remaining chips: {self.players[small_blind_idx]['chips']}")
            
            # 记录小盲动作
            self.action_history.append({
                "round": self.betting_round,
                "player_idx": small_blind_idx,
                "action": "small_blind",
                "amount": small_blind_amount,
                "timestamp": time.time()
            })

            
        # 大盲下注
        if big_blind_idx in self.active_players:
            big_blind_amount = min(self.big_blind, self.players[big_blind_idx]["chips"])
            self.players[big_blind_idx]['bet_amount'] = big_blind_amount
            self.players[big_blind_idx]["chips"] -= big_blind_amount
            self.current_bet = big_blind_amount
            self.last_player_to_raise = big_blind_idx
            print(f"Big Blind: Player {big_blind_idx} ({self.players[big_blind_idx]['name']}) posts {big_blind_amount}, remaining chips: {self.players[big_blind_idx]['chips']}")
            
            # 记录大盲动作
            self.action_history.append({
                "round": self.betting_round,
                "player_idx": big_blind_idx,
                "action": "big_blind",
                "amount": big_blind_amount,
                "timestamp": time.time()
            })
        
        # Log player chips after blinds
        print("\n=== CHIPS AFTER BLINDS ===")
        for position, player in self.players.items():
            position_type = "BUTTON" if position == self.dealer_idx else \
                            "SMALL BLIND" if position == small_blind_idx else \
                            "BIG BLIND" if position == big_blind_idx else f"POSITION {position}"
            if isinstance(player, dict):
                print(f"{player['name']} has {player['chips']} chips, bet: {player.get('bet_amount', 0)}, position: {position_type}")
            else:
                print(f"{player.name} has {player.chips} chips, bet: {getattr(player, 'bet_amount', 0)}, position: {position_type}")
        print(f"Total bets on table: {self.get_total_bets()}")
    
    def to_dict(self):
        return {
            "handid": self.handid,
            "deck": self.deck.to_dict(),
            "players": self.players,
            "active_players": self.active_players,
            "pot": self.pot,
            "small_blind": self.small_blind,
            "big_blind": self.big_blind,
            "current_bet": self.current_bet,
            "community_cards": self.community_cards,
            "betting_round": self.betting_round,
            "current_player_idx": self.current_player_idx,
            "dealer_idx": self.dealer_idx,
            "player_acted": self.player_acted
        }
        
    def start_round(self):
        """开始一轮新游戏"""
        try:
            # 重置游戏状态
            self.deck = Deck()
            self.deck.shuffle()
            self.pot = 0
            self.current_bet = 0
            self.community_cards = []
            self.betting_round = 0
            
            # 重置玩家行动状态为字典，只包含活跃玩家（还在游戏中的玩家）
            self.player_acted = {position: False for position in self.active_players}
            
            # 重置每个玩家的弃牌状态
            for position in self.players:
                self.players[position]["has_discarded"] = False
                self.players[position]["discarded_card"] = None
            
            # 发牌
            self.deal_cards()
            
            # 设置庄家和盲注
            self.post_blinds()
            
            # 设置第一个玩家
            if len(self.players) == 2:
                # 两人游戏中，由小盲注位置(庄家位置)开始行动
                self.current_player_idx = self.dealer_idx
                print(f"两人游戏: 由小盲注位置(庄家位置)开始行动 (玩家索引: {self.current_player_idx})")
            else:
                # 多人游戏中，由大盲注后面的玩家开始行动
                dealer_index_in_list = self.active_players.index(self.dealer_idx) 
                next_player_index = (dealer_index_in_list + 3) % len(self.active_players)
                self.current_player_idx = self.active_players[next_player_index]
                print(f"多人游戏: 由大盲注后面的玩家开始行动 (玩家索引: {self.current_player_idx})")
            
            # 设置当前玩家名称和启动计时器
            if self.current_player_idx in self.players:
                self.current_player = self.players[self.current_player_idx]["name"]
                print(f"设置当前玩家为: {self.current_player}，索引: {self.current_player_idx}")
                
                # 尝试启动计时器
                self.start_turn_timer()
            else:
                print(f"警告: 无法找到有效的当前玩家")
            
            print(f"回合成功开始。当前玩家: {self.current_player if hasattr(self, 'current_player') else 'None'}")
            return True
        except Exception as e:
            print(f"Error in start_round: {str(e)}")
            traceback.print_exc()
            return False
            
    def handle_action(self, action, amount=0):
        """处理玩家动作"""
        try:
            # 确保玩家仍在游戏中
            if self.current_player_idx not in self.active_players:
                print(f"玩家 {self.current_player_idx} 不在活跃玩家列表中")
                return {"success": False, "message": f"玩家不在活跃玩家列表中"}
            
            # 检查玩家是否已经行动过
            if self.player_acted.get(self.current_player_idx, False):
                print(f"玩家 {self.current_player_idx} 已经行动过")
                return {"success": False, "message": f"玩家已经行动过"}
        
            print(f"处理玩家 {self.current_player_idx} 动作: {action}, 金额: {amount}")
        
            # 获取当前玩家
            current_player = self.players[self.current_player_idx]
            player_name = current_player["name"]
            
            # 确保金额是数值类型，允许小数
            try:
                amount = float(amount) if amount else 0
            except (TypeError, ValueError):
                print(f"无效的金额值: {amount}")
                return {"success": False, "message": f"无效的金额值: {amount}"}
            
            # 检查玩家是否需要先弃牌
            if len(current_player["hand"]) == 3 and not current_player.get("has_discarded", False):
                print(f"玩家 {player_name} 必须先弃掉一张牌")
                return {"success": False, "message": "玩家必须先弃掉一张牌"}
            
            # 记录动作到历史记录
            self.action_history.append({
                "round": self.betting_round,
                "player_idx": self.current_player_idx,
                "player": player_name,
                "action": action,
                "amount": amount,
                "timestamp": time.time()
            })
            
            if action == "fold":
                # 弃牌操作
                # 先获取当前玩家在活跃玩家列表中的索引，以便稍后使用
                current_idx = self.active_players.index(self.current_player_idx)
                print(f"玩家 {player_name} 选择弃牌，当前索引: {current_idx}")
                
                # 现在从活跃玩家列表中移除当前玩家
                self.active_players.remove(self.current_player_idx)
                self.player_acted[self.current_player_idx] = True
                
                # 检查是否只剩一个玩家
                if len(self.active_players) == 1:
                    self.finish_hand()
                    return {"success": True, "message": "成功弃牌，游戏结束"}
            
            elif action == "check":
                # 让牌操作，只有在没有人下注时才能让牌
                if self.current_bet > 0 and current_player.get("bet_amount", 0) < self.current_bet:
                    print(f"当前有玩家已下注 {self.current_bet}，不能让牌")
                    return {"success": False, "message": f"当前有玩家已下注 {self.current_bet}，不能让牌"}
                
                self.player_acted[self.current_player_idx] = True
                print(f"玩家 {player_name} 选择check")
            
            elif action == "call":
                # 跟注操作
                call_amount = self.current_bet - current_player.get("bet_amount", 0)
                
                if call_amount <= 0:
                    print("不需要跟注，使用让牌操作")
                    return self.handle_action("check")
                
                if call_amount > current_player["chips"]:
                    print(f"玩家筹码不足，自动改为全下")
                    return self.handle_action("all-in")
                
                # 更新玩家筹码和下注金额
                current_player["chips"] -= call_amount
                current_player["bet_amount"] += call_amount
                self.player_acted[self.current_player_idx] = True
                print(f"玩家 {player_name} 跟注 {call_amount}")
            elif action == "raise":
                # 加注操作
                if amount <= self.current_bet:
                    print(f"加注金额 {amount} 必须大于当前最大下注 {self.current_bet}")
                    return {"success": False, "message": f"加注金额必须大于当前最大下注 {self.current_bet}"}
                
                # 检查最小加注规则
                min_raise = self.current_bet * 2 if self.current_bet > 0 else self.big_blind
                if amount < min_raise and amount < current_player["chips"] + current_player["bet_amount"]:
                    print(f"加注金额 {amount} 必须至少为 {min_raise}")
                    return {"success": False, "message": f"加注金额必须至少为 {min_raise}"}
                
                if amount > current_player["chips"] + current_player["bet_amount"]:
                    print(f"玩家筹码不足，最多能下注 {current_player['chips'] + current_player['bet_amount']}")
                    return {"success": False, "message": f"玩家筹码不足，最多能下注 {current_player['chips'] + current_player['bet_amount']}"}
                
                # 计算实际加注金额
                actual_amount = amount - current_player["bet_amount"]
                
                # 更新玩家筹码和下注金额
                current_player["chips"] -= actual_amount
                current_player["bet_amount"] = amount
                self.current_bet = amount
                
                # 检查玩家是否已经没有筹码（全下）
                if current_player["chips"] == 0:
                    current_player["is_all_in"] = True
                    print(f"玩家 {player_name} 已全下")
                
                # 重置其他玩家的行动状态
                for position in self.active_players:
                    if position != self.current_player_idx:
                        self.player_acted[position] = False
                        
                self.player_acted[self.current_player_idx] = True
                print(f"玩家 {player_name} 加注到 {amount}")
            
            elif action == "all-in":
                # 全下操作
                all_in_amount = current_player["chips"] + current_player["bet_amount"]
                
                # 更新下注金额
                current_player["chips"] = 0
                all_in_increase = all_in_amount - current_player["bet_amount"]
                current_player["bet_amount"] = all_in_amount
                current_player["is_all_in"] = True
                print(f"玩家 {player_name} 已全下")
                
                if all_in_amount > self.current_bet:
                    self.current_bet = all_in_amount
                    # 重置其他玩家的行动状态
                    for position in self.active_players:
                        if position != self.current_player_idx:
                            self.player_acted[position] = False
                
                self.player_acted[self.current_player_idx] = True
                print(f"玩家 {player_name} 全下 {all_in_amount}")
            
            else:
                print(f"未知动作: {action}")
                return {"success": False, "message": f"未知动作: {action}"}
            
            # 检查是否所有剩余活跃玩家都已全下
            all_remaining_all_in = True
            for position in self.active_players:
                if not self.players[position].get("is_all_in", False):
                    all_remaining_all_in = False
                    break
            
            if all_remaining_all_in and len(self.active_players) > 1:
                print("所有剩余玩家都已全下，直接进入摊牌阶段")
                # 发放剩余公共牌并结束游戏
                self.finish_hand()
                return {"success": True, "message": "所有玩家都已全下，进入摊牌阶段"}
            
            # 检查当前玩家是否是最后一个需要行动的玩家
            # 在加注后，只有一位玩家需要行动的情况下
            print(f"\n当前活跃玩家: {self.active_players}")
            print(f"当前下注金额: {self.current_bet}")
            print(f"已经行动玩家: {[pos for pos in self.active_players if self.player_acted.get(pos, False)]}")
            print(f"未行动玩家: {[pos for pos in self.active_players if not self.player_acted.get(pos, False)]}")
            
            # 检查是否所有玩家都行动过了
            if self.check_all_players_acted():
                print("所有玩家都已经行动过，准备进入下一轮")
                # 所有玩家都行动过，进入下一轮
                self.advance_betting_round()
            else:
                need_action_players = [pos for pos in self.active_players if not self.player_acted.get(pos, False) and not self.players[pos].get("is_all_in", False)]
                print(f"需要行动的玩家: {need_action_players}")
                
                # 移动到下一个玩家
                if action == "fold":
                    # 如果是弃牌操作，使用之前保存的索引
                    self.advance_player(current_idx)
                else:
                    # 其他操作正常调用
                    self.advance_player()
            
            return {"success": True, "message": f"成功执行{action}操作"}
        except Exception as e:
            print(f"Error in Game.handle_action: {str(e)}")
            traceback.print_exc()
            return {"success": False, "message": f"处理动作时发生错误: {str(e)}"}

    def get_winners(self):
        # Log pot and player chips before determining winners
        print("\n=== DETERMINING WINNERS ===")
        print(f"Current pot: {self.pot}, player bets total: {self.get_total_bets()}")
        for i, player in enumerate(self.players):
            print(f"{player['name']} has {player['chips']} chips, bet: {player['bet_amount']}")
        
        # Calculate the pot
        self.pot = self.get_total_bets()
        print(f"Final pot after adding bets: {self.pot}")
        
        if len(self.active_players) == 1:
            # Only one player left
            winner_idx = self.active_players[0]
            winner_name = self.players[winner_idx]["name"]
            old_chips = self.players[winner_idx]["chips"]
            self.players[winner_idx]["chips"] += self.pot
            print(f"Winner (last player standing): {winner_name}, chips: {old_chips} -> {self.players[winner_idx]['chips']}")
            
            # Record the win
            self.action_history.append({
                "round": self.betting_round,
                "player_idx": winner_idx,
                "action": "win_by_default",
                "amount": self.pot,
                "timestamp": time.time()
            })
            return {"winners": [winner_idx], "pot": self.pot}
            
        # Evaluate hands for all active players
        player_scores = []
        for player_idx in self.active_players:
            player = self.players[player_idx]
            # Combine player's hole cards with community cards
            cards = player["hand"] + self.community_cards
            score = self.hand_evaluator.evaluate_hand(cards, self.community_cards)
            player_scores.append((player_idx, score))
            
        # Find the highest score
        player_scores.sort(key=lambda x: x[1], reverse=True)
        best_score = player_scores[0][1]
        
        # All players with the best score are winners
        winners = [idx for idx, score in player_scores if score == best_score]
        
        # Split the pot among winners
        winnings = self.pot // len(winners)
        for winner_idx in winners:
            self.players[winner_idx]["chips"] += winnings
            # 记录玩家通过牌面获胜
            self.action_history.append({
                "round": self.betting_round,
                "player_idx": winner_idx,
                "action": "win_showdown",
                "amount": winnings,
                "timestamp": time.time(),
                "hand_type": best_score[3]  # 记录牌型
            })
            
        # Log final chip counts after distributing the pot
        print("\n=== FINAL CHIP COUNTS ===")
        for i, player in enumerate(self.players):
            print(f"{player['name']} final chip count: {player['chips']}")
        
        return {"winners": winners, "pot": self.pot}
    
    def deal_flop(self):
        """发放翻牌圈三张公共牌"""
        try:
            # 烧牌
            if len(self.deck.cards) > 0:
                self.deck.deal()
                
            # 发三张公共牌
            for _ in range(3):
                if len(self.deck.cards) > 0:
                    card = self.deck.deal()
                    # 将Card对象转换为字典再添加到community_cards
                    self.community_cards.append(card.to_dict())
                    print(f"发放公共牌: {card}")
                else:
                    print("牌组已空，无法发放更多公共牌")
        except Exception as e:
            print(f"Deal flop error: {e}")
            traceback.print_exc()
            
    def deal_turn(self):
        """发放转牌圈一张公共牌"""
        try:
            # 烧牌
            if len(self.deck.cards) > 0:
                self.deck.deal()
                
            # 发一张转牌
            if len(self.deck.cards) > 0:
                card = self.deck.deal()
                # 将Card对象转换为字典再添加到community_cards
                self.community_cards.append(card.to_dict())
                print(f"发放转牌: {card}")
            else:
                print("牌组已空，无法发放转牌")
        except Exception as e:
            print(f"Deal turn error: {e}")
            traceback.print_exc()
            
    def deal_river(self):
        """发放河牌圈一张公共牌"""
        try:
            # 烧牌
            if len(self.deck.cards) > 0:
                self.deck.deal()
                
            # 发一张河牌
            if len(self.deck.cards) > 0:
                card = self.deck.deal()
                # 将Card对象转换为字典再添加到community_cards
                self.community_cards.append(card.to_dict())
                print(f"发放河牌: {card}")
            else:
                print("牌组已空，无法发放河牌")
        except Exception as e:
            print(f"Deal river error: {e}")
            traceback.print_exc()
        
    def advance_player(self, current_idx=None):
        try:
            # 如果没有活跃玩家，返回
            if not self.active_players:
                print("没有玩家可以行动")
                return
                
            # 当前玩家弃牌后，当前玩家在active_players里的index已经指向了下一个活跃玩家
            if current_idx is not None:
                # 检查current_idx是否超出了活跃玩家列表范围（当最后一个玩家弃牌时会发生）
                if current_idx < len(self.active_players):
                    self.current_player_idx = self.active_players[current_idx]
                else:
                    # 如果超出范围，则设置为第一个活跃玩家（循环到列表开头）
                    self.current_player_idx = self.active_players[0]
                    print(f"current_idx {current_idx} 超出了活跃玩家列表范围，设置为第一个活跃玩家: {self.current_player_idx}")
            else:
                current_idx = self.active_players.index(self.current_player_idx)
                
                # 找到下一个非全下的活跃玩家
                for _ in range(len(self.active_players)):
                    next_idx = (current_idx + 1) % len(self.active_players)
                    candidate_player_idx = self.active_players[next_idx]
                    
                    # 如果玩家已经全下，继续找下一个
                    if self.players[candidate_player_idx].get("is_all_in", False):
                        current_idx = next_idx
                        continue
                        
                    # 找到了非全下的玩家
                    self.current_player_idx = candidate_player_idx
                    break
            
            # 更新当前玩家属性
            if self.current_player_idx in self.players:
                self.current_player = self.players[self.current_player_idx]["name"]
                print(f"轮到玩家 {self.current_player} (位置 {self.current_player_idx})")
                # 启动新玩家的计时器
                self.start_turn_timer()
            else:
                self.current_player = None
                print(f"警告: 当前玩家位置 {self.current_player_idx} 不存在于玩家字典中")
        except Exception as e:
            print(f"Error in Game.advance_player: {str(e)}")
            traceback.print_exc()
            # 出错时不改变任何状态
        
    def check_all_players_acted(self):
        """检查是否所有玩家都已经行动过
        
        Returns:
            bool: 如果所有玩家都已行动过，则返回True
        """
        print("检查是否所有活跃玩家都已行动：")
        for player_idx in self.active_players:
            # 跳过已经全下的玩家
            if self.players[player_idx].get("is_all_in", False):
                print(f"  玩家 {player_idx} 已全下，跳过检查")
                continue
                
            if not self.player_acted.get(player_idx, False):
                print(f"  玩家 {player_idx} 尚未行动，返回False")
                return False
            else:
                print(f"  玩家 {player_idx} 已经行动过")
        
        # 如果遍历完所有活跃玩家都已行动，或者被跳过(全下)，则返回True
        print("  所有玩家都已行动，返回True")
        return True
        
    def advance_betting_round(self):
        """
        进入下一个下注轮，将当前下注轮的筹码移入底池，并根据轮次发牌
        """
        print(f"\n==== 进入下一轮，当前轮： {self.betting_round} ====")
        
        # 将所有玩家的当前下注加到底池
        self.pot += self.get_total_bets()
        for position in self.players:
            self.players[position]['bet_amount'] = 0
            
        # 重置当前最高下注额
        self.current_bet = 0
        # 重置玩家是否行动过，只包含活跃且非全下的玩家
        self.player_acted = {
            position: False 
            for position in self.active_players 
            if not self.players[position].get("is_all_in", False)
        }
            
        try:
            # 根据当前轮次发放公共牌
            if self.betting_round == 0:  # preflop
                self.betting_round = 1  # flop
                print("发放翻牌圈 (flop)")
                self.deal_flop()
            elif self.betting_round == 1:  # flop
                self.betting_round = 2  # turn
                print("发放转牌圈 (turn)")
                self.deal_turn()
            elif self.betting_round == 2:  # turn
                self.betting_round = 3  # river
                print("发放河牌圈 (river)")
                self.deal_river()
            elif self.betting_round == 3:  # river
                print("本手牌结束")
                self.finish_hand()
                return
            
            # 设置下一个行动的玩家
            if self.betting_round >= 1:  # flop及之后的轮次
                print("\n---- 设置翻牌圈及之后轮次的第一个行动玩家 ----")
                # 获取所有活跃玩家，按位置排序
                sorted_active_players = sorted(self.active_players)
                print(f"当前活跃玩家列表(按位置排序): {sorted_active_players}")
                print(f"当前庄家位置: {self.dealer_idx}")
                print(f"游戏开始时的玩家数量: {self.initial_player_count}")
                
                # 打印所有玩家的信息，便于调试
                print("\n当前所有玩家信息:")
                for pos, player in self.players.items():
                    player_name = player.get('name', f'Player_{pos}')
                    is_active = pos in self.active_players
                    is_dealer = pos == self.dealer_idx
                    print(f"  位置:{pos}, 玩家:{player_name}, 是否活跃:{is_active}, 是否庄家:{is_dealer}, 筹码:{player.get('chips', 0)}")
                
                # 如果有活跃玩家
                if sorted_active_players:
                    # 查找小盲位置的索引
                    # 使用初始玩家数量来决定行动顺序规则，而不是当前活跃玩家数量
                    small_blind_idx = None
                    if self.initial_player_count == 2:
                        # 两人游戏中的行动顺序处理
                        # 翻牌前：庄家位(小盲位)先行动
                        # 翻牌后(flop/turn/river)：非庄家位(大盲位)先行动
                        
                        # 所有翻牌后轮次(flop/turn/river)，找到非庄家位置(大盲位)作为第一个行动玩家
                        for pos in sorted_active_players:
                            if pos != self.dealer_idx:
                                small_blind_idx = pos  # 翻牌后第一个行动的是大盲位
                                print(f"两人游戏(翻牌后): 大盲位置先行动 = {small_blind_idx}")
                                break
                    else:
                        # 三人或更多玩家时，小盲是庄家后一位
                        print(f"三人或更多玩家游戏(初始)，准备寻找庄家后的第一个活跃玩家作为小盲位置")
                        
                        # 获取所有位置，不仅仅是活跃的
                        all_positions = sorted(self.players.keys())
                        print(f"所有座位位置(按顺序): {all_positions}")
                        
                        if self.dealer_idx in all_positions:
                            # 找到庄家在所有位置中的索引
                            dealer_pos_in_all = all_positions.index(self.dealer_idx)
                            print(f"庄家位置 {self.dealer_idx} 在所有位置中的索引: {dealer_pos_in_all}")
                            
                            # 从庄家位置之后开始循环查找第一个活跃玩家
                            print(f"开始从庄家位置之后查找第一个活跃玩家...")
                            for i in range(1, len(all_positions) + 1):
                                next_pos = (dealer_pos_in_all + i) % len(all_positions)
                                candidate = all_positions[next_pos]
                                print(f"  检查位置: {candidate} (索引 {next_pos})")
                                if candidate in sorted_active_players:
                                    small_blind_idx = candidate
                                    print(f"  找到小盲位置: {small_blind_idx}, 玩家: {self.players[small_blind_idx]['name']}")
                                    break
                            else:
                                print(f"警告: 无法找到庄家之后的活跃玩家作为小盲")
                        else:
                            print(f"警告: 庄家位置 {self.dealer_idx} 不存在于所有位置列表中")
                    
                    # 设置第一个行动的玩家
                    self.current_player_idx = small_blind_idx
                    
                    if small_blind_idx is not None:
                        player_name = self.players[small_blind_idx].get('name', f'Player_{small_blind_idx}')
                        print(f"小盲位置或之后的第一个活跃玩家 {player_name} (位置 {small_blind_idx}) 将首先行动")
                    else:
                        print("警告: small_blind_idx 是 None，无法设置第一个行动的玩家")
                else:
                    print("警告: 没有活跃玩家可以行动")
            
            # 如果设置了current_player_idx，同时更新current_player
            if self.current_player_idx in self.players:
                self.current_player = self.players[self.current_player_idx]["name"]
                print(f"已设置当前玩家为: {self.current_player} (位置 {self.current_player_idx})")
                # 启动新玩家的计时器
                self.start_turn_timer()
            else:
                print(f"警告: 当前玩家索引 {self.current_player_idx} 不存在于玩家字典中")
                
            # 打印当前状态
            print(f"\n进入{self.betting_round}轮, 当前玩家索引: {self.current_player_idx}, 底池: {self.pot}")
            print(f"公共牌: {[str(card) for card in self.community_cards]}")
            print("==== advance_betting_round 完成 ====\n")
            
        except Exception as e:
            print(f"Advance betting round error: {e}")
            traceback.print_exc()

    def get_state(self):
        """获取游戏状态"""
        try:
            # 创建游戏状态字典
            state = {
                "handid": self.handid,
                "state": "playing",
                "players": [],
                "pot": self.pot,
                "total_pot": self.pot + self.get_total_bets(),
                "current_bet": self.current_bet,
                "community_cards": self.community_cards,
                "dealer_idx": self.dealer_idx,
                "current_player_idx": self.current_player_idx,
                "current_player": self.players[self.current_player_idx],
                "betting_round": self.betting_round,
                "game_phase": self.get_game_phase(),
                "active_players": self.active_players,
                "blinds": {
                    "small": self.small_blind,
                    "big": self.big_blind
                }
            }
            
            # 获取当前玩家的用户名
            if self.current_player_idx in self.players:
                state["current_player_id"] = self.players[self.current_player_idx].get("name", "")
            else:
                state["current_player_id"] = ""
            
            # 添加计时器信息
            if self.turn_start_time:
                time_elapsed = time.time() - self.turn_start_time
                remaining_time = max(0, self.player_turn_time - time_elapsed)
                state["turn_remaining_time"] = remaining_time
                state["turn_time_limit"] = self.player_turn_time
                
            # 为每个玩家创建状态信息
            for position, player in self.players.items():
                # 基本信息
                player_state = {
                    "name": player.get("name", f"Player {position}"),
                    "chips": player.get("chips", 0),
                    "position": position,
                    "seat": position,  # 确保返回seat信息
                    "is_active": position in self.active_players,
                    "bet_amount": player.get("bet_amount", 0),
                    "folded": position not in self.active_players,
                    "is_current_player": position == self.current_player_idx,
                    "total_buy_in": player.get("total_buy_in", player.get("chips", 0)),
                    "pending_buy_in": player.get("pending_buy_in", 0)
                }
                
                # 直接从玩家对象获取弃牌状态
                player_state["has_discarded"] = player.get("has_discarded", False)
                
                # 在游戏结束时 (hand_complete) 或者摊牌阶段 (betting_round >= 4) 显示所有活跃玩家的牌
                if self.hand_complete or self.betting_round >= 4:
                    if player.get("hand") and position in self.active_players:
                        player_state["hand"] = player.get("hand", [])
                        # 如果有赢家，添加牌型信息
                        if hasattr(self, 'hand_winners') and position in self.hand_winners:
                            # 在这里可以添加牌型信息，比如"两对"，"同花顺"等
                            # 为了简单起见，这里不实现详细牌型，但可以标记为赢家
                            player_state["is_winner"] = True
                
                state["players"].append(player_state)
            
            # 如果游戏已结束，添加游戏结束相关信息
            if self.hand_complete:
                state["hand_complete"] = True
                state["hand_winners"] = self.hand_winners
                state["showdown"] = len(self.active_players) > 1  # 如果多于一个玩家到达摊牌阶段，则为摊牌
            
            return state
            
        except Exception as e:
            import traceback
            print(f"Error in Game.get_state: {str(e)}")
            traceback.print_exc()
            # Return minimal state to prevent crashes
            return {
                "error": str(e),
                "state": "error",
                "players": [],
                "pot": 0,
                "community_cards": []
            }

    def get_turn_time_remaining(self):
        """Get the remaining time for the current player's turn"""
        # 如果没有启动计时器，强制启动
        if not hasattr(self, 'turn_start_time') or self.turn_start_time is None:
            print(f"警告: 计时器未启动，现在强制启动")
            self.turn_start_time = time.time()
        
        # 计算剩余时间
        elapsed = time.time() - self.turn_start_time
        remaining = max(0, self.player_turn_time - elapsed)
        return round(remaining)

    def start_turn_timer(self):
        """Start timer for current player's turn"""
        # Cancel any existing timer
        if self.turn_timer:
            self.turn_timer.cancel()
            
        # 记录当前时间作为计时器开始时间，确保始终设置
        if not hasattr(self, 'turn_start_time') or self.turn_start_time is None:
            self.turn_start_time = time.time()
            print(f"计时器初始化: 设置时间为 {self.turn_start_time}")
        
        # 创建超时处理计时器
        self.turn_timer = threading.Timer(self.player_turn_time, self.handle_timeout)
        self.turn_timer.daemon = True
        self.turn_timer.start()
        
    def handle_timeout(self):
        """Handle case when player's turn timer expires"""
        player_idx = self.current_player_idx
        action_taken = None
        player = self.players[player_idx]
        player_name = player.get("name", f"Player {player_idx}")
        current_idx = None

        from src.models.room import get_room_by_game
        
        if player_idx in self.active_players:
            player = self.players[player_idx]
            
            # Check if player needs to discard first
            if len(player["hand"]) == 3 and not player.get("has_discarded", False):
                # Randomly discard a card
                discard_index = random.randint(0, 2)
                
                # 使用handle_discard来处理超时弃牌
                self.current_player_idx = player_idx  # 确保当前玩家设置正确
                discard_result = self.handle_discard(player_idx, discard_index)
                
                # Add timeout to action history
                self.action_history.append({
                    "round": self.betting_round,
                    "player_idx": player_idx,
                    "action": "timeout_discard",
                    "discard_index": discard_index,
                    "timestamp": time.time()
                })
                
                # 立即广播弃牌操作，确保前端更新玩家的牌
                room = get_room_by_game(self)
                if room:
                    updated_state = room.get_state()
                    
                    # 创建弃牌广播消息
                    discard_broadcast = {
                        "type": "game_update",
                        "data": {
                            "action": "discard",
                            "player": player_name,
                            "amount": discard_index,  # 弃牌索引作为金额
                            "result": {"success": True, "message": f"Player timeout, automatic discard card at index {discard_index}"},
                            "game_state": updated_state,
                            "is_key_update": True,
                            "timestamp": time.time(),
                            "update_reason": "player_timeout_discard"
                        }
                    }
                    
                    # 广播弃牌操作
                    try:
                        # 使用辅助函数在新事件循环中执行广播
                        run_async_in_new_loop(
                            ws_manager.broadcast_to_room(room.room_id, discard_broadcast)
                        )
                        print(f"[BROADCAST][game_update]: Timeout discard, Player={player_name}, Index={discard_index}")
                    except Exception as e:
                        print(f"Error broadcasting timeout discard: {str(e)}")
                        traceback.print_exc()
            
            # Default action is to fold if bet is required, check if possible
            if self.current_bet > self.players[player_idx].get("bet_amount", 0):
                # Player needs to call/raise, but timer expired - fold
                self.current_player_idx = player_idx  # 确保当前玩家设置正确
                current_idx = self.active_players.index(self.current_player_idx)
                result = self.handle_action("fold", 0)
                action_taken = "fold"
            else:
                # Player can check
                self.current_player_idx = player_idx  # 确保当前玩家设置正确
                result = self.handle_action("check", 0)
                action_taken = "check"
        
        # Add timeout to action history
        self.action_history.append({
            "round": self.betting_round,
            "player_idx": player_idx,
            "action": "timeout",
            "timestamp": time.time()
        })

        # 检查是否所有玩家都已行动，如果是则进入下一轮
        if self.check_all_players_acted():
            self.advance_betting_round()
        else:
            # 移动到下一个玩家
            if action_taken == "fold":
                # 如果是弃牌操作，使用之前保存的索引
                self.advance_player(current_idx)
            else:
                # 其他操作正常调用
                self.advance_player()

        # 广播常规操作(fold/check)
        # 获取关联的房间
        room = get_room_by_game(self)
        if room and action_taken:
            # 获取更新后的游戏状态
            updated_state = room.get_state()
            
            # 创建广播消息
            broadcast_message = {
                "type": "game_update",
                "data": {
                    "action": action_taken,  # 使用实际执行的动作
                    "player": player_name,
                    "amount": 0,
                    "result": {"success": True, "message": f"Player timeout, automatic {action_taken}"},
                    "game_state": updated_state,
                    "is_key_update": True,
                    "timestamp": time.time(),
                    "update_reason": f"player_timeout_{action_taken}"
                }
            }
            
            # 使用异步方式广播消息
            try:
                # 使用辅助函数在新事件循环中执行广播
                run_async_in_new_loop(
                    ws_manager.broadcast_to_room(room.room_id, broadcast_message)
                )
                print(f"[BROADCAST][game_update]: Timeout action={action_taken}, Player={player_name}")
            except Exception as e:
                print(f"Error broadcasting timeout action: {str(e)}")
                traceback.print_exc()
    
    def cancel_turn_timer(self):
        """Cancel the current turn timer"""
        if hasattr(self, 'turn_timer') and self.turn_timer:
            self.turn_timer.cancel()
            self.turn_timer = None
            
    def cancel_all_timers(self):
        """Cancel all active timers (turn and next hand)"""
        try:
            if self.turn_timer:
                self.turn_timer.cancel()
                self.turn_timer = None
        except Exception as e:
            print(f"Error canceling turn timer: {e}")
            
        try:
            if self.next_hand_timer:
                self.next_hand_timer.cancel()
                self.next_hand_timer = None
        except Exception as e:
            print(f"Error canceling next hand timer: {e}")
            
    def schedule_next_hand(self):
        """Cancel existing timers and schedule the start of the next hand after 5 seconds"""
        self.cancel_all_timers()
        
        # Get a reference to the room object from global context
        from src.models.room import get_room_by_game
        room = get_room_by_game(self)
        
        # Check if room exists and if game time is over
        if room and room.get_remaining_time() <= 0:
            print(f"Game time is over. Ending game in room {room.room_id}")
            # Cancel all timers to prevent memory leaks
            self.cancel_all_timers()
            
            # End the game in the room
            room.end_game()
            
            # Create a game end message
            game_end_message = {
                "type": "game_end",
                "data": {
                    "reason": "time_limit_reached",
                    "message": "游戏时间已结束",
                    "timestamp": time.time()
                }
            }
            
            # Schedule the broadcast to avoid blocking
            try:
                # 使用辅助函数在新事件循环中执行广播
                run_async_in_new_loop(
                    ws_manager.broadcast_to_room(room.room_id, game_end_message)
                )
                print(f"游戏结束广播已安排，原因：游戏时间已结束")
            except Exception as e:
                print(f"Error broadcasting game end: {str(e)}")
                traceback.print_exc()
            
            return
        
        print(f"Next hand will start in 5 seconds...")
        self.next_hand_timer = threading.Timer(5.0, self.start_next_hand)
        self.next_hand_timer.daemon = True
        self.next_hand_timer.start()
        
    def start_next_hand(self):
        """Reset game state for next hand"""
        self.next_hand_timer = None
        self.hand_complete = False
        self.hand_winners = []
        self.community_cards = []
        self.pot = 0
        self.current_bet = 0
        
        # 在新一局开始前，检查离线但仍占座的玩家并执行自动离座
        offline_seated_players = [
            position for position, player in self.players.items()
            if not player.get("online", True) and player.get("chips", 0) > 0
        ]
        
        # 对离线但仍占座的玩家执行处理
        if offline_seated_players:
            print(f"发现离线玩家，准备处理: {offline_seated_players}")
            # 找到房间对象
            from src.models.room import get_room_by_game
            room = get_room_by_game(self)
            if room:
                for position in offline_seated_players:
                    player_name = self.players[position].get("name")
                    print(f"离线玩家 {player_name} (位置 {position}) 自动离座")
                    
                    # 更新玩家在游戏中的状态
                    # 不能完全移除玩家数据，只是将状态更新为离线
                    if position in self.players:
                        self.players[position]["position"] = None
                        print(f"已将离线玩家 {player_name} 的位置设置为None")
        
        # 生成新的手牌ID
        self.handid = str(uuid.uuid4())
        print(f"Starting next hand with handid: {self.handid}")
        
        # 重置每个玩家的下注金额，allin状态，pending_buy_in结算，重置玩家弃牌状态。
        for position in self.players:
            self.players[position]['bet_amount'] = 0
            # 重置全压状态
            self.players[position]['is_all_in'] = False
            # 重置弃牌状态和弃掉的牌
            self.players[position]['has_discarded'] = False
            self.players[position]['discarded_card'] = None
            
            # 处理pending_buy_in，更新玩家筹码
            if self.players[position]['pending_buy_in'] > 0:
                pending_amount = self.players[position]['pending_buy_in']
                self.players[position]['chips'] += pending_amount
                print(f"处理玩家 {self.players[position].get('name')} 在位置 {position} 的待处理买入: {pending_amount}，更新后筹码: {self.players[position]['chips']}")
                # 重置pending_buy_in为0
                self.players[position]['pending_buy_in'] = 0
        
        # Check for active players with chips
        self.active_players = sorted([position for position, player in self.players.items() if player["chips"] > 0 and player["online"]])
        
        # 更新初始玩家数量，确保新一手牌使用正确的行动顺序规则
        self.initial_player_count = len(self.active_players)
        print(f"新一手牌的初始玩家数量: {self.initial_player_count}")
        
        if len(self.active_players) <= 1:
            print("Game paused: only one player with chips remaining")
            # 找到关联的房间对象
            from src.models.room import get_room_by_game
            room = get_room_by_game(self)
            if room:
                # 将房间状态设置为 paused
                room.status = "paused"
                print(f"房间 {room.room_id} 状态设置为 paused - 等待更多玩家加入")
            return
        
        current_dealer_index = self.dealer_idx
        # Move dealer button - 修正dealer位置计算
        try:
            # 如果当前庄家位置不在活跃玩家列表中，则找一个新的庄家位置
            if self.dealer_idx not in self.active_players:
                print(f"庄家位置 {self.dealer_idx} 不在活跃玩家列表中，寻找新的庄家位置")
                # 从所有位置中找到一个最接近原庄家位置的活跃玩家作为新庄家
                # 从庄家之后的位置开始找
                for i in range(1, self.MAX_PLAYERS): # 使用类变量代替硬编码的8
                    next_pos = (self.dealer_idx + i) % self.MAX_PLAYERS
                    if next_pos in self.active_players:
                        self.dealer_idx = next_pos
                        print(f"选择新的庄家位置: {self.dealer_idx}")
                        break

            print(f"移动庄家按钮: {current_dealer_index} -> {self.dealer_idx} (位置 {self.dealer_idx})")
        except Exception as e:
            # 如果出错，选择第一个活跃玩家作为庄家
            self.dealer_idx = self.active_players[0]
            print(f"ERROR 处理庄家按钮时出错: {str(e)}，选择第一个活跃玩家 {self.dealer_idx} 作为庄家")
        
        # 调用start_round方法来处理发牌、盲注和玩家设置
        self.start_round()

    def finish_hand(self):
        """
        Finish the current hand, determine winners and distribute the pot.
        Also schedules the next hand.
        """
        try:
            self.cancel_all_timers()
            self.hand_complete = True
            winners = []
            winning_hands = []
            winning_hand_descriptions = []
            
            # Add player bets to the pot at the end of the hand
            self.pot += self.get_total_bets()
            print(f"Final pot after adding player bets: {self.pot}")
            
            # Check if only one player is left active (everyone else folded)
            if len(self.active_players) == 1:
                # Last player standing wins
                winner_idx = self.active_players[0]
                self.players[winner_idx]["chips"] += self.pot
                self.hand_winners = [winner_idx]
                
                # Record action
                self.action_history.append({
                    "round": self.betting_round,
                    "player": winner_idx,
                    "action": "win",
                    "amount": self.pot,
                    "reason": "all_folded",
                    "timestamp": time.time()
                })
                
                print(f"Player {self.players[winner_idx]['name']} wins {self.pot} chips (all others folded)")
                
                # 保存游戏历史记录
                self.save_game_history()
                
                # Schedule the next hand
                self.schedule_next_hand()
                return
            
            # If we reached showdown, deal any remaining community cards
            if len(self.community_cards) < 5:
                # Check if flop hasn't been dealt yet
                if len(self.community_cards) == 0:
                    print("Dealing flop at showdown")
                    self.deal_flop()  # Deal 3 cards
                    
                # Check if turn hasn't been dealt yet
                if len(self.community_cards) == 3:
                    print("Dealing turn at showdown")
                    self.deal_turn()  # Deal 1 more card
                    
                # Check if river hasn't been dealt yet
                if len(self.community_cards) == 4:
                    print("Dealing river at showdown")
                    self.deal_river()  # Deal final card
                
                print(f"Community cards at showdown (total: {len(self.community_cards)}): {self.community_cards}")
            
            # Evaluate each active player's hand
            best_player_idx = None
            best_hand_result = None
            
            for player_idx in self.active_players:
                player = self.players[player_idx]
                # Combine player's hole cards with community cards
                cards = player["hand"] + self.community_cards
                
                # Evaluate the hand
                hand_result = self.hand_evaluator.evaluate_hand(cards, self.community_cards)
                
                # First player sets the initial best hand
                if best_player_idx is None:
                    best_player_idx = player_idx
                    best_hand_result = hand_result
                    winners = [player_idx]
                    winning_hands = [hand_result[0]]
                    winning_hand_descriptions = [hand_result[3]]
                else:
                    # Compare with current best hand
                    # Extract cards for comparison
                    current_cards = player["hand"]
                    best_cards = self.players[best_player_idx]["hand"]
                    
                    # Use compare_hands to determine which hand is better
                    comparison = self.hand_evaluator.compare_hands(current_cards, best_cards, self.community_cards)
                    
                    if comparison > 0:  # Current hand is better
                        best_player_idx = player_idx
                        best_hand_result = hand_result
                        winners = [player_idx]
                        winning_hands = [hand_result[0]]
                        winning_hand_descriptions = [hand_result[3]]
                    elif comparison == 0:  # Tie
                        winners.append(player_idx)
                        winning_hands.append(hand_result[0])
                        winning_hand_descriptions.append(hand_result[3])
            
            # Calculate the chips each winner receives
            winning_amount = self.pot // len(winners)
            remainder = self.pot % len(winners)
            
            # Distribute the pot among winners
            for i, winner_idx in enumerate(winners):
                # Give an extra chip to early winners if there's a remainder
                extra = 1 if i < remainder else 0
                amount = winning_amount + extra
                
                # Update player's chips
                self.players[winner_idx]["chips"] += amount
                
                # Record action
                self.action_history.append({
                    "round": self.betting_round,
                    "player": winner_idx,
                    "action": "win",
                    "amount": amount,
                    "hand": winning_hand_descriptions[i],
                    "timestamp": time.time()
                })
                
                print(f"Player {self.players[winner_idx]['name']} wins {amount} chips with {winning_hand_descriptions[i]}")
            
            # Update hand_winners for game state tracking
            self.hand_winners = winners
            
            # 保存游戏历史记录
            self.save_game_history()
            
            self.schedule_next_hand()
            
        except Exception as e:
            print(f"Error in Game.finish_hand: {str(e)}")
            traceback.print_exc()
            
    def find_next_player_with_chips(self, start_idx):
        """Find the next player with chips, starting from the given index"""
        if not self.active_players:
            return -1
            
        # 如果start_idx不在active_players中，使用第一个活跃玩家
        if start_idx not in self.active_players:
            print(f"警告: 起始位置 {start_idx} 不在活跃玩家列表中，使用第一个活跃玩家")
            if self.active_players:
                return self.active_players[0]
            return -1
            
        # 找到起始位置在列表中的索引    
        start_index = self.active_players.index(start_idx)
        
        # 从下一个位置开始搜索有筹码的玩家
        for i in range(1, len(self.active_players) + 1):
            next_idx = (start_index + i) % len(self.active_players)
            position = self.active_players[next_idx]
            if self.players[position]["chips"] > 0:
                return position
                
        # 如果循环一圈没找到有筹码的玩家，检查起始玩家
        if self.players[start_idx]["chips"] > 0:
            return start_idx
            
        # 没有玩家有筹码
        return -1

    def create_deck(self):
        """Create a new deck of cards"""
        ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
        suits = ['H', 'D', 'C', 'S']  # Using single-letter codes instead of full names
        
        deck = []
        for suit in suits:
            for rank in ranks:
                card = {
                    'rank': rank,
                    'suit': suit,
                    'display': f"{rank}{suit}"  # Display is now simply rank+suit
                }
                deck.append(card)
                
        import random
        random.shuffle(deck)
        return deck
        
    def get_suit_symbol(self, suit):
        """Get suit letter code"""
        # This is now a simple mapping function
        suit_map = {
            'HEARTS': 'H',
            'DIAMONDS': 'D',
            'CLUBS': 'C',
            'SPADES': 'S',
            # For backward compatibility
            '♥': 'H',
            '♦': 'D',
            '♣': 'C',
            '♠': 'S'
        }
        return suit_map.get(suit, suit)

    def record_action(self, player_idx, action, amount=0):
        """记录玩家动作到历史记录"""
        if not hasattr(self, "action_history"):
            self.action_history = []
        
        # 获取当前游戏阶段
        phase_names = ["PRE_FLOP", "FLOP", "TURN", "RIVER"]
        current_phase = phase_names[self.betting_round] if self.betting_round < len(phase_names) else "SHOWDOWN"
        
        # 记录动作
        action_record = {
            "round": self.hand_number if hasattr(self, "hand_number") else 1,
            "phase": current_phase,
            "player_idx": player_idx,
            "action": action,
            "amount": amount,
            "timestamp": datetime.datetime.now().isoformat()
        }
        
        self.action_history.append(action_record)

    def get_game_phase(self):
        """获取游戏阶段"""
        phases = ["PRE_FLOP", "FLOP", "TURN", "RIVER", "SHOWDOWN"]
        if not hasattr(self, 'betting_round'):
            return "PRE_FLOP"
        
        # 根据betting_round返回相应阶段
        if 0 <= self.betting_round < 4:
            return phases[self.betting_round]
        elif self.betting_round >= 4:
            return "SHOWDOWN"
        else:
            return "PRE_FLOP"  # 默认值

    def is_player_active(self, username):
        """
        Check if a player is active in the current game
        
        Args:
            username (str): The player's username
            
        Returns:
            bool: True if player is active in the game, False otherwise
        """
        try:
            # 查找玩家的位置
            player_position = None
            for position, player in self.players.items():
                if player.get('name') == username:
                    player_position = position
                    break
                    
            # 检查玩家是否存在且在活跃玩家列表中
            if player_position is not None and player_position in self.active_players:
                return True
                
            return False
        except Exception as e:
            print(f"Error in is_player_active: {str(e)}")
            return False

    def get_player_hand(self, player_id):
        """获取指定玩家的手牌和弃牌信息
        
        Args:
            player_id (str): 玩家ID或用户名
            
        Returns:
            tuple: (player_hand, discarded_card)，如果玩家不存在则返回(None, None)
                - player_hand (list): 玩家手牌列表
                - discarded_card (dict): 玩家弃掉的牌
        """
        try:
            # 在玩家字典中查找匹配ID或名称的玩家
            for position, player in self.players.items():
                if player.get('name') == player_id:
                    print(f"找到玩家 {player_id} 的信息:")
                    hand = player.get('hand', [])
                    discarded = player.get('discarded_card', None)
                    hand_str = [card['display'] for card in hand] if hand else []
                    print(f"- 手牌: {hand_str}")
                    print(f"- 弃牌: {discarded['display'] if discarded else None}")
                    return hand, discarded
            
            # 如果未找到玩家，记录并返回None
            print(f"Player {player_id} not found in game")
            return None, None
        except Exception as e:
            print(f"Error in get_player_hand: {str(e)}")
            traceback.print_exc()
            return None, None

    def get_total_bets(self):
        """计算所有玩家的当前下注总额"""
        total = 0
        for position, player in self.players.items():
            total += player.get('bet_amount', 0)
        return total
        
    def reset_all_bets(self):
        """重置所有玩家的当前下注"""
        for position, player in self.players.items():
            self.players[position]['bet_amount'] = 0

    def handle_discard(self, player_idx, discard_index):
        """
        处理弃牌操作 - 该操作可以在任何时候执行，不需要是当前玩家的回合
        
        Args:
            player_idx: 执行弃牌的玩家索引
            discard_index: 要弃掉的牌的索引
            
        Returns:
            dict: 包含操作结果的字典
        """
        try:
            # 确保玩家在游戏中
            if player_idx not in self.players:
                print(f"玩家 {player_idx} 不在玩家列表中")
                return {"success": False, "message": "玩家不在游戏中"}
            
            # 获取玩家信息
            player = self.players[player_idx]
            player_name = player["name"]
            
            # 检查是否已经弃牌
            if player.get("has_discarded", False):
                print(f"玩家 {player_name} 已经弃过牌")
                return {"success": False, "message": "玩家已经弃过牌"}
            
            # 检查弃牌索引是否有效
            try:
                discard_index = int(discard_index)
            except (TypeError, ValueError):
                print(f"无效的弃牌索引: {discard_index}")
                return {"success": False, "message": "无效的弃牌索引"}
            
            # 检查手牌
            hand = player.get("hand", [])
            if not hand:
                print(f"玩家 {player_name} 没有手牌")
                return {"success": False, "message": "玩家没有手牌"}
            
            # 检查索引是否在有效范围内
            if discard_index < 0 or discard_index >= len(hand):
                print(f"弃牌索引超出范围: {discard_index}, 玩家手牌: {len(hand)}张")
                return {"success": False, "message": f"弃牌索引超出范围: {discard_index}"}
            
            # 移除选中的牌
            discarded_card = hand.pop(discard_index)
            player["discarded_card"] = discarded_card
            player["has_discarded"] = True
            
            print(f"玩家 {player_name} 弃掉了第 {discard_index} 张牌: {discarded_card}")
            
            # 记录动作到历史记录
            self.action_history.append({
                "round": self.betting_round,
                "player_idx": player_idx,
                "player": player_name,
                "action": "discard",
                "discard_index": discard_index,
                "timestamp": time.time()
            })
            
            # 注意：不移动到下一个玩家，弃牌操作不影响游戏流程
            return {"success": True, "message": "成功弃牌", "discarded_card": discarded_card}
            
        except Exception as e:
            print(f"处理弃牌操作时发生错误: {str(e)}")
            import traceback
            traceback.print_exc()
            return {"success": False, "message": f"处理弃牌操作时发生错误: {str(e)}"}

    def save_game_history(self):
        """将当前游戏的action_history保存到game_history中
        
        在一局游戏结束时调用此方法，将当前游戏的历史记录添加到历史记录列表中
        """
        try:
            if not self.action_history:
                print("没有行动历史记录可保存")
                return False
                
            # 创建一个包含游戏关键信息的游戏记录
            game_record = {
                "game_id": self.handid,  # 使用游戏的handid作为唯一标识
                "start_time": None,  # 将通过寻找最早的动作时间设置
                "end_time": time.time(),  # 当前时间作为结束时间
                "actions": [],  # 将包含所有动作的副本
                "players": [],  # 参与游戏的玩家信息
                "winners": [],  # 赢家信息
                "pot": self.pot,  # 底池大小
                "community_cards": self.community_cards,  # 公共牌
                "small_blind": self.small_blind,
                "big_blind": self.big_blind
            }
            
            # 添加玩家信息
            for position, player in self.players.items():
                if isinstance(player, dict):
                    player_record = {
                        "name": player.get("name", ""),
                        "position": position,
                        "chips_start": player.get("initial_chips", 0),
                        "chips_end": player.get("chips", 0)
                    }
                    game_record["players"].append(player_record)
            
            # 添加赢家信息
            if hasattr(self, 'hand_winners') and self.hand_winners:
                # 从action_history中找出win类型的动作，获取获胜金额
                winners_amounts = {}
                for action in self.action_history:
                    if action.get('action') in ['win', 'win_by_default'] and 'amount' in action:
                        player_id = action.get('player_idx', action.get('player'))
                        if player_id is not None:
                            winners_amounts[player_id] = action.get('amount', 0)
                
                for winner_idx in self.hand_winners:
                    winner_info = self.players.get(winner_idx, {})
                    winner_name = ""
                    if isinstance(winner_info, dict):
                        winner_name = winner_info.get("name", f"玩家{winner_idx}")
                    
                    # 获取获胜金额，如果找不到则为0
                    amount = winners_amounts.get(winner_idx, 0)
                    
                    game_record["winners"].append({
                        "name": winner_name,
                        "position": winner_idx,
                        "amount": amount  # 添加获胜金额
                    })
            
            # 复制并处理行动历史记录
            for entry in self.action_history:
                # 复制条目，避免修改原始数据
                formatted_entry = entry.copy()
                
                # 寻找最早的时间戳作为游戏开始时间
                if 'timestamp' in entry and (game_record["start_time"] is None or entry['timestamp'] < game_record["start_time"]):
                    game_record["start_time"] = entry['timestamp']
                
                # 添加玩家名称
                if 'player_idx' in entry:
                    player_idx = entry['player_idx']
                    player_info = self.players.get(player_idx, {})
                    if isinstance(player_info, dict):
                        formatted_entry['player_name'] = player_info.get('name', f"玩家{player_idx}")
                    else:
                        formatted_entry['player_name'] = f"玩家{player_idx}"
                
                game_record["actions"].append(formatted_entry)
            
            # 将游戏记录添加到历史列表中
            self.game_history.append(game_record)
            
            print(f"已保存游戏历史记录，总共有 {len(self.game_history)} 局游戏历史")
            return True
        except Exception as e:
            import traceback
            print(f"保存游戏历史记录时出错: {str(e)}")
            traceback.print_exc()
            return False

    def get_game_history(self):
        """获取游戏历史记录
        
        Returns:
            dict: 包含当前游戏和历史游戏的历史记录
        """
        try:
            print(f"获取游戏历史记录，包含当前游戏和 {len(self.game_history)} 局历史游戏")
            
            return self.game_history
        except Exception as e:
            import traceback
            print(f"获取游戏历史记录错误: {str(e)}")
            traceback.print_exc()
            return []

async def timer_update_task():
    # 在函数内部导入以避免循环导入
    from src.managers.room_manager import get_instance
    room_manager = get_instance()
    
    last_states = {}  # 存储每个房间的上一次状态信息
    last_update_time = {}  # 存储每个房间上次更新时间
    update_count = 0  # 计数器，用于定期输出统计信息
    
    print(f"[DEBUG] Timer update task started at {datetime.datetime.now()}")
    
    while True:
        try:
            current_time = time.time()
            rooms = room_manager.get_all_rooms()
            active_rooms = {rid: room for rid, room in rooms.items() if room.status != "closed"}
            
            update_count += 1
            
            for room_id, room in active_rooms.items():
                if room.game and room.status == "playing":
                    # 获取当前状态的关键信息
                    current_state = {
                        'game_phase': room.game.get_game_phase(),
                        'current_player': room.game.current_player_idx,
                        'pot': room.game.pot,
                        'community_cards': len(room.game.community_cards),
                        'betting_round': room.game.betting_round,
                        'time_remaining': room.game.get_turn_time_remaining()  # 仍然获取但不用于决定是否更新
                    }
                    
                    # 检查是否需要更新:
                    # 1. 首次获取该房间状态
                    # 2. 关键游戏状态发生变化
                    is_first_update = room_id not in last_states
                    
                    # 如果有上一次状态，检查关键变化
                    state_changed = False
                    change_reason = None
                    
                    if not is_first_update:
                        prev_state = last_states[room_id]
                        
                        # 检查各项状态是否变化并记录原因 - 不包括time_remaining
                        if current_state['game_phase'] != prev_state['game_phase']:
                            state_changed = True
                            change_reason = f"Game phase changed: {prev_state['game_phase']} -> {current_state['game_phase']}"
                        elif current_state['current_player'] != prev_state['current_player']:
                            state_changed = True
                            change_reason = f"Current player changed: {prev_state['current_player']} -> {current_state['current_player']}"
                        elif current_state['pot'] != prev_state['pot']:
                            state_changed = True
                            change_reason = f"Pot changed: {prev_state['pot']} -> {current_state['pot']}"
                        elif current_state['community_cards'] != prev_state['community_cards']:
                            state_changed = True
                            change_reason = f"Community cards changed: {prev_state['community_cards']} -> {current_state['community_cards']}"
                        elif current_state['betting_round'] != prev_state['betting_round']:
                            state_changed = True
                            change_reason = f"Betting round changed: {prev_state['betting_round']} -> {current_state['betting_round']}"
                        
                        # 不再根据时间变化决定是否发送更新
                    else:
                        change_reason = "First update for this room"
                    
                    # 决定是否需要发送更新 - 只在首次或状态变化时发送
                    should_update = is_first_update or state_changed
                    
                    # 记录更详细的调试信息
                    if update_count % 10 == 0:  # 限制日志输出频率
                        elapsed_since_last = current_time - last_update_time.get(room_id, 0)
                        if change_reason:
                            print(f"[DEBUG] Room {room_id}: Change reason: {change_reason}")
                    
                    if should_update:
                        # 获取完整的游戏状态
                        game_state = room.get_state()
                        
                        # print(f"[BROADCAST][game_update] Room {room_id}: Sending update. Reason: {change_reason}")
                        
                        # 发送游戏状态更新
                        await ws_manager.broadcast_to_room(room_id, {
                            "type": "game_update",
                            "data": {
                                "action": "timer_update",
                                "player": "system",
                                "amount": 0,
                                "result": {"success": True, "message": "Timer update"},
                                "game_state": game_state,
                                "is_key_update": state_changed,
                                "timestamp": current_time,
                                "update_reason": change_reason  # 添加更新原因到发送的数据中
                            }
                        })
                        
                        # 更新玩家手牌信息
                        for player_id in room.players:
                            if ws_manager.is_client_connected(player_id):
                                player_hand = room.game.get_player_hand(player_id)
                                await ws_manager.send_player_specific_state(
                                    player_id, player_hand
                                )
                        
                        # 更新最后状态和时间
                        last_states[room_id] = current_state
                        last_update_time[room_id] = current_time
            
        except Exception as e:
            print(f"[ERROR] Error in timer update task: {e}")
            traceback.print_exc()
        
        # 检查频率仍然保持在每1-2秒一次，但实际更新会根据状态变化决定
        await asyncio.sleep(1)