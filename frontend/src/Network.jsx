import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { UserPlus, Check, X, Search, Users } from 'lucide-react';

export default function Network({ session }) {
  const [users, setUsers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchUsers();
    fetchRequests();
  }, []);

  // 1. Fetch all users who are NOT me and NOT already connected
  const fetchUsers = async () => {
    const { data: conns } = await supabase
      .from('connections')
      .select('requester_id, receiver_id')
      .or(`requester_id.eq.${session.user.id},receiver_id.eq.${session.user.id}`);

    const connectedIds = new Set(conns?.map(c => 
      c.requester_id === session.user.id ? c.receiver_id : c.requester_id
    ));
    connectedIds.add(session.user.id);

    const { data } = await supabase.from('profiles').select('*');
    if (data) {
        setUsers(data.filter(u => !connectedIds.has(u.id)));
    }
  };

  // 2. Fetch incoming Friend Requests
  const fetchRequests = async () => {
    const { data } = await supabase
      .from('connections')
      .select('*, profiles:requester_id(full_name, email)')
      .eq('receiver_id', session.user.id)
      .eq('status', 'pending');
    if (data) setRequests(data);
  };

  const sendRequest = async (userId) => {
    await supabase.from('connections').insert({
      requester_id: session.user.id,
      receiver_id: userId
    });
    alert("Request Sent!");
    fetchUsers();
  };

  const respondToRequest = async (id, status) => {
    if (status === 'accepted') {
        await supabase.from('connections').update({ status: 'accepted' }).eq('id', id);
    } else {
        await supabase.from('connections').delete().eq('id', id);
    }
    fetchRequests();
  };

  return (
    <div className="max-w-4xl mx-auto p-6 pb-32">
      
      {/* SECTION 1: INCOMING REQUESTS */}
      {requests.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Users className="text-purple-400" /> Connection Requests
          </h2>
          <div className="grid gap-3">
            {requests.map(req => (
              <div key={req.id} className="bg-[#1e1f20] border border-[#333] p-4 rounded-xl flex justify-between items-center">
                <div>
                  <h3 className="text-white font-medium">{req.profiles.full_name || "Unknown User"}</h3>
                  <p className="text-xs text-gray-500">{req.profiles.email}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => respondToRequest(req.id, 'accepted')} className="p-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30"><Check size={18}/></button>
                  <button onClick={() => respondToRequest(req.id, 'rejected')} className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30"><X size={18}/></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 2: DISCOVER PEOPLE */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-semibold text-white">Find People</h1>
        <div className="relative">
            <Search className="absolute left-3 top-2.5 text-gray-500" size={16} />
            <input 
                type="text" 
                placeholder="Search students..." 
                className="bg-[#1e1f20] border border-[#333] rounded-full py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 w-64"
                onChange={(e) => setSearch(e.target.value.toLowerCase())}
            />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {users.filter(u => (u.full_name || u.email || "").toLowerCase().includes(search)).map(user => (
          
          // --- THIS IS THE UPDATED BLOCK YOU WANTED TO INSERT ---
          <div key={user.id} className="bg-[#1e1f20] border border-[#333] p-5 rounded-xl hover:border-gray-500 transition-all flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Avatar Circle */}
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold shrink-0">
                {/* Fallback to 'U' if no name/email */}
                {(user.full_name?.[0] || user.email?.[0] || "U").toUpperCase()}
              </div>
              
              <div className="overflow-hidden">
                {/* Show Full Name or fallback to Email Prefix */}
                <h3 className="text-white font-medium truncate w-32 md:w-48">
                  {user.full_name || user.email?.split('@')[0] || "Student"}
                </h3>
                {/* Show Degree or Email */}
                <p className="text-xs text-gray-500 truncate w-32 md:w-48">
                  {user.degree || user.email || "Campus Member"}
                </p>
              </div>
            </div>
            
            <button 
              onClick={() => sendRequest(user.id)}
              className="flex items-center gap-2 bg-[#2a2b2e] hover:bg-[#333] text-blue-400 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0"
            >
              <UserPlus size={14} /> Connect
            </button>
          </div>
          // --- END OF UPDATED BLOCK ---

        ))}
      </div>
    </div>
  );
}