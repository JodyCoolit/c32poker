import React from 'react';
import { Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

// Styled components for card elements
const CardContainer = styled(Box)(({ theme, selected }) => ({
  position: 'relative',
  width: '70px',
  height: '100px',
  borderRadius: '5px',
  boxShadow: selected ? `0 0 0 2px ${theme.palette.primary.main}, 0 4px 8px rgba(0,0,0,0.3)` : '0 2px 4px rgba(0,0,0,0.2)',
  backgroundColor: 'white',
  margin: '4px',
  userSelect: 'none',
  cursor: 'pointer',
  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  '&:hover': {
    transform: 'translateY(-5px)',
    boxShadow: selected ? `0 0 0 2px ${theme.palette.primary.main}, 0 8px 16px rgba(0,0,0,0.3)` : '0 5px 10px rgba(0,0,0,0.2)'
  }
}));

const CardBack = styled(Box)({
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  borderRadius: '5px',
  backgroundImage: 'linear-gradient(45deg, #1a237e, #3949ab)',
  backgroundSize: '10px 10px',
  backgroundPosition: '0 0, 5px 5px',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  '&::after': {
    content: '""',
    position: 'absolute',
    width: '80%',
    height: '80%',
    border: '2px solid rgba(255,255,255,0.1)',
    borderRadius: '3px'
  }
});

const CardCorner = styled(Box)(({ position, color }) => ({
  position: 'absolute',
  [position === 'top' ? 'top' : 'bottom']: '5px',
  [position === 'top' ? 'left' : 'right']: '5px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  color: color
}));

const CardCenter = styled(Box)({
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  fontSize: '26px'
});

// Parse card code into display value and symbol
const parseCard = (cardCode) => {
  if (!cardCode) return { value: '', symbol: '', color: 'black' };
  
  const value = cardCode.slice(0, -1);
  const suit = cardCode.slice(-1).toLowerCase();
  
  let displayValue = value;
  if (value === '1') displayValue = 'A';
  if (value === '11') displayValue = 'J';
  if (value === '12') displayValue = 'Q';
  if (value === '13') displayValue = 'K';
  
  let symbol = '';
  let color = 'black';
  
  switch (suit) {
    case 'h':
      symbol = '♥';
      color = '#e53935'; // red
      break;
    case 'd':
      symbol = '♦';
      color = '#e53935'; // red
      break;
    case 'c':
      symbol = '♣';
      color = '#212121'; // black
      break;
    case 's':
      symbol = '♠';
      color = '#212121'; // black
      break;
    default:
      symbol = '?';
  }
  
  return { value: displayValue, symbol, color };
};

const PlayingCard = ({ card, faceUp = true, selected = false, onClick }) => {
  const { value, symbol, color } = parseCard(card);
  
  return (
    <CardContainer 
      selected={selected} 
      onClick={onClick}
      role="button"
      aria-label={faceUp ? `${value} of ${symbol}` : 'Card'}
    >
      {faceUp ? (
        <>
          <CardCorner position="top" color={color}>
            <Typography variant="subtitle2" sx={{ lineHeight: 1, fontWeight: 'bold' }}>
              {value}
            </Typography>
            <Typography variant="subtitle2" sx={{ lineHeight: 1 }}>
              {symbol}
            </Typography>
          </CardCorner>
          
          <CardCenter>
            <Typography variant="h4" sx={{ color }}>
              {symbol}
            </Typography>
          </CardCenter>
          
          <CardCorner position="bottom" color={color}>
            <Typography variant="subtitle2" sx={{ lineHeight: 1 }}>
              {symbol}
            </Typography>
            <Typography variant="subtitle2" sx={{ lineHeight: 1, fontWeight: 'bold' }}>
              {value}
            </Typography>
          </CardCorner>
        </>
      ) : (
        <CardBack />
      )}
    </CardContainer>
  );
};

export default PlayingCard; 