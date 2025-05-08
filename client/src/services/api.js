import axios from 'axios';
import websocketService from './websocket';
import { API_BASE_URL } from '../config';

// Utility to control log levels
const LOG_LEVEL = {
    NONE: 0,
    ERROR: 1,
    WARN: 2,
    INFO: 3,
    DEBUG: 4
};

// Set current log level - change to adjust verbosity
const CURRENT_LOG_LEVEL = LOG_LEVEL.ERROR; // Only show errors by default

// Logging utility functions
const log = {
    error: (message, ...args) => {
        if (CURRENT_LOG_LEVEL >= LOG_LEVEL.ERROR) {
            console.error(message, ...args);
        }
    },
    warn: (message, ...args) => {
        if (CURRENT_LOG_LEVEL >= LOG_LEVEL.WARN) {
            console.warn(message, ...args);
        }
    },
    info: (message, ...args) => {
        if (CURRENT_LOG_LEVEL >= LOG_LEVEL.INFO) {
            console.log(message, ...args);
        }
    },
    debug: (message, ...args) => {
        if (CURRENT_LOG_LEVEL >= LOG_LEVEL.DEBUG) {
            console.log(`[DEBUG] ${message}`, ...args);
        }
    }
};

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Add request interceptor to include auth token with minimal logging
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Simplified logging
    log.debug(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    
    return config;
}, (error) => {
    log.error('Request interceptor error:', error);
    return Promise.reject(error);
});

// 添加响应拦截器，统一处理认证错误
api.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        // 忽略"message port closed"类型的错误，这通常与浏览器扩展有关
        if (error.message && error.message.includes('port closed')) {
            console.log('忽略浏览器扩展相关错误:', error.message);
            // 返回一个解决的promise以防止错误传播
            return Promise.resolve({
                status: 200,
                data: { ignore: true, message: 'Browser extension error ignored' }
            });
        }
        
        // 如果是认证错误（401 Unauthorized 或 403 Forbidden）
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            console.log('认证错误，清除登录状态');
            // 清除本地存储的认证信息
            localStorage.removeItem('token');
            localStorage.removeItem('userId');
            localStorage.removeItem('username');
            
            // 如果不是在登录页面，则重定向到登录页面
            if (window.location.pathname !== '/login') {
                console.log('重定向到登录页面');
                window.location.href = '/login?session_expired=true';
            }
        }
        
        return Promise.reject(error);
    }
);

export const authService = {
    login: (username, password, config = {}) => api.post('/api/auth/login', { username, password }, config),
    register: (username, password) => api.post('/api/auth/register', { username, password }),
    logout: () => api.post('/api/auth/logout'),
    getProfile: () => {
        const username = localStorage.getItem('username');
        if (!username) {
            return Promise.reject(new Error('未登录状态无法获取用户资料'));
        }
        return api.get(`/api/users/${username}`);
    },
    
    // 刷新认证令牌方法
    refreshToken: async () => {
        const username = localStorage.getItem('username');
        if (!username) {
            return Promise.reject(new Error('未登录状态无法刷新令牌'));
        }
        
        try {
            // 使用当前令牌调用刷新接口
            const response = await api.post('/api/auth/refresh-token', { username });
            return response;
        } catch (error) {
            console.error('刷新令牌失败:', error.message);
            return Promise.reject(error);
        }
    },
    
    // 检查用户登录状态并验证token有效性
    checkAuthStatus: async () => {
        const token = localStorage.getItem('token');
        const username = localStorage.getItem('username');
        
        // 如果本地没有token或用户名，则未登录
        if (!token || !username) {
            return { isAuthenticated: false };
        }
        
        try {
            // 尝试获取用户资料，验证token有效性
            const response = await api.get(`/api/users/${username}`);
            return {
                isAuthenticated: true,
                user: response.data
            };
        } catch (error) {
            // 如果请求失败（如token过期、无效或没有权限），清除本地存储
            if (error.response && (error.response.status === 401 || error.response.status === 403)) {
                console.log('身份验证失败，清除登录信息');
                localStorage.removeItem('token');
                localStorage.removeItem('userId');
                localStorage.removeItem('username');
            }
            console.error('验证登录状态失败:', error.message);
            return { isAuthenticated: false };
        }
    }
};

export const userService = {
    getBalance: () => api.get(`/api/users/${localStorage.getItem('userId')}/balance`),
    updateProfile: (userData) => api.put(`/api/users/${localStorage.getItem('userId')}`, userData)
};

