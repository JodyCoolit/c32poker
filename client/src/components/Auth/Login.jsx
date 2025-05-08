import React, { useState, useEffect } from 'react';
import { TextField, Button, Box, Typography, Link, Alert, CircularProgress } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../../services/api';
import { useAuth } from '../../App';

const Login = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { isAuthenticated, login } = useAuth(); // 使用认证上下文
    
    const [formData, setFormData] = useState({
        username: '',
        password: ''
    });
    const [error, setError] = useState('');
    const [showSessionExpired, setShowSessionExpired] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 检查URL参数，看是否有会话过期的提示
    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const sessionExpired = searchParams.get('session_expired');
        const authError = searchParams.get('auth_error');
        
        if (sessionExpired === 'true' || authError === 'true') {
            setShowSessionExpired(true);
        }
    }, [location]);

    // 如果已经登录，自动重定向到房间列表
    useEffect(() => {
        if (isAuthenticated) {
            navigate('/rooms', { replace: true });
        }
    }, [isAuthenticated, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (isSubmitting) return;
        
        setIsSubmitting(true);
        try {
            // 创建超时控制器
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                controller.abort();
            }, 10000); // 10秒超时
            
            // 使用实际API调用，带超时控制
            const response = await authService.login(
                formData.username, 
                formData.password, 
                { signal: controller.signal }
            );
            
            // 清除超时计时器
            clearTimeout(timeoutId);
            
            // 确保从服务器返回的数据包含user_id
            const userData = {
                username: formData.username,
                id: response.data.user_id || response.data.userId || '',
                ...response.data.user
            };
            
            // 使用上下文提供的login函数
            login(userData, response.data.access_token);
            
            // 保存认证信息到localStorage
            localStorage.setItem('token', response.data.access_token);
            localStorage.setItem('userId', response.data.user_id || response.data.userId || '');
            localStorage.setItem('username', formData.username);
            localStorage.setItem('loginTime', Date.now().toString());
            
            console.log('登录成功，用户信息已保存到localStorage', {
                username: formData.username,
                userId: response.data.user_id || response.data.userId,
                tokenLength: response.data.access_token?.length
            });
            
            // 登录成功后的跳转，直接进入rooms页面
            navigate('/rooms', { replace: true });
        } catch (err) {
            // 检查是否是超时错误
            if (err.name === 'AbortError') {
                setError('登录超时，服务器可能无响应或正在维护，请稍后重试。');
            } else {
                setError('登录失败，请检查用户名和密码。');
            }
            console.error('Login error:', err.response?.data || err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Box sx={{ maxWidth: 400, mx: 'auto', mt: 4, p: 2 }}>
            <Typography variant="h4" gutterBottom>登录</Typography>
            
            {showSessionExpired && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    您的会话已过期或您没有足够的权限。请重新登录。
                </Alert>
            )}
            
            {error && (
                <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>
            )}
            
            <form onSubmit={handleSubmit}>
                <TextField
                    fullWidth
                    margin="normal"
                    label="用户名"
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                    disabled={isSubmitting}
                />
                <TextField
                    fullWidth
                    margin="normal"
                    type="password"
                    label="密码"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    disabled={isSubmitting}
                />
                
                <Box component="span" sx={{ mt: 2, display: 'block' }}>
                    <Button
                        fullWidth
                        variant="contained"
                        type="submit"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <CircularProgress size={24} sx={{ mr: 1 }} />
                                登录中...
                            </Box>
                        ) : '登录'}
                    </Button>
                </Box>
                
                <Box sx={{ mt: 2, textAlign: 'center' }}>
                    <Typography variant="body2">
                        没有账号？ <Link onClick={() => navigate('/register')} sx={{ cursor: 'pointer' }}>注册</Link>
                    </Typography>
                </Box>
            </form>
        </Box>
    );
};

export default Login;