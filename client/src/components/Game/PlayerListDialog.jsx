import React from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button,
  Typography,
  Box,
  Grid,
  Avatar,
  Chip,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Divider
} from '@mui/material';

// 图标
import PersonIcon from '@mui/icons-material/Person';
import StarIcon from '@mui/icons-material/Star';
import ChairIcon from '@mui/icons-material/Chair';
import CasinoIcon from '@mui/icons-material/Casino';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';

/**
 * 玩家列表对话框组件
 * @param {boolean} open - 对话框是否打开
 * @param {function} onClose - 关闭对话框回调
 * @param {Array} players - 玩家数组
 * @param {Object} room - 房间信息
 * @param {string} currentUser - 当前用户名
 */
const PlayerListDialog = ({ 
  open, 
  onClose, 
  players = [],
  room = {},
  currentUser = ''
}) => {
  
  // 获取玩家状态文本
  const getPlayerStatusText = (player) => {
    if (!player) return '';
    
    // 首先检查显式标志
    if (player.isPlaying) {
      return '游戏中';
    } else if (player.isSitting) {
      return '已入座';
    }
    
    // 如果没有明确的标志，则基于位置判断
    const hasPosition = player.position !== undefined && player.position >= 0;
    if (hasPosition) {
      // 如果玩家有位置但没有isPlaying标志，且游戏状态是"playing"，则可能在游戏中
      if (player.status === 'playing' || player.inGame) {
        return '游戏中';
      }
      return '已入座';
    }
    
    // 默认为观察状态
    return '观察中';
  };
  
  // 获取状态颜色
  const getStatusColor = (status) => {
    switch (status) {
      case '游戏中':
        return 'success';
      case '已入座':
        return 'primary';
      case '观察中':
        return 'default';
      default:
        return 'default';
    }
  };
  
  // 判断是否是房主
  const isOwner = (playerName) => {
    if (!playerName || !room.owner) return false;
    
    // 尝试不同格式的比较，避免格式差异导致的不匹配
    return (
      playerName === room.owner || 
      playerName.toLowerCase() === room.owner.toLowerCase() ||
      playerName.trim() === room.owner.trim()
    );
  };
  
  // 排序玩家列表
  const sortedPlayers = [...players].sort((a, b) => {
    // 按状态排序：游戏中 > 已入座 > 观察中
    const statusA = a.isPlaying ? 3 : (a.isSitting ? 2 : 1);
    const statusB = b.isPlaying ? 3 : (b.isSitting ? 2 : 1);
    
    if (statusA !== statusB) {
      return statusB - statusA;
    }
    
    // 房主排前面
    if (isOwner(a.name) !== isOwner(b.name)) {
      return isOwner(a.name) ? -1 : 1;
    }
    
    // 按筹码量排序
    return (b.chips || 0) - (a.chips || 0);
  });
  
  sortedPlayers.forEach((player, index) => {
    const status = getPlayerStatusText(player);
    const isOwnerFlag = isOwner(player.name || player.username);
  });

  // 获取盈亏颜色
  const getProfitColor = (profit) => {
    if (profit > 0) return 'success.main';
    if (profit < 0) return 'error.main';
    return 'text.secondary';
  };

  // 获取盈亏图标
  const getProfitIcon = (profit) => {
    if (profit > 0) return <TrendingUpIcon fontSize="small" sx={{ color: 'success.main' }} />;
    if (profit < 0) return <TrendingDownIcon fontSize="small" sx={{ color: 'error.main' }} />;
    return <CompareArrowsIcon fontSize="small" sx={{ color: 'text.secondary' }} />;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">玩家列表</Typography>
          <Typography variant="subtitle2" color="text.secondary">
            {players.length} 位玩家
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        {/* 房间信息 */}
        <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>房间信息</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={4}>
              <Typography variant="body2" color="text.secondary">
                房间名称: {room.name || 'N/A'}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Typography variant="body2" color="text.secondary">
                房主: {room.owner || 'N/A'} 
                {currentUser === room.owner && ' (你)'}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Typography variant="body2" color="text.secondary">
                盲注: {room.smallBlind || 0}/{room.bigBlind || 0} BB
              </Typography>
            </Grid>
          </Grid>
        </Paper>
        
        <Divider sx={{ my: 2 }} />
        
        {/* 玩家表格 */}
        <TableContainer component={Paper}>
          <Table aria-label="player list table">
            <TableHead>
              <TableRow>
                <TableCell>玩家</TableCell>
                <TableCell align="center">状态</TableCell>
                <TableCell align="center">位置</TableCell>
                <TableCell align="right">买入</TableCell>
                <TableCell align="right">筹码</TableCell>
                <TableCell align="right">待处理</TableCell>
                <TableCell align="right">盈亏</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedPlayers.map((player) => {
                const status = getPlayerStatusText(player);
                const playerName = player.name || player.username;
                const isCurrentUser = playerName === currentUser ||
                                    playerName?.toLowerCase() === currentUser?.toLowerCase();
                
                // 计算盈亏 (取初始筹码与当前筹码差值)
                // 使用优先级：total_buy_in > _original_buy_in > 0
                const totalBuyIn = player.total_buy_in !== undefined ? Number(player.total_buy_in) : undefined;
                const initialBuyIn = totalBuyIn !== undefined ? 
                                  totalBuyIn : 
                                  (player._original_buy_in || 0);
                const currentChips = player.chips || 0;
                const displayBuyIn = initialBuyIn; // 显示买入值
                const profit = currentChips - initialBuyIn; // 计算正确的盈亏
                
                return (
                  <TableRow 
                    key={player.name || player.username}
                    sx={{ 
                      '&:last-child td, &:last-child th': { border: 0 },
                      bgcolor: isCurrentUser ? 'rgba(0, 0, 0, 0.04)' : 'inherit'
                    }}
                    hover
                  >
                    <TableCell component="th" scope="row">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar sx={{ bgcolor: isCurrentUser ? 'primary.main' : 'grey.400' }}>
                          <PersonIcon />
                        </Avatar>
                        <Box>
                          <Typography variant="body2">
                            {player.name || player.username} {isCurrentUser && '(你)'}
                          </Typography>
                          {isOwner(player.name || player.username) && (
                            <Chip 
                              icon={<StarIcon />} 
                              label="房主" 
                              size="small" 
                              variant="outlined" 
                              color="warning"
                              sx={{ mt: 0.5 }}
                            />
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Chip 
                        label={status} 
                        size="small" 
                        color={getStatusColor(status)} 
                        variant={player.isPlaying ? "filled" : "outlined"}
                      />
                    </TableCell>
                    <TableCell align="center">
                      {player.position !== undefined && player.position >= 0 ? (
                        <Typography variant="body2">{player.position + 1}</Typography>
                      ) : (
                        <Typography variant="body2" color="text.disabled">-</Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="medium">
                        {displayBuyIn.toFixed(1)} BB
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="medium">
                        {currentChips.toFixed(1)} BB
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {player.pending_buy_in > 0 && (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                          <Chip 
                            label={`+${player.pending_buy_in.toFixed(1)} BB`} 
                            size="small" 
                            color="success" 
                            variant="outlined"
                            sx={{ fontWeight: 'bold' }}
                          />
                        </Box>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                        {getProfitIcon(profit)}
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            color: getProfitColor(profit),
                            fontWeight: profit !== 0 ? 'bold' : 'normal'
                          }}
                        >
                          {profit > 0 ? '+' : ''}{profit.toFixed(1)} BB
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained" color="primary">
          关闭
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PlayerListDialog; 