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
from serpapi import GoogleSearch
import serpapi

print(f"DuckDuckGo Search version: {duckduckgo_search.__version__}")

# Load environment variables
load_dotenv()

# Initialize FastAPI application
app = FastAPI(title="News Search API", description="API for searching news using DuckDuckGo or Google")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins, in production environment should be restricted to specific domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure OpenAI API
openai_api_key = os.getenv("OPENAI_API_KEY", "")
deepseek_api_key = os.getenv("DEEPSEEK_API_KEY", "")
serpapi_api_key = os.getenv("SERPAPI_API_KEY", "")

# Search engine selection ("duckduckgo" or "google")
SEARCH_ENGINE = os.getenv("SEARCH_ENGINE", "duckduckgo")

# Set API key
if deepseek_api_key:
    openai.base_url = "https://api.deepseek.com"
    openai.api_key = deepseek_api_key
    print(f"Using DeepSeek API key")
else:
    openai.api_key = openai_api_key
    print(f"Using OpenAI API key")

print(f"Current search engine: {SEARCH_ENGINE}")

# Conversation history storage
# Use dictionary to store conversation history, key is session ID, value is message list
conversation_history = {}

# Model definitions
class SearchQuery(BaseModel):
    query: str
    session_id: Optional[str] = None  # Added session ID field

class Message(BaseModel):
    role: str  # 'user' or 'assistant'
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
    conversation: Optional[Conversation] = None  # Added conversation history

class ApiResponse(BaseModel):
    data: Any
    success: bool = True
    error_code: int = 0
    error_message: str = ""

# Helper functions
def generate_search_query(user_input: str, session_id: Optional[str] = None) -> str:
    """Use DeepSeek to generate search queries, considering conversation history"""
    try:
        messages = [
            {"role": "system", "content": "You are an assistant that helps users generate precise search queries. Based on the user's input and conversation history, generate a concise, precise search query to get the most relevant news results on search engines."}
        ]
        
        # If there's a session ID, add conversation history
        if session_id and session_id in conversation_history:
            # Only take the last 5 messages as context
            recent_messages = conversation_history[session_id][-5:]
            for msg in recent_messages:
                messages.append({"role": msg.role, "content": msg.content})
        
        # Add current user input
        messages.append({"role": "user", "content": f"Generate a search query for the following content to find relevant news: {user_input}, do not add time unless there is time in the user's search terms."})
        
        response = openai.chat.completions.create(
            model="deepseek-chat",
            messages=messages,
            max_tokens=100
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"Error generating search query: {e}")
        return user_input

def search_duckduckgo(query: str, max_results: int = 5) -> List[Dict[str, Any]]:
    """Use DuckDuckGo to search for news"""
    try:
        with DDGS() as ddgs:
            results = list(ddgs.news(query, max_results=max_results))
            return results
    except Exception as e:
        print(f"Error searching DuckDuckGo: {e}")
        return []

def search_google(query: str, max_results: int = 5) -> List[Dict[str, Any]]:
    """Use Google to search for news"""
    try:
        if not serpapi_api_key:
            print("SerpAPI key not found, falling back to DuckDuckGo")
            return search_duckduckgo(query, max_results)
        
        # Configure Google Search parameters
        params = {
            "q": query,
            "tbm": "nws",  # News search
            "num": max_results,
            "api_key": serpapi_api_key
        }
        
        # Execute the search
        search = GoogleSearch(params)
        results = search.get_dict()
        
        # Process Google search results to match DuckDuckGo format
        formatted_results = []
        if "news_results" in results:
            for item in results["news_results"][:max_results]:
                formatted_result = {
                    "title": item.get("title", ""),
                    "url": item.get("link", ""),
                    "body": item.get("snippet", ""),
                    "source": item.get("source", ""),
                    "date": item.get("date", ""),
                    "image": item.get("thumbnail", None)
                }
                formatted_results.append(formatted_result)
        
        return formatted_results
    except Exception as e:
        print(f"Error searching Google: {e}")
        return search_duckduckgo(query, max_results)  # Fallback to DuckDuckGo

