/**
 * 应用程序配置
 * 包含API地址、WebSocket地址等配置信息
 */

/**
 * 获取API基础URL
 * 根据环境自动选择合适的URL
 */
export const getApiBaseUrl = () => {
  // 优先使用环境变量
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // 开发环境使用完整URL
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:8000';
  }
  
  // 生产环境依赖nginx代理，使用相对路径
  // 这样请求会发送到当前主机，然后由nginx代理到后端
  return '';
};

/**
 * 获取WebSocket基础URL
 * 根据环境自动选择合适的URL
 */
export const getWsBaseUrl = () => {
  // 优先使用环境变量
  if (process.env.REACT_APP_WS_URL) {
    return process.env.REACT_APP_WS_URL;
  }
  
  // 协议部分，根据当前页面协议决定
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  
  // 开发环境使用完整URL
  if (process.env.NODE_ENV === 'development') {
    return `${wsProtocol}//localhost:8000`;
  }
  
  // 生产环境依赖nginx代理，使用当前主机
  return `${wsProtocol}//${window.location.host}`;
};

// 导出当前环境的API URL (方便直接使用)
export const API_BASE_URL = getApiBaseUrl();
export const WS_BASE_URL = getWsBaseUrl();

// 输出当前配置信息，方便调试
console.log('============= 应用配置信息 =============');
console.log('环境:', process.env.NODE_ENV);
console.log('主机地址:', window.location.host);
console.log('API基础URL:', API_BASE_URL);
console.log('WebSocket基础URL:', WS_BASE_URL);
console.log('========================================='); 