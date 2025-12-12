import os
import shutil
import time
import json
from datetime import datetime
from fastapi import FastAPI, UploadFile, File, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

from langchain_groq import ChatGroq
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import SupabaseVectorStore
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from supabase.client import create_client, Client

load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

app = FastAPI()

# Setup Storage
os.makedirs("uploaded_files", exist_ok=True)
app.mount("/files", StaticFiles(directory="uploaded_files"), name="files")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# AI Models
llm = ChatGroq(model="llama-3.1-8b-instant", api_key=GROQ_API_KEY)
embeddings = GoogleGenerativeAIEmbeddings(model="models/text-embedding-004", google_api_key=GOOGLE_API_KEY)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
vector_store = SupabaseVectorStore(
    client=supabase,
    embedding=embeddings,
    table_name="documents",
    query_name="match_documents",
)

class ChatRequest(BaseModel):
    question: str
    user_id: str  # <--- REQUIRED: To know whose calendar to update

# --- UPLOAD ENDPOINT (UNCHANGED) ---
@app.post("/api/upload")
async def upload_document(file: UploadFile = File(...)):
    try:
        file_path = f"temp_{file.filename}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Permanent Storage
        storage_path = f"chat_uploads/{int(time.time())}_{file.filename}"
        with open(file_path, "rb") as f:
            file_bytes = f.read()
        
        supabase.storage.from_("chat-docs").upload(file=file_bytes, path=storage_path, file_options={"content-type": "application/pdf"})
        public_url = supabase.storage.from_("chat-docs").get_public_url(storage_path)

        loader = PyPDFLoader(file_path)
        docs = loader.load()
        
        for doc in docs:
            doc.metadata["source"] = file.filename
            doc.metadata["url"] = public_url

        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        splits = text_splitter.split_documents(docs)
        vector_store.add_documents(splits)
        os.remove(file_path)

        return {"message": "Learned & Saved!", "filename": file.filename}
    except Exception as e:
        return {"message": f"Error: {str(e)}"}

# --- INTELLIGENT CHAT ENDPOINT ---
@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    try:
        current_time = datetime.now().isoformat()
        
        # STEP 1: Intent Classification
        # We ask the AI to categorize the user's request.
        intent_prompt = f"""
        Current Date/Time: {current_time}
        User Query: "{request.question}"
        
        Analyze the intent.
        
        If the user wants to schedule an event/task/reminder:
        Return ONLY valid JSON:
        {{
            "action": "schedule",
            "title": "Short event title",
            "start_time": "YYYY-MM-DDTHH:MM:SS",
            "end_time": "YYYY-MM-DDTHH:MM:SS" (default to 1 hour duration),
            "is_important": true/false
        }}
        
        If the user is asking a question about documents or general knowledge:
        Return ONLY valid JSON: {{ "action": "qa" }}
        """
        
        raw_response = llm.invoke(intent_prompt).content
        
        # Clean up JSON (sometimes LLM adds markdown backticks)
        json_str = raw_response.strip().replace("```json", "").replace("```", "")
        try:
            intent_data = json.loads(json_str)
        except:
            intent_data = {"action": "qa"} # Fallback to Q&A if parsing fails

        # STEP 2: Execute Logic based on Intent
        
        # --- ACTION: SCHEDULE ---
        if intent_data.get("action") == "schedule":
            title = intent_data["title"]
            start = intent_data["start_time"]
            end = intent_data["end_time"]
            
            # Check Conflicts
            conflict_check = supabase.table("events").select("*").eq("user_id", request.user_id)\
                .gte("end_time", start).lte("start_time", end).execute()
            
            conflict_msg = ""
            if conflict_check.data:
                conflict_msg = f"\n\n⚠️ **Warning:** This overlaps with '{conflict_check.data[0]['title']}'."

            # Save to Database
            event_data = {
                "user_id": request.user_id,
                "title": title,
                "start_time": start,
                "end_time": end,
                "is_important": intent_data.get("is_important", False)
            }
            supabase.table("events").insert(event_data).execute()
            
            return {
                "answer": f"✅ **Scheduled:** '{title}' on {start.split('T')[0]} at {start.split('T')[1][:5]}.{conflict_msg}",
                "sources": []
            }

        # --- ACTION: Q&A (RAG) ---
        else:
            query_vector = embeddings.embed_query(request.question)
            response = supabase.rpc("match_documents", {
                "query_embedding": query_vector,
                "match_threshold": 0.5, 
                "match_count": 3
            }).execute()

            matches = response.data
            context_text = ""
            unique_sources = {}
            
            if matches:
                for item in matches:
                    context_text += item['content'] + "\n\n"
                    meta = item.get('metadata', {})
                    name = meta.get('source', 'Unknown')
                    url = meta.get('url', '#')
                    unique_sources[name] = url

            prompt = f"""
            You are a university assistant. Answer based on the context below.
            If context is empty, use general knowledge but mention you are not using documents.
            <context>{context_text}</context>
            Question: {request.question}
            """
            
            ai_response = llm.invoke(prompt)
            
            source_list = [{"name": name, "url": url} for name, url in unique_sources.items()]
            
            return {
                "answer": ai_response.content,
                "sources": source_list
            }

    except Exception as e:
        print(f"Error: {e}")
        return {"answer": "Sorry, I encountered an error processing your request.", "sources": []}