def search_news(query: str, max_results: int = 5) -> List[Dict[str, Any]]:
    """Search for news based on the selected search engine"""
    if SEARCH_ENGINE.lower() == "google":
        return search_google(query, max_results)
    else:
        return search_duckduckgo(query, max_results)

def analyze_search_results(query: str, results: List[Dict[str, Any]], session_id: Optional[str] = None) -> Dict[str, Any]:
    """Use DeepSeek to analyze the relevance of search results, considering conversation history"""
    try:
        if not results:
            return {
                "has_relevant": False,
                "relevant_results": [],
                "suggestions": "Try using different keywords or broaden your search terms."
            }
        
        # Prepare conversation history context
        conversation_context = ""
        if session_id and session_id in conversation_history:
            # Only include the last 5 messages
            recent_messages = conversation_history[session_id][-5:]
            conversation_context = "\n".join([f"{msg.role.capitalize()}: {msg.content}" for msg in recent_messages])
        
        # Prepare search results for analysis
        results_text = ""
        for i, result in enumerate(results):
            results_text += f"Result {i+1}:\n"
            results_text += f"Title: {result.get('title', '')}\n"
            results_text += f"Source: {result.get('source', '')}\n"
            results_text += f"Date: {result.get('date', '')}\n"
            results_text += f"Content: {result.get('body', '')}\n\n"
        
        # Create the prompt for analysis
        system_prompt = """You are an AI assistant that analyzes search results for relevance to a user's query.
For each search result, determine:
1. How relevant it is to the query (score 0-10)
2. Why it is or isn't relevant
3. Whether the overall set of results contains relevant information

If no results are relevant, suggest ways to improve the search query."""

        user_prompt = f"""User Query: {query}

Conversation History:
{conversation_context}

Search Results:
{results_text}

Please analyze these results and provide:
1. For each result: relevance score (0-10) and reason
2. Whether any results are relevant to the query (true/false)
3. If no relevant results, suggestions for improving the search

Format your response as JSON:
{{
  "result_analysis": [
    {{
      "result_index": 0,
      "relevance_score": 8.5,
      "relevance_reason": "Directly addresses the query with recent information"
    }},
    ...
  ],
  "has_relevant": true,
  "suggestions": "If you want more specific information, try..."
}}"""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        
        response = openai.chat.completions.create(
            model="deepseek-chat",
            messages=messages,
            max_tokens=1500
        )
        
        analysis_text = response.choices[0].message.content.strip()
        
        # Extract the JSON part from the response
        try:
            # Find JSON content between curly braces
            json_start = analysis_text.find('{')
            json_end = analysis_text.rfind('}') + 1
            
            if json_start >= 0 and json_end > json_start:
                json_str = analysis_text[json_start:json_end]
                analysis = json.loads(json_str)
            else:
                # Fallback if JSON parsing fails
                analysis = {
                    "result_analysis": [],
                    "has_relevant": len(results) > 0,
                    "suggestions": "Try using different keywords or be more specific."
                }
            
            # Process the analysis to include in the results
            relevant_results = []
            for i, result in enumerate(results):
                result_copy = result.copy()
                
                # Find the analysis for this result
                result_analysis = None
                for analysis_item in analysis.get("result_analysis", []):
                    if analysis_item.get("result_index") == i:
                        result_analysis = analysis_item
                        break
                
                if result_analysis:
                    result_copy["relevance_score"] = result_analysis.get("relevance_score", 0)
                    result_copy["relevance_reason"] = result_analysis.get("relevance_reason", "")
                else:
                    result_copy["relevance_score"] = 0
                    result_copy["relevance_reason"] = "No analysis available"
                
                # Only include results with relevance score > 30
                if result_copy.get("relevance_score", 0) > 30:
                    relevant_results.append(result_copy)
            
            # Sort results by relevance score (descending)
            relevant_results.sort(key=lambda x: x.get("relevance_score", 0), reverse=True)
            
            return {
                "has_relevant": analysis.get("has_relevant", False) and len(relevant_results) > 0,
                "relevant_results": relevant_results,
                "suggestions": analysis.get("suggestions", "")
            }
            
        except Exception as e:
            print(f"Error parsing analysis JSON: {e}")
            print(f"Raw analysis text: {analysis_text}")
            
            # Fallback response
            return {
                "has_relevant": len(results) > 0,
                "relevant_results": results,
                "suggestions": "Try using different keywords or be more specific."
            }
    
    except Exception as e:
        print(f"Error analyzing search results: {e}")
        return {
            "has_relevant": len(results) > 0,
            "relevant_results": results,
            "suggestions": "An error occurred during analysis. Try refining your search."
        }

