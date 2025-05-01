import React, { useState } from 'react';
import { Fab, Tooltip, Snackbar, Alert } from '@mui/material';
import BugReportIcon from '@mui/icons-material/BugReport';
import { styled } from '@mui/material/styles';
import BugReportDialog from './BugReportDialog';
import bugReportService from '../../services/bugReportService';

// 样式化的浮动按钮，固定在右下角
const FloatingFab = styled(Fab)(({ theme }) => ({
  position: 'fixed',
  bottom: theme.spacing(3),
  right: theme.spacing(3),
  zIndex: 1000, // 确保按钮在其他元素上方
}));

/**
 * Bug Report浮动按钮组件
 * 点击后显示Bug Report对话框
 */
const BugReportButton = () => {
  // 控制对话框开关的状态
  const [dialogOpen, setDialogOpen] = useState(false);
  // 提示消息状态
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: 'success' // 'success', 'error', 'warning', 'info'
  });

  // 处理按钮点击事件
  const handleClick = () => {
    setDialogOpen(true);
  };

  // 处理对话框关闭事件
  const handleClose = () => {
    setDialogOpen(false);
  };

  // 处理通知关闭
  const handleNotificationClose = () => {
    setNotification({ ...notification, open: false });
  };

  // 显示通知
  const showNotification = (message, severity = 'success') => {
    setNotification({
      open: true,
      message,
      severity
    });
  };

  // 处理Bug提交事件
  const handleSubmit = async (bugData) => {
    try {
      // 调用服务提交Bug报告
      await bugReportService.submitBugReport(bugData);
      
      // 显示成功通知
      showNotification('问题报告提交成功，感谢您的反馈！');
      
      // 关闭对话框
      setDialogOpen(false);
      return true;
    } catch (error) {
      console.error('提交Bug报告失败:', error);
      
      // 显示错误通知
      showNotification(
        error.response?.data?.message || '提交失败，请稍后再试',
        'error'
      );
      
      return false;
    }
  };

  return (
    <>
      {/* 浮动按钮 */}
      <Tooltip title="报告问题" arrow>
        <FloatingFab 
          color="error" 
          size="medium" 
          onClick={handleClick}
          aria-label="报告问题"
        >
          <BugReportIcon />
        </FloatingFab>
      </Tooltip>

      {/* Bug Report对话框 */}
      <BugReportDialog 
        open={dialogOpen} 
        onClose={handleClose} 
        onSubmit={handleSubmit}
      />

      {/* 通知栏 */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleNotificationClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleNotificationClose} 
          severity={notification.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default BugReportButton; 