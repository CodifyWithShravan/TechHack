import os
import shutil
import time
from fastapi import FastAPI, UploadFile, File, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
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

@app.post("/api/upload")
async def upload_document(file: UploadFile = File(...)):
    try:
        # 1. Save temp locally (needed for LangChain loader)
        file_path = f"temp_{file.filename}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # 2. Upload to Supabase Storage (PERMANENT HOME)
        # Create unique path: timestamp_filename
        storage_path = f"chat_uploads/{int(time.time())}_{file.filename}"
        
        # Read file again for upload
        with open(file_path, "rb") as f:
            file_bytes = f.read()
            
        supabase.storage.from_("chat-docs").upload(
            file=file_bytes,
            path=storage_path,
            file_options={"content-type": "application/pdf"}
        )
        
        # 3. Get Public URL
        public_url = supabase.storage.from_("chat-docs").get_public_url(storage_path)

        # 4. Process PDF
        loader = PyPDFLoader(file_path)
        docs = loader.load()
        
        # 5. Attach Public URL to Metadata
        for doc in docs:
            doc.metadata["source"] = file.filename
            doc.metadata["url"] = public_url # <--- This is the key!

        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        splits = text_splitter.split_documents(docs)
        vector_store.add_documents(splits)

        # Cleanup local file
        os.remove(file_path)

        return {"message": "Learned & Saved!", "filename": file.filename}

    except Exception as e:
        return {"message": f"Error: {str(e)}"}

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    try:
        query_vector = embeddings.embed_query(request.question)
        
        # --- FIX 1: STRICTER SEARCH ---
        # Increased threshold to 0.5 (was 0.3) so it ignores weak matches
        # Reduced count to 3 (was 5) so it doesn't grab random files
        response = supabase.rpc("match_documents", {
            "query_embedding": query_vector,
            "match_threshold": 0.5, 
            "match_count": 3
        }).execute()

        matches = response.data
        if not matches:
            return {"answer": "I couldn't find any relevant info in the uploaded documents.", "sources": []}
        
        context_text = ""
        unique_sources = {}
        
        for item in matches:
            context_text += item['content'] + "\n\n"
            meta = item.get('metadata', {})
            name = meta.get('source', 'Unknown')
            url = meta.get('url', '#') # Default to # if no URL found
            
            # Use dictionary to ensure unique filenames
            unique_sources[name] = url

        prompt = f"""
        You are a helpful university assistant.
        Answer the question based ONLY on the following context.
        If the context doesn't answer the question, say "I don't know".
        <context>{context_text}</context>
        Question: {request.question}
        """
        
        ai_response = llm.invoke(prompt)
        
        # Convert dictionary back to list of objects
        source_list = [{"name": name, "url": url} for name, url in unique_sources.items()]
        
        return {
            "answer": ai_response.content,
            "sources": source_list
        }

    except Exception as e:
        print(f"Error: {e}")
        return {"answer": "Sorry, I encountered an error.", "sources": []}