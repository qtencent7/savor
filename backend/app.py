import duckduckgo_search
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import json
from duckduckgo_search import DDGS
import openai
from dotenv import load_dotenv

print(f"DuckDuckGo Search version: {duckduckgo_search.__version__}")

# 加载环境变量
load_dotenv()

# 初始化 FastAPI 应用
app = FastAPI(title="DuckDuckGo 新闻搜索 API", description="使用DuckDuckGo搜索新闻的API")

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许所有来源，生产环境中应该限制为特定域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 配置 OpenAI API
openai.api_key = os.getenv("DEEPSEEK_API_KEY")
openai.base_url = "https://api.deepseek.com"

# 定义请求和响应模型
class SearchQuery(BaseModel):
    query: str

class SearchResult(BaseModel):
    title: str
    url: str
    body: str
    source: str
    image: Optional[str] = None
    date: Optional[str] = None

class SearchResponse(BaseModel):
    original_query: str
    search_query: str
    results: List[SearchResult]
    has_relevant_results: bool
    suggestions: Optional[str] = None

class ApiResponse(BaseModel):
    data: Any
    error_code: int = 0
    success: bool = True
    error_message: str = ""

def generate_search_query(user_input: str) -> str:
    """使用 OpenAI 生成搜索查询"""
    try:
        response = openai.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": "你是一个帮助用户生成精确搜索查询的助手。根据用户的输入，生成一个简洁、精确的搜索查询，以便在搜索引擎上获得最相关的新闻结果。"},
                {"role": "user", "content": f"为以下内容生成一个搜索查询，用于查找相关新闻：{user_input}，里面不要添加时间，除非用户的搜索词里面有时间。"}
            ],
            max_tokens=100
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"生成搜索查询时出错: {e}")
        return user_input

def search_duckduckgo(query: str, max_results: int = 5) -> List[Dict[str, Any]]:
    """使用 DuckDuckGo 搜索新闻"""
    try:
        with DDGS() as ddgs:
            results = list(ddgs.news(query, max_results=max_results))
            return results
    except Exception as e:
        print(f"搜索 DuckDuckGo 时出错: {e}")
        return []

def analyze_search_results(query: str, results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """使用 DeepSeek 分析搜索结果的相关性"""
    if not results:
        return {
            "relevant_results": [],
            "has_relevant": False,
            "suggestions": f"没有找到与'{query}'相关的新闻。请尝试使用更具体的关键词，或者考虑更改搜索主题。"
        }
    
    try:
        # 准备搜索结果摘要
        results_text = ""
        for i, result in enumerate(results):
            results_text += f"{i+1}. 标题: {result.get('title', 'N/A')}\n"
            results_text += f"   来源: {result.get('source', 'N/A')}\n"
            results_text += f"   摘要: {result.get('body', 'N/A')}\n\n"
        
        # 使用 OpenAI 分析结果
        response = openai.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": "你是一个帮助分析搜索结果相关性的助手。评估搜索结果与查询的相关性，并提供改进建议。"},
                {"role": "user", "content": f"查询: {query}\n\n搜索结果:\n{results_text}\n\n这些结果与查询相关吗？如果相关，哪些是最相关的？如果不相关，请提供改进搜索查询的建议。"}
            ],
            max_tokens=300
        )
        
        analysis = response.choices[0].message.content.strip()
        
        # 判断是否有相关结果
        has_relevant = "不相关" not in analysis.lower() and "没有相关" not in analysis.lower()
        
        # 提取最相关的结果
        relevant_results = results if has_relevant else []
        
        return {
            "relevant_results": relevant_results,
            "has_relevant": has_relevant,
            "analysis": analysis,
            "suggestions": analysis if not has_relevant else None
        }
    except Exception as e:
        print(f"分析搜索结果时出错: {e}")
        return {
            "relevant_results": results,
            "has_relevant": True,  # 默认假设结果相关
            "suggestions": None
        }

@app.post("/api/search", response_model=ApiResponse)
async def search(query: SearchQuery):
    try:
        user_input = query.query
        
        if not user_input:
            raise HTTPException(status_code=400, detail="请提供搜索查询")
        
        # 生成搜索查询
        search_query = generate_search_query(user_input)

        print(f"搜索查询: {search_query}")
        
        # 搜索新闻
        search_results = search_duckduckgo(search_query)
        
        # 分析结果
        analysis = analyze_search_results(search_query, search_results)
        
        # 构建响应
        response_data = SearchResponse(
            original_query=user_input,
            search_query=search_query,
            results=[
                SearchResult(
                    title=result.get("title", ""),
                    url=result.get("url", ""),
                    body=result.get("body", ""),
                    source=result.get("source", ""),
                    image=result.get("image", None),
                    date=result.get("date", None)
                ) for result in analysis["relevant_results"]
            ],
            has_relevant_results=analysis["has_relevant"],
            suggestions=analysis["suggestions"]
        )
        
        return ApiResponse(
            data=response_data.dict(),
            success=True,
            error_code=0,
            error_message=""
        )
        
    except Exception as e:
        return ApiResponse(
            data=None,
            success=False,
            error_code=500,
            error_message=f"搜索处理出错: {str(e)}"
        )

# 添加根路由，提供API信息
@app.get("/")
async def root():
    return {"message": "欢迎使用DuckDuckGo新闻搜索API", "version": "1.0.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=5000, reload=True)
