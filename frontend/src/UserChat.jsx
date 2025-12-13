import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import { Send, User, MessageCircle, ArrowLeft } from 'lucide-react';

export default function UserChat({ session }) {
  const [connections, setConnections] = useState([]);
  const [activeChat, setActiveChat] = useState(null); 
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef();

  useEffect(() => {
    fetchConnections();
  }, []);

  useEffect(() => {
    if (activeChat) {
      fetchMessages(activeChat.id);
      
      // REAL-TIME SUBSCRIPTION (Optimized)
      // Only listen for messages sent BY THE OTHER PERSON.
      // We handle our own messages instantly via "Optimistic UI" so we don't need to wait for the DB.
      const channel = supabase.channel('dm_channel')
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'direct_messages',
            filter: `sender_id=eq.${activeChat.id}` // Only listen to THEIR messages
        }, payload => {
            // Check if this message belongs to the current conversation
            if (payload.new.receiver_id === session.user.id) {
                setMessages(prev => [...prev, payload.new]);
            }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [activeChat]);

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchConnections = async () => {
    const { data } = await supabase
      .from('connections')
      .select(`
        id, 
        requester:requester_id(id, full_name, email), 
        receiver:receiver_id(id, full_name, email)
      `)
      .eq('status', 'accepted')
      .or(`requester_id.eq.${session.user.id},receiver_id.eq.${session.user.id}`);

    if (data) {
        const formatted = data.map(c => 
            c.requester.id === session.user.id ? c.receiver : c.requester
        );
        setConnections(formatted);
    }
  };

  const fetchMessages = async (partnerId) => {
    const { data } = await supabase
      .from('direct_messages')
      .select('*')
      .or(`and(sender_id.eq.${session.user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${session.user.id})`)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
  };

  const sendMessage = async () => {
    if (!input.trim() || !activeChat) return;
    
    const textToSend = input;
    setInput(''); // Clear input INSTANTLY

    // 1. OPTIMISTIC UPDATE (Show it immediately!)
    const tempMessage = {
        id: Date.now(), // Temporary ID
        sender_id: session.user.id,
        receiver_id: activeChat.id,
        content: textToSend,
        created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempMessage]);

    // 2. Send to Database in Background
    const { error } = await supabase.from('direct_messages').insert({
        sender_id: session.user.id,
        receiver_id: activeChat.id,
        content: textToSend
    });

    if (error) {
        console.error("Message failed to send:", error);
        // Optional: Add logic to show a red "!" icon if it fails
    }
  };

  return (
    <div className="flex h-full bg-[#131314] overflow-hidden">
      
      {/* LEFT: CONNECTIONS LIST */}
      <div className={`w-full md:w-80 border-r border-[#333] flex flex-col ${activeChat ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-[#333]">
            <h2 className="text-xl font-bold text-white flex gap-2"><MessageCircle className="text-blue-400"/> Messages</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
            {connections.length === 0 && <div className="p-4 text-gray-500 text-sm">No connections yet. Go to Network tab to connect!</div>}
            {connections.map(u => (
                <div 
                    key={u.id} 
                    onClick={() => setActiveChat(u)}
                    className={`p-4 flex items-center gap-3 cursor-pointer hover:bg-[#1e1f20] transition-colors ${activeChat?.id === u.id ? 'bg-[#1e1f20] border-l-4 border-blue-500' : ''}`}
                >
                    <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-white shrink-0">
                        {(u.full_name?.[0] || u.email?.[0] || "U").toUpperCase()}
                    </div>
                    <div className="overflow-hidden">
                        <h3 className="text-white font-medium truncate">{u.full_name || "User"}</h3>
                        <p className="text-xs text-gray-500 truncate">{u.email}</p>
                    </div>
                </div>
            ))}
        </div>
      </div>

      {/* RIGHT: CHAT WINDOW */}
      <div className={`flex-1 flex flex-col ${!activeChat ? 'hidden md:flex' : 'flex'}`}>
        {activeChat ? (
            <>
                <div className="h-16 border-b border-[#333] flex items-center px-4 bg-[#1e1f20]">
                    <button onClick={() => setActiveChat(null)} className="md:hidden mr-3 text-gray-400 p-2 hover:bg-[#333] rounded-full">
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                            {(activeChat.full_name?.[0] || activeChat.email?.[0] || "U").toUpperCase()}
                        </div>
                        <span className="text-white font-bold truncate">{activeChat.full_name || activeChat.email}</span>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#131314]">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.sender_id === session.user.id ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm break-words shadow-md ${msg.sender_id === session.user.id ? 'bg-blue-600 text-white rounded-br-none' : 'bg-[#2a2b2e] text-gray-200 rounded-bl-none'}`}>
                                {msg.content}
                            </div>
                        </div>
                    ))}
                    <div ref={scrollRef} />
                </div>

                <div className="p-4 bg-[#1e1f20] border-t border-[#333]">
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            className="flex-1 bg-[#131314] text-white rounded-full px-4 py-3 focus:outline-none border border-[#333] focus:border-blue-500 transition-all placeholder-gray-500"
                            placeholder="Type a message..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                        />
                        <button 
                            onClick={sendMessage} 
                            disabled={!input.trim()}
                            className={`p-3 rounded-full text-white transition-all ${input.trim() ? 'bg-blue-600 hover:bg-blue-500 shadow-lg' : 'bg-[#333] text-gray-500 cursor-not-allowed'}`}
                        >
                            <Send size={18} />
                        </button>
                    </div>
                </div>
            </>
        ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-600 bg-[#131314]">
                <div className="w-20 h-20 bg-[#1e1f20] rounded-full flex items-center justify-center mb-4">
                    <MessageCircle size={40} className="text-gray-500" />
                </div>
                <p className="text-lg font-medium text-gray-400">Select a connection to start chatting</p>
            </div>
        )}
      </div>
    </div>
  );
}