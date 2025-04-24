import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { styled } from '@mui/material/styles';

// 筹码堆样式
const ChipStack = styled(Box)(({ theme }) => ({
  position: 'relative',
  width: '28px',
  height: '28px',
  margin: '0 auto',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
}));

// 单个筹码样式
const Chip = styled(Box)(({ color, index }) => ({
  position: 'absolute',
  width: '26px',
  height: '26px',
  borderRadius: '50%',
  backgroundColor: color,
  border: '2px solid white',
  boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
  zIndex: 10 - index,
  transform: `translateY(${-index * 3}px)`,
}));

// 筹码颜色映射
const chipColors = {
  0.5: '#808080',  // 灰色 - 0.5 BB (小盲)
  1: '#FFFFFF',    // 白色 - 1 BB
  5: '#FF0000',    // 红色 - 5 BB
  10: '#0000FF',   // 蓝色 - 10 BB
  25: '#008000',   // 绿色 - 25 BB
  100: '#000000',  // 黑色 - 100 BB
};

// 将下注金额分解为筹码
const calculateChips = (betAmount) => {
  // 特殊处理小于1的下注额（如小盲0.5BB）
  if (betAmount < 1) {
    return [0.5]; // 返回一个小盲筹码
  }
  
  const chipValues = [100, 25, 10, 5, 1];
  const chips = [];
  let remainingAmount = betAmount;

  chipValues.forEach(value => {
    const count = Math.floor(remainingAmount / value);
    for (let i = 0; i < Math.min(count, 5); i++) { // 每种筹码最多显示5个
      chips.push(value);
    }
    remainingAmount %= value;
  });

  // 如果有小数部分且大于0.1，添加一个小盲筹码
  if (remainingAmount > 0.1) {
    chips.push(0.5);
  }

  // 限制最多显示10个筹码
  return chips.slice(0, 10);
};

/**
 * 下注筹码组件
 * @param {Object} props 组件属性
 * @param {number} props.betAmount 下注金额
 * @param {number} props.position 显示位置 (0-7)
 */
const BetChips = ({ betAmount, position }) => {
  if (!betAmount || betAmount <= 0) return null;

  // 计算要显示的筹码
  const chips = calculateChips(betAmount);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
      }}
    >
      {/* 筹码堆 */}
      <ChipStack>
        {chips.map((value, index) => (
          <Chip 
            key={`chip-${position}-${index}`}
            color={chipColors[value] || '#FFFFFF'} 
            index={index}
          />
        ))}
      </ChipStack>
      
      {/* 下注金额 */}
      <Paper
        elevation={2}
        sx={{
          padding: '1px 6px',
          borderRadius: '8px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          marginTop: '2px',
          border: '1px solid rgba(255, 215, 0, 0.3)',
          transform: 'scale(0.9)', // 整体缩小
        }}
      >
        <Typography 
          variant="caption" 
          sx={{ 
            color: '#FFD700', 
            fontWeight: 'bold',
            fontSize: '0.7rem', // 减小字体大小
          }}
        >
          {betAmount} BB
        </Typography>
      </Paper>
    </Box>
  );
};

export default BetChips; 