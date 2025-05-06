import React, { useState, useEffect } from 'react';
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
  '& .flipped': {
    transform: 'rotateY(180deg)',
  }
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
  // 添加翻牌状态控制
  const [flippedCards, setFlippedCards] = useState([false, false, false, false, false]);
  
  // 监听 gamePhase 变化来触发翻牌动画
  useEffect(() => {
    if (gamePhase === 'FLOP') {
      // FLOP：翻开前三张
      setTimeout(() => {
        setFlippedCards([true, true, true, false, false]);
      }, 100);
    } else if (gamePhase === 'TURN') {
      // TURN：翻开第四张
      setTimeout(() => {
        setFlippedCards(prev => [...prev.slice(0, 3), true, false]);
      }, 100);
    } else if (gamePhase === 'RIVER' || gamePhase === 'SHOWDOWN') {
      // RIVER/SHOWDOWN：翻开第五张
      setTimeout(() => {
        setFlippedCards([true, true, true, true, true]);
      }, 100);
    } else if (gamePhase === 'PRE_FLOP') {
      // PRE_FLOP：重置所有牌为未翻开
      setFlippedCards([false, false, false, false, false]);
    }
  }, [gamePhase]);

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
    return Array(5).fill(null).map((_, index) => (
      <PlayingCard 
        key={`card-${index}`}
        card={communityCards[index]} 
        faceUp={flippedCards[index]}
        sx={{ 
          width: '60px', 
          height: '90px', 
          margin: '2px',
          transition: 'transform 0.6s',
          transformStyle: 'preserve-3d',
        }}
        // 添加翻牌动画类
        className={flippedCards[index] ? 'flipped' : ''}
      />
    ));
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