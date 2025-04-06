import { Layout, Typography } from 'antd'
import './styles/App.less'
import Chat from './components/Chat'

const { Footer } = Layout
const { Text } = Typography

function App() {
  return (
    <Layout className="app-container">
      <Chat />
      <Footer className="app-footer">
        <Text type="secondary">DuckDuckGo 新闻搜索 {new Date().getFullYear()} 由 AI 驱动</Text>
      </Footer>
    </Layout>
  )
}

export default App
