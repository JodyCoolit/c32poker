import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { styled } from '@mui/material/styles';
import { 
  Card, Button, Typography, Grid, Box, Paper, Dialog, 
  DialogActions, DialogContent, DialogTitle, TextField,
  CircularProgress, Chip, IconButton, Snackbar, Alert
} from '@mui/material';
import { useSnackbar } from 'notistack';
import PlayingCard from './PlayingCard';
import Seat from './Seat';
import PokerTable from './PokerTable';
import BetArea from './BetArea';
import PlayerActions from './PlayerActions';
import BlindsDisplay from './BlindsDisplay';
import RaiseDialog from './RaiseDialog';
import GameHistoryDialog from './GameHistoryDialog';
import PlayerListDialog from './PlayerListDialog';
import ChatBox from './ChatBox';
import { gameService, roomService } from '../../services/api';
import websocketService from '../../services/websocket';
import { toast } from 'react-hot-toast';
import AddIcon from '@mui/icons-material/Add';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import HistoryIcon from '@mui/icons-material/History';
import PeopleIcon from '@mui/icons-material/People';
import CardDealingAnimation from './CardDealingAnimation';
import dealingAnimationUtils from '../../utils/dealingAnimationUtils';
import DiscardedCard from './DiscardedCard';
import soundEffects from '../../utils/soundEffects';
import ChipsDistributionAnimation from './ChipsDistributionAnimation';

// 游戏表格容器样式
const GameTableContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  backgroundColor: '#1a2035',
  color: '#fff',
  padding: theme.spacing(0.5),
  position: 'relative',
  overflow: 'hidden',
}));

// 顶部工具栏
const TopBar = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: theme.spacing(0.5),
  padding: theme.spacing(0.5, 1),
  backgroundColor: 'rgba(0, 0, 0, 0.2)',
  borderRadius: theme.shape.borderRadius,
  height: '40px',
  zIndex: 10,
  position: 'relative',
}));

// 倒计时Banner
const CountdownBanner = styled(Box)(({ theme }) => ({
  padding: theme.spacing(0.5, 1.5),
  backgroundColor: 'rgba(0, 0, 0, 0.85)',
  color: '#fff',
  borderRadius: theme.shape.borderRadius,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  boxShadow: '0 2px 15px rgba(0,0,0,0.5)',
  border: '1px solid rgba(255,255,255,0.1)',
  backdropFilter: 'blur(4px)',
  minWidth: '100px',
  justifyContent: 'center',
  height: '24px',
  marginLeft: theme.spacing(1)
}));

const TimerText = styled(Typography)(({ theme }) => ({
  fontFamily: 'Roboto Mono, monospace',
  fontWeight: 'bold',
  fontSize: '0.85rem',
  color: theme.palette.primary.light,
  letterSpacing: '1px',
  lineHeight: 1,
}));

const CountdownIcon = styled(AccessTimeIcon)(({ theme }) => ({
  color: theme.palette.primary.light,
  fontSize: '14px',
}));

// 游戏桌面区域
const TableArea = styled(Box)(({ theme }) => ({
  flex: 1,
  position: 'relative',
  overflow: 'hidden',
  borderRadius: theme.shape.borderRadius,
  backgroundColor: 'rgba(19, 47, 101, 0.8)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  boxShadow: 'inset 0 0 30px rgba(0,0,0,0.5)',
  minHeight: '92vh',
}));


/**
 * 游戏桌组件
 * 用于展示扑克游戏界面，包括玩家座位、公共牌、玩家操作等
 */
