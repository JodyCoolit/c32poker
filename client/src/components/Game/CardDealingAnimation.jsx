import React, { useState, useEffect, useRef } from 'react';
import { Box, keyframes, Button, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

// 发牌动画的关键帧
const dealCardKeyframes = keyframes`
  0% {
    transform: translate(-50%, -50%) scale(0.7) rotate(0deg);
    opacity: 0;
    z-index: 2000;
  }
  20% {
    opacity: 1;
    z-index: 2000;
    transform: translate(-50%, -50%) scale(0.8) rotate(0deg);
  }
  100% {
    transform: translate(var(--tx), var(--ty)) scale(1) rotate(var(--tr));
    opacity: 1;
    z-index: 2000;
  }
`;

// 堆叠牌组效果关键帧
const stackCardKeyframes = keyframes`
  0% {
    transform: translateZ(0) scale(1);
  }
  50% {
    transform: translateZ(2px) scale(1.02);
  }
  100% {
    transform: translateZ(0) scale(1);
  }
`;

// 洗牌效果关键帧
const shuffleKeyframes = keyframes`
  0% {
    transform: rotate(0deg) translateY(0);
  }
  25% {
    transform: rotate(3deg) translateY(-5px);
  }
  50% {
    transform: rotate(-3deg) translateY(0);
  }
  75% {
    transform: rotate(2deg) translateY(-3px);
  }
  100% {
    transform: rotate(0deg) translateY(0);
  }
`;

// 卡牌样式
const CardBack = styled(Box)(({ theme }) => ({
  width: '60px',
  height: '90px',
  borderRadius: '5px',
  position: 'absolute',
  transformStyle: 'preserve-3d',
  backfaceVisibility: 'hidden',
  backgroundColor: '#1a2c5c',
  backgroundImage: 'repeating-linear-gradient(45deg, #142347, #142347 10px, #1a2c5c 10px, #1a2c5c 20px)',
  boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
  border: '2px solid #fff',
}));

// 卡牌容器
const DeckContainer = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '80px',
  height: '110px',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  perspective: '1000px',
  zIndex: 50,
}));

// 动画卡牌
const AnimatedCard = styled(CardBack)(({ 
  delay, 
  duration, 
  targetX, 
  targetY, 
  rotation 
}) => ({
  '--tx': `${targetX}px`,
  '--ty': `${targetY}px`,
  '--tr': `${rotation}deg`,
  animation: `${dealCardKeyframes} ${duration}s ${delay}s forwards ease-out`,
  opacity: 0,
  boxShadow: '0 4px 8px rgba(0,0,0,0.8)',
  border: '2px solid white',
  backgroundColor: '#1a2c5c',
  zIndex: 2000,
  position: 'absolute',
  left: '50%',
  top: '50%'
}));

// 牌堆卡牌（洗牌效果）
const DeckCard = styled(CardBack)(({ index }) => ({
  transform: `translateZ(${index * 0.5}px)`,
  animation: `${stackCardKeyframes} 1s infinite alternate ease-in-out`,
  animationDelay: `${index * 0.1}s`,
}));

// 洗牌动画容器
const ShufflingDeck = styled(Box)(({ "data-isshuffling": isShuffling }) => ({
  position: 'relative',
  width: '60px',
  height: '90px',
  animation: isShuffling ? `${shuffleKeyframes} 0.5s infinite ease-in-out` : 'none',
}));

// 位置标记组件
const PositionMarker = styled(Box)({
  position: 'absolute',
  left: '50%',
  top: '50%',
  width: '40px',
  height: '40px',
  borderRadius: '50%',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  color: 'white',
  fontSize: '12px',
  fontWeight: 'bold',
  zIndex: 1800,
  pointerEvents: 'none',
  transition: 'opacity 0.3s',
  boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
  border: '2px solid white',
});

