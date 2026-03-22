import { useState, useCallback, useEffect } from 'react'
import { useStore } from '../store'
import { useLocation } from '../hooks'
import { suggestionsAPI } from '../services/api'
import { SuggestionCard, SectionHeader, EmptyState, Btn, Skeleton, Badge } from '../components/UI'
import toast from 'react-hot-toast'

const QUICK_VIBES = [
  { label:'☕ Chill café',     vibe:'quiet cozy café' },
  { label:'🍜 Local food',    vibe:'authentic local food not touristy' },
  { label:'🌿 Outdoors',      vibe:'outdoor park or nature' },
  { label:'💼 Work-friendly', vibe:'good WiFi quiet workspace' },
  { label:'🎭 Culture',       vibe:'art culture museum heritage' },
  { label:'💎 Hidden gems',   vibe:'hidden gem locals only no tourists' },
]

function getTripStatus(trip) {
  const now = new Date()
  try {
    const s = new Date(trip.start_date), e = new Date(trip.end_date)
    if (e < now) return 'past'
    if (s <= now && now <= e) return 'active'
    return 'upcoming'
  } catch { return 'upcoming' }
}

export default function ExplorePage() {
  const { coords, locationName } = useLocation()

  const suggestions           = useStore(s => s.suggestions)
  const setSuggestions        = useStore(s => s.setSuggestions)
  const suggestionsLoading    = useStore(s => s.suggestionsLoading)
  const setSuggestionsLoading = useStore(s => s.setSuggestionsLoading)
  const budgetLevel           = useStore(s => s.preferences.budget_level)
  const dietary               = useStore(s => s.preferences.dietary)
  const interests             = useStore(s => s.preferences.interests)
  const addThumb              = useStore(s => s.addThumb)
  const weather               = useStore(s => s.weather)
  const trips                 = useStore(s => s.trips)

  // Active/upcoming trips only (not expired)
  const validTrips = trips.filter(t => getTripStatus(t) !== 'past')
  const activeTrip = trips.find(t => getTripStatus(t) === 'active')

  // Selected trip for explore context — default to active trip if exists
  const [selectedTripId, setSelectedTripId] = useState(activeTrip?.id || '__current_location__')
  const [input,          setInput]          = useState('')
  const [specificPlace,  setSpecificPlace]  = useState('')
  const [hiddenGems,     setHiddenGems]     = useState(false)
  const [groupMode,      setGroupMode]      = useState(false)
  const [groupProfiles,  setGroupProfiles]  = useState([{ name:'', dietary:'', interests:'' }])

  // Update selected trip when trips load
  useEffect(() => {
    if (activeTrip && selectedTripId === '__current_location__') {
      setSelectedTripId(activeTrip.id)
    }
  }, [activeTrip?.id])

  // Resolve which location/city to use for search
  const getSearchContext = () => {
    if (selectedTripId === '__current_location__' || validTrips.length === 0) {
      return {
        lat: coords?.lat,
        lng: coords?.lng,
        city: locationName || '',
        label: locationName || 'Your location',
        isTrip: false,
      }
    }
    const trip = trips.find(t => t.id === selectedTripId)
    if (!trip) return { lat: coords?.lat, lng: coords?.lng, city: locationName, label: locationName, isTrip: false }
    // Use trip city for suggestions — geocode if needed, else use coords as fallback
    return {
      lat: coords?.lat,   // fallback coords (Groq will use city name primarily)
      lng: coords?.lng,
      city: trip.city || trip.destination,
      label: trip.destination,
      isTrip: true,
      trip,
    }
  }

  const search = useCallback(async (vibe, placeName) => {
    const ctx = getSearchContext()
    if (!ctx.lat && !ctx.city) { toast.error('Location not available'); return }
    setSuggestionsLoading(true)
    try {
      const cur = weather?.current
      // If searching for a specific place, use it as the vibe with high specificity
      const searchVibe = placeName
        ? `Find the specific place called "${placeName}" in ${ctx.city}. If it exists, show it first. Then show similar well-known places nearby.`
        : vibe || null
      const data = await suggestionsAPI.get({
        lat: ctx.lat || 20.5937,
        lng: ctx.lng || 78.9629,
        city: ctx.city || '',
        free_minutes: 180,
        weather_code: cur?.weathercode || 0,
        temperature: cur?.temperature_2m || 28,
        budget_level: budgetLevel || 'mid-range',
        dietary: dietary || 'no restrictions',
        interests: interests || [],
        vibe: searchVibe,
        hidden_gems_only: hiddenGems,
        group_profiles: groupMode ? groupProfiles.filter(p => p.name) : null,
      })
      setSuggestions(Array.isArray(data) ? data : [])
    } catch { toast.error('Search failed') }
    setSuggestionsLoading(false)
  }, [selectedTripId, coords?.lat, coords?.lng, hiddenGems, groupMode, groupProfiles]) // eslint-disable-line

  const handleThumb = useCallback((id, vote) => {
    const s = suggestions.find(x => x.id === id)
    if (s) addThumb({ id, name: s.name, type: s.place_type, v: vote })
    if (vote === 'down') setSuggestions(suggestions.filter(x => x.id !== id))
    suggestionsAPI.feedback(id, vote).catch(() => {})
  }, [suggestions]) // eslint-disable-line

  const ctx = getSearchContext()

  return (
    <div style={{ maxWidth:800 }}>
      <h1 style={{ fontFamily:'var(--font-display)', fontSize:28, fontWeight:600, letterSpacing:'-0.5px', marginBottom:6 }}>
        Explore
      </h1>
      <p style={{ fontSize:13, color:'var(--ink-muted)', marginBottom:20 }}>
        Find places — switch between your current location or a trip destination
      </p>

      {/* ── Location / Trip selector ── */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:11, color:'var(--ink-muted)', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:8 }}>
          Exploring in
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>

          {/* Current location option */}
          <button onClick={() => setSelectedTripId('__current_location__')} style={{
            display:'flex', alignItems:'center', gap:6,
            padding:'8px 14px', borderRadius:12, fontSize:13, cursor:'pointer',
            fontFamily:'var(--font-body)', transition:'all 0.15s',
            border: `1px solid ${selectedTripId === '__current_location__' ? 'var(--gold)' : 'var(--border)'}`,
            background: selectedTripId === '__current_location__' ? 'var(--gold-light)' : 'var(--white)',
            fontWeight: selectedTripId === '__current_location__' ? 500 : 400,
            color: 'var(--ink)',
          }}>
            📍 {locationName || 'Current location'}
            {selectedTripId === '__current_location__' && (
              <span style={{ fontSize:10, background:'var(--gold)', color:'white', borderRadius:10, padding:'1px 6px' }}>NOW</span>
            )}
          </button>

          {/* Trip options */}
          {validTrips.map(trip => {
            const status = getTripStatus(trip)
            const isSelected = selectedTripId === trip.id
            return (
              <button key={trip.id} onClick={() => setSelectedTripId(trip.id)} style={{
                display:'flex', alignItems:'center', gap:6,
                padding:'8px 14px', borderRadius:12, fontSize:13, cursor:'pointer',
                fontFamily:'var(--font-body)', transition:'all 0.15s',
                border: `1px solid ${isSelected ? 'var(--sky)' : 'var(--border)'}`,
                background: isSelected ? 'var(--sky-light)' : 'var(--white)',
                fontWeight: isSelected ? 500 : 400,
                color: 'var(--ink)',
              }}>
                ✈️ {trip.destination}
                <span style={{
                  fontSize:10, borderRadius:10, padding:'1px 6px',
                  background: status === 'active' ? 'var(--sage)' : 'var(--gold-light)',
                  color: status === 'active' ? 'white' : 'var(--gold-deep)',
                }}>
                  {status === 'active' ? 'NOW' : 'SOON'}
                </span>
              </button>
            )
          })}
        </div>

        {/* Context banner */}
        <div style={{
          marginTop:10, padding:'10px 14px', borderRadius:10, fontSize:12,
          background: ctx.isTrip ? 'var(--sky-light)' : 'var(--sage-light)',
          border: `1px solid ${ctx.isTrip ? 'rgba(123,163,196,0.3)' : 'rgba(143,166,138,0.3)'}`,
          color: 'var(--ink-soft)',
        }}>
          {ctx.isTrip
            ? `✈️ Showing places in ${ctx.label} — suggestions tailored for your trip`
            : `📍 Showing places near ${ctx.label} — based on your current location`
          }
        </div>
      </div>

      {/* Search bar */}
      <div style={{ display:'flex', gap:10, marginBottom:14 }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && input.trim()) { search(input); setInput('') }}}
          placeholder={ctx.isTrip
            ? `Find places in ${ctx.label}… 'best street food' or 'hidden cafés'`
            : `'koi chill jagah batao' · 'hidden café with WiFi'`
          }
          style={{
            flex:1, padding:'12px 16px', borderRadius:14, border:'1px solid var(--border)',
            background:'var(--white)', fontSize:13, fontFamily:'var(--font-body)',
            color:'var(--ink)', outline:'none', boxShadow:'var(--shadow-sm)',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--gold)'}
          onBlur={e  => e.target.style.borderColor = 'var(--border)'}
        />
        <Btn onClick={() => { search(input); setInput('') }} variant="primary" style={{ padding:'0 20px' }}>Search</Btn>
      </div>

      {/* Specific place search */}
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:11, color:'var(--ink-muted)', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:6 }}>
          Search a Specific Place
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <input value={specificPlace} onChange={e => setSpecificPlace(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && specificPlace.trim()) { search(null, specificPlace); setSpecificPlace('') }}}
            placeholder={`e.g. "Starbucks", "Van Vihar", "Pizza Hut ${ctx.label}"…`}
            style={{
              flex:1, padding:'11px 16px', borderRadius:12, border:'1px solid var(--border)',
              background:'var(--white)', fontSize:13, fontFamily:'var(--font-body)',
              color:'var(--ink)', outline:'none',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--sky)'}
            onBlur={e  => e.target.style.borderColor = 'var(--border)'}
          />
          <button onClick={() => { if (specificPlace.trim()) { search(null, specificPlace); setSpecificPlace('') }}} style={{
            padding:'0 18px', borderRadius:12, border:'none',
            background:'var(--sky)', color:'white', fontSize:13,
            fontWeight:500, cursor:'pointer', fontFamily:'var(--font-body)', whiteSpace:'nowrap',
          }}>Find Place</button>
        </div>
      </div>

      {/* Quick vibes */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:14 }}>
        {QUICK_VIBES.map(v => (
          <button key={v.label} onClick={() => search(v.vibe)} style={{
            padding:'6px 14px', borderRadius:20, border:'1px solid var(--border)',
            background:'var(--white)', fontSize:12, cursor:'pointer',
            fontFamily:'var(--font-body)', color:'var(--ink-soft)', transition:'all 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.background = 'var(--gold-pale)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--white)' }}
          >{v.label}</button>
        ))}
      </div>

      {/* Toggles */}
      <div style={{ display:'flex', gap:12, marginBottom:20 }}>
        {[
          { label:'🔮 Hidden gems only', val:hiddenGems, set:setHiddenGems },
          { label:'👥 Group mode',       val:groupMode,  set:setGroupMode  },
        ].map(t => (
          <button key={t.label} onClick={() => t.set(v => !v)} style={{
            padding:'6px 14px', borderRadius:10, fontSize:12, cursor:'pointer',
            fontFamily:'var(--font-body)', color:'var(--ink)', fontWeight: t.val ? 500 : 400,
            border: `1px solid ${t.val ? 'var(--gold)' : 'var(--border)'}`,
            background: t.val ? 'var(--gold-light)' : 'var(--white)',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Group profiles */}
      {groupMode && (
        <div style={{ background:'var(--cream)', borderRadius:14, padding:16, marginBottom:20, border:'1px solid var(--border)' }}>
          <div style={{ fontSize:13, fontWeight:500, marginBottom:12 }}>👥 Group Profiles</div>
          {groupProfiles.map((p, i) => (
            <div key={i} style={{ display:'flex', gap:8, marginBottom:8 }}>
              {['name','dietary','interests'].map(f => (
                <input key={f}
                  value={p[f]}
                  onChange={e => { const arr = [...groupProfiles]; arr[i] = { ...arr[i], [f]: e.target.value }; setGroupProfiles(arr) }}
                  placeholder={f === 'name' ? `Person ${i+1}` : f === 'dietary' ? 'Dietary' : 'Interests'}
                  style={{ flex:1, padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', fontSize:12, fontFamily:'var(--font-body)', outline:'none' }}
                />
              ))}
            </div>
          ))}
          <button onClick={() => setGroupProfiles(p => [...p, { name:'', dietary:'', interests:'' }])}
            style={{ fontSize:12, color:'var(--gold)', border:'none', background:'none', cursor:'pointer', padding:0 }}>
            + Add person
          </button>
        </div>
      )}

      <SectionHeader title="Results" action={() => search(input)} actionLabel="↺ Refresh"/>

      {suggestionsLoading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ display:'flex', gap:12, padding:14, borderRadius:12, border:'1px solid var(--border)', background:'var(--white)' }}>
              <Skeleton width={44} height={44} radius={10} style={{ flexShrink:0 }}/>
              <div style={{ flex:1 }}><Skeleton width="65%" height={14} style={{ marginBottom:8 }}/><Skeleton width="90%" height={11}/></div>
            </div>
          ))}
        </div>
      ) : suggestions.length === 0 ? (
        <EmptyState icon="🧭" title="Start exploring"
          desc={ctx.isTrip
            ? `Search for places in ${ctx.label} or tap a vibe above`
            : 'Use the search bar or tap a vibe above to find your next spot'
          }
        />
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {suggestions.map(s => <SuggestionCard key={s.id} s={s} onThumb={handleThumb}/>)}
        </div>
      )}
    </div>
  )
}