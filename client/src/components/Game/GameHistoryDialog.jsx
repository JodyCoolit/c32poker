import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button,
  Typography,
  Box,
  Grid,
  Paper,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Collapse,
  IconButton,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  ButtonBase
} from '@mui/material';

// 图标
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import CallIcon from '@mui/icons-material/Call';
import MoneyIcon from '@mui/icons-material/Money';
import CasinoIcon from '@mui/icons-material/Casino';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';

/**
 * 游戏历史对话框组件
 * @param {boolean} open - 对话框是否打开
 * @param {function} onClose - 关闭对话框回调
 * @param {Array} history - 历史记录数组
 * @param {boolean} loading - 是否正在加载
 * @param {string} error - 错误信息
 */
const GameHistoryDialog = ({ 
  open, 
  onClose, 
  history = [],
  loading = false,
  error = null
}) => {
  // 当前查看的局数Tab
  const [tabValue, setTabValue] = useState(0);
  
  // 控制每个历史记录的展开/折叠状态
  const [expanded, setExpanded] = useState({});
  
  // 处理历史数据
  const [processedHistory, setProcessedHistory] = useState([]);

  // 当history变化时处理数据
  useEffect(() => {
    console.group('GameHistoryDialog 接收到历史数据');
    console.log('历史数据:', history);
    
    // 确保历史数据是数组
    if (Array.isArray(history)) {
      setProcessedHistory(history);
      console.log('历史数据是数组，数量:', history.length);
    } else if (history && typeof history === 'object') {
      // 如果是对象，尝试从history字段获取数据
      if (Array.isArray(history.history)) {
        setProcessedHistory(history.history);
        console.log('从history对象中获取history字段，数量:', history.history.length);
      } else {
        // 如果不是数组，尝试将对象转换为数组
        const historyArray = [history];
        setProcessedHistory(historyArray);
        console.log('将单个历史对象转换为数组');
      }
    } else {
      setProcessedHistory([]);
      console.log('历史数据格式不正确，设置为空数组');
    }
    console.groupEnd();
  }, [history]);
  
  // 处理Tab变化
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };
  
  // 切换历史记录的展开/折叠状态
  const toggleExpand = (handId) => {
    setExpanded(prev => ({
      ...prev,
      [handId]: !prev[handId]
    }));
  };
  
  // 格式化时间戳
  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };
  
  // 获取玩家动作的显示名称
  const getActionName = (action) => {
    const actionMap = {
      'fold': '弃牌',
      'check': '看牌',
      'call': '跟注',
      'bet': '下注',
      'raise': '加注',
      'all-in': '全下',
      'discard': '弃牌（多余手牌）'
    };
    
    return actionMap[action] || action;
  };
  
  // 获取玩家动作对应的图标
  const getActionIcon = (action) => {
    switch (action) {
      case 'fold':
        return <CloseIcon color="error" />;
      case 'check':
        return <CheckIcon color="info" />;
      case 'call':
        return <CallIcon color="success" />;
      case 'bet':
      case 'raise':
        return <MoneyIcon color="warning" />;
      case 'all-in':
        return <CasinoIcon color="secondary" />;
      case 'discard':
        return <CloseIcon color="default" />;
      default:
        return null;
    }
  };
  
  // 获取当前选中的历史记录
  const selectedHistory = processedHistory && processedHistory.length > tabValue ? processedHistory[tabValue] : null;

  // 处理历史记录中的动作数据，按轮次分组
  const processActionsData = (actions) => {
    if (!actions || !Array.isArray(actions)) return [];
    
    // 根据动作轮次分组处理
    const rounds = {};
    
    actions.forEach(action => {
      // 处理轮次值，可能是字符串或数字
      let roundKey = action.round !== undefined ? action.round.toString() : 'PRE_FLOP';
      
      if (!rounds[roundKey]) {
        rounds[roundKey] = {
          round: getRoundDisplayName(roundKey),
          actions: []
        };
      }
      
      rounds[roundKey].actions.push({
        player: action.player_name || action.player || 'Unknown',
        action: action.action,
        amount: action.amount
      });
    });
    
    return Object.values(rounds);
  };
  
  // 获取轮次的显示名称
  const getRoundDisplayName = (round) => {
    // 将输入统一转为字符串处理
    const roundStr = round?.toString() || '';
    
    // 映射关系，同时处理字符串和数字
    const roundMap = {
      'PRE_FLOP': '翻前',
      'FLOP': '翻牌圈',
      'TURN': '转牌圈',
      'RIVER': '河牌圈',
      'SHOWDOWN': '摊牌',
      // 处理数字轮次
      '0': '翻前',
      '1': '翻牌圈',
      '2': '转牌圈',
      '3': '河牌圈',
      '4': '摊牌'
    };
    
    return roundMap[roundStr] || `第${roundStr}轮`;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>游戏历史记录</DialogTitle>
      <DialogContent>
        {/* 加载状态 */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
            <CircularProgress />
          </Box>
        )}
        
        {/* 错误提示 */}
        {error && (
          <Alert severity="error" sx={{ my: 2 }}>
            {error}
          </Alert>
        )}
        
        {/* 无历史记录提示 */}
        {!loading && !error && (!processedHistory || processedHistory.length === 0) && (
          <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', my: 3 }}>
            暂无历史记录
          </Typography>
        )}
        
        {/* 历史记录内容 */}
        {!loading && !error && processedHistory && processedHistory.length > 0 && (
          <>
            {/* 局数Tab */}
            <Tabs 
              value={tabValue} 
              onChange={handleTabChange} 
              variant="scrollable"
              scrollButtons="auto"
              sx={{ mb: 2 }}
            >
              {processedHistory.map((hand, index) => (
                <Tab key={index} label={`局 ${index + 1}`} />
              ))}
            </Tabs>
            
            {/* 历史记录详情 */}
            {selectedHistory && (
              <Box>
                {/* 基本信息 */}
                <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    局 {tabValue + 1}
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="text.secondary">
                        时间: {formatDate(selectedHistory.start_time)}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="text.secondary">
                        底池: {selectedHistory.pot.toFixed(1)} BB
                      </Typography>
                    </Grid>
                    {selectedHistory.game_id && (
                      <Grid item xs={12}>
                        <Typography variant="body2" color="text.secondary">
                          游戏ID: {selectedHistory.game_id}
                        </Typography>
                      </Grid>
                    )}
                  </Grid>
                </Paper>
                
                {/* 赢家信息 */}
                {selectedHistory.winners && selectedHistory.winners.length > 0 && (
                  <Paper elevation={2} sx={{ p: 2, mb: 2, bgcolor: '#e8f0e8' }}>
                    <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#2e7d32' }}>
                      <EmojiEventsIcon color="success" /> 
                      赢家
                    </Typography>
                    <List dense>
                      {selectedHistory.winners.map((winner, index) => (
                        <ListItem key={index}>
                          <ListItemText 
                            primary={<Typography variant="body1" sx={{ fontWeight: 'medium', color: '#333' }}>{winner.name}</Typography>} 
                            secondary={
                              <>
                                {winner.hand && (
                                  <Typography variant="caption" display="block">手牌: {formatHand(winner.hand)}</Typography>
                                )}
                                <Typography 
                                  variant="body2" 
                                  sx={{ 
                                    color: '#555', 
                                    display: 'flex', 
                                    alignItems: 'center' 
                                  }}
                                >
                                  <MonetizationOnIcon sx={{ marginRight: 0.5, fontSize: '0.9rem', color: '#FFD700' }} />
                                  获得 {(winner.amount || winner.chips || 0).toFixed(1)} BB
                                </Typography>
                              </>
                            } 
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Paper>
                )}
                
                {/* 玩家信息 */}
                {selectedHistory.players && selectedHistory.players.length > 0 && (
                  <Paper elevation={2} sx={{ p: 2, mb: 2, bgcolor: '#f8f8f8' }}>
                    <Typography variant="subtitle1" gutterBottom>
                      参与玩家
                    </Typography>
                    <List dense>
                      {selectedHistory.players.map((player, index) => (
                        <ListItem key={index}>
                          <ListItemText 
                            primary={<Typography variant="body1" sx={{ fontWeight: 'medium', color: '#333' }}>{player.name}</Typography>} 
                            secondary={
                              <>
                                <Typography variant="body2" sx={{ mt: 0.5, color: '#555' }}>
                                  初始筹码: {(player.chips_start || player.initial_chips || 0).toFixed(1)} BB, 结束筹码: {(player.chips_end || player.chips || 0).toFixed(1)} BB
                                </Typography>
                              </>
                            } 
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Paper>
                )}
                
                {/* 玩家动作记录 */}
                <Typography variant="subtitle1" gutterBottom>
                  玩家动作
                </Typography>
                <List>
                  {processActionsData(selectedHistory.actions).map((actionGroup, index) => {
                    const roundName = actionGroup.round || `第${index + 1}轮`;
                    const isExpanded = expanded[`${tabValue}-${index}`] || false;
                    
                    return (
                      <React.Fragment key={index}>
                        <ListItem 
                          button 
                          onClick={() => toggleExpand(`${tabValue}-${index}`)}
                          sx={{ bgcolor: '#e0e0e0', mb: 1, borderRadius: '4px' }}
                        >
                          <ListItemText 
                            primary={<Typography variant="body1" sx={{ fontWeight: 'medium', color: '#333' }}>{roundName}</Typography>} 
                          />
                          <IconButton edge="end">
                            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          </IconButton>
                        </ListItem>
                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                          <List component="div" disablePadding sx={{ bgcolor: '#f5f5f5', borderRadius: '4px', mb: 2 }}>
                            {actionGroup.actions && actionGroup.actions.map((action, actionIndex) => (
                              <ListItem key={actionIndex} sx={{ pl: 4 }}>
                                <ListItemIcon>
                                  {getActionIcon(action.action)}
                                </ListItemIcon>
                                <ListItemText 
                                  primary={<Typography variant="body1" sx={{ fontWeight: 'medium', color: '#333' }}>{action.player}</Typography>} 
                                  secondary={<Typography variant="body2" sx={{ color: '#555' }}>{getActionName(action.action)}{action.amount ? ` ${action.amount.toFixed(1)} BB` : ''}</Typography>} 
                                />
                              </ListItem>
                            ))}
                          </List>
                        </Collapse>
                      </React.Fragment>
                    );
                  })}
                </List>
              </Box>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained" color="primary">
          关闭
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default GameHistoryDialog; 