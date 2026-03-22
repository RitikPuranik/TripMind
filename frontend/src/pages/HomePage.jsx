import { useEffect, useState, useCallback, useRef } from 'react'
import { useStore } from '../store'
import { useLocation, useWeather, useCalendar } from '../hooks'
import { suggestionsAPI, prefsAPI } from '../services/api'
import { Card, CardTitle, SuggestionCard, SectionHeader, Skeleton, EmptyState } from '../components/UI'
import toast from 'react-hot-toast'

const WMO = {0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Foggy',51:'Light drizzle',53:'Drizzle',61:'Light rain',63:'Moderate rain',65:'Heavy rain',71:'Light snow',80:'Showers',95:'Thunderstorm'}
const WMO_ICON = c => c>=95?'⛈️':c>=80?'🌦️':c>=71?'❄️':c>=51?'🌧️':c>=45?'🌫️':c>=3?'⛅':c>=2?'🌤️':'☀️'
const fmt = dt => new Date(dt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})
const ECOLS = ['#C8A96A','#8FA68A','#7BA3C4','#D4907A','#9B8EC4']

export default function HomePage() {
  const { coords, locationName } = useLocation()
  const { weather, loading: wLoading } = useWeather()
  const { calEvents, freeSlots, loading: calLoading } = useCalendar()

  // Single-value selectors only — never destructure from useStore()
  const suggestions          = useStore(s => s.suggestions)
  const setSuggestions       = useStore(s => s.setSuggestions)
  const suggestionsLoading   = useStore(s => s.suggestionsLoading)
  const setSuggestionsLoading = useStore(s => s.setSuggestionsLoading)
  const budgetLevel          = useStore(s => s.preferences.budget_level)
  const dietary              = useStore(s => s.preferences.dietary)
  const interests            = useStore(s => s.preferences.interests)
  const addThumb             = useStore(s => s.addThumb)
  const thumbsLog            = useStore(s => s.thumbsLog)
  const trips                = useStore(s => s.trips)
  const activeTrip           = useStore(s => s.activeTrip)
  const user                 = useStore(s => s.user)

  const [vibeInput, setVibeInput] = useState('')
  const hasFetchedSuggestions = useRef(false)

  const fetchSuggestions = async (vibeArg) => {
    // Normalize: if called from onClick it receives an Event, not a string
    const vibe = (vibeArg && typeof vibeArg === 'string') ? vibeArg : undefined
    if (!coords) { toast.error('Location not available yet'); return }
    if (suggestionsLoading) return  // already in flight
    setSuggestionsLoading(true)
    try {
      const cur = weather?.current
      const data = await suggestionsAPI.get({
        lat: coords.lat,
        lng: coords.lng,
        city: locationName || '',
        free_minutes: (freeSlots && freeSlots[0]) ? freeSlots[0].duration_minutes : 120,
        weather_code: cur?.weathercode || 0,
        temperature: cur?.temperature_2m || 28,
        budget_level: budgetLevel || 'mid-range',
        dietary: dietary || 'no restrictions',
        interests: interests || [],
        vibe: vibe || null,
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
    if (!coords || hasFetchedSuggestions.current) return
    hasFetchedSuggestions.current = true
    fetchSuggestions()
  }, [coords?.lat, coords?.lng]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleThumb = (id, vote) => {
    const s = suggestions.find(x => x.id === id)
    if (!s) return
    addThumb({ id, name: s.name, type: s.place_type, v: vote })
    if (vote === 'down') setSuggestions(suggestions.filter(x => x.id !== id))
    suggestionsAPI.feedback(id, vote).catch(() => {})
    prefsAPI.feedbackSignal(s.place_type, vote).catch(() => {})
  }

  const cur    = weather?.current
  const code   = cur?.weathercode ?? 0
  const isRain = code >= 51 && code <= 82
  const isHot  = (cur?.temperature_2m ?? 28) > 36

  const todayEvents = calEvents.filter(e => {
    try { return new Date(e.start?.dateTime || e.start?.date || e.start).toDateString() === new Date().toDateString() }
    catch { return false }
  })

  const h    = new Date().getHours()
  const name = user?.name?.split(' ')[0] || 'Traveler'
  const greeting = h < 12 ? `Good morning, ${name} ☀️` : h < 17 ? `Good afternoon, ${name} 👋` : `Good evening, ${name} 🌙`

  return (
    <div style={{ maxWidth:1100 }}>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontFamily:'var(--font-display)', fontSize:28, fontWeight:600, letterSpacing:'-0.5px' }}>{greeting}</h1>
        <p style={{ fontSize:13, color:'var(--ink-muted)', marginTop:4 }}>
          {new Date().toLocaleDateString([],{weekday:'long',month:'long',day:'numeric'})}
          {activeTrip && <> · <span style={{color:'var(--gold)'}}>✈️ {activeTrip.destination}</span></>}
        </p>
      </div>

      {isRain && (
        <div style={{ background:'var(--sky-light)', border:'1px solid rgba(123,163,196,0.3)', borderRadius:12, padding:'12px 16px', marginBottom:16, display:'flex', gap:12 }}>
          <span style={{ fontSize:20 }}>🌧️</span>
          <div><div style={{ fontSize:13, fontWeight:500 }}>Rain expected today</div><div style={{ fontSize:12, color:'var(--ink-muted)' }}>Suggestions switched to indoor venues</div></div>
        </div>
      )}
      {isHot && (
        <div style={{ background:'var(--blush-light)', border:'1px solid rgba(212,144,122,0.3)', borderRadius:12, padding:'12px 16px', marginBottom:16, display:'flex', gap:12 }}>
          <span style={{ fontSize:20 }}>🌡️</span>
          <div><div style={{ fontSize:13, fontWeight:500 }}>Heat alert — {Math.round(cur.temperature_2m)}°C</div><div style={{ fontSize:12, color:'var(--ink-muted)' }}>Prioritising AC venues and shaded spots</div></div>
        </div>
      )}

      {freeSlots.length > 0 && (
        <div style={{ background:'linear-gradient(135deg,var(--gold-pale),#FFF8ED)', border:'1px solid rgba(200,169,106,0.3)', borderRadius:14, padding:'14px 18px', marginBottom:20, display:'flex', alignItems:'center', gap:14 }}>
          <span style={{ fontSize:24 }}>⏰</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:500 }}>You have {freeSlots[0].duration_minutes} mins free</div>
            <div style={{ fontSize:12, color:'var(--ink-muted)' }}>{freeSlots[0].label}</div>
          </div>
          <button onClick={() => fetchSuggestions()} style={{ padding:'8px 16px', borderRadius:10, border:'none', background:'var(--ink)', color:'white', fontSize:12, fontWeight:500, cursor:'pointer', fontFamily:'var(--font-body)' }}>
            Suggest Now
          </button>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:16, marginBottom:20 }}>
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
              <div style={{ fontSize:12, color:'rgba(255,255,255,0.45)', marginTop:2 }}>📍 {locationName}</div>
              <div style={{ display:'flex', gap:20, marginTop:18 }}>
                {[['Humidity',`${cur?.relative_humidity_2m??'--'}%`],['Wind',`${cur?.wind_speed_10m??'--'} km/h`],['Feels',`${Math.round(cur?.apparent_temperature??cur?.temperature_2m??28)}°`]].map(([l,v])=>(
                  <div key={l}><div style={{ fontSize:11, color:'rgba(255,255,255,0.45)' }}>{l}</div><div style={{ fontSize:15, color:'white', marginTop:2 }}>{v}</div></div>
                ))}
              </div>
            </>
          )}
        </div>

        <Card style={{ padding:20 }}>
          <CardTitle style={{ fontSize:16, marginBottom:12 }}>Today's Schedule</CardTitle>
          {calLoading ? [1,2,3].map(i=><div key={i} style={{ display:'flex', gap:10, marginBottom:12 }}><Skeleton width={40} height={12}/><Skeleton width={120} height={12}/></div>)
          : todayEvents.length === 0 ? (
            <div style={{ textAlign:'center', padding:'20px 0', color:'var(--ink-muted)', fontSize:13 }}>
              <div style={{ fontSize:28, marginBottom:8 }}>📅</div>Free day!
            </div>
          ) : todayEvents.map((e,i)=>{
            const start = e.start?.dateTime||e.start?.date||e.start
            return (
              <div key={e.id||i} style={{ display:'flex', gap:10, alignItems:'flex-start', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                <span style={{ fontSize:11, color:'var(--ink-muted)', minWidth:44, paddingTop:2, fontWeight:500 }}>{start?.includes('T')?fmt(start):'All day'}</span>
                <span style={{ width:7, height:7, borderRadius:'50%', background:ECOLS[i%5], flexShrink:0, marginTop:5 }}/>
                <div><div style={{ fontSize:13, fontWeight:500 }}>{e.summary||'Event'}</div>{e.location&&<div style={{ fontSize:11, color:'var(--ink-muted)' }}>📍 {e.location}</div>}</div>
              </div>
            )
          })}
        </Card>
      </div>

      <div style={{ marginBottom:20 }}>
        <input value={vibeInput} onChange={e=>setVibeInput(e.target.value)}
          onKeyDown={e=>{if(e.key==='Enter'&&vibeInput.trim()){fetchSuggestions(vibeInput);setVibeInput('')}}}
          placeholder="Describe a vibe… 'koi chill jagah batao' or 'hidden café with WiFi'"
          style={{ width:'100%', padding:'13px 18px', borderRadius:14, border:'1px solid var(--border)', background:'var(--white)', fontSize:13, fontFamily:'var(--font-body)', color:'var(--ink)', outline:'none', boxShadow:'var(--shadow-sm)' }}
          onFocus={e=>e.target.style.borderColor='var(--gold)'} onBlur={e=>e.target.style.borderColor='var(--border)'}
        />
      </div>

      <div style={{ marginBottom:20 }}>
        <SectionHeader title="Smart Suggestions" action={()=>fetchSuggestions()} actionLabel="↺ Refresh"/>
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
          <EmptyState icon="🗺️" title="No suggestions yet" desc="Allow location access or type a vibe above." action={()=>fetchSuggestions()} actionLabel="Get Suggestions"/>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            {suggestions.map(s=><SuggestionCard key={s.id} s={s} onThumb={handleThumb}/>)}
          </div>
        )}
      </div>

      <Card>
        <CardTitle>My Trips</CardTitle>
        {trips.length===0 ? (
          <div style={{ textAlign:'center', padding:'20px 0', color:'var(--ink-muted)', fontSize:13 }}>
            <div style={{ fontSize:32, marginBottom:8 }}>✈️</div>
            <div>No trips yet</div>
            <div style={{ fontSize:11, marginTop:4 }}>Sync Gmail to detect your trips automatically</div>
          </div>
        ) : trips.slice(0,4).map((t,i)=>(
          <div key={t.id||i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
            <div>
              <div style={{ fontSize:13, fontWeight:500 }}>{t.destination}</div>
              <div style={{ fontSize:11, color:'var(--ink-muted)', marginTop:1 }}>
                {t.start_date ? new Date(t.start_date).toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'}) : 'Date TBD'}
                {t.trip_type && t.trip_type !== 'general' ? ' · ' + t.trip_type : ''}
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
