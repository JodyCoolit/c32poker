import React from 'react';
import { Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

// 样式化的Dealer按钮
const DealerButtonContainer = styled(Box)(({ theme, width, height }) => ({
  width: width || 30,
  height: height || 30,
  borderRadius: '50%',
  backgroundColor: '#FFD700', // 金色背景
  color: '#000',
  border: '2px solid #000',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 2px 8px rgba(0,0,0,0.8), 0 0 12px rgba(255,215,0,0.6)',
  fontSize: '0.9rem',
  fontWeight: 'bold',
  zIndex: 200,
  animation: 'pulse-glow 2s infinite',
  visibility: 'visible !important',
  opacity: 1,
  '@keyframes pulse-glow': {
    '0%': {
      boxShadow: '0 2px 8px rgba(0,0,0,0.8), 0 0 5px rgba(255,215,0,0.6)'
    },
    '50%': {
      boxShadow: '0 2px 8px rgba(0,0,0,0.8), 0 0 15px rgba(255,215,0,0.9)'
    },
    '100%': {
      boxShadow: '0 2px 8px rgba(0,0,0,0.8), 0 0 5px rgba(255,215,0,0.6)'
    }
  },
  '&:before': {
    content: '""',
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: '50%',
    border: '2px solid #ffffff',
    opacity: 0.7,
    visibility: 'visible'
  }
}));

/**
 * DealerButton组件
 * @param {Object} props - 组件属性
 * @param {Object} props.style - 自定义样式 (可选)
 * @param {Number} props.width - 自定义宽度 (可选)
 * @param {Number} props.height - 自定义高度 (可选)
 */
const DealerButton = ({ style, width, height }) => {
  return (
    <DealerButtonContainer style={style} width={width} height={height}>
      <Typography
        variant="body2"
        component="div"
        sx={{
          fontWeight: 'bold',
          fontSize: width ? `${width * 0.03}rem` : '0.9rem',
          color: '#000',
          textShadow: '0 1px 1px rgba(255,255,255,0.5)'
        }}
      >
        D
      </Typography>
    </DealerButtonContainer>
  );
};

export default DealerButton; 