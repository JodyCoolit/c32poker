import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Box, 
    Button, 
    TextField, 
    Dialog, 
    DialogTitle, 
    DialogContent, 
    DialogActions,
    List,
    ListItem,
    ListItemText,
    Typography,
    CircularProgress,
    Alert,
    Snackbar,
    Chip,
    IconButton,
    Tooltip
} from '@mui/material';
import { Person, Casino, AccessTime, Refresh } from '@mui/icons-material';
import { roomService } from '../../services/api';

// 添加安全渲染函数
const safeRender = (content) => {
    if (content === null || content === undefined) return '';
    if (typeof content === 'object') {
        try {
            return JSON.stringify(content);
        } catch (e) {
            console.error('Failed to stringify object:', e);
            return '[Object]';
        }
    }
    return content;
};

// Add a utility function to format time
const formatRemainingTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return 'N/A';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
        return `${hours}小时${minutes}分钟`;
    } else {
        return `${minutes}分钟`;
    }
};

const RoomList = () => {
    const navigate = useNavigate();
    const [openCreateDialog, setOpenCreateDialog] = useState(false);
    const [roomName, setRoomName] = useState('');
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'info'
    });
    const [sortOption, setSortOption] = useState('status'); // Default sort: status (waiting rooms first)
    const [refreshing, setRefreshing] = useState(false);

    // 获取房间列表
    useEffect(() => {
        fetchRooms();

        // 每10秒刷新一次房间列表
        const interval = setInterval(fetchRooms, 10000);
        return () => clearInterval(interval);
    }, []);

    const fetchRooms = async (isManualRefresh = false) => {
        try {
            if (isManualRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }
            
            const response = await roomService.getRooms();
            
            // Validate response data
            let roomsData = [];
            if (response.data && response.data.status === 'success' && Array.isArray(response.data.data?.rooms)) {
                // New format: { status: 'success', data: { rooms: [...] }}
                roomsData = response.data.data.rooms;
            } else if (Array.isArray(response.data)) {
                // Old format: directly returns array of rooms
                roomsData = response.data;
            } else {
                console.error('Unexpected response data format:', response.data);
                roomsData = [];
            }
            
            // Sort rooms based on current sort option
            const sortedRooms = sortRooms(roomsData, sortOption);
            setRooms(sortedRooms);
            
            setError(null);
            
            // Show a success message for manual refresh
            if (isManualRefresh) {
                setSnackbar({
                    open: true,
                    message: '房间列表已刷新',
                    severity: 'success'
                });
            }
        } catch (err) {
            console.error('Failed to get room list:', err);
            setError(typeof err === 'object' ? safeRender(err.message || 'Unknown error') : err);
        } finally {
            setRefreshing(false);
            setLoading(false);
        }
    };

    // Add a sort function
    const sortRooms = (rooms, option) => {
        const roomsCopy = [...rooms];
        
        switch (option) {
            case 'status':
                // Sort by status - waiting rooms first
                return roomsCopy.sort((a, b) => (a.is_game_started === b.is_game_started) ? 0 : a.is_game_started ? 1 : -1);
            case 'players':
                // Sort by player count - most players first
                return roomsCopy.sort((a, b) => {
                    const aPlayers = Array.isArray(a.players) ? a.players.length : 0;
                    const bPlayers = Array.isArray(b.players) ? b.players.length : 0;
                    return bPlayers - aPlayers;
                });
            case 'name':
                // Sort alphabetically by room name
                return roomsCopy.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            default:
                return roomsCopy;
        }
    };

    // Handle sort option change
    const handleSortChange = (option) => {
        setSortOption(option);
        const sortedRooms = sortRooms([...rooms], option);
        setRooms(sortedRooms);
    };

    const handleCreateRoom = () => {
        setOpenCreateDialog(true);
    };

    const handleConfirmCreate = async () => {
        if (!roomName.trim()) {
            setSnackbar({
                open: true,
                message: '请输入房间名称',
                severity: 'warning'
            });
            return;
        }

        try {
            setLoading(true);
            // 确保用户已登录
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('未登录，请先登录');
            }
            
            console.log('正在创建房间...');
            
            // 简化请求参数，只发送必要字段
            const username = localStorage.getItem('username');
            if (!username) {
                throw new Error('未找到用户名信息，请重新登录');
            }
            
            const response = await roomService.createRoom({ 
                name: roomName,
                game_duration_hours: 1.0,  // 游戏时长1小时
                creator: username  // 添加creator字段
            });
            
            console.log('服务器响应:', response);
            
            // 成功创建房间
        setOpenCreateDialog(false);
            setRoomName('');
            
            // 从响应中获取房间ID - 注意格式
            const roomData = response.data;
            const roomId = roomData?.id || (roomData?.data?.room_id);
            
            if (!roomId) {
                console.error('服务器响应中没有房间ID:', response.data);
                throw new Error('服务器未返回有效的房间ID');
            }
            
            console.log(`成功创建房间，房间ID: ${roomId}`);
            
            // 加入创建的房间，但不自动入座
            console.log(`准备加入新创建的房间 ${roomId}`);
            const joinResponse = await roomService.joinRoom(roomId);
            console.log('加入房间成功:', joinResponse);
            
            // 显示提示信息，告知用户需要选择座位
            setSnackbar({
                open: true,
                message: '房间创建成功，请在游戏界面选择座位',
                severity: 'success'
            });
            
            // 导航到游戏页面
            console.log(`导航到游戏页面: /game/${roomId}`);
        navigate(`/game/${roomId}`);
        } catch (err) {
            console.error('创建房间失败:', err);
            // 更加详细地记录错误信息
            if (err.response) {
                console.error('错误状态码:', err.response.status);
                console.error('错误数据:', JSON.stringify(err.response.data, null, 2));
            }
            
            // 提取更详细的错误信息
            let errorMessage = '创建房间失败，请稍后再试';
            if (err.response?.data?.detail) {
                errorMessage = err.response.data.detail;
            } else if (err.response?.data?.message) {
                errorMessage = err.response.data.message;
            } else if (err.message) {
                errorMessage = err.message;
            }
            
            setSnackbar({
                open: true,
                message: safeRender(errorMessage),
                severity: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleJoinRoom = async (roomId) => {
        if (!roomId) {
            console.error('尝试加入无效的房间ID:', roomId);
            setSnackbar({
                open: true,
                message: '无效的房间ID',
                severity: 'error'
            });
            return;
        }

        try {
            setLoading(true);
            // 确保用户已登录
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('未登录，请先登录');
            }
            
            console.log(`开始加入房间 ${roomId}`);
            
            try {
                // 尝试加入房间
                const response = await roomService.joinRoom(roomId);
                console.log('加入房间成功，服务器响应:', response);
                
                // 显示提示信息，告知用户需要选择座位
                setSnackbar({
                    open: true,
                    message: '房间加入成功，请在游戏界面选择座位',
                    severity: 'success'
                });
                
                // 导航到游戏页面
                console.log(`导航到游戏页面: /game/${roomId}`);
                navigate(`/game/${roomId}`);
            } catch (joinError) {
                console.log('加入房间请求失败，检查是否为已在房间中的情况', joinError);
                
                // 检查错误详情 - 如果是"已在房间中"的错误，视为成功
                const errorDetail = joinError.response?.data?.detail;
                if (errorDetail === "无法加入房间" || errorDetail?.includes("已在房间")) {
                    console.log('用户可能已在房间中，尝试直接导航到游戏页面');
                    
                    // 显示提示信息，告知用户需要选择座位
                    setSnackbar({
                        open: true,
                        message: '您已在该房间中，请在游戏界面选择座位',
                        severity: 'info'
                    });
                    
        navigate(`/game/${roomId}`);
                    return;
                }
                
                // 其他错误则继续抛出，由下面的catch块处理
                throw joinError;
            }
        } catch (err) {
            console.error('加入房间失败:', err);
            
            // 提取错误信息
            let errorMessage = '加入房间失败，请稍后再试';
            if (err.response?.data?.detail) {
                errorMessage = err.response.data.detail;
            } else if (err.response?.data?.message) {
                errorMessage = err.response.data.message;
            } else if (err.message) {
                errorMessage = err.message;
            }
            
            setSnackbar({
                open: true,
                message: errorMessage,
                severity: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleCloseSnackbar = () => {
        setSnackbar({
            ...snackbar,
            open: false
        });
    };

    // Add a function to handle manual refresh
    const handleRefresh = () => {
        fetchRooms(true);
    };

    return (
        <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4, p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h4">房间列表</Typography>
                <Button 
                    variant="contained" 
                    onClick={handleCreateRoom}
                    disabled={loading}
                >
                    创建房间
                </Button>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>{safeRender(error)}</Alert>
            )}
            
            {/* Sort options */}
            <Box sx={{ display: 'flex', mb: 2, gap: 1, alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ mr: 1 }}>排序方式:</Typography>
                    <Chip 
                        label="状态" 
                        onClick={() => handleSortChange('status')}
                        color={sortOption === 'status' ? 'primary' : 'default'}
                        size="small"
                        variant={sortOption === 'status' ? 'filled' : 'outlined'}
                    />
                    <Chip 
                        label="玩家数" 
                        onClick={() => handleSortChange('players')}
                        color={sortOption === 'players' ? 'primary' : 'default'}
                        size="small"
                        variant={sortOption === 'players' ? 'filled' : 'outlined'}
                    />
                    <Chip 
                        label="房间名" 
                        onClick={() => handleSortChange('name')}
                        color={sortOption === 'name' ? 'primary' : 'default'}
                        size="small"
                        variant={sortOption === 'name' ? 'filled' : 'outlined'}
                    />
                </Box>
                
                <Tooltip title="刷新房间列表">
                    <span>
                    <IconButton 
                        onClick={handleRefresh} 
                        disabled={loading || refreshing}
                        size="small"
                        color="primary"
                    >
                        {refreshing ? <CircularProgress size={20} /> : <Refresh />}
                    </IconButton>
                    </span>
                </Tooltip>
            </Box>

            {loading && !openCreateDialog ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
                    <CircularProgress />
                </Box>
            ) : (
            <List>
                    {rooms.length > 0 ? (
                        rooms.map((room) => (
                    <ListItem 
                        key={room.id}
                                sx={{ 
                                    border: '1px solid #333', 
                                    borderRadius: 1, 
                                    mb: 2,
                                    p: 2 
                                }}
                            >
                                <Box sx={{ width: '100%' }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Typography variant="h6">{room.name || 'unnamed'}</Typography>
                                            <Chip 
                                                label={room.is_game_started ? "游戏中" : "等待中"} 
                                                size="small"
                                                color={room.is_game_started ? "primary" : "success"}
                                                sx={{ 
                                                    fontWeight: 'bold',
                                                    bgcolor: room.is_game_started ? '#1976d2' : '#2e7d32'
                                                }}
                                                icon={room.is_game_started ? <Casino fontSize="small" /> : undefined}
                                            />
                                        </Box>
                                        <Button 
                                            variant="contained" 
                                            onClick={() => handleJoinRoom(room.id)}
                                            disabled={loading}
                                            size="small"
                                        >
                                            加入房间
                            </Button>
                                    </Box>
                                    
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <Person fontSize="small" />
                                            <Typography variant="body2">
                                                {(() => {
                                                    // 优先使用game中的玩家信息
                                                    if (room.game && Array.isArray(room.game.players)) {
                                                        return `${room.game.players.length} / ${room.max_players || 8}`;
                                                    } else if (Array.isArray(room.players)) {
                                                        return `${room.players.length === 0 ? '0' : room.players.length} / ${room.max_players || 8}`;
                                                    } else {
                                                        return `0 / ${room.max_players || 8}`;
                                                    }
                                                })()}
                                            </Typography>
                                            
                                            {/* Available seats badge */}
                                            {(() => {
                                                // 优先使用game中的玩家信息
                                                let players = 0;
                                                if (room.game && Array.isArray(room.game.players)) {
                                                    players = room.game.players.length;
                                                } else if (Array.isArray(room.players)) {
                                                    players = room.players.length;
                                                }
                                                
                                                const maxPlayers = room.max_players || 8;
                                                const availableSeats = maxPlayers - players;
                                                
                                                if (availableSeats <= 0) {
                                                    return (
                                                        <Chip 
                                                            label="已满" 
                                                            size="small" 
                                                            sx={{ 
                                                                height: 20, 
                                                                fontSize: '0.7rem',
                                                                bgcolor: '#d32f2f',
                                                                color: 'white',
                                                                ml: 1
                                                            }}
                                                        />
                                                    );
                                                } else {
                                                    return (
                                                        <Chip 
                                                            label={`空位: ${availableSeats}`} 
                                                            size="small" 
                                                            sx={{ 
                                                                height: 20, 
                                                                fontSize: '0.7rem',
                                                                bgcolor: '#388e3c',
                                                                color: 'white',
                                                                ml: 1
                                                            }}
                                                        />
                                                    );
                                                }
                                            })()}
                                        </Box>
                                        
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <Casino fontSize="small" />
                                            <Typography variant="body2">
                                                盲注: {room.small_blind || 0.5}/{room.big_blind || 1} BB
                                            </Typography>
                                        </Box>
                                        
                                        {room.is_game_started && room.remaining_time && (
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <AccessTime fontSize="small" />
                                                <Typography variant="body2">
                                                    剩余时间: {formatRemainingTime(room.remaining_time)}
                                                </Typography>
                                            </Box>
                                        )}
                                    </Box>
                                    
                                    {/* 显示房间内玩家列表 */}
                                    {(room.game && Array.isArray(room.game.players) && room.game.players.length > 0) ? (
                                        <Box sx={{ mt: 1 }}>
                                            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                                当前玩家:
                                            </Typography>
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                {room.game.players.map((player, index) => (
                                                    <Typography 
                                                        key={index} 
                                                        variant="body2" 
                                                        sx={{ 
                                                            bgcolor: 'rgba(0,0,0,0.1)', 
                                                            px: 1, 
                                                            py: 0.5, 
                                                            borderRadius: 1 
                                                        }}
                                                    >
                                                        {typeof player === 'string' ? player : player.name}
                                                    </Typography>
                                                ))}
                                            </Box>
                                        </Box>
                                    ) : (Array.isArray(room.players) && room.players.length > 0) && (
                                        <Box sx={{ mt: 1 }}>
                                            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                                当前玩家:
                                            </Typography>
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                {room.players.map((player, index) => (
                                                    <Typography 
                                                        key={index} 
                                                        variant="body2" 
                                                        sx={{ 
                                                            bgcolor: 'rgba(0,0,0,0.1)', 
                                                            px: 1, 
                                                            py: 0.5, 
                                                            borderRadius: 1 
                                                        }}
                                                    >
                                                        {typeof player === 'string' ? player : player.name}
                                                    </Typography>
                                                ))}
                                            </Box>
                                        </Box>
                                    )}
                                </Box>
                    </ListItem>
                        ))
                    ) : (
                        <Box sx={{ textAlign: 'center', my: 4 }}>
                            <Typography>暂无房间，请创建新房间</Typography>
                        </Box>
                    )}
            </List>
            )}

            {/* 创建房间对话框 */}
            <Dialog 
                open={openCreateDialog} 
                onClose={() => {
                    if (!loading) {
                    setOpenCreateDialog(false);
                    setRoomName('');
                    }
                }}
                PaperProps={{
                    sx: { minWidth: '300px' }
                }}
            >
                <DialogTitle>创建房间</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="房间名称"
                        fullWidth
                        value={roomName}
                        onChange={(e) => setRoomName(e.target.value)}
                        disabled={loading}
                    />
                </DialogContent>
                <DialogActions>
                    <Button 
                        onClick={() => {
                        setOpenCreateDialog(false);
                        setRoomName('');
                        }}
                        disabled={loading}
                    >
                        取消
                    </Button>
                    <Button 
                        onClick={handleConfirmCreate}
                        disabled={loading}
                    >
                        {loading ? <CircularProgress size={24} /> : '创建'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* 消息提示 */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={handleCloseSnackbar}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={handleCloseSnackbar} severity={snackbar.severity}>
                    {safeRender(snackbar.message)}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default RoomList;