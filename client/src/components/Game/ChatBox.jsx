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
  Badge
} from '@mui/material';
import { Send, Chat as ChatIcon, Close, KeyboardArrowUp, KeyboardArrowDown } from '@mui/icons-material';
import websocketService from '../../services/websocket';

const ChatBox = ({ roomId }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
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