const GameTable = () => {
    const navigate = useNavigate();
  const { roomId } = useParams();
  const { enqueueSnackbar } = useSnackbar();
  
  // 游戏状态
  const [gameState, setGameState] = useState({
    players: [],
    pot: 0,
    gamePhase: 'WAITING',  // 确保初始状态设置为WAITING
    turnPlayerId: '',
    dealerPosition: 0,
    activePlayers: [],
    communityCards: [],
    max_players: 8 // 设置默认最大玩家数
  });
  
  // 使用useRef跟踪上一次的游戏阶段，解决状态闭包问题
  const previousGamePhaseRef = useRef('WAITING');
  
  // 使用useRef跟踪上一次的handid，用于检测新游戏开始
  const previousHandIdRef = useRef(null);
  
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [recentlyDisconnected, setRecentlyDisconnected] = useState(false);
  
  // 玩家信息
  const [currentUser, setCurrentUser] = useState('');
  const [isUserTurn, setIsUserTurn] = useState(false);
  
  // UI状态
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });
  
  // 倒计时状态
  const [countdown, setCountdown] = useState(null);
  const [showCountdown, setShowCountdown] = useState(false);
  const countdownRef = useRef(null);
  
  // 对话框状态
  const [openRaiseDialog, setOpenRaiseDialog] = useState(false);
  const [openHistoryDialog, setOpenHistoryDialog] = useState(false);
  const [openPlayerListDialog, setOpenPlayerListDialog] = useState(false);
  const [openBuyInDialog, setOpenBuyInDialog] = useState(false);
  const [changeSeatDialogOpen, setChangeSeatDialogOpen] = useState(false);
  
  // 买入相关状态
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [seatDisplayData, setSeatDisplayData] = useState([]);
  const [buyInAmount, setBuyInAmount] = useState('');
  const [raiseAmount, setRaiseAmount] = useState('');
  const [showCards, setShowCards] = useState({});
  
  // 历史记录状态
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  
  // 摊牌阶段信息
  const [showdownInfo, setShowdownInfo] = useState({
    players: [],
    communityCards: [],
    winners: [],
    pot: { main: 0, sidePots: [] }
  });
  
  // 在GameTable组件内部，useEffect hook中定义的地方
  // 创建一个Map来跟踪最近处理过的消息，防止重复
  const recentNotifications = useRef(new Map());
  
  // 在组件顶部的状态声明中，添加新的状态变量
  const [currentPlayerSeatInfo, setCurrentPlayerSeatInfo] = useState(null);
  const [currentPlayerPosition, setCurrentPlayerPosition] = useState(-1);
  
  // 添加换牌相关状态
  const [playerHand, setPlayerHand] = useState([]);
  const [selectedCardIndex, setSelectedCardIndex] = useState(-1); // 添加选中的牌索引状态
  const [discardedCard, setDiscardedCard] = useState(null); // 添加弃掉的牌状态
  
  // 在GameTable组件内添加当前玩家轮次计时状态
  const [playerTurnTime, setPlayerTurnTime] = useState({});
  const [currentPlayerTurnInfo, setCurrentPlayerTurnInfo] = useState({
    currentPlayerIdx: -1,
    remainingTime: 30,
    totalTime: 30
  });
  
  // 获取玩家位置名称
  const getPositionName = (position, dealerPos, playerCount) => {
    // 根据庄家位置计算各个位置名称，为9人桌提供更多位置名称
    const positions = ['SB', 'BB', 'UTG', 'UTG+1', 'MP', 'MP+1', 'HJ', 'CO', 'BTN'];
    const offset = (position - dealerPos + playerCount) % playerCount;
    return positions[offset] || '';
  };
  
  // 游戏桌组件的初始化时设置座位数
  const initializeSeats = useCallback(() => {
    try {
      console.log("===== 开始初始化座位 =====");
      
      // 添加详细的游戏状态调试信息
      console.log(`DEBUG - 当前游戏状态:`, {
        dealerIdx: gameState.game?.dealer_idx,
        currentPlayerIdx: gameState.game?.current_player_idx,
        players: gameState.game?.players?.map(p => `${p.name}(位置${p.position},下注${p.bet_amount})`)
      });
      
      // 从gameState获取最大玩家数
      const maxPlayers = gameState?.max_players || 8;
      console.log("初始化座位，最大玩家数:", maxPlayers);
      
      // 优先从gameState.game中获取玩家信息，没有再从gameState中获取
      let players = [];
      if (gameState?.game?.players && Array.isArray(gameState.game.players)) {
        players = gameState.game.players;
        console.log("从gameState.game中获取玩家列表:", players.length);
        console.log("DEBUG - 玩家原始数据:", players.map(p => ({
          name: p.name,
          position: p.position,
          bet_amount: p.bet_amount,
          isDealer: p.position === gameState.game?.dealer_idx
        })));
      } else if (gameState?.players && Array.isArray(gameState.players)) {
        players = gameState.players;
        console.log("从gameState中获取玩家列表:", players.length);
      } else {
        console.log("无法获取玩家列表，使用空数组初始化");
      }
      
      // 找到当前玩家的逻辑位置
      const currentPlayerObj = players.find(p => 
        p.name === currentUser || p.username === currentUser
      );
      
      // 获取当前玩家的位置，如果未找到则为-1
      const currentPlayerPosition = currentPlayerObj ? 
        (typeof currentPlayerObj.position === 'string' ? 
          parseInt(currentPlayerObj.position, 10) : currentPlayerObj.position) : -1;
      
      // 保存当前玩家位置状态
      setCurrentPlayerPosition(currentPlayerPosition);
      console.log("当前玩家位置:", currentPlayerPosition);
      
      // 创建座位显示数据
      const displayData = [];
      
      for (let i = 0; i < maxPlayers; i++) {
        // 计算UI显示位置 - 根据当前玩家的位置进行旋转
        // 当前玩家应该显示在底部位置(位置0)
        let uiPosition;
        
        if (currentPlayerPosition >= 0) {
          // 如果找到了当前玩家的位置，就根据当前玩家位置计算其他位置的偏移
          uiPosition = (i - currentPlayerPosition + maxPlayers) % maxPlayers;
        } else {
          // 如果没有找到当前玩家，就使用默认布局
          uiPosition = i;
        }
        
        // 查找在这个位置的玩家 - 只显示已经入座的玩家（position 有效值）
        const player = players.find(p => {
          // 确保position是数字进行比较
          const playerPos = typeof p.position === 'string' ? 
                          parseInt(p.position, 10) : p.position;
          
          // 只有当position是有效的非负整数时才认为玩家已入座
          return playerPos === i && playerPos >= 0;
        });
        
        // 获取当前用户名，用于标识当前玩家
        const currentUsername = currentUser;
        
        // 创建座位数据
        const isCurrentPlayer = player && (
          player.name === currentUsername || 
          player.username === currentUsername
        );
        
        // 直接使用dealer_idx
        const isDealer = gameState.game?.dealer_idx !== undefined && i === gameState.game.dealer_idx;
        if (isDealer) {
          console.log(`识别庄家位置: 位置${i}(${player?.name || '空座位'}), dealer_idx=${gameState.game?.dealer_idx}`);
        }
        
        // 从游戏状态中直接获取下注金额
        let betAmount = 0;
        
        // 从玩家对象中获取下注金额
        if (player?.bet_amount !== undefined) {
          // 使用玩家对象中的bet_amount
          betAmount = player.bet_amount;
          if (betAmount > 0) {
            console.log(`从player.bet_amount获取座位${i}下注额: ${betAmount}, 玩家=${player.name}, 是否庄家=${isDealer}, 逻辑位置=${player.position}`);
          }
        } else if (player?.betAmount !== undefined) {
          // 兼容性处理：有些地方可能用驼峰命名法
          betAmount = player.betAmount;
          if (betAmount > 0) {
            console.log(`从player.betAmount获取座位${i}下注额: ${betAmount}`);
          }
        } else if (player?.current_bet !== undefined) {
          // 兼容旧版属性名
          betAmount = player.current_bet;
          if (betAmount > 0) {
            console.log(`从player.current_bet获取座位${i}下注额: ${betAmount}`);
          }
        }
        
        const seatData = {
          id: i,
          position: uiPosition,  // UI显示位置
          realPosition: i,       // 保留实际逻辑位置
          player: player ? {
            ...player,
            // 确保玩家有手牌数据，如果没有设置默认空数组
            hand: player.hand || [],
            // 添加是否有手牌的标志
            hasHand: player.hand?.length > 0 || gameState.status === 'playing'
          } : null,
          // 修改isActive判断，与current_player_idx直接比较
          isActive: player && (i === gameState.current_player_idx || i === gameState.game?.current_player_idx),
          isDealer: isDealer,
          positionName: player ? getPositionName(i, gameState.game?.dealer_idx || 0, players.length) : '',
          lastAction: player?.lastAction || '',
          betAmount: betAmount, // 使用上面确定的betAmount值
          isCurrentUser: isCurrentPlayer,
          // 添加游戏状态
          gameStarted: gameState.status === 'playing' || gameState.isGameStarted,
          inActiveGame: player && player.position >= 0 && gameState.status === 'playing',
          // 添加思考时间信息 - 同时使用isTurn和isActive标记当前玩家
          isTurn: i === currentPlayerTurnInfo.currentPlayerIdx || i === gameState.current_player_idx || i === gameState.game?.current_player_idx,
          turnTimeRemaining: (i === currentPlayerTurnInfo.currentPlayerIdx) ? 
            currentPlayerTurnInfo.remainingTime : 
            playerTurnTime[i]?.turnTimeRemaining || 0,
          turnTimeLimit: (i === currentPlayerTurnInfo.currentPlayerIdx) ? 
            currentPlayerTurnInfo.totalTime : 
            playerTurnTime[i]?.turnTimeLimit || 30
        };
        
        displayData.push(seatData);
      }
      
      // Debug info
      console.log("座位显示数据 详细信息:");
      displayData.forEach(seat => {
        console.log(`UI位置${seat.position}(逻辑${seat.realPosition}): ${seat.player?.name || '空'}, 下注=${seat.betAmount}, 是否庄家=${seat.isDealer}`);
      });
      
      console.log("座位显示数据 (已按UI位置排序):", displayData.map(s => 
        `位置${s.position}(逻辑${s.realPosition}): ${s.player ? s.player.name : '空'}`
      ));
      
      // 更新座位显示数据
      setSeatDisplayData(displayData);
      
      console.log("===== 座位初始化完成 =====");
    } catch (error) {
      console.error("座位初始化出错:", error);
      console.error("错误堆栈:", error.stack);
    }
  }, [gameState, currentUser, playerTurnTime, currentPlayerTurnInfo]);
  
  // 在gameState或currentUser更新时初始化座位
  useEffect(() => {
    // 仅在开发模式下输出详细日志，且只在DEBUG模式下
    const DEBUG_LOG = true; // 设置为false关闭日志
    
    if (DEBUG_LOG && process.env.NODE_ENV === 'development') {
      console.log("===== gameState或currentUser发生变化，检查是否需要初始化座位 =====");
      
      // 只在真正需要时才输出详细日志
      if (gameState && gameState.players) {
        console.log("gameState:", gameState.players.length, "玩家");
      }
      
      console.log("currentUser:", currentUser);
      console.log("gameState:", gameState);
      console.log("seatDisplayData:", seatDisplayData);
    }
    
    // 仅当gameState和currentUser都有值时才初始化座位
    if (gameState && currentUser) {
      // 检查是否真正需要更新座位
      const needSeatUpdate = doesNeedSeatUpdate(gameState, seatDisplayData);
      
      if (needSeatUpdate) {
        if (DEBUG_LOG && process.env.NODE_ENV === 'development') {
          console.log("检测到座位数据需要更新，重新初始化座位");
        }
        initializeSeats();
      } else if (DEBUG_LOG && process.env.NODE_ENV === 'development') {
        console.log("座位数据无实质变化，跳过初始化");
      }
    }
  }, [gameState, currentUser]);
  
  // 辅助函数：判断是否需要更新座位
  const doesNeedSeatUpdate = useCallback((newGameState, currentSeatData) => {
    // 如果没有座位数据，则需要初始化
    if (!currentSeatData || currentSeatData.length === 0) {
      return true;
    }

    // 获取玩家列表 - 兼容两种数据结构
    const players = newGameState.game?.players || newGameState.players || [];
    
    // 如果玩家数量变化，则需要更新
    const activePlayers = currentSeatData.filter(seat => seat.player).length;
    const newPlayerCount = players.length || 0;
    
    if (activePlayers !== newPlayerCount) {
      return true;
    }
    
    // 检查现有玩家的位置或状态是否发生变化
    let hasPlayerChanged = false;
    
    players.forEach(player => {
      const playerName = player.name || player.username;
      const playerPosition = player.position !== undefined ? player.position : -1;
      
      // 查找此玩家在当前座位数据中的信息
      const existingSeat = currentSeatData.find(seat => 
        seat.player && (seat.player.name === playerName || seat.player.username === playerName)
      );
      
      // 如果找不到玩家，或者位置变化，或者状态变化，则需要更新
      if (!existingSeat || 
          existingSeat.logicalPosition !== playerPosition ||
          existingSeat.player.status !== (player.status || '未知') ||
          existingSeat.player.chips !== (player.chips || 0)) {
        hasPlayerChanged = true;
      }
    });
    
    return hasPlayerChanged;
  }, []);
  
  // 处理游戏开始倒计时
  useEffect(() => {
    // 记录完整的游戏状态，帮助调试
    if (process.env.NODE_ENV === 'development') {
      console.log('===== 检查倒计时条件 =====');
      console.log('gamePhase:', gameState?.gamePhase);
      console.log('status:', gameState?.status);
      console.log('game_end_time:', gameState?.game_end_time);
      console.log('remaining_time:', gameState?.remaining_time);
      console.log('game对象:', gameState?.game);
      
      // 检查game对象中是否有游戏阶段信息
      if (gameState?.game) {
        console.log('game.game_phase:', gameState.game.game_phase);
        console.log('game.state:', gameState.game.state);
      }
    }
    
    // 检查是否应该显示倒计时
    if (gameState && gameState.game_end_time) {
      try {
        // 获取游戏阶段（优先从gamePhase字段获取，然后从game.game_phase字段获取）
        const gamePhase = gameState.game ? gameState.game.game_phase : null;
        
        // 记录当前游戏阶段
        console.log('当前游戏阶段:', gamePhase || '未定义');
        
        // 解析服务器返回的结束时间
        const endTime = new Date(gameState.game_end_time);
        const now = new Date();
        
        // 计算剩余时间（秒）
        const remainingTimeInSeconds = Math.floor((endTime - now) / 1000);
        
        console.log(`解析游戏结束时间: ${endTime}, 剩余秒数: ${remainingTimeInSeconds}`);
        
        if (remainingTimeInSeconds > 0) {
          // 设置倒计时时间（秒）
          console.log('游戏结束倒计时:', remainingTimeInSeconds, '秒');
          setCountdown(remainingTimeInSeconds);
          setShowCountdown(true);
          
          // 清除之前的倒计时
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
          }
          
          // 设置新的倒计时计时器
          countdownRef.current = setInterval(() => {
            setCountdown(prev => {
              // 当倒计时结束时
              if (prev <= 1) {
                clearInterval(countdownRef.current);
                setShowCountdown(false);
                return null;
              }
              return prev - 1;
            });
          }, 1000);
        }
      } catch (error) {
        console.error('解析游戏结束时间出错:', error);
      }
    } else {
      // 游戏不满足显示倒计时条件
      console.log('不满足倒计时条件，清除现有倒计时');
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
      setShowCountdown(false);
      setCountdown(null);
    }
    
    // 组件卸载时清理倒计时
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [gameState]);
  
  // 玩家动作处理函数
  const handleAction = async (action, amount = 0) => {
    if (!roomId) {
      console.error('执行动作失败: 缺少房间ID');
      return;
    }
    
    try {
      setLoading(true);
      console.log(`执行动作: ${action}, 金额: ${amount}`);
      
      // 检查WebSocket连接状态
      if (!websocketService.isConnected) {
        throw new Error('WebSocket未连接，请刷新页面重试');
      }
      
      // 清除思考时间计时器
      if (playerTurnTimerRef.current) {
        console.log('玩家执行操作，清除思考时间计时器');
        clearInterval(playerTurnTimerRef.current);
        playerTurnTimerRef.current = null;
      }
      
      // 使用gameService通过WebSocket发送玩家动作
      await gameService.playerAction(roomId, action, amount);
      
      console.log('玩家动作请求已发送');
      
      // 播放特定动作的音效
      if (action === 'stand_up') {
        // 播放站起音效
        soundEffects.playStandUpSound();
      }
      
      // 显示成功消息
      setNotification({
        open: true,
        message: `已执行${getActionText(action)}${amount > 0 ? `: ${amount} BB` : ''}`,
        severity: 'success',
        autoHideDuration: 3000
      });
      
    } catch (error) {
      console.error(`执行${action}失败:`, error);
      
      // 显示错误消息
      setNotification({
        open: true,
        message: error.message || `执行${getActionText(action)}失败，请重试`,
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };
  
  // 注册房间更新事件监听器
  const roomUpdateHandler = (data) => {
    console.log('===== 收到房间更新消息 =====');
    console.log('操作类型:', data.action);
    console.log('操作玩家:', data.player);
    console.log('操作结果:', data.result?.success ? '成功' : '失败', data.result?.message || '');
    console.log('服务器消息:', data.message || '无');
    console.log('时间戳:', new Date(data.timestamp * 1000).toLocaleTimeString());
    
    // 检查房间状态是否存在
    if (!data.room_state) {
      console.error('房间更新消息中缺少room_state数据');
      return;
    }
    
    // 详细解析和记录房间状态信息
    console.log('===== 房间详细状态 =====');
    console.log(`房间ID: ${data.room_state.id || data.room_state.room_id || '未知'}`);
    console.log(`房间阶段: ${data.room_state.status || '未知'}`);
    console.log(`最大玩家数: ${data.room_state.max_players || 8}`);
    console.log(`当前玩家数: ${data.room_state.game?.players?.length || 0}`);
    
    // 特别检查入座操作，并记录详细的座位信息
    if (data.action === 'sit_down') {
      console.log('===== 入座操作详情 =====');
      console.log(`玩家 ${data.player} 入座在位置 ${data.seat_index !== undefined ? data.seat_index : '未知'}`);
      console.log(`入座结果: ${data.result.success ? '成功' : '失败'}, ${data.result.message || ''}`);
    }
    
    // 如果是买入操作，记录买入金额作为初始筹码
    if (data.action === 'buy_in' && data.result?.success && data.player && data.amount) {
      console.log(`玩家 ${data.player} 买入操作，金额: ${data.amount} BB`);
      console.log('买入操作结果数据:', JSON.stringify(data.result));
      
      // 尝试从message中解析出总筹码数量
      let totalChips = null;
      // 尝试从结果中解析总买入数量 - 将来服务器会返回这个字段
      let totalBuyIn = null;
      
      if (data.result && data.result.message) {
        // 尝试匹配 "买入成功，总筹码: XXX" 格式
        const match = data.result.message.match(/总筹码:\s*(\d+\.?\d*)/);
        if (match && match[1]) {
          totalChips = parseFloat(match[1]);
          // 暂时使用总筹码数作为总买入 - 将来服务器会直接返回总买入字段
          totalBuyIn = totalChips;
          console.log(`从结果消息解析出总筹码/总买入: ${totalChips} BB`);
          
          // 更新玩家的原始买入缓存 - 这是总买入金额
          updatePlayerBuyInCache(data.player, totalBuyIn);
        }
      }
      
      // 当服务器返回总买入字段后，优先使用该字段
      if (data.result && data.result.total_buy_in !== undefined) {
        totalBuyIn = Number(data.result.total_buy_in);
        console.log(`服务器返回的总买入金额: ${totalBuyIn} BB`);
        updatePlayerBuyInCache(data.player, totalBuyIn);
      }
      
      // 更新玩家的初始筹码信息
      if (data.room_state.game && data.room_state.game.players) {
        const playerIndex = data.room_state.game.players.findIndex(
          p => p.name === data.player || p.username === data.player
        );
        
        if (playerIndex >= 0) {
          console.log(`更新玩家 ${data.player} 的初始筹码信息`);
          
          // 如果玩家之前没有初始筹码记录，则设置初始筹码
          if (!data.room_state.game.players[playerIndex].initialChips && 
              !data.room_state.game.players[playerIndex].initial_chips) {
            
            console.log(`为玩家 ${data.player} 设置初始筹码: ${data.amount} BB`);
            // 设置初始筹码为买入金额
            data.room_state.game.players[playerIndex].initialChips = Number(data.amount);
            data.room_state.game.players[playerIndex].initial_chips = Number(data.amount);
          } else {
            // 如果已有初始筹码记录，则累加买入金额
            const prevInitialChips = 
              data.room_state.game.players[playerIndex].initialChips || 
              data.room_state.game.players[playerIndex].initial_chips || 0;
              
            const newInitialChips = prevInitialChips + Number(data.amount);
            console.log(`为玩家 ${data.player} 更新初始筹码: ${prevInitialChips} + ${data.amount} = ${newInitialChips} BB`);
            
            data.room_state.game.players[playerIndex].initialChips = newInitialChips;
            data.room_state.game.players[playerIndex].initial_chips = newInitialChips;
          }

          // 确认玩家当前筹码是否已更新，若未更新则手动更新
          if (totalChips !== null) {
            // 如果从message解析出了总筹码，直接使用
            console.log(`使用从消息解析的总筹码: ${totalChips} BB`);
            data.room_state.game.players[playerIndex].chips = totalChips;
            
            // 重要：设置原始买入值，之后不再变化
            if (!data.room_state.game.players[playerIndex]._original_buy_in) {
              console.log(`为玩家 ${data.player} 设置原始买入金额: ${totalChips} BB, 后续不变`);
              data.room_state.game.players[playerIndex]._original_buy_in = totalChips;
            }
          } else if (data.result && data.result.chips) {
            console.log(`更新玩家 ${data.player} 当前筹码为: ${data.result.chips} BB`);
            data.room_state.game.players[playerIndex].chips = Number(data.result.chips);
            
            // 重要：设置原始买入值，之后不再变化
            if (!data.room_state.game.players[playerIndex]._original_buy_in) {
              console.log(`为玩家 ${data.player} 设置原始买入金额: ${data.result.chips} BB, 后续不变`);
              data.room_state.game.players[playerIndex]._original_buy_in = Number(data.result.chips);
            }
          } else {
            // 累加筹码
            const newChips = (data.room_state.game.players[playerIndex].chips || 0) + Number(data.amount);
            data.room_state.game.players[playerIndex].chips = newChips;
            console.log(`手动累加玩家 ${data.player} 当前筹码为: ${newChips} BB`);
            
            // 重要：设置原始买入值，之后不再变化
            if (!data.room_state.game.players[playerIndex]._original_buy_in) {
              console.log(`为玩家 ${data.player} 设置原始买入金额: ${newChips} BB, 后续不变`);
              data.room_state.game.players[playerIndex]._original_buy_in = newChips;
            }
          }
        }
      } else if (data.room_state.players) {
        const playerIndex = data.room_state.players.findIndex(
          p => p.name === data.player || p.username === data.player
        );
        
        if (playerIndex >= 0) {
          console.log(`更新玩家 ${data.player} 的初始筹码信息(room_state.players)`);
          
          // 如果玩家之前没有初始筹码记录，则设置初始筹码
          if (!data.room_state.players[playerIndex].initialChips && 
              !data.room_state.players[playerIndex].initial_chips) {
            
            console.log(`为玩家 ${data.player} 设置初始筹码: ${data.amount} BB`);
            // 设置初始筹码为买入金额
            data.room_state.players[playerIndex].initialChips = Number(data.amount);
            data.room_state.players[playerIndex].initial_chips = Number(data.amount);
          } else {
            // 如果已有初始筹码记录，则累加买入金额
            const prevInitialChips = 
              data.room_state.players[playerIndex].initialChips || 
              data.room_state.players[playerIndex].initial_chips || 0;
              
            const newInitialChips = prevInitialChips + Number(data.amount);
            console.log(`为玩家 ${data.player} 更新初始筹码: ${prevInitialChips} + ${data.amount} = ${newInitialChips} BB`);
            
            data.room_state.players[playerIndex].initialChips = newInitialChips;
            data.room_state.players[playerIndex].initial_chips = newInitialChips;
          }

          // 确认玩家当前筹码是否已更新，若未更新则手动更新
          if (totalChips !== null) {
            // 如果从message解析出了总筹码，直接使用
            console.log(`使用从消息解析的总筹码: ${totalChips} BB`);
            data.room_state.players[playerIndex].chips = totalChips;
            
            // 重要：设置原始买入值，之后不再变化
            if (!data.room_state.players[playerIndex]._original_buy_in) {
              console.log(`为玩家 ${data.player} 设置原始买入金额: ${totalChips} BB, 后续不变`);
              data.room_state.players[playerIndex]._original_buy_in = totalChips;
            }
          } else if (data.result && data.result.chips) {
            console.log(`更新玩家 ${data.player} 当前筹码为: ${data.result.chips} BB`);
            data.room_state.players[playerIndex].chips = Number(data.result.chips);
            
            // 重要：设置原始买入值，之后不再变化
            if (!data.room_state.players[playerIndex]._original_buy_in) {
              console.log(`为玩家 ${data.player} 设置原始买入金额: ${data.result.chips} BB, 后续不变`);
              data.room_state.players[playerIndex]._original_buy_in = Number(data.result.chips);
            }
          } else {
            // 累加筹码
            const newChips = (data.room_state.players[playerIndex].chips || 0) + Number(data.amount);
            data.room_state.players[playerIndex].chips = newChips;
            console.log(`手动累加玩家 ${data.player} 当前筹码为: ${newChips} BB`);
            
            // 重要：设置原始买入值，之后不再变化
            if (!data.room_state.players[playerIndex]._original_buy_in) {
              console.log(`为玩家 ${data.player} 设置原始买入金额: ${newChips} BB, 后续不变`);
              data.room_state.players[playerIndex]._original_buy_in = newChips;
            }
          }
        }
      }
    }
    
    // 详细记录所有玩家的位置信息
    if (data.room_state.game && data.room_state.game.players && data.room_state.game.players.length > 0) {
      console.log('===== 玩家位置详情 =====');
      data.room_state.game.players.forEach((player, index) => {
        const playerName = player.name || player.username || `玩家${index}`;
        const position = player.position !== undefined ? player.position : 
                       (player.seat !== undefined ? player.seat : 
                        player.seat_id !== undefined ? player.seat_id : '未分配');
        
        console.log(`${playerName}: 逻辑位置=${position}, 筹码=${player.chips || 0}`);
        
        // 修复position类型问题 - 确保是数字
        if (position !== '未分配') {
          player.position = Number(position);
        } else {
          // 确保未分配座位的玩家position属性为-1或null，而不是字符串"未分配"
          player.position = null;
        }
      });
    } else if (data.room_state.players && data.room_state.players.length > 0) {
      // 兼容旧版API，如果game对象中没有players，则使用room_state中的players
      console.log('===== 玩家位置详情 (使用room_state.players) =====');
      data.room_state.players.forEach((player, index) => {
        const playerName = player.name || player.username || `玩家${index}`;
        const position = player.position !== undefined ? player.position : 
                       (player.seat !== undefined ? player.seat : 
                        player.seat_id !== undefined ? player.seat_id : '未分配');
        
        console.log(`${playerName}: 逻辑位置=${position}, 筹码=${player.chips || 0}`);
        
        // 修复position类型问题 - 确保是数字
        if (position !== '未分配') {
          player.position = Number(position);
        } else {
          // 确保未分配座位的玩家position属性为-1或null，而不是字符串"未分配"
          player.position = null;
        }
      });
    }
    
    // 确保深拷贝房间状态并更新React状态
    const newGameState = JSON.parse(JSON.stringify(data.room_state));
    
    // 在游戏状态更新前，对所有玩家进行处理，确保保存原始买入值
    if (newGameState.players && Array.isArray(newGameState.players)) {
      newGameState.players.forEach(player => {
        // 如果还没有设置原始买入值，则当成首次买入，使用当前筹码作为原始买入
        if (!player._original_buy_in && player.chips > 0) {
          console.log(`为玩家 ${player.name || player.username} 设置首次原始买入值: ${player.chips} BB`);
          player._original_buy_in = player.chips;
        }
      });
    }
    
    if (newGameState.game && newGameState.game.players && Array.isArray(newGameState.game.players)) {
      newGameState.game.players.forEach(player => {
        // 如果还没有设置原始买入值，则当成首次买入，使用当前筹码作为原始买入
        if (!player._original_buy_in && player.chips > 0) {
          console.log(`为玩家 ${player.name || player.username} 设置首次原始买入值(game): ${player.chips} BB`);
          player._original_buy_in = player.chips;
        }
      });
    }
    
    
    // 查找当前用户并更新currentPlayer状态
    if (data.room_state.game && data.room_state.game.players && currentUser) {
      const currentPlayerData = data.room_state.game.players.find(p => 
        p.name === currentUser || p.username === currentUser
      );
      
      if (currentPlayerData) {
        console.log(`找到当前用户 ${currentUser} 数据:`, currentPlayerData);
        
        // 规范化位置属性，优先使用position
        const playerPosition = currentPlayerData.position !== undefined ? currentPlayerData.position : 
                            (currentPlayerData.seat !== undefined ? currentPlayerData.seat : 
                             currentPlayerData.seat_id !== undefined ? currentPlayerData.seat_id : -1);
        
        // 使用统一的position属性
        const updatedPlayer = {
          ...currentPlayerData,
          // 确保position为数字，无效则为-1
          position: (playerPosition !== null && playerPosition !== undefined && playerPosition !== '未分配') 
                   ? Number(playerPosition) : -1
        };
        
        console.log(`更新当前玩家，位置: ${updatedPlayer.position}`);
        setCurrentPlayer(updatedPlayer);
        
        // 更新当前位置状态，用于后续UI操作
        setCurrentPlayerPosition(updatedPlayer.position);
      } else if (data.room_state.players) {
        // 如果在game中没找到，尝试从room_state.players中查找
        const currentPlayerData = data.room_state.players.find(p => 
          p.name === currentUser || p.username === currentUser
        );
        
        if (currentPlayerData) {
          console.log(`在room_state.players中找到当前用户 ${currentUser} 数据:`, currentPlayerData);
          
          // 规范化位置属性，优先使用position
          const playerPosition = currentPlayerData.position !== undefined ? currentPlayerData.position : 
                              (currentPlayerData.seat !== undefined ? currentPlayerData.seat : 
                               currentPlayerData.seat_id !== undefined ? currentPlayerData.seat_id : -1);
          
          // 使用统一的position属性
          const updatedPlayer = {
            ...currentPlayerData,
            // 确保position为数字，无效则为-1
            position: (playerPosition !== null && playerPosition !== undefined && playerPosition !== '未分配') 
                     ? Number(playerPosition) : -1
          };
          
          console.log(`更新当前玩家，位置: ${updatedPlayer.position}`);
          setCurrentPlayer(updatedPlayer);
          
          // 更新当前位置状态，用于后续UI操作
          setCurrentPlayerPosition(updatedPlayer.position);
        } else {
          console.log(`未在玩家列表中找到当前用户 ${currentUser}`);
        }
      } else {
        console.log(`未在玩家列表中找到当前用户 ${currentUser}`);
      }
    } else if (data.room_state.players && currentUser) {
      // 兼容旧版API，仅当无法从game对象获取时使用
      const currentPlayerData = data.room_state.players.find(p => 
        p.name === currentUser || p.username === currentUser
      );
      
      if (currentPlayerData) {
        console.log(`找到当前用户 ${currentUser} 数据:`, currentPlayerData);
        
        // 规范化位置属性，优先使用position
        const playerPosition = currentPlayerData.position !== undefined ? currentPlayerData.position : 
                            (currentPlayerData.seat !== undefined ? currentPlayerData.seat : 
                             currentPlayerData.seat_id !== undefined ? currentPlayerData.seat_id : -1);
        
        // 使用统一的position属性
        const updatedPlayer = {
          ...currentPlayerData,
          // 确保position为数字，无效则为-1
          position: (playerPosition !== null && playerPosition !== undefined && playerPosition !== '未分配') 
                   ? Number(playerPosition) : -1
        };
        
        console.log(`更新当前玩家，位置: ${updatedPlayer.position}`);
        setCurrentPlayer(updatedPlayer);
        
        // 更新当前位置状态，用于后续UI操作
        setCurrentPlayerPosition(updatedPlayer.position);
      } else {
        console.log(`未在玩家列表中找到当前用户 ${currentUser}`);
      }
    }
    
    // 处理操作响应，显示提示消息
    if (data.action && data.result) {
      // 无论操作是否成功，都重置loading状态
      setLoading(false);
      
      if (data.result.success) {
        // 操作成功提示
        switch (data.action) {
          case 'buy_in':
            console.log('买入成功处理');
            setOpenBuyInDialog(false);
            setBuyInAmount('');
            setErrorMessage('');
            toast.success(`买入成功: ${data.amount || ''} BB`);
            break;
            
          case 'sit_down':
            console.log('入座成功处理');
            toast.success('入座成功');
            break;
            
          case 'stand_up':
            toast.success('站起成功');
            break;
            
          case 'change_seat':
            console.log('换座成功处理');
            toast.success('换座成功');
            setChangeSeatDialogOpen(false);
            break;
            
          case 'start_game':
            toast.success('游戏开始');
            break;
            
          default:
            toast.success(`${data.action}操作成功`);
        }
      } else {
        // 操作失败处理
        console.error(`${data.action}操作失败:`, data.result.message);
        
        switch (data.action) {
          case 'buy_in':
            setOpenBuyInDialog(false);
            setBuyInAmount('');
            setErrorMessage('');
            toast.error(`买入失败: ${data.result.message || '未知错误'}`);
            break;
            
          case 'change_seat':
            console.log('换座失败处理');
            setChangeSeatDialogOpen(false);
            toast.error(`换座失败: ${data.result.message || '未知错误'}`);
            break;
            
          default:
            toast.error(data.result.message || `${data.action}操作失败`);
        }
      }
    }
    
    // 更新状态
    setGameState(newGameState);
    
    console.log('room_update处理完成，状态已更新');
  };
  
  // 买入操作
        const handleBuyIn = async () => {
    console.log(`执行买入操作: 金额=${buyInAmount}, 座位=${selectedSeat}`);
    
    // 验证买入金额
    if (!buyInAmount || isNaN(buyInAmount) || buyInAmount < 1) {
      setErrorMessage('请输入有效的买入金额（至少1 BB）');
      return;
    }
    
    setErrorMessage(''); // 清除之前的错误信息
    setLoading(true);

    // 创建一个超时引用，用于清理
    const timeoutId = setTimeout(() => {
      if (loading) {
        setLoading(false);
        setOpenBuyInDialog(false);
        toast('服务器响应超时，请检查是否买入成功', {
          icon: '⚠️',
        });
      }
    }, 10000); // 10秒超时
    
    try {
      // 确保发送数值类型而非字符串
      const buyInAmountValue = Number(buyInAmount);
      const seatIndexValue = Number(selectedSeat);
      
      console.log(`发送买入请求: 金额=${buyInAmountValue}, 座位=${seatIndexValue}`);
      
      // 检查WebSocket连接状态
      if (!websocketService.isConnected) {
        throw new Error('WebSocket未连接，请刷新页面重试');
      }
      
      // 使用gameService通过WebSocket发送买入请求
      const response = await gameService.playerBuyIn(roomId, buyInAmountValue, seatIndexValue);
      console.log('买入请求已发送:', response);
    } catch (error) {
      console.error('买入失败:', error);
      setErrorMessage(error.message || '买入失败，请稍后重试');
      setLoading(false);
      clearTimeout(timeoutId);
    }
    
    return () => clearTimeout(timeoutId); // 清理超时
  };
  
  // 直接入座
  const handleDirectSitDown = async (seatIndex) => {
    console.log(`直接入座: 座位=${seatIndex}`);
    
    setLoading(true);
    try {
      // 检查WebSocket连接状态
      if (!websocketService.isConnected) {
        throw new Error('WebSocket未连接，请刷新页面重试');
      }
      
      // 使用gameService通过WebSocket发送入座请求
      const response = await gameService.sitDown(roomId, seatIndex);
      console.log('入座请求已发送:', response);
      
      // 播放入座音效
      soundEffects.playSitDownSound();
      
      // 服务器会发送room_update消息，由roomUpdateHandler处理
      
    } catch (error) {
      console.error('入座失败:', error);
      toast.error(error.message || '入座失败，请稍后重试');
      setLoading(false);
    }
  };
  
  // 换座操作
  const handleChangeSeat = async (logicalPosition) => {
    console.log(`执行换座操作: 目标逻辑位置=${logicalPosition}`);
    
    if (!roomId) {
      console.error('换座失败: 缺少房间ID');
      toast.error('换座失败: 缺少房间ID');
      return;
    }
    
    // 验证目标逻辑位置
    const maxPlayers = gameState?.max_players || 8;
    if (logicalPosition < 0 || logicalPosition >= maxPlayers) {
      console.error(`无效的逻辑位置: ${logicalPosition}`);
      toast.error(`无效的目标座位`);
      return;
    }
    
    // 获取当前玩家的逻辑位置，未入座则为-1
    const currentPlayerPosition = currentPlayer ? (currentPlayer.position !== undefined ? currentPlayer.position : -1) : -1;
    setCurrentPlayerPosition(currentPlayerPosition);
    
    // 检查玩家是否已入座（position必须是有效的非负数）
    if (currentPlayerPosition < 0) {
      console.error('当前玩家未入座，无法换座');
      toast.error('您尚未入座，无法换座');
      return;
    }
    
    // 检查目标逻辑位置是否已被占用 - 简化逻辑
    const isSeatOccupied = gameState.players?.some(p => p.position === logicalPosition);
    
    if (isSeatOccupied) {
      console.error(`逻辑位置 ${logicalPosition} 已被占用`);
      toast.error(`座位已被占用`);
      return;
    }
    
    try {
      setLoading(true);
      
      // 设置超时
      const timeoutId = setTimeout(() => {
        setLoading(false);
        setChangeSeatDialogOpen(false);
        toast.error('换座操作超时，请重试');
      }, 10000);
      
      // 发送单一的换座请求
      console.log(`发送换座请求到位置 ${logicalPosition}`);
      await gameService.changeSeat(roomId, logicalPosition);
      
      console.log('换座请求已发送');
      
      // 播放换座音效
      soundEffects.playChangeSeatSound();
      
      // 成功完成后清除超时
      clearTimeout(timeoutId);
      setLoading(false);
      setChangeSeatDialogOpen(false);
      toast.success('换座操作已发送');
      
    } catch (error) {
      console.error('换座失败:', error);
      toast.error(error.message || '换座失败，请稍后重试');
      setLoading(false);
      setChangeSeatDialogOpen(false);
    }
  };
  
  // 简化handleSeatSelect函数中的相应逻辑
  const handleSeatSelect = (displayPosition) => {
    const maxSeats = gameState.max_players || 8;
    
    // 查找这个UI显示位置对应的逻辑座位
    const seatData = seatDisplayData.find(seat => seat.position === displayPosition);
    
    if (!seatData) {
      console.error(`无法找到UI位置 ${displayPosition} 对应的座位数据`);
      toast.error(`无效的座位位置`);
      return;
    }
    
    // 获取逻辑座位索引(realPosition) - 这是发送给服务器的位置
    const logicalPosition = seatData.realPosition;
    
    console.log(`选择UI位置: ${displayPosition}, 对应逻辑位置: ${logicalPosition}`);
    
    // 验证逻辑位置在有效范围内
    if (logicalPosition < 0 || logicalPosition >= maxSeats) {
      console.error(`无效的逻辑位置: ${logicalPosition}, 有效范围: 0-${maxSeats-1}`);
      toast.error(`无效的座位索引`);
      return;
    }
    
    // 检查该逻辑位置是否已被占用 - 简化逻辑
    const isSeatOccupied = gameState.players?.some(p => p.position === logicalPosition);
    
    if (isSeatOccupied) {
      console.error(`逻辑位置 ${logicalPosition} 已被占用`);
      toast.error(`座位已被占用`);
      return;
    }
    
    // 保存选择的逻辑位置
    setSelectedSeat(logicalPosition);
    
    // 获取当前玩家的逻辑位置，未入座则为-1
    const currentPlayerPosition = currentPlayer ? (currentPlayer.position !== undefined ? currentPlayer.position : -1) : -1;
    setCurrentPlayerPosition(currentPlayerPosition);
    
    // 检查玩家是否已入座（position为有效非负数）
    const isPlayerSeated = currentPlayerPosition >= 0;
    console.log(`玩家是否已入座: ${isPlayerSeated}, 选择的逻辑位置: ${logicalPosition}`);
    
    if (isPlayerSeated) {
      console.log("显示换座确认对话框");
      setChangeSeatDialogOpen(true);
    } else {
      console.log("执行直接入座");
      handleDirectSitDown(logicalPosition).then(() => {
        console.log("入座成功，显示买入对话框");
        setErrorMessage('');
        setLoading(false);
        setOpenBuyInDialog(true);
      }).catch(error => {
        console.error("入座失败:", error);
        toast.error("入座失败，请重试");
      });
    }
  };
  
  // 退出游戏
  const handleExitGame = async () => {
    if (!roomId) {
      console.error('退出游戏失败: 缺少房间ID');
      toast.error('退出游戏失败: 缺少房间ID');
      return;
    }
    
    try {
      setLoading(true);
      console.log('开始退出游戏流程...');
      
      // 创建一个变量跟踪是否成功发送了退出请求
      let exitRequestSent = false;
      
      // 检查WebSocket连接状态
      if (websocketService.isConnected) {
        console.log('WebSocket已连接，发送退出游戏请求');
        
        try {
          // 使用gameService通过WebSocket发送退出游戏请求
          await gameService.exitGame(roomId);
          console.log('退出游戏请求已发送');
          exitRequestSent = true;
          toast.success('已成功退出游戏');
        } catch (exitError) {
          console.error('发送退出游戏请求失败:', exitError);
          toast.warning('无法发送退出请求，但仍将退出游戏');
        }
        
        // 主动关闭WebSocket连接，等待连接关闭
        console.log('主动关闭WebSocket连接...');
        try {
          // 传入true表示这是一个主动断开连接
          await websocketService.disconnect(true);
          console.log('WebSocket连接已成功关闭');
        } catch (disconnectError) {
          console.error('关闭WebSocket连接失败:', disconnectError);
        }
      } else {
        console.log('WebSocket未连接，无需发送退出请求或关闭连接');
      }
      
      // 移除在localStorage中标记已退出此房间的逻辑
      
      // 等待一小段时间确保所有清理工作完成
      console.log('退出流程完成，准备导航回房间列表');
      setTimeout(() => {
        setLoading(false);
        navigate('/rooms');
      }, 500);
      
    } catch (error) {
      console.error('退出游戏过程中出错:', error);
      toast.error(error.message || '退出游戏失败，但仍将退出');
      
      // 即使出错，也尝试导航回房间列表
      setTimeout(() => {
        setLoading(false);
        navigate('/rooms');
      }, 500);
    }
  };
  
  // 获取游戏历史记录
  const fetchGameHistory = async () => {
    if (!roomId) {
      setHistoryError('缺少房间ID');
      return;
    }
            
    try {
      setHistoryLoading(true);
      
      // 检查WebSocket连接状态
      if (!websocketService.isConnected) {
        console.warn('WebSocket未连接，尝试重新连接...');
        // 尝试重新连接
        try {
          await gameService.connectToGameRoom(roomId);
          console.log('WebSocket重新连接成功，继续获取历史记录');
        } catch (connectError) {
          console.error('WebSocket重新连接失败:', connectError);
          throw new Error('无法与游戏服务器通信，请刷新页面重试');
        }
      }
      
      // 使用gameService通过WebSocket发送获取历史记录请求
      await gameService.getGameHistory(roomId);
      console.log('游戏历史记录请求已发送');
      
      // 注册WebSocket事件监听器来处理历史记录响应
      const handleHistoryResponse = (data) => {
        console.log('收到游戏历史记录:', data);
        if (data && Array.isArray(data)) {
          setHistoryData(data);
        } else {
          setHistoryData([]);
        }
        setHistoryLoading(false);
        
        // 移除事件监听器
        websocketService.removeEventListener('game_history', handleHistoryResponse);
      };
      
      // 添加事件监听器
      websocketService.addEventListener('game_history', handleHistoryResponse);
      
      // 设置超时处理
      setTimeout(() => {
        if (historyLoading) {
          setHistoryLoading(false);
          setHistoryError('获取历史记录超时，请重试');
          websocketService.removeEventListener('game_history', handleHistoryResponse);
        }
      }, 5000);
      
    } catch (error) {
      console.error('获取游戏历史记录失败:', error);
      setHistoryError(error.message || '获取历史记录失败');
      setHistoryLoading(false);
    }
  };
  
  // 处理开始游戏
  const handleStartGame = async () => {
    if (!roomId) {
      console.error('开始游戏失败: 缺少房间ID');
      return;
    }
            
    try {
      setLoading(true);
      console.log('请求开始游戏...');
      
      // 检查WebSocket连接状态
      if (!websocketService.isConnected) {
        console.warn('WebSocket未连接，尝试重新连接...');
        // 尝试重新连接
        try {
          await gameService.connectToGameRoom(roomId);
          console.log('WebSocket重新连接成功，继续开始游戏操作');
        } catch (connectError) {
          console.error('WebSocket重新连接失败:', connectError);
          throw new Error('无法与游戏服务器通信，请刷新页面重试');
        }
      }
      
      // 使用gameService通过WebSocket发送开始游戏请求
      await gameService.startGame(roomId);
      
      console.log('开始游戏请求已发送');
      
      // 显示成功消息
      setNotification({
        open: true,
        message: '开始游戏请求已发送',
        severity: 'success'
      });
      
    } catch (error) {
      console.error('开始游戏失败:', error);
      
      // 显示错误消息
      setNotification({
        open: true,
        message: error.message || '开始游戏失败，请稍后重试',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };
  
  // 处理摊牌过程
  const handleShowdown = (showdownData) => {
    console.group('处理摊牌信息');
    console.log('摊牌信息:', showdownData);
    
    // 保存摊牌数据以便动画结束后使用
    delayedShowdownDataRef.current = showdownData;
    
    // 准备筹码分配动画的获胜者数据
    const winners = showdownData.players
      .filter(player => player.isWinner)
      .map(player => ({
        position: gameState.game?.players?.find(p => p.name === player.name)?.position || 0,
        name: player.name,
        chipsWon: player.chipsWon
      }));
    
    console.log('筹码分配获胜者:', winners);
    
    // 计算玩家位置信息用于动画
    const positions = gameState.game?.players
      .filter(player => player.position !== undefined && player.position !== null)
      .map(player => {
        // 计算玩家位置坐标 (简化版，实际应根据布局计算)
        // 这里假设使用与CardDealingAnimation相似的位置计算逻辑
        const angle = (player.position / 8) * 2 * Math.PI; // 8个位置平均分布
        const radius = 250; // 桌子半径
        const x = Math.sin(angle) * radius;
        const y = -Math.cos(angle) * radius;
        
        return {
          position: player.position,
          name: player.name,
          x,
          y
        };
      }) || [];
    
    setPlayerPositions(positions);
    setDistributionWinners(winners);
    
    // 如果有获胜者且有筹码，显示分配动画
    if (winners.length > 0 && showdownData.pot?.main > 0) {
      console.log('开始筹码分配动画');
      setShowDistributionAnimation(true);
      setShowdownDelayed(true);
      
      // 播放游戏结束音效
      soundEffects.playGameOverSound();
    } else {
      // 如果没有获胜者或筹码，直接显示摊牌信息
      console.log('无需筹码分配动画，直接显示摊牌信息');
      completeShowdown(showdownData);
    }
    
    console.groupEnd();
  };
  
  // 筹码分配动画完成后的回调
  const handleDistributionAnimationComplete = () => {
    console.log('筹码分配动画完成');
    setShowDistributionAnimation(false);
    
    // 播放赢牌音效
    soundEffects.playWinSound();
    
    // 如果有延迟的摊牌数据，显示摊牌对话框
    if (showdownDelayed && delayedShowdownDataRef.current) {
      completeShowdown(delayedShowdownDataRef.current);
      setShowdownDelayed(false);
    }
  };
  
  // 完成摊牌流程
  const completeShowdown = (showdownData) => {
    // 设置摊牌信息，用于对话框显示
    setShowdownInfo(showdownData);
    
    // 设置显示所有玩家手牌的状态为true
    setShowCards(true);
    
    // 更新游戏状态中的玩家信息，为获胜玩家添加chipsWon和isWinner属性
    setGameState(prevState => {
      const updatedPlayers = prevState.game?.players?.map(player => {
        // 找到该玩家对应的摊牌数据
        const playerShowdownData = showdownData.players.find(p => p.name === player.name);
        
        if (playerShowdownData) {
          return {
            ...player,
            isWinner: playerShowdownData.isWinner,
            chipsWon: playerShowdownData.chipsWon
          };
        }
        return player;
      }) || [];
      
      return {
        ...prevState,
        game: {
          ...prevState.game,
          players: updatedPlayers
        }
      };
    });
  };
  
  // 获取动作文本
  const getActionText = (action) => {
    const actionMap = {
      'fold': '弃牌',
      'check': '看牌',
      'call': '跟注',
      'raise': '加注',
      'bet': '下注',
      'all-in': '全押'
    };
    return actionMap[action] || action;
  };
  
  // 连接WebSocket并设置游戏状态监听
        useEffect(() => {
    if (!roomId) return;
    
    // 重置加载状态和错误消息 - 每次组件重新挂载时
    setLoading(false);
    setErrorMessage('');
    setOpenBuyInDialog(false);
    setChangeSeatDialogOpen(false);
    
    console.log(`===== 组件挂载，开始设置事件监听器 =====`);
    console.log(`房间ID: ${roomId}`);
    
    let wsConnectTimeout;
    
    // 强制断开并重新连接WebSocket (确保进入新房间时建立新的连接)
    if (websocketService.isConnected) {
      console.log('检测到WebSocket已连接，强制断开并重新连接');
      websocketService.disconnect();
    }
    
    // 确保WebSocket已连接
      console.log(`GameTable初始化WebSocket连接: roomId=${roomId}`);
      
      // 设置加载状态
      setLoading(true);
      
      // 检查认证令牌
      const token = localStorage.getItem('token');
      const username = localStorage.getItem('username');
      
      if (!token || !username) {
        console.error('认证令牌不存在，需要重新登录');
        enqueueSnackbar('您需要登录才能访问游戏房间', {
          variant: 'error',
          autoHideDuration: 3000,
          onClose: () => {
            // 跳转到登录页面
            navigate('/login', { state: { from: { pathname: `/game/${roomId}` } } });
          }
        });
        setLoading(false);
                return;
            }
            
      console.log('认证信息:');
      console.log('- token存在:', !!token);
      console.log('- token长度:', token.length);
      console.log('- username:', username);
      
      // Try to establish connection with the specific room ID
      gameService.connectToGameRoom(roomId)
        .then(() => {
          console.log(`成功连接到房间 ${roomId}`);
          setLoading(false);
          
          // 显示成功消息
          enqueueSnackbar('已连接到游戏房间', { 
            variant: 'success',
            autoHideDuration: 2000
          });
          
          // 服务器会自动发送初始游戏状态，不需要客户端主动请求
          // 只需要设置一次性游戏状态监听器来接收服务器自动发送的游戏状态
          try {
            // 设置一次性游戏状态监听器
            const initialGameStateHandler = (data) => {
              console.log('收到初始游戏状态:', data);
              if (data) {
                // 检查房间状态是否为finished，如果是则重定向到房间列表
                if (data.status === "finished") {
                  console.log('房间游戏已结束，重定向到房间列表页面');
                  enqueueSnackbar('该房间游戏已结束', { 
                    variant: 'info',
                    autoHideDuration: 3000
                  });
                  navigate('/rooms');
                  return;
                }
                // 处理游戏状态，允许数据可能嵌套在game对象中
                const newGameState = JSON.parse(JSON.stringify(data));

                // 提取嵌套在game对象中的玩家信息
                if (newGameState.game && newGameState.game.players && Array.isArray(newGameState.game.players)) {
                  console.log(`从game对象提取玩家列表，玩家数量: ${newGameState.game.players.length}`);
                  // 如果顶级没有players数组，或者是空数组，则使用game.players
                  if (!newGameState.players || !Array.isArray(newGameState.players) || newGameState.players.length === 0) {
                    newGameState.players = newGameState.game.players;
                  }
                }

                // 设置处理后的游戏状态
                setGameState(newGameState);
                
                // 尝试找到并设置当前玩家信息
                const players = newGameState.players || [];
                if (players.length > 0 && currentUser) {
                  const player = players.find(p => 
                    p.name === currentUser || p.username === currentUser
                  );
                  
                  if (player) {
                    console.log('初始化当前玩家信息:', player);
                  
                    // 检查玩家是否有有效的座位号
                    const hasValidSeat = (player.position !== undefined && player.position !== null && player.position >= 0) ||
                                        (player.seat !== undefined && player.seat !== null && player.seat >= 0);
                  
                    // 如果玩家没有有效座位，确保position值为null或-1
                    if (!hasValidSeat) {
                      console.log('玩家未入座，设置position为-1');
                      setCurrentPlayer({
                      ...player,
                        position: -1,
                        seat: -1
                      });
                    } else {
                      // 保留原始数据，不做修改
                      setCurrentPlayer(player);
                    }
                  } else {
                    // 没有找到玩家信息，设置默认值
                    console.log('未找到玩家信息，创建默认值');
                    setCurrentPlayer({
                      username: currentUser,
                      chips: 0,
                      position: -1,
                      seat: -1
                      });
                    }
                }
              }
              
              // 移除一次性监听器
              websocketService.removeEventListener('gameState', initialGameStateHandler);
            };
            
            // 添加一次性游戏状态监听器
            websocketService.addEventListener('gameState', initialGameStateHandler);
          } catch (error) {
            console.error('设置初始游戏状态监听器失败:', error);
            enqueueSnackbar('准备接收游戏状态失败，请刷新页面重试', { 
              variant: 'error'
            });
          }
        })
        .catch(error => {
          console.error('WebSocket连接失败:', error);
          console.error('详细错误信息:', error.message);
          if (error.stack) {
            console.error('错误堆栈:', error.stack);
          }
          setLoading(false);
          
          // 检查是否是房间成员资格错误
          if (error.message && error.message.includes('not in room')) {
            enqueueSnackbar(`无法加入房间：${error.message}`, {
              variant: 'error',
              autoHideDuration: 5000,
              onClose: () => {
                // 如果不是房间成员则返回房间列表
                navigate('/rooms');
              }
            });
          } else if (error.message && error.message.includes('超时')) {
            // 如果是超时错误，但WebSocket实际可能已连接
            if (websocketService.isConnected) {
              console.log('WebSocket显示已连接，尝试继续操作...');
              enqueueSnackbar('连接超时，但服务器可能已响应，尝试继续...',{
                variant: 'warning',
                autoHideDuration: 3000
              });
              // 不要导航离开，让用户尝试继续操作
            } else {
              enqueueSnackbar('连接服务器超时，请检查网络后重试', {
                variant: 'error',
                autoHideDuration: 5000
              });
            }
          } else {
            // 其他连接错误
            enqueueSnackbar('游戏连接失败，请刷新页面重试', { 
              variant: 'error',
              autoHideDuration: 5000
            });
          }
        });
    
    // 添加更多调试来检查所有事件监听器
    console.log('正在注册的事件监听器:',
      '1. gameState - 游戏状态更新',
      '2. connect/disconnect - 连接状态',
      '3. error - 错误处理',
      '4. roomUpdate - 房间更新',
      '5. playerJoined - 玩家加入',
      '6. playerLeft - 玩家离开'
    );

    // 这里不再定义内部handleGameStateUpdate方法，而是直接使用组件级别的方法
    // 注册游戏状态更新监听 - 使用组件中定义的handleGameStateUpdate
    console.log('注册游戏状态更新监听器 - 使用组件级别的handleGameStateUpdate');
    gameService.onGameStateUpdate(roomId, handleGameStateUpdate);
    
    // 设置WebSocket连接状态监听器
    const connectionHandler = (status) => {
      if (status) {
        console.log('WebSocket已连接');
        setLoading(false);
      } else {
        console.log('WebSocket断开连接');
        enqueueSnackbar('游戏连接中断，正在尝试重新连接...', { 
          variant: 'warning',
          autoHideDuration: 3000
        });
      }
    };
    
    // 设置WebSocket错误处理器
    const errorHandler = (error) => {
      console.error('WebSocket错误:', error);
      setLoading(false);
      
      // 确保买入对话框在错误时关闭
      if (openBuyInDialog) {
        setOpenBuyInDialog(false);
        setBuyInAmount('');
      }
      
      // 提取错误消息文本
      const errorMsg = error.message || '';
      
      // 处理认证错误
      if (errorMsg === '认证失败，请重新登录' || 
          error.code === 1008 || 
          error.code === 403) {
        
        enqueueSnackbar('登录已过期，请重新登录', {
          variant: 'error',
          autoHideDuration: 5000,
          onClose: () => {
            // 清除本地认证信息
            localStorage.removeItem('token');
            localStorage.removeItem('userId');
            localStorage.removeItem('username');
            
            // 跳转到登录页
            navigate('/login', { state: { from: { pathname: `/game/${roomId}` } } });
          }
        });
      } else if (errorMsg.includes('not in room')) {
        // 处理房间成员资格错误
        enqueueSnackbar(`您不是房间 ${roomId} 的成员`, {
          variant: 'error',
          autoHideDuration: 5000,
          onClose: () => {
            // 返回房间列表
            navigate('/rooms');
          }
        });
      } else if (errorMsg.includes('已经坐在座位') && errorMsg.includes('请先站起')) {
        // 处理已经在座位上的错误
        enqueueSnackbar('更换座位需要先站起, 系统将自动为您处理', {
          variant: 'info',
          autoHideDuration: 3000
        });
        
        // 获取当前座位号
        const match = errorMsg.match(/已经坐在座位(\d+)/);
        if (match && match[1]) {
          const currentSeatIndex = parseInt(match[1], 10);
          console.log(`检测到玩家已在座位 ${currentSeatIndex}, 将自动处理站起操作`);
        }
      } else {
        // 处理其他错误
        enqueueSnackbar(errorMsg || '游戏连接发生错误', {
          variant: 'error',
          autoHideDuration: 3000
        });
      }
    };
    
    // 注册连接状态事件监听器
    const connectUnsubscribe = websocketService.onConnect(() => connectionHandler(true));
    const disconnectUnsubscribe = websocketService.onDisconnect(() => connectionHandler(false));
    const errorUnsubscribe = websocketService.onError(errorHandler);
    
    // 注册房间更新事件监听器
    const roomUpdateUnsubscribe = websocketService.onRoomUpdate(roomUpdateHandler);
    console.log('已注册房间更新事件监听器');
    
    // 获取当前用户信息
    const fetchCurrentUser = async () => {
      try {
        const username = localStorage.getItem('username');
        console.log('当前用户:', username);
        setCurrentUser(username);
      } catch (error) {
        console.error('获取当前用户失败:', error);
        enqueueSnackbar('获取用户信息失败，请重新登录', { variant: 'error' });
        // 跳转到登录页
        navigate('/login');
      }
    };
    
    fetchCurrentUser();
    
    // 为 gameUpdate 事件创建一个专门的处理函数
    const handleGameUpdate = (updateData) => {
      console.log('处理游戏更新:', updateData);

      // 处理弃牌动作
      if (updateData.action === 'discard' && updateData.player === currentUser) {
        console.log('处理自己的弃牌操作:', updateData);
        // 如果玩家弃掉了自己的牌
        if (updateData.result && updateData.result.discarded_card) {
          console.log('设置弃掉的牌:', updateData.result.discarded_card);
          setDiscardedCard(updateData.result.discarded_card);
        }
      }
      
      // 处理弃牌(fold)动作
      if (updateData.action === 'fold') {
        console.log('检测到弃牌(fold)操作:', updateData);
        // 播放弃牌音效
        soundEffects.playFoldSound();
      }
    };

    // 注册gameUpdate事件监听器
    const gameUpdateUnsubscribe = gameService.addEventListener('gameUpdate', handleGameUpdate);
    
    // 组件卸载时清理
            return () => {
      console.log('===== 组件卸载，清理事件监听器 =====');
      gameService.offGameStateUpdate(roomId);
      connectUnsubscribe && connectUnsubscribe();
      disconnectUnsubscribe && disconnectUnsubscribe();
      errorUnsubscribe && errorUnsubscribe();
      roomUpdateUnsubscribe && roomUpdateUnsubscribe();
      gameUpdateUnsubscribe && gameUpdateUnsubscribe(); // 添加这一行
      
      // 确保所有状态重置
      setLoading(false);
      setOpenBuyInDialog(false);
      setChangeSeatDialogOpen(false);
      
      // 清除所有定时器
      if (wsConnectTimeout) clearTimeout(wsConnectTimeout);
      
      // 清除玩家思考时间计时器
      if (playerTurnTimerRef.current) {
        console.log('组件卸载，清除玩家思考时间计时器');
        clearInterval(playerTurnTimerRef.current);
        playerTurnTimerRef.current = null;
      }
    };
  }, [roomId, currentUser, navigate, enqueueSnackbar]);
  
  // 初始化时预加载音效
  useEffect(() => {
    // 预加载音效
    soundEffects.preloadSounds().catch(err => {
      console.warn("音效预加载失败:", err);
    });
  }, []);
  
  // 处理游戏状态更新
  const handleGameStateUpdate = (data) => {
    // 仅在开发模式下输出详细调试日志
    if (process.env.NODE_ENV === 'development') {
      console.log('========= 游戏状态更新 =========');
      console.log('原始数据类型:', typeof data);
      
      // 详细记录数据结构，帮助调试
      if (data) {
        console.log('数据对象:', data);
        console.log('数据包含 game_state:', !!data.game?.game_state);
        console.log('数据包含 game:', !!data.game);
        
        // 检查游戏阶段是否存在
        const hasGamePhase = !!(
          data.gamePhase || 
          data.game_phase || 
          data.game_state?.gamePhase || 
          data.game_state?.game_phase ||
          data.game_state?.game?.game_phase ||
          data.game?.gamePhase ||
          data.game?.game_phase
        );
        console.log('是否包含游戏阶段信息:', hasGamePhase);
        
        // 详细记录游戏对象结构
        if (data.game_state?.game) {
          console.log('game_state.game对象的结构:', Object.keys(data.game_state.game));
        }
      }
    }
    
    // 检查数据来源格式
    const isRoomUpdateFormat = data && data.room_state;
    const isDirectGameStateFormat = data && (data.game_state || data.game);
    
    
    // 根据不同格式处理数据
    let newGameState;
    
    try {
      if (isRoomUpdateFormat) {
        // 来自room_update的数据
        if (process.env.NODE_ENV === 'development') {
          console.log('处理来自room_update的状态更新');
        }
        newGameState = JSON.parse(JSON.stringify(data.room_state));
      } else if (isDirectGameStateFormat) {
        // 直接的game_state数据
        if (process.env.NODE_ENV === 'development') {
          console.log('处理来自game_state的状态更新');
        }
        newGameState = JSON.parse(JSON.stringify(data.game_state || data));
      } else {
        // 直接的状态数据
        if (process.env.NODE_ENV === 'development') {
          console.log('处理直接的状态数据');
        }
        newGameState = JSON.parse(JSON.stringify(data));
      }

      // 重要: 提取嵌套的game对象中的重要信息
      if (newGameState.game) {
        console.log('从game对象提取关键信息', newGameState);
    
        // 提取游戏阶段
        if (newGameState.game.game_phase) {
          newGameState.gamePhase = newGameState.game.game_phase;
          console.log(`从game对象提取到游戏阶段: ${newGameState.gamePhase}`);
        }
        
        // 提取思考时间
        if (newGameState.game.turn_time_remaining !== undefined) {
          console.log(`从game对象提取到思考时间: ${newGameState.game.turn_time_remaining}秒`);
          // 不需要单独设置到newGameState，handlePlayerTurnTime会直接从game对象读取
        }
        
        // 提取游戏结束和摊牌信息
        if (newGameState.game.hand_complete) {
          newGameState.hand_complete = newGameState.game.hand_complete;
          console.log(`游戏回合结束`);
          
          if (newGameState.game.hand_winners) {
            newGameState.hand_winners = newGameState.game.hand_winners;
            console.log(`获胜者: ${newGameState.hand_winners}`);
          }
          
          if (newGameState.game.showdown) {
            newGameState.showdown = newGameState.game.showdown;
            console.log(`是否为摊牌结束: ${newGameState.showdown}`);
          }
        }
        
        // 提取玩家下注金额信息
        if (newGameState.game.players && Array.isArray(newGameState.game.players)) {
          console.log(`处理玩家下注信息，玩家数量: ${newGameState.game.players.length}`);
          console.log('newGameState.game.players', newGameState.game.players);
    
          // 首先确保每个玩家对象有position属性
          newGameState.game.players.forEach((player, idx) => {
            // 如果玩家没有position属性，设置为索引
            if (player.position === undefined) {
              player.position = idx;
              console.log(`为玩家 ${player.name || player.username} 设置缺失的position属性: ${idx}`);
            }
            
            // 确保玩家有betAmount属性，优先使用bet_amount
            if (player.bet_amount !== undefined && player.betAmount === undefined) {
              player.betAmount = player.bet_amount;
              console.log(`从bet_amount同步玩家 ${player.name || player.username} 的下注额: ${player.betAmount}`);
            } else if (player.current_bet !== undefined && player.betAmount === undefined) {
              player.betAmount = player.current_bet;
              console.log(`从current_bet同步玩家 ${player.name || player.username} 的下注额: ${player.betAmount}`);
            }
          });
          
          console.log('已更新玩家下注金额，确保所有下注都被显示');
        }
        
        // 提取公共牌
        if (newGameState.game.community_cards && (!newGameState.community_cards || newGameState.community_cards.length === 0)) {
          newGameState.community_cards = newGameState.game.community_cards;
          console.log(`从game对象提取到公共牌: ${newGameState.community_cards.length}张`);
        }
    
        // 提取底池
        if (newGameState.game.total_pot && !newGameState.pot) {
          newGameState.pot = newGameState.game.total_pot;
          console.log(`从game对象提取到底池: ${newGameState.pot}`);
        }
    
        // 提取当前玩家
        if (newGameState.game.current_player_idx !== undefined && newGameState.current_player_idx === undefined) {
          newGameState.current_player_idx = newGameState.game.current_player_idx;
          console.log(`从game对象提取到当前玩家索引: ${newGameState.current_player_idx}`);
        }
    
        // 简单记录dealer_idx位置
        if (newGameState.game.dealer_idx !== undefined) {
          console.log(`庄家位置(dealer_idx): ${newGameState.game.dealer_idx}`);
        }

        // 添加游戏开始标志
        if (newGameState.game.game_phase && newGameState.game.game_phase !== 'WAITING') {
          newGameState.isGameStarted = true;
          console.log('从game对象提取：游戏已开始');
        }
        
        // 提取当前下注
        if (newGameState.game.current_bet !== undefined && newGameState.current_bet === undefined) {
          newGameState.current_bet = newGameState.game.current_bet;
          console.log(`从game对象提取到当前下注: ${newGameState.current_bet}`);
        }
        
        // 提取活跃玩家
        if (newGameState.game.active_players && !newGameState.active_players) {
          newGameState.active_players = newGameState.game.active_players;
          console.log(`从game对象提取到活跃玩家: ${newGameState.active_players.length}人`);
        }
        
        // 提取下注回合
        if (newGameState.game.betting_round !== undefined && newGameState.betting_round === undefined) {
          newGameState.betting_round = newGameState.game.betting_round;
          console.log(`从game对象提取到下注回合: ${newGameState.betting_round}`);
        }
        
        // 提取游戏状态
        if (!newGameState.status && newGameState.game.game_phase && newGameState.game.game_phase !== 'WAITING') {
          newGameState.status = 'playing';
          console.log('从game对象推断游戏状态: playing');
        }
      }
      
      // 提取新的游戏阶段
      const newGamePhase = newGameState.gamePhase || 
                         (newGameState.game && newGameState.game.game_phase) || 
                         (newGameState.status === "playing" ? "PRE_FLOP" : "WAITING");
      
      // 从ref中获取上一次的游戏阶段
      const oldGamePhase = previousGamePhaseRef.current;
      console.log('即将更新游戏状态 oldGamePhase (从ref获取):', oldGamePhase);
      console.log('即将更新游戏状态 newGamePhase:', newGamePhase);
      
      // 提取并跟踪handid变化
      const currentHandId = newGameState.game?.handid;
      const previousHandId = previousHandIdRef.current;
      console.log('currentHandId and previousHandId', currentHandId, previousHandId, newGameState.game)
      
      // 检测handid变化
      if (currentHandId && currentHandId !== previousHandId) {
        console.group('===== 检测到新的游戏回合 =====');
        console.log('前一个handid:', previousHandId);
        console.log('当前handid:', currentHandId);
        console.log('游戏阶段:', newGamePhase);
        console.groupEnd();
        
        if (!showDealingAnimation) {
          // 触发发牌动画
          setShowDealingAnimation(true);
          
          // 预加载音频
          dealingAnimationUtils.preloadAudio().catch(err => {
            console.warn("音频预加载失败:", err);
            // 即使音频加载失败，也继续执行动画
          });
        }
        
        // 更新handid引用
        previousHandIdRef.current = currentHandId;
      }
      
      // 检测游戏阶段变化并播放相应音效
      if (oldGamePhase !== newGamePhase) {
        console.log(`游戏阶段变化: ${oldGamePhase} -> ${newGamePhase}`);
        
        // 检测FLOP, TURN, RIVER阶段变化并播放音效
        if ((oldGamePhase === 'PRE_FLOP' && newGamePhase === 'FLOP') ||
            (oldGamePhase === 'FLOP' && newGamePhase === 'TURN') ||
            (oldGamePhase === 'TURN' && newGamePhase === 'RIVER')) {
          console.log(`播放翻牌音效: ${newGamePhase}阶段`);
          soundEffects.playFlopSound();
        }
      }
      
      // 如果是首次收到更新，更新当前玩家
      if (!currentPlayer && currentUser) {
        const player = newGameState.players?.find(p => p.name === currentUser || p.username === currentUser);
        if (player) {
          setCurrentPlayer(player);
          setPlayerHand(player.hand || []);
        }
      }
      
      // 处理计时器更新
      handlePlayerTurnTime(newGameState);
      
      // 处理玩家手牌 - 从my_hand字段获取
      if (newGameState.my_hand && Array.isArray(newGameState.my_hand)) {
        console.log('接收到玩家手牌:', newGameState.my_hand);
        
        // 检查是否是弃牌后的更新
        const isAfterDiscard = (playerHand.length === 3 && newGameState.my_hand.length === 2) || 
                               (discardedCard && playerHand.length > newGameState.my_hand.length);
        
        // 如果是弃牌后的更新，保留弃掉的牌信息
        if (isAfterDiscard && discardedCard) {
          console.log('弃牌后更新手牌，保留弃掉的牌信息:', discardedCard);
          
          // 创建新的手牌数组，先放置弃掉的牌，然后是当前手牌
          const updatedHand = [
            { 
              ...discardedCard, 
              isDiscarded: true  // 标记为已弃牌
            },
            ...newGameState.my_hand
          ];
          
          console.log('更新后的手牌数组:', updatedHand);
          setPlayerHand(updatedHand);
        } else {
          // 常规更新，直接设置手牌
          setPlayerHand(newGameState.my_hand);
          
          // 如果手牌数量变化且没有弃掉的牌，重置弃掉的牌状态
          if (playerHand.length !== newGameState.my_hand.length) {
            setDiscardedCard(null);
          }
        }
      }
      
      // 检查是否当前玩家回合
      if (newGameState.current_player_idx !== undefined) {
        const currentPlayerIdx = newGameState.game?.players?.findIndex(
          p => p.name === currentUser || p.username === currentUser
        );
        
        const isUserTurnNow = currentPlayerIdx >= 0 && currentPlayerIdx === newGameState.current_player_idx;
        console.log(`当前玩家回合状态: ${isUserTurnNow}, index: ${currentPlayerIdx}, current: ${newGameState.current_player_idx}`);
        setIsUserTurn(isUserTurnNow);
      }
      
      // 处理游戏结束和摊牌
      if (newGameState.hand_complete) {
        console.log("检测到游戏回合结束，准备显示摊牌对话框 newGameState: ", newGameState);
        
        // 准备摊牌数据
        const showdownData = {
          players: newGameState.game.players
            .filter(player => player.is_active || (player.hand && player.hand.length > 0))
            .map(player => ({
              name: player.name,
              hand: player.hand,
              isWinner: player.is_winner || (newGameState.hand_winners && newGameState.hand_winners.includes(player.position)),
              chipsWon: player.is_winner ? newGameState.game.total_pot / (newGameState.hand_winners?.length || 1) : 0
            })),
          communityCards: newGameState.community_cards,
          winners: newGameState.game.players
            .filter(player => player.is_winner || (newGameState.hand_winners && newGameState.hand_winners.includes(player.position)))
            .map(player => ({
              name: player.name,
              position: player.position
            })),
          pot: { main: newGameState.game.total_pot }
        };
        
        handleShowdown(showdownData);
      }
      
      // 更新状态
      setGameState(newGameState);
      
      // 在完成状态更新后，保存当前游戏阶段到ref中，以备下次比较
      previousGamePhaseRef.current = newGamePhase;
      console.log('即将更新游戏状态 gamePhase 已更新为:', newGamePhase);
    } catch (error) {
      console.error('处理游戏状态更新时出错:', error);
    }
  };
  
  // 辅助函数：检查游戏状态是否有重要变化
  const hasSignificantChanges = useCallback((oldState, newState) => {
    // 如果没有旧状态，则认为有变化
    if (!oldState) return true;
    
    // 如果没有新状态，则不更新
    if (!newState) return false;
    
    // 获取游戏阶段，兼容多种字段名
    const oldPhase = oldState.gamePhase || oldState.game_phase || '';
    const newPhase = newState.gamePhase || newState.game_phase || '';
    
    // 检查游戏阶段变化
    if (oldPhase !== newPhase) {
      console.log(`游戏阶段变化: ${oldPhase || '未定义'} -> ${newPhase || '未定义'}`);
      return true;
    }
    
    // 检查游戏状态变化
    if (oldState.status !== newState.status) {
      console.log(`游戏状态变化: ${oldState.status || '未定义'} -> ${newState.status || '未定义'}`);
      return true;
    }
    
    // 检查游戏是否开始状态变化
    if (!!oldState.isGameStarted !== !!newState.isGameStarted) {
      console.log(`游戏开始状态变化: ${!!oldState.isGameStarted} -> ${!!newState.isGameStarted}`);
      return true;
    }
    
    // 检查底池变化
    const oldPot = oldState.pot || oldState.totalPot || 0;
    const newPot = newState.pot || newState.totalPot || 0;
    if (oldPot !== newPot) {
      console.log(`底池变化: ${oldPot} -> ${newPot}`);
      return true;
    }
    
    // 检查庄家位置变化
    const oldDealer = oldState.game?.dealer_idx ?? -1;
    const newDealer = newState.game?.dealer_idx ?? -1;
    if (oldDealer !== newDealer) {
      console.log(`庄家位置变化: ${oldDealer} -> ${newDealer}`);
      return true;
    }
    
    // 检查玩家数量变化
    const oldPlayerCount = oldState.players?.length || 0;
    const newPlayerCount = newState.players?.length || 0;
    if (oldPlayerCount !== newPlayerCount) {
      console.log(`玩家数量变化: ${oldPlayerCount} -> ${newPlayerCount}`);
      return true;
    }
    
    // 检查公共牌变化
    const oldCardCount = oldState.community_cards?.length || oldState.communityCards?.length || 0;
    const newCardCount = newState.community_cards?.length || newState.communityCards?.length || 0;
    if (oldCardCount !== newCardCount) {
      console.log(`公共牌数量变化: ${oldCardCount} -> ${newCardCount}`);
      return true;
    }
    
    // 检查当前行动玩家变化
    const oldCurrentPlayer = oldState.current_player_position || oldState.current_player_idx || -1;
    const newCurrentPlayer = newState.current_player_position || newState.current_player_idx || -1;
    if (oldCurrentPlayer !== newCurrentPlayer) {
      console.log(`当前行动玩家变化: ${oldCurrentPlayer} -> ${newCurrentPlayer}`);
      return true;
    }
    
    // 检查玩家状态变化（筹码、下注、状态等）
    if (oldState.players && newState.players) {
      for (let i = 0; i < Math.max(oldPlayerCount, newPlayerCount); i++) {
        const oldPlayer = oldState.players[i];
        const newPlayer = newState.players[i];
        
        // 如果有一方没有玩家数据，认为有变化
        if (!oldPlayer || !newPlayer) return true;
        
        // 检查关键属性
        if (oldPlayer.chips !== newPlayer.chips) return true;
        if (oldPlayer.position !== newPlayer.position) return true;
        if (oldPlayer.status !== newPlayer.status) return true;
        if (oldPlayer.bet !== newPlayer.bet) return true;
        if (!!oldPlayer.isPlaying !== !!newPlayer.isPlaying) return true;
      }
    }
    
    // 默认不需要更新
    return false;
  }, []);
  
  // 处理弃牌完成
  const handleDiscardComplete = (discardedIndex) => {
    if (discardedIndex >= 0 && discardedIndex < playerHand.length) {
      console.log(`设置弃掉的牌: ${JSON.stringify(playerHand[discardedIndex])}`);
      // 重置选中的牌
      setSelectedCardIndex(-1);
    }
  };
  
  // 处理牌的点击事件
  const handleCardClick = (index) => {
    if (playerHand && playerHand.length === 3) {
      // 如果已经选中了这张牌，则取消选中
      if (selectedCardIndex === index) {
        setSelectedCardIndex(-1);
      } else {
        // 否则选中这张牌
        setSelectedCardIndex(index);
      }
    }
  };
  
  // 处理弃牌按钮点击
  const handleDiscard = async () => {
    if (selectedCardIndex === -1) {
      setNotification({
        open: true,
        message: '请先选择一张要弃掉的牌',
        severity: 'warning',
        autoHideDuration: 3000
      });
      return;
    }
    
    try {
      await websocketService.discard(selectedCardIndex);
      handleDiscardComplete(selectedCardIndex);
      
      // 播放弃牌音效
      soundEffects.playFoldSound();
    } catch (error) {
      console.error('弃牌失败:', error);
      setNotification({
        open: true,
        message: '弃牌失败，请重试',
        severity: 'error',
        autoHideDuration: 3000
      });
    }
  };
  
  
  // 添加格式化时间的函数
  const formatTimeMMSS = (seconds) => {
    if (!seconds && seconds !== 0) return '--:--';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  // 在useEffect中添加清理函数，确保组件卸载时清除计时器
  // 添加playerTurnTimerRef声明
  const playerTurnTimerRef = useRef(null);
  
  // 在handleGameStateUpdate函数中添加对玩家思考时间的处理
  // 查找 "const handleGameStateUpdate = (data) => {" 并添加:
  const handlePlayerTurnTime = (newState) => {
    try {
      // 清除之前的计时器
      if (playerTurnTimerRef.current) {
        console.log('清除现有计时器');
        clearInterval(playerTurnTimerRef.current);
        playerTurnTimerRef.current = null;
      }

      // 确保游戏处于活动状态且有当前玩家
      if (newState?.gamePhase && 
          newState.gamePhase !== 'WAITING' && 
          newState.gamePhase !== 'SHOWDOWN' &&
          newState.current_player_idx !== undefined && 
          newState.current_player_idx !== null) {
        
        console.log('开始处理玩家思考时间');
        const currentPlayerIdx = newState.current_player_idx;
        const now = new Date().getTime();
        
        // 使用服务器提供的思考时间或默认30秒
        const serverTurnTimeRemaining = newState.game?.turn_time_remaining || 30;
        console.log(`服务器提供的思考时间: ${serverTurnTimeRemaining}秒`);
        const turnTimeLimit = 30; // 总时间固定为30秒
        
        // 设置当前玩家信息
        setCurrentPlayerTurnInfo({
          currentPlayerIdx,
          remainingTime: serverTurnTimeRemaining,
          totalTime: turnTimeLimit
        });
        
        // 设置初始思考时间状态
        const updatedPlayerTurnTime = { ...playerTurnTime };
        
        // 为所有玩家重置思考时间
        if (newState.players && newState.players.length > 0) {
          newState.players.forEach((player, idx) => {
            const playerPos = typeof player.position === 'string' ? 
              parseInt(player.position, 10) : player.position;
            
            // 为当前行动玩家设置思考时间
            if (playerPos === currentPlayerIdx) {
              updatedPlayerTurnTime[playerPos] = {
                isCurrentTurn: true,
                turnTimeRemaining: serverTurnTimeRemaining,
                turnTimeLimit: turnTimeLimit
              };
            } else {
              // 其他玩家不在当前行动中
              updatedPlayerTurnTime[playerPos] = {
                isCurrentTurn: false,
                turnTimeRemaining: 0,
                turnTimeLimit: turnTimeLimit
              };
            }
          });
        }
        
        setPlayerTurnTime(updatedPlayerTurnTime);
        
        // 确保seat display data也被正确更新
        console.log("更新座位显示数据，包含思考时间信息");
        setSeatDisplayData(prevSeats => {
          return prevSeats.map(seat => {
            // 只更新当前行动玩家的思考时间
            if (seat.realPosition === currentPlayerIdx) {
              return {
                ...seat,
                turnTimeRemaining: serverTurnTimeRemaining,
                turnTimeLimit: turnTimeLimit,
                isTurn: true,
                isActive: true
              };
            } else {
              // 确保其他座位也有正确的turnTimeRemaining字段
              return {
                ...seat,
                turnTimeRemaining: 0,
                turnTimeLimit: turnTimeLimit,
                isTurn: false
              };
            }
          });
        });
        
        // 在状态更新之后启动计时器，以确保状态已经被更新
        console.log(`启动计时器，初始剩余时间：${serverTurnTimeRemaining}秒`);
        const startTime = now; // 计时器启动时间
        const initialRemaining = serverTurnTimeRemaining; // 初始剩余时间
        
        // 启动计时器每秒更新一次
        playerTurnTimerRef.current = setInterval(() => {
          const currentTime = new Date().getTime();
          // 计算经过的时间（秒）
          const elapsedSeconds = Math.floor((currentTime - startTime) / 1000);
          // 计算剩余时间，从初始剩余时间开始减少
          const remainingSeconds = Math.max(0, initialRemaining - elapsedSeconds);
          
          console.log(`更新思考时间: ${remainingSeconds}秒`);
          
          // 更新当前玩家信息
          setCurrentPlayerTurnInfo(prev => ({
            ...prev,
            remainingTime: remainingSeconds
          }));
          
          // 更新所有玩家的思考时间状态
          setPlayerTurnTime(prevState => {
            const newState = { ...prevState };
            
            // 只更新当前玩家的剩余时间
            if (newState[currentPlayerIdx]) {
              newState[currentPlayerIdx] = {
                ...newState[currentPlayerIdx],
                turnTimeRemaining: remainingSeconds
              };
            }
            
            return newState;
          });
          
          // 直接更新seatDisplayData中当前玩家的思考时间，而不是重新构建整个座位数据
          // 这样做可以减少渲染开销，同时确保思考时间反映到UI
          setSeatDisplayData(prevSeats => {
            return prevSeats.map(seat => {
              // 只更新当前行动玩家的思考时间
              if (seat.realPosition === currentPlayerIdx) {
                return {
                  ...seat,
                  turnTimeRemaining: remainingSeconds,
                  isTurn: true,
                  isActive: true
                };
              }
              return seat;
            });
          });
          
          // 如果时间用完，清除计时器
          if (remainingSeconds <= 0) {
            console.log('玩家思考时间已用完');
            clearInterval(playerTurnTimerRef.current);
            playerTurnTimerRef.current = null;
          }
        }, 1000);
        
        console.log('玩家思考时间计时器已启动');
      } else {
        console.log('游戏状态不满足显示思考时间的条件');
      }
    } catch (error) {
      console.error('处理玩家思考时间出错:', error);
    }
  };
  
  // 添加useEffect，确保组件卸载时清理计时器
  useEffect(() => {
    return () => {
      if (playerTurnTimerRef.current) {
        console.log('组件卸载，清除玩家思考时间计时器');
        clearInterval(playerTurnTimerRef.current);
        playerTurnTimerRef.current = null;
        }
      };
  }, []);
  
  const [showDealingAnimation, setShowDealingAnimation] = useState(false);
  
  // 测试发牌动画
  const handleTestDealingAnimation = () => {
    console.log("开始测试发牌动画");
    
    // 如果已经在动画中，不做任何操作
    if (showDealingAnimation) {
      console.log("发牌动画已经在进行中，跳过");
        return;
      }
      
    // 启动动画
    setShowDealingAnimation(true);
    
    // 预加载音频
    dealingAnimationUtils.preloadAudio().catch(err => {
      console.warn("音频预加载失败:", err);
      // 即使音频加载失败，也继续执行动画
    });
  };

  // 动画完成回调
  const handleAnimationComplete = () => {
    console.log("发牌动画完成");
    
    // 获取当前handid，并记录日志
    const currentHandId = gameState.game?.handid;
    if (currentHandId) {
      console.log(`发牌动画完成，当前游戏回合ID: ${currentHandId}`);
    }
    
    // 确保状态被正确重置
    setTimeout(() => {
      setShowDealingAnimation(false);
      
      // 显示成功消息
      setNotification({
        open: true,
        message: "发牌动画播放完成",
        severity: "success",
        autoHideDuration: 3000
      });
      
      console.log("发牌动画状态已重置，可以再次测试");
    }, 100);
  };
  
  // 把玩家列表传递给对话框之前先处理数据
  const preparePlayersForDialog = () => {
    let playerList = [];
    
    // 优先使用game.players
    if (gameState.game && gameState.game.players && Array.isArray(gameState.game.players)) {
      playerList = gameState.game.players;
    } else if (gameState.players && Array.isArray(gameState.players)) {
      playerList = gameState.players;
    }
    
    // 详细调试每个玩家的数据 - 只在特定条件下输出
    const DEBUG_LOG = false; // 设置为false关闭日志
    
    if (DEBUG_LOG) {
      console.log("====== 调试玩家数据 ======");
      playerList.forEach(player => {
        const playerName = player.name || player.username;
        console.log(`玩家[${playerName}]原始买入数据:`, JSON.stringify(player));
      });
    }
    
    return playerList.map(player => {
      // 确保根据position属性设置isSitting标志
      const hasPosition = player.position !== undefined && player.position >= 0;
      const isSitting = hasPosition;
      // 游戏中的状态基于房间游戏状态和玩家是否入座
      const isPlaying = isSitting && ( 
                                    gameState.status === "playing" || 
                                    gameState.game?.state === "playing");
      
      // 计算玩家初始买入金额和当前筹码，用于计算盈亏
      let initialChips = player.initial_chips || player.initialChips || player.buyIn || 0;
      let currentChips = player.chips || 0;
      
      const playerName = player.name || player.username;
      
      // 优先使用缓存中的原始买入金额，缓存保证了这个值在整个游戏过程中不变
      const cachedBuyIn = getPlayerOriginalBuyIn(playerName);
      
      // 使用服务器返回的total_buy_in字段，如果有的话
      const totalBuyIn = player.total_buy_in !== undefined ? 
                      Number(player.total_buy_in) : 
                      undefined;
                      
      // 如果服务器返回了总买入且缓存中没有，则更新缓存
      if (totalBuyIn !== undefined && cachedBuyIn === undefined) {
        if (DEBUG_LOG) {
          console.log(`从服务器数据中获取到玩家[${playerName}]的总买入: ${totalBuyIn} BB`);
        }
        updatePlayerBuyInCache(playerName, totalBuyIn);
      }
      
      // 保存玩家原始买入金额，优先级：服务器总买入 > 缓存 > _original_buy_in > 当前筹码
      const originalBuyIn = totalBuyIn !== undefined ? 
                        totalBuyIn : 
                        (cachedBuyIn !== undefined ? 
                          cachedBuyIn : 
                          (player._original_buy_in !== undefined ? 
                            player._original_buy_in : 
                            currentChips));
      
      if (DEBUG_LOG) {
        console.log(`玩家[${playerName}]处理后: 初始筹码=${initialChips}, 当前筹码=${currentChips}, 原始买入=${originalBuyIn}, pending买入=${player.pending_buy_in}, 缓存买入=${cachedBuyIn}`);
      }
      
      return {
        ...player,
        isSitting,
        isPlaying,
        // 确保position是数字类型
        position: typeof player.position === 'string' ? parseInt(player.position, 10) : player.position,
        // 添加初始筹码和当前筹码信息，用于计算盈亏
        initialChips: initialChips,
        chips: currentChips,
        // 确保pending_buy_in被正确传递
        pending_buy_in: player.pending_buy_in || 0,
        // 添加原始买入金额，此值不随游戏进行而改变，优先使用缓存值
        _original_buy_in: cachedBuyIn !== undefined ? cachedBuyIn : originalBuyIn,
        // 调试信息
        _debug: {
          original_chips: player.chips,
          original_initial: player.initial_chips || player.initialChips,
          cached_buy_in: cachedBuyIn
        }
      };
    });
  };
  
  // 添加玩家原始买入金额的缓存，使用玩家名称作为键
  const [playerBuyInCache, setPlayerBuyInCache] = useState({});
  
  // 更新玩家的原始买入缓存
  const updatePlayerBuyInCache = useCallback((playerName, buyInAmount) => {
    // 只在开发模式下输出日志，且仅在特定调试条件下
    const DEBUG_LOG = false; // 设置为false关闭日志
    
    if (DEBUG_LOG && process.env.NODE_ENV === 'development') {
      console.log(`更新玩家[${playerName}]的原始买入缓存: ${buyInAmount} BB`);
    }
    
    setPlayerBuyInCache(prev => {
      // 只有在缓存中不存在该玩家记录时才更新
      if (!prev[playerName]) {
        return {
          ...prev,
          [playerName]: buyInAmount
        };
      }
      return prev; // 已存在则不更新
    });
  }, []);
  
  // 获取玩家的原始买入缓存
  const getPlayerOriginalBuyIn = useCallback((playerName) => {
    return playerBuyInCache[playerName];
  }, [playerBuyInCache]);
  
  // 测试按钮处理程序
  const handleTest = () => {
    console.log("开始测试发牌动画，使用模拟数据");
    
    // 创建模拟玩家数据
    const mockPlayers = [
      { id: 'player1', username: '测试玩家1', position: 0, isDealer: true },
      { id: 'player2', username: '测试玩家2', position: 2 },
      { id: 'player3', username: '测试玩家3', position: 4 },
      { id: 'player4', username: '测试玩家4', position: 6 },
      { id: 'player5', username: '测试玩家5', position: 8 }
    ];
    
    // 如果在测试模式中，直接替换玩家数据
    if (testMode) {
      console.log("使用模拟玩家数据:", mockPlayers);
      // 模拟一个开始动画的过程
      setStage('idle');
      setTimeout(() => {
        // 这里我们直接在组件内部替换玩家数据进行测试
        // 为了确保在动画过程中使用这些测试数据
        window._mockPlayers = mockPlayers;
        startAnimation();
      }, 100);
    } else {
      // 常规启动
      setStage('idle');
      setTimeout(() => {
        startAnimation();
      }, 100);
    }
  };
  
  const [testDealingMode, setTestDealingMode] = useState(false);
  
  // 在 GameTable.jsx 中添加一个函数来打印详细的玩家状态信息
  const logPlayerActionsState = () => {
    // 使用与传递给 PlayerActions 完全相同的方式获取当前玩家
    const currentPlayerIndex = gameState.current_player_idx || gameState.game?.current_player_idx;
    const currentPlayer = getCurrentPlayerByIndex(currentPlayerIndex);
    const userPlayer = getUserPlayer();
    const isUserTurn = isCurrentUserTurn();
    
    console.group('PlayerActions 详细状态:');
    console.log('当前游戏状态:', {
      currentPlayerIndex,
      'userPlayer?.position': userPlayer?.position,
      isUserTurn,
      'players数组长度': gameState.game?.players?.length,
      '当前最高下注': gameState.currentBet || gameState.game?.current_bet,
    });
    
    if (currentPlayer) {
      console.log('当前轮到的玩家:', currentPlayer.name || currentPlayer.username);
      console.log('当前轮到的玩家position:', currentPlayer.position);
      console.log('当前轮到的玩家的bet_amount:', currentPlayer.bet_amount);
      console.log('当前轮到的玩家的betAmount:', currentPlayer.betAmount);
    } else {
      console.log('当前轮到的玩家: 未找到匹配position:', currentPlayerIndex);
      console.log('所有玩家positions:', gameState.game?.players?.map(p => p.position));
    }
    
    if (userPlayer) {
      console.log('当前用户的玩家:', userPlayer.name || userPlayer.username);
      console.log('当前用户的玩家position:', userPlayer.position);
      console.log('当前用户的玩家bet_amount:', userPlayer.bet_amount);
      console.log('当前用户的玩家betAmount:', userPlayer.betAmount);
      console.log('当前用户是否该行动:', isUserTurn);
      console.log('实际应该跟注金额:', Math.max(0, (gameState.currentBet || gameState.game?.current_bet || 0) - (userPlayer.betAmount || userPlayer.bet_amount || 0)));
    }
    
    console.log('当前最高下注:', gameState.currentBet || gameState.game?.current_bet);
    console.log('实际传递给PlayerActions的playerBetAmount:', userPlayer?.betAmount || userPlayer?.bet_amount || 0);
    console.groupEnd();
  };

  // 在状态更新后调用此函数
  useEffect(() => {
    if (gameState && gameState.game && gameState.game.players) {
      logPlayerActionsState();
    }
  }, [gameState, currentUser]);
  
  // 添加统一的获取玩家的辅助函数
  const getCurrentPlayerByIndex = (index) => {
    if (index === undefined) return null;
    return gameState.game?.players?.find(p => p.position === index);
  };
  
  const getUserPlayer = () => {
    return gameState.game?.players?.find(p => 
      p.username === currentUser || p.name === currentUser
    );
  };
  
  // 判断是否是用户的回合
  const isCurrentUserTurn = () => {
    const currentPlayerIdx = gameState.current_player_idx || gameState.game?.current_player_idx;
    const userPlayer = getUserPlayer();
    return userPlayer && currentPlayerIdx !== undefined && userPlayer.position === currentPlayerIdx;
  };
  
  const [showDistributionAnimation, setShowDistributionAnimation] = useState(false);
  const [distributionWinners, setDistributionWinners] = useState([]);
  const [playerPositions, setPlayerPositions] = useState([]);
  const [showdownDelayed, setShowdownDelayed] = useState(false);
  const delayedShowdownDataRef = useRef(null);
  
        return (
    <GameTableContainer>
      {/* 顶部工具栏 */}
      <TopBar>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <BlindsDisplay
            smallBlind={gameState.blinds?.small || gameState.game?.blinds?.small || 0.5}
            bigBlind={gameState.blinds?.big || gameState.game?.blinds?.big || 1}
            roomName={gameState.name || gameState.roomName || roomId}
            roomId={roomId}
            players={(() => {
              // 从不同位置获取玩家列表
              if (gameState.players && Array.isArray(gameState.players)) {
                return gameState.players;
              } else if (gameState.game && gameState.game.players && Array.isArray(gameState.game.players)) {
                return gameState.game.players;
              }
              return [];
            })()}
            owner={gameState.owner || 
                  gameState.players?.find(p => p.isOwner || p.owner === true)?.username || 
                  gameState.game?.players?.find(p => p.isOwner || p.owner === true)?.username || ''}
          />
          
          {/* 倒计时移到左上角，放在玩家就绪图标的右侧 */}
          {showCountdown && countdown !== null && (
            <CountdownBanner>
              <CountdownIcon fontSize="small" />
              <TimerText>
                {formatTimeMMSS(countdown)}
              </TimerText>
            </CountdownBanner>
          )}
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            color="primary"
            size="small"
            onClick={() => {
              fetchGameHistory();
              setOpenHistoryDialog(true);
            }}
            startIcon={<HistoryIcon />}
          >
            历史
          </Button>
          
          <Button
            variant="outlined"
            color="primary"
            size="small"
            onClick={() => setOpenPlayerListDialog(true)}
            startIcon={<PeopleIcon />}
          >
            玩家
          </Button>
          
          <Button
            variant="contained"
            color="primary"
            size="small"
            onClick={() => setOpenBuyInDialog(true)}
            startIcon={<AddIcon />}
          >
            买入筹码
          </Button>
          
          <Button
            variant="contained"
            color="error"
            size="small"
            onClick={handleExitGame}
          >
            退出
          </Button>
        </Box>
      </TopBar>

                {/* 游戏桌面 */}
      <TableArea>
        {/* 游戏桌和公共牌 - 始终显示 */}
        <PokerTable
          gameState={{
            ...gameState,
            owner: gameState.owner || gameState.players?.find(p => p.isOwner)?.username
          }}
          players={gameState.players}
          currentUser={currentUser}
          communityCards={gameState.communityCards || (gameState.game && gameState.game.community_cards) || []}
          gamePhase={gameState.gamePhase || (gameState.game && gameState.game.game_phase) || 'WAITING'}
          status={gameState.status || (gameState.game && gameState.game.state) || 'waiting'}
          pot={gameState.pot || (gameState.game && gameState.game.total_pot) || 0}
          currentBet={gameState.currentBet || (gameState.game && gameState.game.current_bet) || 0}
          dealerPosition={gameState.dealerPosition || (gameState.game && gameState.game.dealer_idx) || 0}
          blinds={gameState.blinds || {small: gameState.small_blind || 0.5, big: gameState.big_blind || 1}}
          turnPlayerId={gameState.turnPlayerId || gameState.current_player_id || ''}
          onPlayerAction={handleAction}
          onAddChips={() => setOpenBuyInDialog(true)}
          onExitGame={handleExitGame}
          loading={loading}
        />
        
        {/* 添加当前玩家手牌区域 - 仅在游戏开始后显示 */}
        {gameState.status === 'playing' && playerHand && playerHand.length > 0 && (
          <Box sx={{
            position: 'absolute',
            bottom: '20px',  // 调低位置与头像底部对齐
            left: '47%',    // 更靠近头像
            transform: 'translateX(-100%)', // 向左偏移自身宽度
            display: 'flex',
            flexDirection: 'row', // 水平排列
            alignItems: 'flex-end', // 底部对齐
            gap: 2,  // 增加间距
            zIndex: 10
          }}>
            {/* 单独显示弃掉的牌 */}
            {discardedCard && (
              <Box 
                sx={{ 
                  p: 1, 
                  borderRadius: 2,
                  bgcolor: 'rgba(0, 0, 0, 0.4)',
                  boxShadow: '0 4px 8px rgba(0, 0, 0, 0.4)',
                  mb: 1
                }}
              >

                <DiscardedCard card={discardedCard} visible={true} />
              </Box>
            )}
            
            {/* 手牌区域，不再包含弃牌 */}
            <Box 
              sx={{
                p: 1,
                borderRadius: 2,
                bgcolor: 'rgba(0, 0, 0, 0.6)',
                boxShadow: '0 4px 8px rgba(0, 0, 0, 0.5)',
                transition: 'all 0.3s ease',
              }}
            >

              
              <Box sx={{ display: 'flex', flexDirection: 'row', gap: 0.5 }}>
                {/* 只显示没有isDiscarded标记的牌 */}
                {playerHand.filter(card => !card.isDiscarded).map((card, index) => (
                  <Box 
                    key={index} 
                    sx={{ 
                      position: 'relative',
                      cursor: playerHand.length === 3 ? 'pointer' : 'default',
                      transform: selectedCardIndex === index ? 'translateY(-10px)' : 'none',
                      transition: 'transform 0.2s ease',
                      boxShadow: selectedCardIndex === index ? '0 0 10px 3px rgba(255, 215, 0, 0.7)' : 'none',
                    }}
                    onClick={() => playerHand.length === 3 && handleCardClick(index)}
                  >
                    <PlayingCard 
                      card={card.display || card} 
                      faceUp={true}
                    />
                    {selectedCardIndex === index && (
                      <Box sx={{
                        position: 'absolute',
                        top: -10,
                        right: -10,
                        backgroundColor: '#e53935',
                        borderRadius: '50%',
                        width: 24,
                        height: 24,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: 'bold',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                        border: '2px solid white'
                      }}>
                        X
                      </Box>
                    )}
                  </Box>
                ))}
              </Box>
              
              {/* 只在有3张牌时显示弃牌按钮 */}
              {playerHand.length === 3 && !discardedCard && (
                <Button
                  variant="contained"
                  color="error"
                  size="small"
                  disabled={selectedCardIndex === -1}
                  onClick={handleDiscard}
                  sx={{
                    mt: 1,
                    fontSize: '0.75rem',
                    py: 0.5,
                    width: '100%',
                    bgcolor: 'rgba(211, 47, 47, 0.8)',
                    '&:hover': { bgcolor: 'rgba(211, 47, 47, 1)' },
                    '&.Mui-disabled': { bgcolor: 'rgba(66, 66, 66, 0.5)', color: 'rgba(255, 255, 255, 0.3)' }
                  }}
                >
                  弃掉选中的牌
                </Button>
              )}
            </Box>
          </Box>
        )}

        {/* 玩家下注区域 - 防止重复渲染 */}
        {useMemo(() => {
            const bettingSeats = seatDisplayData.filter(seat => seat.betAmount > 0 && seat.player);
            return bettingSeats.map((seat) => (
              <BetArea
                key={`bet-${seat.position}`}
                position={seat.position}
                betAmount={seat.betAmount}
              />
            ));
          }, [seatDisplayData])}

        {seatDisplayData.map((seatData) => {
          
          return (
          <Seat
            key={seatData.id}
            seatData={seatData}
            onSitDown={() => handleSeatSelect(seatData.position)}
            onBuyIn={() => {
              setSelectedSeat(seatData.position);
              setOpenBuyInDialog(true);
            }}
            onStandUp={() => handleAction('stand_up')}
            onChangeSeat={() => {
              setSelectedSeat(seatData.position);
              setChangeSeatDialogOpen(true);
            }}
            isYourTurn={
                seatData.isTurn || 
                (gameState.turnPlayerId === seatData.player?.id &&
                seatData.player?.username === currentUser)
            }
            currentUser={currentUser}
              showCards={showCards}
              gameState={gameState}
              turnTimeRemaining={seatData.turnTimeRemaining}
              turnTimeLimit={seatData.turnTimeLimit}
          />
          );
        })}
        
        {/* 底部玩家操作区 */}
        {(() => {
          // 仅在DEBUG模式下输出按钮渲染条件日志
          const DEBUG_LOG = false; // 设置为false关闭日志
          
          if (DEBUG_LOG && process.env.NODE_ENV === 'development') {
            console.log("操作按钮渲染条件检查:");
            console.log("- isUserTurn:", isUserTurn);
            console.log("- gameState.gamePhase:", gameState.gamePhase);
            console.log("- currentUser:", currentUser);
            console.log("- gameState.game.currentPlayer.name:", gameState.game?.current_player?.name);
            console.log("- gameState.current_player_idx:", gameState.current_player_idx);
          }
          
          // 修改条件判断，放宽按钮显示条件
          const shouldShowActions = 
            // 1. 游戏已经开始
            gameState.gamePhase && 
            gameState.gamePhase !== 'WAITING' && 
            gameState.gamePhase !== 'SHOWDOWN' &&
            // 2. 是当前用户的回合
            (isUserTurn || 
             // 检查当前玩家名称是否匹配
             currentUser && (gameState.game?.current_player?.name === currentUser) 
            );
            
          if (DEBUG_LOG && process.env.NODE_ENV === 'development') {
            console.log("最终判断结果 - 是否显示操作按钮:", shouldShowActions);
          }
          
          if (!shouldShowActions) return null;
          
          return (
                        <Box sx={{
                            position: 'absolute',
              bottom: '20px',  // 调低位置与头像底部对齐
              left: '53%',    // 更靠近头像
            zIndex: 10,
                            display: 'flex',
            justifyContent: 'center',
              transition: 'all 0.3s ease',
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              padding: 1.5,
              borderRadius: 2,
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.5)'
          }}>
            <PlayerActions
              isUserTurn={isCurrentUserTurn()}
              playerChips={getUserPlayer()?.chips || 0}
              minBet={gameState.blinds?.big || gameState.game?.blinds?.big || 1}
              currentBet={gameState.currentBet || gameState.game?.current_bet || 0}
              pot={gameState.pot || gameState.game?.pot || 0}
              canCheck={(gameState.currentBet === 0 || gameState.game?.current_bet === 0 || 
                (getUserPlayer()?.bet_amount && getUserPlayer().bet_amount >= (gameState.currentBet || gameState.game?.current_bet || 0)))}
              canRaise={true}
              canCall={true}
              loading={loading}
              playerBetAmount={getUserPlayer()?.betAmount || getUserPlayer()?.bet_amount || 0}
              onCheck={() => handleAction('check')}
              onCall={() => handleAction('call')}
              onRaise={(amount) => {
                setRaiseAmount(amount);
                handleAction('raise', amount);
              }}
              onFold={() => handleAction('fold')}
              onAllIn={() => handleAction('raise', getUserPlayer()?.chips || 0)}
            />
                                </Box>
          );
        })()}
      </TableArea>
      
      {/* 加注对话框 */}
      <RaiseDialog
        open={openRaiseDialog}
        onClose={() => setOpenRaiseDialog(false)}
        onConfirm={(amount) => {
          setOpenRaiseDialog(false);
          handleAction(gameState.currentBet > 0 ? 'raise' : 'bet', amount);
        }}
        minBet={Math.max(gameState.currentBet * 2, gameState.blinds?.big || 1)}
        maxBet={currentPlayer?.chips || 0}
        currentBet={gameState.currentBet}
        action={gameState.currentBet > 0 ? "raise" : "bet"}
      />
      
      {/* 历史记录对话框 */}
      <GameHistoryDialog
        open={openHistoryDialog}
        onClose={() => setOpenHistoryDialog(false)}
        history={historyData}
        loading={historyLoading}
        error={historyError}
      />
      
      {/* 玩家列表对话框 */}
      <PlayerListDialog
        open={openPlayerListDialog}
        onClose={() => setOpenPlayerListDialog(false)}
        players={preparePlayersForDialog()}
        room={{
          name: gameState.name || roomId,
          owner: gameState.owner || 
                 gameState.players?.find(p => p.isOwner || p.owner === true)?.username || 
                 gameState.players?.find(p => p.isOwner || p.owner === true)?.name || 
                 gameState.game?.players?.find(p => p.isOwner || p.owner === true)?.username || 
                 gameState.game?.players?.find(p => p.isOwner || p.owner === true)?.name || '',
          smallBlind: gameState.blinds?.small || gameState.game?.blinds?.small || 0.5,
          bigBlind: gameState.blinds?.big || gameState.game?.blinds?.big || 1
        }}
        currentUser={currentUser}
      />
      
      {/* 买入对话框 */}
      <Dialog
        open={openBuyInDialog}
        onClose={() => {
          setOpenBuyInDialog(false);
          setErrorMessage('');
          setLoading(false);
          setBuyInAmount('');
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>买入筹码</DialogTitle>
                    <DialogContent>
          <Box mt={2}>
                        <TextField
              label="买入金额 (BB)"
              value={buyInAmount}
              onChange={(e) => setBuyInAmount(e.target.value)}
                            type="number"
                            fullWidth
              variant="outlined"
              error={!!errorMessage}
              helperText={errorMessage}
              inputProps={{ min: 1 }}
              autoFocus
            />
          </Box>
                    </DialogContent>
                    <DialogActions>
          <Button 
            onClick={() => {
              setOpenBuyInDialog(false);
              setErrorMessage('');
              setLoading(false);
              setBuyInAmount('');
            }}
          >
            取消
          </Button>
          <Button 
            onClick={handleBuyIn}
            variant="contained" 
            color="primary"
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : '确认买入'}
          </Button>
                    </DialogActions>
                </Dialog>

      {/* 添加换座确认对话框 */}
      <Dialog
        open={changeSeatDialogOpen}
        onClose={() => setChangeSeatDialogOpen(false)}
        maxWidth="xs"
                            fullWidth
      >
        <DialogTitle>换座确认</DialogTitle>
        <DialogContent>
          <Typography>
            您确定要从逻辑位置 {currentPlayerPosition} 换到逻辑位置 {selectedSeat} 吗？
          </Typography>
                    </DialogContent>
                    <DialogActions>
          <Button onClick={() => setChangeSeatDialogOpen(false)}>
            取消
          </Button>
          <Button 
            onClick={() => {
              setChangeSeatDialogOpen(false);
              handleChangeSeat(selectedSeat);
            }}
            variant="contained" 
            color="primary"
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : '确认换座'}
          </Button>
                    </DialogActions>
                </Dialog>
      
      {/* Notifications */}
      <Snackbar 
        open={notification.open} 
        autoHideDuration={notification.autoHideDuration || 6000} 
        onClose={() => setNotification(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setNotification(prev => ({ ...prev, open: false }))} 
          severity={notification.severity}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
      
      {/* 发牌动画组件 */}
      <CardDealingAnimation
        players={gameState.game?.players || []}
        isActive={showDealingAnimation}
        onAnimationComplete={handleAnimationComplete}
        testMode={testDealingMode} // 新增测试模式状态
        currentUser={currentUser}
        gameState={gameState}
      />

      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 1500, // 增加 z-index
          pointerEvents: 'none', // 允许点击穿透
          backgroundColor: testDealingMode ? 'rgba(0,0,0,0.2)' : 'transparent', // 在测试模式添加背景以便于观察
        }}
      >
        {/* 其他内容保持不变 */}
      </Box>
      
      {/* 添加筹码分配动画组件 */}
      <ChipsDistributionAnimation
        isActive={showDistributionAnimation}
        winners={distributionWinners}
        pot={gameState.pot || (gameState.game && gameState.game.total_pot) || 0}
        onAnimationComplete={handleDistributionAnimationComplete}
        playerPositions={playerPositions}
      />
      
      {/* Add the ChatBox component */}
      <ChatBox roomId={roomId} />
    </GameTableContainer>
        );
};

export default GameTable;