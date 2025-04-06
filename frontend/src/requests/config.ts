import axios, { AxiosResponse, AxiosError, InternalAxiosRequestConfig } from 'axios';

// 定义API响应的通用格式
export interface ApiResponse<T = any> {
  data: T;
  error_code: number;
  success: boolean;
  error_message: string;
}

// 创建axios实例
const instance = axios.create({
  baseURL: 'http://localhost:5000',
  timeout: 50000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
instance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 在这里可以添加全局的请求处理，例如添加token等
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
instance.interceptors.response.use(
  (response: AxiosResponse) => {
    // 直接返回响应数据
    return response;
  },
  (error: AxiosError) => {
    // 处理错误响应
    if (error.response) {
      // 服务器返回了错误状态码
      console.error('请求错误:', error.response.status, error.response.data);
    } else if (error.request) {
      // 请求已发送但没有收到响应
      console.error('网络错误:', error.message);
    } else {
      // 请求配置出错
      console.error('请求配置错误:', error.message);
    }
    return Promise.reject(error);
  }
);

export default instance;
