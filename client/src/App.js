import React, { createContext, useState, useEffect, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Auth/Login';
import RoomList from './components/Room/RoomList';
import GameTable from './components/Game/GameTable';
import Register from './components/Auth/Register';
import Layout from './components/Layout/Layout';
import PrivateRoute from './components/Auth/PrivateRoute';
import { authService } from './services/api';
import { CircularProgress, Box, Typography } from '@mui/material';
import AdminPage from './components/Admin/AdminPage';

// 创建认证上下文
export const AuthContext = createContext();

// 认证状态提供器
const AuthProvider = ({ children }) => {
  const [authState, setAuthState] = useState({
    isAuthenticated: false,
    user: null,
    isLoading: true
  });

  // 检查并更新认证状态
  const checkAndUpdateAuth = async () => {
    try {
      const result = await authService.checkAuthStatus();
      
      // 获取令牌过期时间
      const token = localStorage.getItem('token');
      if (token) {
        try {
          // 解析JWT令牌，获取过期时间
          const payloadBase64 = token.split('.')[1];
          const payload = JSON.parse(atob(payloadBase64));
          
          // 如果令牌将在2小时内过期，尝试刷新令牌
          if (payload.exp) {
            const expiryTime = payload.exp * 1000; // 转换为毫秒
            const currentTime = Date.now();
            const timeUntilExpiry = expiryTime - currentTime;
            
            // 如果令牌将在2小时内过期，尝试静默刷新
            if (timeUntilExpiry > 0 && timeUntilExpiry < 2 * 60 * 60 * 1000) {
              console.log('令牌将在2小时内过期，尝试刷新');
              try {
                // 调用API刷新令牌
                const response = await authService.refreshToken();
                if (response && response.data && response.data.access_token) {
                  // 更新令牌
                  localStorage.setItem('token', response.data.access_token);
                  console.log('令牌已成功刷新');
                }
              } catch (refreshError) {
                console.error('刷新令牌失败:', refreshError);
                // 即使刷新失败，仍可以继续使用旧令牌直到其过期
              }
            }
          }
        } catch (tokenError) {
          console.error('解析令牌失败:', tokenError);
        }
      }
      
      setAuthState({
        isAuthenticated: result.isAuthenticated,
        user: result.user || null,
        isLoading: false
      });
      return result.isAuthenticated;
    } catch (error) {
      console.error('自动登录失败:', error);
      setAuthState({
        isAuthenticated: false,
        user: null,
        isLoading: false
      });
      return false;
    }
  };

  // 页面加载时检查登录状态
  useEffect(() => {
    checkAndUpdateAuth();
  }, []);
  
  // 设置周期性检查认证状态的定时器
  useEffect(() => {
    // 每15分钟检查一次认证状态
    const authCheckInterval = setInterval(() => {
      // 只有当用户已登录时才检查
      if (authState.isAuthenticated) {
        console.log('执行周期性认证检查');
        checkAndUpdateAuth();
      }
    }, 15 * 60 * 1000); // 15分钟
    
    // 清理定时器
    return () => {
      clearInterval(authCheckInterval);
    };
  }, [authState.isAuthenticated]);

  // 登录函数
  const login = (userData, token) => {
    // 确保userId有值，即使userData中没有id或user_id
    const userId = userData.id || userData.user_id || userData.username; 
    
    localStorage.setItem('token', token);
    localStorage.setItem('userId', userId);
    localStorage.setItem('username', userData.username);
    
    setAuthState({
      isAuthenticated: true,
      user: userData,
      isLoading: false
    });
  };

  // 登出函数
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    
    setAuthState({
      isAuthenticated: false,
      user: null,
      isLoading: false
    });
  };

  // 如果正在加载认证状态，显示加载中
  if (authState.isLoading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh' 
      }}>
        <CircularProgress />
        <Typography variant="body1" sx={{ mt: 2 }}>
          正在自动登录...
        </Typography>
      </Box>
    );
  }

  return (
    <AuthContext.Provider value={{ 
      ...authState, 
      login, 
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// 自定义钩子，方便在组件中使用认证上下文
export const useAuth = () => useContext(AuthContext);

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* 公共路由 - 根据token存在与否决定重定向到登录页还是房间列表 */}
          <Route path="/" element={
            localStorage.getItem('token') ? 
            <Navigate to="/rooms" replace /> : 
            <Navigate to="/login" replace />
          } />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* 需要认证的路由 */}
          <Route path="/" element={<Layout />}>
            <Route 
              path="/rooms" 
              element={
                <PrivateRoute>
                  <RoomList />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/game/:roomId" 
              element={
                <PrivateRoute>
                  <GameTable />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/admin" 
              element={
                <PrivateRoute>
                  <AdminPage />
                </PrivateRoute>
              } 
            />
          </Route>

          {/* 捕获所有其他路径并重定向到登录页 */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;