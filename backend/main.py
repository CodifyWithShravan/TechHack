import os
import shutil
from fastapi import FastAPI, UploadFile, File, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles  # <--- NEW IMPORT
from dotenv import load_dotenv

# AI & LangChain Libraries
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

# 1. SETUP PUBLIC FOLDER FOR PDFs
# This creates a folder to store files so they can be downloaded later
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

@app.post("/api/upload")
async def upload_document(file: UploadFile = File(...)):
    try:
        # A. Save the file PERMANENTLY to the public folder
        file_path = f"uploaded_files/{file.filename}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        print(f"📄 Saved & Processing: {file.filename}")

        # B. Load and Split PDF
        loader = PyPDFLoader(file_path)
        docs = loader.load()
        
        # Save simple filename in metadata
        for doc in docs:
            doc.metadata["source"] = file.filename

        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        splits = text_splitter.split_documents(docs)

        # C. Add to Supabase
        vector_store.add_documents(splits)

        # D. DO NOT DELETE THE FILE! (Removed os.remove)
        print("✅ Success! Document learned and saved.")

        return {"message": "Successfully learned the document!", "filename": file.filename}

    except Exception as e:
        print(f"❌ Upload Error: {e}")
        return {"message": f"Error: {str(e)}"}

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    try:
        query_vector = embeddings.embed_query(request.question)
        response = supabase.rpc("match_documents", {
            "query_embedding": query_vector,
            "match_threshold": 0.3, 
            "match_count": 5
        }).execute()

        matches = response.data
        if not matches:
            return {"answer": "I don't have information on that yet. Try uploading a relevant PDF!", "sources": []}
        
        context_text = ""
        unique_sources = set()
        
        for item in matches:
            context_text += item['content'] + "\n\n"
            # Get just the filename (remove 'documents/' or 'uploaded_files/' path if present)
            meta = item.get('metadata', {})
            raw_source = meta.get('source', 'Unknown')
            clean_source = os.path.basename(raw_source) 
            unique_sources.add(clean_source)

        prompt = f"""
        You are a helpful university assistant.
        Answer the question based ONLY on the following context.
        <context>{context_text}</context>
        Question: {request.question}
        """
        
        ai_response = llm.invoke(prompt)
        
        return {
            "answer": ai_response.content,
            "sources": list(unique_sources)
        }

    except Exception as e:
        print(f"❌ Error: {e}")
        return {"answer": "Sorry, I encountered an error.", "sources": []}