import React from 'react';
import { Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import PlayingCard from './PlayingCard';

// 公共牌容器
const CommunityCardsContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: theme.spacing(1),
  borderRadius: theme.spacing(1),
  backgroundColor: 'transparent',
  backdropFilter: 'blur(5px)',
  maxWidth: '100%',
  margin: '0 auto'
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

// 有效的游戏阶段列表（不包括等待状态）
const validGamePhases = ['PRE_FLOP', 'FLOP', 'TURN', 'RIVER', 'SHOWDOWN'];

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
  
  // 渲染牌的函数
  const renderCards = () => {
    // 如果是PRE_FLOP阶段，显示5张背面朝上的牌
    if (gamePhase === 'PRE_FLOP') {
      return Array(5).fill(null).map((_, index) => (
        <PlayingCard 
          key={`facedown-${index}`} 
          faceUp={false}
          sx={{ width: '60px', height: '90px', margin: '2px' }}
        />
      ));
    }
    
    // FLOP、TURN和RIVER阶段
    // 先显示已知的牌，然后显示卡背（而不是占位符）
    return (
      <>
        {visibleCards.map((card, index) => (
          <PlayingCard 
            key={`faceup-${index}`} 
            card={card} 
            faceUp={true}
            sx={{ width: '60px', height: '90px', margin: '2px' }}
          />
        ))}
        
        {Array(5 - visibleCards.length).fill(null).map((_, index) => (
          <PlayingCard 
            key={`facedown-${index + visibleCards.length}`} 
            faceUp={false}
            sx={{ width: '60px', height: '90px', margin: '2px' }}
          />
        ))}
      </>
    );
  };
  
  return (
    <CommunityCardsContainer>
      {potAmount > 0 && (
        <Typography 
          variant="h6" 
          color="secondary" 
          sx={{ 
            fontWeight: 'bold',
            marginBottom: 1
          }}
        >
          底池: {potAmount > 0 ? potAmount.toFixed(1) : 0} BB
        </Typography>
      )}
      
      <CardsContainer>
        {renderCards()}
      </CardsContainer>
    </CommunityCardsContainer>
  );
};

export default CommunityCards; 