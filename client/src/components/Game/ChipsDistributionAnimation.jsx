import React, { useState, useEffect, useRef } from 'react';
import { Box, keyframes, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

// 筹码颜色映射 - 与BetChips组件中的颜色保持一致
const chipColors = {
  0.5: '#808080',  // 灰色 - 0.5 BB (小盲)
  1: '#FFFFFF',    // 白色 - 1 BB
  5: '#FF0000',    // 红色 - 5 BB
  10: '#0000FF',   // 蓝色 - 10 BB
  25: '#008000',   // 绿色 - 25 BB
  100: '#000000',  // 黑色 - 100 BB
};

// 筹码移动动画关键帧
const moveChipsKeyframes = keyframes`
  0% {
    transform: translate(0, 0) scale(1);
    opacity: 1;
  }
  20% {
    transform: translate(0, -20px) scale(1.1);
    opacity: 1;
  }
  100% {
    transform: translate(var(--tx), var(--ty)) scale(1);
    opacity: 0.8;
  }
`;

// 筹码闪烁动画关键帧
const shineKeyframes = keyframes`
  0% {
    box-shadow: 0 0 5px 2px rgba(255, 215, 0, 0.3);
  }
  50% {
    box-shadow: 0 0 10px 5px rgba(255, 215, 0, 0.7);
  }
  100% {
    box-shadow: 0 0 5px 2px rgba(255, 215, 0, 0.3);
  }
`;

// 单个筹码样式
const Chip = styled(Box)(({ color, index, shine }) => ({
  width: '30px',
  height: '30px',
  borderRadius: '50%',
  backgroundColor: color,
  border: '2px solid white',
  boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
  position: 'absolute',
  zIndex: 2000 - index,
  transform: `translateY(${-index * 3}px)`,
  animation: shine ? `${shineKeyframes} 1s infinite ease-in-out` : 'none',
}));

// 移动中的筹码堆
const MovingChipStack = styled(Box)(({ 
  delay, 
  duration, 
  targetX, 
  targetY 
}) => ({
  '--tx': `${targetX}px`,
  '--ty': `${targetY}px`,
  position: 'absolute',
  width: '30px',
  height: '30px',
  left: '50%',
  top: '50%',
  transform: 'translate(-50%, -50%)',
  animation: `${moveChipsKeyframes} ${duration}s ${delay}s forwards ease-out`,
  zIndex: 2500,
}));

// 筹码数量显示
const ChipValue = styled(Typography)({
  position: 'absolute',
  bottom: '-20px',
  left: '50%',
  transform: 'translateX(-50%)',
  color: '#FFD700',
  fontWeight: 'bold',
  fontSize: '0.8rem',
  textShadow: '0 0 3px black',
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  padding: '2px 6px',
  borderRadius: '10px',
  whiteSpace: 'nowrap',
});

// 将下注金额分解为筹码
const calculateChips = (betAmount) => {
  // 特殊处理小于1的下注额（如小盲0.5BB）
  if (betAmount < 1) {
    return [0.5]; // 返回一个小盲筹码
  }
  
  const chipValues = [100, 25, 10, 5, 1];
  const chips = [];
  let remainingAmount = betAmount;

  chipValues.forEach(value => {
    const count = Math.floor(remainingAmount / value);
    for (let i = 0; i < Math.min(count, 5); i++) { // 每种筹码最多显示5个
      chips.push(value);
    }
    remainingAmount %= value;
  });

  // 如果有小数部分且大于0.1，添加一个小盲筹码
  if (remainingAmount > 0.1) {
    chips.push(0.5);
  }

  // 限制最多显示10个筹码
  return chips.slice(0, 10);
};

/**
 * 筹码分配动画组件
 * @param {Object} props 组件属性
 * @param {boolean} props.isActive 是否激活动画
 * @param {Array} props.winners 获胜者数组，每个元素需要包含位置信息和赢得的筹码数量
 * @param {number} props.pot 底池总额
 * @param {function} props.onAnimationComplete 动画完成后的回调
 * @param {Array} props.playerPositions 玩家位置数组，用于计算目标位置
 */
const ChipsDistributionAnimation = ({
  isActive = false,
  winners = [],
  pot = 0,
  onAnimationComplete,
  playerPositions = [],
}) => {
  const [stage, setStage] = useState('idle'); // idle, distributing, complete
  const chipsWonRef = useRef({});
  const chipSoundRef = useRef(null);
  
  // 准备声音效果
  useEffect(() => {
    try {
      // 使用bet.mp3作为筹码声音
      chipSoundRef.current = new Audio('/assets/sounds/chips-stack.mp3');
      console.log('加载筹码声音: /assets/sounds/chips-stack.mp3');
      
      // 预加载声音
      chipSoundRef.current.load();
      chipSoundRef.current.volume = 0.8; // 设置适当的音量
    } catch (error) {
      console.error('加载筹码声音失败:', error);
    }
    
    return () => {
      // 组件卸载时停止所有音频
      if (chipSoundRef.current) {
        try {
          chipSoundRef.current.pause();
          chipSoundRef.current.currentTime = 0;
        } catch (e) {
          console.error('停止筹码声音失败:', e);
        }
      }
    };
  }, []);
  
  // 动画激活时开始筹码分配
  useEffect(() => {
    if (isActive && stage === 'idle' && winners.length > 0) {
      startAnimation();
    }
  }, [isActive, winners, stage]);
  
  // 开始动画
  const startAnimation = () => {
    console.group('筹码分配动画');
    console.log('开始筹码分配动画，获胜者:', winners);
    console.log('底池总额:', pot);
    console.groupEnd();
    
    setStage('distributing');
    
    // 播放声音
    playChipSounds();
    
    // 计算每位获胜者赢得的筹码
    const chipsWon = {};
    winners.forEach(winner => {
      chipsWon[winner.position] = winner.chipsWon || pot / winners.length;
    });
    chipsWonRef.current = chipsWon;
    
    // 设置动画完成定时器
    // 动画持续时间 = 基础持续时间 + 延迟时间
    const animationDuration = 1.5; // 秒
    const animationDelay = 0.2; // 秒
    const totalAnimationTime = animationDuration + (winners.length * animationDelay);
    
    setTimeout(() => {
      setStage('complete');
      if (onAnimationComplete) {
        onAnimationComplete();
      }
    }, totalAnimationTime * 1000);
  };
  
  // 播放筹码声音
  const playChipSounds = () => {
    // 如果有声音引用且支持播放
    if (chipSoundRef.current) {
      chipSoundRef.current.currentTime = 0;
      chipSoundRef.current.play().catch(e => console.log('播放声音失败:', e));
      
      // 为每个获胜者播放一次声音
      winners.forEach((_, index) => {
        setTimeout(() => {
          chipSoundRef.current.currentTime = 0;
          chipSoundRef.current.play().catch(e => console.log('播放声音失败:', e));
        }, 300 + (index * 200)); // 错开时间播放
      });
    }
  };
  
  // 渲染筹码分配动画
  const renderDistributingChips = () => {
    return winners.map((winner, winnerIndex) => {
      // 找到玩家的位置信息
      const playerPos = playerPositions.find(p => p.position === winner.position);
      if (!playerPos) return null;
      
      // 计算获胜者赢得的筹码
      const chipsWon = winner.chipsWon || pot / winners.length;
      // 分解为筹码
      const chips = calculateChips(chipsWon);
      
      // 计算目标位置（相对于动画容器中心）
      const targetX = playerPos.x;
      const targetY = playerPos.y;
      
      return (
        <MovingChipStack
          key={`winner-${winner.position}`}
          delay={winnerIndex * 0.2} // 错开每个获胜者的动画
          duration={1.5}
          targetX={targetX}
          targetY={targetY}
        >
          {/* 筹码堆 */}
          {chips.map((value, index) => (
            <Chip 
              key={`chip-${winnerIndex}-${index}`}
              color={chipColors[value] || '#FFFFFF'} 
              index={index}
              shine={true}
            />
          ))}
          
          {/* 筹码数量 */}
          <ChipValue>+{chipsWon.toFixed(1)} BB</ChipValue>
        </MovingChipStack>
      );
    });
  };
  
  // 如果不活跃或没有获胜者，不渲染任何内容
  if (!isActive || winners.length === 0) {
    return null;
  }
  
  return (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 2000,
        pointerEvents: 'none', // 避免阻挡下方元素的交互
      }}
    >
      {stage === 'distributing' && renderDistributingChips()}
    </Box>
  );
};

export default ChipsDistributionAnimation; 