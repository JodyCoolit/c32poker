import axios from 'axios';

// 根据环境选择API基础URL
const getBaseUrl = () => {
  // 如果存在环境变量，优先使用环境变量
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // 在本地开发环境中使用localhost
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:8000';
  }
  
  // 在生产环境中使用Docker服务名
  return 'http://backend:8000';
};

// 创建axios实例，设置基础URL和认证
const api = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器 - 添加认证Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Bug Report 服务
 * 提供与Bug Report相关的API方法
 */
const bugReportService = {
  /**
   * 提交Bug Report
   * @param {Object} bugData - Bug Report数据
   * @param {string} bugData.description - 问题描述
   * @param {string} bugData.contact - 联系方式(可选)
   * @param {Array} bugData.images - 图片数组
   * @param {Object} bugData.systemInfo - 系统信息
   * @returns {Promise} 请求Promise
   */
  submitBugReport: async (bugData) => {
    try {
      // 压缩图片数据
      const compressedImages = await Promise.all(
        bugData.images.map(async (img) => {
          // 如果图片数据过大，可以在这里实现压缩逻辑
          return {
            ...img,
            data: img.data // 这里可以添加压缩处理
          };
        })
      );

      // 准备提交数据
      const payload = {
        description: bugData.description,
        contact: bugData.contact || null,
        images: compressedImages,
        systemInfo: {
          ...bugData.systemInfo,
          browser: navigator.userAgent,
          clientTime: new Date().toISOString()
        }
      };

      // 发送请求
      console.log('提交Bug Report:', payload);
      const response = await api.post('/api/bug-reports', payload);
      
      return response.data;
    } catch (error) {
      console.error('提交Bug Report失败:', error);
      throw error;
    }
  },

  /**
   * 获取Bug报告列表
   * @param {Object} options - 查询选项
   * @param {number} options.limit - 每页记录数
   * @param {number} options.offset - 偏移量
   * @param {string} options.status - 状态筛选
   * @returns {Promise} 请求Promise
   */
  getBugReports: async (options = {}) => {
    try {
      const { limit = 10, offset = 0, status } = options;
      let url = `/api/bug-reports?limit=${limit}&offset=${offset}`;
      
      if (status) {
        url += `&status=${status}`;
      }
      
      console.log('bugReportService - 请求Bug报告列表:', url);
      
      const response = await api.get(url);
      console.log('bugReportService - 获取Bug报告列表响应:', response.data);
      
      // 如果后端返回的数据格式不符合预期，进行初始化处理
      if (!response.data || !response.data.reports) {
        console.warn('bugReportService - API响应格式不正确:', response.data);
        return { reports: [], total: 0 };
      }
      
      return response.data;
    } catch (error) {
      console.error('bugReportService - 获取Bug报告列表失败:', error);
      throw error;
    }
  },

  /**
   * 获取Bug报告详情
   * @param {number} reportId - 报告ID
   * @returns {Promise} 请求Promise
   */
  getBugReportDetail: async (reportId) => {
    try {
      const response = await api.get(`/api/bug-reports/${reportId}`);
      return response.data;
    } catch (error) {
      console.error('获取Bug报告详情失败:', error);
      throw error;
    }
  },

  /**
   * 更新Bug报告状态
   * @param {number} reportId - 报告ID
   * @param {string} status - 新状态
   * @returns {Promise} 请求Promise
   */
  updateBugReportStatus: async (reportId, status) => {
    try {
      const response = await api.put(`/api/bug-reports/${reportId}/status`, { status });
      return response.data;
    } catch (error) {
      console.error('更新Bug报告状态失败:', error);
      throw error;
    }
  },

  /**
   * 获取用户的Bug报告列表
   * @param {string} username - 用户名
   * @param {Object} options - 查询选项
   * @param {number} options.limit - 每页记录数
   * @param {number} options.offset - 偏移量
   * @returns {Promise} 请求Promise
   */
  getUserBugReports: async (username, options = {}) => {
    try {
      const { limit = 10, offset = 0 } = options;
      const response = await api.get(`/api/bug-reports/user/${username}?limit=${limit}&offset=${offset}`);
      return response.data;
    } catch (error) {
      console.error('获取用户Bug报告列表失败:', error);
      throw error;
    }
  }
};

export default bugReportService; 