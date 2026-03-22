import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { authAPI } from '../services/api'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const navigate = useNavigate()
  const token = useStore(s => s.token)

  useEffect(() => { if (token) navigate('/') }, [token])

  const handleLogin = async () => {
    try {
      const url = await authAPI.getLoginUrl()
      window.location.href = url
    } catch (e) {
      toast.error('Could not reach backend. Is the server running?')
    }
  }

  return (
    <div style={{
      minHeight:'100vh', background:'var(--cream)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:20,
    }}>
      <div style={{ width:'100%', maxWidth:420 }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:48 }}>
          <div style={{
            width:72, height:72, borderRadius:20, margin:'0 auto 16px',
            background:'linear-gradient(135deg,#1A1A18,#2D3B4A)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:32,
          }}>✈️</div>
          <h1 style={{ fontFamily:'var(--font-display)', fontSize:36, fontWeight:600, letterSpacing:'-0.5px', color:'var(--ink)' }}>
            Trip<span style={{ color:'var(--gold)' }}>Mind</span>
          </h1>
          <p style={{ fontSize:14, color:'var(--ink-muted)', marginTop:8, lineHeight:1.5 }}>
            Your AI travel companion that reads your emails,<br/>
            listens to your voice, and optimizes every minute
          </p>
        </div>

        {/* Features */}
        {[
          { icon:'📧', title:'Reads your Gmail', desc:'Flights, hotels, visas — auto-detected' },
          { icon:'🎙️', title:'Speaks your language', desc:'Hindi, English, Tamil, Arabic — any mix' },
          { icon:'⚡', title:'Acts before you think', desc:'Rain coming? New city? Meeting gap? It knows' },
          { icon:'🗺️', title:'Plans everything', desc:'Auto-itinerary, budget tracking, real-time adjustments' },
        ].map(f => (
          <div key={f.icon} style={{
            display:'flex', gap:14, alignItems:'flex-start', marginBottom:16,
            padding:'14px 16px', borderRadius:14,
            background:'var(--white)', border:'1px solid var(--border)',
          }}>
            <span style={{ fontSize:22, flexShrink:0 }}>{f.icon}</span>
            <div>
              <div style={{ fontSize:14, fontWeight:500, color:'var(--ink)' }}>{f.title}</div>
              <div style={{ fontSize:12, color:'var(--ink-muted)', marginTop:2 }}>{f.desc}</div>
            </div>
          </div>
        ))}

        {/* Login button */}
        <button onClick={handleLogin} style={{
          width:'100%', padding:'16px', borderRadius:14, border:'none',
          background:'var(--ink)', color:'var(--white)', cursor:'pointer',
          fontSize:15, fontWeight:500, fontFamily:'var(--font-body)',
          marginTop:8, display:'flex', alignItems:'center', justifyContent:'center', gap:10,
          transition:'background 0.2s',
        }}
          onMouseEnter={e=>e.currentTarget.style.background='#2D3B4A'}
          onMouseLeave={e=>e.currentTarget.style.background='var(--ink)'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <p style={{ fontSize:11, color:'var(--ink-faint)', textAlign:'center', marginTop:16, lineHeight:1.5 }}>
          TripMind requests <strong>read-only</strong> access to Gmail and Calendar.<br/>
          We never send, delete or modify any emails.
        </p>
      </div>
    </div>
  )
}