/**
 * 洗牌和发牌动画组件
 * @param {Object} props 组件属性
 * @param {Array} props.players 玩家数组，每个玩家需要包含id和位置信息
 * @param {boolean} props.isActive 是否激活动画
 * @param {function} props.onAnimationComplete 动画完成后的回调
 * @param {boolean} props.testMode 测试模式，显示测试按钮
 * @param {boolean} props.debug 是否开启调试信息，默认为false
 * @param {boolean} props.showMarkers 是否始终显示位置标记，默认为true
 * @param {string} props.currentUser 当前用户的用户名，用于识别哪个玩家是当前客户端用户
 * @param {Object} props.gameState 游戏状态对象，包含当前行动玩家信息
 */
const CardDealingAnimation = ({ 
  players = [], 
  isActive = false, 
  onAnimationComplete, 
  testMode = false,
  debug = true, // 默认开启调试模式
  showMarkers = false, // 默认隐藏位置标记
  currentUser = "", // 当前用户的用户名
  gameState = {} // 游戏状态对象
}) => {
  const [stage, setStage] = useState('idle'); // idle, shuffling, dealing, complete
  const [playerPositions, setPlayerPositions] = useState([]);
  // 使用新的状态保存位置标记数据，确保动画结束后也能显示
  const [savedPositions, setSavedPositions] = useState([]);
  const shuffleSoundRef = useRef(null);
  const dealSoundRef = useRef(null);
  
  // 准备声音效果
  useEffect(() => {
    shuffleSoundRef.current = new Audio('/assets/sounds/card-shuffle.mp3');
    dealSoundRef.current = new Audio('/assets/sounds/card-deal.mp3');
    
    // 预加载声音
    shuffleSoundRef.current.load();
    dealSoundRef.current.load();
    
    return () => {
      // 组件卸载时停止所有音频
      if (shuffleSoundRef.current) {
        shuffleSoundRef.current.pause();
        shuffleSoundRef.current.currentTime = 0;
      }
      if (dealSoundRef.current) {
        dealSoundRef.current.pause();
        dealSoundRef.current.currentTime = 0;
      }
    };
  }, []);
  
  // 动画激活时开始洗牌
  useEffect(() => {
    if (isActive && stage === 'idle') {
      startAnimation();
    }
    
    // 当isActive变为false时，重置阶段状态
    if (!isActive && stage !== 'idle') {
      setStage('idle');
    }
  }, [isActive, stage]);
  
  // 从gameState中获取当前行动玩家的逻辑位置
  const getCurrentPlayerIdx = () => {
    // 从多个可能的属性中尝试获取当前行动玩家
    if (!gameState) return -1;
    
    // 优先从game对象中获取
    if (gameState.game) {
      if (gameState.game.currentPlayerIdx !== undefined) 
        return gameState.game.currentPlayerIdx;
      if (gameState.game.current_player_idx !== undefined) 
        return gameState.game.current_player_idx;
    }
    
    // 直接从gameState获取
    if (gameState.currentPlayerIdx !== undefined) 
      return gameState.currentPlayerIdx;
    if (gameState.current_player_idx !== undefined) 
      return gameState.current_player_idx;
    
    return -1;
  };
  
  // 定义座位角度映射 - 保持与Seat.jsx完全一致
  const seatAngles = [180, 225, 270, 315, 0, 45, 90, 135];
  
  // 计算位置函数 - 与Seat.jsx中使用相同的计算方法
  const calculatePosition = (angle, distanceMultiplier = 1) => {
    const radian = (angle * Math.PI) / 180;
    // 使用与Seat.jsx相同的基本计算方法，但距离更大以适应卡牌发放
    // 原来是百分比，这里转为像素坐标
    const distanceX = 600 * distanceMultiplier; // 水平半轴
    const distanceY = 350 * distanceMultiplier; // 垂直半轴
    const x = Math.sin(radian) * distanceX;
    const y = -Math.cos(radian) * distanceY;
    return { x, y, angle };
  };
  
  // 计算玩家位置
  useEffect(() => {
    // 确保只在特定条件下运行，避免无限循环
    const shouldCalculatePositions = 
      stage === 'shuffling' || 
      (showMarkers && players.length > 0 && savedPositions.length === 0);
    
    if (!shouldCalculatePositions) return;
    
    // 使用测试数据或传入的玩家数据
    const playersToUse = (testMode && window._testPlayers) || players;
    
    // 如果没有玩家数据，不处理
    if (playersToUse.length === 0) return;
    
    // 从gameState中获取当前行动玩家索引
    const currentPlayerIdx = getCurrentPlayerIdx();
    
    // 找出当前用户在玩家列表中的位置
    const currentUserIndex = playersToUse.findIndex(p => 
      p.username === currentUser || p.name === currentUser
    );
    
    // DEBUG: 打印玩家和当前用户信息
    if (debug) {
      console.log('[DEBUG] 玩家列表:', playersToUse);
      console.log('[DEBUG] 当前用户名:', currentUser);
      console.log('[DEBUG] 当前用户索引:', currentUserIndex);
      console.log('[DEBUG] 当前行动玩家逻辑位置:', currentPlayerIdx);
      console.log('[DEBUG] gameState:', gameState);
    }
    
    // 找出当前用户的逻辑位置(position)
    let currentUserPosition = -1;
    if (currentUserIndex >= 0) {
      currentUserPosition = playersToUse[currentUserIndex].position !== undefined 
        ? playersToUse[currentUserIndex].position 
        : -1;
    }
    
    // DEBUG: 打印座位角度映射
    if (debug) {
      console.log('[DEBUG] 座位角度映射:');
      seatAngles.forEach((angle, pos) => {
        console.log(`[DEBUG] UI位置${pos} (逻辑位置未知) 的角度: ${angle}°`);
      });
      console.log('[DEBUG] 当前用户逻辑位置:', currentUserPosition);
    }
    
    // 根据玩家的实际位置计算卡牌目标位置
    const positions = playersToUse.map((player, index) => {
      // 获取玩家的逻辑位置
      const logicalPosition = player.position !== undefined ? player.position : index;
      
      // 是否是当前用户
      const isCurrentUser = player.username === currentUser || player.name === currentUser;
      
      // 是否是当前行动玩家
      const isActionPlayer = logicalPosition === currentPlayerIdx;
      
      // 计算UI位置 - 这是关键的一步
      // 在Seat.jsx中，UI位置直接用于索引seatAngles
      // 因为我们通常将当前用户显示在底部，所以做相对调整
      let uiPosition = logicalPosition;
      
      // 如果找到了当前用户，调整其他玩家的UI位置，使当前用户显示在底部(UI位置0)
      if (currentUserPosition >= 0) {
        // 计算相对于当前用户的UI位置偏移
        // 使用模运算确保结果在0-7之间
        uiPosition = (logicalPosition - currentUserPosition + 8) % 8;
      }
      
      // 获取该UI位置对应的角度
      const angleDegrees = seatAngles[uiPosition];
      
      // 计算坐标
      const { x, y } = calculatePosition(angleDegrees, 1);
      
      // DEBUG: 打印玩家位置计算详情
      if (debug) {
        console.log(`[DEBUG] 玩家${index} (${player.username || player.name || `玩家${index}`}):`);
        console.log(`  - 逻辑位置: ${logicalPosition}`);
        console.log(`  - UI位置: ${uiPosition}`);
        console.log(`  - 角度: ${angleDegrees}°`);
        console.log(`  - 坐标: x=${x.toFixed(2)}, y=${y.toFixed(2)}`);
        console.log(`  - 是当前用户: ${isCurrentUser}`);
        console.log(`  - 是当前行动玩家: ${isActionPlayer}`);
      }
      
      return {
        playerId: player.id || index,
        username: player.username || player.name || `玩家${index}`,
        x: x,
        y: y,
        rotation: Math.random() * 10 - 5,
        isCurrentUser: isCurrentUser,
        isActionPlayer: isActionPlayer,
        logicalPosition: logicalPosition,
        uiPosition: uiPosition,
        angleDegrees: angleDegrees
      };
    });
    
    // 设置活跃的位置数据
    setPlayerPositions(positions);
    
    // 只在特定情况下保存位置数据，避免无限循环
    // 如果是第一次计算位置(savedPositions为空)或处于洗牌阶段，才保存位置
    if (savedPositions.length === 0 && positions.length > 0) {
      // 使用setTimeout来避免在同一个渲染周期内连续设置状态
      setTimeout(() => {
        setSavedPositions(positions);
      }, 0);
    }
    
    // DEBUG: 打印最终计算的所有位置信息
    if (debug) {
      console.log('[DEBUG] 最终计算的玩家位置信息:', positions);
    }
  // 从依赖列表中移除savedPositions，防止循环依赖
  // 添加gameState作为依赖项，以便在游戏状态变化时重新计算位置
  }, [stage, players, testMode, debug, showMarkers, currentUser, gameState]);
  
  // 开始整个动画序列
  const startAnimation = () => {
    // 开始洗牌动画
    setStage('shuffling');
    
    // 播放洗牌声音
    if (shuffleSoundRef.current) {
      shuffleSoundRef.current.currentTime = 0;
      shuffleSoundRef.current.play()
        .catch(e => console.warn('无法播放洗牌声音:', e));
    }
    
    // 洗牌动画持续1.5秒
    setTimeout(() => {
      // 开始发牌动画
      setStage('dealing');
      
      // 这里添加一个小延迟，确保视觉上的连贯
      setTimeout(() => {
        // 播放发牌声音（可能需要多次播放以匹配多张牌的发放）
        playDealSounds();
      }, 200);
      
      // 计算动画总时长 = 最后一张牌的延迟 + 单张牌动画时长
      const cardsPerPlayer = 3; // Pineapple变体使用3张牌
      const dealDelay = 0.2; // 发牌间隔时间(秒)
      const cardAnimDuration = 0.6; // 单张牌动画时长(秒)
      
      const totalDuration = 
        Math.max(1, players.length) * cardsPerPlayer * dealDelay + cardAnimDuration + 0.5; // 额外0.5秒缓冲
      
      // 动画完成后执行回调
      const animationTimer = setTimeout(() => {
        setStage('complete');
        
        // 使用短延迟确保状态更新后调用回调
        setTimeout(() => {
          if (onAnimationComplete) {
            onAnimationComplete();
          }
          
          // 在短暂延迟后重置为idle状态，允许再次播放
          setTimeout(() => {
            setStage('idle');
          }, 500);
        }, 100);
      }, totalDuration * 1000);
      
      // 保存定时器引用，以便在组件卸载时清除
      return () => clearTimeout(animationTimer);
    }, 1500);
  };
  
  // 播放发牌声音（每张牌发出时）
  const playDealSounds = () => {
    if (!dealSoundRef.current) return;
    
    const cardsPerPlayer = 3;
    const totalCards = players.length * cardsPerPlayer;
    const dealDelay = 200; // 毫秒
    
    // 为每张牌安排发牌声音
    Array(totalCards).fill(0).forEach((_, index) => {
      setTimeout(() => {
        // 克隆音频对象以便同时播放多个实例
        const dealSound = dealSoundRef.current.cloneNode();
        dealSound.volume = 0.7; // 降低音量以避免太吵
        dealSound.play()
          .catch(e => console.warn('无法播放发牌声音:', e));
      }, index * dealDelay);
    });
  };
  
  // 测试按钮处理程序
  const handleTest = () => {
    // 创建模拟玩家数据，包括清晰标记当前玩家
    const mockPlayers = [
      { id: 'player1', username: '当前玩家(你)', position: 2, isCurrentUser: true },
      { id: 'player2', username: '玩家2', position: 4 },
      { id: 'player3', username: '玩家3', position: 6 },
      { id: 'player4', username: '玩家4', position: 8 },
      { id: 'player5', username: '玩家5', position: 0 }
    ];
    
    // 临时替换玩家数据进行测试
    window._testPlayers = mockPlayers;
    
    // DEBUG: 打印测试玩家数据
    if (debug) {
      console.log('[DEBUG] 使用测试玩家数据:', mockPlayers);
    }
    
    setStage('idle');
    setTimeout(() => {
      startAnimation();
    }, 100);
  };
  
  // 渲染牌堆（洗牌动画）
  const renderDeck = () => (
    <DeckContainer>
      <ShufflingDeck data-isshuffling={stage === 'shuffling'}>
        {Array(5).fill(0).map((_, i) => (
          <DeckCard key={`deck-${i}`} index={i} />
        ))}
      </ShufflingDeck>
    </DeckContainer>
  );
  
  // 渲染发牌动画
  const renderDealingCards = () => {
    if (stage !== 'dealing' || playerPositions.length === 0) {
      return null;
    }
    
    const cards = [];
    const cardsPerPlayer = 3; // Pineapple变体使用3张牌
    const dealDelay = 0.2; // 发牌间隔时间(秒)
    const cardAnimDuration = 0.6; // 单张牌动画时长(秒)
    
    // DEBUG: 记录发牌开始
    if (debug) {
      console.log('[DEBUG] 开始发牌动画,共 ' + playerPositions.length + ' 名玩家');
    }
    
    playerPositions.forEach((position, playerIndex) => {
      // 为每位玩家发放三张牌
      for (let cardIndex = 0; cardIndex < cardsPerPlayer; cardIndex++) {
        const delay = (playerIndex * cardsPerPlayer + cardIndex) * dealDelay;
        
        // DEBUG: 打印每张牌的发牌信息
        if (debug) {
          console.log(`[DEBUG] 发牌: 玩家${playerIndex} (${position.username}) 第${cardIndex+1}张牌:`);
          console.log(`  - 目标坐标: x=${position.x.toFixed(2)}, y=${position.y.toFixed(2)}`);
          console.log(`  - 角度: ${position.angleDegrees}°`);
          console.log(`  - 延迟: ${delay.toFixed(2)}秒`);
          console.log(`  - 旋转: ${position.rotation.toFixed(2)}°`);
        }
        
        cards.push(
          <AnimatedCard
            key={`card-${position.playerId}-${cardIndex}`}
            delay={delay}
            duration={cardAnimDuration}
            targetX={position.x}
            targetY={position.y}
            rotation={position.rotation}
          />
        );
      }
    });
    
    return cards;
  };
  
  // 渲染玩家位置标记点
  const renderPositionMarkers = () => {
    // 使用保存的位置数据或当前活跃的位置数据
    const positionsToUse = playerPositions.length > 0 ? playerPositions : savedPositions;
    
    if (positionsToUse.length === 0) return null;
    
    return positionsToUse.map((pos, idx) => (
      <PositionMarker
        key={`marker-${idx}`}
        sx={{
          transform: `translate(${pos.x}px, ${pos.y}px)`,
          opacity: 0.8,
          backgroundColor: pos.isActionPlayer 
            ? 'rgba(255, 215, 0, 0.8)' // 高亮当前行动玩家为金色
            : pos.isCurrentUser 
              ? 'rgba(0, 128, 0, 0.7)' 
              : 'rgba(255, 0, 0, 0.7)',
        }}
      >
        {pos.logicalPosition}
      </PositionMarker>
    ));
  };
  
  // 测试模式下显示状态和控制按钮
  const renderTestControls = () => {
    if (!testMode) return null;
    
    return (
      <Box
        sx={{
          position: 'absolute',
          top: 20,
          right: 20,
          zIndex: 9999,
          bgcolor: 'rgba(0,0,0,0.7)',
          p: 2,
          borderRadius: 2,
          pointerEvents: 'auto', // 确保可以点击控制按钮
        }}
      >
        <Typography color="white" mb={1}>
          动画状态: {stage}
        </Typography>
        <Button 
          variant="contained"
          onClick={handleTest}
          disabled={stage === 'shuffling' || stage === 'dealing'}
        >
          测试动画
        </Button>
        <Button
          variant="outlined"
          color="secondary"
          onClick={() => console.log('[DEBUG] 当前玩家位置信息:', playerPositions.length > 0 ? playerPositions : savedPositions)}
          sx={{ mt: 1, ml: 1 }}
        >
          打印位置信息
        </Button>
      </Box>
    );
  };
  
  // 渲染详细调试信息面板
  const renderDebugPanel = () => {
    if (!debug) return null;
    
    // 使用保存的位置数据或当前活跃的位置数据
    const positionsToUse = playerPositions.length > 0 ? playerPositions : savedPositions;
    
    // 获取当前行动玩家索引，用于显示在调试面板中
    const currentPlayerIdx = getCurrentPlayerIdx();
    
    return (
      <Box
        sx={{
          position: 'fixed', // 改为fixed确保在全屏模式下也能显示
          left: 20,
          bottom: 20,
          backgroundColor: 'rgba(0,0,0,0.8)',
          color: 'white',
          padding: 2,
          borderRadius: 1,
          zIndex: 2100,
          maxWidth: '400px',
          maxHeight: '300px',
          overflow: 'auto',
          pointerEvents: 'auto', // 允许与面板交互
        }}
      >
        <Typography variant="subtitle2" gutterBottom>
          发牌调试信息:
        </Typography>
        
        {positionsToUse.map((pos, idx) => (
          <Box key={`debug-${idx}`} sx={{ mb: 1, fontSize: '12px', fontFamily: 'monospace' }}>
            <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
              {pos.isActionPlayer ? '🎮' : pos.isCurrentUser ? '👤' : '👥'} {pos.username} (位置 {pos.logicalPosition}):
            </Typography>
            <Typography variant="caption" component="div">
              ┌ UI位置: {pos.uiPosition} (角度: {pos.angleDegrees}°)
            </Typography>
            <Typography variant="caption" component="div">
              ├ 坐标: x={pos.x.toFixed(0)}, y={pos.y.toFixed(0)}
            </Typography>
            <Typography variant="caption" component="div">
              └ 状态: {pos.isCurrentUser ? '当前用户' : ''} {pos.isActionPlayer ? '当前行动玩家' : ''}
            </Typography>
          </Box>
        ))}
        
        <Typography variant="caption" sx={{ display: 'block', mt: 1, fontStyle: 'italic' }}>
          动画阶段: {stage} | 玩家数: {positionsToUse.length} | 当前行动玩家: {currentPlayerIdx}
        </Typography>
      </Box>
    );
  };
  
  // 修改整个组件的渲染逻辑，确保debug面板始终显示
  // 当不活跃时，只渲染debug面板而不渲染动画元素
  if (!isActive && !testMode && !debug && !showMarkers) return null;
  
  // 只显示debug面板和位置标记，不显示动画
  if (!isActive && !testMode) {
    return (
      <>
        {/* 只渲染位置标记和调试面板 */}
        {showMarkers && (
          <Box
            sx={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              zIndex: 1800,
              pointerEvents: 'none',
            }}
          >
            {renderPositionMarkers()}
          </Box>
        )}
        {debug && renderDebugPanel()}
      </>
    );
  }
  
  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 1900,
        pointerEvents: 'none', // 允许点击穿透
        backgroundColor: testMode ? 'rgba(0,0,0,0.2)' : 'transparent', // 测试模式添加背景
      }}
    >
      {/* 洗牌动画 */}
      {(stage === 'shuffling' || stage === 'dealing') && renderDeck()}
      
      {/* 发牌动画 */}
      {renderDealingCards()}
      
      {/* 位置标记 - 始终显示 */}
      {showMarkers && renderPositionMarkers()}
      
      {/* 在测试模式下添加文字说明 */}
      {testMode && (
        <Box
          sx={{
            position: 'absolute',
            left: 20,
            top: 20,
            backgroundColor: 'rgba(0,0,0,0.7)',
            color: 'white',
            padding: 2,
            borderRadius: 1,
            zIndex: 2100,
            maxWidth: '300px',
            pointerEvents: 'auto', // 确保可以与文本交互
          }}
        >
          <Typography variant="body2" gutterBottom>
            调试信息：
          </Typography>
          <Typography variant="caption" component="div">
            • 绿色标记：当前玩家位置
          </Typography>
          <Typography variant="caption" component="div">
            • 红色标记：其他玩家位置
          </Typography>
          <Typography variant="caption" component="div">
            • 数字：玩家逻辑座位号
          </Typography>
          <Typography variant="caption" component="div">
            阶段：{stage}
          </Typography>
        </Box>
      )}
      
      {/* 详细调试信息面板 - 一直显示 */}
      {debug && renderDebugPanel()}
      
      {/* 测试控制区 */}
      {testMode && renderTestControls()}
    </Box>
  );
};

export default CardDealingAnimation; 