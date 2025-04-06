# DuckDuckGo 新闻搜索 Agent

这是一个使用DuckDuckGo搜索新闻的智能应用，前端采用React，后端采用Python。应用流程如下：

1. 用户输入搜索主题
2. AI生成优化的搜索查询
3. 系统使用DuckDuckGo搜索相关新闻
4. AI分析搜索结果，返回最相关的内容
5. 如果没有找到相关结果，系统会提示用户缩小搜索范围并给出建议

## 项目结构

```
savor/
├── backend/             # Python后端
│   ├── app.py           # Flask应用主文件
│   ├── requirements.txt # 依赖项
│   └── .env.example     # 环境变量示例文件
└── frontend/            # React前端
    ├── src/             # 源代码
    ├── public/          # 静态资源
    └── package.json     # 依赖配置
```

## 安装与运行

### 后端设置

1. 进入后端目录：
   ```
   cd backend
   ```

2. 创建并激活虚拟环境（可选但推荐）：
   ```
   python -m venv venv
   # Windows
   venv\Scripts\activate
   # Linux/Mac
   source venv/bin/activate
   ```

3. 安装依赖：
   ```
   pip install -r requirements.txt
   ```

4. 创建环境变量文件：
   ```
   # 复制示例文件
   copy .env.example .env
   # 编辑.env文件，添加你的OpenAI API密钥
   ```

5. 运行后端服务：
   ```
   python app.py
   ```

### 前端设置

1. 进入前端目录：
   ```
   cd frontend
   ```

2. 安装依赖：
   ```
   yarn
   ```

3. 启动开发服务器：
   ```
   yarn dev
   ```

4. 在浏览器中访问应用：
   ```
   http://localhost:5173
   ```

## 使用说明

1. 在搜索框中输入你想了解的新闻主题
2. 点击"搜索"按钮或按Enter键
3. 等待AI处理并返回结果
4. 查看搜索结果列表
5. 如果没有找到相关结果，系统会提供改进搜索的建议

## 技术栈

- 前端：React、TypeScript、Vite、Ant Design
- 后端：Python、Flask、DuckDuckGo Search API、OpenAI API

## 注意事项

- 使用前需要设置有效的OpenAI API密钥
- 确保网络连接正常，以便访问DuckDuckGo和OpenAI服务
- 搜索结果质量取决于搜索查询的具体内容和DuckDuckGo的搜索结果
