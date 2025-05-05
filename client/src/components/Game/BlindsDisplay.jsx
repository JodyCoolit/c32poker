import React from 'react';
import { Box, Typography, Chip, Tooltip } from '@mui/material';
import { styled } from '@mui/material/styles';
import GroupIcon from '@mui/icons-material/Group';
import PersonIcon from '@mui/icons-material/Person';
import CasinoIcon from '@mui/icons-material/Casino';
import PropTypes from 'prop-types';

const BlindsContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(0.5, 1.5),
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  borderRadius: theme.shape.borderRadius,
  color: '#fff'
}));

const RoomName = styled(Typography)(({ theme }) => ({
  fontWeight: 'bold',
  fontSize: '1rem',
  marginRight: theme.spacing(1),
  color: theme.palette.common.white
}));

const RoomId = styled(Typography)(({ theme }) => ({
  fontSize: '0.85rem',
  color: theme.palette.grey[300],
  marginRight: theme.spacing(1.5),
}));

const BlindChip = styled(Chip, {
  shouldForwardProp: (prop) => prop !== 'blindType'
})(({ theme, blindType }) => ({
  backgroundColor: blindType === 'small' ? theme.palette.info.dark : theme.palette.warning.dark,
  color: '#fff',
  fontSize: '0.75rem',
  height: '24px'
}));

const PlayerCountChip = styled(Chip)(({ theme }) => ({
  backgroundColor: theme.palette.success.dark,
  color: '#fff',
  fontSize: '0.75rem',
  height: '24px',
  marginLeft: theme.spacing(1)
}));

const OwnerChip = styled(Chip)(({ theme }) => ({
  backgroundColor: theme.palette.secondary.dark,
  color: '#fff',
  fontSize: '0.75rem',
  height: '24px'
}));

/**
 * 盲注显示组件
 * @param {number} smallBlind - 小盲注
 * @param {number} bigBlind - 大盲注
 * @param {string} roomName - 房间名称
 * @param {string} roomId - 房间ID
 * @param {Array} players - 玩家列表
 * @param {string} owner - 房间拥有者用户名
 */
const BlindsDisplay = ({ 
  smallBlind = 0.5, 
  bigBlind = 1, 
  roomName = '', 
  roomId = '',
  players = [],
  owner = ''
}) => {
  // 计算就绪玩家数量（有座位且筹码数大于0，或者游戏状态为playing）
  const readyPlayersCount = players.filter(player => {
    // 检查是否有座位（不同的API可能用不同的属性名）
    const hasSeat = player.seat !== undefined || 
                   player.position !== undefined || 
                   player.seat_id !== undefined;
    
    // 检查是否有足够筹码
    const hasChips = player.chips > 0;
    
    // 检查是否处于游戏中状态
    const isPlaying = player.status === 'playing' || 
                     player.isPlaying === true || 
                     player.inGame === true;
    
    // 玩家就绪条件：有座位且有筹码，或者正在游戏中
    return (hasSeat && hasChips) || isPlaying;
  }).length;
  
  const getPlayerCountColor = (ready, total) => {
    if (ready === 0) return 'error.dark';
    if (ready < 2) return 'warning.dark';
    return 'success.dark';
  };
  
  const playerCountColor = getPlayerCountColor(readyPlayersCount, players.length);
  
  return (
    <BlindsContainer>
      <Box display="flex" alignItems="center">
        {roomName ? (
          <Tooltip title="房间名称" arrow>
            <RoomName variant="h6">
              {roomName}
            </RoomName>
          </Tooltip>
        ) : null}
        {roomId && (
          <Tooltip title="房间ID" arrow>
            <RoomId>
              {roomName ? `ID: ${roomId}` : `房间: ${roomId}`}
            </RoomId>
          </Tooltip>
        )}
      </Box>
      <Tooltip title="小盲/大盲" arrow>
        <BlindChip 
          label={`${smallBlind.toFixed(1)}/${bigBlind.toFixed(1)} BB`}
          size="small"
          blindType="big"
          icon={<CasinoIcon style={{ fontSize: '14px' }} />}
        />
      </Tooltip>
      {owner && (
        <Tooltip title="房主" arrow>
          <OwnerChip
            label={`房主: ${owner}`}
            size="small"
            icon={<PersonIcon style={{ fontSize: '14px' }} />}
          />
        </Tooltip>
      )}
      <Tooltip title="就绪玩家/总人数 (就绪玩家指有座位且筹码大于0，或正在游戏中的玩家)" arrow>
        <PlayerCountChip
          label={`${readyPlayersCount}/${players.length}`}
          size="small"
          icon={<GroupIcon style={{ fontSize: '14px' }} />}
          sx={{ backgroundColor: (theme) => theme.palette[playerCountColor] }}
        />
      </Tooltip>
    </BlindsContainer>
  );
};

BlindsDisplay.propTypes = {
  smallBlind: PropTypes.number,
  bigBlind: PropTypes.number,
  roomName: PropTypes.string,
  roomId: PropTypes.string,
  players: PropTypes.array,
  owner: PropTypes.string
};

export default BlindsDisplay; 