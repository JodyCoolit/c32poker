import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Divider, 
  Chip, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  IconButton,
  Collapse,
  Badge
} from '@mui/material';
import { 
  ExpandMore as ExpandMoreIcon, 
  ExpandLess as ExpandLessIcon,
  Gamepad as GamepadIcon,
  Check as CheckIcon,
  CallEnd as CallEndIcon,
  TrendingUp as RaiseIcon,
  Block as FoldIcon,
  Diamond as AllInIcon
} from '@mui/icons-material';

/**
 * 游戏历史记录组件
 * 展示对局中的玩家操作记录和回合切换
 */
const GameHistory = ({ history = [], currentRound = 1 }) => {
  const [expandedRounds, setExpandedRounds] = useState({});

  // 切换回合展开/折叠状态
  const toggleRoundExpand = (roundId) => {
    setExpandedRounds(prev => ({
      ...prev,
      [roundId]: !prev[roundId]
    }));
  };

  // 根据操作类型返回对应图标
  const getActionIcon = (action) => {
    switch (action.toLowerCase()) {
      case 'check':
        return <CheckIcon color="info" />;
      case 'call':
        return <CallEndIcon color="success" />;
      case 'raise':
        return <RaiseIcon color="warning" />;
      case 'fold':
        return <FoldIcon color="error" />;
      case 'all-in':
        return <AllInIcon color="secondary" />;
      default:
        return null;
    }
  };

  // 格式化操作类型显示
  const formatAction = (action) => {
    switch (action.toLowerCase()) {
      case 'check':
        return '让牌';
      case 'call':
        return '跟注';
      case 'raise':
        return '加注';
      case 'fold':
        return '弃牌';
      case 'all-in':
        return '全下';
      default:
        return action;
    }
  };

  // 按回合分组历史记录
  const groupByRound = () => {
    const grouped = {};
    
    history.forEach(entry => {
      const roundId = entry.round || 1;
      if (!grouped[roundId]) {
        grouped[roundId] = {
          roundNumber: roundId,
          actions: []
        };
      }
      grouped[roundId].actions.push(entry);
    });
    
    return Object.values(grouped);
  };

  const rounds = groupByRound();

  return (
    <Box sx={{ width: '100%', overflow: 'auto', maxHeight: '400px' }}>
      <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
        游戏历史记录
      </Typography>
      
      {rounds.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
          暂无历史记录
        </Typography>
      ) : (
        <Box>
          {rounds.map((round) => (
            <Paper 
              key={round.roundNumber} 
              elevation={1}
              sx={{ 
                mb: 2, 
                overflow: 'hidden',
                border: round.roundNumber === currentRound ? '2px solid #3f51b5' : 'none'
              }}
            >
              {/* 回合标题 */}
              <Box 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  bgcolor: round.roundNumber === currentRound ? 'rgba(63, 81, 181, 0.1)' : 'rgba(0, 0, 0, 0.03)',
                  px: 2,
                  py: 1,
                  cursor: 'pointer'
                }}
                onClick={() => toggleRoundExpand(round.roundNumber)}
              >
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Badge 
                    badgeContent={round.actions.length} 
                    color="primary"
                    sx={{ mr: 2 }}
                  >
                    <GamepadIcon color="action" />
                  </Badge>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                    第 {round.roundNumber} 局
                  </Typography>
                  {round.roundNumber === currentRound && (
                    <Chip 
                      label="当前" 
                      size="small" 
                      color="primary" 
                      sx={{ ml: 1 }}
                    />
                  )}
                </Box>
                <IconButton size="small">
                  {expandedRounds[round.roundNumber] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Box>
              
              {/* 回合详情 */}
              <Collapse in={expandedRounds[round.roundNumber]}>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell width="30%">玩家</TableCell>
                        <TableCell width="30%">阶段</TableCell>
                        <TableCell width="20%">操作</TableCell>
                        <TableCell width="20%" align="right">金额</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {round.actions.map((action, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Typography variant="body2">
                              {action.player || `玩家${action.player_idx + 1}`}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={action.phase || '未知'} 
                              size="small" 
                              sx={{ 
                                fontSize: '0.7rem',
                                bgcolor: 
                                  action.phase === 'PRE_FLOP' ? 'rgba(33, 150, 243, 0.1)' :
                                  action.phase === 'FLOP' ? 'rgba(76, 175, 80, 0.1)' :
                                  action.phase === 'TURN' ? 'rgba(255, 152, 0, 0.1)' :
                                  action.phase === 'RIVER' ? 'rgba(244, 67, 54, 0.1)' :
                                  'rgba(0, 0, 0, 0.1)',
                                color: 
                                  action.phase === 'PRE_FLOP' ? 'primary.main' :
                                  action.phase === 'FLOP' ? 'success.main' :
                                  action.phase === 'TURN' ? 'warning.main' :
                                  action.phase === 'RIVER' ? 'error.main' :
                                  'text.primary',
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              {getActionIcon(action.action)}
                              <Typography variant="body2" sx={{ ml: 1 }}>
                                {formatAction(action.action)}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell align="right">
                            {action.amount > 0 && (
                              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                {action.amount}
                              </Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Collapse>
            </Paper>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default GameHistory; 