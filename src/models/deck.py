import random
from src.models.card import Card, Suit

class Deck:
    def __init__(self):
        self.cards = []
        self._initialize_deck()
        
    def __getstate__(self):
        """Support for pickle serialization"""
        return {
            'cards': self.cards
        }
        
    def __setstate__(self, state):
        """Support for pickle deserialization"""
        self.cards = state['cards']
        
    def _initialize_deck(self):
        ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
        for suit in Suit:
            for rank in ranks:
                self.cards.append(Card(rank, suit))
                
    def shuffle(self):
        random.shuffle(self.cards)
        
    def deal(self):
        if not self.cards:
            raise ValueError("No cards left in deck")
        return self.cards.pop()

    def draw(self):
        """Alias for deal method, draws a card from the deck"""
        return self.deal()

    def count(self):
        """返回牌组中剩余的卡牌数量"""
        return len(self.cards)
        
    def to_dict(self):
        """返回牌组的字典表示，用于JSON序列化"""
        return {
            'cards_count': len(self.cards),
            'cards': [card.to_dict() for card in self.cards] if len(self.cards) <= 5 else "too many to display"
        }