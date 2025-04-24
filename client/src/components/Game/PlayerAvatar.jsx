import React from 'react';
import { Box, Avatar, Typography, Badge, Chip } from '@mui/material';
import { styled } from '@mui/material/styles';

// 自定义样式组件
const PlayerContainer = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'active' && prop !== 'folded'
})(({ theme, active = false, folded = false }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  position: 'relative',
  opacity: folded ? 0.6 : 1,
  transition: 'all 0.3s ease',
  transform: active ? 'scale(1.05)' : 'scale(1)',
  '&::after': active ? {
    content: '""',
    position: 'absolute',
    top: '-3px',
    left: '-3px',
    right: '-3px',
    bottom: '-3px',
    border: `2px solid ${theme.palette.primary.main}`,
    borderRadius: '50%',
    animation: 'pulse 1.5s infinite'
  } : {},
  '@keyframes pulse': {
    '0%': {
      transform: 'scale(1)',
      opacity: 1
    },
    '50%': {
      transform: 'scale(1.1)',
      opacity: 0.7
    },
    '100%': {
      transform: 'scale(1)',
      opacity: 1
    }
  }
}));

const StyledAvatar = styled(Avatar, {
  shouldForwardProp: (prop) => prop !== 'dealer' && prop !== 'isowner'
})(({ theme, dealer = false, isowner = false }) => ({
  width: 36,
  height: 36,
  border: isowner 
    ? `2px solid ${theme.palette.warning.main}` 
    : dealer 
      ? `2px solid ${theme.palette.info.main}` 
      : `2px solid ${theme.palette.primary.main}`,
  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
}));

const PlayerName = styled(Typography)({
  fontSize: '0.8rem',
  fontWeight: 'bold',
  width: '100%',
  textAlign: 'center',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: '70px'
});

const ChipsDisplay = styled(Typography)(({ theme }) => ({
  fontSize: '0.7rem',
  backgroundColor: theme.palette.primary.main,
  color: '#ffffff',
  padding: '1px 5px',
  borderRadius: '8px',
  marginTop: '2px'
}));

const ActionChip = styled(Chip)(({ theme, actionType }) => {
  const actionColors = {
    fold: theme.palette.error.light,
    check: theme.palette.info.light,
    call: theme.palette.success.light,
    raise: theme.palette.warning.light,
    allIn: theme.palette.error.main,
    default: theme.palette.grey[500]
  };
  
  return {
    position: 'absolute',
    top: '-8px',
    right: '-8px',
    fontSize: '0.65rem',
    height: '18px',
    backgroundColor: actionColors[actionType] || actionColors.default,
    color: '#ffffff'
  };
});

const DealerBadge = styled(Box)(({ theme }) => ({
  position: 'absolute',
  bottom: '0',
  right: '-8px',
  backgroundColor: theme.palette.info.main,
  color: '#ffffff',
  borderRadius: '50%',
  width: '16px',
  height: '16px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.65rem',
  fontWeight: 'bold'
}));

const PositionBadge = styled(Box)(({ theme }) => ({
  position: 'absolute',
  bottom: '0',
  left: '-8px',
  backgroundColor: theme.palette.secondary.main,
  color: '#ffffff',
  borderRadius: '50%',
  width: '16px',
  height: '16px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.65rem',
  fontWeight: 'bold'
}));

/**
 * 玩家头像组件
 * @param {Object} player - 玩家信息对象
 * @param {boolean} active - 是否为活跃玩家（当前行动轮到的玩家）
 * @param {boolean} dealer - 是否为庄家
 * @param {boolean} folded - 是否已弃牌
 * @param {boolean} isOwner - 是否为房间所有者
 * @param {string} position - 位置标识（SB, BB等）
 * @param {string} lastAction - 上一次行动（fold, check, call, raise, allIn）
 * @param {string} onClick - 点击头像的回调函数
 */
const PlayerAvatar = ({ 
  player, 
  active = false, 
  dealer = false, 
  folded = false, 
  isOwner = false,
  position = '', 
  lastAction = '', 
  onClick 
}) => {
  // 如果没有玩家数据，不渲染
  if (!player) return null;
  
  // 将动作类型映射为显示文本
  const getActionText = (action) => {
    const actionMap = {
      'fold': '弃牌',
      'check': '过牌',
      'call': '跟注',
      'raise': '加注',
      'allIn': '全押',
      'bet': '下注'
    };
    return actionMap[action] || action;
  };
  
  // 将位置代码映射为显示文本
  const getPositionText = (pos) => {
    const posMap = {
      'SB': 'SB',
      'BB': 'BB',
      'UTG': 'UTG',
      'MP': 'MP',
      'CO': 'CO',
      'BTN': 'BTN'
    };
    return posMap[pos] || pos;
  };
  
  return (
    <PlayerContainer active={active} folded={folded} onClick={onClick}>
      <StyledAvatar 
        src={player.avatar} 
        alt={player.username} 
        dealer={dealer}
        isowner={isOwner ? 1 : 0} // 将boolean转为数字，避免prop警告
      >
        {player.username ? player.username.charAt(0).toUpperCase() : '?'}
      </StyledAvatar>
      
      <PlayerName variant="body2">
        {player.username || '玩家'}
      </PlayerName>
      
      <ChipsDisplay>
        {player.chips ? `{player.chips} BB` : '0 BB'}
      </ChipsDisplay>
      
      {lastAction && (
        <ActionChip 
          label={getActionText(lastAction)} 
          actionType={lastAction}
          size="small"
        />
      )}
      
      {dealer && (
        <DealerBadge>D</DealerBadge>
      )}
      
      {position && (
        <PositionBadge>{getPositionText(position)}</PositionBadge>
      )}
    </PlayerContainer>
  );
};

export default PlayerAvatar; 