def generate_response_message(query: str, analysis: Dict[str, Any]) -> str:
    """Generate assistant's response message"""
    try:
        has_relevant = analysis.get("has_relevant", False)
        relevant_results = analysis.get("relevant_results", [])
        suggestions = analysis.get("suggestions", "")
        
        if has_relevant and relevant_results:
            # Format the top results for the response
            top_results = relevant_results[:3]  # Take top 3 results
            results_text = ""
            
            for i, result in enumerate(top_results):
                results_text += f"{i+1}. {result.get('title', '')}\n"
                results_text += f"   Source: {result.get('source', '')}\n"
                if result.get('date'):
                    results_text += f"   Date: {result.get('date', '')}\n"
                results_text += f"   {result.get('body', '')[:150]}...\n\n"
            
            response = f"Here are the most relevant results for your query about '{query}':\n\n{results_text}"
            
            if len(relevant_results) > 3:
                response += f"I found {len(relevant_results)} relevant results in total. These are the top matches.\n"
        else:
            response = f"I couldn't find highly relevant news for '{query}'.\n\n"
            if suggestions:
                response += f"Suggestions to improve your search:\n{suggestions}"
            else:
                response += "Try using different keywords, be more specific, or broaden your search terms."
        
        return response
    
    except Exception as e:
        print(f"Error generating response message: {e}")
        return f"I searched for news about '{query}', but encountered an error processing the results. Please try again with different keywords."

# API endpoints
@app.post("/api/search", response_model=ApiResponse)
async def search(query: SearchQuery):
    try:
        # Generate or use session ID
        session_id = query.session_id
        if not session_id:
            session_id = str(uuid.uuid4())
        
        # Ensure conversation history exists
        if session_id not in conversation_history:
            conversation_history[session_id] = []
        
        # Add user message to conversation history
        user_message = Message(
            role="user",
            content=query.query,
            timestamp=datetime.now()
        )
        conversation_history[session_id].append(user_message)
        
        # Generate search query
        generated_query = generate_search_query(query.query, session_id)
        print(f"Original query: {query.query}")
        print(f"Generated query: {generated_query}")
        
        # Search for news
        search_results = search_news(generated_query)
        
        # Analyze search results
        analysis = analyze_search_results(query.query, search_results, session_id)
        
        # Generate assistant response
        assistant_response = generate_response_message(query.query, analysis)
        
        # Add assistant message to conversation history
        assistant_message = Message(
            role="assistant",
            content=assistant_response,
            timestamp=datetime.now()
        )
        conversation_history[session_id].append(assistant_message)
        
        # Create current conversation
        current_conversation = Conversation(
            session_id=session_id,
            messages=conversation_history[session_id]
        )
        
        # Prepare response data
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
        print(f"Error processing search request: {e}")
        return ApiResponse(
            data=None,
            success=False,
            error_code=500,
            error_message=f"Server error: {str(e)}"
        )

# Endpoint to get conversation history
@app.get("/api/conversation/{session_id}", response_model=ApiResponse)
async def get_conversation(session_id: str):
    if session_id not in conversation_history:
        return ApiResponse(
            data={"conversation": None},
            success=False,
            error_code=404,
            error_message="Session does not exist"
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

# Endpoint to clear conversation history
@app.delete("/api/conversation/{session_id}", response_model=ApiResponse)
async def clear_conversation(session_id: str):
    if session_id in conversation_history:
        del conversation_history[session_id]
    
    return ApiResponse(
        data={"message": "Session cleared"},
        success=True,
        error_code=0,
        error_message=""
    )

# Add root route to provide API information
@app.get("/")
async def root():
    return {"message": "Welcome to the News Search API", "version": "1.0.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=5000, reload=True)
