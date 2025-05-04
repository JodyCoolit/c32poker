import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  TablePagination,
  Chip,
  Button,
  CircularProgress,
  Alert,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import { styled } from '@mui/material/styles';
import VisibilityIcon from '@mui/icons-material/Visibility';
import bugReportService from '../../services/bugReportService';
import { API_BASE_URL } from '../../config';

// 状态芯片样式
const StatusChip = styled(Chip)(({ theme, status }) => {
  const colors = {
    pending: {
      bg: theme.palette.warning.light,
      color: theme.palette.warning.contrastText
    },
    in_progress: {
      bg: theme.palette.info.light,
      color: theme.palette.info.contrastText
    },
    resolved: {
      bg: theme.palette.success.light,
      color: theme.palette.success.contrastText
    },
    rejected: {
      bg: theme.palette.error.light,
      color: theme.palette.error.contrastText
    }
  };
  
  return {
    backgroundColor: colors[status]?.bg || theme.palette.grey[300],
    color: colors[status]?.color || theme.palette.text.primary,
    fontWeight: 'bold'
  };
});

// 状态显示
const getStatusText = (status) => {
  const statusMap = {
    pending: '待处理',
    in_progress: '处理中',
    resolved: '已解决',
    rejected: '已拒绝'
  };
  return statusMap[status] || status;
};

/**
 * Bug报告列表组件
 * 管理员专用，展示所有Bug报告
 */
