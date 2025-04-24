/**
 * 发牌动画工具类
 * 提供游戏中发牌动画和音效的控制功能
 */

// 音频缓存对象
let audioCache = {
  shuffle: null,
  deal: null
};

/**
 * 预加载音频文件
 * @returns {Promise} 完成预加载的Promise
 */
export const preloadAudio = () => {
  return new Promise((resolve) => {
    // 创建音频对象
    audioCache.shuffle = new Audio('/assets/sounds/card-shuffle.mp3');
    audioCache.deal = new Audio('/assets/sounds/card-deal.mp3');
    
    // 设置音频参数
    audioCache.shuffle.volume = 0.8;
    audioCache.deal.volume = 0.7;
    
    // 预加载
    let loaded = 0;
    const checkAllLoaded = () => {
      loaded++;
      if (loaded >= 2) resolve();
    };
    
    audioCache.shuffle.addEventListener('canplaythrough', checkAllLoaded);
    audioCache.deal.addEventListener('canplaythrough', checkAllLoaded);
    
    // 触发加载
    audioCache.shuffle.load();
    audioCache.deal.load();
    
    // 确保5秒后无论如何都会解析Promise
    setTimeout(resolve, 5000);
  });
};

/**
 * 播放洗牌音效
 * @returns {Promise} 完成播放的Promise
 */
export const playShuffleSound = () => {
  return new Promise((resolve) => {
    if (!audioCache.shuffle) {
      audioCache.shuffle = new Audio('/assets/sounds/card-shuffle.mp3');
    }
    
    // 重置音频
    audioCache.shuffle.currentTime = 0;
    
    // 监听播放结束
    const onEnded = () => {
      audioCache.shuffle.removeEventListener('ended', onEnded);
      resolve();
    };
    
    audioCache.shuffle.addEventListener('ended', onEnded);
    
    // 播放
    audioCache.shuffle.play()
      .catch(err => {
        console.warn('无法播放洗牌音效:', err);
        resolve(); // 即使出错也继续执行
      });
    
    // 确保2秒后无论如何都会解析Promise
    setTimeout(resolve, 2000);
  });
};

/**
 * 播放发牌音效
 * @param {number} count 发牌数量
 * @param {number} interval 发牌间隔(毫秒)
 * @returns {void}
 */
export const playDealSounds = (count = 1, interval = 200) => {
  if (!audioCache.deal) {
    audioCache.deal = new Audio('/assets/sounds/card-deal.mp3');
  }
  
  // 为每张牌安排发牌音效
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      // 克隆音频对象以便同时播放多个实例
      const dealSound = audioCache.deal.cloneNode();
      dealSound.volume = 0.6;
      dealSound.play().catch(err => console.warn('无法播放发牌音效:', err));
    }, i * interval);
  }
};

/**
 * 计算卡牌动画持续时间
 * @param {number} playerCount 玩家数量
 * @param {number} cardsPerPlayer 每位玩家的卡牌数量
 * @param {number} dealDelay 每张牌发牌延迟(秒)
 * @returns {number} 总动画时间(毫秒)
 */
export const calculateAnimationDuration = (
  playerCount = 1, 
  cardsPerPlayer = 3,
  dealDelay = 0.2
) => {
  const singleCardDuration = 0.6; // 单张牌动画时长(秒)
  const totalDuration = 
    playerCount * cardsPerPlayer * dealDelay + singleCardDuration + 0.5;
  
  return totalDuration * 1000; // 转换为毫秒
};

/**
 * 停止所有音频播放
 */
export const stopAllAudio = () => {
  Object.values(audioCache).forEach(audio => {
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  });
};

export default {
  preloadAudio,
  playShuffleSound,
  playDealSounds,
  calculateAnimationDuration,
  stopAllAudio
}; 