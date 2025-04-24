import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  Slider, 
  TextField, 
  Typography,
  Box,
  Chip,
  Grid
} from '@mui/material';

/**
 * 加注对话框组件
 * @param {boolean} open - 对话框是否打开
 * @param {function} onClose - 关闭对话框回调
 * @param {function} onConfirm - 确认加注回调
 * @param {number} minBet - 最小加注额
 * @param {number} maxBet - 最大加注额(通常是玩家筹码)
 * @param {number} currentBet - 当前下注额
 * @param {string} action - 动作类型 ("raise" | "bet")
 */
const RaiseDialog = ({ 
  open, 
  onClose, 
  onConfirm, 
  minBet = 2, 
  maxBet = 100, 
  currentBet = 0,
  action = "raise"
}) => {
  // 加注额，默认为最小加注
  const [amount, setAmount] = useState(minBet);
  
  // 计算加注步长
  const step = Math.max(1, Math.floor(minBet / 2));
  
  // 在对话框打开时重置值
  useEffect(() => {
    if (open) {
      setAmount(minBet);
    }
  }, [open, minBet]);
  
  // 处理滑块变化
  const handleSliderChange = (event, newValue) => {
    setAmount(newValue);
  };
  
  // 处理输入框变化
  const handleInputChange = (event) => {
    let newValue = parseFloat(event.target.value);
    
    // 验证输入值
    if (isNaN(newValue)) {
      return;
    }
    
    // 限制在最小和最大值之间
    newValue = Math.max(minBet, Math.min(maxBet, newValue));
    setAmount(newValue);
  };
  
  // 处理预设加注金额点击
  const handlePresetClick = (preset) => {
    let presetAmount;
    
    switch(preset) {
      case 'min':
        presetAmount = minBet;
        break;
      case 'quarter':
        presetAmount = Math.min(maxBet, Math.floor(maxBet * 0.25));
        break;
      case 'half':
        presetAmount = Math.min(maxBet, Math.floor(maxBet * 0.5));
        break;
      case 'pot':
        // 假设这里的currentBet代表底池大小
        presetAmount = Math.min(maxBet, currentBet);
        break;
      case 'allin':
        presetAmount = maxBet;
        break;
      default:
        presetAmount = minBet;
    }
    
    // 确保不低于最小下注额
    presetAmount = Math.max(minBet, presetAmount);
    setAmount(presetAmount);
  };
  
  // 确认加注
  const handleConfirm = () => {
    onConfirm(amount);
  };
  
  // 获取动作标题
  const getActionTitle = () => {
    return action === "raise" ? "加注" : "下注";
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{getActionTitle()}金额</DialogTitle>
      <DialogContent>
        {/* 筹码量显示 */}
        <Typography variant="h4" align="center" gutterBottom>
          {amount} BB
        </Typography>
        
        {/* 滑块 */}
        <Slider
          value={amount}
          onChange={handleSliderChange}
          aria-labelledby="raise-slider"
          valueLabelDisplay="auto"
          step={step}
          min={minBet}
          max={maxBet}
          sx={{ mb: 2 }}
        />
        
        {/* 手动输入 */}
        <TextField
          label={`${getActionTitle()}金额 (BB)`}
          value={amount}
          onChange={handleInputChange}
          type="number"
          fullWidth
          variant="outlined"
          inputProps={{
            min: minBet,
            max: maxBet,
            step: step
          }}
          sx={{ mb: 3 }}
        />
        
        {/* 预设金额按钮 */}
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle1" gutterBottom>预设金额:</Typography>
          <Grid container spacing={1}>
            <Grid item>
              <Chip 
                label={`最小 (${minBet})`} 
                onClick={() => handlePresetClick('min')} 
                color="primary" 
                variant={amount === minBet ? "filled" : "outlined"}
              />
            </Grid>
            <Grid item>
              <Chip 
                label="1/4筹码" 
                onClick={() => handlePresetClick('quarter')} 
                color="primary" 
                variant="outlined"
              />
            </Grid>
            <Grid item>
              <Chip 
                label="一半筹码" 
                onClick={() => handlePresetClick('half')} 
                color="primary" 
                variant="outlined"
              />
            </Grid>
            <Grid item>
              <Chip 
                label="底池" 
                onClick={() => handlePresetClick('pot')} 
                color="primary" 
                variant="outlined"
              />
            </Grid>
            <Grid item>
              <Chip 
                label="全下" 
                onClick={() => handlePresetClick('allin')} 
                color="error" 
                variant="outlined"
              />
            </Grid>
          </Grid>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          取消
        </Button>
        <Button onClick={handleConfirm} color="primary" variant="contained">
          确认{getActionTitle()}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RaiseDialog; 