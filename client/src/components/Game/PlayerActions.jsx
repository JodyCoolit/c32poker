import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  Button, 
  Slider, 
  Typography,
  Fade,
  TextField,
  InputAdornment,
  CircularProgress
} from '@mui/material';
import { styled } from '@mui/material/styles';
import soundEffects from '../../utils/soundEffects';

// Styled components
const ActionsContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.5),
  backgroundColor: 'rgba(0, 0, 0, 0.9)',
  borderRadius: '6px',
  padding: theme.spacing(0.8),
  backdropFilter: 'blur(5px)',
  border: '1px solid rgba(19, 47, 101, 0.8)',
  boxShadow: '0 0 8px rgba(0, 0, 0, 0.6)',
  width: '100%',
  maxWidth: 300,
  margin: '0 auto',
  transformOrigin: 'center bottom',
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(0.6),
    maxWidth: 280,
  }
}));

const PrimaryActionsRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  gap: theme.spacing(0.4),
  width: '100%',
  marginBottom: theme.spacing(0.4),
}));

const SecondaryActionsRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  width: '100%',
  gap: theme.spacing(0.3),
  marginBottom: theme.spacing(0.4),
}));

// Action button styles
const ActionButton = styled(Button)(({ color, theme }) => ({
  fontWeight: 'bold',
  textTransform: 'uppercase',
  padding: theme.spacing(0.6),
  fontSize: '0.75rem',
  minHeight: '32px',
  color: 'white',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
  borderRadius: '4px',
  backgroundColor: color === 'error' 
    ? 'rgba(211, 47, 47, 0.95)' 
    : color === 'success' 
      ? 'rgba(46, 125, 50, 0.95)'
      : color === 'primary'
        ? 'rgba(25, 118, 210, 0.95)'
        : color === 'secondary'
          ? 'rgba(156, 39, 176, 0.95)'
          : 'rgba(69, 90, 100, 0.95)',
  '&:hover': {
    backgroundColor: color === 'error' 
      ? 'rgba(211, 47, 47, 1)' 
      : color === 'success' 
        ? 'rgba(46, 125, 50, 1)'
        : color === 'primary'
          ? 'rgba(25, 118, 210, 1)'
          : color === 'secondary'
            ? 'rgba(156, 39, 176, 1)'
            : 'rgba(69, 90, 100, 1)',
  },
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(0.4),
    fontSize: '0.65rem',
    minHeight: '28px',
  }
}));

// Bet amount input field
const BetInput = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    color: 'white',
    height: '32px',
    '& fieldset': {
      borderColor: 'rgba(255, 255, 255, 0.15)',
      borderWidth: '1px',
          },
    '&:hover fieldset': {
      borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#f5a623',
          },
    '& input': {
      padding: '6px 4px',
      textAlign: 'right',
      fontSize: '0.75rem',
    }
  },
  '& .MuiInputLabel-root': {
    color: 'rgba(255, 255, 255, 0.7)',
          },
  '& .MuiInputAdornment-root': {
    color: 'rgba(255, 255, 255, 0.7)',
    marginLeft: 2,
    '& p': {
      fontSize: '0.7rem',
    }
  },
}));

// Preset bet buttons
const PresetButton = styled(Button)(({ theme }) => ({
    flex: 1,
  minWidth: '48px',
  minHeight: '28px',
  fontSize: '0.7rem',
  padding: '0px',
  lineHeight: 1,
    color: 'white',
  backgroundColor: 'rgba(0, 0, 0, 0.75)',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  borderRadius: '3px',
  boxShadow: 'none',
  '&:hover': {
    backgroundColor: 'rgba(245, 166, 35, 0.2)',
    borderColor: '#f5a623',
  },
    [theme.breakpoints.down('sm')]: {
    fontSize: '0.65rem',
    padding: '0px',
    minHeight: '24px',
    minWidth: '40px',
    }
}));

