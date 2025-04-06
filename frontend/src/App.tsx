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
        <Text type="secondary">DuckDuckGo News Search {new Date().getFullYear()} Powered by AI</Text>
      </Footer>
    </Layout>
  )
}

export default App