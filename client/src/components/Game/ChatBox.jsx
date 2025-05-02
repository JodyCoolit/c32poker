import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  Typography, 
  TextField, 
  Button, 
  Paper, 
  List, 
  ListItem, 
  ListItemText, 
  Divider, 
  IconButton, 
  Tooltip,
  Badge,
  Menu,
  MenuItem,
  Grid,
  Chip
} from '@mui/material';
import { Send, Chat as ChatIcon, Close, KeyboardArrowUp, KeyboardArrowDown, EmojiEmotions } from '@mui/icons-material';
import websocketService from '../../services/websocket';

// 预定义的快捷聊天消息
const QUICK_MESSAGES = [
  { id: 'greeting', text: '卧槽！' },
  { id: 'gl', text: '秒抓!' },
  { id: 'nh', text: '这不秒抓?' },
  { id: 'unlucky', text: 'allin or fold' },
  { id: 'thanks', text: '简化！' },
  { id: 'waiting', text: '行了行了行了' },
  { id: 'fold', text: '庄位不偷？' },
  { id: 'call', text: '几连啦？' },
  { id: 'raise', text: '四连了，得来个人治一下他了' },
  { id: 'bluff', text: 'I AM BLUFFING😏' },
  { id: 'allIn', text: '准备拍照' },
  { id: 'thinking', text: '这个逼肯定是27o' },
];

