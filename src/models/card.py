from enum import Enum

class Suit(Enum):
    HEARTS = "h"
    DIAMONDS = "d"
    CLUBS = "c"
    SPADES = "s"

class Card:
    def __init__(self, rank, suit):
        self.rank = rank
        self.suit = suit
        
    def __getstate__(self):
        """Support for pickle serialization"""
        return {
            'rank': self.rank,
            'suit': self.suit
        }
        
    def __setstate__(self, state):
        """Support for pickle deserialization"""
        self.rank = state['rank']
        self.suit = state['suit']
        
    def __str__(self):
        """返回卡牌的简洁字符串表示，例如：'As' 表示黑桃A"""
        suit_value = self.suit.value if hasattr(self.suit, 'value') else str(self.suit)
        return f"{self.rank}{suit_value}"
    
    def __repr__(self):
        """控制字典形式打印时的显示格式"""
        return self.__str__()
    
    def __eq__(self, other):
        if not isinstance(other, Card):
            return False
        return self.rank == other.rank and self.suit == other.suit
        
    def to_dict(self):
        """返回卡牌的字典表示，用于JSON序列化"""
        return {
            'rank': self.rank,
            'suit': self.suit.value if hasattr(self.suit, 'value') else str(self.suit),
            'display': str(self)
        }