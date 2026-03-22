import { useState, useEffect } from 'react'
import { useStore } from '../store'
import { useVoice } from '../hooks'
import { voiceAPI } from '../services/api'

export default function VoiceModal({ onClose }) {
  const { phase, transcript, detectedLang, response,
          startListening, stopListening, processQuery,
          setPhase, setTranscript } = useVoice()
  const [textInput, setTextInput] = useState('')
  const coords   = useStore(s => s.coords)
  const weather  = useStore(s => s.weather)
  const calEvents = useStore(s => s.calEvents)
  const activeTrip = useStore(s => s.activeTrip)
  const prefs    = useStore(s => s.preferences)

  const context = {
    city: useStore(s => s.locationName),
    weather: weather
      ? `${weather.current?.temperature_2m?.toFixed(0)}°C, code ${weather.current?.weathercode}`
      : 'unknown',
    calendar: calEvents.slice(0,3).map(e=>e.summary).join(', ') || 'No events today',
    trip: activeTrip?.destination || 'none',
    budget_level: prefs.budget_level,
    dietary: prefs.dietary,
  }

  // Auto-process when transcript ready
  useEffect(() => {
    if (phase === 'processing' && transcript) {
      processQuery(transcript, context)
    }
  }, [phase, transcript])

  // TTS — speak the response
  useEffect(() => {
    if (!response?.reply || !window.speechSynthesis) return
    const langMap = { hi:'hi-IN', en:'en-IN', ta:'ta-IN', te:'te-IN', ml:'ml-IN', ar:'ar-SA', fr:'fr-FR' }
    const utter = new SpeechSynthesisUtterance(response.reply)
    utter.lang = langMap[response.reply_language] || 'en-IN'
    utter.rate = 0.95
    window.speechSynthesis.speak(utter)
  }, [response])

  const sendText = () => {
    if (!textInput.trim()) return
    setTranscript(textInput)
    setTextInput('')
    processQuery(textInput, context)
  }

  const phaseLabel = { idle:'Tap to speak', listening:'Listening…', processing:'Thinking…', done:'Here\'s what I found' }
  const orbEmoji   = { idle:'🎙️', listening:'🎤', processing:'🤔', done:'✨' }

  return (
    <div onClick={e => e.target===e.currentTarget && onClose()} style={{
      position:'fixed', inset:0, zIndex:400,
      background:'rgba(26,26,24,0.55)', backdropFilter:'blur(10px)',
      display:'flex', alignItems:'flex-end', justifyContent:'center', padding:20,
      animation:'fadeIn 0.2s ease',
    }}>
      <div style={{
        background:'var(--white)', borderRadius:'24px 24px 20px 20px',
        padding:'28px 28px 32px', width:'100%', maxWidth:480,
        boxShadow:'var(--shadow-xl)', animation:'slideUp 0.3s ease',
      }}>
        {/* Orb */}
        <div style={{
          width:72, height:72, borderRadius:'50%', margin:'0 auto 16px',
          background: phase==='listening'
            ? 'linear-gradient(135deg,#FEE2E2,#C8263A)'
            : phase==='done'
              ? 'linear-gradient(135deg,var(--sage-light),var(--sage))'
              : 'linear-gradient(135deg,var(--gold-light),var(--gold))',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:28,
          animation: phase==='listening' ? 'pulsering 1.2s ease infinite' : phase==='processing' ? 'pulse 1s ease infinite' : 'none',
          transition:'background 0.3s',
        }}>{orbEmoji[phase]}</div>

        <div style={{ fontFamily:'var(--font-display)', fontSize:22, textAlign:'center', fontWeight:500, color:'var(--ink)' }}>
          {phaseLabel[phase]}
        </div>
        <div style={{ fontSize:12, color:'var(--ink-muted)', textAlign:'center', marginTop:4 }}>
          {phase==='idle' && 'Speak in any language — Hindi, English, mixed'}
          {phase==='listening' && 'Speak now… tap Stop when done'}
          {phase==='processing' && 'Processing your request…'}
          {phase==='done' && detectedLang !== 'en' && `Detected: ${detectedLang.toUpperCase()}`}
        </div>

        {/* Transcript */}
        {transcript && (
          <div style={{
            background:'var(--cream)', borderRadius:12, padding:'12px 14px',
            marginTop:16, fontSize:14, color:'var(--ink)',
            border:'1px solid var(--border)', lineHeight:1.5,
          }}>
            <span style={{ fontSize:10, color:'var(--ink-muted)', display:'block', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.5px' }}>You said</span>
            {transcript}
          </div>
        )}

        {/* AI Response */}
        {response?.reply && (
          <div style={{
            background:'var(--sage-light)', borderRadius:12, padding:'12px 14px',
            marginTop:10, fontSize:13, color:'var(--ink-soft)', lineHeight:1.6,
            border:'1px solid rgba(143,166,138,0.25)',
          }}>
            <span style={{ fontSize:10, color:'var(--sage)', display:'block', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.5px', fontWeight:600 }}>TripMind</span>
            {response.reply}
          </div>
        )}

        {/* Text input fallback */}
        {(phase==='idle' || phase==='done') && (
          <div style={{ display:'flex', gap:8, marginTop:16 }}>
            <input
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              onKeyDown={e => e.key==='Enter' && sendText()}
              placeholder="Or type here… (any language)"
              style={{
                flex:1, padding:'10px 14px', borderRadius:12,
                border:'1px solid var(--border)', background:'var(--cream)',
                fontSize:13, fontFamily:'var(--font-body)', color:'var(--ink)', outline:'none',
              }}
            />
            <button onClick={sendText} style={{
              width:40, height:40, borderRadius:10, border:'none',
              background:'var(--ink)', color:'white', cursor:'pointer', fontSize:16,
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>➤</button>
          </div>
        )}

        {/* Actions */}
        <div style={{ display:'flex', gap:10, marginTop:14 }}>
          {phase === 'listening' ? (
            <button onClick={stopListening} style={{
              flex:1, padding:'12px', borderRadius:12, border:'1px solid var(--blush)',
              background:'var(--blush-light)', color:'var(--blush)', cursor:'pointer',
              fontSize:13, fontWeight:500, fontFamily:'var(--font-body)',
            }}>⏹ Stop Listening</button>
          ) : (
            <button onClick={() => { setPhase('idle'); setTranscript(''); startListening() }} style={{
              flex:1, padding:'12px', borderRadius:12, border:'none',
              background:'var(--ink)', color:'white', cursor:'pointer',
              fontSize:13, fontWeight:500, fontFamily:'var(--font-body)',
            }}>{phase==='done' ? '🎤 Ask Again' : '🎤 Start Speaking'}</button>
          )}
          <button onClick={onClose} style={{
            flex:1, padding:'12px', borderRadius:12,
            border:'1px solid var(--border)', background:'var(--cream)',
            color:'var(--ink)', cursor:'pointer', fontSize:13, fontWeight:500, fontFamily:'var(--font-body)',
          }}>Close</button>
        </div>
      </div>
    </div>
  )
}
