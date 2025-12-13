import { useState, useRef, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Auth from './Auth';
import Profile from './Profile'; 
import Vault from './Vault';
import Calendar from './Calendar'; 
import Home from './Home'; 
import Network from './Network'; // <--- Network Import
import UserChat from './UserChat'; // <--- DM Import
import { Send, Plus, LogOut, Paperclip, Loader2, X, Sparkles, FileText, Archive, MessageSquare, Calendar as CalIcon, Menu, Mic, MicOff, Users } from 'lucide-react'; // Added Users
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import { useGoogleLogin } from '@react-oauth/google';
import axios from 'axios';

export default function App() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  if (!session) return <Auth />;
  return <MainLayout session={session} />;
}

function MainLayout({ session }) {
  const [currentView, setCurrentView] = useState('home'); // 'home', 'chat', 'profile', 'vault', 'calendar', 'network', 'dm'
  const [sessionId, setSessionId] = useState(null);
  const [chatHistory, setChatHistory] = useState([]); 
  const [messages, setMessages] = useState([]);
  const [vaultSuggestions, setVaultSuggestions] = useState([]);
  
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Google Calendar State
  const [pendingEvent, setPendingEvent] = useState(null); 

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const BRAND_NAME = "Campus AI Hub"; 
  const rawName = session.user.email.split('@')[0];
  const userName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

  // --- GOOGLE LOGIN HOOK ---
  const googleLogin = useGoogleLogin({
    scope: 'https://www.googleapis.com/auth/calendar.events',
    onSuccess: async (tokenResponse) => {
      if (!pendingEvent) return;
      
      try {
        await axios.post(
          'https://www.googleapis.com/calendar/v3/calendars/primary/events',
          {
            summary: pendingEvent.title,
            description: pendingEvent.description || "Created by Campus AI",
            start: { 
              dateTime: pendingEvent.start_time, 
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone 
            },
            end: { 
              dateTime: pendingEvent.end_time, 
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone 
            },
          },
          { headers: { Authorization: `Bearer ${tokenResponse.access_token}` } }
        );
        
        setMessages(prev => [...prev, { 
          role: 'bot', 
          text: `✅ **Success!** I have added "**${pendingEvent.title}**" to your Google Calendar.` 
        }]);
        setPendingEvent(null); // Clear pending event
      } catch (error) {
        console.error("Google Calendar Error:", error);
        setMessages(prev => [...prev, { 
          role: 'bot', 
          text: "❌ Failed to add to Google Calendar. Please check permissions." 
        }]);
      }
    },
    onError: error => console.log("Login Failed:", error),
  });

  // Effect to trigger login only when pendingEvent is set
  useEffect(() => {
    if (pendingEvent) {
      googleLogin();
    }
  }, [pendingEvent]); 

  // --- INITIAL LOAD ---
  useEffect(() => {
    fetchChatHistory();
    fetchVaultSuggestions();
  }, []);

  const fetchChatHistory = async () => {
    const { data } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });
    if (data) setChatHistory(data);
  };

  const fetchVaultSuggestions = async () => {
    const { data } = await supabase
      .from('vault_items')
      .select('filename')
      .eq('user_id', session.user.id)
      .limit(3);
    if (data) setVaultSuggestions(data);
  };

  // --- LOAD MESSAGES ---
  useEffect(() => {
    if (currentView === 'chat' && sessionId) {
      const loadMessages = async () => {
        const { data } = await supabase
          .from('messages')
          .select('*')
          .eq('session_id', sessionId) 
          .order('created_at', { ascending: true });
        
        if (data) {
          const formatted = data.map(msg => ({
            role: msg.is_bot ? 'bot' : 'user',
            text: msg.text,
            sources: [] 
          }));
          setMessages(formatted);
        } else {
          setMessages([]);
        }
      };
      loadMessages();
    }
  }, [sessionId, currentView]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleLogout = async () => await supabase.auth.signOut();

  const startNewChat = async () => {
    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({ user_id: session.user.id, title: 'New Conversation' })
      .select()
      .single();
    
    if (data) {
      setSessionId(data.id);
      setMessages([]);
      setCurrentView('chat');
      setMobileMenuOpen(false);
      fetchChatHistory(); 
    }
  };

  const saveMessageToDB = async (text, isBot, activeSessionId) => {
    if (!activeSessionId) return;
    await supabase.from('messages').insert({
      user_id: session.user.id,
      session_id: activeSessionId,
      text: text,
      is_bot: isBot
    });
    
    if (!isBot && messages.length === 0) {
       const shortTitle = text.slice(0, 30) + (text.length > 30 ? '...' : '');
       await supabase.from('chat_sessions').update({ title: shortTitle }).eq('id', activeSessionId);
       fetchChatHistory();
    }
  };

  // --- SEND MESSAGE LOGIC ---
  const sendMessage = async (text = input) => {
    if (!text.trim()) return;
    let activeSessionId = sessionId;

    if (currentView !== 'chat' || !activeSessionId) {
       const { data } = await supabase.from('chat_sessions').insert({ user_id: session.user.id, title: text.slice(0, 30) }).select().single();
       if (data) { activeSessionId = data.id; setSessionId(data.id); setCurrentView('chat'); fetchChatHistory(); }
    }

    const userMessage = { role: 'user', text: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    saveMessageToDB(text, false, activeSessionId);

    try {
      const response = await fetch('https://unimind-lx09.onrender.com/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text, user_id: session.user.id }),
      });
      const data = await response.json();
      
      // === GOOGLE CALENDAR TRIGGER ===
      if (data.command === 'schedule_google') {
        setMessages(prev => [...prev, { role: 'bot', text: data.answer }]); 
        setPendingEvent(data.event_details); 
      } else {
        setMessages((prev) => [...prev, { 
          role: 'bot', 
          text: data.answer, 
          sources: data.sources || [] 
        }]);
        saveMessageToDB(data.answer, true, activeSessionId);
      }

    } catch (error) {
      setMessages((prev) => [...prev, { role: 'bot', text: "❌ Connection Error." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    let activeSessionId = sessionId;
    if (currentView !== 'chat' || !activeSessionId) {
        const { data } = await supabase.from('chat_sessions').insert({ user_id: session.user.id, title: `Upload: ${file.name}` }).select().single();
        if(data) { activeSessionId = data.id; setSessionId(data.id); setCurrentView('chat'); fetchChatHistory(); }
    }

    setIsUploading(true);
    setMessages(prev => [...prev, { role: 'bot', text: `📄 **Reading ${file.name}...**` }]);
    
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch('https://unimind-lx09.onrender.com/api/upload', {
        method: 'POST',
        body: formData,
      });
      let replyText = response.ok ? "✅ **I have learned the document!** Ask me anything." : "❌ Failed to read document.";
      setMessages(prev => { const newMsgs = [...prev]; newMsgs[newMsgs.length - 1].text = replyText; return newMsgs; });
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
        sendMessage(transcript); // Automatically send after speaking
        setIsListening(false);
      };
      
      recognition.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
        alert("Microphone access denied or error occurred.");
      };

      recognition.onend = () => setIsListening(false);
      
      recognition.start();
    } else {
      alert("Voice input is not supported in this browser. Please use Google Chrome or Edge.");
    }
  };

  return (
    <div className="flex h-screen bg-[#131314] text-[#e3e3e3] font-sans overflow-hidden relative">
      
      {/* MOBILE HEADER */}
      <div className="md:hidden fixed top-0 w-full h-16 bg-[#1e1f20]/90 backdrop-blur-md border-b border-[#333] flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-2">
          <img src="/logo.jpg" alt="Logo" className="w-8 h-8 rounded-full" />
          <span className="font-semibold text-lg text-white">{BRAND_NAME}</span>
        </div>
        <button onClick={() => setMobileMenuOpen(true)} className="p-2 text-gray-400">
          <Menu size={24} />
        </button>
      </div>

      {/* SIDEBAR */}
      <div className={`
        fixed inset-0 z-50 bg-black/80 backdrop-blur-sm md:static md:bg-[#1e1f20] md:flex md:w-[280px] md:flex-col md:border-r md:border-[#333]
        ${mobileMenuOpen ? 'flex' : 'hidden'}
      `}>
        <div className="md:hidden absolute top-4 right-4">
          <button onClick={() => setMobileMenuOpen(false)} className="p-2 bg-[#333] rounded-full text-white"><X size={20} /></button>
        </div>

        <div className="w-[280px] bg-[#1e1f20] h-full p-4 flex flex-col shadow-2xl md:shadow-none md:w-full">
          <div className="flex items-center gap-3 px-2 py-3 mb-6">
            <img src="/logo.jpg" alt="Logo" className="w-8 h-8 rounded-full" />
            <span className="font-semibold text-lg tracking-tight text-white">{BRAND_NAME}</span>
          </div>
          
          <button onClick={startNewChat} className="flex items-center gap-3 w-full bg-[#2a2b2e] hover:bg-[#333] px-4 py-3 rounded-full text-sm font-medium transition-all mb-6 text-white border border-[#333]">
            <Plus size={18} /> New chat
          </button>

          {/* CHAT HISTORY */}
          <div className="flex-1 overflow-y-auto mb-4 custom-scrollbar pr-2">
            <div className="px-2 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Recent Chats</div>
            {chatHistory.map((chat) => (
              <button
                key={chat.id}
                onClick={() => { setSessionId(chat.id); setCurrentView('chat'); setMobileMenuOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm rounded-lg truncate flex items-center gap-2 mb-1 transition-all ${sessionId === chat.id && currentView === 'chat' ? 'bg-[#333] text-white border border-gray-600' : 'text-[#999] hover:bg-[#2a2b2e] hover:text-white border border-transparent'}`}
              >
                <MessageSquare size={14} />
                <span className="truncate">{chat.title}</span>
              </button>
            ))}
          </div>

          <div className="mt-auto pt-4 border-t border-[#333]">
            
            {/* --- CALENDAR BUTTON --- */}
            <button onClick={() => { setCurrentView('calendar'); setMobileMenuOpen(false); }} className={`w-full text-left px-3 py-3 rounded-lg flex items-center gap-3 text-sm transition-colors mb-2 ${currentView === 'calendar' ? 'bg-[#333] text-white' : 'text-[#c4c7c5] hover:bg-[#2a2b2e]'}`}>
              <CalIcon size={18} className="text-purple-400" /><span className="font-medium">My Schedule</span>
            </button>

            {/* --- VAULT BUTTON --- */}
            <button onClick={() => { setCurrentView('vault'); setMobileMenuOpen(false); }} className={`w-full text-left px-3 py-3 rounded-lg flex items-center gap-3 text-sm transition-colors mb-2 ${currentView === 'vault' ? 'bg-[#333] text-white' : 'text-[#c4c7c5] hover:bg-[#2a2b2e]'}`}>
              <Archive size={18} className="text-green-400" /><span className="font-medium">My Vault</span>
            </button>

            {/* --- NETWORK BUTTON (NEW) --- */}
            <button onClick={() => { setCurrentView('network'); setMobileMenuOpen(false); }} className={`w-full text-left px-3 py-3 rounded-lg flex items-center gap-3 text-sm transition-colors mb-2 ${currentView === 'network' ? 'bg-[#333] text-white' : 'text-[#c4c7c5] hover:bg-[#2a2b2e]'}`}>
              <Users size={18} className="text-orange-400" /><span className="font-medium">Network</span>
            </button>

            {/* --- DM BUTTON (NEW) --- */}
            <button onClick={() => { setCurrentView('dm'); setMobileMenuOpen(false); }} className={`w-full text-left px-3 py-3 rounded-lg flex items-center gap-3 text-sm transition-colors mb-2 ${currentView === 'dm' ? 'bg-[#333] text-white' : 'text-[#c4c7c5] hover:bg-[#2a2b2e]'}`}>
              <MessageSquare size={18} className="text-blue-400" /><span className="font-medium">Messages</span>
            </button>

            {/* --- PROFILE BUTTON --- */}
            <button onClick={() => { setCurrentView('profile'); setMobileMenuOpen(false); }} className={`w-full text-left px-2 py-2 rounded-lg flex items-center gap-3 text-sm transition-colors ${currentView === 'profile' ? 'bg-[#333]' : 'hover:bg-[#2a2b2e]'}`}>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs uppercase">{session.user.email[0]}</div>
              <div className="flex-1 overflow-hidden"><div className="text-gray-200 font-medium truncate w-32">{userName}</div><div className="text-xs text-green-400">View Profile</div></div>
            </button>
            <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-3 text-sm text-red-400 hover:bg-[#2a2b2e] rounded-lg mt-2 transition-colors"><LogOut size={16} /> Sign out</button>
          </div>
        </div>
      </div>

      {/* --- MAIN CONTENT AREA --- */}
      <div className="flex-1 flex flex-col relative w-full h-full bg-[#131314]">
        {currentView === 'home' ? (
           <Home userName={userName} onNavigate={(view) => {
             if (view === 'new_chat') startNewChat();
             else setCurrentView(view);
           }} />
        ) : currentView === 'profile' ? (
          <div className="flex-1 overflow-y-auto pt-16 md:pt-0"><Profile session={session} /></div>
        ) : currentView === 'vault' ? (
          <div className="flex-1 overflow-y-auto pt-16 md:pt-0"><Vault session={session} /></div>
        ) : currentView === 'calendar' ? (
          // RENDER THE NEW CALENDAR VIEW
         <div className="flex-1 overflow-y-auto pt-16 md:pt-0"><Calendar session={session} /></div>
        ) : currentView === 'network' ? (
          // RENDER NETWORK VIEW
          <div className="flex-1 overflow-y-auto pt-16 md:pt-0"><Network session={session} /></div>
        ) : currentView === 'dm' ? (
          // RENDER DM VIEW
          <div className="flex-1 h-full pt-16 md:pt-0"><UserChat session={session} /></div>
        ) : (
          /* --- CHAT VIEW --- */
          <>
            <div className="flex-1 overflow-y-auto w-full scroll-smooth pt-16 md:pt-0 pb-32">
              <div className="max-w-3xl mx-auto px-4 md:px-0 min-h-full flex flex-col">
                {messages.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] mt-10">
                    <div className="mb-8 text-center px-4">
                      <h1 className="text-4xl md:text-6xl font-semibold bg-gradient-to-r from-blue-400 via-purple-400 to-red-400 text-transparent bg-clip-text pb-2">Hello, {userName}.</h1>
                      <h2 className="text-2xl md:text-3xl font-medium text-[#444746] mt-2">What can I help with?</h2>
                    </div>
                    {/* ... (suggestions grid) ... */}
                  </div>
                ) : (
                  <div className="space-y-6 py-6">
                    <AnimatePresence>
                      {messages.map((msg, index) => (
                        <motion.div key={index} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                          {msg.role === 'bot' && (<div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-red-500 flex items-center justify-center shrink-0 mt-1"><Sparkles size={16} className="text-white" /></div>)}
                          <div className={`max-w-[85%] md:max-w-[75%] px-5 py-3 rounded-2xl text-[15px] leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-[#2a2b2e] text-white rounded-br-sm' : 'text-[#e3e3e3] px-0 py-0'}`}>
                            {msg.role === 'bot' ? (
                              <div className="prose prose-invert prose-p:leading-7 prose-li:marker:text-gray-500 max-w-none">
                                <ReactMarkdown>{msg.text}</ReactMarkdown>
                                {msg.sources && msg.sources.length > 0 && (
                                  <div className="mt-4 pt-3 border-t border-[#333]">
                                    <p className="text-[10px] text-gray-500 uppercase font-semibold mb-2">Sources (Click to open):</p>
                                    <div className="flex flex-wrap gap-2">
                                      {msg.sources.map((src, i) => {
                                        const fileName = typeof src === 'string' ? src : src.name;
                                        const fileUrl = typeof src === 'string' ? '#' : src.url;
                                        return (
                                          <a key={i} href={fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 bg-[#131314] border border-[#333] px-3 py-1.5 rounded-full text-xs text-blue-400 transition-all cursor-pointer no-underline" onClick={(e) => { if(fileUrl === '#') e.preventDefault(); }}>
                                            <FileText size={12} /> <span className="truncate max-w-[200px] font-medium">{fileName}</span>
                                          </a>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (<p>{msg.text}</p>)}
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {isLoading && <div className="flex gap-4"><div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-red-500 flex items-center justify-center shrink-0 animate-pulse"><Sparkles size={16} className="text-white" /></div><div className="flex items-center space-x-1 pt-2"><div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div><div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div><div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div></div></div>}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>
            </div>
            
            {/* INPUT BAR */}
            <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-[#131314] via-[#131314] to-transparent pt-10 pb-6 px-4 z-40">
              <div className="max-w-3xl mx-auto">
                <div className="relative bg-[#1e1f20] rounded-full border border-[#333] focus-within:border-gray-500 focus-within:bg-[#2a2b2e] transition-all shadow-lg flex items-center pr-2">
                  <input type="file" ref={fileInputRef} className="hidden" accept=".pdf" onChange={handleFileUpload} />
                  <button onClick={() => fileInputRef.current.click()} disabled={isUploading || isLoading} className="pl-4 pr-2 text-gray-400 hover:text-blue-400 transition-colors">{isUploading ? <Loader2 size={20} className="animate-spin" /> : <Paperclip size={20} />}</button>
                  <input type="text" className="w-full bg-transparent text-[#e3e3e3] pl-4 pr-24 py-4 focus:outline-none placeholder-gray-500 text-base" placeholder={isListening ? "Listening..." : "Ask anything..."} value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && sendMessage()} />
                  <div className="absolute right-2 top-2 flex items-center gap-1">
                     <button onClick={startListening} className={`p-2 rounded-full transition-all ${isListening ? 'bg-red-500/20 text-red-400' : 'hover:bg-[#333] text-gray-400'}`}>{isListening ? <MicOff size={20} /> : <Mic size={20} />}</button>
                     <button onClick={() => sendMessage()} disabled={!input.trim() || isLoading} className={`p-2 rounded-full transition-all ${input.trim() ? 'bg-white text-black' : 'text-gray-500 cursor-not-allowed'}`}><Send size={18} /></button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}