import React, { useState } from 'react';
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
  Alert
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
  const selectedHistory = history.length > tabValue ? history[tabValue] : null;

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
        {!loading && !error && (!history || history.length === 0) && (
          <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', my: 3 }}>
            暂无历史记录
          </Typography>
        )}
        
        {/* 历史记录内容 */}
        {!loading && !error && history && history.length > 0 && (
          <>
            {/* 局数Tab */}
            <Tabs 
              value={tabValue} 
              onChange={handleTabChange} 
              variant="scrollable"
              scrollButtons="auto"
              sx={{ mb: 2 }}
            >
              {history.map((hand, index) => (
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
                        时间: {formatDate(selectedHistory.timestamp)}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="text.secondary">
                        底池: {selectedHistory.pot} BB
                      </Typography>
                    </Grid>
                  </Grid>
                </Paper>
                
                {/* 赢家信息 */}
                {selectedHistory.winners && selectedHistory.winners.length > 0 && (
                  <Paper elevation={2} sx={{ p: 2, mb: 2, bgcolor: '#E8F5E9' }}>
                    <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <EmojiEventsIcon color="success" /> 
                      赢家
                    </Typography>
                    <List dense>
                      {selectedHistory.winners.map((winner, index) => (
                        <ListItem key={index}>
                          <ListItemText 
                            primary={winner.name} 
                            secondary={`获得 ${winner.amount} BB`} 
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
                  {selectedHistory.actions && selectedHistory.actions.map((actionGroup, index) => {
                    const roundName = actionGroup.round || `第${index + 1}轮`;
                    const isExpanded = expanded[`${tabValue}-${index}`] || false;
                    
                    return (
                      <React.Fragment key={index}>
                        <ListItem 
                          button 
                          onClick={() => toggleExpand(`${tabValue}-${index}`)}
                          sx={{ bgcolor: '#f5f5f5', mb: 1 }}
                        >
                          <ListItemText primary={roundName} />
                          <IconButton edge="end">
                            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          </IconButton>
                        </ListItem>
                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                          <List component="div" disablePadding>
                            {actionGroup.actions && actionGroup.actions.map((action, actionIndex) => (
                              <ListItem key={actionIndex} sx={{ pl: 4 }}>
                                <ListItemIcon>
                                  {getActionIcon(action.action)}
                                </ListItemIcon>
                                <ListItemText 
                                  primary={action.player} 
                                  secondary={`${getActionName(action.action)}${action.amount ? ` ${action.amount} BB` : ''}`} 
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