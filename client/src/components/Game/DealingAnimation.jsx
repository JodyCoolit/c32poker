import React, { useState, useEffect } from 'react';
import { Box, keyframes, Button } from '@mui/material';
import { styled } from '@mui/system';
import cardBackImage from '../../assets/images/card-back.png'; // 确保路径正确

// 定义发牌动画关键帧
const dealCardKeyframes = keyframes`
  0% {
    transform: translate(-50%, -50%) scale(0.5);
    opacity: 0;
  }
  100% {
    transform: translate(0, 0) scale(1);
    opacity: 1;
  }
`;

// 卡牌容器样式
const AnimatedCard = styled(Box)(({ startX, startY, endX, endY, delay }) => ({
  position: 'absolute',
  width: '60px',
  height: '84px',
  backgroundImage: `url(${cardBackImage})`,
  backgroundSize: 'cover',
  borderRadius: '4px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
  zIndex: 1000,
  animation: `${dealCardKeyframes} 0.5s ${delay}s forwards ease-out`,
  transformOrigin: 'center center',
  left: endX,
  top: endY,
  transform: `translate(-50%, -50%) scale(0.5)`,
  opacity: 0,
}));

const DealingAnimation = ({ players, isActive, onAnimationComplete, testMode }) => {
  const [isDealing, setIsDealing] = useState(true);
  const [testDealingMode, setTestDealingMode] = useState(false);

  // 计算发牌起始点（通常是庄家位置或牌桌中心）
  const startPosition = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  
  // 动画完成后的回调
  useEffect(() => {
    if (!isActive) return;
    
    // 动画总时长 = 最后一张牌的延迟 + 单张牌动画时长
    const totalDuration = players.length * 2 * 0.15 + 0.5;
    
    const timer = setTimeout(() => {
      setIsDealing(false);
      if (onAnimationComplete) onAnimationComplete();
    }, totalDuration * 1000);
    
    return () => clearTimeout(timer);
  }, [isActive, players, onAnimationComplete]);
  
  if (!isActive || !isDealing) return null;
  
  return (
    <>
      {players.map((player, playerIndex) => {
        // 为每个玩家计算卡牌位置
        const playerElement = document.getElementById(`player-${player.id}`);
        let playerPosition = { x: 0, y: 0 };
        
        if (playerElement) {
          const rect = playerElement.getBoundingClientRect();
          playerPosition = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          };
        }
        
        // 为每位玩家生成两张牌（三张牌对应Pineapple变体）
        return [0, 1, 2].map((cardIndex) => (
          <AnimatedCard
            key={`${player.id}-card-${cardIndex}`}
            startX={startPosition.x}
            startY={startPosition.y}
            endX={playerPosition.x}
            endY={playerPosition.y}
            delay={playerIndex * 0.15 + cardIndex * 0.1} // 错开发牌时间
          />
        ));
      })}
      <div style={{ position: 'absolute', top: 120, left: 10, color: 'white', zIndex: 9999 }}>
        卡牌背面图片路径: {cardBackImage || '未找到'}
        <br />
        声音文件路径: {dealCardSound || '未找到'}
      </div>
    </>
  );
};

export default DealingAnimation;