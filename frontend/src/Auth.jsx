import { useState } from 'react'
import { supabase } from './supabaseClient'
import { Sparkles } from 'lucide-react'

export default function Auth() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)

    let error
    
    if (isSignUp) {
      const { error: signUpError } = await supabase.auth.signUp({ email, password })
      error = signUpError
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      error = signInError
    }

    if (error) {
      alert(error.message)
    } else if (isSignUp) {
      alert('Check your email for the login link!')
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-[#131314] text-[#e3e3e3] p-4">
      <div className="w-full max-w-md bg-[#1e1f20] p-8 rounded-2xl border border-[#333] shadow-2xl">
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center shadow-lg shadow-blue-900/20">
            <Sparkles size={24} className="text-white" />
          </div>
        </div>
        
        <h1 className="text-3xl font-semibold text-center mb-2">Welcome to Campus AI</h1>
        <p className="text-[#8e918f] text-center mb-8">Sign in to access your student assistant.</p>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
            <input
              className="w-full bg-[#131314] border border-[#333] rounded-lg p-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
              type="email"
              placeholder="student@college.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Password</label>
            <input
              className="w-full bg-[#131314] border border-[#333] rounded-lg p-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          
          <button
            className="w-full bg-white text-black font-medium py-3 rounded-lg hover:bg-gray-200 transition-all disabled:opacity-50 mt-4"
            disabled={loading}
          >
            {loading ? 'Processing...' : isSignUp ? 'Sign Up' : 'Log In'}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-[#8e918f]">
          {isSignUp ? "Already have an account?" : "Don't have an account?"} 
          <button 
            onClick={() => setIsSignUp(!isSignUp)} 
            className="text-blue-400 hover:text-blue-300 ml-2 font-medium"
          >
            {isSignUp ? 'Log In' : 'Sign Up'}
          </button>
        </p>
      </div>
    </div>
  )
}