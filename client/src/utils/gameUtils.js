/**
 * 德州扑克游戏工具函数
 */

/**
 * 获取动作的中文翻译名称
 * @param {string} action - 动作名称
 * @returns {string} 翻译后的动作名称
 */
export const getTranslatedActionName = (action) => {
  const actionMap = {
    'check': '过牌',
    'fold': '弃牌',
    'call': '跟注',
    'bet': '下注',
    'raise': '加注',
    'all-in': '全押',
    'allin': '全押',
    'small_blind': '小盲注',
    'big_blind': '大盲注',
    'dealer': '庄家',
    'win': '赢牌',
    'discard': '弃牌',
    'keep': '保留'
  };
  
  return actionMap[action] || action;
};

/**
 * 格式化筹码数量展示
 * @param {number} amount - 筹码数量
 * @returns {string} 格式化后的筹码展示
 */
export const formatChips = (amount) => {
  if (!amount && amount !== 0) return '';
  
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}K`;
  }
  return amount.toString();
};

/**
 * 计算当前玩家的盈亏情况
 * @param {object} player - 玩家对象
 * @returns {object|null} 盈亏情况对象
 */
export const calculatePlayerProfit = (player) => {
  if (!player) return null;
  
  // 取初始筹码 (优先使用initialChips，兼容initial_chips属性名)
  const initialChips = player.initialChips !== undefined 
    ? player.initialChips 
    : (player.initial_chips !== undefined ? player.initial_chips : null);
  
  // 取当前筹码 (优先使用chips，兼容stack属性名)
  const currentChips = player.chips !== undefined 
    ? player.chips 
    : (player.stack !== undefined ? player.stack : null);
  
  // 如果初始筹码或当前筹码任一不存在，无法计算盈亏
  if (initialChips === null || currentChips === null) {
    return null;
  }
  
  // 计算盈亏值
  const profit = currentChips - initialChips;
  
  // 返回盈亏信息对象
  return {
    value: profit,
    isPositive: profit > 0,
    isNegative: profit < 0,
    display: profit > 0 ? `+${formatChips(profit)}` : formatChips(profit)
  };
}; 