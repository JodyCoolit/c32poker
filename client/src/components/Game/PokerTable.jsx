import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Paper, Chip, Button } from '@mui/material';
import { styled } from '@mui/material/styles';
import PlayerCard from './PlayerCard';
import CommunityCards from './CommunityCards';
import PlayerActions from './PlayerActions';
import PotDisplay from './PotDisplay';
import { Person, Casino, AccessTime } from '@mui/icons-material';

// Styled components
const TableContainer = styled(Box)(({ theme }) => ({
  position: 'relative',
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  padding: theme.spacing(1),
  overflow: 'hidden',
}));

const TableSurface = styled(Paper)(({ theme }) => ({
  position: 'relative',
  width: '100%',
  height: '100%',
  maxWidth: '1600px',
  backgroundColor: '#076324',
  borderRadius: '50%',
  boxShadow: 'inset 0 0 20px rgba(0,0,0,0.6), 0 0 15px rgba(255,255,255,0.1)',
  border: '15px solid #5D4037',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1,
  [theme.breakpoints.down('md')]: {
    width: '100%',
    height: '100%',
  }
}));

const PlayerPositions = styled(Box)(({ theme }) => ({
  position: 'absolute',
  width: '100%',
  height: '100%',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  pointerEvents: 'none', // Allow clicking through this element
}));

const PlayerPosition = styled(Box)(({ position, theme }) => {
  // Calculate positions based on angles (40-degree intervals)
  // Position 0 is at bottom center (0 degrees)
  // Calculate angle in radians
  const getPositionFromAngle = (angle) => {
    // Table radius is considered 47% of the container size
    // to keep players just inside the table border
    const radius = '47%';
    const angleRad = (angle * Math.PI) / 180;
    const x = 50 + 47 * Math.sin(angleRad);
    const y = 50 - 47 * Math.cos(angleRad);
    
    return {
      left: `${x}%`,
      top: `${y}%`,
      transform: 'translate(-50%, -50%)',
    };
  };
  
  // Define angles for 8 positions (45-degree intervals)
  const angles = {
    0: 180,     // Bottom center
    1: 225,    // Bottom right
    2: 270,    // Right
    3: 315,   // Top right
    4: 0,   // Top
    5: 45,   // Top left
    6: 90,   // Left
    7: 135,   // Bottom left
  };
  
  const posStyle = getPositionFromAngle(angles[position]);
  
  return {
    position: 'absolute',
    pointerEvents: 'auto', // Make this element clickable
    zIndex: 5,
    ...posStyle,
    [theme.breakpoints.down('md')]: {
      transform: 'translate(-50%, -50%) scale(0.85)',
    },
    [theme.breakpoints.down('sm')]: {
      transform: 'translate(-50%, -50%) scale(0.7)',
    },
  };
});

const TableInfo = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: theme.spacing(2),
  left: theme.spacing(2),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
  zIndex: 10,
}));

const InfoChip = styled(Chip)(({ theme }) => ({
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  color: 'white',
  fontWeight: 'bold',
  backdropFilter: 'blur(4px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
}));

const ActionArea = styled(Box)(({ theme }) => ({
  position: 'absolute',
  bottom: theme.spacing(2),
  width: '100%',
  maxWidth: '600px',
  zIndex: 20,
  [theme.breakpoints.down('sm')]: {
    bottom: theme.spacing(1),
  }
}));

// 添加PlayerActionsContainer样式
const PlayerActionsContainer = styled(Box)(({ theme }) => ({
  position: 'absolute',
  bottom: '12%',
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 20,
  width: 'auto',
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(1),
  backdropFilter: 'blur(5px)',
  boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
  display: 'flex',
  justifyContent: 'center'
}));

/**
 * 扑克牌桌组件
 * 显示牌桌表面、公共牌和玩家操作界面
 */
