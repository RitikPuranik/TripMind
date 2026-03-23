import { useEffect, useState, useCallback, useRef } from 'react'
import { useStore } from '../store'
import { useLocation, useWeather } from '../hooks'
import { suggestionsAPI, prefsAPI } from '../services/api'
import { Card, CardTitle, SuggestionCard, SectionHeader, Skeleton, EmptyState } from '../components/UI'
import toast from 'react-hot-toast'

const WMO = {0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Foggy',51:'Light drizzle',53:'Drizzle',61:'Light rain',63:'Moderate rain',65:'Heavy rain',71:'Light snow',80:'Showers',95:'Thunderstorm'}
const WMO_ICON = c => c>=95?'⛈️':c>=80?'🌦️':c>=71?'❄️':c>=51?'🌧️':c>=45?'🌫️':c>=3?'⛅':c>=2?'🌤️':'☀️'
const ECOLS = ['#C8A96A','#8FA68A','#7BA3C4','#D4907A','#9B8EC4']
const fmt = dt => new Date(dt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})

export default function HomePage() {
  const { coords, locationName, locationDenied, locating } = useLocation()
  const { weather, loading: wLoading } = useWeather()

  // Local state — Home has its own results, doesn't bleed into Explore
  const [suggestions,         setSuggestions]        = useState([])
  const [suggestionsLoading,  setSuggestionsLoading] = useState(false)
  const budgetLevel          = useStore(s => s.preferences.budget_level)
  const dietary              = useStore(s => s.preferences.dietary)
  const interests            = useStore(s => s.preferences.interests)
  const addThumb             = useStore(s => s.addThumb)
  const trips                = useStore(s => s.trips)
  const activeTrip           = useStore(s => s.activeTrip)
  const user                 = useStore(s => s.user)

  // Manual meetings state (replaces Google Calendar)
  const [meetings, setMeetings]       = useState([])
  const [addingMeeting, setAddingMeeting] = useState(false)
  const [meetingForm, setMeetingForm] = useState({ title:'', time:'', end_time:'', location:'' })
  const [vibeInput, setVibeInput]     = useState('')
  const hasFetchedSuggestions         = useRef(false)

  const fetchSuggestions = async (vibeArg) => {
    const vibe = (vibeArg && typeof vibeArg === 'string') ? vibeArg : undefined
    // Need either real coords OR a real city name — never use fallback India coords
    if (!coords && !locationName) {
      if (!locationDenied) toast('Getting your location…')
      return
    }
    if (suggestionsLoading) return
    setSuggestionsLoading(true)
    try {
      const cur = weather?.current
      // Always pass city name — Groq uses this as primary context
      // coords are secondary (for distance calc), city name drives the suggestions
      const data = await suggestionsAPI.get({
        lat: coords?.lat || 20.5937,
        lng: coords?.lng || 78.9629,
        city: locationName || '',   // THIS is what Groq uses to pick the city
        free_minutes: 120,
        weather_code: cur?.weathercode || 0,
        temperature: cur?.temperature_2m || 28,
        budget_level: budgetLevel || 'mid-range',
        dietary: dietary || 'no restrictions',
        interests: interests || [],
        vibe: vibe ? `${vibe} in ${locationName || ''}`.trim() : null,
        hidden_gems_only: false,
      })
      setSuggestions(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Suggestions error:', err?.response?.data || err?.message || err)
      toast.error('Could not load suggestions')
    }
    setSuggestionsLoading(false)
  }

  useEffect(() => {
    // Trigger when we have a real city name from GPS reverse geocoding
    if (!locationName || hasFetchedSuggestions.current) return
    hasFetchedSuggestions.current = true
    fetchSuggestions()
  }, [locationName]) // eslint-disable-line

  const handleThumb = (id, vote) => {
    // Use functional updater to always get fresh suggestions list
    setSuggestions(prev => {
      const s = prev.find(x => x.id === id)
      if (!s) return prev
      addThumb({ id, name: s.name, type: s.place_type, v: vote })
      suggestionsAPI.feedback(id, vote).catch(() => {})
      if (vote === 'down') return prev.filter(x => x.id !== id)
      return prev  // thumbs up keeps card, visual feedback handled in SuggestionCard
    })
  }

  const addMeeting = () => {
    if (!meetingForm.title.trim()) { toast.error('Enter a meeting title'); return }
    setMeetings(prev => [...prev, { ...meetingForm, id: Date.now() }])
    setMeetingForm({ title:'', time:'', end_time:'', location:'' })
    setAddingMeeting(false)
    toast.success('Meeting added')
  }

  const removeMeeting = (id) => setMeetings(prev => prev.filter(m => m.id !== id))

  // Detect free slots between meetings
  const getFreeSlots = () => {
    const now = new Date()
    const timed = meetings
      .filter(m => m.time)
      .sort((a,b) => a.time.localeCompare(b.time))
    if (timed.length === 0) return [{ duration_minutes: 180, label: 'Free today' }]
    const slots = []
    let lastEnd = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`
    for (const m of timed) {
      if (m.time > lastEnd) {
        const [sh,sm] = lastEnd.split(':').map(Number)
        const [eh,em] = m.time.split(':').map(Number)
        const mins = (eh*60+em) - (sh*60+sm)
        if (mins >= 30) slots.push({ duration_minutes: mins, label: `${mins}min before "${m.title}"` })
      }
      lastEnd = m.end_time || m.time
    }
    return slots
  }

  const freeSlots = getFreeSlots()
  const cur    = weather?.current
  const code   = cur?.weathercode ?? 0
  const isRain = code >= 51 && code <= 82
  const isHot  = (cur?.temperature_2m ?? 28) > 36

  const h    = new Date().getHours()
  const name = user?.name?.split(' ')[0] || 'Traveler'
  const greeting = h < 12 ? `Good morning, ${name} ☀️` : h < 17 ? `Good afternoon, ${name} 👋` : `Good evening, ${name} 🌙`

  const inputStyle = {
    flex:1, padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)',
    background:'var(--cream)', fontSize:12, fontFamily:'var(--font-body)', outline:'none',
  }

  return (
    <div style={{ maxWidth:1100 }}>
      {/* Greeting */}
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontFamily:'var(--font-display)', fontSize:28, fontWeight:600, letterSpacing:'-0.5px' }}>{greeting}</h1>
        <p style={{ fontSize:13, color:'var(--ink-muted)', marginTop:4 }}>
          {new Date().toLocaleDateString([],{weekday:'long',month:'long',day:'numeric'})}
          {activeTrip && <> · <span style={{color:'var(--gold)'}}>✈️ {activeTrip.destination}</span></>}
        </p>
      </div>

      {/* Weather alerts */}
      {isRain && (
        <div style={{ background:'var(--sky-light)', border:'1px solid rgba(123,163,196,0.3)', borderRadius:12, padding:'12px 16px', marginBottom:12, display:'flex', gap:12 }}>
          <span style={{ fontSize:20 }}>🌧️</span>
          <div><div style={{ fontSize:13, fontWeight:500 }}>Rain expected today</div><div style={{ fontSize:12, color:'var(--ink-muted)' }}>Suggestions switched to indoor venues</div></div>
        </div>
      )}
      {isHot && (
        <div style={{ background:'var(--blush-light)', border:'1px solid rgba(212,144,122,0.3)', borderRadius:12, padding:'12px 16px', marginBottom:12, display:'flex', gap:12 }}>
          <span style={{ fontSize:20 }}>🌡️</span>
          <div><div style={{ fontSize:13, fontWeight:500 }}>Heat alert — {Math.round(cur.temperature_2m)}°C</div><div style={{ fontSize:12, color:'var(--ink-muted)' }}>Prioritising AC venues and shaded spots</div></div>
        </div>
      )}

      {/* ROW 1: Weather + Today's Schedule */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:16, marginBottom:20 }}>

        {/* Weather */}
        <div style={{ background:'linear-gradient(135deg,#1A1A18,#2D3B4A)', borderRadius:20, padding:28, color:'white', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:-30, right:-30, width:160, height:160, background:'radial-gradient(circle,rgba(200,169,106,0.15),transparent 70%)', borderRadius:'50%' }}/>
          {wLoading ? (
            <div style={{ color:'rgba(255,255,255,0.4)', fontSize:14 }}>Fetching weather…</div>
          ) : (
            <>
              <div style={{ fontSize:52, lineHeight:1, marginBottom:6 }}>{WMO_ICON(code)}</div>
              <div style={{ fontFamily:'var(--font-display)', fontSize:60, fontWeight:300, lineHeight:1, letterSpacing:-2 }}>
                {Math.round(cur?.temperature_2m ?? 28)}<sup style={{ fontSize:26, verticalAlign:'super' }}>°C</sup>
              </div>
              <div style={{ fontSize:14, color:'rgba(255,255,255,0.65)', marginTop:4 }}>{WMO[code] || 'Fair weather'}</div>
              <div style={{ fontSize:12, color:'rgba(255,255,255,0.45)', marginTop:2 }}>📍 {locating ? 'Getting your location…' : (locationName || 'Your location')}</div>
              <div style={{ display:'flex', gap:20, marginTop:18 }}>
                {[['Humidity',`${cur?.relative_humidity_2m??'--'}%`],['Wind',`${cur?.wind_speed_10m??'--'} km/h`],['Feels',`${Math.round(cur?.apparent_temperature??cur?.temperature_2m??28)}°`]].map(([l,v])=>(
                  <div key={l}><div style={{ fontSize:11, color:'rgba(255,255,255,0.45)' }}>{l}</div><div style={{ fontSize:15, color:'white', marginTop:2 }}>{v}</div></div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Today's Schedule — manual */}
        <Card style={{ padding:20 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <CardTitle style={{ fontSize:16, marginBottom:0 }}>Today's Schedule</CardTitle>
            <button onClick={() => setAddingMeeting(v=>!v)} style={{
              fontSize:11, padding:'4px 10px', borderRadius:8, border:'1px solid var(--border)',
              background:'var(--cream)', cursor:'pointer', fontFamily:'var(--font-body)', color:'var(--ink-muted)',
            }}>+ Add</button>
          </div>

          {/* Add meeting form */}
          {addingMeeting && (
            <div style={{ background:'var(--cream)', borderRadius:10, padding:10, marginBottom:12, animation:'slideDown 0.2s ease' }}>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <input style={{...inputStyle, flex:'none'}} placeholder="Meeting title *"
                  value={meetingForm.title} onChange={e=>setMeetingForm(p=>({...p,title:e.target.value}))}/>
                <div style={{ display:'flex', gap:6 }}>
                  <input style={inputStyle} type="time" placeholder="Start"
                    value={meetingForm.time} onChange={e=>setMeetingForm(p=>({...p,time:e.target.value}))}/>
                  <input style={inputStyle} type="time" placeholder="End"
                    value={meetingForm.end_time} onChange={e=>setMeetingForm(p=>({...p,end_time:e.target.value}))}/>
                </div>
                <input style={{...inputStyle, flex:'none'}} placeholder="Location (optional)"
                  value={meetingForm.location} onChange={e=>setMeetingForm(p=>({...p,location:e.target.value}))}/>
                <div style={{ display:'flex', gap:6, marginTop:2 }}>
                  <button onClick={addMeeting} style={{ flex:1, padding:'6px', borderRadius:8, border:'none', background:'var(--ink)', color:'white', fontSize:12, cursor:'pointer', fontFamily:'var(--font-body)' }}>Add</button>
                  <button onClick={() => setAddingMeeting(false)} style={{ flex:1, padding:'6px', borderRadius:8, border:'1px solid var(--border)', background:'none', fontSize:12, cursor:'pointer', fontFamily:'var(--font-body)' }}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          {meetings.length === 0 ? (
            <div style={{ textAlign:'center', padding:'20px 0', color:'var(--ink-muted)', fontSize:13 }}>
              <div style={{ fontSize:28, marginBottom:8 }}>📅</div>
              No meetings today — free to explore!
            </div>
          ) : meetings.map((m,i) => (
            <div key={m.id} style={{ display:'flex', gap:10, alignItems:'flex-start', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
              <span style={{ fontSize:11, color:'var(--ink-muted)', minWidth:44, paddingTop:2, fontWeight:500 }}>
                {m.time || 'Anytime'}
              </span>
              <span style={{ width:7, height:7, borderRadius:'50%', background:ECOLS[i%5], flexShrink:0, marginTop:5 }}/>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:500 }}>{m.title}</div>
                {m.location && <div style={{ fontSize:11, color:'var(--ink-muted)' }}>📍 {m.location}</div>}
              </div>
              <button onClick={() => removeMeeting(m.id)} style={{ border:'none', background:'none', cursor:'pointer', color:'var(--ink-faint)', fontSize:14, padding:'0 4px' }}>×</button>
            </div>
          ))}
        </Card>
      </div>

      {/* ROW 2: Smart Suggestions */}
      <div style={{ marginBottom:20 }}>
        <SectionHeader title="Smart Suggestions" action={() => fetchSuggestions()} actionLabel="↺ Refresh"/>

        {/* Free time banner */}
        {freeSlots.length > 0 && freeSlots[0].duration_minutes >= 30 && (
          <div style={{ background:'linear-gradient(135deg,var(--gold-pale),#FFF8ED)', border:'1px solid rgba(200,169,106,0.3)', borderRadius:14, padding:'12px 18px', marginBottom:12, display:'flex', alignItems:'center', gap:14 }}>
            <span style={{ fontSize:20 }}>⏰</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:500 }}>You have {freeSlots[0].duration_minutes} mins free</div>
              <div style={{ fontSize:11, color:'var(--ink-muted)' }}>{freeSlots[0].label}</div>
            </div>
            <button onClick={() => fetchSuggestions()} style={{ padding:'7px 14px', borderRadius:10, border:'none', background:'var(--ink)', color:'white', fontSize:12, fontWeight:500, cursor:'pointer', fontFamily:'var(--font-body)', whiteSpace:'nowrap' }}>
              Suggest Now
            </button>
          </div>
        )}

        {/* Unified search — vibe + specific place in one bar */}
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:11, color:'var(--ink-muted)', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:6 }}>
            Search by vibe or place name
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <input value={vibeInput} onChange={e=>setVibeInput(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter'&&vibeInput.trim()){fetchSuggestions(vibeInput);setVibeInput('')}}}
              placeholder={`"Starbucks" · "koi chill jagah" · "best biryani near me" · "rooftop café"`}
              style={{ flex:1, padding:'11px 16px', borderRadius:12, border:'1px solid var(--border)', background:'var(--white)', fontSize:13, fontFamily:'var(--font-body)', color:'var(--ink)', outline:'none', boxShadow:'var(--shadow-sm)' }}
              onFocus={e=>e.target.style.borderColor='var(--gold)'} onBlur={e=>e.target.style.borderColor='var(--border)'}
            />
            <button onClick={()=>{if(vibeInput.trim()){fetchSuggestions(vibeInput);setVibeInput('')}}} style={{
              padding:'0 18px', borderRadius:12, border:'none', background:'var(--ink)',
              color:'white', fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'var(--font-body)', whiteSpace:'nowrap',
            }}>Search</button>
          </div>
          <div style={{ fontSize:11, color:'var(--ink-muted)', marginTop:5 }}>
            Works for specific places, vibes, cuisines, and any language
          </div>
        </div>

        {/* Results */}
        {suggestionsLoading ? (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            {[1,2,3,4].map(i=>(
              <div key={i} style={{ display:'flex', gap:12, padding:14, borderRadius:12, border:'1px solid var(--border)', background:'var(--white)' }}>
                <Skeleton width={44} height={44} radius={10} style={{ flexShrink:0 }}/>
                <div style={{ flex:1 }}><Skeleton width="70%" height={14} style={{ marginBottom:8 }}/><Skeleton width="90%" height={11} style={{ marginBottom:6 }}/><Skeleton width="50%" height={11}/></div>
              </div>
            ))}
          </div>
        ) : suggestions.length===0 ? (
          locationDenied ? (
            <div style={{ textAlign:'center', padding:'40px 20px', color:'var(--ink-muted)' }}>
              <div style={{ fontSize:40, marginBottom:12 }}>📍</div>
              <div style={{ fontFamily:'var(--font-display)', fontSize:18, color:'var(--ink)', marginBottom:8 }}>Location access needed</div>
              <div style={{ fontSize:13, marginBottom:16, lineHeight:1.5 }}>
                TripMind needs your location to suggest nearby places.<br/>
                Please allow location access in your browser settings and refresh.
              </div>
              <button onClick={() => window.location.reload()} style={{
                padding:'10px 24px', borderRadius:12, border:'none',
                background:'var(--ink)', color:'white', fontSize:13,
                fontWeight:500, cursor:'pointer', fontFamily:'var(--font-body)',
              }}>Allow Location & Refresh</button>
            </div>
          ) : (
            <EmptyState icon="🗺️" title="No suggestions yet" desc="Click Refresh or type a vibe above." action={() => fetchSuggestions()} actionLabel="Get Suggestions"/>
          )
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            {suggestions.map(s=><SuggestionCard key={s.id} s={s} onThumb={handleThumb}/>)}
          </div>
        )}
      </div>

      {/* Trips summary */}
      <Card>
        <CardTitle>My Trips</CardTitle>
        {trips.length===0 ? (
          <div style={{ textAlign:'center', padding:'12px 0', color:'var(--ink-muted)', fontSize:13 }}>
            <div style={{ fontSize:24, marginBottom:6 }}>✈️</div>Go to Trips tab to add your journeys
          </div>
        ) : trips.slice(0,4).map((t,i)=>(
          <div key={t.id||i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
            <div>
              <div style={{ fontSize:13, fontWeight:500 }}>{t.destination}</div>
              <div style={{ fontSize:11, color:'var(--ink-muted)' }}>
                {t.start_date ? new Date(t.start_date).toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'}) : 'Date TBD'}
              </div>
            </div>
            <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:500, background:t.status==='active'?'var(--sage-light)':t.status==='past'?'var(--cream)':'var(--gold-light)', color:t.status==='active'?'var(--sage)':t.status==='past'?'var(--ink-muted)':'var(--gold-deep)' }}>
              {t.status==='active'?'🟢 Now':t.status==='past'?'✓ Done':'📅 Soon'}
            </span>
          </div>
        ))}
      </Card>
    </div>
  )
}