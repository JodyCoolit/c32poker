import React, { useState, useRef, useEffect } from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  TextField, 
  Typography, 
  Box, 
  CircularProgress,
  IconButton,
  Paper,
  Divider,
  FormHelperText,
  useMediaQuery
} from '@mui/material';
import { styled, useTheme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import ImageIcon from '@mui/icons-material/Image';
import DeleteIcon from '@mui/icons-material/Delete';
import UploadFileIcon from '@mui/icons-material/UploadFile';

// 图片预览容器
const ImagePreviewContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(1),
  marginTop: theme.spacing(2),
}));

// 图片预览项
const ImagePreviewItem = styled(Paper)(({ theme }) => ({
  position: 'relative',
  width: 100,
  height: 100,
  overflow: 'hidden',
  marginBottom: theme.spacing(1),
  borderRadius: theme.shape.borderRadius,
}));

// 图片
const PreviewImage = styled('img')({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
});

// 删除按钮
const DeleteButton = styled(IconButton)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  right: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  color: 'white',
  padding: 4,
  '&:hover': {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
}));

// 拖放区域
const DropZone = styled(Paper)(({ theme, isDragActive }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: theme.spacing(3),
  borderRadius: theme.shape.borderRadius,
  border: `2px dashed ${isDragActive ? theme.palette.primary.main : theme.palette.divider}`,
  backgroundColor: isDragActive ? theme.palette.action.hover : theme.palette.background.default,
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  marginTop: theme.spacing(2),
  height: 120,
}));

/**
 * Bug Report对话框组件
 * @param {boolean} open - 对话框是否打开
 * @param {function} onClose - 关闭对话框回调
 * @param {function} onSubmit - 提交表单回调，接收表单数据作为参数
 */
const BugReportDialog = ({ open, onClose, onSubmit }) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [description, setDescription] = useState('');
  const [contact, setContact] = useState('');
  const [images, setImages] = useState([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const fileInputRef = useRef(null);

  // 重置表单
  useEffect(() => {
    if (!open) {
      setDescription('');
      setContact('');
      setImages([]);
      setErrors({});
      setIsSubmitting(false);
    }
  }, [open]);

  // 处理图片文件
  const processImageFile = (file) => {
    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      console.warn('只支持图片文件');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      // 确保不添加重复图片
      if (!images.some(img => img.data === e.target.result)) {
        setImages([...images, {
          id: Date.now(), // 唯一ID
          file,
          data: e.target.result,
          name: file.name
        }]);
      }
    };
    reader.readAsDataURL(file);
  };

  // 处理文件选择
  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    files.forEach(processImageFile);
    // 重置文件输入以允许选择相同的文件
    event.target.value = '';
  };

  // 处理拖放
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      files.forEach(processImageFile);
    }
  };

  // 处理粘贴事件
  const handlePaste = (e) => {
    if (e.clipboardData && e.clipboardData.items) {
      const items = Array.from(e.clipboardData.items);
      items.forEach(item => {
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          processImageFile(file);
        }
      });
    }
  };

  // 删除图片
  const handleDeleteImage = (id) => {
    setImages(images.filter(image => image.id !== id));
  };

  // 验证表单
  const validateForm = () => {
    const newErrors = {};
    
    if (!description.trim()) {
      newErrors.description = '请描述问题';
    }
    
    if (description.trim().length < 10) {
      newErrors.description = '问题描述至少需要10个字符';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 提交表单
  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const systemInfo = {
        userAgent: navigator.userAgent,
        screenSize: `${window.screen.width}x${window.screen.height}`,
        currentUrl: window.location.href,
        timestamp: new Date().toISOString(),
      };
      
      const bugData = {
        description,
        contact,
        images: images.map(img => ({
          data: img.data,
          name: img.name,
          type: img.file.type
        })),
        systemInfo
      };
      
      const result = await onSubmit(bugData);
      if (result) {
        onClose();
      }
    } catch (error) {
      console.error('提交Bug报告失败:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={!isSubmitting ? onClose : undefined}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: { 
          borderRadius: 2,
          overflow: 'hidden'
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.ctrlKey) {
          handleSubmit();
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">报告问题</Typography>
        <IconButton 
          edge="end" 
          color="inherit" 
          onClick={onClose} 
          aria-label="close"
          disabled={isSubmitting}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <Divider />
      
      <DialogContent>
        <Box component="form" noValidate autoComplete="off">
          <TextField
            autoFocus
            margin="dense"
            id="description"
            label="问题描述"
            fullWidth
            multiline
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="请详细描述您遇到的问题..."
            error={!!errors.description}
            helperText={errors.description}
            disabled={isSubmitting}
            onPaste={handlePaste}
            required
          />
          
          <TextField
            margin="dense"
            id="contact"
            label="联系方式 (可选)"
            fullWidth
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="Email 或其他联系方式"
            disabled={isSubmitting}
            sx={{ mt: 2 }}
          />
          
          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
            问题截图 (可选)
          </Typography>
          
          <DropZone
            isDragActive={isDragActive}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={handleFileSelect}
              disabled={isSubmitting}
            />
            <UploadFileIcon color="action" sx={{ mb: 1, fontSize: 32 }} />
            <Typography variant="body2" color="textSecondary" align="center">
              点击或拖放图片到此处上传 (可选)
            </Typography>
            <Typography variant="caption" color="textSecondary" align="center">
              支持复制粘贴截图
            </Typography>
          </DropZone>
          
          {errors.images && (
            <FormHelperText error>{errors.images}</FormHelperText>
          )}
          
          {images.length > 0 && (
            <ImagePreviewContainer>
              {images.map((image) => (
                <ImagePreviewItem key={image.id} elevation={1}>
                  <PreviewImage src={image.data} alt="问题截图" />
                  <DeleteButton 
                    size="small" 
                    onClick={() => handleDeleteImage(image.id)}
                    disabled={isSubmitting}
                  >
                    <DeleteIcon fontSize="small" />
                  </DeleteButton>
                </ImagePreviewItem>
              ))}
            </ImagePreviewContainer>
          )}
          
          <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 2 }}>
            * 系统将自动收集环境信息以帮助解决问题
          </Typography>
        </Box>
      </DialogContent>
      
      <Divider />
      
      <DialogActions>
        <Button 
          onClick={onClose} 
          color="inherit"
          disabled={isSubmitting}
        >
          取消
        </Button>
        <Button 
          onClick={handleSubmit} 
          color="primary" 
          variant="contained"
          disabled={isSubmitting}
          startIcon={isSubmitting && <CircularProgress size={16} color="inherit" />}
        >
          {isSubmitting ? '提交中...' : '提交报告'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BugReportDialog; 