export const roomService = {
    getRooms: () => {
        log.debug('Getting room list');
        return api.get('/api/rooms')
            .then(response => {
                log.debug('Room list fetched successfully');
                return response;
            })
            .catch(error => {
                log.error('Failed to get room list:', error.message);
                throw error;
            });
    },
    createRoom: (roomData) => {
        log.debug('Creating room with name:', roomData.name);
        
        // Get current username
        const username = localStorage.getItem('username');
        
        // Create request body with all possible parameters
        const postData = {
            name: roomData.name,
            game_duration_hours: roomData.game_duration_hours || 1.0,
            max_players: roomData.max_players || 8,
            small_blind: roomData.small_blind || 0.5,
            big_blind: roomData.big_blind || 1.0,
            buy_in_min: roomData.buy_in_min || 100,
            buy_in_max: roomData.buy_in_max || 1000,
            creator: username
        };
        
        // Add custom header to pass username
        const config = {
            headers: {
                'X-Username': username || ''
            }
        };
        
        // Send using POST request body
        return api.post('/api/rooms', postData, config)
            .then(response => {
                log.debug('Room created successfully');
                return response;
            })
            .catch(error => {
                log.error('Failed to create room:', error.message);
                throw error;
            });
    },
    joinRoom: (roomId) => {
        log.debug(`Joining room ${roomId}`);
        
        // Get current username
        const username = localStorage.getItem('username');
        if (!username) {
            log.error('Join room failed: No username found');
            return Promise.reject(new Error('用户未登录'));
        }
        
        // Create request body for API
        const joinData = {
            room_id: roomId,
            username: username
        };
        
        // Log minimal info
        log.debug('Joining room with username:', username);
        
        // 注意：加入房间只是将玩家添加到房间列表，不会自动分配座位
        // 玩家需要在UI中手动选择一个座位才能参与游戏
        return api.post('/api/rooms/join', joinData)
            .then(response => {
                log.debug('Joined room successfully - player needs to select a seat');
                return response;
            })
            .catch(error => {
                log.error('Failed to join room:', error.message);
                throw error;
            });
    },
    leaveRoom: (roomId) => {
        // 确认参数
        if (!roomId) {
            console.error('离开房间需要提供roomId');
            return Promise.reject(new Error('参数不完整'));
        }
        
        console.log(`请求离开房间: roomId=${roomId}`);
        
        // 直接发送请求体参数
        return api.post(`/api/rooms/${roomId}/leave`);
    },
    setReady: (roomId, username, isReady) => api.post(`/api/rooms/${roomId}/ready`, { username, ready: isReady }),
    startGame: (roomId) => {
        if (!roomId) {
            log.error('Invalid room ID for start game operation');
            return Promise.reject(new Error('房间ID无效'));
        }
        
        log.debug(`Starting game in room ${roomId} via WebSocket`);
        
        // 检查WebSocket连接状态
        if (!websocketService.isConnected) {
            log.error('WebSocket not connected, cannot start game');
            return Promise.reject(new Error('WebSocket未连接，无法开始游戏'));
        }
        
        // 使用WebSocket发送开始游戏请求
        const success = websocketService.startGame(roomId);
        
        if (success) {
            log.debug('Start game request sent via WebSocket');
            return Promise.resolve({ success: true, message: '游戏开始请求已发送' });
        } else {
            log.error('Failed to send start game request via WebSocket');
            return Promise.reject(new Error('发送开始游戏请求失败'));
        }
    },
    joinOrCreateRoom: (roomId, password = '') => {
        return api.post(`/api/rooms/${roomId}/join`, { password });
    }
};

