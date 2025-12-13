import os
import shutil
import time
import json
import re
from datetime import datetime, timedelta
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

os.makedirs("uploaded_files", exist_ok=True)
app.mount("/files", StaticFiles(directory="uploaded_files"), name="files")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    user_id: str

def extract_json(text):
    try:
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            return json.loads(match.group(0))
        return None
    except:
        return None

@app.post("/api/upload")
async def upload_document(file: UploadFile = File(...)):
    try:
        file_path = f"temp_{file.filename}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

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

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    try:
        current_time = datetime.now().isoformat()
        
        # --- 1. INTENT DETECTION ---
        intent_prompt = f"""
        Current Time: {current_time}
        User Input: "{request.question}"
        
        Task: Extract scheduling info.
        Rules:
        1. If user mentions "remind", "schedule", "have a [event]", or a date/time -> ACTION IS "schedule".
        2. Otherwise -> ACTION IS "qa".
        
        Output JSON ONLY:
        {{
            "action": "schedule",
            "title": "Event Name",
            "start_time": "YYYY-MM-DDTHH:MM:SS",
            "end_time": "YYYY-MM-DDTHH:MM:SS" (Default +1 hour),
            "description": "Created by Campus AI Assistant"
        }}
        OR {{ "action": "qa" }}
        """
        
        raw_response = llm.invoke(intent_prompt).content
        intent_data = extract_json(raw_response) or {"action": "qa"}

        # --- 2. EXECUTE LOGIC ---
        
        # === CASE: SCHEDULE ===
        if intent_data.get("action") == "schedule":
            print("🗓️ Scheduling Intent Detected")
            
            # A. SAVE TO SUPABASE (So it shows in the list)
            event_data = {
                "user_id": request.user_id,
                "title": intent_data.get("title"),
                "start_time": intent_data.get("start_time"),
                "end_time": intent_data.get("end_time"),
                "is_important": True
            }
            try:
                supabase.table("events").insert(event_data).execute()
            except Exception as e:
                print(f"DB Error: {e}")

            # B. SEND COMMAND TO GOOGLE (So it pops up)
            return {
                "answer": f"✅ I have added '**{intent_data['title']}**' to your Task List below.\n\n📅 Now opening Google Calendar to sync it...",
                "command": "schedule_google", 
                "event_details": intent_data,
                "sources": []
            }

        # === CASE: QA ===
        else:
            print("🔍 QA Mode")
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
            Answer based on the context below.
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
        return {"answer": "Error processing request.", "sources": []}