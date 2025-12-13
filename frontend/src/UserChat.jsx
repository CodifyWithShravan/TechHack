import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import { Send, User, MessageCircle } from 'lucide-react';

export default function UserChat({ session }) {
  const [connections, setConnections] = useState([]);
  const [activeChat, setActiveChat] = useState(null); // The user object you are talking to
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef();

  useEffect(() => {
    fetchConnections();
  }, []);

  useEffect(() => {
    if (activeChat) {
      fetchMessages(activeChat.id);
      
      // REAL-TIME SUBSCRIPTION
      const channel = supabase.channel('dm_channel')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, payload => {
            if (payload.new.sender_id === activeChat.id || payload.new.sender_id === session.user.id) {
                setMessages(prev => [...prev, payload.new]);
            }
        })
        .subscribe();

      return () => supabase.removeChannel(channel);
    }
  }, [activeChat]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchConnections = async () => {
    // Complex query: Find connections where status is 'accepted' AND (I am sender OR receiver)
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
        // Normalize the list so it just shows "The Other Person"
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
    
    await supabase.from('direct_messages').insert({
        sender_id: session.user.id,
        receiver_id: activeChat.id,
        content: input
    });
    setInput('');
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
                    <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-white">
                        {u.email[0].toUpperCase()}
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
                <div className="h-16 border-b border-[#333] flex items-center px-6 bg-[#1e1f20]">
                    <button onClick={() => setActiveChat(null)} className="md:hidden mr-4 text-gray-400">←</button>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs">
                            {activeChat.email[0]}
                        </div>
                        <span className="text-white font-bold">{activeChat.full_name || activeChat.email}</span>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#131314]">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.sender_id === session.user.id ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm ${msg.sender_id === session.user.id ? 'bg-blue-600 text-white rounded-br-none' : 'bg-[#2a2b2e] text-gray-200 rounded-bl-none'}`}>
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
                            className="flex-1 bg-[#131314] text-white rounded-full px-4 py-3 focus:outline-none border border-[#333] focus:border-blue-500"
                            placeholder="Type a message..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                        />
                        <button onClick={sendMessage} className="p-3 bg-blue-600 hover:bg-blue-500 rounded-full text-white transition-colors">
                            <Send size={18} />
                        </button>
                    </div>
                </div>
            </>
        ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-600">
                <MessageCircle size={48} className="mb-4 opacity-20" />
                <p>Select a connection to start chatting.</p>
            </div>
        )}
      </div>
    </div>
  );
}