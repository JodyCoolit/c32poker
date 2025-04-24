import React from 'react';
import { Box, Typography, Chip, Tooltip } from '@mui/material';
import { styled } from '@mui/material/styles';

const PotContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: theme.spacing(0.75, 1.5),
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  borderRadius: theme.shape.borderRadius,
  color: '#fff',
  boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
}));

const MainPot = styled(Typography)(({ theme }) => ({
  fontSize: '1.3rem',
  fontWeight: 'bold',
  marginBottom: theme.spacing(0.25)
}));

const SidePotContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  gap: theme.spacing(0.5)
}));

const SidePotChip = styled(Chip)(({ theme }) => ({
  backgroundColor: 'rgba(255, 255, 255, 0.15)',
  color: '#fff',
  fontSize: '0.7rem',
  height: '22px'
}));

/**
 * 底池显示组件
 * @param {number} pot - 主底池
 * @param {number} previousBets - 当前回合的下注总额
 * @param {Array} sidePots - 边池数组，格式为 [{amount: number, players: Array<string>}]
 */
const PotDisplay = ({ pot = 0, previousBets = 0, sidePots = [] }) => {
  console.log('PotDisplay - pot:', pot, 'previousBets:', previousBets);
  
  // 计算总底池 (主底池 + 当前回合下注 + 边池)
  const totalPot = (pot || 0) + (previousBets || 0) + (sidePots || []).reduce((sum, pot) => sum + (pot.amount || 0), 0);
  
  // 如果总底池为0或无效值，不显示组件
  if (!totalPot || totalPot <= 0) {
    return null;
  }
  
  return (
    <PotContainer>
      <MainPot variant="h6">
        底池: {totalPot} BB
      </MainPot>
      
      {/* 显示边池（如果有） */}
      {sidePots && sidePots.length > 0 && (
        <SidePotContainer>
          {sidePots.map((pot, index) => (
            <Tooltip 
              key={index} 
              title={
                pot.players && pot.players.length > 0 
                  ? `玩家: ${pot.players.join(', ')}` 
                  : '边池'
              }
              arrow
            >
              <SidePotChip 
                label={`边池 ${index + 1}: ${pot.amount} BB`}
                size="small"
              />
            </Tooltip>
          ))}
        </SidePotContainer>
      )}
    </PotContainer>
  );
};

export default PotDisplay; 