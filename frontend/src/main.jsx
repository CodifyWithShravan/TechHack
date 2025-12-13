import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { GoogleOAuthProvider } from '@react-oauth/google';



createRoot(document.getElementById('root')).render(
<GoogleOAuthProvider clientId="23107945660-8u58sh6a1per3q2sflqvq3dqr3h2p169.apps.googleusercontent.com">
  <App />
</GoogleOAuthProvider>

)
