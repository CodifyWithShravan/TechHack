# backend/test_ai.py
from langchain_google_genai import ChatGoogleGenerativeAI
from dotenv import load_dotenv

load_dotenv()

# USE YOUR WINNER HERE
llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash")

print("🤖 Testing LangChain with Gemini 2.5...")
try:
    response = llm.invoke("What is the speed of light?")
    print(f"✅ IT WORKS! Answer: {response.content}")
except Exception as e:
    print(f"❌ Error: {e}")