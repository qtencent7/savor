import axios from './config';
import { ApiResponse } from './config';

// 搜索结果接口
export interface SearchResult {
  title: string;
  url: string;
  body: string;
  source: string;
  image?: string;
  date?: string;
}

// 搜索响应接口
export interface SearchResponse {
  original_query: string;
  search_query: string;
  results: SearchResult[];
  has_relevant_results: boolean;
  suggestions: string | null;
}

// 搜索API
export const searchNews = async (query: string): Promise<SearchResponse> => {
  try {
    const response = await axios.post<ApiResponse<SearchResponse>>('/api/search', { query });
    
    // FastAPI返回的响应已经符合我们的标准格式
    const apiResponse = response.data;
    
    if (!apiResponse.success) {
      throw new Error(apiResponse.error_message || '搜索失败');
    }
    
    return apiResponse.data;
  } catch (error) {
    console.error('搜索新闻失败:', error);
    throw error;
  }
};

// 可以在这里添加更多API请求函数
