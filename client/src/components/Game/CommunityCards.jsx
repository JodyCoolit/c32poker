import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import PlayingCard from './PlayingCard';

// 公共牌容器
const CommunityCardsContainer = styled(Paper)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: theme.spacing(1),
  borderRadius: theme.spacing(1),
  backgroundColor: 'rgba(0, 0, 0, 0.2)',
  backdropFilter: 'blur(5px)',
  maxWidth: '100%',
  margin: '0 auto',
}));

// 牌面容器
const CardsContainer = styled(Box)({
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  gap: '5px',
  marginTop: '4px',
});

// 游戏阶段标签
const PhaseLabel = styled(Typography)(({ theme }) => ({
  color: theme.palette.primary.main,
  fontWeight: 500,
  marginBottom: theme.spacing(0.5),
  fontSize: '0.85rem',
  textTransform: 'uppercase',
  letterSpacing: '1px',
}));

// 游戏阶段对应的中文名称
const phaseNames = {
  'PRE_FLOP': '翻牌前',
  'FLOP': '翻牌',
  'TURN': '转牌',
  'RIVER': '河牌',
  'SHOWDOWN': '摊牌',
  'DRAW': '换牌',
};

// 有效的游戏阶段列表（不包括等待状态）
const validGamePhases = ['PRE_FLOP', 'FLOP', 'TURN', 'RIVER', 'SHOWDOWN', 'DRAW'];

/**
 * 公共牌组件
 * @param {Object} props
 * @param {Array} props.communityCards - 公共牌数组 ['AH', '2D', '3C', '4S', '5H']
 * @param {string} props.gamePhase - 游戏阶段 'PRE_FLOP', 'FLOP', 'TURN', 'RIVER', 'SHOWDOWN'
 * @param {number} props.potAmount - 底池金额
 * @param {string} props.status - 游戏状态 'waiting', 'playing', 'finished'
 */
const CommunityCards = ({ 
  communityCards = [], 
  gamePhase = 'WAITING',
  potAmount = 0,
  status = 'waiting'
}) => {
  // 检查是否是有效的游戏阶段或状态
  const isValidGamePhase = (!!gamePhase && validGamePhases.includes(gamePhase)) || status === 'playing';
  
  // 如果不是有效的游戏阶段，不显示组件
  if (!isValidGamePhase) {
    return null;
  }
  
  // 根据游戏阶段确定应该显示的牌数
  const getVisibleCardCount = () => {
    switch (gamePhase) {
      case 'FLOP':
        return 3;
      case 'TURN':
        return 4;
      case 'RIVER':
      case 'SHOWDOWN':
        return 5;
      case 'PRE_FLOP':
      default:
        // 在PRE_FLOP阶段或状态为playing但阶段未明确时，显示底池但不显示牌
        return 0;
    }
  };

  const visibleCardCount = getVisibleCardCount();
  const visibleCards = communityCards.slice(0, visibleCardCount);
  
  // 填充空位
  const placeholderCards = Array(5 - visibleCards.length).fill(null);
  
  return (
    <CommunityCardsContainer elevation={3}>
      <PhaseLabel variant="subtitle2">
        {phaseNames[gamePhase] || '等待发牌'}
      </PhaseLabel>
      
      {potAmount > 0 && (
        <Typography 
          variant="h6" 
          color="secondary" 
          sx={{ 
            fontWeight: 'bold',
            marginBottom: 1
          }}
        >
          底池: ${potAmount}
        </Typography>
      )}
      
      <CardsContainer>
        {visibleCards.map((card, index) => (
          <PlayingCard 
            key={index} 
            card={card} 
            faceUp={true}
            sx={{ width: '50px', height: '70px' }}
          />
        ))}
        
        {placeholderCards.map((_, index) => (
          <Box 
            key={`placeholder-${index}`} 
            sx={{ 
              width: '50px',
              height: '70px',
              borderRadius: '4px',
              border: '1px dashed rgba(255,255,255,0.3)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}
          >
            {/* 空白牌位 */}
          </Box>
        ))}
      </CardsContainer>
    </CommunityCardsContainer>
  );
};

export default CommunityCards; 