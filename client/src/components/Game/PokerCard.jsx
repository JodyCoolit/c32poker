import React from 'react';
import { Box, Typography } from '@mui/material';
import { styled, keyframes } from '@mui/material/styles';

// Card flip animation
const flipIn = keyframes`
  0% {
    transform: rotateY(90deg);
    opacity: 0;
  }
  100% {
    transform: rotateY(0deg);
    opacity: 1;
  }
`;

// Card container
const CardContainer = styled(Box)(({ theme, revealed, empty }) => ({
  position: 'relative',
  width: '70px',
  height: '100px',
  borderRadius: '6px',
  backgroundColor: empty ? 'rgba(255, 255, 255, 0.05)' : (revealed ? '#ffffff' : '#1f2d5c'),
  boxShadow: empty ? 'none' : '0 4px 8px rgba(0, 0, 0, 0.2)',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  padding: '5px',
  margin: '4px',
  border: empty ? '2px dashed rgba(255, 255, 255, 0.2)' : 'none',
  animation: revealed && !empty ? `${flipIn} 0.3s forwards` : 'none',
  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: empty ? 'none' : '0 6px 12px rgba(0, 0, 0, 0.3)',
  },
  [theme.breakpoints.down('sm')]: {
    width: '50px',
    height: '70px',
    padding: '3px',
    borderRadius: '4px',
  },
}));

// Card back decoration
const CardBack = styled(Box)({
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '80%',
  height: '80%',
  borderRadius: '4px',
  backgroundImage: 'repeating-linear-gradient(45deg, #142347, #142347 10px, #1a2c5c 10px, #1a2c5c 20px)',
  border: '2px solid #2a3d70',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
});

// Get card color based on suit
const getCardColor = (suit) => {
  if (suit === 'H' || suit === 'D') return '#e53935';
  return '#212121';
};

// Get suit letter from code
const getSuitLetter = (card) => {
  if (!card) return '';
  
  const suit = card.charAt(card.length - 1).toUpperCase();
  switch (suit) {
    case 'H': return 'H';
    case 'D': return 'D';
    case 'C': return 'C';
    case 'S': return 'S';
    default: return '';
  }
};

// Get rank from card code
const getRank = (card) => {
  if (!card) return '';
  
  const rank = card.slice(0, card.length - 1);
  switch (rank) {
    case '10': return '10';
    case 'J': return 'J';
    case 'Q': return 'Q';
    case 'K': return 'K';
    case 'A': return 'A';
    default: return rank;
  }
};

/**
 * PokerCard component
 * @param {Object} props - Component props
 * @param {string} props.card - Card code (e.g., "AH" for Ace of hearts)
 * @param {boolean} props.revealed - Whether the card is revealed
 * @param {boolean} props.empty - Whether to show an empty placeholder
 * @param {number} props.delay - Animation delay in ms
 */
const PokerCard = ({ card, revealed = false, empty = false, delay = 0 }) => {
  const suit = getSuitLetter(card);
  const rank = getRank(card);
  const color = getCardColor(suit);

  // DEBUG: 输出卡片信息
  console.log('PokerCard渲染:', {
    原始卡片: card,
    花色: suit,
    点数: rank,
    颜色: color,
    是否显示: revealed,
    是否为空: empty,
    延迟: delay
  });

  return (
    <CardContainer 
      revealed={revealed} 
      empty={empty}
      sx={{ 
        animationDelay: `${delay}ms`,
      }}
    >
      {!revealed && !empty ? (
        <CardBack>
          <Typography
            variant="h6"
            component="div"
            sx={{
              color: '#fff',
              fontWeight: 'bold',
              fontSize: { xs: '12px', sm: '16px' },
              textShadow: '0 1px 2px rgba(0,0,0,0.6)',
            }}
          >
            GG
          </Typography>
        </CardBack>
      ) : empty ? (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            opacity: 0.5,
          }}
        >
          <Typography
            variant="body2"
            component="div"
            sx={{
              color: 'rgba(255,255,255,0.5)',
              fontSize: { xs: '10px', sm: '12px' },
            }}
          >
            ?
          </Typography>
        </Box>
      ) : (
        <>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
            }}
          >
            <Typography
              variant="body1"
              component="div"
              sx={{
                color,
                fontWeight: 'bold',
                fontSize: { xs: '14px', sm: '18px' },
                lineHeight: 1,
              }}
            >
              {rank}
            </Typography>
            <Typography
              variant="body1"
              component="div"
              sx={{
                color,
                fontSize: { xs: '14px', sm: '18px' },
                lineHeight: 1,
              }}
            >
              {suit}
            </Typography>
          </Box>
          
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          >
            <Typography
              variant="h4"
              component="div"
              sx={{
                color,
                fontSize: { xs: '24px', sm: '32px' },
                lineHeight: 1,
              }}
            >
              {suit}
            </Typography>
          </Box>
          
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              alignSelf: 'flex-end',
              transform: 'rotate(180deg)',
            }}
          >
            <Typography
              variant="body1"
              component="div"
              sx={{
                color,
                fontWeight: 'bold',
                fontSize: { xs: '14px', sm: '18px' },
                lineHeight: 1,
              }}
            >
              {rank}
            </Typography>
            <Typography
              variant="body1"
              component="div"
              sx={{
                color,
                fontSize: { xs: '14px', sm: '18px' },
                lineHeight: 1,
              }}
            >
              {suit}
            </Typography>
          </Box>
        </>
      )}
    </CardContainer>
  );
};

export default PokerCard; 