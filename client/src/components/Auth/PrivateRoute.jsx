import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../App';
import { CircularProgress, Box } from '@mui/material';

/**
 * 私有路由组件，用于保护需要登录才能访问的页面
 * @param {Object} props
 * @param {React.ReactNode} props.children 子组件
 */
const PrivateRoute = ({ children }) => {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (!user) {
        // 直接重定向到登录页，不保存当前路径
        return <Navigate to="/login" replace />;
    }

    return children;
};

export default PrivateRoute;