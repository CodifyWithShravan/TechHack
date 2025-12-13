import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Calendar as CalIcon, Clock, Trash2, CheckCircle, ExternalLink, Plus, Save } from 'lucide-react';

export default function Calendar({ session }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // --- MANUAL ADD STATE ---
  const [newTask, setNewTask] = useState('');
  const [newDate, setNewDate] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', session.user.id)
      .order('start_time', { ascending: true });
    
    if (data) setEvents(data);
    setLoading(false);
  };

  const deleteEvent = async (id) => {
    if (!confirm("Delete this task?")) return;
    await supabase.from('events').delete().eq('id', id);
    fetchEvents();
  };

  // --- MANUAL ADD FUNCTION ---
  const handleManualAdd = async () => {
    if (!newTask || !newDate) return alert("Please enter a task and date.");
    setAdding(true);

    try {
      const { error } = await supabase.from('events').insert({
        user_id: session.user.id,
        title: newTask,
        start_time: newDate,
        end_time: newDate, // Same time for simplicity
        is_important: true
      });

      if (error) throw error;
      
      // Reset Form
      setNewTask('');
      setNewDate('');
      fetchEvents(); // Refresh list immediately
    } catch (error) {
      alert("Error adding task");
    } finally {
      setAdding(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    });
  };

  return (
    <div className="max-w-6xl mx-auto p-6 pb-32 h-full flex flex-col gap-6">
      
      {/* SECTION 1: HEADER & MANUAL ADD */}
      <div className="flex flex-col md:flex-row gap-4 items-end justify-between bg-[#1e1f20] p-6 rounded-2xl border border-[#333]">
        <div className="w-full md:w-auto">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2 mb-1">
            <CalIcon className="text-purple-400" /> My Schedule
          </h1>
          <p className="text-gray-400 text-sm">Manage your academic deadlines.</p>
        </div>

        {/* INPUT FORM */}
        <div className="flex gap-2 w-full md:w-auto">
          <input 
            type="text" 
            placeholder="New Task..." 
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            className="bg-[#2a2b2e] border border-[#333] text-white text-sm rounded-lg px-4 py-2 outline-none focus:border-purple-500 w-full md:w-64"
          />
          <input 
            type="datetime-local" 
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="bg-[#2a2b2e] border border-[#333] text-white text-sm rounded-lg px-4 py-2 outline-none focus:border-purple-500 w-auto"
          />
          <button 
            onClick={handleManualAdd} 
            disabled={adding}
            className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {adding ? <Save size={18} className="animate-pulse" /> : <Plus size={18} />}
            <span className="hidden md:inline">Add</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 h-full">
        
        {/* SECTION 2: GOOGLE CALENDAR EMBED (Left Side) */}
        <div className="flex-1 bg-white rounded-xl overflow-hidden shadow-lg border border-[#333] relative min-h-[500px]">
            <div className="absolute top-2 right-2 z-10">
                <a href="https://calendar.google.com" target="_blank" className="bg-blue-600 text-white text-xs px-3 py-1 rounded-full flex items-center gap-1 shadow-md hover:bg-blue-700 transition">
                    Open Google Cal <ExternalLink size={10} />
                </a>
            </div>
            <iframe 
            src="https://calendar.google.com/calendar/embed?src=en.indian%23holiday%40group.v.calendar.google.com&ctz=Asia%2FKolkata" 
            style={{border: 0}} 
            width="100%" 
            height="100%" 
            frameBorder="0" 
            scrolling="no"
            ></iframe>
        </div>

        {/* SECTION 3: TASKS LIST (Right Side) */}
        <div className="w-full lg:w-[350px] flex flex-col">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <CheckCircle className="text-green-400" size={18} /> Tasks & Reminders
            </h2>
            
            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-3 max-h-[500px]">
                {loading ? (
                    <div className="text-gray-500 text-sm text-center py-10">Loading tasks...</div>
                ) : events.length === 0 ? (
                    <div className="p-6 border border-dashed border-[#333] rounded-xl text-center text-gray-500 text-sm">
                        No tasks yet.<br/>Add one manually above or ask the AI!
                    </div>
                ) : (
                    events.map((event) => (
                        <div key={event.id} className="bg-[#1e1f20] border border-[#333] p-4 rounded-xl flex items-start justify-between group hover:border-gray-500 transition-all shadow-sm">
                            <div>
                                <h3 className="text-white font-medium text-sm leading-snug">{event.title}</h3>
                                <p className="text-xs text-gray-400 flex items-center gap-1 mt-2 bg-[#2a2b2e] w-fit px-2 py-1 rounded">
                                    <Clock size={10} /> {formatDate(event.start_time)}
                                </p>
                            </div>
                            <button 
                                onClick={() => deleteEvent(event.id)} 
                                className="text-gray-600 hover:text-red-400 transition-colors p-1"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>

      </div>
    </div>
  );
}