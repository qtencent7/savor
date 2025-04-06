import axios from './config';

// 消息接口
export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// 对话接口
export interface Conversation {
  session_id: string;
  messages: Message[];
}

// 搜索请求接口
export interface SearchRequest {
  query: string;
  session_id?: string;
}

// 搜索结果接口
export interface SearchResult {
  title: string;
  url: string;
  body: string;
  source: string;
  image?: string;
  date?: string;
  relevance_score?: number;
  relevance_reason?: string;
}

// 搜索响应接口
export interface SearchResponse {
  original_query: string;
  generated_query?: string;
  results: SearchResult[];
  has_relevant_results: boolean;
  suggestions?: string;
  conversation?: Conversation;
}

// API响应接口
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error_code: number;
  error_message: string;
}

/**
 * 搜索新闻
 * @param query 搜索关键词
 * @param sessionId 会话ID，如果不提供则创建新会话
 * @returns 搜索结果
 */
export const searchNews = async (query: string, sessionId?: string): Promise<SearchResponse> => {
  try {
    const response = await axios.post<ApiResponse<SearchResponse>>('/api/search', {
      query,
      session_id: sessionId
    });
    
    if (!response.data.success) {
      throw new Error(response.data.error_message || '搜索失败');
    }
    
    return response.data.data;
  } catch (error) {
    console.error('搜索新闻出错:', error);
    throw error;
  }
};

/**
 * 获取对话历史
 * @param sessionId 会话ID
 * @returns 对话历史
 */
export const getConversation = async (sessionId: string): Promise<Conversation> => {
  try {
    const response = await axios.get<ApiResponse<{conversation: Conversation}>>(`/api/conversation/${sessionId}`);
    
    if (!response.data.success) {
      throw new Error(response.data.error_message || '获取对话历史失败');
    }
    
    return response.data.data.conversation;
  } catch (error) {
    console.error('获取对话历史出错:', error);
    throw error;
  }
};

/**
 * 清除对话历史
 * @param sessionId 会话ID
 * @returns 成功消息
 */
export const clearConversation = async (sessionId: string): Promise<{message: string}> => {
  try {
    const response = await axios.delete<ApiResponse<{message: string}>>(`/api/conversation/${sessionId}`);
    
    if (!response.data.success) {
      throw new Error(response.data.error_message || '清除对话历史失败');
    }
    
    return response.data.data;
  } catch (error) {
    console.error('清除对话历史出错:', error);
    throw error;
  }
};
