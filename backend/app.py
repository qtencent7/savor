import duckduckgo_search
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import os
import json
from duckduckgo_search import DDGS
import openai
from dotenv import load_dotenv
import uuid
from datetime import datetime

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
openai_api_key = os.getenv("OPENAI_API_KEY", "")
deepseek_api_key = os.getenv("DEEPSEEK_API_KEY", "")

# 设置API密钥
if deepseek_api_key:
    openai.base_url = "https://api.deepseek.com"
    openai.api_key = deepseek_api_key
    print(f"使用 DeepSeek API 密钥")
else:
    openai.api_key = openai_api_key
    print(f"使用 OpenAI API 密钥")

# 对话历史存储
# 使用字典存储对话历史，键为会话ID，值为消息列表
conversation_history = {}

# 模型定义
class SearchQuery(BaseModel):
    query: str
    session_id: Optional[str] = None  # 新增会话ID字段

class Message(BaseModel):
    role: str  # 'user' 或 'assistant'
    content: str
    timestamp: datetime

class Conversation(BaseModel):
    session_id: str
    messages: List[Message]

class NewsResult(BaseModel):
    title: str
    url: str
    body: str
    source: str
    image: Optional[str] = None
    date: Optional[str] = None
    relevance_score: Optional[int] = None
    relevance_reason: Optional[str] = None

class SearchResponse(BaseModel):
    original_query: str
    generated_query: Optional[str] = None
    results: List[NewsResult]
    has_relevant_results: bool
    suggestions: Optional[str] = None
    conversation: Optional[Conversation] = None  # 新增对话历史

class ApiResponse(BaseModel):
    data: Any
    success: bool = True
    error_code: int = 0
    error_message: str = ""

