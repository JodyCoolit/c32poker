import React, { useState } from 'react';
import { Box, Button, Typography, Slider, TextField, IconButton } from '@mui/material';
import { styled } from '@mui/material/styles';

/**
 * Styled button components for action buttons
 */
const ActionButton = styled(Button)(({ theme, color }) => ({
  borderRadius: '8px',
  padding: '8px 16px',
  minWidth: '100px',
  fontWeight: 600,
  textTransform: 'none',
  transition: 'all 0.2s ease',
  boxShadow: '0 3px 5px rgba(0,0,0,0.2)',
  margin: '0 4px',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 5px 10px rgba(0,0,0,0.3)',
  },
  [theme.breakpoints.down('md')]: {
    minWidth: '80px',
    padding: '6px 12px',
    fontSize: '0.8rem',
  },
}));

const FoldButton = styled(ActionButton)({
  backgroundColor: '#d32f2f',
  color: 'white',
  '&:hover': {
    backgroundColor: '#b71c1c',
    transform: 'translateY(-2px)',
  },
});

const CheckButton = styled(ActionButton)({
  backgroundColor: '#4caf50',
  color: 'white',
  '&:hover': {
    backgroundColor: '#388e3c',
    transform: 'translateY(-2px)',
  },
});

const CallButton = styled(ActionButton)({
  backgroundColor: '#1976d2',
  color: 'white',
  '&:hover': {
    backgroundColor: '#1565c0',
    transform: 'translateY(-2px)',
  },
});

const RaiseButton = styled(ActionButton)({
  backgroundColor: '#ff9800',
  color: 'white',
  '&:hover': {
    backgroundColor: '#f57c00',
    transform: 'translateY(-2px)',
  },
});

const AllInButton = styled(ActionButton)({
  backgroundColor: '#9c27b0',
  color: 'white',
  '&:hover': {
    backgroundColor: '#7b1fa2',
    transform: 'translateY(-2px)',
  },
});

/**
 * Action buttons component for player actions in poker game
 * @param {Object} props Component props
 * @param {Function} props.onCheck Handle check action
 * @param {Function} props.onCall Handle call action
 * @param {Function} props.onFold Handle fold action
 * @param {Function} props.onRaise Handle raise action
 * @param {Function} props.onAllIn Handle all-in action
 * @param {number} props.callAmount Amount required to call
 * @param {number} props.minRaise Minimum raise amount
 * @param {number} props.maxRaise Maximum raise amount
 * @param {number} props.playerChips Player's current chips
 * @param {boolean} props.isActive Whether player can act
 * @param {boolean} props.canCheck Whether player can check
 */
const ActionButtons = ({
  onCheck,
  onCall,
  onFold,
  onRaise,
  onAllIn,
  callAmount = 0,
  minRaise = 0,
  maxRaise = 0,
  playerChips = 0,
  isActive = false,
  canCheck = false
}) => {
  const [showRaiseOptions, setShowRaiseOptions] = useState(false);
  const [raiseAmount, setRaiseAmount] = useState(minRaise);

  // Handle raise slider change
  const handleRaiseChange = (event, newValue) => {
    setRaiseAmount(newValue);
  };

  // Handle raise input change
  const handleRaiseInputChange = (event) => {
    const value = Number(event.target.value);
    if (value >= minRaise && value <= maxRaise) {
      setRaiseAmount(value);
    }
  };

  // Handle confirm raise
  const handleConfirmRaise = () => {
    onRaise(raiseAmount);
    setShowRaiseOptions(false);
  };

  if (!isActive) {
    return null;
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        p: 1,
        borderRadius: 2,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(5px)',
      }}
    >
      {showRaiseOptions ? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            mb: 2,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 1,
            }}
          >
            <Typography variant="body2" color="white">
              Raise to:
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <TextField
                value={raiseAmount}
                onChange={handleRaiseInputChange}
                variant="outlined"
                size="small"
                type="number"
                InputProps={{
                  inputProps: {
                    min: minRaise,
                    max: maxRaise,
                    style: { color: 'white', textAlign: 'right' }
                  },
                  sx: {
                    width: '100px',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: 1,
                    input: { color: 'white' },
                  }
                }}
              />
            </Box>
          </Box>
          
          <Slider
            value={raiseAmount}
            onChange={handleRaiseChange}
            min={minRaise}
            max={maxRaise}
            step={Math.max(1, Math.floor((maxRaise - minRaise) / 20))}
            valueLabelDisplay="auto"
            sx={{
              color: '#ff9800',
              '& .MuiSlider-thumb': {
                width: 20,
                height: 20,
                backgroundColor: '#fff',
                '&:hover, &.Mui-focusVisible': {
                  boxShadow: '0px 0px 0px 8px rgba(255, 152, 0, 0.16)'
                },
              },
              '& .MuiSlider-rail': {
                backgroundColor: 'rgba(255, 255, 255, 0.3)',
              },
            }}
          />
          
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1, gap: 2 }}>
            <Button
              variant="outlined"
              onClick={() => setShowRaiseOptions(false)}
              sx={{
                color: 'white',
                borderColor: 'rgba(255, 255, 255, 0.5)',
                '&:hover': {
                  borderColor: 'white',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                }
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleConfirmRaise}
              sx={{
                backgroundColor: '#ff9800',
                '&:hover': {
                  backgroundColor: '#f57c00',
                }
              }}
            >
              Confirm
            </Button>
          </Box>
        </Box>
      ) : (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: { xs: 1, sm: 2 },
            width: '100%',
          }}
        >
          <FoldButton onClick={onFold}>
            Fold
          </FoldButton>
          
          {canCheck ? (
            <CheckButton onClick={onCheck}>
              Check
            </CheckButton>
          ) : (
            <CallButton onClick={onCall}>
              Call {callAmount}
            </CallButton>
          )}
          
          {minRaise <= playerChips && (
            <RaiseButton onClick={() => setShowRaiseOptions(true)}>
              Raise
            </RaiseButton>
          )}
          
          <AllInButton onClick={onAllIn}>
            All In {playerChips}
          </AllInButton>
        </Box>
      )}
    </Box>
  );
};

export default ActionButtons; 