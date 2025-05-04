/**
 * 应用程序配置
 * 包含API地址、WebSocket地址等配置信息
 */

// 指定外网服务器IP (如果需要)
export const SERVER_IP = '8.134.190.102';

/**
 * 获取API基础URL
 * 根据环境自动选择合适的URL
 */
export const getApiBaseUrl = () => {
  // 如果存在环境变量，优先使用环境变量
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // 根据环境判断使用哪个地址
  if (process.env.NODE_ENV === 'development') {
    // 本地开发环境
    return 'http://localhost:8000';
  } else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // 如果是在本地访问但已经构建了生产版本
    return 'http://localhost:8000';
  } else if (SERVER_IP && window.location.hostname !== 'backend') {
    // 如果有特定的服务器IP且不是在Docker网络中
    return `http://${SERVER_IP}:8000`;
  }
  
  // 在Docker环境中
  return 'http://backend:8000';
};

/**
 * 获取WebSocket基础URL
 * 根据环境自动选择合适的URL
 */
export const getWsBaseUrl = () => {
  // 如果有环境变量，优先使用环境变量
  if (process.env.REACT_APP_WS_URL) {
    return process.env.REACT_APP_WS_URL;
  }
  
  // 协议部分，根据当前页面协议决定
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  
  // 根据环境判断使用哪个地址
  if (process.env.NODE_ENV === 'development') {
    // 本地开发环境
    return `${wsProtocol}//localhost:8000`;
  } else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // 如果是在本地访问但已经构建了生产版本
    return `${wsProtocol}//localhost:8000`;
  } else if (SERVER_IP && window.location.hostname !== 'backend') {
    // 如果有特定的服务器IP且不是在Docker网络中
    return `${wsProtocol}//${SERVER_IP}:8000`;
  }
  
  // 在Docker环境中
  return `${wsProtocol}//backend:8000`;
};

// 导出当前环境的API URL (方便直接使用)
export const API_BASE_URL = getApiBaseUrl();
export const WS_BASE_URL = getWsBaseUrl();

// 输出当前配置信息，方便调试
if (process.env.NODE_ENV === 'development') {
  console.log('============= 应用配置信息 =============');
  console.log('环境:', process.env.NODE_ENV);
  console.log('API基础URL:', API_BASE_URL);
  console.log('WebSocket基础URL:', WS_BASE_URL);
  console.log('=========================================');
} 