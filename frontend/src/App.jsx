import { useState, useRef, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Auth from './Auth';
import { Send, Compass, Plus, BookOpen, Code, GraduationCap, Mic, MicOff, Menu, LogOut, Paperclip, Loader2, X, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';

export default function App() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  if (!session) return <Auth />;
  return <ChatInterface session={session} />;
}

function ChatInterface({ session }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const BRAND_NAME = "Campus AI Hub"; 

  // --- 1. LOAD HISTORY ON START ---
  useEffect(() => {
    const loadHistory = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (data) {
        // Convert DB format to App format
        const formatted = data.map(msg => ({
          role: msg.is_bot ? 'bot' : 'user',
          text: msg.text
        }));
        setMessages(formatted);
      }
    };
    loadHistory();
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleLogout = async () => await supabase.auth.signOut();

  // --- HELPER: SAVE TO DB ---
  const saveMessageToDB = async (text, isBot) => {
    await supabase.from('messages').insert({
      user_id: session.user.id,
      text: text,
      is_bot: isBot
    });
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setIsUploading(true);
    
    const loadingText = `📄 **Reading ${file.name}...**`;
    setMessages(prev => [...prev, { role: 'bot', text: loadingText }]);
    
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch('https://unimind-lx09.onrender.com/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      let replyText = "";
      if (response.ok) {
        replyText = "✅ **I have learned the document!** Ask me anything.";
      } else {
        replyText = "❌ Failed to read document.";
      }
      
      // Update the last message
      setMessages(prev => {
         const newMsgs = [...prev];
         newMsgs[newMsgs.length - 1].text = replyText;
         return newMsgs;
      });
      // We don't usually save "uploading..." system messages to history, but you can if you want.

    } catch (error) {
      setMessages(prev => [...prev, { role: 'bot', text: "❌ Error uploading file." }]);
    } finally {
      setIsUploading(false);
    }
  };

  const startListening = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      setIsListening(true);
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        sendMessage(transcript);
        setIsListening(false);
      };
      recognition.onend = () => setIsListening(false);
      recognition.start();
    } else {
      alert("Voice not supported on this browser.");
    }
  };

  const sendMessage = async (text = input) => {
    if (!text.trim()) return;
    
    // 1. Show User Message
    const userMessage = { role: 'user', text: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // 2. Save User Message to DB
    saveMessageToDB(text, false);

    try {
      const response = await fetch('https://unimind-lx09.onrender.com/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text }),
      });
      const data = await response.json();
      
      // 3. Show Bot Message
      setMessages((prev) => [...prev, { role: 'bot', text: data.answer }]);
      
      // 4. Save Bot Message to DB
      saveMessageToDB(data.answer, true);

    } catch (error) {
      setMessages((prev) => [...prev, { role: 'bot', text: "❌ Connection Error. Backend might be sleeping." }]);
    } finally {
      setIsLoading(false);
    }
  };

  // --- CLEAR HISTORY FUNCTION ---
  const clearChat = async () => {
     setMessages([]);
     // Optional: Delete from DB if you want "New Chat" to actually delete data
     // await supabase.from('messages').delete().eq('user_id', session.user.id);
  };

  return (
    <div className="flex h-screen bg-[#131314] text-[#e3e3e3] font-sans overflow-hidden relative">
      
      {/* --- MOBILE HEADER --- */}
      <div className="md:hidden fixed top-0 w-full h-16 bg-[#1e1f20]/90 backdrop-blur-md border-b border-[#333] flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-2">
          <img src="/logo.jpg" alt="Logo" className="w-8 h-8 rounded-full" />
          <span className="font-semibold text-lg text-white">{BRAND_NAME}</span>
        </div>
        <button onClick={() => setMobileMenuOpen(true)} className="p-2 text-gray-400">
          <Menu size={24} />
        </button>
      </div>

      {/* --- SIDEBAR --- */}
      <div className={`
        fixed inset-0 z-50 bg-black/80 backdrop-blur-sm md:static md:bg-[#1e1f20] md:flex md:w-[280px] md:flex-col md:border-r md:border-[#333]
        ${mobileMenuOpen ? 'flex' : 'hidden'}
      `}>
        <div className="md:hidden absolute top-4 right-4">
          <button onClick={() => setMobileMenuOpen(false)} className="p-2 bg-[#333] rounded-full text-white">
            <X size={20} />
          </button>
        </div>

        <div className="w-[280px] bg-[#1e1f20] h-full p-4 flex flex-col shadow-2xl md:shadow-none md:w-full">
          <div className="flex items-center gap-3 px-2 py-3 mb-6">
            <img src="/logo.jpg" alt="Logo" className="w-8 h-8 rounded-full" />
            <span className="font-semibold text-lg tracking-tight text-white">{BRAND_NAME}</span>
          </div>
          
          <button onClick={() => { clearChat(); setMobileMenuOpen(false); }} className="flex items-center gap-3 w-full bg-[#2a2b2e] hover:bg-[#333] px-4 py-3 rounded-full text-sm font-medium transition-all mb-6 text-white border border-[#333]">
            <Plus size={18} /> New chat
          </button>

          <div className="space-y-1 mt-2">
             <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Suggestions</div>
             <button onClick={() => sendMessage("What is the Java syllabus?")} className="w-full text-left px-3 py-2 text-sm text-[#c4c7c5] hover:bg-[#2a2b2e] rounded-lg truncate flex items-center gap-2">
                <BookOpen size={14} /> Java Syllabus
             </button>
             <button onClick={() => sendMessage("Lab schedule details")} className="w-full text-left px-3 py-2 text-sm text-[#c4c7c5] hover:bg-[#2a2b2e] rounded-lg truncate flex items-center gap-2">
                <Code size={14} /> Lab Schedule
             </button>
          </div>

          <div className="mt-auto pt-4 border-t border-[#333]">
            <div className="px-2 py-2 rounded-lg flex items-center gap-3 text-sm text-[#c4c7c5]">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs uppercase">
                 {session.user.email[0]}
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="text-gray-200 font-medium truncate w-32">{session.user.email}</div>
                <div className="text-xs text-green-400">● Online</div>
              </div>
            </div>
            <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-3 text-sm text-red-400 hover:bg-[#2a2b2e] rounded-lg mt-2 transition-colors">
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </div>
      </div>

      {/* --- MAIN CHAT AREA --- */}
      <div className="flex-1 flex flex-col relative w-full h-full bg-[#131314]">
        
        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto w-full scroll-smooth pt-16 md:pt-0 pb-32">
          <div className="max-w-3xl mx-auto px-4 md:px-0 min-h-full flex flex-col">
            
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] mt-10">
                <div className="mb-8 text-center px-4">
                  <h1 className="text-4xl md:text-6xl font-semibold bg-gradient-to-r from-blue-400 via-purple-400 to-red-400 text-transparent bg-clip-text pb-2">
                    Hello, Student.
                  </h1>
                  <h2 className="text-2xl md:text-3xl font-medium text-[#444746] mt-2">
                    What can I help with?
                  </h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-xl px-2">
                  <button onClick={() => sendMessage("What is the syllabus for Java?")} className="text-left bg-[#1e1f20] hover:bg-[#2a2b2e] p-4 rounded-xl border border-transparent hover:border-[#444] transition-all">
                    <Compass size={24} className="text-blue-400 mb-2" />
                    <p className="text-white font-medium">Explain Syllabus</p>
                    <p className="text-gray-500 text-xs">for Java Programming</p>
                  </button>
                  <button onClick={() => sendMessage("What are the attendance rules?")} className="text-left bg-[#1e1f20] hover:bg-[#2a2b2e] p-4 rounded-xl border border-transparent hover:border-[#444] transition-all">
                    <GraduationCap size={24} className="text-purple-400 mb-2" />
                    <p className="text-white font-medium">Check Rules</p>
                    <p className="text-gray-500 text-xs">attendance & exams</p>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6 py-6">
                <AnimatePresence>
                  {messages.map((msg, index) => (
                    <motion.div 
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : ''}`}
                    >
                      {msg.role === 'bot' && (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-red-500 flex items-center justify-center shrink-0 mt-1">
                          <Sparkles size={16} className="text-white" />
                        </div>
                      )}
                      
                      <div className={`max-w-[85%] md:max-w-[75%] px-5 py-3 rounded-2xl text-[15px] leading-relaxed shadow-sm ${
                        msg.role === 'user' 
                          ? 'bg-[#2a2b2e] text-white rounded-br-sm' 
                          : 'text-[#e3e3e3] px-0 py-0' 
                      }`}>
                        {msg.role === 'bot' ? (
                          <div className="prose prose-invert prose-p:leading-7 prose-li:marker:text-gray-500 max-w-none">
                            <ReactMarkdown>{msg.text}</ReactMarkdown>
                          </div>
                        ) : (
                          <p>{msg.text}</p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                {isLoading && (
                  <div className="flex gap-4">
                     <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-red-500 flex items-center justify-center shrink-0 animate-pulse">
                        <Sparkles size={16} className="text-white" />
                     </div>
                     <div className="flex items-center space-x-1 pt-2">
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                     </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* --- FLOATING INPUT BAR --- */}
        <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-[#131314] via-[#131314] to-transparent pt-10 pb-6 px-4 z-40">
          <div className="max-w-3xl mx-auto">
            <div className="relative bg-[#1e1f20] rounded-full border border-[#333] focus-within:border-gray-500 focus-within:bg-[#2a2b2e] transition-all shadow-lg flex items-center pr-2">
              
              <input type="file" ref={fileInputRef} className="hidden" accept=".pdf" onChange={handleFileUpload} />
              <button 
                onClick={() => fileInputRef.current.click()} 
                disabled={isUploading || isLoading}
                className="pl-4 pr-2 text-gray-400 hover:text-blue-400 transition-colors"
              >
                {isUploading ? <Loader2 size={20} className="animate-spin" /> : <Paperclip size={20} />}
              </button>

              <input 
                type="text" 
                className="flex-1 bg-transparent text-[#e3e3e3] py-4 focus:outline-none placeholder-gray-500 text-base"
                placeholder={isListening ? "Listening..." : "Ask anything..."} 
                value={input} 
                onChange={(e) => setInput(e.target.value)} 
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()} 
              />
              
              <div className="flex items-center gap-1">
                 <button onClick={startListening} className={`p-2 rounded-full transition-all ${isListening ? 'bg-red-500/20 text-red-400' : 'hover:bg-[#333] text-gray-400'}`}>
                    {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                 </button>
                 <button 
                    onClick={() => sendMessage()} 
                    disabled={!input.trim() || isLoading} 
                    className={`p-2 rounded-full transition-all ${input.trim() ? 'bg-white text-black' : 'text-gray-500 cursor-not-allowed'}`}
                 >
                    <Send size={18} />
                 </button>
              </div>
            </div>
            <p className="text-center text-[10px] text-[#555] mt-2 font-medium">
               {BRAND_NAME} can make mistakes. Verify info.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}