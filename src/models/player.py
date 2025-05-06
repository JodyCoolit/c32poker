class Player:
    def __init__(self, name, chips):
        print(f"Creating Player: name={name}, chips={chips}")
        self.name = name
        self.chips = chips
        self.total_buy_in = chips  # 新增：记录总买入金额，初始为首次买入量
        self.pending_buy_in = 0  # 新增：记录待处理买入金额
        self.hole_cards = []
        self.discarded_card = None
        self.position = None  # 明确设置为None，避免自动落座
        self.seat = None      # 明确设置为None，避免自动落座
        self.current_bet = 0  # 当前回合下注额
        self.total_bet = 0    # 当前牌局总下注额
        self.status = "active"  # active, folded, all-in
        print(f"Player {name} created successfully with no assigned seat")
        
    def __getstate__(self):
        """Support for pickle serialization"""
        state = self.__dict__.copy()
        return state
        
    def __setstate__(self, state):
        """Support for pickle deserialization"""
        self.__dict__.update(state)
        
    def receive_card(self, card):
        """收到一张新牌"""
        self.hole_cards.append(card)
        
    def discard_card(self, card_index):
        """弃一张牌（三张牌中选择两张）"""
        if len(self.hole_cards) != 3:
            raise ValueError("Must have exactly 3 cards to discard")
        self.discarded_card = self.hole_cards.pop(card_index)
        
    def bet(self, amount):
        """下注"""
        if amount > self.chips:
            amount = self.chips  # All-in
            
        self.chips -= amount
        self.current_bet += amount
        self.total_bet += amount
        return amount
        
    def fold(self):
        """弃牌"""
        self.hole_cards = []
        
    def reset(self):
        """重置玩家状态，准备新一轮游戏"""
        self.hole_cards = []
        self.discarded_card = None
        self.current_bet = 0
        self.total_bet = 0
        
    def get_hand_strength(self, community_cards):
        """获取当前手牌强度"""
        try:
            from src.utils.hand_evaluator import HandEvaluator
            return HandEvaluator.evaluate_hand(self.hole_cards, community_cards)
        except ImportError as e:
            print(f"Error importing HandEvaluator: {str(e)}")
            return (0, 0, [], "Error") # 返回默认的最低牌力
        except Exception as e:
            print(f"Error in get_hand_strength: {str(e)}")
            return (0, 0, [], "Error")  # 返回默认的最低牌力
        
    def to_dict(self):
        """转换为字典格式供API使用"""
        return {
            "name": self.name,
            "chips": self.chips,
            "total_buy_in": self.total_buy_in,  # 添加总买入字段
            "position": self.position,
            "seat": self.seat,  # 添加座位属性
            "current_bet": self.current_bet,
            "total_bet": self.total_bet
        }