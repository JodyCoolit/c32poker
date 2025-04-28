/**
 * 扑克游戏音效管理器
 * 负责预加载和播放游戏过程中的各种音效
 */

// 音频缓存对象
let audioCache = {};

class SoundEffectsManager {
  constructor() {
    // 音效库
    this.sounds = {};
    
    // 音效文件路径
    this.soundPaths = {
      bet: '/assets/sounds/bet.mp3',
      check: '/assets/sounds/check.mp3',
      fold: '/assets/sounds/card-fold.mp3', // 使用现有的弃牌音效
      flop: '/assets/sounds/flop.mp3',
      deal: '/assets/sounds/card-deal.mp3', // 使用现有的发牌音效
      shuffle: '/assets/sounds/card-shuffle.mp3', // 使用现有的洗牌音效
      win: '/assets/sounds/win.mp3',
      chips: '/assets/sounds/chips.mp3',
    };
    
    // 音量设置 (0 到 1)
    this.volume = 0.5;
    
    // 音效是否启用
    this.enabled = true;
    
    // 是否已经加载过音效
    this.loaded = false;
  }
  
  /**
   * 预加载所有音效文件
   * @returns {Promise} 完成加载的Promise
   */
  preloadSounds() {
    if (this.loaded) {
      return Promise.resolve(); // 如果已经加载过，直接返回
    }
    
    const loadPromises = [];
    
    // 加载每个音效
    for (const [soundName, soundPath] of Object.entries(this.soundPaths)) {
      const loadPromise = new Promise((resolve, reject) => {
        try {
          const audio = new Audio(soundPath);
          audio.volume = this.volume;
          
          // 缓存音频对象
          audioCache[soundName] = audio;
          
          // 加载完成后添加到音效库
          audio.addEventListener('canplaythrough', () => {
            this.sounds[soundName] = audio;
            resolve();
          }, { once: true });
          
          // 加载出错时记录并继续
          audio.addEventListener('error', (error) => {
            console.warn(`Failed to load sound ${soundName}: ${error}`);
            resolve(); // 即使出错也视为已处理，防止整个Promise被拒绝
          }, { once: true });
          
          // 开始加载
          audio.load();
        } catch (error) {
          console.error(`Error initializing sound ${soundName}: ${error}`);
          resolve(); // 防止单个错误导致整个Promise失败
        }
      });
      
      loadPromises.push(loadPromise);
    }
    
    // 等待所有音效加载完成，或最多等待5秒
    return Promise.race([
      Promise.all(loadPromises),
      new Promise(resolve => setTimeout(resolve, 5000)) // 5秒超时
    ]).then(() => {
      this.loaded = true;
      console.log('Sound effects loaded successfully');
    });
  }
  
  /**
   * 播放指定音效
   * @param {string} soundName - 音效名称
   * @returns {Promise} 播放完成的Promise
   */
  playSound(soundName) {
    return new Promise((resolve) => {
      if (!this.enabled || !this.sounds[soundName]) {
        resolve(false);
        return;
      }
      
      try {
        // 创建一个新的音频实例，允许同时播放多个相同音效
        const soundInstance = this.sounds[soundName].cloneNode();
        soundInstance.volume = this.volume;
        
        // 监听播放结束
        soundInstance.addEventListener('ended', () => {
          resolve(true);
        }, { once: true });
        
        // 播放音效
        const playPromise = soundInstance.play();
        
        // 处理播放可能的错误
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.warn(`Failed to play sound ${soundName}: ${error}`);
            resolve(false);
          });
        }
      } catch (error) {
        console.error(`Error playing sound ${soundName}: ${error}`);
        resolve(false);
      }
      
      // 确保2秒后无论如何都会解析Promise
      setTimeout(() => resolve(true), 2000);
    });
  }
  
  /**
   * 播放下注/加注音效
   * @returns {Promise} 播放完成的Promise
   */
  playBetSound() {
    return this.playSound('bet');
  }
  
  /**
   * 播放让牌音效
   * @returns {Promise} 播放完成的Promise
   */
  playCheckSound() {
    return this.playSound('check');
  }
  
  /**
   * 播放弃牌音效
   * @returns {Promise} 播放完成的Promise
   */
  playFoldSound() {
    return this.playSound('fold');
  }
  
  /**
   * 播放翻牌/转牌/河牌音效
   * @returns {Promise} 播放完成的Promise
   */
  playFlopSound() {
    return this.playSound('flop');
  }
  
  /**
   * 播放发牌音效
   * @param {number} count 发牌数量
   * @param {number} interval 发牌间隔(毫秒)
   * @returns {void}
   */
  playDealSounds(count = 1, interval = 200) {
    if (!this.enabled || !this.sounds['deal']) {
      return;
    }
    
    // 为每张牌安排发牌音效
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        if (!this.enabled) return;
        
        // 克隆音频对象以便同时播放多个实例
        const dealSound = this.sounds['deal'].cloneNode();
        dealSound.volume = this.volume;
        dealSound.play().catch(err => console.warn('无法播放发牌音效:', err));
      }, i * interval);
    }
  }
  
  /**
   * 播放洗牌音效
   * @returns {Promise} 播放完成的Promise
   */
  playShuffleSound() {
    return this.playSound('shuffle');
  }
  
  /**
   * 播放赢牌音效
   * @returns {Promise} 播放完成的Promise
   */
  playWinSound() {
    return this.playSound('win');
  }
  
  /**
   * 播放筹码音效
   * @returns {Promise} 播放完成的Promise
   */
  playChipsSound() {
    return this.playSound('chips');
  }
  
  /**
   * 设置所有音效的音量
   * @param {number} volume - 音量值 (0 到 1)
   */
  setVolume(volume) {
    if (volume < 0 || volume > 1) {
      console.warn('Volume must be between 0 and 1');
      return;
    }
    
    this.volume = volume;
    
    // 更新所有已加载音效的音量
    for (const sound of Object.values(this.sounds)) {
      sound.volume = volume;
    }
  }
  
  /**
   * 启用或禁用所有音效
   * @param {boolean} enabled - 是否启用音效
   */
  setEnabled(enabled) {
    this.enabled = !!enabled;
  }
  
  /**
   * 停止所有音频播放
   */
  stopAllSounds() {
    for (const sound of Object.values(this.sounds)) {
      sound.pause();
      sound.currentTime = 0;
    }
  }
  
  /**
   * 释放所有音效资源
   */
  dispose() {
    this.stopAllSounds();
    
    for (const sound of Object.values(this.sounds)) {
      sound.src = '';
    }
    
    this.sounds = {};
    audioCache = {};
    this.loaded = false;
  }
}

// 创建并导出单例实例
const soundEffects = new SoundEffectsManager();
export default soundEffects; 