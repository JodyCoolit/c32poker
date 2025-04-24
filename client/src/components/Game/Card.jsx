import React from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { parseCard, normalizeCard } from '../../utils/cardUtils';

// 卡牌图片的文件夹路径
const CARDS_FOLDER_PATH = '/assets/cards/';

// 样式化的卡牌组件 - 使用$前缀标记transient props
const CardContainer = styled.div`
  position: relative;
  width: ${props => props.width}px;
  height: ${props => props.height}px;
  border-radius: 8px;
  background-color: #fff; /* 添加白色背景 */
  margin: ${props => props.margin || '2px'};
  transition: transform 0.3s;
  overflow: hidden; // 确保内容不会溢出容器
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  
  &:hover {
    transform: ${props => props.$interactive ? 'translateY(-10px)' : 'none'};
    cursor: ${props => props.$interactive ? 'pointer' : 'default'};
  }
`;

// 修改为使用img标签显示卡牌图片
const CardImage = styled.img`
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 8px;
`;

// 卡牌额外样式 - 使用$前缀标记transient props
const CardOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 8px;
  background-color: ${props => props.$highlight ? 'rgba(255, 255, 0, 0.3)' : 'transparent'};
  border: ${props => props.$selected ? '2px solid gold' : 'none'};
  box-sizing: border-box;
  z-index: 3;
  pointer-events: none;
`;

/**
 * 获取卡牌图片路径
 * @param {string} normalizedCard - 标准化后的卡牌代码
 * @param {boolean} faceDown - 是否显示卡背
 * @returns {string} 图片路径
 */
const getCardImagePath = (normalizedCard, faceDown) => {
  if (faceDown) {
    return `${CARDS_FOLDER_PATH}back.png`;
  }
  
  if (!normalizedCard || normalizedCard.length < 2) {
    return `${CARDS_FOLDER_PATH}back.png`;
  }
  
  const rank = normalizedCard.slice(0, normalizedCard.length - 1);
  const suit = normalizedCard.charAt(normalizedCard.length - 1).toLowerCase();
  
  // 根据卡牌命名规则获取图片文件名
  // 例如：AS (黑桃A) -> as.png, 10H (红心10) -> 10h.png
  let fileName = '';
  
  // 匹配文件名格式：例如 2c.png, 10h.png, as.png
  switch (suit) {
    case 's': fileName = `${rank.toLowerCase()}s.png`; break; // 黑桃
    case 'h': fileName = `${rank.toLowerCase()}h.png`; break; // 红心
    case 'd': fileName = `${rank.toLowerCase()}d.png`; break; // 方块
    case 'c': fileName = `${rank.toLowerCase()}c.png`; break; // 梅花
    default: fileName = `${rank.toLowerCase()}${suit}.png`;
  }
  
  return `${CARDS_FOLDER_PATH}${fileName}`;
};

/**
 * 扑克牌组件
 * @param {string|object} card - 卡牌代码或卡牌对象，例如"AS"表示黑桃A，或{rank:"A",suit:"SPADES",display:"A♠"}
 * @param {string} size - 卡牌大小：small, medium, large
 * @param {boolean} faceDown - 是否显示卡背
 * @param {boolean} interactive - 是否可交互
 * @param {boolean} highlight - 是否高亮显示
 * @param {boolean} selected - 是否被选中
 * @param {string} margin - 外边距
 * @param {function} onClick - 点击事件处理函数
 */
const Card = ({
  card,
  faceDown = false,
  size = 'medium',
  interactive = false,
  highlight = false,
  selected = false,
  margin,
  onClick,
  style
}) => {
  // 图片加载状态
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const [imageError, setImageError] = React.useState(false);
  
  // 标准化卡牌格式
  const normalizedCard = normalizeCard(card);
  
  // 获取卡牌尺寸 - 保持典型的扑克牌比例 (2.5:3.5)
  let width, height;
  switch (size) {
    case 'small':
      width = 35;
      height = 50;
      break;
    case 'large':
      width = 70;
      height = 100;
      break;
    case 'medium':
    default:
      width = 50;
      height = 72;
  }
  
  // 获取卡牌图片路径
  const imagePath = getCardImagePath(normalizedCard, faceDown);
  
  // 解析卡牌信息用于调试
  const cardInfo = parseCard(normalizedCard);
  
  // 处理图片加载
  const handleImageLoad = () => {
    setImageLoaded(true);
    setImageError(false);
  };
  
  // 处理图片加载错误
  const handleImageError = () => {
    console.error('卡片图片加载失败:', imagePath);
    setImageLoaded(false);
    setImageError(true);
  };
  
  // 处理点击事件
  const handleClick = () => {
    if (interactive && onClick) {
      onClick(normalizedCard, cardInfo);
    }
  };

  // 如果图片加载失败，显示一个文本替代版本
  if (imageError) {
    return (
      <CardContainer 
        width={width} 
        height={height} 
        $interactive={interactive}
        margin={margin}
        onClick={handleClick}
        className="card card-error"
        style={{
          ...style,
          backgroundColor: faceDown ? '#1a237e' : '#fff',
          border: '2px solid #ccc',
                display: 'flex',
                flexDirection: 'column',
          justifyContent: 'center',
                alignItems: 'center',
          color: faceDown ? '#fff' : (cardInfo.suit === 'H' || cardInfo.suit === 'D' ? 'red' : 'black')
        }}
      >
        {!faceDown && normalizedCard ? (
          <>
            <div style={{ 
              fontSize: size === 'small' ? '16px' : (size === 'large' ? '36px' : '24px'),
              fontWeight: 'bold'
            }}>
              {cardInfo.rank || '?'}
            </div>
            <div style={{ 
              fontSize: size === 'small' ? '20px' : (size === 'large' ? '48px' : '32px')
            }}>
              {cardInfo.suit === 'S' ? '♠' : 
               cardInfo.suit === 'H' ? '♥' : 
               cardInfo.suit === 'D' ? '♦' : 
               cardInfo.suit === 'C' ? '♣' : '?'}
            </div>
                </>
            ) : (
          <div style={{ 
            fontSize: size === 'small' ? '12px' : (size === 'large' ? '24px' : '18px') 
          }}>
            ♠♥♦♣
          </div>
        )}
      </CardContainer>
    );
  }

  return (
    <CardContainer 
      width={width} 
      height={height} 
      $interactive={interactive}
      margin={margin}
      onClick={handleClick}
      className="card"
      style={style}
    >
      <CardImage 
        src={imagePath} 
        alt={faceDown ? "Card Back" : cardInfo.displayName || normalizedCard}
        onLoad={handleImageLoad}
        onError={handleImageError}
      />
      
      {/* 高亮和选中效果 */}
      <CardOverlay $highlight={highlight} $selected={selected} />
    </CardContainer>
  );
};

Card.propTypes = {
  card: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.object
  ]).isRequired,  // 卡牌代码或对象
  faceDown: PropTypes.bool,           // 是否卡背朝上
  size: PropTypes.oneOf(['small', 'medium', 'large']),  // 卡牌尺寸
  interactive: PropTypes.bool,        // 是否可交互
  highlight: PropTypes.bool,          // 是否高亮显示
  selected: PropTypes.bool,           // 是否被选中
  margin: PropTypes.string,           // 外边距
  onClick: PropTypes.func,            // 点击事件处理函数
  style: PropTypes.object             // 自定义样式
};

export default Card; 