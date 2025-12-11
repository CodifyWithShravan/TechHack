import os
import shutil
from fastapi import FastAPI, UploadFile, File, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# AI & LangChain Libraries
from langchain_groq import ChatGroq
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import SupabaseVectorStore
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from supabase.client import create_client, Client

# 1. Load Keys
load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

app = FastAPI()

# 2. Setup Security (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Setup AI Models
llm = ChatGroq(
    model="llama-3.1-8b-instant",
    api_key=GROQ_API_KEY
)

embeddings = GoogleGenerativeAIEmbeddings(
    model="models/text-embedding-004",
    google_api_key=GOOGLE_API_KEY
)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
vector_store = SupabaseVectorStore(
    client=supabase,
    embedding=embeddings,
    table_name="documents",
    query_name="match_documents",
)

class ChatRequest(BaseModel):
    question: str

# --- 4. NEW: UPLOAD ENDPOINT ---
@app.post("/api/upload")
async def upload_document(file: UploadFile = File(...)):
    try:
        # A. Save the file temporarily
        file_path = f"temp_{file.filename}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        print(f"📄 Processing: {file.filename}")

        # B. Load and Split PDF
        loader = PyPDFLoader(file_path)
        docs = loader.load()
        
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200
        )
        splits = text_splitter.split_documents(docs)

        # C. Add to Supabase (Learn it)
        print("   🧠 Learning new knowledge...")
        vector_store.add_documents(splits)

        # D. Cleanup
        os.remove(file_path)
        print("✅ Success! Document learned.")

        return {"message": "Successfully learned the document!", "filename": file.filename}

    except Exception as e:
        print(f"❌ Upload Error: {e}")
        return {"message": f"Error: {str(e)}"}

# --- 5. CHAT ENDPOINT (Same as before) ---
@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    print(f"📩 Question: {request.question}")
    
    try:
        # 1. Convert question to numbers
        query_vector = embeddings.embed_query(request.question)

        # 2. Search Supabase
        response = supabase.rpc("match_documents", {
            "query_embedding": query_vector,
            "match_threshold": 0.3, 
            "match_count": 5
        }).execute()

        matches = response.data
        if not matches:
            return {"answer": "I don't have information on that yet. Try uploading a relevant PDF!"}
        
        context_text = "\n\n".join([item['content'] for item in matches])

        # 3. Ask AI
        prompt = f"""
        You are a helpful university assistant.
        Answer the question based ONLY on the following context.
        
        <context>
        {context_text}
        </context>

        Question: {request.question}
        """
        
        ai_response = llm.invoke(prompt)
        return {"answer": ai_response.content}

    except Exception as e:
        print(f"❌ Error: {e}")
        return {"answer": "Sorry, I encountered an error."}