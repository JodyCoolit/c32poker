import { toast } from 'react-toastify';

class WebSocketService {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectTimeout = 3000; // 3 seconds between reconnect attempts
        this.heartbeatInterval = null;
        this.listeners = {
            gameState: [],
            gameUpdate: [],
            playerAction: [],
            connect: [],
            disconnect: [],
            error: [],
            chat: [],
            playerJoined: [],
            playerLeft: [],
            roomUpdate: []
        };
        this.lastGameStateHash = null;
        this.lastStateUpdateTime = 0;
        this.previousGameState = null;
        this.gameStateHandlers = new Map();
        this.messageQueue = [];
        this.pendingMessages = new Map();
        this.debounceTimers = {};
        this.updateQueue = {};
    }

    // Generate a simple hash from game state to detect relevant changes
    _generateStateHash(gameState) {
        if (!gameState) return null;
        
        // Helper functions to extract data from potentially nested structures
        const getGamePhase = (state) => {
            return state.gamePhase || 
                   state.game_phase || 
                   (state.game ? state.game.game_phase : '');
        };
        
        const getPotAmount = (state) => {
            return state.pot || 
                   state.totalPot || 
                   (state.game ? state.game.total_pot : 0);
        };
        
        const getCurrentPlayer = (state) => {
            return state.current_player_position || 
                   state.current_player_idx || 
                   (state.game ? state.game.current_player_idx : -1);
        };
        
        const getCommunityCardsCount = (state) => {
            if (state.community_cards && state.community_cards.length) {
                return state.community_cards.length;
            }
            if (state.communityCards && state.communityCards.length) {
                return state.communityCards.length;
            }
            if (state.game && state.game.community_cards) {
                return state.game.community_cards.length;
            }
            return 0;
        };
        
        const getDealerPosition = (state) => {
            return state.dealer_position || 
                   state.dealerPosition || 
                   (state.game ? state.game.dealer_idx : -1);
        };
        
        // Extract critical fields that would indicate a state change
        const criticalFields = {
            phase: getGamePhase(gameState),
            pot: getPotAmount(gameState),
            currentPlayer: getCurrentPlayer(gameState),
            communityCards: getCommunityCardsCount(gameState),
            status: gameState.status || '',
            betting_round: gameState.betting_round || (gameState.game ? gameState.game.betting_round : 0),
            isGameStarted: !!(gameState.isGameStarted || (gameState.game && gameState.game.started)),
            dealerPosition: getDealerPosition(gameState)
        };
        
        // Add player states hash to detect player-specific changes
        if (gameState.game?.players && gameState.game?.players.length > 0) {
            criticalFields.playersHash = gameState.game.players.map(p => ({
                id: p.id || p.username || '',
                position: p.position || -1,
                chips: p.chips,
                bet: p.bet_amount,
                status: p.status,
                isPlaying: !!p.isPlaying,
                // 添加弃牌信息到状态哈希计算
                has_discarded: !!p.has_discarded,
                discarded_card: p.discarded_card || null,
                // 添加手牌数量变化检测
                handSize: (p.hand && Array.isArray(p.hand)) ? p.hand.length : 0
            }));
        }
        
        // 只在调试模式下记录详细日志，减少控制台输出
        if (process.env.NODE_ENV === 'development') {
        console.log('生成状态哈希，关键字段：', criticalFields);
        }
        
        return JSON.stringify(criticalFields);
    }

    // Debounce function to limit rapid updates
    _debounce(key, callback, delay = 200) {
        // Clear any existing timer for this key
        if (this.debounceTimers[key]) {
            clearTimeout(this.debounceTimers[key]);
        }
        
        // Set new timer
        this.debounceTimers[key] = setTimeout(() => {
            callback();
            delete this.debounceTimers[key];
        }, delay);
    }

    // Queue update to be processed
    _queueUpdate(roomId, updateType, data) {
        if (!this.updateQueue[roomId]) {
            this.updateQueue[roomId] = {};
        }
        
        // Store latest data for this update type
        this.updateQueue[roomId][updateType] = data;
        
        // Process the queue after a delay
        this._debounce(`process_${roomId}`, () => this._processUpdateQueue(roomId), 100);
    }
    
    // Process all queued updates for a room
    _processUpdateQueue(roomId) {
        if (!this.updateQueue[roomId]) return;
        
        const updates = this.updateQueue[roomId];
        
        // Process in priority order: gameState, gameUpdate, playerAction, etc.
        if (updates.gameState) {
            this._handleGameState(updates.gameState);
        }
        
        if (updates.gameUpdate) {
            this._handleGameUpdate(updates.gameUpdate);
        }
        
        if (updates.playerAction) {
            this._notifyListeners('playerAction', updates.playerAction);
        }
        
        // Clear the queue
        delete this.updateQueue[roomId];
    }

    connect(roomId) {
        if (this.socket && this.isConnected) {
            this.disconnect();
        }

        const token = localStorage.getItem('token');
        const username = localStorage.getItem('username');
        
        if (!token || !username) {
            console.error('Cannot connect WebSocket: Missing authentication');
            this._notifyListeners('error', { message: 'Missing authentication information' });
            return;
        }

        // 添加更详细的token调试信息
        console.log('认证信息检查:');
        console.log('- token存在:', !!token);
        console.log('- token长度:', token ? token.length : 0);
        console.log('- username:', username);

        // Get WebSocket URL from environment or use default
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsBaseUrl = process.env.REACT_APP_WS_URL || `${wsProtocol}//${window.location.hostname}:8000`;
        
        // 确保token正确编码且不为undefined
        const encodedToken = token ? encodeURIComponent(token) : '';
        const targetRoomId = roomId || 'default';
        const wsUrl = `${wsBaseUrl}/ws/game/${targetRoomId}?token=${encodedToken}`;
        
        // 添加连接URL调试
        console.log(`连接WebSocket URL: ${wsUrl.substring(0, wsUrl.indexOf('?'))}?token=******`);

        try {
            console.log(`Connecting to WebSocket for room ${targetRoomId}`);
            this.socket = new WebSocket(wsUrl);

            this.socket.onopen = () => {
                console.log(`WebSocket connection established for room ${targetRoomId}`);
                this.isConnected = true;
                this.reconnectAttempts = 0;
                
                // 确保连接事件通知在状态更新后立即执行
                try {
                    console.log('触发connect事件通知监听器');
                    const listenersCount = this.listeners['connect']?.length || 0;
                    console.log(`连接事件监听器数量: ${listenersCount}`);
                    this._notifyListeners('connect');
                } catch (error) {
                    console.error('通知连接事件监听器出错:', error);
                }
                
                // Start heartbeat
                this._startHeartbeat();
            };

            this.socket.onclose = (event) => {
                const reason = event.reason || 'Unknown reason';
                console.log(`WebSocket connection closed (${event.code}): ${reason}`);
                
                // Additional logging for authentication issues
                if (event.code === 1008 || event.code === 403) {
                    // Process the reason message to determine specific error type
                    if (reason.includes('Not a member of this room') || reason.includes('not in room')) {
                        console.error(`Room membership error: ${reason}`);
                        this._notifyListeners('error', { 
                            message: `无法加入房间: ${reason}`,
                            code: event.code,
                            type: 'room_access'
                        });
                    } else if (reason.includes('Invalid token') || reason.includes('token')) {
                        console.error('Authentication error: Invalid or expired token');
                        // If token is expired, we could try to refresh it here
                        this._notifyListeners('error', { 
                            message: '认证失败，请重新登录',
                code: event.code,
                            type: 'auth'
                        });
                        
                        // Clear token if it's invalid
                        if (reason.includes('Invalid token')) {
                            console.warn('Clearing invalid token from localStorage');
                            localStorage.removeItem('token');
                        }
                    } else {
                        // Generic authorization error
                        this._notifyListeners('error', { 
                            message: reason || '无法连接到游戏服务器',
                            code: event.code,
                            type: 'access_denied'
                        });
                    }
                }
                
                this.isConnected = false;
                this._notifyListeners('disconnect', { code: event.code, reason });
                
                // Stop heartbeat
                this._stopHeartbeat();
                
                // Attempt reconnection only if not an auth error or room access error
                if (event.code !== 1008 && event.code !== 403) {
                    this._attemptReconnect(targetRoomId);
                }
            };

            this.socket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this._notifyListeners('error', { 
                    message: '连接服务器时发生错误',
                    error 
                });
            };

            this.socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('Received WebSocket message:', data.type);

                    // Extract roomId from data if available
                    const messageRoomId = data.data?.game_state?.room_id || 
                                  data.data?.room_id || 
                                  targetRoomId || 
                                  'default';
                    
                    switch (data.type) {
                        case 'game_state':
                            // Queue game state update
                            console.log('Received game_state update', data.data);
                            this._queueUpdate(messageRoomId, 'gameState', data.data);
                            break;
                            
                        case 'game_update': 
                            // Queue game update
                            console.log('Received game_update', data.data);
                            this._queueUpdate(messageRoomId, 'gameUpdate', data.data);
                            break;
                            
                        case 'player_connected':
                        case 'player_joined':
                            console.log('Player joined/connected:', data.data);
                            this._notifyListeners('playerJoined', data.data);
                            break;
                            
                        case 'player_disconnected':
                            console.log('Player disconnected:', data.data);
                            this._notifyListeners('playerLeft', data.data);
                            break;
                            
                        case 'room_update':
                            console.log('Received room_update:', data.data);
                            // Check if we have any listeners for roomUpdate
                            const hasRoomUpdateListeners = this.listeners['roomUpdate'] && this.listeners['roomUpdate'].length > 0;
                            console.log(`Room update listeners registered: ${hasRoomUpdateListeners ? 'Yes' : 'No'}`);
                            this._notifyListeners('roomUpdate', data.data);
                            break;
                            
                        case 'chat':
                            console.log('Received chat message:', data.data);
                            this._notifyListeners('chat', data.data);
                            break;
                            
                        case 'error':
                            this._notifyListeners('error', data.data);
                            toast.error(data.data.message || 'Server error');
                            break;
                            
                        case 'pong':
                            // Heartbeat response, no action needed
                            break;
                            
                        case 'game_history':
                            console.log('Received game history data:', data.data);
                            this._notifyListeners('game_history', data.data);
                            break;
                            
                        default:
                            console.log(`Unhandled message type: ${data.type}`);
                    }
                } catch (err) {
                    console.error('Failed to parse WebSocket message:', err);
                }
            };
        } catch (error) {
            console.error('Failed to create WebSocket connection:', error);
            this._notifyListeners('error', { 
                message: '无法创建WebSocket连接',
                error 
            });
        }
    }

    disconnect() {
        this._stopHeartbeat();
        
        if (this.socket) {
            console.log('Closing WebSocket connection');
            this.socket.close();
            this.socket = null;
            this.isConnected = false;
        }
    }

    _startHeartbeat() {
        this._stopHeartbeat(); // Clear any existing interval
        
        // Send a ping every 30 seconds to keep the connection alive
        this.heartbeatInterval = setInterval(() => {
            if (this.isConnected) {
                this.sendAction('ping');
            }
        }, 30000);
    }

    _stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    _attemptReconnect(roomId) {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log(`Maximum reconnect attempts (${this.maxReconnectAttempts}) reached, giving up`);
            this._notifyListeners('error', { message: '达到最大重连次数，放弃连接' });
            return;
        }

        this.reconnectAttempts++;
        
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        
        // Clear any existing timeout
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }
        
        // Set timeout for reconnection
        this.reconnectTimer = setTimeout(() => {
            if (!this.isConnected) {
                console.log(`Reconnecting to room ${roomId}...`);
                this.connect(roomId);
            }
        }, this.reconnectTimeout * Math.min(this.reconnectAttempts, 3));
    }

    _handleGameState(gameState) {
        // Check if state has meaningfully changed
        const stateHash = this._generateStateHash(gameState);
        if (stateHash === this.lastGameStateHash) {
            console.log('跳过重复的游戏状态更新');
            return;
        }
        
        // 检查是否为关键更新
        const isKeyUpdate = this._isKeyUpdate(gameState);
        
        // 如果不是关键更新，并且最后一次更新时间距现在不足1秒，则跳过
        const now = Date.now();
        if (!isKeyUpdate && (now - this.lastStateUpdateTime < 1000)) {
            console.log('非关键更新且距离上次更新不足1秒，跳过');
            return;
        }
        
        // Update hash and timestamp
        this.lastGameStateHash = stateHash;
        this.lastStateUpdateTime = now;
        
        // Notify all game state listeners
        this._notifyListeners('gameState', gameState);
        
        // Check for specific room handlers
        if (gameState.room_id) {
            console.log(`检查房间 ${gameState.room_id} 的特定处理器`);
            const handler = this.gameStateHandlers.get(gameState.room_id);
            
            if (handler) {
                console.log(`找到房间 ${gameState.room_id} 的处理器，正在调用...`);
                handler(gameState);
                console.log(`房间 ${gameState.room_id} 的处理器调用完成`);
            } else {
                console.log(`未找到房间 ${gameState.room_id} 的处理器，已注册的房间:`, 
                           Array.from(this.gameStateHandlers.keys()));
            }
        } else {
            console.log(`游戏状态中未包含房间ID:`, gameState);
        }
    }
    
    // Helper to identify key updates that should never be skipped
    _isKeyUpdate(gameState) {
        // Previous state might not exist yet
        if (!this.previousGameState) {
            this.previousGameState = gameState;
            return true;
        }
        
        // 提取游戏阶段，支持多种可能的路径
        const getGamePhase = (state) => {
            return state.gamePhase || 
                   state.game_phase || 
                   (state.game ? state.game.game_phase : null);
        };
        
        // 提取底池金额，支持多种可能的路径
        const getPotAmount = (state) => {
            return state.pot || 
                   state.totalPot || 
                   (state.game ? state.game.total_pot : 0);
        };
        
        // 提取庄家位置，支持多种可能的路径
        const getDealerPosition = (state) => {
            return state.dealer_position || 
                   state.dealerPosition || 
                   (state.game ? state.game.dealer_idx : -1);
        };
        
        // 提取公共牌，支持多种可能的路径
        const getCommunityCardsCount = (state) => {
            if (state.community_cards && state.community_cards.length) {
                return state.community_cards.length;
            }
            if (state.communityCards && state.communityCards.length) {
                return state.communityCards.length;
            }
            if (state.game && state.game.community_cards) {
                return state.game.community_cards.length;
            }
            return 0;
        };
        
        // Key changes that should always trigger an update
        const currentPhase = getGamePhase(gameState);
        const previousPhase = getGamePhase(this.previousGameState);
        const phaseChanged = currentPhase !== previousPhase;
        
        const currentPot = getPotAmount(gameState);
        const previousPot = getPotAmount(this.previousGameState);
        const potChanged = currentPot !== previousPot;
        
        const currentDealer = getDealerPosition(gameState);
        const previousDealer = getDealerPosition(this.previousGameState);
        const dealerChanged = currentDealer !== previousDealer;
        
        const currentCards = getCommunityCardsCount(gameState);
        const previousCards = getCommunityCardsCount(this.previousGameState);
        const cardsChanged = currentCards !== previousCards;
        
        const gameStartedChanged = !!gameState.isGameStarted !== !!this.previousGameState.isGameStarted;
        
        // 如果检测到关键更新，记录详细信息
        if (phaseChanged || potChanged || dealerChanged || cardsChanged || gameStartedChanged) {
            console.log('检测到关键游戏状态更新:', {
                phaseChanged: phaseChanged ? `${previousPhase || 'undefined'} -> ${currentPhase || 'undefined'}` : false,
                potChanged: potChanged ? `${previousPot} -> ${currentPot}` : false,
                dealerChanged: dealerChanged ? `${previousDealer} -> ${currentDealer}` : false,
                cardsChanged: cardsChanged ? `${previousCards} -> ${currentCards}` : false,
                gameStartedChanged: gameStartedChanged ? `${!!this.previousGameState.isGameStarted} -> ${!!gameState.isGameStarted}` : false
            });
        }
        
        // Update previous state reference
        this.previousGameState = JSON.parse(JSON.stringify(gameState));
        
        // Return true if any key field changed
        return phaseChanged || potChanged || dealerChanged || cardsChanged || gameStartedChanged;
    }

    _handleGameUpdate(updateData) {
        // 记录弃牌操作
        if (updateData.action === 'discard') {
            console.log('检测到弃牌操作:', updateData);
            
            // 强制更新游戏状态
            this.lastGameStateHash = null;
        }
        
        // Notify about game update (includes action and result)
        this._notifyListeners('gameUpdate', updateData);
        
        // If game state is included, process it
        if (updateData.game_state) {
            this._handleGameState(updateData.game_state);
        }
        
        // If it has action data, also notify as player action
        if (updateData.action && updateData.player) {
            this._notifyListeners('playerAction', {
                player_name: updateData.player,
                action: updateData.action,
                amount: updateData.amount,
                cards: updateData.cards,
                timestamp: updateData.timestamp || new Date().getTime()
            });
        }
    }

    sendAction(action, data = {}) {
        if (!this.socket || !this.isConnected) {
            console.error('WebSocket is not connected, cannot send action');
            return false;
        }
        
        try {
            const message = {
                type: action,
                ...data
            };
            
            console.log('Sending WebSocket action:', message);
            this.socket.send(JSON.stringify(message));
                return true;
        } catch (error) {
            console.error('Failed to send action via WebSocket:', error);
            return false;
        }
    }

    sendChat(message) {
        return this.sendAction('chat', { message });
    }

    // Game action methods
    fold() {
        return this.sendAction('game_action', { action: 'fold' });
    }
    
    check() {
        return this.sendAction('game_action', { action: 'check' });
    }
    
    call() {
        return this.sendAction('game_action', { action: 'call' });
    }
    
    bet(amount) {
        return this.sendAction('game_action', { action: 'bet', amount: parseFloat(amount) });
    }
    
    raise(amount) {
        return this.sendAction('game_action', { action: 'raise', amount: parseFloat(amount) });
    }
    
    discard(cardIndex) {
        return this.sendAction('game_action', { action: 'discard', card_index: cardIndex });
    }

    // 新增的操作函数：入座
    sitDown(roomId, seatIndex) {
        return this.sendAction('room_action', { 
            action: 'sit_down', 
            room_id: roomId,
            seat_index: parseInt(seatIndex, 10)
        });
    }

    // 新增的操作函数：买入筹码
    buyIn(roomId, amount, seatIndex) {
        return this.sendAction('room_action', { 
            action: 'buy_in', 
            room_id: roomId,
            amount: parseFloat(amount),
            seat_index: parseInt(seatIndex, 10)
        });
    }

    // 新增的操作函数：站起
    standUp(roomId) {
        return this.sendAction('room_action', { 
            action: 'stand_up', 
            room_id: roomId
        });
    }

    // 新增的操作函数：换座
    changeSeat(roomId, targetSeat) {
        return this.sendAction('room_action', { 
            action: 'change_seat', 
            room_id: roomId,
            new_seat_index: parseInt(targetSeat, 10)
        });
    }

    // 新增的操作函数：开始游戏
    startGame(roomId) {
        return this.sendAction('room_action', { 
            action: 'start_game', 
            room_id: roomId
        });
    }

    // 获取游戏历史记录
    getGameHistory(roomId) {
        return this.sendAction('room_action', { 
            action: 'get_game_history', 
            room_id: roomId 
        });
    }
    
    // 获取游戏状态
    getGameState(roomId) {
        return this.sendAction('room_action', { 
            action: 'get_game_state', 
            room_id: roomId 
        });
    }
    
    // 退出游戏
    exitGame(roomId) {
        return this.sendAction('room_action', { 
            action: 'exit_game', 
            room_id: roomId 
        });
    }

    registerGameStateHandler(roomId, handler) {
        if (typeof handler !== 'function') {
            console.error('Game state handler must be a function');
            return;
        }
        
        this.gameStateHandlers.set(roomId, handler);
        console.log(`已注册房间 ${roomId} 的游戏状态处理器，当前注册的房间:`, 
                   Array.from(this.gameStateHandlers.keys()));
    }

    unregisterGameStateHandler(roomId) {
        this.gameStateHandlers.delete(roomId);
        console.log(`Unregistered game state handler for room ${roomId}`);
    }

    addEventListener(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
        return () => this.removeEventListener(event, callback);
    }

    removeEventListener(event, callback) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }

    _notifyListeners(event, data) {
        if (!this.listeners[event]) {
            console.log(`No listeners registered for event: ${event}`);
            return;
        }
        
        console.log(`Notifying ${this.listeners[event].length} listeners for event: ${event}`);
        
        // 创建临时副本避免迭代中修改的问题
        const listeners = [...this.listeners[event]];
        
        listeners.forEach((callback, index) => {
            try {
                console.log(`执行 ${event} 监听器 #${index+1}`);
                callback(data);
                console.log(`${event} 监听器 #${index+1} 执行成功`);
            } catch (error) {
                console.error(`Error executing ${event} listener #${index+1}:`, error);
                // 错误堆栈可能包含更多信息
                if (error.stack) {
                    console.error('Error stack:', error.stack);
                }
            }
        });
        
        console.log(`所有 ${event} 事件监听器通知完成`);
    }
    
    // Convenience methods for event registration
    onGameStateUpdate(roomId, callback) {
        this.registerGameStateHandler(roomId, callback);
        return () => this.unregisterGameStateHandler(roomId);
    }
    
    onGameUpdate(callback) {
        return this.addEventListener('gameUpdate', callback);
    }
    
    onPlayerAction(callback) {
        return this.addEventListener('playerAction', callback);
    }
    
    onConnect(callback) {
        return this.addEventListener('connect', callback);
    }
    
    onDisconnect(callback) {
        return this.addEventListener('disconnect', callback);
    }
    
    onError(callback) {
        return this.addEventListener('error', callback);
    }
    
    onPlayerJoined(callback) {
        return this.addEventListener('playerJoined', callback);
    }
    
    onPlayerLeft(callback) {
        return this.addEventListener('playerLeft', callback);
    }
    
    onChat(callback) {
        return this.addEventListener('chat', callback);
    }
    
    // Add convenience method for room updates
    onRoomUpdate(callback) {
        return this.addEventListener('roomUpdate', callback);
    }
}

// Export a singleton instance
const websocketService = new WebSocketService();
export default websocketService;