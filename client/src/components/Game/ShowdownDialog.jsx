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
  Paper,
  Divider,
  Chip
} from '@mui/material';
import PlayingCard from './PlayingCard';

/**
 * 摊牌对话框组件
 * @param {boolean} open - 对话框是否打开
 * @param {function} onClose - 关闭对话框回调
 * @param {Array} players - 玩家数组，包含手牌、名称、筹码变化等信息
 * @param {Array} communityCards - 公共牌数组
 * @param {Array} winners - 获胜玩家数组
 * @param {Object} pot - 底池信息
 */
const ShowdownDialog = ({ 
  open, 
  onClose, 
  players = [], 
  communityCards = [],
  winners = [],
  pot = { main: 0, sidePots: [] }
}) => {
  
  // 计算总底池
  const totalPot = pot.main + (pot.sidePots || []).reduce((sum, sidePot) => sum + sidePot.amount, 0);
  
  // 获取牌型显示名称
  const getHandTypeName = (handType) => {
    const handTypes = {
      'HIGH_CARD': '高牌',
      'PAIR': '对子',
      'TWO_PAIR': '两对',
      'THREE_OF_A_KIND': '三条',
      'STRAIGHT': '顺子',
      'FLUSH': '同花',
      'FULL_HOUSE': '葫芦',
      'FOUR_OF_A_KIND': '四条',
      'STRAIGHT_FLUSH': '同花顺',
      'ROYAL_FLUSH': '皇家同花顺'
    };
    
    return handTypes[handType] || handType;
  };
  
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>摊牌结果</DialogTitle>
      <DialogContent>
        {/* 公共牌 */}
        <Box sx={{ mb: 3, p: 2, bgcolor: '#E8F5E9', borderRadius: 2 }}>
          <Typography variant="h6" gutterBottom>公共牌</Typography>
          <Grid container spacing={1} justifyContent="center">
            {communityCards.map((card, index) => (
              <Grid item key={index}>
                <PlayingCard card={card} />
              </Grid>
            ))}
          </Grid>
        </Box>
        
        <Divider sx={{ my: 2 }} />
        
        {/* 底池信息 */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>底池: {totalPot} BB</Typography>
          {pot.sidePots && pot.sidePots.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
              <Typography variant="body2">边池:</Typography>
              {pot.sidePots.map((sidePot, index) => (
                <Chip 
                  key={index} 
                  label={`边池 ${index+1}: ${sidePot.amount} BB`} 
                  size="small" 
                  variant="outlined" 
                />
              ))}
            </Box>
          )}
        </Box>
        
        <Divider sx={{ my: 2 }} />
        
        {/* 玩家手牌和结果 */}
        <Typography variant="h6" gutterBottom>玩家手牌</Typography>
        <Grid container spacing={2}>
          {players.map((player, index) => {
            const isWinner = winners.some(winner => winner.name === player.name);
            return (
              <Grid item xs={12} sm={6} md={4} key={index}>
                <Paper 
                  elevation={3} 
                  sx={{ 
                    p: 2, 
                    border: isWinner ? '2px solid #4CAF50' : 'none',
                    bgcolor: isWinner ? '#E8F5E9' : 'white'
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {player.name}
                    </Typography>
                    {isWinner && (
                      <Chip label="赢家" color="success" size="small" />
                    )}
                  </Box>
                  
                  {/* 玩家手牌 */}
                  <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
                    {player.hand && player.hand.map((card, cardIndex) => (
                      <Box key={cardIndex} sx={{ mx: 0.5 }}>
                        <PlayingCard card={card} />
                      </Box>
                    ))}
                  </Box>
                  
                  {/* 玩家牌型 */}
                  {player.handType && (
                    <Typography variant="body2" align="center" color="textSecondary">
                      {getHandTypeName(player.handType)}
                    </Typography>
                  )}
                  
                  {/* 筹码变化 */}
                  <Box sx={{ mt: 1, display: 'flex', justifyContent: 'center' }}>
                    <Typography 
                      variant="body2" 
                      color={player.chipsWon > 0 ? 'success.main' : 'text.secondary'}
                      fontWeight="bold"
                    >
                      {player.chipsWon > 0 ? `+${player.chipsWon}` : player.chipsWon} BB
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained" color="primary">
          关闭
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ShowdownDialog; 