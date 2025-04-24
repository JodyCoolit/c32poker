import React from 'react';
import { styled } from '@mui/material/styles';
import { Box } from '@mui/material';
import BetChips from './BetChips';

// 下注区域位置计算（基于座位角度和距离中心点的半径）
const calculateBetPosition = (angle, radius) => {
  const radian = (angle * Math.PI) / 180;
  // 调整位置系数，确保筹码在座位和中心点之间的合适位置
  // 将系数从0.7改为0.5，让筹码更靠近底池中心
  const positionFactor = 0.5;
  const x = 50 + (radius * positionFactor) * Math.sin(radian);
  const y = 50 - (radius * positionFactor) * Math.cos(radian);
  return { x, y };
};

// 座位角度（与Seat.jsx保持一致）
// 座位0位于底部中心(0度)，然后顺时针排列
const seatAngles = [180, 225, 270, 315, 0, 45, 90, 135];

// 优化下注区域容器样式，避免与玩家进度条重叠
const BetAreaContainer = styled(Box)(({ position, radius = 42 }) => {
  // UI位置(position)对应seatAngles中的角度位置
  const { x, y } = calculateBetPosition(seatAngles[position], radius);
  
  // 根据位置额外调整Y轴偏移，避免与玩家进度条重叠
  // 对于底部和顶部的座位，需要更多的Y轴偏移
  let yOffset = 0;
  if (position === 0) { // 下方座位
    yOffset = 1; // 向上偏移
  } else if (position === 4) { // 上方座位
    yOffset = -1;  // 向下偏移
  }
  
  return {
    position: 'absolute',
    left: `${x}%`,
    top: `${y + yOffset}%`, // 应用Y轴偏移
    transform: 'translate(-50%, -50%)',
    zIndex: 12, // 稍微降低zIndex，避免覆盖主要UI元素
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3px',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: '50%',
    boxShadow: '0 2px 5px rgba(0, 0, 0, 0.3)',
    backdropFilter: 'blur(1px)',
    transition: 'all 0.3s ease',
    '&:hover': {
      transform: 'translate(-50%, -50%) scale(1.05)',
    }
  };
});

/**
 * 下注区域组件
 * @param {Object} props 组件属性
 * @param {number} props.position 座位UI位置 (0-7)
 * @param {number} props.betAmount 下注金额
 * @param {number} props.radius 距离中心的半径（可选，默认42）
 */
const BetArea = ({ position, betAmount, radius = 42 }) => {
  // 修改条件，当下注金额大于0时显示下注区域，确保小盲0.5BB也能显示
  if (!betAmount || betAmount <= 0) return null;

  // 只在开发环境中输出调试信息
  if (process.env.NODE_ENV === 'development' && betAmount > 0) {
    console.log(`渲染下注区域: UI位置=${position}, 金额=${betAmount}, 角度=${seatAngles[position]}`);
  }

  return (
    <BetAreaContainer position={position} radius={radius}>
      <BetChips betAmount={betAmount} position={position} />
    </BetAreaContainer>
  );
};

// 使用React.memo包装组件
export default React.memo(BetArea); 