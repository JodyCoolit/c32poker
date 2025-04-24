import React, { useMemo } from 'react';
import { Box, Paper, Typography, Avatar, Chip } from '@mui/material';
import { styled } from '@mui/material/styles';
import PlayingCard from './PlayingCard';
import './PlayerCard.css';
import Card from './Card';
import { getTranslatedActionName } from '../../utils/gameUtils';

// 玩家卡片容器 - 使用 shouldForwardProp 过滤掉自定义属性
const PlayerContainer = styled(Paper, {
  shouldForwardProp: (prop) => prop !== 'isActive' && prop !== 'isCurrent'
})(({ theme, isActive, isCurrent }) => ({
  padding: theme.spacing(1.5),
  borderRadius: theme.spacing(1),
  width: '180px',
  height: '120px',
  display: 'flex',
  flexDirection: 'column',
  position: 'relative',
  border: isActive ? `2px solid ${theme.palette.primary.main}` : isCurrent ? `2px solid ${theme.palette.success.main}` : `1px solid ${theme.palette.divider}`,
  boxShadow: isActive ? theme.shadows[8] : theme.shadows[2],
  transition: 'all 0.3s ease',
  backgroundColor: theme.palette.background.paper,
  overflow: 'hidden',
  
  [theme.breakpoints.down('sm')]: {
    width: '150px',
    height: '100px',
    padding: theme.spacing(1),
  },
}));

// 玩家信息行
const PlayerInfoRow = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  marginBottom: '8px',
});

// 玩家卡片下方
const PlayerCardBottom = styled(Box)({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-end',
  marginTop: 'auto',
  width: '100%',
});

// 卡片容器
const CardsContainer = styled(Box)({
  display: 'flex',
  gap: '4px',
});

// 玩家状态标签 - 使用 shouldForwardProp 过滤掉自定义属性
const StatusLabel = styled(Chip, {
  shouldForwardProp: (prop) => prop !== 'statusType'
})(({ theme, statusType }) => {
  const statusColors = {
    dealer: theme.palette.info.main,
    smallBlind: theme.palette.warning.light,
    bigBlind: theme.palette.warning.main,
    folded: theme.palette.error.light,
    winner: theme.palette.success.main,
    allIn: theme.palette.error.main,
    default: theme.palette.grey[500],
  };
  
  return {
    position: 'absolute',
    top: '4px',
    right: '4px',
    height: '20px',
    fontSize: '0.65rem',
    backgroundColor: statusColors[statusType] || statusColors.default,
    color: '#fff',
  };
});

// 计时器容器 - 使用 shouldForwardProp 过滤掉自定义属性
const TimerContainer = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'timePercentage'
})(({ theme, timePercentage }) => ({
  position: 'absolute',
  bottom: 0,
  left: 0,
  width: `${timePercentage}%`,
  height: '4px',
  backgroundColor: timePercentage < 30 ? theme.palette.error.main : timePercentage < 70 ? theme.palette.warning.main : theme.palette.success.main,
}));

/**
 * 玩家卡片组件
 * @param {Object} props
 * @param {Object} props.player - 玩家数据对象
 * @param {string} props.player.id - 玩家ID
 * @param {string} props.player.name - 玩家名称
 * @param {number} props.player.chips - 玩家筹码数量
 * @param {Array} props.player.cards - 玩家手牌 ["2H", "AS"]
 * @param {number} props.player.bet - 当前下注金额
 * @param {string} props.player.status - 玩家状态（playing, folded, allIn, etc.）
 * @param {boolean} props.player.isDealer - 是否是庄家
 * @param {boolean} props.player.isSmallBlind - 是否是小盲
 * @param {boolean} props.player.isBigBlind - 是否是大盲
 * @param {boolean} props.isCurrentUser - 是否是当前用户
 * @param {boolean} props.isTurn - 是否是该玩家的回合
 * @param {boolean} props.showCards - 是否显示手牌（只有在摊牌阶段或是当前玩家时才显示）
 * @param {number} props.timeLeft - 剩余时间（秒）
 * @param {number} props.timeTotal - 总时间（秒）
 */
