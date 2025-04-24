import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Grid } from '@mui/material';
import PropTypes from 'prop-types';

// 卡牌图片的文件夹路径
const CARDS_FOLDER_PATH = '/assets/cards/';

/**
 * 调试组件：用于显示扑克牌精灵图的内容和结构
 */
const DebugCardImage = () => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [imageInfo, setImageInfo] = useState(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      console.log('DebugCardImage: 图片加载成功', img.width, 'x', img.height);
      setImageLoaded(true);
      setImageError(false);
      setImageInfo({
        width: img.width,
        height: img.height,
        src: img.src,
        complete: img.complete
      });
    };
    img.onerror = (error) => {
      console.error('DebugCardImage: 图片加载失败', error);
      setImageLoaded(false);
      setImageError(true);
    };
    img.src = getCardImagePath('AS', false);
  }, []);

  return (
    <Paper sx={{ p: 3, m: 2, maxWidth: '800px' }}>
      <Typography variant="h5" gutterBottom>扑克牌精灵图调试</Typography>
      
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle1">
          图片状态: {imageLoaded ? '加载成功' : (imageError ? '加载失败' : '加载中...')}
        </Typography>
        {imageInfo && (
          <Typography variant="body2">
            尺寸: {imageInfo.width} x {imageInfo.height} 像素
          </Typography>
        )}
        <Typography variant="body2">
          路径: {getCardImagePath('AS', false)}
        </Typography>
      </Box>
      
      {imageLoaded ? (
        <Box sx={{ overflow: 'auto', maxHeight: '500px', border: '1px solid #ccc' }}>
          <Box 
            component="img"
            src={getCardImagePath('AS', false)}
            alt="扑克牌精灵图"
            sx={{ display: 'block', maxWidth: '100%' }}
          />
        </Box>
      ) : (
        <Box 
          sx={{ 
            height: '300px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            border: '1px dashed #ccc'
          }}
        >
          {imageError ? (
            <Typography color="error">
              图片加载失败，请检查路径和文件是否存在: {getCardImagePath('AS', false)}
            </Typography>
          ) : (
            <Typography>
              加载中...
            </Typography>
          )}
        </Box>
      )}
      
      <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>调试步骤：</Typography>
      <ol>
        <li>检查图片是否成功加载</li>
        <li>检查图片尺寸是否与代码中的计算匹配</li>
        <li>检查扑克牌在精灵图中的排列是否与代码预期一致</li>
        <li>可能需要调整 cardUtils.js 中的 getCardPosition 函数</li>
      </ol>
    </Paper>
  );
};

// 与 Card.jsx 中保持一致的函数
const getCardImagePath = (cardCode, faceDown) => {
  if (faceDown) {
    return `${CARDS_FOLDER_PATH}back.png`;
  }
  
  if (!cardCode || cardCode.length < 2) {
    return `${CARDS_FOLDER_PATH}back.png`;
  }
  
  const rank = cardCode.slice(0, cardCode.length - 1);
  const suit = cardCode.charAt(cardCode.length - 1).toLowerCase();
  
  // 根据卡牌命名规则获取图片文件名
  let fileName = '';
  
  switch (suit) {
    case 's': fileName = `${rank.toLowerCase()}s.png`; break; // 黑桃
    case 'h': fileName = `${rank.toLowerCase()}h.png`; break; // 红心
    case 'd': fileName = `${rank.toLowerCase()}d.png`; break; // 方块
    case 'c': fileName = `${rank.toLowerCase()}c.png`; break; // 梅花
    default: fileName = `${rank.toLowerCase()}${suit}.png`;
  }
  
  return `${CARDS_FOLDER_PATH}${fileName}`;
};

DebugCardImage.propTypes = {
  // Add any necessary prop types here
};

export default DebugCardImage; 