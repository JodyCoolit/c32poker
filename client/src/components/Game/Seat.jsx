import React from 'react';
import { styled } from '@mui/material/styles';
import { Paper, Typography, Button, Avatar } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import Player from './Player';

// Calculate position based on angle
const calculatePosition = (angle, radius) => {
  const radian = (angle * Math.PI) / 180;
  // 使用与PokerTable.jsx相同的计算方法
  const x = 50 + radius * Math.sin(radian);
  const y = 50 - radius * Math.cos(radian);
  return { x, y };
};

// Define seat positions by angle (degrees)
// 修改角度定义，使其与PokerTable.jsx一致
// 座位0位于底部中心(0度)，然后顺时针排列
const seatAngles = [180, 225, 270, 315, 0, 45, 90, 135];

// Styled components
const SeatContainer = styled('div')(({ position }) => {
  // UI位置(position)总是0-7，对应seatAngles中的角度位置
  const { x, y } = calculatePosition(seatAngles[position], 40);
  // 对于顶部位置(position=0，角度=180)，稍微下移一点以便留出更多空间给庄家图标和思考条
  const adjustedY = seatAngles[position] === 180 ? y + 5 : y;
  return {
    position: 'absolute',
    left: `${x}%`,
    top: `${adjustedY}%`,
    transform: 'translate(-50%, -50%)',
    zIndex: 10,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100px',
  };
});

const EmptySeatButton = styled(Button)({
  borderRadius: '50%',
  minWidth: '60px',
  height: '60px',
  backgroundColor: 'rgba(255, 255, 255, 0.15)',
  color: 'white',
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
});

const Seat = ({ 
  seatData, 
  onSitDown, 
  onBuyIn, 
  onStandUp, 
  onChangeSeat,
  isYourTurn,
  currentUser,
  showCards = false,
  gameState,
  turnTimeRemaining = 30,
  turnTimeLimit = 30
}) => {
  // 使用UI位置(position)来定位座位，但使用逻辑位置(realPosition)与服务器通信
  const handlePlayerClick = () => {
    // If this is the current user's seat
    if (seatData.player?.username === currentUser || seatData.player?.name === currentUser) {
      onStandUp();
    } else if (seatData.player) {
      // If seat is occupied by another player
      console.log('Clicked on player:', seatData.player);
    } else {
      // If seat is empty, handle sit down
      // 这里传入UI位置，让GameTable组件去找到对应的逻辑位置
      onSitDown(seatData.position);
    }
  };

  
  // 显示逻辑位置标签（调试用）
  const debugMode = false;

  return (
    <>
      <SeatContainer position={seatData.position}>
        {seatData.player ? (
          // 使用Player组件来显示玩家信息和手牌
          <Player 
            player={seatData.player}
            isCurrentPlayer={seatData.isCurrentUser}
            isDealer={seatData.isDealer}
            isActive={
              // 玩家激活条件：
              // 1. 该玩家的逻辑位置(realPosition)等于当前行动玩家索引
              seatData.realPosition === seatData.currentPlayerIdx ||
              // 2. 原有的活跃判断条件
              seatData.isActive || 
              // 3. 当前轮到该用户行动
              (isYourTurn && (seatData.player?.username === currentUser || seatData.player?.name === currentUser))
            }
            showCards={showCards || seatData.isCurrentUser}
            betAmount={seatData.betAmount}
            lastAction={seatData.lastAction}
            onClick={handlePlayerClick}
            hasHand={seatData.gameStarted || seatData.player?.hasHand || seatData.inActiveGame}
            gameState={gameState}
            turnTimeRemaining={seatData.turnTimeRemaining || turnTimeRemaining}
            turnTimeLimit={seatData.turnTimeLimit || turnTimeLimit}
          />
        ) : (
          <EmptySeatButton onClick={() => onSitDown(seatData.position)}>
            <Typography variant="caption" sx={{ fontSize: '0.7rem', lineHeight: 1.2, mb: 0.5 }}>
              空座位
              {debugMode && ` (${seatData.realPosition})`}
            </Typography>
            <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.7)' }}>
              点击入座
            </Typography>
          </EmptySeatButton>
        )}
      </SeatContainer>
    </>
  );
};

export default Seat; 