const PlayerCard = ({ 
  player, 
  isCurrentUser = false, 
  isTurn = false, 
  showCards = false,
  timeLeft = 0,
  timeTotal = 30,
  onDealerButtonClick,
  lastAction,
  gamePhase,
  gameStarted,
  dealer,
  mySeatIndex
}) => {
  if (!player) return null;
  
  const { 
    name, 
    chips, 
    cards = [], 
    bet = 0, 
    status, 
    isDealer, 
    isSmallBlind, 
    isBigBlind 
  } = player;
  
  // 确定是否是当前用户
  const isMe = isCurrentUser; 

  // 辅助函数：格式化显示筹码数量
  const formatChips = (chips) => {
    if (chips === undefined || chips === null) return '';
    
    if (chips >= 1000) {
      return `${(chips / 1000).toFixed(1)}K`;
    }
    return chips.toString();
  };
  
  // 计算玩家的盈亏情况
  const calculateProfit = useMemo(() => {
    if (!player) return null;
    
    // 取初始筹码 (优先使用initialChips，兼容initial_chips属性名)
    const initialChips = player.initialChips !== undefined 
      ? player.initialChips 
      : (player.initial_chips !== undefined ? player.initial_chips : null);
    
    // 取当前筹码 (优先使用chips，兼容stack属性名)
    const currentChips = player.chips !== undefined 
      ? player.chips 
      : (player.stack !== undefined ? player.stack : null);
    
    // 如果初始筹码或当前筹码任一不存在，无法计算盈亏
    if (initialChips === null || currentChips === null) {
      console.log(`玩家${player.name || player.username}缺少筹码信息:`, 
        `初始筹码=${initialChips}`, 
        `当前筹码=${currentChips}`);
      return null;
    }
    
    // 计算盈亏值
    const profit = currentChips - initialChips;
    
    // 返回盈亏信息对象
    return {
      value: profit,
      isPositive: profit > 0,
      isNegative: profit < 0,
      display: profit > 0 ? `+${formatChips(profit)}` : formatChips(profit)
    };
  }, [player]);
  
  // 计算玩家状态标签
  const getStatusLabel = () => {
    if (isDealer) return { label: '庄家', status: 'dealer' };
    if (isSmallBlind) return { label: '小盲', status: 'smallBlind' };
    if (isBigBlind) return { label: '大盲', status: 'bigBlind' };
    if (status === 'folded') return { label: '弃牌', status: 'folded' };
    if (status === 'allIn') return { label: '全押', status: 'allIn' };
    if (status === 'winner') return { label: '赢家', status: 'winner' };
    return null;
  };
  
  const statusInfo = getStatusLabel();
  
  // 计算计时器百分比
  const timePercentage = timeTotal > 0 ? (timeLeft / timeTotal) * 100 : 0;
  
  // 获取动作描述 (根据玩家最后操作)
  const getActionDescription = () => {
    if (!lastAction) return '';
    
    const translatedAction = getTranslatedActionName(lastAction.action);
    
    if (lastAction.action === 'bet' || lastAction.action === 'raise') {
      return `${translatedAction} ${lastAction.amount}`;
    }
    
    return translatedAction;
  };
  
  // 构造样式类名
  const playerCardClasses = [
    'player-card',
    isCurrentUser ? 'player-card--current' : '',
    isMe ? 'player-card--self' : '',
    player.folded ? 'player-card--folded' : ''
  ].filter(Boolean).join(' ');
  
  // 判断是否显示让牌按钮 (只有庄家位置显示)
  const showDealerButton = dealer === player.seatIndex || dealer === player.seat_index;

  return (
    <PlayerContainer isActive={isTurn} isCurrent={isCurrentUser}>
      {/* 玩家状态标签 */}
      {statusInfo && (
        <StatusLabel 
          label={statusInfo.label} 
          statusType={statusInfo.status}
          size="small"
        />
      )}
      
      {/* 玩家信息 */}
      <PlayerInfoRow>
        <Box display="flex" alignItems="center">
          <Avatar 
            sx={{ 
              width: 36, 
              height: 36, 
              marginRight: 1,
              bgcolor: isCurrentUser ? 'primary.main' : 'grey.500'
            }}
          >
            {name ? name.charAt(0).toUpperCase() : '?'}
          </Avatar>
          <Typography variant="body2" noWrap sx={{ maxWidth: '100px' }}>
            {name || 'Unknown'}
          </Typography>
        </Box>
        <Chip 
          label={`$${chips}`} 
          size="small" 
          color={chips > 0 ? "primary" : "default"}
          sx={{ height: '20px', fontSize: '0.75rem' }}
        />
      </PlayerInfoRow>
      
      {/* 玩家下注信息 */}
      {bet > 0 && (
        <Box display="flex" justifyContent="center" mb={1}>
          <Chip 
            label={`已下注: $${bet}`} 
            size="small" 
            color="secondary"
            sx={{ height: '20px', fontSize: '0.75rem' }}
          />
        </Box>
      )}
      
      {/* 底部显示手牌 */}
      <PlayerCardBottom>
        <CardsContainer>
          {cards.length > 0 ? (
            cards.map((card, index) => (
              <PlayingCard 
                key={index} 
                card={card} 
                faceUp={showCards || isCurrentUser}
              />
            ))
          ) : (
            <>
              <PlayingCard faceUp={false} />
              <PlayingCard faceUp={false} />
            </>
          )}
        </CardsContainer>
      </PlayerCardBottom>
      
      {/* 计时器 */}
      {isTurn && timeTotal > 0 && (
        <TimerContainer timePercentage={timePercentage} />
      )}
      
      {/* 显示庄家按钮 */}
      {showDealerButton && (
        <div 
          className="dealer-button" 
          onClick={() => onDealerButtonClick && onDealerButtonClick(player.seatIndex || player.seat_index)}
        >
          D
        </div>
      )}
      
      {/* 显示玩家盈亏情况 */}
      {calculateProfit && (
        <div className={`player-profit ${calculateProfit.isPositive ? 'positive' : ''} ${calculateProfit.isNegative ? 'negative' : ''}`}>
          {calculateProfit.display}
        </div>
      )}
      
      {/* 玩家操作区域 */}
      <div className="player-action-area">
        {lastAction && (
          <div className="player-action">{getActionDescription()}</div>
        )}
      </div>
    </PlayerContainer>
  );
};

export default PlayerCard; 