// Styled slider
const StyledSlider = styled(Slider)(({ theme }) => ({
  color: '#f5a623',
  height: 6,
  padding: '10px 0',
  '& .MuiSlider-track': {
    border: 'none',
    backgroundImage: 'linear-gradient(90deg, #f5a623, #f9d423)',
  },
  '& .MuiSlider-thumb': {
    height: 16,
    width: 16,
    backgroundColor: '#fff',
    border: '2px solid #f5a623',
    boxShadow: '0 0 3px rgba(0,0,0,0.5)',
    '&:focus, &:hover, &.Mui-active': {
      boxShadow: '0 0 5px rgba(245, 166, 35, 0.5)',
    },
    },
  '& .MuiSlider-rail': {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  '& .MuiSlider-valueLabel': {
    fontSize: 10,
    padding: '2px 4px',
    backgroundColor: '#f5a623',
  },
}));

/**
 * Player Actions component
 * @param {Object} props - Component props
 */
const PlayerActions = ({
  isUserTurn = false,
  playerChips = 0,
  minBet = 0,
  currentBet = 0,
  pot = 0,
  canCheck = false,
  canRaise = false,
  canCall = false,
  loading = false,
  onCheck = () => {},
  onCall = () => {},
  onRaise = () => {},
  onFold = () => {},
  onAllIn = () => {},
  playerBetAmount = 0,
}) => {
  const [showRaiseOptions, setShowRaiseOptions] = useState(false);
  const [betAmount, setBetAmount] = useState(minBet);
  const [inputValue, setInputValue] = useState(minBet.toFixed(1));
  
  // Reference to input element
  const inputRef = useRef(null);
  
  // Min and max values for slider and input
  // If no previous bet (can check), minimum bet is 1BB
  // If previous bet exists, minimum raise is current bet + 1BB
  const minBetValue = canCheck ? 
    Math.max(minBet, 1) : // 1BB minimum bet when no previous bet
    Math.max(currentBet + 1, minBet); // current bet + 1BB minimum raise
  const maxBetValue = playerChips;
  
  // Calculate call amount - how much more the player needs to add to match the current bet
  // Ensure call amount never exceeds player's remaining chips
  const callAmount = Math.min(Math.max(0, currentBet - playerBetAmount), playerChips);
  
  // Debug log
  useEffect(() => {
    console.log('PlayerActions 状态:', {
      currentBet,
      playerBetAmount,
      callAmount,
      minBet,
      canCheck,
      minBetValue
    });
  }, [currentBet, playerBetAmount, callAmount, minBet, canCheck, minBetValue]);
  
  // Update bet amount when minimum bet changes
  useEffect(() => {
    const newAmount = Math.min(Math.max(currentBet * 2, minBet), playerChips);
    setBetAmount(newAmount);
    setInputValue(newAmount.toFixed(1));
  }, [currentBet, minBet, playerChips]);
  
  // Handle slider change
  const handleSliderChange = (_, newValue) => {
    setBetAmount(newValue);
    setInputValue(newValue.toFixed(1));
  };

  // Handle preset bet buttons
  const handlePresetBet = (percentage) => {
    let amount;
    
    // Calculate the effective pot for betting
    // If there's a current bet that the player needs to call first
    const needToCallAmount = Math.max(0, currentBet - playerBetAmount);
    const effectivePot = needToCallAmount > 0 ? pot + needToCallAmount : pot;
    console.log('当前下注:', currentBet)
    console.log('玩家已下注:', playerBetAmount);
    console.log('需要跟注金额:', needToCallAmount);
    console.log('有效底池:', effectivePot);
    
    switch(percentage) {
      case 33:
        amount = Math.round(effectivePot * 0.33 * 10) / 10;
        break;
      case 50:
        amount = Math.round(effectivePot * 0.5 * 10) / 10;
        break;
      case 75:
        amount = Math.round(effectivePot * 0.75 * 10) / 10;
        break;
      case 125:
        amount = Math.round(effectivePot * 1.25 * 10) / 10;
        break;
      case 'all-in':
        amount = playerChips;
        break;
      default:
        amount = effectivePot;
    }
    
    // If there's a current bet, add the call amount to the raise
    if (needToCallAmount > 0) {
      amount += needToCallAmount;
    }
    
    // Ensure amount is not less than the minimum required bet (minBetValue)
    amount = Math.max(amount, minBetValue);
    
    const validAmount = Math.min(Math.max(amount, minBetValue), maxBetValue);
    setBetAmount(validAmount);
    setInputValue(validAmount.toFixed(1));
  };
  
  // Handle input changes with validation for numeric values with one decimal place
  const handleInputChange = (event) => {
    const value = event.target.value;
    
    // Allow empty input, numbers, and numbers with one decimal place
    if (value === '' || /^\d+(\.\d{0,1})?$/.test(value)) {
      setInputValue(value);
      
      // Convert to number and update bet amount if valid
      if (value !== '') {
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) {
          // Constrain to min and max values
          const validAmount = Math.min(Math.max(numValue, minBetValue), maxBetValue);
          setBetAmount(validAmount);
        }
      }
    }
  };
  
  // Handle input blur - format and validate final value
  const handleInputBlur = () => {
    if (inputValue === '' || isNaN(parseFloat(inputValue))) {
      // Reset to minimum valid bet if empty or invalid
      setBetAmount(minBetValue);
      setInputValue(minBetValue.toFixed(1));
    } else {
      // Ensure value is within valid range and format with one decimal
      const numValue = parseFloat(inputValue);
      const validAmount = Math.min(Math.max(numValue, minBetValue), maxBetValue);
      setBetAmount(validAmount);
      setInputValue(validAmount.toFixed(1));
    }
  };

  // 预加载音效
  useEffect(() => {
    soundEffects.preloadSounds();
  }, []);

  // Handle raise/bet action
  const handleRaise = () => {
    // 播放下注音效
    soundEffects.playBetSound();
    
    if (betAmount >= playerChips * 0.99) {
      // If betting almost all chips, consider it an all-in
      onAllIn();
    } else {
      onRaise(betAmount);
    }
  };

  // Handle check or call
  const handleCheckOrCall = () => {
    if (canCheck) {
      // 播放让牌音效
      soundEffects.playCheckSound();
      onCheck();
    } else {
      // 播放下注音效（跟注也算下注）
      soundEffects.playBetSound();
      onCall();
    }
  };

  // 处理弃牌
  const handleFold = () => {
    // 播放弃牌音效
    soundEffects.playFoldSound();
    onFold();
  };

  // Don't render if it's not the user's turn
  if (!isUserTurn) {
    return null;
  }

  return (
    <Fade in={isUserTurn}>
      <ActionsContainer>
        {/* Top row: FOLD, CHECK, BET INPUT */}
        <PrimaryActionsRow>
          <ActionButton 
            color="primary" 
            variant="contained" 
            onClick={handleFold}
            disabled={loading}
            sx={{ flex: 0.9, bgcolor: 'rgb(25, 118, 210) !important', '&:hover': { bgcolor: 'rgb(21, 101, 192) !important' } }}
          >
            {loading ? <CircularProgress size={16} color="inherit" /> : 'FOLD'}
          </ActionButton>
          
          <ActionButton
            color="success" 
            variant="contained"
            onClick={handleCheckOrCall}
            disabled={loading}
            sx={{ flex: 0.9, bgcolor: 'rgb(46, 125, 50) !important', '&:hover': { bgcolor: 'rgb(39, 107, 43) !important' } }}
          >
            {loading ? 
              <CircularProgress size={16} color="inherit" /> : 
              (canCheck ? 'CHECK' : `CALL ${callAmount.toFixed(1)}`)}
          </ActionButton>
          
          <BetInput
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            size="small"
            inputRef={inputRef}
            InputProps={{
              endAdornment: <InputAdornment position="end">BB</InputAdornment>,
            }}
            sx={{ flex: 1 }}
          />
        </PrimaryActionsRow>
        
        {/* Bottom row: Preset buttons for pot sizes */}
        <Box>
          <SecondaryActionsRow>
            <PresetButton onClick={() => handlePresetBet(33)}>
              33%
            </PresetButton>
            <PresetButton onClick={() => handlePresetBet(50)}>
              50%
            </PresetButton>
            <PresetButton onClick={() => handlePresetBet(75)}>
              75%
            </PresetButton>
            <PresetButton onClick={() => handlePresetBet(125)}>
              125%
            </PresetButton>
            <PresetButton onClick={() => handlePresetBet('all-in')}>
              ALL-IN
            </PresetButton>
          </SecondaryActionsRow>

        {/* Bet slider */}
          <Box sx={{ px: 0.5, mb: 0.4 }}>
            <StyledSlider
              value={betAmount}
              onChange={handleSliderChange}
              min={minBetValue}
              max={maxBetValue}
              step={0.1}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => `${value.toFixed(1)}`}
              size="small"
            />

            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="caption" color="rgba(255,255,255,0.6)" sx={{ fontSize: '0.65rem' }}>
                Min: {minBetValue.toFixed(1)}
              </Typography>
              <Typography variant="caption" color="rgba(255,255,255,0.6)" sx={{ fontSize: '0.65rem' }}>
                Max: {maxBetValue.toFixed(1)}
              </Typography>
            </Box>
          </Box>
          
          {/* Confirmation button */}
              <Box>
            <ActionButton
              color="error"
                variant="contained"
                onClick={handleRaise}
                disabled={loading}
              fullWidth
              sx={{ minHeight: '36px', bgcolor: 'rgb(211, 47, 47) !important', '&:hover': { bgcolor: 'rgb(178, 40, 40) !important' } }}
              >
              {loading ? <CircularProgress size={18} color="inherit" /> : `RAISE TO ${betAmount.toFixed(1)}`}
            </ActionButton>
          </Box>
            </Box>
      </ActionsContainer>
    </Fade>
  );
};

export default PlayerActions; 