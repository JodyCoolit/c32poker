import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Paper, Fade } from '@mui/material';
import { styled } from '@mui/material/styles';
import Card from './Card';
import websocketService from '../../services/websocket';

// Styled components
const PanelContainer = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  backgroundColor: 'rgba(0, 0, 0, 0.8)',
  borderRadius: theme.shape.borderRadius,
  backdropFilter: 'blur(10px)',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
  color: 'white',
  maxWidth: '600px',
  margin: '0 auto',
  border: '1px solid rgba(255, 255, 255, 0.1)',
}));

const CardSelectionArea = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  gap: theme.spacing(2),
  marginBottom: theme.spacing(2),
  flexWrap: 'wrap',
  padding: theme.spacing(2),
}));

const ActionButton = styled(Button)(({ theme, color }) => ({
  margin: theme.spacing(1),
  backgroundColor: color === 'discard' ? 'rgba(211, 47, 47, 0.8)' : 'rgba(25, 118, 210, 0.8)',
  color: 'white',
  '&:hover': {
    backgroundColor: color === 'discard' ? 'rgba(211, 47, 47, 1)' : 'rgba(25, 118, 210, 1)',
  },
  '&.Mui-disabled': {
    backgroundColor: 'rgba(66, 66, 66, 0.5)',
    color: 'rgba(255, 255, 255, 0.3)',
  },
}));

/**
 * DiscardPanel component for selecting cards to discard in a Draw Poker game
 * @param {Object} props - Component props
 * @param {Array} props.cards - Array of card objects or strings representing the player's hand
 * @param {boolean} props.isVisible - Whether the discard panel should be visible
 * @param {number} props.maxDiscards - Maximum number of cards that can be discarded (typically 3 or 5)
 * @param {boolean} props.isUserTurn - Whether it's the user's turn to act
 * @param {Function} props.onDiscard - Callback function when discard is confirmed
 * @param {Function} props.onKeep - Callback function when player decides to keep all cards
 */
const DiscardPanel = ({
  cards = [],
  isVisible = false,
  maxDiscards = 3,
  isUserTurn = false,
  onDiscard = () => {},
  onKeep = () => {},
}) => {
  // State to track selected cards for discard
  const [selectedCards, setSelectedCards] = useState([]);
  const [loading, setLoading] = useState(false);

  // Reset selected cards when visibility changes
  useEffect(() => {
    if (!isVisible) {
      setSelectedCards([]);
      setLoading(false);
    }
  }, [isVisible]);

  // Handle card selection toggle
  const handleCardClick = (card, cardInfo) => {
    console.log('Card clicked:', card, 'Info:', cardInfo);
    
    // Find the index of the card in the hand
    const cardIndex = cards.findIndex(c => {
      // Handle both string format and object format
      if (typeof c === 'string') {
        return c === card;
      }
      return c.display === card || c === card;
    });
    
    if (cardIndex === -1) {
      console.error('Card not found in hand:', card);
      return;
    }
    
    setSelectedCards(prev => {
      // If card is already selected, remove it
      if (prev.includes(cardIndex)) {
        return prev.filter(idx => idx !== cardIndex);
      }
      
      // If max cards already selected, don't add more
      if (prev.length >= maxDiscards) {
        return prev;
      }
      
      // Add card to selected cards
      return [...prev, cardIndex];
    });
  };

  // Handle discard action
  const handleDiscard = async () => {
    if (selectedCards.length === 0) {
      // If no cards selected, act same as keep
      handleKeep();
      return;
    }
    
    setLoading(true);
    console.log('Discarding cards at indices:', selectedCards);
    
    try {
      // Send discard action to server
      await websocketService.discard(selectedCards);
      
      // Call callback if provided
      if (onDiscard) {
        onDiscard(selectedCards);
      }
    } catch (error) {
      console.error('Error discarding cards:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle keep all cards action
  const handleKeep = async () => {
    setLoading(true);
    console.log('Keeping all cards');
    
    try {
      // Send empty discard action (or specific "keep" action if your API supports it)
      await websocketService.discard([]);
      
      // Call callback if provided
      if (onKeep) {
        onKeep();
      }
    } catch (error) {
      console.error('Error keeping cards:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isVisible || !isUserTurn) {
    return null;
  }

  return (
    <Fade in={isVisible}>
      <PanelContainer>
        <Typography variant="h6" align="center" gutterBottom>
          选择需要换掉的牌
        </Typography>
        
        <Typography variant="body2" align="center" sx={{ mb: 2, color: 'rgba(255,255,255,0.7)' }}>
          最多可以换掉 {maxDiscards} 张牌。点击选择要换掉的牌。
        </Typography>
        
        <CardSelectionArea>
          {cards.map((card, index) => {
            // Determine card display value
            const cardValue = typeof card === 'string' ? card : (card.display || card);
            
            // Check if this card is selected
            const isSelected = selectedCards.includes(index);
            
            return (
              <Box key={index} sx={{ position: 'relative' }}>
                <Card
                  card={cardValue}
                  size="large"
                  interactive={true}
                  highlight={false}
                  selected={isSelected}
                  onClick={handleCardClick}
                  style={{
                    transform: isSelected ? 'translateY(-15px)' : 'none',
                    transition: 'transform 0.2s ease',
                    border: isSelected ? '3px solid #e53935' : 'none'
                  }}
                />
                {isSelected && (
                  <Box sx={{
                    position: 'absolute',
                    top: -10,
                    right: -10,
                    backgroundColor: '#e53935',
                    borderRadius: '50%',
                    width: 24,
                    height: 24,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 'bold',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                    border: '2px solid white'
                  }}>
                    X
                  </Box>
                )}
              </Box>
            );
          })}
        </CardSelectionArea>
        
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <ActionButton 
            color="keep"
            variant="contained" 
            onClick={handleKeep}
            disabled={loading}
          >
            保持原牌
          </ActionButton>
          
          <ActionButton 
            color="discard"
            variant="contained" 
            onClick={handleDiscard}
            disabled={selectedCards.length === 0 || loading}
          >
            换牌 ({selectedCards.length})
          </ActionButton>
        </Box>
        
        {loading && (
          <Typography variant="body2" align="center" sx={{ mt: 2, color: 'rgba(255,255,255,0.7)' }}>
            处理中...
          </Typography>
        )}
      </PanelContainer>
    </Fade>
  );
};

export default DiscardPanel; 