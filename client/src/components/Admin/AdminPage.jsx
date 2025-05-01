import React, { useState, useEffect } from 'react';
import { Container, Box, Tabs, Tab, Paper, Typography } from '@mui/material';
import { BugReportList } from '../BugReport';
import { useAuth } from '../../App';
import { Navigate } from 'react-router-dom';

/**
 * 管理员页面组件
 * 只有管理员可以访问
 */
const AdminPage = () => {
  const { user } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  
  // 添加调试日志
  useEffect(() => {
    console.log('AdminPage - 当前用户信息:', user);
  }, [user]);

  // 检查是否为管理员，如果不是则重定向
  if (!user) {
    console.log('AdminPage - 用户未登录，重定向到登录页面');
    return <Navigate to="/login" replace />;
  }
  
  // 不区分大小写检查管理员身份
  const isAdmin = user.username && 
                 (user.username.toLowerCase() === 'admin' || 
                  user.username === 'admin');
  
  if (!isAdmin) {
    console.log(`AdminPage - 用户 ${user.username} 不是管理员，重定向到房间列表`);
    return <Navigate to="/rooms" replace />;
  }
  
  console.log('AdminPage - 管理员身份验证通过，显示管理面板');

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h4" gutterBottom>管理员控制面板</Typography>
        <Typography variant="body1" color="text.secondary">
          欢迎，{user.username}。在这里您可以管理系统中的各种资源。
        </Typography>
      </Paper>

      <Paper elevation={2}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab label="Bug报告" id="tab-0" />
            <Tab label="用户管理" id="tab-1" disabled />
            <Tab label="房间管理" id="tab-2" disabled />
            <Tab label="系统设置" id="tab-3" disabled />
          </Tabs>
        </Box>

        <Box role="tabpanel" hidden={tabValue !== 0} id="tabpanel-0">
          {tabValue === 0 && <BugReportList />}
        </Box>

        <Box role="tabpanel" hidden={tabValue !== 1} id="tabpanel-1">
          {tabValue === 1 && (
            <Box sx={{ p: 3 }}>
              <Typography>用户管理功能正在开发中...</Typography>
            </Box>
          )}
        </Box>

        <Box role="tabpanel" hidden={tabValue !== 2} id="tabpanel-2">
          {tabValue === 2 && (
            <Box sx={{ p: 3 }}>
              <Typography>房间管理功能正在开发中...</Typography>
            </Box>
          )}
        </Box>

        <Box role="tabpanel" hidden={tabValue !== 3} id="tabpanel-3">
          {tabValue === 3 && (
            <Box sx={{ p: 3 }}>
              <Typography>系统设置功能正在开发中...</Typography>
            </Box>
          )}
        </Box>
      </Paper>
    </Container>
  );
};

export default AdminPage; 