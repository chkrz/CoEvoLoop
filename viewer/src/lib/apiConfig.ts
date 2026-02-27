// 动态API配置
export interface ApiConfig {
  baseUrl: string;
  timeout: number;
  headers: Record<string, string>;
}

// 动态获取API基础URL的多种方式
export const getApiBaseUrl = (): string => {
  // 优先级1: 环境变量
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  // 优先级2: 运行时配置（window对象）
  if (typeof window !== 'undefined' && (window as any).__API_BASE_URL__) {
    return (window as any).__API_BASE_URL__;
  }

  // 优先级3: 当前域名 + 路径
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const port = window.location.port;
  
  // 开发环境
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `http://${hostname}${port ? ':' + port : ''}/api`;
  }

  // 生产环境
  return `${protocol}//${hostname}${port ? ':' + port : ''}/api`;
};

// 动态获取WebSocket URL
export const getWebSocketUrl = (): string => {
  const baseUrl = getApiBaseUrl();
  return baseUrl.replace(/^http/, 'ws');
};

// 动态获取文件上传URL
export const getUploadUrl = (): string => {
  return `${getApiBaseUrl()}/upload`;
};

// 动态获取文件下载URL
export const getDownloadUrl = (filename: string): string => {
  return `${getApiBaseUrl()}/download/${filename}`;
};

// 运行时配置API
export const configureApi = (config: Partial<ApiConfig>) => {
  if (typeof window !== 'undefined') {
    (window as any).__API_CONFIG__ = {
      ...(window as any).__API_CONFIG__,
      ...config
    };
  }
};

// 获取完整配置
export const getApiConfig = (): ApiConfig => {
  const baseUrl = getApiBaseUrl();
  
  return {
    baseUrl,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }
  };
};

// 环境检测
export const getEnvironment = () => {
  return {
    isDevelopment: import.meta.env.DEV,
    isProduction: import.meta.env.PROD,
    mode: import.meta.env.MODE,
    baseUrl: getApiBaseUrl()
  };
};