import os
from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Import Groq
from langchain_groq import ChatGroq

# Keep Google ONLY for embeddings (since it works)
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from supabase.client import create_client, Client

# 1. Load Keys
load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not GROQ_API_KEY:
    print("❌ CRITICAL ERROR: GROQ_API_KEY is missing!")

app = FastAPI()

# 2. Setup Security
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Setup AI
# SWAPPED: Using Groq Llama3 for the Chat (Super fast & Free)
llm = ChatGroq(
    model="llama-3.1-8b-instant",
    api_key=GROQ_API_KEY
)

# KEEPING: Google for Embeddings (This part was working fine in your logs)
embeddings = GoogleGenerativeAIEmbeddings(
    model="models/text-embedding-004",
    google_api_key=GOOGLE_API_KEY
)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

class ChatRequest(BaseModel):
    question: str

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    print(f"📩 Question: {request.question}")
    
    try:
        # STEP 1: Embed Question (Google)
        print("   1. Converting question to numbers...")
        query_vector = embeddings.embed_query(request.question)

        # STEP 2: Search DB (Supabase)
        print("   2. Searching Supabase...")
        response = supabase.rpc("match_documents", {
            "query_embedding": query_vector,
            "match_threshold": 0.3, 
            "match_count": 5
        }).execute()

        matches = response.data
        if not matches:
            return {"answer": "I couldn't find any relevant information in the documents."}
        
        context_text = "\n\n".join([item['content'] for item in matches])
        print(f"   3. Found {len(matches)} relevant pages.")

        # STEP 3: Generate Answer (Groq)
        print("   4. Asking Groq (Llama 3)...")
        prompt = f"""
        You are a helpful university assistant.
        Answer the question based ONLY on the following context.
        
        <context>
        {context_text}
        </context>

        Question: {request.question}
        """
        
        ai_response = llm.invoke(prompt)
        print(f"🤖 Answer: {ai_response.content}")
        
        return {"answer": ai_response.content}

    except Exception as e:
        print("**************************************************")
        print(f"❌ ERROR: {e}")
        print("**************************************************")
        return {"answer": "Sorry, I encountered an error."}