const ChatBox = ({ roomId }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [quickMessageMenuAnchor, setQuickMessageMenuAnchor] = useState(null);
  const messageEndRef = useRef(null);
  const timeFormat = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' });

  // 处理接收到的聊天消息
  useEffect(() => {
    const handleChatMessage = (data) => {
      const newChatMessage = {
        player: data.player,
        message: data.message,
        timestamp: data.timestamp,
        isSystem: data.player === 'system'
      };
      
      setMessages(prevMessages => [...prevMessages, newChatMessage]);
      
      // 如果聊天窗口未打开，增加未读消息数
      if (!isOpen) {
        setUnreadCount(prev => prev + 1);
      }
    };
    
    // 注册聊天消息监听器
    const unsubscribe = websocketService.onChat(handleChatMessage);
    
    // 组件卸载时移除监听器
    return () => {
      unsubscribe();
    };
  }, [isOpen]);
  
  // 消息列表自动滚动到底部
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // 发送聊天消息
  const sendMessage = () => {
    if (newMessage.trim() === '') return;
    
    websocketService.sendChat(newMessage);
    
    setNewMessage('');
  };
  
  // 处理Enter键发送消息
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };
  
  // 切换聊天窗口显示状态
  const toggleChat = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      // 打开聊天窗口时重置未读消息
      setUnreadCount(0);
    }
  };
  
  // 格式化消息时间戳
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    return timeFormat.format(new Date(timestamp * 1000));
  };
  
  // 打开快捷消息菜单
  const handleOpenQuickMessages = (event) => {
    setQuickMessageMenuAnchor(event.currentTarget);
  };
  
  // 关闭快捷消息菜单
  const handleCloseQuickMessages = () => {
    setQuickMessageMenuAnchor(null);
  };
  
  // 发送快捷消息
  const sendQuickMessage = (message) => {
    websocketService.sendChat(message);
    handleCloseQuickMessages();
  };

  return (
    <Box sx={{ position: 'fixed', bottom: 20, left: 20, zIndex: 10 }}>
      {/* 聊天窗口 */}
      {isOpen && (
        <Paper 
          elevation={3} 
          sx={{ 
            width: 320, 
            height: 400, 
            mb: 1, 
            display: 'flex', 
            flexDirection: 'column',
            borderRadius: 2,
            overflow: 'hidden'
          }}
        >
          {/* 聊天标题栏 */}
          <Box 
            sx={{ 
              p: 1, 
              bgcolor: '#1976d2', 
              color: 'white', 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <Typography variant="subtitle1">游戏聊天</Typography>
            <IconButton size="small" onClick={toggleChat} sx={{ color: 'white' }}>
              <Close fontSize="small" />
            </IconButton>
          </Box>
          
          {/* 消息列表 */}
          <Box 
            sx={{ 
              flexGrow: 1, 
              overflow: 'auto', 
              p: 1,
              bgcolor: '#f5f5f5',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {messages.length === 0 ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <Typography variant="body2" color="text.secondary">
                  暂无消息，发送一条消息开始聊天
                </Typography>
              </Box>
            ) : (
              messages.map((msg, index) => (
                <Box
                  key={index}
                  sx={{
                    mb: 1,
                    maxWidth: '85%',
                    alignSelf: msg.player === localStorage.getItem('username') ? 'flex-end' : 'flex-start'
                  }}
                >
                  <Paper
                    elevation={1}
                    sx={{
                      p: 1,
                      bgcolor: msg.isSystem 
                        ? '#e1f5fe' 
                        : msg.player === localStorage.getItem('username') 
                          ? '#1976d2' 
                          : 'white',
                      borderRadius: 1
                    }}
                  >
                    {/* 消息头部：发送者和时间 */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" 
                        color={msg.player === localStorage.getItem('username') 
                          ? 'white' 
                          : msg.isSystem 
                            ? '#01579b'
                            : '#1976d2'} 
                        sx={{ 
                          fontWeight: 'bold',
                          fontSize: '0.75rem' 
                        }}>
                        {msg.isSystem ? '系统' : msg.player}
                      </Typography>
                      <Typography variant="caption" 
                        color={msg.player === localStorage.getItem('username') 
                          ? 'rgba(255,255,255,0.7)' 
                          : 'rgba(0,0,0,0.5)'}>
                        {formatTimestamp(msg.timestamp)}
                      </Typography>
                    </Box>
                    
                    {/* 消息内容 */}
                    <Typography variant="body2" sx={{ 
                      wordBreak: 'break-word',
                      color: msg.isSystem 
                        ? '#01579b' 
                        : msg.player === localStorage.getItem('username') 
                          ? 'white' 
                          : '#333'
                    }}>
                      {msg.message}
                    </Typography>
                  </Paper>
                </Box>
              ))
            )}
            <div ref={messageEndRef} />
          </Box>
          
          {/* 快捷短语区域 */}
          <Box sx={{ p: 1, bgcolor: '#f0f0f0', maxHeight: '200px', overflowX: 'auto' }}>
            <Grid container spacing={0.5}>
              {QUICK_MESSAGES.slice(0, 6).map((msg) => (
                <Grid item key={msg.id}>
                  <Chip 
                    label={msg.text}
                    size="small"
                    onClick={() => sendQuickMessage(msg.text)}
                    sx={{ 
                      fontSize: '0.7rem', 
                      cursor: 'pointer',
                      bgcolor: '#e0e0e0',
                      '&:hover': { bgcolor: '#bdbdbd' }
                    }}
                  />
                </Grid>
              ))}
              <Grid item>
                <Chip 
                  icon={<KeyboardArrowDown fontSize="small" />}
                  label="更多"
                  size="small"
                  onClick={handleOpenQuickMessages}
                  color="primary"
                  variant="outlined"
                  sx={{ fontSize: '0.7rem', cursor: 'pointer' }}
                />
              </Grid>
            </Grid>
          </Box>
          
          {/* 消息输入框 */}
          <Box sx={{ p: 1, bgcolor: 'white', display: 'flex' }}>
            <TextField
              fullWidth
              size="small"
              placeholder="输入消息..."
              variant="outlined"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              sx={{ 
                mr: 1,
                '& .MuiInputBase-input': {
                  color: '#333' // 设置输入文字颜色为深色
                },
                '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: '#ccc',
                  },
                  '&:hover fieldset': {
                    borderColor: '#999',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#1976d2',
                  }
                }
              }}
            />
            <Button 
              variant="contained" 
              color="primary" 
              endIcon={<Send />}
              onClick={sendMessage}
              disabled={newMessage.trim() === ''}
            >
              发送
            </Button>
          </Box>
        </Paper>
      )}
      
      {/* 快捷消息菜单 */}
      <Menu
        anchorEl={quickMessageMenuAnchor}
        open={Boolean(quickMessageMenuAnchor)}
        onClose={handleCloseQuickMessages}
        MenuListProps={{
          dense: true,
          sx: { maxHeight: 300 }
        }}
      >
        {QUICK_MESSAGES.map((msg) => (
          <MenuItem 
            key={msg.id} 
            onClick={() => sendQuickMessage(msg.text)}
            sx={{ minWidth: 180 }}
          >
            {msg.text}
          </MenuItem>
        ))}
      </Menu>
      
      {/* 聊天按钮 */}
      <Tooltip title={isOpen ? "关闭聊天" : "打开聊天"}>
        <Badge badgeContent={unreadCount} color="error" overlap="circular">
          <IconButton 
            color="primary" 
            size="large"
            onClick={toggleChat}
            sx={{ 
              bgcolor: 'white', 
              boxShadow: 2,
              '&:hover': { bgcolor: '#f5f5f5' }
            }}
          >
            {isOpen ? <KeyboardArrowDown /> : <ChatIcon />}
          </IconButton>
        </Badge>
      </Tooltip>
    </Box>
  );
};

export default ChatBox; 