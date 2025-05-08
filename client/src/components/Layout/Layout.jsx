import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Box, AppBar, Toolbar, Typography, Button, Avatar, IconButton, Menu, MenuItem } from '@mui/material';
import { useAuth } from '../../App';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import BugReportButton from '../BugReport';

const Layout = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [anchorEl, setAnchorEl] = useState(null);
    
    const handleMenu = (event) => {
        setAnchorEl(event.currentTarget);
    };
    
    const handleClose = () => {
        setAnchorEl(null);
    };
    
    const handleLogout = () => {
        logout();
        navigate('/login');
        handleClose();
    };
    
    // 获取用户头像路径
    const getAvatarPath = () => {
        // 直接从localStorage读取
        const avatar = localStorage.getItem('userAvatar');
        if (avatar) {
            return `/assets/images/avatar/${avatar}`;
        }
        return null;
    };
    
    // 检查当前是否在游戏页面
    const isGamePage = location.pathname.includes('/game/');
    
    // 检查当前是否在房间列表或游戏页面
    const shouldShowBugReport = location.pathname.includes('/rooms') || isGamePage;
    
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            {!isGamePage && (
                <AppBar position="static">
                    <Toolbar>
                        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                            C32 Poker
                        </Typography>
                        
                        {user && (
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <Typography variant="body1" sx={{ mr: 2 }}>
                                    {user.username || localStorage.getItem('username')}
                                </Typography>
                                
                                <IconButton
                                    size="large"
                                    aria-label="account of current user"
                                    aria-controls="menu-appbar"
                                    aria-haspopup="true"
                                    onClick={handleMenu}
                                    color="inherit"
                                >
                                    {getAvatarPath() ? (
                                        <Avatar 
                                            src={getAvatarPath()} 
                                            alt={user.username}
                                            sx={{ width: 32, height: 32 }}
                                        />
                                    ) : (
                                        <AccountCircleIcon />
                                    )}
                                </IconButton>
                                
                                <Menu
                                    id="menu-appbar"
                                    anchorEl={anchorEl}
                                    anchorOrigin={{
                                        vertical: 'top',
                                        horizontal: 'right',
                                    }}
                                    keepMounted
                                    transformOrigin={{
                                        vertical: 'top',
                                        horizontal: 'right',
                                    }}
                                    open={Boolean(anchorEl)}
                                    onClose={handleClose}
                                >
                                    <MenuItem onClick={handleClose}>个人信息</MenuItem>
                                    <MenuItem onClick={handleLogout}>登出</MenuItem>
                                </Menu>
                            </Box>
                        )}
                    </Toolbar>
                </AppBar>
            )}
            
            <Box sx={{ flexGrow: 1 }}>
                <Outlet />
            </Box>
            
            {/* 仅在房间列表和游戏页面显示Bug Report按钮 */}
            {shouldShowBugReport && <BugReportButton />}
        </Box>
    );
};

export default Layout;