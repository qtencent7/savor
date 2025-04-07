import React, { useState, useEffect, useRef } from 'react';
import { Input, Button, Typography, Layout, Tooltip, message, List, Space, Empty } from 'antd';
import { SendOutlined, DeleteOutlined } from '@ant-design/icons';
import { searchNews, Message, clearConversation, SearchResult } from '../requests';
import { generateId, formatDate } from '../utils';
import '../styles/Chat.less';

const { Text, Paragraph } = Typography;
const { Header, Content, Footer } = Layout;

// Message type definition
interface ChatMessage extends Message {
  id: string; // Local message ID
  results?: SearchResult[]; // Search results
  has_relevant_results?: boolean; // Whether there are relevant results
  generated_query?: string; // Generated search query
}

const Chat: React.FC = () => {
  // States
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<any>(null);
  
  // Initialize welcome message
  useEffect(() => {
    const welcomeMessage: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: 'Hello! I am your news assistant. Please tell me what news you would like to know about?',
      timestamp: new Date().toISOString()
    };
    setMessages([]);
  }, []);
  
  // Scroll to latest message
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  // Send message
  const handleSendMessage = async () => {
    if (!input.trim()) return;
    
    // Add user message
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
      // Call search API
      const response = await searchNews(input, sessionId);
      
      // Save session ID
      if (response.conversation?.session_id) {
        setSessionId(response.conversation.session_id);
      }
      
      // Get the latest assistant message
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
      console.error('Error sending message:', err);
      setError('Message sending failed, please try again later');
      
      // Add error message
      const errorMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: 'Sorry, I encountered some problems and cannot process your request. Please try again later.',
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      // Focus input field
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };
  
  // Handle key press event
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  // Clear conversation
  const handleClearChat = async () => {
    if (sessionId) {
      try {
        await clearConversation(sessionId);
        message.success('Conversation cleared');
        
        // Reset session
        setSessionId(undefined);
        
        // Reset messages with a new welcome message
        const welcomeMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: 'Hello! I am your news assistant. Please tell me what news you would like to know about?',
          timestamp: new Date().toISOString()
        };
        setMessages([welcomeMessage]);
      } catch (err) {
        console.error('Error clearing conversation:', err);
        message.error('Failed to clear conversation');
      }
    } else {
      // If no session ID, just reset the UI
      const welcomeMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: 'Hello! I am your news assistant. Please tell me what news you would like to know about?',
        timestamp: new Date().toISOString()
      };
      setMessages([welcomeMessage]);
    }
  };
  
  // Format time
  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };
  
  // Render search results
  const renderSearchResults = (results: SearchResult[], hasRelevantResults: boolean) => {
    if (!results.length) {
      return (
        <Empty description="No relevant results found" />
      );
    }
    
    if (!hasRelevantResults) {
      return (
        <div className="no-relevant-results">
          <Text>No highly relevant results found. You might want to try different search terms.</Text>
        </div>
      );
    }
    
    return (
      <List
        itemLayout="vertical"
        dataSource={results}
        renderItem={(item, index) => (
          <List.Item key={index}>
            <List.Item.Meta
              title={
                <a href={item.url} target="_blank" rel="noopener noreferrer">
                  {item.title}
                </a>
              }
              description={
                <Space direction="vertical" size={0}>
                  <Text type="secondary">
                    Source: {item.source}
                    {item.date && ` • ${item.date}`}
                  </Text>
                </Space>
              }
            />
            <div className="result-content">
              <Paragraph ellipsis={{ rows: 3, expandable: true, symbol: 'more' }}>
                {item.body}
              </Paragraph>
              
              {item.relevance_score !== undefined && (
                <div className="result-relevance">
                  <Text type="secondary">
                    Relevance: 
                    <Text 
                      type="secondary" 
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
                  <div><span>Recommendation reason: </span>{item.relevance_reason}</div>
                </div>
              )}
            </div>
          </List.Item>
        )}
      />
    );
  };
  
  return (
    <Layout className="chat-container">
      <Header className="chat-header">
        <h3>News Assistant</h3>
        <div className="header-actions">
          <Tooltip title="Clear conversation">
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
                      <Text>Found {message.results.length} related information</Text>
                      {message.generated_query && (
                        <div className="generated-query">
                          <Text type="secondary">Search query: <Text strong style={{color: '#2E8B57'}}>{message.generated_query}</Text></Text>
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
                          <Text type="secondary">Search query: <Text strong>{message.generated_query}</Text></Text>
                        </div>
                      )}
                      <Text>Sorry, no related information found</Text>
                    </>
                  )}
                </>
              )}
            </div>
            <div className="message-meta">
              <span>{message.role === 'user' ? 'You' : 'Assistant'}</span>
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
            onPressEnter={handleKeyPress}
            placeholder="Enter the news you want to know about..."
            autoSize={{ minRows: 1, maxRows: 4 }}
            disabled={loading}
          />
          <Button
            style={{backgroundColor: '#3d5af1'}}
            type="primary"
            icon={<SendOutlined color={!input.trim() || loading ? 'rgba(255, 0, 0, 0.5)' : '#fff'}/>}
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