const BugReportList = () => {
  const [reports, setReports] = useState([]);
  const [totalReports, setTotalReports] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  
  // 详情对话框状态
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // 状态更新对话框状态
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  
  // 加载报告列表
  useEffect(() => {
    console.log('BugReportList - 开始获取Bug报告列表');
    fetchReports();
  }, [page, rowsPerPage, statusFilter]);
  
  // 获取Bug报告列表
  const fetchReports = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('BugReportList - 正在获取Bug报告列表...');
      
      const response = await bugReportService.getBugReports({
        limit: rowsPerPage,
        offset: page * rowsPerPage,
        status: statusFilter || undefined
      });
      
      console.log('BugReportList - 获取Bug报告列表成功:', response);
      
      setReports(response.reports || []);
      setTotalReports(response.total || 0);
    } catch (err) {
      console.error('BugReportList - 获取Bug报告列表失败:', err);
      setError(err.response?.data?.detail || '获取Bug报告列表失败');
      
      // 如果无法获取报告，设置为空数组
      setReports([]);
      setTotalReports(0);
    } finally {
      setLoading(false);
    }
  };
  
  // 处理翻页
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };
  
  // 处理每页行数变化
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };
  
  // 打开详情对话框
  const handleOpenDetail = async (reportId) => {
    try {
      setDetailLoading(true);
      setDetailOpen(true);
      
      const reportDetail = await bugReportService.getBugReportDetail(reportId);
      setSelectedReport(reportDetail);
    } catch (err) {
      console.error('获取Bug报告详情失败:', err);
      setError(err.response?.data?.detail || '获取Bug报告详情失败');
    } finally {
      setDetailLoading(false);
    }
  };
  
  // 关闭详情对话框
  const handleCloseDetail = () => {
    setDetailOpen(false);
    setSelectedReport(null);
  };
  
  // 打开状态更新对话框
  const handleOpenStatusDialog = (report) => {
    setSelectedReport(report);
    setNewStatus(report.status);
    setStatusDialogOpen(true);
  };
  
  // 关闭状态更新对话框
  const handleCloseStatusDialog = () => {
    setStatusDialogOpen(false);
    setNewStatus('');
  };
  
  // 更新Bug状态
  const handleUpdateStatus = async () => {
    if (!selectedReport || !newStatus) return;
    
    try {
      setUpdatingStatus(true);
      
      await bugReportService.updateBugReportStatus(selectedReport.id, newStatus);
      
      // 关闭对话框并刷新数据
      handleCloseStatusDialog();
      fetchReports();
    } catch (err) {
      console.error('更新Bug状态失败:', err);
      setError(err.response?.data?.detail || '更新Bug状态失败');
    } finally {
      setUpdatingStatus(false);
    }
  };
  
  // 处理状态筛选变化
  const handleStatusFilterChange = (event) => {
    setStatusFilter(event.target.value);
    setPage(0);
  };
  
  // 渲染Bug报告详情
  const renderReportDetail = () => {
    if (!selectedReport) return null;
    
    return (
      <Box>
        <Typography variant="h6" gutterBottom>问题描述</Typography>
        <Typography paragraph>{selectedReport.description}</Typography>
        
        {selectedReport.contact && (
          <>
            <Typography variant="h6" gutterBottom>联系方式</Typography>
            <Typography paragraph>{selectedReport.contact}</Typography>
          </>
        )}
        
        {selectedReport.system_info && (
          <>
            <Typography variant="h6" gutterBottom>系统信息</Typography>
            <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.100' }}>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(selectedReport.system_info, null, 2)}
              </pre>
            </Paper>
          </>
        )}
        
        {selectedReport.images && selectedReport.images.length > 0 && (
          <>
            <Typography variant="h6" gutterBottom>截图</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {selectedReport.images.map((image, index) => (
                <Paper key={index} elevation={2} sx={{ overflow: 'hidden' }}>
                  <Typography variant="caption" sx={{ p: 1, display: 'block' }}>
                    {image.name}
                  </Typography>
                  {image.path && (
                    <Box 
                      component="img" 
                      src={`${API_BASE_URL}/bug_report_images/${image.path.split('/').pop()}`}
                      alt={`Bug截图 ${index + 1}`}
                      sx={{ maxWidth: '100%', maxHeight: 300, display: 'block' }}
                      onError={(e) => {
                        e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjZjVmNWY1Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTIiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGFsaWdubWVudC1iYXNlbGluZT0ibWlkZGxlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZpbGw9IiNhYWEiPuWbvueJh+WFt+S9kzwvdGV4dD48L3N2Zz4=';
                      }}
                    />
                  )}
                </Paper>
              ))}
            </Box>
          </>
        )}
      </Box>
    );
  };
  
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>Bug报告管理</Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <FormControl variant="outlined" size="small" sx={{ minWidth: 200 }}>
          <InputLabel id="status-filter-label">状态筛选</InputLabel>
          <Select
            labelId="status-filter-label"
            value={statusFilter}
            onChange={handleStatusFilterChange}
            label="状态筛选"
          >
            <MenuItem value="">全部</MenuItem>
            <MenuItem value="pending">待处理</MenuItem>
            <MenuItem value="in_progress">处理中</MenuItem>
            <MenuItem value="resolved">已解决</MenuItem>
            <MenuItem value="rejected">已拒绝</MenuItem>
          </Select>
        </FormControl>
        
        <Button 
          variant="outlined" 
          onClick={fetchReports}
        >
          刷新
        </Button>
      </Box>
      
      <TableContainer component={Paper}>
        <Table sx={{ minWidth: 650 }}>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>用户</TableCell>
              <TableCell>问题描述</TableCell>
              <TableCell>状态</TableCell>
              <TableCell>提交时间</TableCell>
              <TableCell>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                  <CircularProgress size={24} />
                  <Typography variant="body2" sx={{ ml: 1 }}>加载中...</Typography>
                </TableCell>
              </TableRow>
            ) : reports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                  没有找到Bug报告
                </TableCell>
              </TableRow>
            ) : (
              reports.map((report) => (
                <TableRow key={report.id} hover>
                  <TableCell>{report.id}</TableCell>
                  <TableCell>{report.user_id}</TableCell>
                  <TableCell>
                    {report.description.length > 50
                      ? `${report.description.substring(0, 50)}...`
                      : report.description}
                  </TableCell>
                  <TableCell>
                    <StatusChip 
                      label={getStatusText(report.status)} 
                      status={report.status}
                      size="small"
                      onClick={() => handleOpenStatusDialog(report)}
                    />
                  </TableCell>
                  <TableCell>
                    {new Date(report.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <IconButton 
                      color="primary" 
                      size="small"
                      onClick={() => handleOpenDetail(report.id)}
                    >
                      <VisibilityIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      
      <TablePagination
        rowsPerPageOptions={[5, 10, 25]}
        component="div"
        count={totalReports}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        labelRowsPerPage="每页行数"
        labelDisplayedRows={({ from, to, count }) => `${from}-${to} 共 ${count}`}
      />
    </Box>
  );
};

export default BugReportList;