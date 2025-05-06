import React from 'react';
import { Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

// Styled components for card elements
const CardContainer = styled(Box)(({ theme, selected, faceUp }) => ({
  position: 'relative',
  width: '70px',
  height: '100px',
  perspective: '1000px',
  borderRadius: '5px',
  margin: '4px',
  userSelect: 'none',
  cursor: 'pointer',
  '& .card-inner': {
    position: 'relative',
    width: '100%',
    height: '100%',
    transition: 'transform 0.6s',
    transformStyle: 'preserve-3d',
    boxShadow: selected ? `0 0 0 2px ${theme.palette.primary.main}, 0 4px 8px rgba(0,0,0,0.3)` : '0 2px 4px rgba(0,0,0,0.2)',
    transform: faceUp ? 'rotateY(180deg)' : 'rotateY(0deg)',
  },
  '&:hover .card-inner': {
    transform: faceUp ? 'rotateY(180deg) translateY(-5px)' : 'rotateY(0deg) translateY(-5px)',
    boxShadow: selected ? `0 0 0 2px ${theme.palette.primary.main}, 0 8px 16px rgba(0,0,0,0.3)` : '0 5px 10px rgba(0,0,0,0.2)'
  }
}));

const CardBack = styled(Box)(({ theme }) => ({
  width: '100%',
  height: '100%',
  borderRadius: '5px',
  position: 'absolute',
  backfaceVisibility: 'hidden',
  backgroundColor: '#1a2c5c',
  backgroundImage: 'repeating-linear-gradient(45deg, #142347, #142347 10px, #1a2c5c 10px, #1a2c5c 20px)',
  boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
  border: '2px solid #fff',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
}));

const CardFront = styled(Box)({
  width: '100%',
  height: '100%',
  borderRadius: '5px',
  position: 'absolute',
  backfaceVisibility: 'hidden',
  backgroundColor: 'white',
  transform: 'rotateY(180deg)',
  border: '2px solid #fff',
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
  
  // 处理对象格式的卡牌数据
  if (typeof cardCode === 'object') {
    const { rank, suit, display } = cardCode;
    
    // 如果有display属性，优先使用
    if (display) {
      return parseCard(display);
    }
    
    // 否则使用rank和suit
    if (rank && suit) {
      // 花色转为小写字母
      const suitChar = typeof suit === 'string' ? suit.charAt(0).toLowerCase() : '';
      return parseCard(rank + suitChar);
    }
    
    return { value: '', symbol: '', color: 'black' };
  }
  
  // 处理字符串格式的卡牌数据
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

const PlayingCard = ({ card, faceUp = true, selected = false, onClick, className = '' }) => {
  const { value, symbol, color } = parseCard(card);
  
  return (
    <CardContainer 
      selected={selected} 
      faceUp={faceUp}
      onClick={onClick}
      role="button"
      aria-label={faceUp ? `${value} of ${symbol}` : 'Card'}
    >
      <Box 
        className={`card-inner ${className}`}
      >
        <CardFront>
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
        </CardFront>
        
        <CardBack />
      </Box>
    </CardContainer>
  );
};

export default PlayingCard; 