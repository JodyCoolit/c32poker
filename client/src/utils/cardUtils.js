/**
 * 扑克牌工具函数集
 */

// 精灵图总尺寸
const SPRITE_FULL_WIDTH = 600;  // 精灵图总宽度
const SPRITE_FULL_HEIGHT = 356; // 精灵图总高度

// 精灵图中的扑克牌尺寸和位置
const CARD_WIDTH = 34;  // 卡片宽度
const CARD_HEIGHT = 50; // 卡片高度
const CARD_H_GAP = 11;  // 水平间隔
const CARD_V_GAP = 8;   // 垂直间隔
const CARD_START_X = 18; // 第一张卡片左上角X坐标
const CARD_START_Y = 55; // 第一张卡片左上角Y坐标
const CARD_BACK_START_X = 35; // 第一张卡背左上角X坐标
const CARD_BACK_START_Y = 288; // 第一张卡背左上角Y坐标
const SPRITE_WIDTH = 13 * (CARD_WIDTH + CARD_H_GAP); // 精灵图宽度
const SPRITE_HEIGHT = 5 * (CARD_HEIGHT + CARD_V_GAP); // 精灵图高度

// 卡牌花色和点数映射
const SUIT_MAP = {
  'S': 'S',  // 黑桃
  'H': 'H',  // 红心
  'D': 'D',  // 方块
  'C': 'C',  // 梅花
  'SPADES': 'S',   // 支持服务器返回的全大写格式
  'HEARTS': 'H',
  'DIAMONDS': 'D',
  'CLUBS': 'C'
};

// 花色的标准化映射
const SUIT_NORMALIZE_MAP = {
  'S': 'S',
  'H': 'H',
  'D': 'D',
  'C': 'C',
  'SPADES': 'S',    // 将全大写的花色名称映射到单字母格式
  'HEARTS': 'H',
  'DIAMONDS': 'D',
  'CLUBS': 'C',
  '♠': 'S',         // 添加花色符号映射，用于向后兼容
  '♥': 'H',
  '♦': 'D',
  '♣': 'C'
};

const RANK_MAP = {
  'A': 'A',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  '10': '10',
  'J': 'J',
  'Q': 'Q',
  'K': 'K'
};

// 点数映射到精灵图中的列索引(0-12)
const RANK_INDEX_MAP = {
  '2': 0,
  '3': 1,
  '4': 2,
  '5': 3,
  '6': 4,
  '7': 5,
  '8': 6,
  '9': 7,
  '10': 8,
  'J': 9,
  'Q': 10,
  'K': 11,
  'A': 12
};

// 花色映射到精灵图中的行索引(0-3)
const SUIT_INDEX_MAP = {
  'C': 0, // 梅花在第一行
  'S': 1, // 黑桃在第二行
  'H': 2, // 红心在第三行
  'D': 3  // 方块在第四行
};

/**
 * 标准化卡牌代码，将服务器返回的各种格式统一为客户端使用的格式
 * @param {string|object} card - 卡牌代码或卡牌对象
 * @returns {string} 标准化后的卡牌代码
 */
export const normalizeCard = (card) => {
  // 如果卡牌是对象格式，提取rank和suit
  if (card && typeof card === 'object') {
    // 如果有display属性，直接使用
    if (card.display) {
      return card.display;
    }

    // 否则从rank和suit构建
    if (card.rank && card.suit) {
      const normalizedSuit = SUIT_NORMALIZE_MAP[card.suit] || card.suit.charAt(0);
      return `${card.rank}${normalizedSuit}`;
    }
    
    // 无法处理的对象
    console.warn('无法解析的卡牌对象:', card);
    return '';
  }
  
  // 如果是字符串但是包含♠♥♦♣，则将符号转换为字母代码以便内部处理
  if (typeof card === 'string') {
    if (card.includes('♠') || card.includes('♥') || card.includes('♦') || card.includes('♣')) {
      const rank = card.slice(0, card.length - 1);
      const suitSymbol = card.charAt(card.length - 1);
      const normalizedSuit = SUIT_NORMALIZE_MAP[suitSymbol] || suitSymbol;
      return `${rank}${normalizedSuit}`;
    }
    // 如果是普通字符串格式(如"7S", "10H")，直接返回
    return card;
  }
  
  return '';
};

/**
 * 计算卡牌在精灵图中的像素位置
 * @param {string} card - 标准化后的卡牌代码
 * @param {boolean} faceDown - 是否显示卡背
 * @returns {Object} 卡牌在精灵图中的像素坐标
 */
const calculateCardPixelPosition = (card, faceDown = false) => {
  // 如果是卡背
  if (faceDown) {
    // 默认使用第一张卡背
    return {
      x: CARD_BACK_START_X,
      y: CARD_BACK_START_Y
    };
  }

  // 从卡牌代码中提取点数和花色
  const rank = card.slice(0, card.length - 1);
  const suit = card.charAt(card.length - 1);
  
  // 获取点数索引(0-12)和花色索引(0-3)
  const rankIndex = RANK_INDEX_MAP[rank];
  if (rankIndex === undefined) {
    console.warn(`无效的点数: ${rank}`);
    return calculateCardPixelPosition('', true); // 使用卡背
  }
  
  // 标准化花色
  const normalizedSuit = SUIT_NORMALIZE_MAP[suit] || suit;
  const suitIndex = SUIT_INDEX_MAP[normalizedSuit];
  if (suitIndex === undefined) {
    console.warn(`无效的花色: ${normalizedSuit}`);
    return calculateCardPixelPosition('', true); // 使用卡背
  }
  
  // 计算精灵图中的像素坐标
  const x = CARD_START_X + rankIndex * (CARD_WIDTH + CARD_H_GAP);
  const y = CARD_START_Y + suitIndex * (CARD_HEIGHT + CARD_V_GAP);
  
  return { x, y };
};

