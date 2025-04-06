import { useState } from 'react'
import { Input, Button, List, Typography, Spin, Alert, Empty, Layout, Space } from 'antd'
import { SearchOutlined, LoadingOutlined } from '@ant-design/icons'
import { searchNews, SearchResult } from './requests'
import './styles/App.less'
import { formatDate, formatSuggestionToMarkdown } from './utils'
import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import rehypeRaw from 'rehype-raw'

const { Title, Paragraph, Text } = Typography
const { Header, Content, Footer } = Layout

function App() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [hasResults, setHasResults] = useState(true)
  const [suggestion, setSuggestion] = useState('')
  const [error, setError] = useState('')

  const handleSearch = async () => {
    if (!query.trim()) return

    setLoading(true)
    setError('')
    
    try {
      const data = await searchNews(query)
      
      setResults(data.results || [])
      setHasResults(data.has_relevant_results)
      setSuggestion(data.suggestions || '')
      
    } catch (err) {
      console.error('搜索出错:', err)
      setError('搜索服务暂时不可用，请稍后再试')
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  return (
    <Layout className="app-container">
      <Header className="app-header">
        <Title level={3} style={{ color: 'white', margin: 0 }}>
          DuckDuckGo 新闻搜索
        </Title>
      </Header>
      
      <Content className="app-content">
        <div className="search-container">
          <Space.Compact style={{ width: '100%' }}>
            <Input 
              placeholder="输入搜索内容..." 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              size="large"
            />
            <Button 
              type="primary" 
              icon={loading ? <LoadingOutlined /> : <SearchOutlined />} 
              onClick={handleSearch}
              disabled={loading || !query.trim()}
              size="large"
            >
              搜索
            </Button>
          </Space.Compact>
          
          <Paragraph className="search-tip">
            输入你想搜索的新闻主题，AI将帮助优化搜索并返回最相关的结果
          </Paragraph>
        </div>

        {error && (
          <Alert
            message="错误"
            description={error}
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {loading ? (
          <div className="loading-container">
            <Spin size="large" />
            <Paragraph>AI正在搜索相关新闻...</Paragraph>
          </div>
        ) : (
          <>
            {results.length > 0 ? (
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
                              <Text type={item.relevance_score > 7 ? 'success' : item.relevance_score > 4 ? 'warning' : 'danger'}>
                                {item.relevance_score}/10
                              </Text>
                            </Text>
                          )}
                          <div>{item.relevance_reason}</div>
                        </Paragraph>
                      </div>
                    )}
                  </List.Item>
                )}
              />
            ) : (
              !loading && query && (
                <Empty 
                  description={
                    <Space direction="vertical" align="center">
                      <Text>没有找到相关结果</Text>
                      {!hasResults && suggestion && (
                        <div className="markdown-suggestion">
                          <ReactMarkdown
                            rehypePlugins={[rehypeSanitize, rehypeRaw]}
                          >
                            {formatSuggestionToMarkdown(suggestion)}
                          </ReactMarkdown>
                        </div>
                      )}
                    </Space>
                  }
                />
              )
            )}
          </>
        )}
      </Content>
      
      <Footer className="app-footer">
        <Text type="secondary">DuckDuckGo 新闻搜索 {new Date().getFullYear()} 由 AI 驱动</Text>
      </Footer>
    </Layout>
  )
}

export default App
