from enum import Enum

class Suit(Enum):
    HEARTS = "H"
    DIAMONDS = "D"
    CLUBS = "C"
    SPADES = "S"

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
        return f"{self.rank}{self.suit.value}"
    
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