/**
 * 获取卡牌在精灵图中的位置
 * @param {string|object} card - 卡牌代码或卡牌对象，如 "AS" 表示黑桃A
 * @param {boolean} faceDown - 是否显示卡背
 * @returns {Object} 卡牌在精灵图中的位置和尺寸相关信息
 */
export const getCardPosition = (card, faceDown = false) => {
  // 标准化卡牌格式
  const normalizedCard = normalizeCard(card);
  
  // 如果卡牌无效，使用卡背
  if (!normalizedCard || normalizedCard.length < 2) {
    faceDown = true;
  }
  
  // 计算卡牌在精灵图中的像素位置
  const { x, y } = calculateCardPixelPosition(normalizedCard, faceDown);
  
  // 返回卡牌在精灵图中的位置和尺寸相关信息
  return {
    x, // 卡牌左上角X坐标(像素)
    y, // 卡牌左上角Y坐标(像素)
    width: CARD_WIDTH, // 卡牌宽度(像素)
    height: CARD_HEIGHT, // 卡牌高度(像素)
    spriteUrl: '/assets/images/poker-set.jpg' // 精灵图URL
  };
};

/**
 * 获取花色颜色
 * @param {string|object} card - 卡牌代码或卡牌对象
 * @returns {string} 花色对应的颜色
 */
export const getSuitColor = (card) => {
  // 标准化卡牌格式
  const normalizedCard = normalizeCard(card);
  
  if (!normalizedCard || normalizedCard.length < 2) return '#000';
  
  const suit = normalizedCard.charAt(normalizedCard.length - 1);
  const normalizedSuit = SUIT_NORMALIZE_MAP[suit] || suit;
  
  // 红心和方块是红色，黑桃和梅花是黑色
  switch (normalizedSuit) {
    case 'H':
    case 'D':
      return '#e40000';
    case 'S':
    case 'C':
      return '#000000';
    default:
      return '#000000';
  }
};

/**
 * 获取卡牌显示名称
 * @param {string|object} card - 卡牌代码或卡牌对象
 * @returns {string} 卡牌显示名称，如"SA"
 */
export const getCardDisplayName = (card) => {
  // 标准化卡牌格式
  const normalizedCard = normalizeCard(card);
  
  if (!normalizedCard || normalizedCard.length < 2) return '';
  
  const rank = normalizedCard.slice(0, normalizedCard.length - 1);
  const suit = normalizedCard.charAt(normalizedCard.length - 1);
  
  // 获取标准化的花色
  const normalizedSuit = SUIT_NORMALIZE_MAP[suit] || suit;
  const suitLetter = SUIT_MAP[normalizedSuit] || '';
  const rankDisplay = RANK_MAP[rank] || rank;
  
  return `${suitLetter}${rankDisplay}`;
};

/**
 * 获取牌的大小样式
 * @param {string} size - 卡牌尺寸 "small", "medium", "large"
 * @returns {Object} 包含宽度和高度的对象
 */
export const getCardSize = (size = 'medium') => {
  // 使用卡牌原始大小比例缩放
  const ratio = CARD_HEIGHT / CARD_WIDTH; // 高宽比
  
  let width;
  switch (size) {
    case 'small':
      width = 35;
      break;
    case 'large':
      width = 70;
      break;
    case 'medium':
    default:
      width = 50;
  }
  
  const height = Math.round(width * ratio);
  return { width, height };
};

/**
 * 解析卡牌代码，用于调试和显示
 * @param {string|object} card - 卡牌代码或卡牌对象
 * @returns {Object} 包含花色和点数的对象
 */
export const parseCard = (card) => {
  // 标准化卡牌格式
  const normalizedCard = normalizeCard(card);
  
  // 无效卡牌
  if (!normalizedCard || normalizedCard.length < 2) {
    return { rank: '', suit: '' };
  }
  
  // 提取点数和花色
  const rank = normalizedCard.slice(0, normalizedCard.length - 1);
  const suit = normalizedCard.charAt(normalizedCard.length - 1);
  
  // 获取标准化的花色
  const normalizedSuit = SUIT_NORMALIZE_MAP[suit] || suit;
  
  // 判断花色中文名
  let suitName = '';
  switch (normalizedSuit) {
    case 'S': suitName = '黑桃'; break;
    case 'H': suitName = '红心'; break;
    case 'D': suitName = '方块'; break;
    case 'C': suitName = '梅花'; break;
  }
  
  // 判断点数中文名
  let rankName = rank;
  switch (rank) {
    case 'A': rankName = '1'; break;
    case 'J': rankName = '11'; break;
    case 'Q': rankName = '12'; break;
    case 'K': rankName = '13'; break;
  }
  
  return {
    rank,
    suit: normalizedSuit,
    rankName,
    suitName,
    displayName: `${suitName}${rankName}`
  };
};