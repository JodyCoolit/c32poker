import React, { useState } from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import { styled } from '@mui/material/styles';
import PlayingCard from './PlayingCard';
import DiscardedCard from './DiscardedCard';

const StyledPaper = styled(Paper)(({ theme }) => ({
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(2),
  maxWidth: '400px',
  margin: '0 auto',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
}));

const CardContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  gap: theme.spacing(2),
  marginBottom: theme.spacing(2),
  minHeight: '120px',
}));

const CardWrapper = styled(Box)(({ theme, selected }) => ({
  position: 'relative',
  cursor: 'pointer',
  transform: selected ? 'translateY(-10px)' : 'none',
  transition: 'transform 0.2s ease',
  boxShadow: selected ? '0 0 10px 3px rgba(255, 215, 0, 0.7)' : 'none',
  '&:hover': {
    transform: 'translateY(-5px)',
  },
}));

/**
 * DiscardPanel component for displaying the player's hand and discard interface
 * @param {Object} props - Component props
 * @param {Array} props.cards - The player's hand cards
 * @param {Function} props.onDiscard - Function to call when a card is discarded
 * @param {Object} props.discardedCard - The card that has been discarded (if any)
 */
const DiscardPanel = ({ cards = [], onDiscard, discardedCard = null }) => {
  const [selectedCardIndex, setSelectedCardIndex] = useState(-1);

  const handleCardClick = (index) => {
    // 如果已经选中了这张牌，则取消选中
    if (selectedCardIndex === index) {
      setSelectedCardIndex(-1);
    } else {
      // 否则选中这张牌
      setSelectedCardIndex(index);
      }
  };

  const handleDiscardClick = () => {
    if (selectedCardIndex === -1) {
      return;
    }
    onDiscard(selectedCardIndex);
    setSelectedCardIndex(-1);
  };

  // 如果已经弃牌了，则只显示剩余的两张牌和弃牌
  if (discardedCard) {
  return (
      <StyledPaper>
        <Typography 
          variant="h6" 
          gutterBottom
          sx={{ 
            color: 'white',
            textAlign: 'center',
            marginBottom: 2,
            fontWeight: 'bold'
          }}
        >
          我的手牌
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3 }}>
          <Box>
            <DiscardedCard card={discardedCard} visible={true} />
          </Box>
          <Box sx={{ 
            display: 'flex', 
            gap: 1.5,
            position: 'relative',
            '&::before': {
              content: '""',
              position: 'absolute',
              left: -10,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 0,
              height: 0,
              borderTop: '10px solid transparent',
              borderBottom: '10px solid transparent',
              borderLeft: '10px solid rgba(255, 255, 255, 0.7)',
            }
          }}>
            {cards.map((card, idx) => (
              <Box key={idx} sx={{ position: 'relative' }}>
                <PlayingCard card={card.display || card} faceUp={true} />
              </Box>
            ))}
          </Box>
        </Box>
        <Typography 
          variant="body2" 
          sx={{ 
            color: 'rgba(255, 255, 255, 0.7)',
            textAlign: 'center',
            marginTop: 2
          }}
        >
          已弃掉一张牌，现在可以开始游戏
        </Typography>
      </StyledPaper>
    );
  }

  // 尚未弃牌，显示弃牌界面
            return (
    <StyledPaper>
      <Typography 
        variant="h6" 
        gutterBottom
        sx={{ 
          color: 'white',
          textAlign: 'center',
          marginBottom: 2,
          fontWeight: 'bold'
        }}
      >
        选择弃掉一张牌以开始游戏
      </Typography>
      
      <CardContainer>
        {cards.map((card, index) => (
          <CardWrapper 
            key={index} 
            selected={selectedCardIndex === index}
            onClick={() => handleCardClick(index)}
          >
            <PlayingCard card={card.display || card} faceUp={true} />
            {selectedCardIndex === index && (
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
          </CardWrapper>
        ))}
      </CardContainer>
      
      <Button
            variant="contained" 
        color="error"
        fullWidth
        disabled={selectedCardIndex === -1}
        onClick={handleDiscardClick}
        sx={{
          backgroundColor: 'rgba(211, 47, 47, 0.8)',
          '&:hover': {
            backgroundColor: 'rgba(211, 47, 47, 1)',
          },
          '&.Mui-disabled': {
            backgroundColor: 'rgba(66, 66, 66, 0.5)',
            color: 'rgba(255, 255, 255, 0.3)',
          }
        }}
      >
        弃掉选中的牌
      </Button>
      
      <Typography 
        variant="body2" 
        sx={{ 
          color: 'rgba(255, 255, 255, 0.7)',
          textAlign: 'center',
          marginTop: 2,
          fontStyle: 'italic'
        }}
      >
        提示：每位玩家必须弃掉一张牌才能开始游戏
          </Typography>
    </StyledPaper>
  );
};

export default DiscardPanel; 