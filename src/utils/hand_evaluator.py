from src.models.card import Card, Suit

class HandEvaluator:
    # Hand rankings
    HIGH_CARD = 0
    ONE_PAIR = 1
    TWO_PAIR = 2
    THREE_OF_A_KIND = 3
    STRAIGHT = 4
    FLUSH = 5
    FULL_HOUSE = 6
    FOUR_OF_A_KIND = 7
    STRAIGHT_FLUSH = 8
    ROYAL_FLUSH = 9

    RANKS = {'2':2, '3':3, '4':4, '5':5, '6':6, '7':7, '8':8, '9':9, '10':10, 'J':11, 'Q':12, 'K':13, 'A':14}
    
    @staticmethod
    def evaluate_hand(hole_cards, community_cards):
        all_cards = hole_cards + community_cards
        ranks = [card.rank for card in all_cards]
        suits = [card.suit for card in all_cards]
        
        # 转换牌面值为数字
        rank_values = [HandEvaluator.RANKS[rank] for rank in ranks]
        rank_values.sort(reverse=True)  # 从大到小排序
        
        # 统计牌的数量
        rank_counts = {}
        for value in rank_values:
            rank_counts[value] = rank_counts.get(value, 0) + 1
            
        suit_counts = {}
        for suit in suits:
            suit_counts[suit] = suit_counts.get(suit, 0) + 1
            
        # 检查同花
        flush = any(count >= 5 for count in suit_counts.values())
        
        # 检查顺子
        straight = False
        straight_high = 0
        values = sorted(set(rank_values))
        for i in range(len(values) - 4):
            if values[i+4] - values[i] == 4:
                straight = True
                straight_high = values[i+4]
                break
                
        # 评估牌型并返回详细信息
        pairs = [(r, c) for r, c in rank_counts.items() if c == 2]
        three_kind = [(r, c) for r, c in rank_counts.items() if c == 3]
        four_kind = [(r, c) for r, c in rank_counts.items() if c == 4]
        
        if straight and flush:
            return (8, straight_high, rank_values[:5], "Straight Flush")
        elif four_kind:
            rank = four_kind[0][0]
            kickers = [r for r in rank_values if r != rank][:1]
            return (7, rank, kickers, "Four of a Kind")
        elif three_kind and pairs:
            three_rank = three_kind[0][0]
            pair_rank = pairs[0][0]
            return (6, three_rank, [pair_rank], "Full House")
        elif flush:
            return (5, rank_values[:5], [], "Flush")
        elif straight:
            return (4, straight_high, [], "Straight")
        elif three_kind:
            rank = three_kind[0][0]
            kickers = [r for r in rank_values if r != rank][:2]
            return (3, rank, kickers, "Three of a Kind")
        elif len(pairs) == 2:
            ranks = sorted([p[0] for p in pairs], reverse=True)
            kickers = [r for r in rank_values if r not in ranks][:1]
            return (2, ranks, kickers, "Two Pair")
        elif len(pairs) == 1:
            rank = pairs[0][0]
            kickers = [r for r in rank_values if r != rank][:3]
            return (1, rank, kickers, "One Pair")
        else:
            return (0, rank_values[:5], [], "High Card")
            
    @staticmethod
    def compare_hands(hand1_cards, hand2_cards, community_cards):
        score1 = HandEvaluator.evaluate_hand(hand1_cards, community_cards)
        score2 = HandEvaluator.evaluate_hand(hand2_cards, community_cards)
        
        # 比较牌型等级
        if score1[0] != score2[0]:
            return 1 if score1[0] > score2[0] else -1
            
        # 比较主要牌值
        if score1[1] != score2[1]:
            return 1 if score1[1] > score2[1] else -1
            
        # 比较踢脚
        for k1, k2 in zip(score1[2], score2[2]):
            if k1 != k2:
                return 1 if k1 > k2 else -1
                
        return 0