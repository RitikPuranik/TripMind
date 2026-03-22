import { useState, useRef, useEffect } from 'react'
import { useStore } from '../store'
import { voiceAPI, prefsAPI } from '../services/api'
import toast from 'react-hot-toast'

const SUGGESTIONS_STARTERS = [
  'What should I do with 2 hours free?',
  'Koi achha café hai nearby?',
  'Best vegetarian restaurants here?',
  'What\'s the weather like for my trip?',
  'I prefer quiet places with good WiFi',
  'Mujhe kuch chill jagah batao',
]

export default function ChatPage() {
  const chatHistory = useStore(s => s.chatHistory)
  const addChatMsg  = useStore(s => s.addChatMsg)
  const clearChat   = useStore(s => s.clearChat)
  const coords      = useStore(s => s.coords)
  const weather     = useStore(s => s.weather)
  const calEvents   = useStore(s => s.calEvents)
  const activeTrip  = useStore(s => s.activeTrip)
  const prefs       = useStore(s => s.preferences)
  const locationName = useStore(s => s.locationName)

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const listRef = useRef(null)

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [chatHistory, loading])

  const context = {
    city: locationName,
    weather: weather?.current ? `${Math.round(weather.current.temperature_2m)}°C, code ${weather.current.weathercode}` : 'unknown',
    calendar: calEvents.slice(0,3).map(e=>e.summary||e.summary).join(', ') || 'No events today',
    trip: activeTrip?.destination || 'none',
    budget_level: prefs.budget_level,
    dietary: prefs.dietary,
    lat: coords?.lat,
    lng: coords?.lng,
  }

  const send = async (text) => {
    const msg = text || input.trim()
    if (!msg || loading) return
    setInput('')
    addChatMsg({ role:'user', text: msg, time: new Date().toISOString() })
    setLoading(true)

    try {
      const result = await voiceAPI.query({
        transcript: msg,
        detected_language: prefs.language || 'en',
        lat: coords?.lat,
        lng: coords?.lng,
        context,
      })
      addChatMsg({ role:'ai', text: result.reply, lang: result.reply_language, action: result.action, time: new Date().toISOString() })

      // Learn preferences
      if (msg.toLowerCase().includes('like') || msg.toLowerCase().includes('prefer') || msg.toLowerCase().includes('love')) {
        prefsAPI.learnFromText(msg).catch(()=>{})
      }
    } catch {
      addChatMsg({ role:'ai', text: 'Sorry, I couldn\'t respond right now. Please try again.', time: new Date().toISOString() })
    }
    setLoading(false)
  }

  const msgs = chatHistory.length > 0 ? chatHistory : [
    { role:'ai', text:`Hi! I'm TripMind ✦ Ask me anything in any language — Hindi, English, Tamil, or mix them freely.\n\nTry: "Koi chill jagah batao nearby" or "What should I do with 2 hours free?"`, time:'' }
  ]

  return (
    <div style={{ maxWidth:680, display:'flex', flexDirection:'column', height:'calc(100vh - 64px - 56px)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h1 style={{ fontFamily:'var(--font-display)', fontSize:28, fontWeight:600, letterSpacing:'-0.5px' }}>Chat</h1>
        {chatHistory.length > 0 && (
          <button onClick={clearChat} style={{ fontSize:12, color:'var(--ink-muted)', border:'none', background:'none', cursor:'pointer' }}>Clear chat</button>
        )}
      </div>

      {/* Messages */}
      <div ref={listRef} style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:10, paddingBottom:8 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role==='user' ? 'flex-end' : 'flex-start',
            maxWidth:'85%', animation:'slideUp 0.2s ease',
          }}>
            <div style={{
              padding:'10px 14px', borderRadius: m.role==='user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
              background: m.role==='user' ? 'var(--ink)' : 'var(--white)',
              color: m.role==='user' ? 'white' : 'var(--ink)',
              border: m.role==='user' ? 'none' : '1px solid var(--border)',
              fontSize:13, lineHeight:1.55, whiteSpace:'pre-wrap',
            }}>
              {m.text}
            </div>
            {m.lang && m.lang !== 'en' && (
              <div style={{ fontSize:10, color:'var(--ink-muted)', marginTop:3, paddingLeft:4 }}>
                replied in {m.lang.toUpperCase()}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf:'flex-start', padding:'12px 16px', borderRadius:'14px 14px 14px 4px', background:'var(--white)', border:'1px solid var(--border)' }}>
            <div style={{ display:'flex', gap:4, alignItems:'center' }}>
              {[0,1,2].map(i => (
                <span key={i} style={{ width:5, height:5, borderRadius:'50%', background:'var(--ink-muted)', display:'inline-block', animation:`bounceDots 1.2s ${i*0.2}s infinite` }}/>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Starter chips */}
      {chatHistory.length === 0 && (
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
          {SUGGESTIONS_STARTERS.map(s => (
            <button key={s} onClick={() => send(s)} style={{
              padding:'6px 12px', borderRadius:20, border:'1px solid var(--border)',
              background:'var(--white)', fontSize:11, cursor:'pointer',
              fontFamily:'var(--font-body)', color:'var(--ink-soft)',
              transition:'all 0.15s',
            }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--gold)';e.currentTarget.style.background='var(--gold-pale)'}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.background='var(--white)'}}
            >{s}</button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ display:'flex', gap:10, paddingTop:12, borderTop:'1px solid var(--border)' }}>
        <input value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&send()}
          placeholder="Ask anything in any language… (Enter to send)"
          style={{
            flex:1, padding:'12px 16px', borderRadius:14, border:'1px solid var(--border)',
            background:'var(--white)', fontSize:13, fontFamily:'var(--font-body)', color:'var(--ink)', outline:'none',
            transition:'border-color 0.2s',
          }}
          onFocus={e=>e.target.style.borderColor='var(--gold)'}
          onBlur={e=>e.target.style.borderColor='var(--border)'}
        />
        <button onClick={() => send()} disabled={loading||!input.trim()} style={{
          width:44, height:44, borderRadius:12, border:'none', background:'var(--ink)',
          color:'white', cursor:'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center',
          opacity: loading||!input.trim() ? 0.5 : 1, transition:'opacity 0.15s',
        }}>➤</button>
      </div>
    </div>
  )
}