const PokerTable = ({
  gameState = {},
  players = [],
  currentUser = '',
  communityCards = [],
  gamePhase = 'WAITING',
  status = 'waiting',  // 添加status参数
  pot = 0,
  currentBet = 0,
  dealerPosition = 0,
  roomName = 'Poker Room',
  blinds = { small: 0.5, big: 1 },
  turnPlayerId = '',
  onPlayerAction,
  onAddChips,
  onExitGame,
  loading = false,
}) => {
  // Find user's player object
  const userPlayer = players.find(player => 
    player.username === currentUser.username || player.id === currentUser.id
  );
  
  // Check if current user is the room owner
  const isRoomOwner = (
    // 直接检查currentUser与房主是否匹配
    currentUser === gameState.owner || 
    // 检查用户对象与房主是否匹配
    (currentUser && gameState.owner && 
     (currentUser.username === gameState.owner || 
      currentUser.name === gameState.owner)
    ) ||
    // 检查玩家列表中是否有标记为房主的当前用户
    players.some(p => 
      (p.isOwner === true || p.owner === true) && 
      (p.username === currentUser || p.username === currentUser.username || 
       p.name === currentUser || p.name === currentUser.username)
    )
  );
  
  // Check if we have enough players to start
  const playersWithChips = players.filter(p => p.chips > 0 || p.buyIn > 0);
  const hasEnoughPlayers = playersWithChips.length >= 2;
  
  // 从游戏状态中提取游戏阶段，考虑可能的嵌套结构
  const extractedGamePhase = 
    // 首先检查直接的gamePhase属性
    gameState.gamePhase || 
    // 然后检查game_phase属性
    gameState.game_phase || 
    // 检查嵌套的game对象中的game_phase属性
    (gameState.game && gameState.game.game_phase) || 
    // 最后使用传入的gamePhase参数
    gamePhase;
  
  // 判断游戏是否已经开始
  const isGameStarted = status === 'playing' || 
    gameState.isGameStarted ||
    ['PRE_FLOP', 'FLOP', 'TURN', 'RIVER', 'SHOWDOWN', 'DRAW'].includes(extractedGamePhase);
  
  // Determine if it's the user's turn
  const isUserTurn = userPlayer && turnPlayerId === userPlayer.id;
  
  // Get user's seat index
  const userSeatIndex = userPlayer ? players.indexOf(userPlayer) : -1;
  
  // Check if user can perform actions
  const canCheck = isUserTurn && (currentBet === 0 || (userPlayer.bet && userPlayer.bet >= currentBet));
  const canCall = isUserTurn && currentBet > 0 && (!userPlayer.bet || userPlayer.bet < currentBet);
  const canRaise = isUserTurn && userPlayer.chips > 0 && extractedGamePhase !== 'GAME_OVER';
  
  // Handle player actions
  const handleCheck = useCallback(() => {
    onPlayerAction('check');
  }, [onPlayerAction]);
  
  const handleCall = useCallback(() => {
    onPlayerAction('call');
  }, [onPlayerAction]);
  
  const handleRaise = useCallback((amount) => {
    onPlayerAction('raise', amount);
  }, [onPlayerAction]);
  
  const handleFold = useCallback(() => {
    onPlayerAction('fold');
  }, [onPlayerAction]);
  
  const handleAllIn = useCallback(() => {
    onPlayerAction('all-in', userPlayer?.chips || 0);
  }, [onPlayerAction, userPlayer]);
  
  const handleStartGame = useCallback(() => {
    onPlayerAction('start_game');
  }, [onPlayerAction]);

  return (
    <TableContainer>
      <TableSurface>
        {/* Game phase indicator */}
        <Typography
          sx={{
            position: 'absolute',
            top: 5,
            left: 5, 
            fontSize: '12px', 
            color: '#fff', 
            backgroundColor: 'rgba(0,0,0,0.5)', 
            padding: '2px 5px',
            borderRadius: '3px',
            zIndex: 10
          }}
        >
          Game Phase: {extractedGamePhase || 'undefined'}
        </Typography>
        
        {/* Game information box - always present */}
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            zIndex: 5,
            padding: 3,
            backgroundColor: 'rgba(0,0,0,0.7)',
            borderRadius: 2,
            backdropFilter: 'blur(5px)',
            boxShadow: '0 0 20px rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.1)',
            minWidth: '280px',
          }}
        >
          {/* Waiting content only shown when gamePhase is WAITING and status is not playing */}
          {extractedGamePhase === 'WAITING' && status !== 'playing' && (
            <>
              <Typography variant="h6" sx={{ color: 'white', mb: 1, fontWeight: 'bold' }}>
                等待游戏开始...
              </Typography>
              
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 1, textAlign: 'center' }}>
                {hasEnoughPlayers 
                  ? '已有足够的玩家，可以开始游戏' 
                  : '需要至少2名玩家才能开始游戏'}
              </Typography>
              
              {/* Show player count */}
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 1 }}>
                当前玩家: {playersWithChips.length}/8
              </Typography>
              
              {/* Only show start button to the room owner */}
              {isRoomOwner && (
                <Button 
                  variant="contained" 
                  color="primary" 
                  size="large"
                  disabled={!hasEnoughPlayers || loading}
                  onClick={handleStartGame}
                  sx={{ 
                    fontWeight: 'bold',
                    px: 4, 
                    py: 1.5,
                    fontSize: '1.1rem',
                    mt: 2,
                    animation: hasEnoughPlayers ? 'pulse 1.5s infinite' : 'none',
                    '@keyframes pulse': {
                      '0%': { boxShadow: '0 0 0 0 rgba(25, 118, 210, 0.7)' },
                      '70%': { boxShadow: '0 0 0 10px rgba(25, 118, 210, 0)' },
                      '100%': { boxShadow: '0 0 0 0 rgba(25, 118, 210, 0)' }
                    }
                  }}
                >
                  开始游戏
                </Button>
              )}
            </>
          )}
          
          {/* Game content shown when game is in progress - 同时检查status和gamePhase */}
          {isGameStarted && (
            <>
              {/* CommunityCards component will decide whether to render based on gamePhase */}
              <CommunityCards 
                communityCards={communityCards} 
                gamePhase={extractedGamePhase}
                potAmount={pot}
                status={status}
              />
              
            </>
          )}
        </Box>
        
        {/* 添加PlayerActions - 只在游戏进行中显示 */}
        {isGameStarted && userPlayer && isUserTurn && (
          <PlayerActionsContainer>
            <PlayerActions
              isUserTurn={isUserTurn}
              playerChips={userPlayer.chips || 0}
              minBet={blinds.big}
              currentBet={currentBet}
              pot={pot}
              canCheck={canCheck}
              canRaise={canRaise}
              canCall={canCall}
              loading={loading}
              onCheck={handleCheck}
              onCall={handleCall}
              onRaise={handleRaise}
              onFold={handleFold}
              onAllIn={handleAllIn}
            />
          </PlayerActionsContainer>
        )}
        
      </TableSurface>
    </TableContainer>
  );
};

export default PokerTable; 