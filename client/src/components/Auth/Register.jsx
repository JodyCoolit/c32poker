import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, TextField, Button, Typography, Link, Alert } from '@mui/material';
import { authService } from '../../services/api';

const Register = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validate form
        if (formData.password !== formData.confirmPassword) {
            setError('两次输入的密码不一致');
            return;
        }
        
        if (formData.username.trim() === '' || formData.password.trim() === '') {
            setError('用户名和密码不能为空');
            return;
        }
        
        try {
            // 注册用户
            await authService.register(formData.username, formData.password);
            
            // 注册成功后自动登录
            try {
                const response = await authService.login(formData.username, formData.password);
                localStorage.setItem('token', response.data.access_token);
                localStorage.setItem('userId', response.data.user_id || formData.username);
                localStorage.setItem('username', formData.username); // 确保存储用户名
                
                // 成功登录后直接跳转到房间页面
                navigate('/rooms');
            } catch (loginErr) {
                console.error('Auto login failed:', loginErr);
                // 如果自动登录失败，跳转到登录页
                navigate('/');
            }
        } catch (err) {
            console.error('Registration error:', err);
            setError(err.response?.data?.detail || '注册失败，请稍后再试');
        }
    };

    return (
        <Box sx={{ maxWidth: 400, mx: 'auto', mt: 8, p: 3 }}>
            <Typography variant="h4" gutterBottom>注册</Typography>
            
            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
            )}
            
            <form onSubmit={handleSubmit}>
                <TextField
                    fullWidth
                    margin="normal"
                    label="用户名"
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                    required
                />
                <TextField
                    fullWidth
                    margin="normal"
                    type="password"
                    label="密码"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    required
                />
                <TextField
                    fullWidth
                    margin="normal"
                    type="password"
                    label="确认密码"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                    required
                />
                <Button
                    fullWidth
                    variant="contained"
                    type="submit"
                    sx={{ mt: 3 }}
                >
                    注册
                </Button>
                
                <Box sx={{ mt: 2, textAlign: 'center' }}>
                    <Typography variant="body2">
                        已有账号？ <Link onClick={() => navigate('/')} sx={{ cursor: 'pointer' }}>返回登录</Link>
                    </Typography>
                </Box>
            </form>
        </Box>
    );
};

export default Register;