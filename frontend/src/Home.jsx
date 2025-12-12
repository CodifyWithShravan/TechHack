import { Shield, MessageSquare, Plus, FileText } from 'lucide-react';

export default function Home({ userName, onNavigate }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4 fade-in">
      <div className="mb-8">
        <div className="w-20 h-20 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-blue-900/20">
          <Shield size={40} className="text-white" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">
          Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">{userName}</span>
        </h1>
        <p className="text-gray-400 text-lg max-w-lg mx-auto">
          Your centralized hub for campus knowledge, documents, and student assistance.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
        <button 
          onClick={() => onNavigate('new_chat')}
          className="group relative overflow-hidden bg-[#1e1f20] hover:bg-[#2a2b2e] border border-[#333] p-6 rounded-2xl text-left transition-all hover:border-blue-500/50"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Plus size={64} />
          </div>
          <div className="p-2 bg-blue-500/20 w-fit rounded-lg mb-4 text-blue-400">
            <MessageSquare size={24} />
          </div>
          <h3 className="text-xl font-semibold text-white mb-1">Start New Chat</h3>
          <p className="text-sm text-gray-500">Ask about syllabi, rules, or lab schedules.</p>
        </button>

        <button 
          onClick={() => onNavigate('vault')}
          className="group relative overflow-hidden bg-[#1e1f20] hover:bg-[#2a2b2e] border border-[#333] p-6 rounded-2xl text-left transition-all hover:border-green-500/50"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <FileText size={64} />
          </div>
          <div className="p-2 bg-green-500/20 w-fit rounded-lg mb-4 text-green-400">
            <Shield size={24} />
          </div>
          <h3 className="text-xl font-semibold text-white mb-1">Open Vault</h3>
          <p className="text-sm text-gray-500">Access your saved certificates & docs.</p>
        </button>
      </div>
    </div>
  );
}