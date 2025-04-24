/**
 * 日志记录工具
 * 支持不同级别的日志记录，可通过环境变量控制日志级别
 */

// 日志级别
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
};

// 当前日志级别，默认为INFO
// 可通过设置环境变量 REACT_APP_LOG_LEVEL 修改
const getCurrentLogLevel = () => {
  const envLevel = process.env.REACT_APP_LOG_LEVEL?.toUpperCase();
  if (envLevel && LOG_LEVELS[envLevel] !== undefined) {
    return LOG_LEVELS[envLevel];
  }
  
  // 生产环境默认只显示WARNING及以上级别
  if (process.env.NODE_ENV === 'production') {
    return LOG_LEVELS.WARN;
  }
  
  // 开发环境默认显示所有日志
  return LOG_LEVELS.DEBUG;
};

// 当前日志级别
const CURRENT_LOG_LEVEL = getCurrentLogLevel();

/**
 * 添加时间戳和级别前缀的日志函数
 * @param {string} level - 日志级别
 * @param {Array} args - 日志参数
 */
const logWithPrefix = (level, ...args) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}]`, ...args);
};

/**
 * 使用调用栈获取日志来源
 * @returns {string} 调用源文件和行号
 */
const getCallerInfo = () => {
  try {
    const err = new Error();
    const stack = err.stack.split('\n');
    
    // 获取调用者的行信息 (index 3，因为0是错误信息，1是当前函数，2是logger方法, 3是实际调用位置)
    if (stack.length >= 4) {
      const callerLine = stack[3].trim();
      
      // 尝试提取文件名和行号
      const match = callerLine.match(/at\s+(.*?)\s+\((.*?):(\d+):(\d+)\)/) || 
                    callerLine.match(/at\s+(.*?):(\d+):(\d+)/);
      
      if (match) {
        // 如果匹配到 "at function (file:line:column)"
        if (match.length === 5) {
          const [, funcName, fileName, line] = match;
          // 只返回简短的文件名，不包含完整路径
          const shortFileName = fileName.split('/').pop();
          return `${shortFileName}:${line} (${funcName})`;
        } 
        // 如果匹配到 "at file:line:column"
        else if (match.length === 4) {
          const [, fileName, line] = match;
          const shortFileName = fileName.split('/').pop();
          return `${shortFileName}:${line}`;
        }
      }
    }
    
    return 'unknown';
  } catch (e) {
    return 'unknown';
  }
};

// 日志对象
const logger = {
  /**
   * 调试级别日志
   */
  debug: (...args) => {
    if (CURRENT_LOG_LEVEL <= LOG_LEVELS.DEBUG) {
      const source = getCallerInfo();
      logWithPrefix('DEBUG', `[${source}]`, ...args);
    }
  },
  
  /**
   * 信息级别日志
   */
  info: (...args) => {
    if (CURRENT_LOG_LEVEL <= LOG_LEVELS.INFO) {
      const source = getCallerInfo();
      logWithPrefix('INFO', `[${source}]`, ...args);
    }
  },
  
  /**
   * 警告级别日志
   */
  warn: (...args) => {
    if (CURRENT_LOG_LEVEL <= LOG_LEVELS.WARN) {
      const source = getCallerInfo();
      logWithPrefix('WARN', `[${source}]`, ...args);
    }
  },
  
  /**
   * 错误级别日志
   */
  error: (...args) => {
    if (CURRENT_LOG_LEVEL <= LOG_LEVELS.ERROR) {
      const source = getCallerInfo();
      logWithPrefix('ERROR', `[${source}]`, ...args);
    }
  },
  
  /**
   * 追踪日志
   * 打印详细的调用栈信息
   */
  trace: (message) => {
    if (CURRENT_LOG_LEVEL <= LOG_LEVELS.DEBUG) {
      console.trace(`[TRACE] ${message}`);
    }
  },
  
  /**
   * 可配置的组日志
   * 创建一个带有特定标签的日志器
   * @param {string} group - 日志分组名称 
   * @returns {object} - 带有分组名的日志对象
   */
  group: (group) => {
    return {
      debug: (...args) => {
        if (CURRENT_LOG_LEVEL <= LOG_LEVELS.DEBUG) {
          const source = getCallerInfo();
          logWithPrefix('DEBUG', `[${group}] [${source}]`, ...args);
        }
      },
      info: (...args) => {
        if (CURRENT_LOG_LEVEL <= LOG_LEVELS.INFO) {
          const source = getCallerInfo();
          logWithPrefix('INFO', `[${group}] [${source}]`, ...args);
        }
      },
      warn: (...args) => {
        if (CURRENT_LOG_LEVEL <= LOG_LEVELS.WARN) {
          const source = getCallerInfo();
          logWithPrefix('WARN', `[${group}] [${source}]`, ...args);
        }
      },
      error: (...args) => {
        if (CURRENT_LOG_LEVEL <= LOG_LEVELS.ERROR) {
          const source = getCallerInfo();
          logWithPrefix('ERROR', `[${group}] [${source}]`, ...args);
        }
      }
    };
  }
};

export default logger; 