import axios from './config';

// Message interface
export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// Conversation interface
export interface Conversation {
  session_id: string;
  messages: Message[];
}

// Search request interface
export interface SearchRequest {
  query: string;
  session_id?: string;
}

// Search result interface
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

// Search response interface
export interface SearchResponse {
  original_query: string;
  generated_query?: string;
  results: SearchResult[];
  has_relevant_results: boolean;
  suggestions?: string;
  conversation?: Conversation;
}

// API response interface
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error_code: number;
  error_message: string;
}

/**
 * Search for news
 * @param query Search keyword
 * @param sessionId Session ID, if not provided a new session will be created
 * @returns Search results
 */
export const searchNews = async (query: string, sessionId?: string): Promise<SearchResponse> => {
  try {
    const response = await axios.post<ApiResponse<SearchResponse>>('/api/search', {
      query,
      session_id: sessionId
    });
    
    if (!response.data.success) {
      throw new Error(response.data.error_message || 'Search failed');
    }
    
    return response.data.data;
  } catch (error) {
    console.error('Error searching news:', error);
    throw error;
  }
};

/**
 * Get conversation history
 * @param sessionId Session ID
 * @returns Conversation history
 */
export const getConversation = async (sessionId: string): Promise<Conversation> => {
  try {
    const response = await axios.get<ApiResponse<{conversation: Conversation}>>(`/api/conversation/${sessionId}`);
    
    if (!response.data.success) {
      throw new Error(response.data.error_message || 'Failed to get conversation history');
    }
    
    return response.data.data.conversation;
  } catch (error) {
    console.error('Error getting conversation history:', error);
    throw error;
  }
};

/**
 * Clear conversation history
 * @param sessionId Session ID
 * @returns Success message
 */
export const clearConversation = async (sessionId: string): Promise<{message: string}> => {
  try {
    const response = await axios.delete<ApiResponse<{message: string}>>(`/api/conversation/${sessionId}`);
    
    if (!response.data.success) {
      throw new Error(response.data.error_message || 'Failed to clear conversation history');
    }
    
    return response.data.data;
  } catch (error) {
    console.error('Error clearing conversation history:', error);
    throw error;
  }
};
