import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [message, setMessage] = useState("Waiting for backend...")
  const [status, setStatus] = useState("Loading...")

  useEffect(() => {
    // 1. Ping the root endpoint
    fetch("http://127.0.0.1:8000/")
      .then((res) => res.json())
      .then((data) => setMessage(data.message))
      .catch((err) => setMessage("❌ Error: Backend not running!"))

    // 2. Ping the test endpoint
    fetch("http://127.0.0.1:8000/api/test")
      .then((res) => res.json())
      .then((data) => setStatus(data.data))
      .catch((err) => setStatus("❌ Connection Failed"))
  }, [])

  return (
    <div style={{ padding: "50px", textAlign: "center" }}>
      <h1>🎓 UniMind Setup</h1>
      
      <div style={{ border: "1px solid #ccc", padding: "20px", marginTop: "20px", borderRadius: "10px" }}>
        <h2>Backend Status:</h2>
        <h3 style={{ color: message.includes("✅") ? "green" : "red" }}>
          {message}
        </h3>
        <p>Data from Python: <strong>{status}</strong></p>
      </div>
    </div>
  )
}

export default App