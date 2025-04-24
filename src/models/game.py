import random
import uuid
import time
import threading
from src.models.deck import Deck
from src.models.player import Player
from src.utils.hand_evaluator import HandEvaluator
import datetime
import logging
import asyncio
import traceback

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

class Game:
    def __init__(self, players_info, small_blind=None, big_blind=None, player_turn_time=30):
        """初始化游戏对象，但不开始游戏"""
        try:
            print(f"Initializing Game with players_info: {players_info}")
            
            # 初始化游戏参数
            self.small_blind = small_blind if small_blind is not None else 0.5
            self.big_blind = big_blind if big_blind is not None else 1
            self.player_turn_time = player_turn_time
            
            # 初始化数据结构
            self.players = {}
            for player_info in players_info:
                position = player_info["position"]
                self.players[position] = player_info
            
            self.active_players = [p["position"] for p in players_info] # sorted?
            self.pot = 0
            self.current_bet = 0
            self.community_cards = []
            self.betting_round = 0
            self.dealer_idx = random.choice(self.active_players)
            self.current_player_idx = self.dealer_idx
            self.last_player_to_raise = None
            self.player_acted = [False] * len(players_info)
            
            # 初始化评估器和历史记录
            self.hand_evaluator = HandEvaluator()
            self.action_history = []
            
            # 初始化弃牌跟踪
            self.discarded_cards = [None] * len(self.active_players)
            self.has_discarded = [False] * len(self.active_players)
            
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
        
        # Deal three cards to each player
        for position in self.active_players:
            card1 = self.deck.deal()
            card2 = self.deck.deal()
            card3 = self.deck.deal()
            print(f"Dealt cards to player position {position}: {card1}, {card2}, {card3}")
            self.players[position]["hand"] = [
                card1.to_dict(),
                card2.to_dict(),
                card3.to_dict()
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
            self.player_acted = [False] * len(self.players)
            
            # 初始化弃牌追踪数组，使用active_players的长度
            self.discarded_cards = [None] * len(self.active_players)
            self.has_discarded = [False] * len(self.active_players)
            
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
                
                # 强制启动计时器
                self.turn_start_time = time.time()
                print(f"强制设置计时器启动时间: {self.turn_start_time}")
                
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
        # 确保是当前玩家的回合
        if self.current_player_idx not in self.active_players:
            print("当前没有活跃玩家")
            return False
        
        # 确保玩家仍在游戏中
        if self.current_player_idx not in self.active_players:
            print(f"玩家 {self.current_player_idx} 不在活跃玩家列表中")
            return False
        
        # 检查玩家是否已经行动过
        if self.player_acted[self.current_player_idx]:
            print(f"玩家 {self.current_player_idx} 已经行动过")
            return False
    
        print(f"处理玩家 {self.current_player_idx} 动作: {action}, 金额: {amount}")
    
        # 获取当前玩家
        current_player = self.players[self.current_player_idx]
    
        # 处理不同类型的动作
        if action == "discard":
            # 弃牌操作 - discard_index存储在amount参数中
            discard_index = int(amount)
            
            # 确保索引有效和初始化arrays
            if not hasattr(self, 'has_discarded') or not isinstance(self.has_discarded, list):
                print(f"Setting up has_discarded arrays in handle_action")
                self.has_discarded = [False] * len(self.players)
                self.discarded_cards = [None] * len(self.players)
                
            # 检查是否已经弃牌
            if self.has_discarded[self.current_player_idx]:
                print(f"玩家 {current_player['name']} 已经弃过牌")
                return False
                
            # 检查选择的牌是否有效
            hand = current_player.get("hand", [])
            if discard_index < 0 or discard_index >= len(hand):
                print(f"无效的弃牌索引: {discard_index}, 玩家手牌: {len(hand)}张")
                return False
                
            # 移除选中的牌
            discarded_card = hand.pop(discard_index)
            self.discarded_cards[self.current_player_idx] = discarded_card
            self.has_discarded[self.current_player_idx] = True
            
            print(f"玩家 {current_player['name']} 弃掉了第 {discard_index} 张牌: {discarded_card}")
            
            # 记录动作
            self.record_action(self.current_player_idx, "discard", discard_index)
            
            # 标记玩家已执行弃牌动作，但不改变其他行动状态
            # 不设置player_acted为True，这样玩家仍需进行其他操作（如下注等）
            
            # 注意：不移动到下一个玩家，因为当前玩家需要继续执行其他动作
            return True
        
        elif action == "fold":
            # 弃牌操作
            self.active_players.remove(self.current_player_idx)
            self.player_acted[self.current_player_idx] = True
            print(f"玩家 {current_player['name']} 选择弃牌")
            
            # 记录动作
            self.record_action(self.current_player_idx, "fold")
            
            # 检查是否只剩一个玩家
            if len(self.active_players) == 1:
                self.end_hand()
                return True
        
        elif action == "check":
            # 让牌操作，只有在没有人下注时才能让牌
            if self.current_bet > 0 and current_player["bet_amount"] < self.current_bet:
                print(f"当前有玩家已下注 {self.current_bet}，不能让牌")
                return False
            
            self.player_acted[self.current_player_idx] = True
            print(f"玩家 {current_player['name']} 选择check")
            
            # 记录动作
            self.record_action(self.current_player_idx, "check")
            
        elif action == "call":
            # 跟注操作
            call_amount = self.current_bet - current_player["bet_amount"]
            
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
            print(f"玩家 {current_player['name']} 跟注 {call_amount}")
            
            # 记录动作
            self.record_action(self.current_player_idx, "call", call_amount)
            
        elif action == "raise":
            # 加注操作
            if amount <= self.current_bet:
                print(f"加注金额 {amount} 必须大于当前最大下注 {self.current_bet}")
                return False
            
            if amount > current_player["chips"] + current_player["bet_amount"]:
                print(f"玩家筹码不足，最多能下注 {current_player['chips'] + current_player['bet_amount']}")
                return False
            
            # 计算实际加注金额
            actual_amount = amount - current_player["bet_amount"]
            
            # 更新玩家筹码和下注金额
            current_player["chips"] -= actual_amount
            current_player["bet_amount"] = amount
            self.current_bet = amount
            
            # 重置其他玩家的行动状态
            for i in range(len(self.player_acted)):
                if i != self.current_player_idx and i in self.active_players:
                    self.player_acted[i] = False
                    
            self.player_acted[self.current_player_idx] = True
            print(f"玩家 {current_player['name']} 加注到 {amount}")
            
            # 记录动作
            self.record_action(self.current_player_idx, "raise", amount)
        
        elif action == "all-in":
            # 全下操作
            all_in_amount = current_player["chips"] + current_player["bet_amount"]
            
            # 更新下注金额
            current_player["chips"] = 0
            all_in_increase = all_in_amount - current_player["bet_amount"]
            current_player["bet_amount"] = all_in_amount
            
            if all_in_amount > self.current_bet:
                self.current_bet = all_in_amount
                # 重置其他玩家的行动状态
                for i in range(len(self.player_acted)):
                    if i != self.current_player_idx and i in self.active_players:
                        self.player_acted[i] = False
            
            self.player_acted[self.current_player_idx] = True
            print(f"玩家 {current_player['name']} 全下 {all_in_amount}")
            
            # 记录动作
            self.record_action(self.current_player_idx, "all-in", all_in_amount)
        
        # 动作处理完后，移动到下一个玩家
        self.advance_player()
        
        return True

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
            score = self.hand_evaluator.evaluate_hand(cards)
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
        """Deal the flop - 3 community cards"""
        print("Dealing the flop...")
        # Clear any existing community cards
        self.community_cards = []
        
        # Burn a card
        burned = self.deck.draw()
        print(f"Burned card: {burned}")
        
        # Deal three cards for the flop
        for i in range(3):
            card = self.deck.draw()
            self.community_cards.append(card.to_dict())
            print(f"Flop card {i+1}: {card}")
        
        print(f"Community cards after flop: {len(self.community_cards)} cards - {self.community_cards}")
            
    def deal_turn(self):
        """Deal the turn - 1 more community card"""
        print("Dealing the turn...")
        # Burn a card
        burned = self.deck.draw()
        print(f"Burned card: {burned}")
        
        # Deal one card for the turn
        turn_card = self.deck.draw()
        print(f"Turn card: {turn_card}")
        self.community_cards.append(turn_card.to_dict())
        print(f"Community cards after turn: {len(self.community_cards)} cards - {self.community_cards}")
        
    def deal_river(self):
        """Deal the river - 1 final community card"""
        print("Dealing the river...")
        # Burn a card
        burned = self.deck.draw()
        print(f"Burned card: {burned}")
        
        # Deal one card for the river
        river_card = self.deck.draw()
        print(f"River card: {river_card}")
        self.community_cards.append(river_card.to_dict())
        print(f"Community cards after river: {len(self.community_cards)} cards - {self.community_cards}")
        
    def advance_player(self):
        try:
            # 如果没有活跃玩家，返回
            if not self.active_players:
                print("没有玩家可以行动")
                return
                
            # 找到当前玩家在活跃玩家列表中的索引
            current_idx = self.active_players.index(self.current_player_idx)
            # 找到下一个活跃玩家
            next_idx = (current_idx + 1) % len(self.active_players)
            
            # 直接从活跃玩家列表中获取下一个玩家位置
            self.current_player_idx = self.active_players[next_idx]
            
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
        for player_idx in self.active_players:
            if not self.player_acted[player_idx]:
                return False
        return True
        
    def advance_betting_round(self):
        """
        进入下一个下注轮，将当前下注轮的筹码移入底池，并根据轮次发牌
        """
        print(f"进入下一轮，当前轮： {self.betting_round}")
        
        # 将所有玩家的当前下注加到底池
        self.pot += self.get_total_bets()
        for position in self.players:
            self.players[position]['bet_amount'] = 0
            
        # 重置当前最高下注额
        self.current_bet = 0
            
        # 重置玩家是否行动过
        self.player_acted = [False] * len(self.players)
            
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
                
            # 设置当前行动的玩家为庄家位后的第一个活跃玩家
            # 使用advance_player方法而不是不存在的方法
            self.advance_player()
            
            # 启动当前玩家的行动计时器
            self.start_turn_timer()
                
            # 打印当前状态
            print(f"进入{self.betting_round}轮, 当前玩家索引: {self.current_player_idx}, 底池: {self.pot}")
            print(f"公共牌: {[str(card) for card in self.community_cards]}")
            
        except Exception as e:
            print(f"Advance betting round error: {e}")
            traceback.print_exc()

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
                    self.community_cards.append(card)
                    print(f"发放公共牌: {card}")
                else:
                    print("牌组已空，无法发放更多公共牌")
        except Exception as e:
            print(f"Deal flop error: {e}")
            
    def deal_turn(self):
        """发放转牌圈一张公共牌"""
        try:
            # 烧牌
            if len(self.deck.cards) > 0:
                self.deck.deal()
                
            # 发一张转牌
            if len(self.deck.cards) > 0:
                card = self.deck.deal()
                self.community_cards.append(card)
                print(f"发放转牌: {card}")
            else:
                print("牌组已空，无法发放转牌")
        except Exception as e:
            print(f"Deal turn error: {e}")
            
    def deal_river(self):
        """发放河牌圈一张公共牌"""
        try:
            # 烧牌
            if len(self.deck.cards) > 0:
                self.deck.deal()
                
            # 发一张河牌
            if len(self.deck.cards) > 0:
                card = self.deck.deal()
                self.community_cards.append(card)
                print(f"发放河牌: {card}")
            else:
                print("牌组已空，无法发放河牌")
        except Exception as e:
            print(f"Deal river error: {e}")

    def get_state(self):
        """获取游戏状态"""
        try:
            # 创建游戏状态字典
            state = {
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
                
            # 创建玩家位置到索引的映射，用于查找discarded_cards和has_discarded
            position_to_index = {}
            for i, position in enumerate(self.active_players):
                position_to_index[position] = i
            
            # 为每个玩家创建状态信息
            for position, player in self.players.items():
                # 基本信息
                player_state = {
                    "name": player.get("name", f"Player {position}"),
                    "chips": player.get("chips", 0),
                    "position": position,
                    "seat": position,  # 确保返回seat信息
                    "has_cards": bool(player.get("hand", [])),
                    "is_active": position in self.active_players,
                    "bet_amount": player.get("bet_amount", 0),
                    "folded": position not in self.active_players,
                    "is_current_player": position == self.current_player_idx,
                    "total_buy_in": player.get("total_buy_in", player.get("chips", 0)),  # 添加总买入字段
                }
                
                # 玩家移除的牌
                player_index = position_to_index.get(position, -1)
                if player_index >= 0 and self.discarded_cards and len(self.discarded_cards) > player_index and self.discarded_cards[player_index]:
                    player_state["discarded_card"] = self.discarded_cards[player_index]
                    player_state["has_discarded"] = True
                else:
                    player_state["has_discarded"] = bool(self.has_discarded and len(self.has_discarded) > player_index and player_index >= 0 and self.has_discarded[player_index])
                
                # 仅在showdown时添加手牌信息
                if self.betting_round >= 4 or self.hand_complete:
                    if player.get("hand"):
                        player_state["hand"] = player.get("hand", [])
                
                state["players"].append(player_state)
            
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
            
        # 记录当前时间作为计时器开始时间
        self.turn_start_time = time.time()
        
        # 创建超时处理计时器
        self.turn_timer = threading.Timer(self.player_turn_time, self.handle_timeout)
        self.turn_timer.daemon = True
        self.turn_timer.start()
        
    def handle_timeout(self):
        """Handle case when player's turn timer expires"""
        player_idx = self.current_player_idx
        if player_idx in self.active_players:
            # 找到玩家在active_players中的索引
            player_index_in_active = self.active_players.index(player_idx)
            
            # Check if player needs to discard first
            if len(self.players[player_idx]["hand"]) == 3:
                # 检查discarded_cards和has_discarded的长度是否足够
                if len(self.has_discarded) <= player_index_in_active:
                    # 扩展数组以适应更大的索引
                    self.has_discarded.extend([False] * (player_index_in_active + 1 - len(self.has_discarded)))
                    
                if len(self.discarded_cards) <= player_index_in_active:
                    self.discarded_cards.extend([None] * (player_index_in_active + 1 - len(self.discarded_cards)))
                
                if not self.has_discarded[player_index_in_active]:
                    # Randomly discard a card
                    discard_index = random.randint(0, 2)
                    self.process_action(player_idx, "discard", 0, discard_index)
                    
                    # Add timeout to action history
                    self.action_history.append({
                        "round": self.betting_round,
                        "player_idx": player_idx,
                        "action": "timeout_discard",
                        "discard_index": discard_index,
                        "timestamp": time.time()
                    })
                    return
            
            # Default action is to fold if bet is required, check if possible
            if self.current_bet > self.players[player_idx]["bet_amount"]:
                # Player needs to call/raise, but timer expired - fold
                self.process_action(player_idx, "fold", 0)
            else:
                # Player can check
                self.process_action(player_idx, "check", 0)
            
            # Add timeout to action history
            self.action_history.append({
                "round": self.betting_round,
                "player_idx": player_idx,
                "action": "timeout",
                "timestamp": time.time()
            })
    
    def cancel_turn_timer(self):
        """Cancel the current turn timer"""
        if hasattr(self, 'turn_timer') and self.turn_timer:
            self.turn_timer.cancel()
            self.turn_timer = None
            
        # 清除计时器开始时间
        self.turn_start_time = None
            
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
        
        # 重置每个玩家的下注金额
        for position in self.players:
            self.players[position]['bet_amount'] = 0
        
        # Check for active players with chips
        self.active_players = [position for position, player in self.players.items() if player["chips"] > 0]
        
        if len(self.active_players) <= 1:
            print("Game over: only one player with chips remaining")
            return
        
        # Move dealer button
        self.dealer_idx = (self.dealer_idx + 1) % len(self.players)
        while self.dealer_idx not in self.active_players:
            self.dealer_idx = (self.dealer_idx + 1) % len(self.players)
            
        # 调用start_round方法来处理发牌、盲注和玩家设置
        self.start_round()
        
    def process_action(self, player_idx, action, amount=0, discard_index=None):
        """Process a player action (check, call, bet, raise, fold)"""
        try:
            # 允许弃牌操作跳过当前玩家回合检查
            if action != "discard" and (player_idx not in self.active_players or player_idx != self.current_player_idx):
                print(f"Invalid player index {player_idx}, current player is {self.current_player_idx}")
                return False

            # Initialize has_discarded and discarded_cards if not already
            if not hasattr(self, 'has_discarded') or not isinstance(self.has_discarded, list):
                print(f"Initializing has_discarded and discarded_cards arrays")
                self.has_discarded = [False] * len(self.players)
                self.discarded_cards = [None] * len(self.players)

            # 获取玩家在active_players中的索引
            if player_idx in self.active_players:
                player_index_in_active = self.active_players.index(player_idx)
            else:
                print(f"Player {player_idx} is not in active players list")
                return False

            # Check if player needs to discard first
            if len(self.players[player_idx]["hand"]) == 3:
                # 确保has_discarded列表长度足够
                if len(self.has_discarded) <= player_index_in_active:
                    # 扩展数组以适应更大的索引
                    self.has_discarded.extend([False] * (player_index_in_active + 1 - len(self.has_discarded)))
                
                if not self.has_discarded[player_index_in_active] and action != "discard":
                    print(f"Player must discard a card first")
                    return False

            # Cancel the current turn timer since player has acted
            if action != "discard":
                self.cancel_turn_timer()
            
            amount = int(amount) if amount else 0
            player_name = self.players[player_idx]["name"]
            
            # Handle discard action
            if action == "discard":
                # 确保索引有效
                if not hasattr(self, 'has_discarded') or not isinstance(self.has_discarded, list):
                    print(f"Setting up has_discarded array")
                    self.has_discarded = [False] * len(self.active_players)
                    self.discarded_cards = [None] * len(self.active_players)
                    
                # 确保数组长度足够
                if len(self.has_discarded) <= player_index_in_active:
                    self.has_discarded.extend([False] * (player_index_in_active + 1 - len(self.has_discarded)))
                
                if len(self.discarded_cards) <= player_index_in_active:
                    self.discarded_cards.extend([None] * (player_index_in_active + 1 - len(self.discarded_cards)))
                    
                # 检查是否已经弃牌    
                if self.has_discarded[player_index_in_active]:
                    print(f"Player has already discarded a card")
                    return False
                
                if discard_index is None or not isinstance(discard_index, int):
                    print(f"Invalid discard index: {discard_index}")
                    return False
                    
                if discard_index < 0 or discard_index >= len(self.players[player_idx]["hand"]):
                    print(f"Discard index out of range: {discard_index}")
                    return False
                    
                # Remove the card at the specified index but save it for visibility
                hand = self.players[player_idx]["hand"]
                discarded_card = hand.pop(discard_index)
                self.discarded_cards[player_index_in_active] = discarded_card
                self.has_discarded[player_index_in_active] = True
                
                player_name = self.players[player_idx]["name"]
                print(f"Player {player_name} discarded card at index {discard_index}: {discarded_card}")
                
                # Record action in history
                self.action_history.append({
                    "round": self.betting_round,
                    "player_idx": player_idx,
                    "player": player_name,
                    "action": "discard",
                    "discard_index": discard_index,
                    "timestamp": time.time()
                })
                
                # 标记玩家已执行弃牌动作，但不改变其他行动状态
                # 不设置player_acted为True，这样玩家仍需进行其他操作（如下注等）
                
                # 注意：不移动到下一个玩家，因为当前玩家需要继续执行其他动作
                return True
            
            # Record action in history with timestamp
            self.action_history.append({
                "round": self.betting_round,
                "player_idx": player_idx,
                "player": player_name,
                "action": action,
                "amount": amount,
                "timestamp": time.time()
            })
            
            if action == "fold":
                # Player folds
                self.active_players.remove(player_idx)
                print(f"Player {player_name} folds")
                
                # If only one player remains active, they win the pot
                if len(self.active_players) == 1:
                    self.finish_hand()
                    return True
                    
            elif action == "check":
                # Player checks (no additional betting)
                if self.current_bet > self.players[player_idx]["bet_amount"]:
                    print(f"Invalid check, current bet is {self.current_bet}, player bet is {self.players[player_idx]['bet_amount']}")
                    return False
                print(f"Player {player_name} checks")
                
            elif action == "call":
                # Player calls the current bet
                call_amount = self.current_bet - self.players[player_idx]["bet_amount"]
                if call_amount <= 0:
                    print(f"Invalid call, current bet is {self.current_bet}, player bet is {self.players[player_idx]['bet_amount']}")
                    return False
                    
                # Check if player has enough chips
                if self.players[player_idx]["chips"] < call_amount:
                    call_amount = self.players[player_idx]["chips"]  # All-in
                    
                self.players[player_idx]["chips"] -= call_amount
                self.players[player_idx]["bet_amount"] += call_amount
                print(f"Player {player_name} calls {call_amount}")
                
            elif action in ["bet", "raise"]:
                # Player bets or raises
                if amount <= self.current_bet:
                    print(f"Invalid {action}, amount {amount} must be greater than current bet {self.current_bet}")
                    return False
                
                # Check if raise is at least minimum raise
                min_raise = self.current_bet * 2 if self.current_bet > 0 else self.big_blind
                if amount < min_raise and amount < self.players[player_idx]["chips"]:
                    print(f"Invalid {action}, amount {amount} must be at least {min_raise}")
                    return False
                
                # Check if player has enough chips
                if self.players[player_idx]["chips"] < amount:
                    amount = self.players[player_idx]["chips"]  # All-in
                
                # Calculate the actual amount to add to the bet
                to_add = amount - self.players[player_idx]["bet_amount"]
                self.players[player_idx]["chips"] -= to_add
                self.players[player_idx]["bet_amount"] = amount
                self.current_bet = amount
                
                # Reset acted flags since betting has changed
                for i in range(len(self.player_acted)):
                    if i != player_idx and i in self.active_players:
                        self.player_acted[i] = False
                        
                print(f"Player {player_name} {action}s {amount}")
            
            else:
                print(f"Unknown action: {action}")
                return False
            
            # Check if all active players have acted
            if self.check_all_players_acted():
                # All players have acted, advance to next betting round
                self.advance_betting_round()
            else:
                # Move to next player
                self.advance_player()
                
            return True
            
        except Exception as e:
            print(f"Error in Game.process_action: {str(e)}")
            traceback.print_exc()
            return False

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
                
                # Clear the pot
                self.pot = 0
                
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
            best_hand_value = -1
            
            for player_idx in self.active_players:
                player = self.players[player_idx]
                # Combine player's hole cards with community cards
                cards = player["hand"] + self.community_cards
                
                # Evaluate the hand
                hand_result = self.hand_evaluator.evaluate_hand(cards)
                hand_value = hand_result[1]
                
                if hand_value > best_hand_value:
                    # New best hand
                    best_hand_value = hand_value
                    winners = [player_idx]
                    winning_hands = [hand_result[0]]
                    winning_hand_descriptions = [hand_result[2]]
                elif hand_value == best_hand_value:
                    # Tie - add this player as another winner
                    winners.append(player_idx)
                    winning_hands.append(hand_result[0])
                    winning_hand_descriptions.append(hand_result[2])
            
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
            
            # Clear the pot
            self.pot = 0
            
            # Schedule the next hand
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

    def handle_discard(self, username, card_indices):
        """
        Handle a player's discard action during the draw phase
        
        Args:
            username (str): The player's username
            card_indices (list): List of card indices to discard from the player's hand
            
        Returns:
            dict: A dictionary with success status and message
        """
        try:
            # 查找玩家的位置
            player_position = None
            for position, player in self.players.items():
                if player.get('name') == username or player.get('username') == username:
                    player_position = position
                    break
            
            if player_position is None:
                return {"success": False, "message": "Player not found in game"}
            
            # 检查当前是否是抽牌阶段
            current_phase = self.get_game_phase()
            if current_phase != "DRAW":
                return {"success": False, "message": f"Not in draw phase, current phase: {current_phase}"}
            
            # 检查是否轮到该玩家行动
            if player_position != self.current_player_idx:
                return {"success": False, "message": "Not your turn to discard"}
            
            # 确保有效的牌索引
            if not isinstance(card_indices, list):
                # 处理单个索引的情况
                if isinstance(card_indices, int):
                    card_indices = [card_indices]
                else:
                    try:
                        # 尝试从JSON字符串转换
                        card_indices = [int(idx) for idx in str(card_indices).split(',')]
                    except:
                        return {"success": False, "message": "Invalid card indices format"}
            
            # 获取玩家和手牌
            player = self.players[player_position]
            hand = player.get("hand", [])
            
            if not hand:
                return {"success": False, "message": "Player has no cards"}
            
            # 验证每个索引
            for idx in card_indices:
                if idx < 0 or idx >= len(hand):
                    return {"success": False, "message": f"Invalid card index: {idx}, hand size: {len(hand)}"}
            
            # 按降序排序索引，以避免在移除卡片时出现偏移问题
            sorted_indices = sorted(card_indices, reverse=True)
            
            # 移除要丢弃的卡片
            discarded_cards = []
            for idx in sorted_indices:
                discarded_cards.append(hand.pop(idx))
            
            # 从牌组中抽取新卡片
            new_cards = []
            for _ in range(len(discarded_cards)):
                new_card = self.deck.draw()
                hand.append(new_card)
                new_cards.append(new_card)
            
            # Update player's hand
            player["hand"] = hand
            
            # Track that this player has discarded
            player["has_discarded"] = True
            player["discarded_cards"] = discarded_cards
            
            # Log the discard action
            print(f"Player {username} discarded {len(discarded_cards)} cards and drew {len(new_cards)} new cards")
            print(f"Discarded: {discarded_cards}")
            print(f"Drew: {new_cards}")
            
            # Record the action in game history
            self.record_action(player_position, "discard", len(discarded_cards))
            
            # Move to the next player
            self.advance_player()
            
            # Check if all players have acted
            if self.check_all_players_acted():
                # If all players have discarded, move to the next betting round
                self.advance_betting_round()
            
            return {
                "success": True, 
                "message": f"Successfully discarded {len(discarded_cards)} cards",
                "discarded": discarded_cards,
                "new_cards": new_cards
            }
            
        except Exception as e:
            traceback.print_exc()
            return {"success": False, "message": f"Error processing discard: {str(e)}"}

    def get_player_hand(self, player_id):
        """获取指定玩家的手牌
        
        Args:
            player_id (str): 玩家ID或用户名
            
        Returns:
            list: 玩家手牌列表，如果玩家不存在则返回None
        """
        try:
            # 在玩家字典中查找匹配ID或名称的玩家
            for position, player in self.players.items():
                if player.get('name') == player_id or player.get('id') == player_id or player.get('username') == player_id:
                    return player.get('hand', [])
            
            # 如果未找到玩家，记录并返回None
            print(f"Player {player_id} not found in game")
            return None
        except Exception as e:
            print(f"Error in get_player_hand: {str(e)}")
            traceback.print_exc()
            return None

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
                        
                        print(f"[BROADCAST] Room {room_id}: Sending update. Reason: {change_reason}")
                        
                        # 发送游戏状态更新
                        await ws_manager.broadcast_to_room(room_id, {
                            "type": "game_update",
                            "data": {
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
                                if player_hand:
                                    await ws_manager.send_player_specific_state(
                                        player_id, game_state, player_hand
                                    )
                        
                        # 更新最后状态和时间
                        last_states[room_id] = current_state
                        last_update_time[room_id] = current_time
            
        except Exception as e:
            print(f"[ERROR] Error in timer update task: {e}")
            traceback.print_exc()
        
        # 检查频率仍然保持在每1-2秒一次，但实际更新会根据状态变化决定
        await asyncio.sleep(1)