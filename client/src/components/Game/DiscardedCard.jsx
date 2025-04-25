import React from 'react';
import { Box, Paper } from '@mui/material';
import { styled } from '@mui/material/styles';
import PlayingCard from './PlayingCard';

const DiscardContainer = styled(Box)(({ theme }) => ({
  position: 'relative',
  width: 'fit-content',
}));

const DiscardMark = styled(Paper)(({ theme }) => ({
  position: 'absolute',
  top: '-12px',
  right: '-12px',
  backgroundColor: '#e53935',
  color: 'white',
  padding: '2px 6px',
  borderRadius: '4px',
  fontSize: '0.75rem',
  fontWeight: 'bold',
  zIndex: 10,
  boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
  border: '1px solid rgba(255,255,255,0.5)',
}));

const DiscardOverlay = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 5,
  '&::after': {
    content: '""',
    position: 'absolute',
    top: '10%',
    left: '10%',
    right: '10%',
    bottom: '10%',
    border: '2px dashed rgba(229, 57, 53, 0.8)',
    borderRadius: '5px',
  },
}));

/**
 * DiscardedCard component for displaying a discarded card
 * @param {Object} props - Component props
 * @param {Object|string} props.card - The card object or string representation
 * @param {boolean} props.visible - Whether the card should be visible
 */
const DiscardedCard = ({ card, visible = true }) => {
  return (
    <DiscardContainer>
      <Box sx={{ position: 'relative', transform: 'rotate(-8deg)' }}>
        <PlayingCard card={card.display || card} faceUp={visible} />
        <DiscardMark>弃牌</DiscardMark>
        <DiscardOverlay>
          <Box 
            component="div" 
            sx={{ 
              width: '80%', 
              height: '2px', 
              backgroundColor: '#e53935', 
              transform: 'rotate(45deg)',
              position: 'absolute',
            }}
          />
          <Box 
            component="div" 
            sx={{ 
              width: '80%', 
              height: '2px', 
              backgroundColor: '#e53935', 
              transform: 'rotate(-45deg)',
              position: 'absolute',
            }}
          />
        </DiscardOverlay>
      </Box>
    </DiscardContainer>
  );
};

export default DiscardedCard; 