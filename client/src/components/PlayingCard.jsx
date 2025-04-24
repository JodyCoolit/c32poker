import React from 'react';
import { Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

// 卡片容器
const CardContainer = styled(Box)(({ theme, selected }) => ({
  position: 'relative',
  width: '70px',
  height: '100px',
  borderRadius: '8px',
  boxShadow: selected 
    ? `0 0 0 3px ${theme.palette.primary.main}, 0 4px 8px rgba(0,0,0,0.3)` 
    : '0 2px 4px rgba(0,0,0,0.2)',
  backgroundColor: 'white',
  margin: '4px',
  userSelect: 'none',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  transform: selected ? 'translateY(-5px)' : 'none',
  '&:hover': {
    transform: 'translateY(-3px)',
    boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
  }
}));

// 卡片背面
const CardBack = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  borderRadius: '8px',
  backgroundImage: `linear-gradient(45deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
  backgroundSize: '10px 10px',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  '&::after': {
    content: '""',
    position: 'absolute',
    width: '80%',
    height: '80%',
    border: '2px solid rgba(255,255,255,0.1)',
    borderRadius: '4px'
  }
}));

// 卡片角落
const CardCorner = styled(Box)(({ position, color }) => ({
  position: 'absolute',
  [position === 'top' ? 'top' : 'bottom']: '5px',
  [position === 'top' ? 'left' : 'right']: '5px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  color
}));

// 卡片中心
const CardCenter = styled(Box)(({ color }) => ({
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  fontSize: '32px',
  color
}));

/**
 * 解析牌面代码，返回显示值、花色和颜色
 * @param {string} code - 牌面代码，例如 "KH", "2C", "AD" 等
 * @returns {Object} 包含value, symbol和color的对象
 */
const parseCard = (code) => {
  if (!code) return { value: '', symbol: '', color: 'black' };
  
  const value = code.slice(0, -1);
  const suit = code.slice(-1).toUpperCase();
  
  // 转换数值
  let displayValue = value;
  if (value === '1') displayValue = 'A';
  if (value === '11') displayValue = 'J';
  if (value === '12') displayValue = 'Q';
  if (value === '13') displayValue = 'K';
  if (value === '14') displayValue = 'A';
  
  // 转换花色和颜色
  let symbol = '';
  let color = 'black';
  
  switch (suit) {
    case 'H':
      symbol = '♥';
      color = '#e53935'; // 红色
      break;
    case 'D':
      symbol = '♦';
      color = '#e53935'; // 红色
      break;
    case 'C':
      symbol = '♣';
      color = '#212121'; // 黑色
      break;
    case 'S':
      symbol = '♠';
      color = '#212121'; // 黑色
      break;
    default:
      symbol = suit;
  }
  
  return { value: displayValue, symbol, color };
};

/**
 * 扑克牌组件
 * @param {Object} props
 * @param {string} props.code - 牌面代码 (例如 "KH", "2C", "AD")
 * @param {boolean} props.faceUp - 是否显示牌面
 * @param {boolean} props.selected - 是否选中
 * @param {function} props.onClick - 点击回调
 * @returns {React.ReactElement}
 */
const PlayingCard = ({ code, faceUp = true, selected = false, onClick }) => {
  const { value, symbol, color } = parseCard(code);
  
  return (
    <CardContainer
      selected={selected}
      onClick={onClick}
      data-testid={`card-${code}`}
    >
      {faceUp ? (
        <>
          <CardCorner position="top" color={color}>
            <Typography variant="caption" sx={{ lineHeight: 1, fontWeight: 'bold' }}>
              {value}
            </Typography>
            <Typography variant="caption" sx={{ lineHeight: 1 }}>
              {symbol}
            </Typography>
          </CardCorner>
          
          <CardCenter color={color}>
            <Typography variant="h4" sx={{ lineHeight: 1 }}>
              {symbol}
            </Typography>
          </CardCenter>
          
          <CardCorner position="bottom" color={color}>
            <Typography variant="caption" sx={{ lineHeight: 1 }}>
              {symbol}
            </Typography>
            <Typography variant="caption" sx={{ lineHeight: 1, fontWeight: 'bold' }}>
              {value}
            </Typography>
          </CardCorner>
        </>
      ) : (
        <CardBack>
          <Typography variant="h6" sx={{ color: 'white', userSelect: 'none' }}>
            ♠♥
          </Typography>
        </CardBack>
      )}
    </CardContainer>
  );
};

export default PlayingCard; 