export const gameService = {
    // 修改 getGameState 方法，完全使用 WebSocket
    getGameState: (roomId) => {
        if (!roomId) {
            log.error('Invalid roomId for getGameState');
            return Promise.reject(new Error('房间ID无效'));
        }
        
        log.debug(`Getting game state for room ${roomId} via WebSocket`);
        
        if (!websocketService.isConnected) {
            log.error('WebSocket not connected');
            return Promise.reject(new Error('WebSocket未连接，无法获取游戏状态'));
        }
        
        const success = websocketService.getGameState(roomId);
        if (success) {
            return Promise.resolve({ success: true, message: '游戏状态请求已通过WebSocket发送' });
        } else {
            return Promise.reject(new Error('通过WebSocket请求游戏状态失败'));
        }
    },
    
    // 修改playerAction方法，完全使用WebSocket进行通信
    playerAction: (roomId, action, amount = 0, cards = null) => {
        // Log the request parameters
        console.log(`Player action: ${action}, amount: ${amount}, cards: ${cards}, room: ${roomId}`);
        
        // 确保WebSocket已连接
        if (!websocketService.isConnected) {
            console.error('WebSocket未连接，无法执行游戏操作');
            return Promise.reject(new Error('WebSocket未连接，请刷新页面或稍后再试'));
        }
        
        // 根据操作类型使用相应的WebSocket方法
        let success = false;
        
        try {
            switch (action) {
                case 'fold':
                    success = websocketService.fold();
                    break;
                case 'check':
                    success = websocketService.check();
                    break;
                case 'call':
                    success = websocketService.call();
                    break;
                case 'bet':
                    success = websocketService.bet(amount);
                    break;
                case 'raise':
                    success = websocketService.raise(amount);
                    break;
                case 'discard':
                    success = websocketService.discard(cards);
                    break;
                case 'start_game':
                    success = websocketService.startGame(roomId);
                    break;
                default:
                    console.warn(`未知操作类型: ${action}`);
                    break;
            }
        } catch (error) {
            console.error('通过WebSocket发送操作失败:', error);
            success = false;
        }
        
        if (success) {
            return Promise.resolve({ success: true, message: '操作已通过WebSocket发送' });
        } else {
            return Promise.reject(new Error('WebSocket操作失败'));
        }
    },
    
    // Convenience methods for specific actions
    fold: (roomId) => {
        console.log(`[GameService] 执行弃牌操作: roomId=${roomId}`);
        if (!websocketService.isConnected) {
            return Promise.reject(new Error('WebSocket未连接，无法执行操作'));
        }
        return websocketService.fold() 
            ? Promise.resolve({ success: true }) 
            : Promise.reject(new Error('发送弃牌操作失败'));
    },
    
    check: (roomId) => {
        console.log(`[GameService] 执行看牌操作: roomId=${roomId}`);
        if (!websocketService.isConnected) {
            return Promise.reject(new Error('WebSocket未连接，无法执行操作'));
        }
        return websocketService.check() 
            ? Promise.resolve({ success: true }) 
            : Promise.reject(new Error('发送看牌操作失败'));
    },
    
    call: (roomId) => {
        console.log(`[GameService] 执行跟注操作: roomId=${roomId}`);
        if (!websocketService.isConnected) {
            return Promise.reject(new Error('WebSocket未连接，无法执行操作'));
        }
        return websocketService.call() 
            ? Promise.resolve({ success: true }) 
            : Promise.reject(new Error('发送跟注操作失败'));
    },
    
    bet: (roomId, amount) => {
        console.log(`[GameService] 执行下注操作: roomId=${roomId}, amount=${amount}`);
        if (!websocketService.isConnected) {
            return Promise.reject(new Error('WebSocket未连接，无法执行操作'));
        }
        return websocketService.bet(amount) 
            ? Promise.resolve({ success: true }) 
            : Promise.reject(new Error('发送下注操作失败'));
    },
    
    raise: (roomId, amount) => {
        console.log(`[GameService] 执行加注操作: roomId=${roomId}, amount=${amount}`);
        if (!websocketService.isConnected) {
            return Promise.reject(new Error('WebSocket未连接，无法执行操作'));
        }
        return websocketService.raise(amount) 
            ? Promise.resolve({ success: true }) 
            : Promise.reject(new Error('发送加注操作失败'));
    },
    
    discard: (roomId, discardIndex) => {
        console.log(`[GameService] 执行弃牌操作: roomId=${roomId}, discardIndex=${discardIndex}`);
        if (!websocketService.isConnected) {
            return Promise.reject(new Error('WebSocket未连接，无法执行操作'));
        }
        return websocketService.discard(discardIndex) 
            ? Promise.resolve({ success: true }) 
            : Promise.reject(new Error('发送弃牌操作失败'));
    },
    
    // 修改买入方法，使用WebSocket
    playerBuyIn: (roomId, amount = 100, seatIndex) => {
        console.log(`[GameService] 买入请求: roomId=${roomId}, amount=${amount}, seatIndex=${seatIndex}`);
        
        if (!websocketService.isConnected) {
            return Promise.reject(new Error('WebSocket未连接，无法执行操作'));
        }
        
        const success = websocketService.buyIn(roomId, amount, seatIndex);
        return success 
            ? Promise.resolve({ success: true, message: '买入请求已发送' }) 
            : Promise.reject(new Error('发送买入请求失败'));
    },
    
    // 入座方法，使用WebSocket
    sitDown: (roomId, seatIndex) => {
        console.log(`[GameService] 入座请求: roomId=${roomId}, seatIndex=${seatIndex}`);
        
        if (!websocketService.isConnected) {
            return Promise.reject(new Error('WebSocket未连接，无法执行操作'));
        }
        
        const success = websocketService.sitDown(roomId, seatIndex);
        return success 
            ? Promise.resolve({ success: true, message: '入座请求已发送' }) 
            : Promise.reject(new Error('发送入座请求失败'));
    },
    
    // 站起方法，使用WebSocket
    standUp: (roomId) => {
        console.log(`[GameService] 站起请求: roomId=${roomId}`);
        
        if (!websocketService.isConnected) {
            return Promise.reject(new Error('WebSocket未连接，无法执行操作'));
        }
        
        const success = websocketService.standUp(roomId);
        return success 
            ? Promise.resolve({ success: true, message: '站起请求已发送' }) 
            : Promise.reject(new Error('发送站起请求失败'));
    },
    
    // 换座方法，使用WebSocket
    changeSeat: (roomId, targetSeat) => {
        console.log(`[GameService] 换座请求: roomId=${roomId}, targetSeat=${targetSeat}`);
        
        if (!websocketService.isConnected) {
            return Promise.reject(new Error('WebSocket未连接，无法执行操作'));
        }
        
        const success = websocketService.changeSeat(roomId, targetSeat);
        return success 
            ? Promise.resolve({ success: true, message: '换座请求已发送' }) 
            : Promise.reject(new Error('发送换座请求失败'));
    },
    
    // 修改获取游戏历史记录方法，使用WebSocket
    getGameHistory: (roomId) => {
        console.log(`[GameService] 获取游戏历史记录: roomId=${roomId}`);
        
        // 验证参数
        if (!roomId) {
            console.error('Get game history error: Missing roomId');
            return Promise.reject(new Error('房间ID不能为空'));
        }
        
        // 使用WebSocket发送获取历史记录请求
        if (!websocketService.isConnected) {
            return Promise.reject(new Error('WebSocket未连接，无法执行操作'));
        }
        
        const success = websocketService.getGameHistory(roomId);
        
        // 由于WebSocket是异步的，我们需要创建一个Promise来等待响应
        // 这里简单返回成功，实际响应会通过WebSocket事件处理
        return success 
            ? Promise.resolve({ success: true, data: { message: '历史记录请求已发送' } }) 
            : Promise.reject(new Error('发送历史记录请求失败'));
    },
    
    // 添加退出游戏方法
    exitGame: (roomId) => {
        console.log(`[GameService] 退出游戏请求: roomId=${roomId}`);
        
        if (!roomId) {
            console.error('Exit game error: Missing roomId');
            return Promise.reject(new Error('房间ID不能为空'));
        }
        
        if (!websocketService.isConnected) {
            console.log('WebSocket未连接，无需发送退出请求');
            return Promise.resolve({ success: true, data: { message: '已退出游戏' } });
        }
        
        // 发送退出游戏请求，并标记为主动断开
        const success = websocketService.exitGame(roomId);
        
        return success 
            ? Promise.resolve({ success: true, data: { message: '退出游戏请求已发送' } }) 
            : Promise.reject(new Error('发送退出游戏请求失败'));
    },
    
    // 添加退出游戏房间方法
    exitGameRoom: async (roomId, username) => {
        console.log(`[GameService] 退出游戏房间请求: roomId=${roomId}, username=${username}`);
        
        if (!roomId || !username) {
            console.error('Exit game room error: Missing roomId or username');
            return Promise.reject(new Error('房间ID和用户名不能为空'));
        }
        
        try {
            // 如果WebSocket已连接，也通过WebSocket发送退出通知
            if (websocketService.isConnected) {
                websocketService.exitGame(roomId);
            }
            
            return { success: true, message: '已成功退出游戏房间' };
        } catch (error) {
            console.error(`退出游戏房间失败:`, error);
            
            // 即使API调用失败，我们仍然尝试通过WebSocket退出
            if (websocketService.isConnected) {
                websocketService.exitGame(roomId);
            }
            
            // 如果错误是409冲突或404未找到，我们认为玩家已不在房间中，返回成功
            if (error.response && (error.response.status === 409 || error.response.status === 404)) {
                return { success: true, message: '玩家已不在房间中' };
            }
            
            return Promise.reject(new Error(error.message || '退出游戏房间失败'));
        }
    },
    
    // Connect to game room WebSocket
    connectToGameRoom: async (roomId) => {
        if (!roomId) {
            console.error('Cannot connect to game room: Missing roomId');
            return Promise.reject(new Error('缺少房间ID'));
        }
        
        const token = localStorage.getItem('token');
        const username = localStorage.getItem('username');
        
        if (!token || !username) {
            console.error('Cannot connect to game room: Missing authentication');
            return Promise.reject(new Error('未登录或会话已过期'));
        }
        
        console.log(`连接到游戏房间WebSocket: ${roomId}`);
        
        try {
            // First, ensure we're a member of the room
            try {
                console.log(`Ensuring user ${username} is a member of room ${roomId}`);
                // Check if roomId is 'default' (which isn't a real room) and handle differently
                if (roomId === 'default') {
                    console.log('Using default room, skipping join step');
                } else {
                    // Join the room first (this will be a no-op if already a member)
                    await api.post('/api/rooms/join', {
                        room_id: roomId,
                        username: username
                    });
                    console.log(`Successfully joined room ${roomId}`);
                }
            } catch (joinError) {
                // If it's a 409 conflict, the user is already in the room - that's fine
                if (joinError.response && joinError.response.status !== 409) {
                    console.warn(`Failed to join room ${roomId}:`, joinError.message);
                    // We'll continue anyway - maybe the user is already in the room
                }
            }
            
            // Now connect to the WebSocket
            websocketService.connect(roomId);
            
            // Return a promise that resolves when connection is established
            // or rejects after a timeout
            return new Promise((resolve, reject) => {
                // Set up connection success handler
                const connectHandler = () => {
                    console.log(`Successfully connected to room ${roomId}`);
                    clearTimeout(timeoutId); // 确保清除超时计时器
                    cleanup();
                    resolve();
                };
                
                // Set up error handler
                const errorHandler = (error) => {
                    console.error(`Error connecting to room ${roomId}:`, error);
                    clearTimeout(timeoutId); // 确保清除超时计时器
                    cleanup();
                    reject(new Error(error.message || '连接游戏服务器失败'));
                };
                
                // Function to clean up event listeners
                const cleanup = () => {
                    // 直接清理事件监听器，不使用setTimeout
                    websocketService.removeEventListener('connect', connectHandler);
                    websocketService.removeEventListener('error', errorHandler);
                };
                
                // Register event handlers
                websocketService.addEventListener('connect', connectHandler);
                websocketService.addEventListener('error', errorHandler);
                
                // Set connection timeout
                const timeoutId = setTimeout(() => {
                    console.error(`Connection to room ${roomId} timed out`);
                    cleanup();
                    
                    // 检查WebSocket实际状态，如果已连接但回调没触发，则直接解析
                    if (websocketService.socket && websocketService.socket.readyState === WebSocket.OPEN) {
                        console.log('WebSocket实际已连接但连接事件未触发，强制解析Promise');
                        resolve();
                        return;
                    }
                    
                    reject(new Error('连接游戏服务器超时'));
                }, 10000);
                
                // If already connected, resolve immediately
                if (websocketService.isConnected) {
                    console.log('WebSocket已连接，立即解析Promise');
                    clearTimeout(timeoutId);
                    cleanup();
                    resolve();
                }
            });
        } catch (error) {
            console.error(`Failed to connect to room ${roomId}:`, error);
            return Promise.reject(error);
        }
    },
    
    // Disconnect from game room WebSocket
    disconnectFromGameRoom: () => {
        console.log('断开游戏房间WebSocket连接');
        websocketService.disconnect();
    },
    
    // Register a handler for game state updates
    onGameStateUpdate: (roomId, callback) => {
        websocketService.registerGameStateHandler(roomId, callback);
    },
    
    // Unregister a handler for game state updates
    offGameStateUpdate: (roomId) => {
        // 如果websocketService有unregisterGameStateHandler方法，使用它
        if (typeof websocketService.unregisterGameStateHandler === 'function') {
            websocketService.unregisterGameStateHandler(roomId);
        } else {
            // 如果没有专门的注销方法，可以使用通用的事件处理器机制
            console.log(`注销游戏状态处理器: ${roomId}`);
            // 如果没有可用的方法，至少记录一下，避免错误
        }
    },
    
    // Add WebSocket event listener
    addEventListener: (event, callback) => {
        return websocketService.addEventListener(event, callback);
    },
    
    // 添加startGame方法
    startGame: (roomId) => {
        console.log(`[GameService] 开始游戏请求: roomId=${roomId}`);
        
        if (!websocketService.isConnected) {
            return Promise.reject(new Error('WebSocket未连接，无法执行操作'));
        }
        
        const success = websocketService.startGame(roomId);
        return success 
            ? Promise.resolve({ success: true, message: '开始游戏请求已发送' }) 
            : Promise.reject(new Error('发送开始游戏请求失败'));
    }
};

export default api;