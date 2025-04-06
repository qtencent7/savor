import React, { useState, useEffect, useRef } from 'react';
import { Input, Button, Typography, Layout, Tooltip, message, List, Space, Empty } from 'antd';
import { SendOutlined, DeleteOutlined } from '@ant-design/icons';
import { searchNews, Message, clearConversation, SearchResult } from '../requests';
import { generateId, formatDate } from '../utils';
import '../styles/Chat.less';

const { Text, Paragraph } = Typography;
const { Header, Content, Footer } = Layout;

// 消息类型定义
interface ChatMessage extends Message {
  id: string; // 本地消息ID
  results?: SearchResult[]; // 搜索结果
  has_relevant_results?: boolean; // 是否有相关结果
  generated_query?: string; // 生成的搜索查询
}

const Chat: React.FC = () => {
  // 状态
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<any>(null);
  
  // 初始化欢迎消息
  useEffect(() => {
    const welcomeMessage: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: '你好！我是你的新闻助手。请告诉我你想了解什么新闻？',
      timestamp: new Date().toISOString()
    };
    setMessages([welcomeMessage]);
  }, []);
  
  // 滚动到最新消息
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  // 发送消息
  const handleSendMessage = async () => {
    if (!input.trim()) return;
    
    // 添加用户消息
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: input,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setError('');
    
    try {
      // 调用搜索API
      const response = await searchNews(input, sessionId);
      
      // 保存会话ID
      if (response.conversation?.session_id) {
        setSessionId(response.conversation.session_id);
      }
      
      // 获取最新的助手消息
      const newMessages = response.conversation?.messages || [];
      const latestAssistantMessage = newMessages.find(msg => 
        msg.role === 'assistant' && 
        !messages.some(existingMsg => existingMsg.content === msg.content)
      );
      
      if (latestAssistantMessage) {
        const assistantMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: latestAssistantMessage.content,
          timestamp: latestAssistantMessage.timestamp,
          results: response.results || [],
          has_relevant_results: response.has_relevant_results,
          generated_query: response.generated_query
        };
        
        setMessages(prev => [...prev, assistantMessage]);
      }
    } catch (err) {
      console.error('发送消息出错:', err);
      setError('消息发送失败，请稍后再试');
      
      // 添加错误消息
      const errorMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: '抱歉，我遇到了一些问题，无法处理您的请求。请稍后再试。',
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      // 聚焦输入框
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };
  
  // 处理按键事件
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  // 清除对话
  const handleClearChat = async () => {
    if (sessionId) {
      try {
        await clearConversation(sessionId);
        message.success('对话已清除');
      } catch (err) {
        console.error('清除对话出错:', err);
      }
    }
    
    // 重置状态
    setSessionId(undefined);
    
    // 添加新的欢迎消息
    const welcomeMessage: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: '对话已重置。请告诉我你想了解什么新闻？',
      timestamp: new Date().toISOString()
    };
    
    setMessages([welcomeMessage]);
    setInput('');
    setError('');
  };
  
  // 格式化时间
  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };
  
  // 渲染搜索结果
  const renderSearchResults = (results: SearchResult[], hasRelevantResults: boolean) => {
    if (results.length === 0) {
      return (
        <Empty 
          description={
            <Space direction="vertical" align="center">
              <Text>没有找到相关结果</Text>
              {!hasRelevantResults && (
                <div className="no-results-message">
                  <Text type="secondary">
                    抱歉，没有找到与您查询相关的新闻。请尝试使用不同的关键词或更具体的描述。
                  </Text>
                </div>
              )}
            </Space>
          }
        />
      );
    }
    
    return (
      <List
        itemLayout="vertical"
        size="large"
        dataSource={results}
        renderItem={(item) => (
          <List.Item
            key={item.url}
            extra={
              item.image && (
                <img
                  width={272}
                  alt="新闻图片"
                  src={item.image}
                />
              )
            }
          >
            <List.Item.Meta
              title={<a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a>}
              description={
                <Space direction="vertical" size={0}>
                  <Text type="secondary">{item.source}</Text>
                  {item.date && <Text type="secondary" style={{ color: '#999' }}>{formatDate(item.date)}</Text>}
                </Space>
              }
            />
            <Paragraph ellipsis={{ rows: 3 }}>{item.body}</Paragraph>
            {item.relevance_reason && (
              <div className="relevance-reason">
                <Text type="secondary" strong>相关性分析：</Text>
                <Paragraph type="secondary" style={{ margin: 0 }}>
                  {item.relevance_score && (
                    <Text type="secondary">
                      相关度评分：
                      <Text 
                        type={item.relevance_score > 7 ? 'success' : item.relevance_score > 4 ? 'warning' : 'danger'}
                        strong
                        style={{ 
                          fontSize: '16px', 
                          padding: '0 6px',
                          borderRadius: '4px'
                        }}
                      >
                        {item.relevance_score}/10
                      </Text>
                    </Text>
                  )}
                  <div><span>推荐原因：</span>{item.relevance_reason}</div>
                </Paragraph>
              </div>
            )}
          </List.Item>
        )}
      />
    );
  };
  
  return (
    <Layout className="chat-container">
      <Header className="chat-header">
        <h3>新闻助手</h3>
        <div className="header-actions">
          <Tooltip title="清除对话">
            <Button 
              type="text" 
              icon={<DeleteOutlined />} 
              onClick={handleClearChat}
              style={{ color: 'white' }}
            />
          </Tooltip>
        </div>
      </Header>
      
      <Content className="chat-messages">
        {messages.map(message => (
          <div 
            key={message.id} 
            className={`message ${message.role === 'user' ? 'user-message' : 'assistant-message'}`}
          >
            <div className="message-content">
              {message.role === 'user' ? (
                message.content
              ) : (
                <>
                  {message.results && message.results.length > 0 ? (
                    <div className="search-results-intro">
                      <Text>找到了 {message.results.length} 条相关信息</Text>
                      {message.generated_query && (
                        <div className="generated-query">
                          <Text type="secondary">搜索查询：<Text strong>{message.generated_query}</Text></Text>
                        </div>
                      )}
                      <div className="search-results">
                        {renderSearchResults(message.results, message.has_relevant_results || false)}
                      </div>
                    </div>
                  ) : (
                    <>
                      {message.generated_query && (
                        <div className="generated-query">
                          <Text type="secondary">搜索查询：<Text strong>{message.generated_query}</Text></Text>
                        </div>
                      )}
                      <Text>抱歉，没有找到相关信息</Text>
                    </>
                  )}
                </>
              )}
            </div>
            <div className="message-meta">
              <span>{message.role === 'user' ? '你' : '助手'}</span>
              <span className="message-time">{formatTime(message.timestamp)}</span>
            </div>
          </div>
        ))}
        
        {loading && (
          <div className="typing-indicator">
            <div className="dots">
              <div className="dot"></div>
              <div className="dot"></div>
              <div className="dot"></div>
            </div>
          </div>
        )}
        
        {error && <Text type="danger">{error}</Text>}
        
        <div ref={messagesEndRef} />
      </Content>
      
      <Footer className="chat-input">
        <div className="input-container">
          <Input.TextArea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="输入你想了解的新闻..."
            autoSize={{ minRows: 1, maxRows: 4 }}
            disabled={loading}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSendMessage}
            className="send-button"
            disabled={!input.trim() || loading}
          />
        </div>
      </Footer>
    </Layout>
  );
};

export default Chat;
