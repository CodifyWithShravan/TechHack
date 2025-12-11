import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Menu, Compass, Plus, BookOpen, Code, GraduationCap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text = input) => {
    if (!text.trim()) return;

    const userMessage = { role: 'user', text: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('https://unimind-lx09.onrender.com/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text }),
      });

      const data = await response.json();
      setMessages((prev) => [...prev, { role: 'bot', text: data.answer }]);
    } catch (error) {
      setMessages((prev) => [...prev, { role: 'bot', text: "❌ **Connection Error**: Is the backend running?" }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#131314] text-[#e3e3e3] font-sans overflow-hidden">
      
      {/* SIDEBAR (Hidden on mobile) */}
      <div className="hidden md:flex flex-col w-[260px] bg-[#1e1f20] p-4 justify-between border-r border-[#333]">
        <div>
          <div className="flex items-center gap-2 px-2 py-3 mb-6 cursor-pointer hover:bg-[#2a2b2e] rounded-lg transition-colors">
            <Menu className="w-5 h-5 text-gray-400" />
            <span className="font-semibold text-lg tracking-tight text-gray-200">UniMind</span>
          </div>
          
          <button 
            onClick={() => setMessages([])}
            className="flex items-center gap-3 w-full bg-[#1e1f20] hover:bg-[#333537] px-4 py-3 rounded-full text-sm font-medium transition-all mb-6 text-[#e3e3e3] border border-[#333]"
          >
            <Plus size={18} />
            New chat
          </button>

          <div className="space-y-1 mt-4">
             <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Recent</div>
             <div className="px-3 py-2 text-sm text-[#c4c7c5] hover:bg-[#2a2b2e] rounded-lg cursor-pointer transition-colors truncate flex items-center gap-2">
                <BookOpen size={14} /> Java Syllabus
             </div>
             <div className="px-3 py-2 text-sm text-[#c4c7c5] hover:bg-[#2a2b2e] rounded-lg cursor-pointer transition-colors truncate flex items-center gap-2">
                <Code size={14} /> Lab Schedule
             </div>
          </div>
        </div>
        
        <div className="px-3 py-3 hover:bg-[#2a2b2e] rounded-lg cursor-pointer flex items-center gap-3 text-sm text-[#c4c7c5] transition-colors mt-auto">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs">S</div>
          <div>
            <div className="text-gray-200 font-medium">Student</div>
            <div className="text-xs text-gray-500">Free Plan</div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col relative w-full h-full">
        
        {/* SCROLLABLE AREA */}
        <div className="flex-1 overflow-y-auto w-full scroll-smooth">
          <div className="max-w-4xl mx-auto h-full flex flex-col px-4 md:px-0">
            
            {/* --- WELCOME SCREEN (Centered) --- */}
            {messages.length === 0 ? (
              // KEY FIX: w-full and text-center applied here
              <div className="flex-1 flex flex-col items-center justify-center h-full w-full min-h-[80vh] pb-32">
                
                {/* Greeting Text - Centered */}
                <div className="mb-12 text-center w-full">
                  <h1 className="text-5xl md:text-6xl font-medium bg-gradient-to-r from-[#4285f4] via-[#9b72cb] to-[#d96570] text-transparent bg-clip-text inline-block pb-2">
                    Hello, Student.
                  </h1>
                  <h2 className="text-4xl md:text-5xl font-medium text-[#444746] mt-2">
                    How can I help today?
                  </h2>
                </div>
                
                {/* Suggestion Cards - Centered Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl px-4">
                  {/* Card 1 */}
                  <button 
                    onClick={() => sendMessage("What is the syllabus for Java?")} 
                    className="relative group text-left bg-[#1e1f20] hover:bg-[#2a2b2e] p-6 rounded-2xl transition-all border border-transparent hover:border-[#444746] flex flex-col h-full"
                  >
                    <div className="absolute top-4 right-4 bg-black/20 p-2 rounded-full group-hover:bg-blue-500/10 transition-colors">
                      <Compass size={20} className="text-[#444746] group-hover:text-blue-400" />
                    </div>
                    <p className="text-[#e3e3e3] font-medium text-lg mb-1 mt-2">Explain the syllabus</p>
                    <p className="text-[#8e918f] text-sm">for the Java Programming course</p>
                  </button>
                  
                  {/* Card 2 */}
                  <button 
                    onClick={() => sendMessage("What are the attendance rules?")} 
                    className="relative group text-left bg-[#1e1f20] hover:bg-[#2a2b2e] p-6 rounded-2xl transition-all border border-transparent hover:border-[#444746] flex flex-col h-full"
                  >
                     <div className="absolute top-4 right-4 bg-black/20 p-2 rounded-full group-hover:bg-purple-500/10 transition-colors">
                      <GraduationCap size={20} className="text-[#444746] group-hover:text-purple-400" />
                    </div>
                    <p className="text-[#e3e3e3] font-medium text-lg mb-1 mt-2">Check the rules</p>
                    <p className="text-[#8e918f] text-sm">regarding attendance and exams</p>
                  </button>
                </div>
              </div>
            ) : (
              /* --- CHAT MESSAGES LIST --- */
              <div className="pt-10 pb-40 space-y-8 w-full">
                <AnimatePresence>
                  {messages.map((msg, index) => (
                    <motion.div 
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className={`flex gap-5 w-full ${msg.role === 'user' ? 'justify-end' : ''}`}
                    >
                      {/* Bot Icon */}
                      {msg.role === 'bot' && (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-red-500 flex items-center justify-center shrink-0 mt-1 shadow-lg shadow-blue-900/20">
                          <Sparkles size={16} className="text-white" />
                        </div>
                      )}

                      {/* Message Content */}
                      <div className={`leading-relaxed max-w-[85%] ${
                        msg.role === 'user' 
                          ? 'bg-[#2a2b2e] text-[#e3e3e3] px-6 py-3 rounded-[24px] rounded-br-sm text-[16px]' 
                          : 'text-[#e3e3e3] text-[16px] pt-1' 
                      }`}>
                        {msg.role === 'bot' ? (
                          <div className="prose prose-invert prose-p:leading-7 prose-li:marker:text-gray-500">
                            <ReactMarkdown>{msg.text}</ReactMarkdown>
                          </div>
                        ) : (
                          <p>{msg.text}</p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Loading State */}
                {isLoading && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-5">
                     <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-red-500 flex items-center justify-center shrink-0 animate-pulse">
                        <Sparkles size={16} className="text-white" />
                     </div>
                     <div className="flex items-center space-x-1 pt-2">
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                     </div>
                  </motion.div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* FLOATING INPUT BAR */}
        <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-[#131314] via-[#131314] to-transparent pb-8 pt-10 px-4">
          <div className="max-w-3xl mx-auto relative bg-[#1e1f20] rounded-full border border-[#333] hover:border-[#444] focus-within:bg-[#2a2b2e] focus-within:border-gray-500 transition-all shadow-xl">
            <input
              type="text"
              className="w-full bg-transparent text-[#e3e3e3] pl-6 pr-14 py-4 focus:outline-none placeholder-[#8e918f] text-[16px]"
              placeholder="Ask UniMind about your syllabus..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
              className={`absolute right-2 top-2 p-2 rounded-full transition-all duration-200 ${
                input.trim() 
                  ? 'bg-white text-black hover:bg-gray-200 shadow-md' 
                  : 'bg-transparent text-[#444746] cursor-not-allowed'
              }`}
            >
              <Send size={20} />
            </button>
          </div>
          <p className="text-center text-[12px] text-[#8e918f] mt-4 font-medium">
             UniMind can make mistakes. Please verify important information.
          </p>
        </div>

      </div>
    </div>
  );
}