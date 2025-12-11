import os
from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import SupabaseVectorStore
from supabase.client import create_client, Client

load_dotenv()

# 1. Setup Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# 2. Setup Embeddings (The tool that turns text into numbers)
embeddings = GoogleGenerativeAIEmbeddings(model="models/text-embedding-004")

def ingest_documents():
    print("📂 Loading PDFs...")
    
    # Path to your documents folder
    folder_path = "documents"
    documents = []
    
    # Read every PDF in the folder
    for file in os.listdir(folder_path):
        if file.endswith(".pdf"):
            pdf_path = os.path.join(folder_path, file)
            loader = PyPDFLoader(pdf_path)
            documents.extend(loader.load())
            print(f"   - Loaded: {file}")

    if not documents:
        print("❌ No PDFs found in 'documents' folder!")
        return

    # 3. Split Text (AI can't read whole books at once, it needs chunks)
    print("🔪 Splitting text into chunks...")
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200
    )
    chunks = text_splitter.split_documents(documents)
    print(f"   - Created {len(chunks)} text chunks.")

    # 4. Save to Supabase
    print("🚀 Uploading to Supabase (this might take a moment)...")
    vector_store = SupabaseVectorStore.from_documents(
        documents=chunks,
        embedding=embeddings,
        client=supabase,
        table_name="documents",
        query_name="match_documents",
    )
    print("✅ Success! Your PDFs are now in the AI's brain.")

if __name__ == "__main__":
    ingest_documents()