# 辅助函数
def generate_search_query(user_input: str, session_id: Optional[str] = None) -> str:
    """使用 DeepSeek 生成搜索查询，考虑对话历史"""
    try:
        messages = [
            {"role": "system", "content": "你是一个帮助用户生成精确搜索查询的助手。根据用户的输入和对话历史，生成一个简洁、精确的搜索查询，以便在搜索引擎上获得最相关的新闻结果。"}
        ]
        
        # 如果有会话ID，添加对话历史
        if session_id and session_id in conversation_history:
            # 只取最近的5条消息作为上下文
            recent_messages = conversation_history[session_id][-5:]
            for msg in recent_messages:
                messages.append({"role": msg.role, "content": msg.content})
        
        # 添加当前用户输入
        messages.append({"role": "user", "content": f"为以下内容生成一个搜索查询，用于查找相关新闻：{user_input}，里面不要添加时间，除非用户的搜索词里面有时间。"})
        
        response = openai.chat.completions.create(
            model="deepseek-chat",
            messages=messages,
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

def analyze_search_results(query: str, results: List[Dict[str, Any]], session_id: Optional[str] = None) -> Dict[str, Any]:
    """使用 DeepSeek 分析搜索结果的相关性，考虑对话历史"""
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
        
        # 准备消息列表
        messages = [
            {"role": "system", "content": "你是一个帮助分析搜索结果相关性的助手。评估搜索结果与查询的相关性，并提供改进建议。对于每个相关的结果，请提供具体的相关性理由。"}
        ]
        
        # 如果有会话ID，添加对话历史
        if session_id and session_id in conversation_history:
            # 只取最近的3条消息作为上下文
            recent_messages = conversation_history[session_id][-3:]
            for msg in recent_messages:
                messages.append({"role": msg.role, "content": msg.content})
        
        # 添加当前查询和结果
        messages.append({"role": "user", "content": f"""查询: {query}

搜索结果:
{results_text}

请分析这些结果与查询的相关性，并以JSON格式返回分析结果，格式如下:
{{
  "has_relevant": true或false,
  "analysis": "总体分析",
  "result_analysis": [
    {{
      "index": 0,
      "relevance_score": 1-10的分数,
      "relevance_reason": "这条结果与查询相关的具体理由"
    }},
    ...
  ],
  "suggestions": "如果结果不相关，提供改进建议"
}}
"""})
        
        # 使用 DeepSeek 分析结果
        response = openai.chat.completions.create(
            model="deepseek-chat",
            messages=messages,
            max_tokens=800
        )
        
        analysis_text = response.choices[0].message.content.strip()
        
        # 尝试解析JSON响应
        try:
            import json
            import re
            
            # 尝试从文本中提取JSON部分
            json_match = re.search(r'({[\s\S]*})', analysis_text)
            if json_match:
                analysis_json = json.loads(json_match.group(1))
            else:
                # 如果无法提取，尝试直接解析
                analysis_json = json.loads(analysis_text)
            
            # 获取相关性分析结果
            has_relevant = analysis_json.get("has_relevant", False)
            analysis = analysis_json.get("analysis", "")
            result_analysis = analysis_json.get("result_analysis", [])
            suggestions = analysis_json.get("suggestions", "")
            
            # 为每个结果添加相关性理由
            relevant_results = []
            for i, result in enumerate(results):
                if i < len(result_analysis):
                    # 找到对应的分析结果
                    for analysis_item in result_analysis:
                        if analysis_item.get("index") == i:
                            # 获取相关性得分
                            relevance_score = analysis_item.get("relevance_score", 0)
                            
                            # 只添加得分高于7分的结果
                            if relevance_score > 7:
                                # 复制原始结果并添加相关性信息
                                result_with_relevance = result.copy()
                                result_with_relevance["relevance_score"] = relevance_score
                                result_with_relevance["relevance_reason"] = analysis_item.get("relevance_reason", "")
                                relevant_results.append(result_with_relevance)
                            break
                    else:
                        # 如果没有找到对应的分析，不添加该结果
                        pass
                else:
                    # 如果分析结果不足，不添加该结果
                    pass
            
            # 如果没有相关结果，返回空列表
            if not has_relevant:
                relevant_results = []
            
            return {
                "relevant_results": relevant_results,
                "has_relevant": has_relevant,
                "analysis": analysis,
                "suggestions": suggestions if not has_relevant else None
            }
            
        except json.JSONDecodeError as e:
            print(f"JSON解析错误: {e}")
            # 回退到简单的文本分析
            has_relevant = "不相关" not in analysis_text.lower() and "没有相关" not in analysis_text.lower()
            relevant_results = results if has_relevant else []
            
            return {
                "relevant_results": relevant_results,
                "has_relevant": has_relevant,
                "analysis": analysis_text,
                "suggestions": analysis_text if not has_relevant else None
            }
            
    except Exception as e:
        print(f"分析搜索结果时出错: {e}")
        return {
            "relevant_results": results,
            "has_relevant": True,  # 默认假设结果相关
            "suggestions": None
        }

def generate_response_message(query: str, analysis: Dict[str, Any]) -> str:
    """生成助手的回复消息"""
    try:
        # 如果没有相关结果
        if not analysis["has_relevant"] or not analysis["relevant_results"]:
            if analysis.get("suggestions"):
                return analysis["suggestions"]
            else:
                return f"我没有找到与'{query}'相关的新闻。请尝试使用其他关键词。"
        
        # 如果有相关结果
        results = analysis["relevant_results"]
        response = f"我找到了{len(results)}条与'{query}'相关的新闻：\n\n"
        
        for i, result in enumerate(results):
            response += f"{i+1}. **{result.get('title', 'N/A')}**\n"
            response += f"   来源: {result.get('source', 'N/A')}"
            if result.get('date'):
                from datetime import datetime
                try:
                    date = datetime.fromisoformat(result['date'].replace('Z', '+00:00'))
                    response += f" | {date.strftime('%Y-%m-%d')}"
                except:
                    response += f" | {result['date']}"
            response += "\n"
            response += f"   {result.get('body', 'N/A')[:150]}...\n"
            response += f"   [阅读全文]({result.get('url', '#')})\n\n"
            
            if result.get("relevance_reason"):
                response += f"   *相关性: {result.get('relevance_reason')}*\n\n"
        
        response += "您还想了解什么相关信息？"
        return response
        
    except Exception as e:
        print(f"生成回复消息时出错: {e}")
        return f"我找到了一些与'{query}'相关的新闻，但在处理结果时遇到了问题。请再次尝试或更改您的查询。"

# API端点
@app.post("/api/search", response_model=ApiResponse)
async def search(query: SearchQuery):
    try:
        # 处理会话ID
        session_id = query.session_id
        if not session_id:
            # 如果没有提供会话ID，创建一个新的
            session_id = str(uuid.uuid4())
        
        # 确保会话历史存在
        if session_id not in conversation_history:
            conversation_history[session_id] = []
        
        # 添加用户消息到对话历史
        user_message = Message(
            role="user",
            content=query.query,
            timestamp=datetime.now()
        )
        conversation_history[session_id].append(user_message)
        
        # 生成搜索查询
        generated_query = generate_search_query(query.query, session_id)
        print(f"原始查询: {query.query}")
        print(f"生成的查询: {generated_query}")
        
        # 搜索新闻
        search_results = search_duckduckgo(generated_query)
        
        # 分析搜索结果
        analysis = analyze_search_results(query.query, search_results, session_id)
        
        # 生成助手回复
        assistant_response = generate_response_message(query.query, analysis)
        
        # 添加助手消息到对话历史
        assistant_message = Message(
            role="assistant",
            content=assistant_response,
            timestamp=datetime.now()
        )
        conversation_history[session_id].append(assistant_message)
        
        # 创建当前对话
        current_conversation = Conversation(
            session_id=session_id,
            messages=conversation_history[session_id]
        )
        
        # 准备响应数据
        response_data = SearchResponse(
            original_query=query.query,
            generated_query=generated_query,
            results=[
                NewsResult(
                    title=result.get("title", ""),
                    url=result.get("url", ""),
                    body=result.get("body", ""),
                    source=result.get("source", ""),
                    image=result.get("image", None),
                    date=result.get("date", None),
                    relevance_score=result.get("relevance_score", None),
                    relevance_reason=result.get("relevance_reason", None)
                ) for result in analysis["relevant_results"]
            ],
            has_relevant_results=analysis["has_relevant"],
            suggestions=analysis.get("suggestions"),
            conversation=current_conversation
        )
        
        return ApiResponse(
            data=response_data.dict(),
            success=True,
            error_code=0,
            error_message=""
        )
    
    except Exception as e:
        print(f"处理搜索请求时出错: {e}")
        return ApiResponse(
            data=None,
            success=False,
            error_code=500,
            error_message=f"服务器错误: {str(e)}"
        )

# 获取对话历史的端点
@app.get("/api/conversation/{session_id}", response_model=ApiResponse)
async def get_conversation(session_id: str):
    if session_id not in conversation_history:
        return ApiResponse(
            data={"conversation": None},
            success=False,
            error_code=404,
            error_message="会话不存在"
        )
    
    current_conversation = Conversation(
        session_id=session_id,
        messages=conversation_history[session_id]
    )
    
    return ApiResponse(
        data={"conversation": current_conversation},
        success=True,
        error_code=0,
        error_message=""
    )

# 清除对话历史的端点
@app.delete("/api/conversation/{session_id}", response_model=ApiResponse)
async def clear_conversation(session_id: str):
    if session_id in conversation_history:
        del conversation_history[session_id]
    
    return ApiResponse(
        data={"message": "会话已清除"},
        success=True,
        error_code=0,
        error_message=""
    )

# 添加根路由，提供API信息
@app.get("/")
async def root():
    return {"message": "欢迎使用DuckDuckGo新闻搜索API", "version": "1.0.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=5000, reload=True)
