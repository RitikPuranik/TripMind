import { useState, useCallback, useEffect } from 'react'
import { useStore } from '../store'
import { useLocation } from '../hooks'
import { suggestionsAPI } from '../services/api'
import { SuggestionCard, SectionHeader, EmptyState, Btn, Skeleton } from '../components/UI'
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

  // Local state — Explore has its own results, doesn't share with Home
  const [suggestions,        setSuggestions]        = useState([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const budgetLevel           = useStore(s => s.preferences.budget_level)
  const dietary               = useStore(s => s.preferences.dietary)
  const interests             = useStore(s => s.preferences.interests)
  const addThumb              = useStore(s => s.addThumb)
  const weather               = useStore(s => s.weather)
  const trips                 = useStore(s => s.trips)

  const validTrips = trips.filter(t => getTripStatus(t) !== 'past')
  const activeTrip = trips.find(t => getTripStatus(t) === 'active')

  const [selectedTripId, setSelectedTripId] = useState(activeTrip?.id || '__current_location__')
  const [query,          setQuery]          = useState('')  // single unified input
  const [hiddenGems,     setHiddenGems]     = useState(false)
  const [groupMode,      setGroupMode]      = useState(false)
  const [groupProfiles,  setGroupProfiles]  = useState([{ name:'', dietary:'', interests:'' }])

  useEffect(() => {
    if (activeTrip && selectedTripId === '__current_location__') {
      setSelectedTripId(activeTrip.id)
    }
  }, [activeTrip?.id])  // eslint-disable-line

  const getSearchContext = () => {
    if (selectedTripId === '__current_location__' || validTrips.length === 0) {
      return { lat: coords?.lat, lng: coords?.lng, city: locationName || '', label: locationName || 'Your location', isTrip: false }
    }
    const trip = trips.find(t => t.id === selectedTripId)
    if (!trip) return { lat: coords?.lat, lng: coords?.lng, city: locationName, label: locationName, isTrip: false }
    return { lat: coords?.lat, lng: coords?.lng, city: trip.city || trip.destination, label: trip.destination, isTrip: true, trip }
  }

  const search = useCallback(async (queryText) => {
    const ctx = getSearchContext()
    const q = (queryText || query || '').trim()
    if (!ctx.city && !ctx.lat) { toast.error('Location not available'); return }
    if (!q) { toast.error('Type something to search'); return }

    setSuggestionsLoading(true)
    try {
      const cur = weather?.current
      // Single smart vibe — works for both "Starbucks" and "quiet café with wifi"
      const smartVibe = `${q} in ${ctx.city || ctx.label}`
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
        vibe: smartVibe,
        hidden_gems_only: hiddenGems,
        group_profiles: groupMode ? groupProfiles.filter(p => p.name) : null,
      })
      // Deduplicate by name to prevent same place appearing twice
      const seen = new Set()
      const deduped = (Array.isArray(data) ? data : []).filter(s => {
        const key = (s.name || s.id || '').toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      setSuggestions(deduped)
    } catch { toast.error('Search failed') }
    setSuggestionsLoading(false)
  }, [query, selectedTripId, coords?.lat, coords?.lng, hiddenGems, groupMode, groupProfiles]) // eslint-disable-line

  const handleThumb = (id, vote) => {
    const found = suggestions.find(x => x.id === id)
    if (!found) return
    addThumb({ id, name: found.name, type: found.place_type, v: vote })
    suggestionsAPI.feedback(id, vote).catch(() => {})
    if (vote === 'down') {
      setSuggestions(prev => prev.filter(x => x.id !== id))
    }
  }

  const ctx = getSearchContext()

  return (
    <div style={{ maxWidth:800 }}>
      <h1 style={{ fontFamily:'var(--font-display)', fontSize:28, fontWeight:600, letterSpacing:'-0.5px', marginBottom:6 }}>
        Explore
      </h1>
      <p style={{ fontSize:13, color:'var(--ink-muted)', marginBottom:20 }}>
        Search by vibe or by specific place name — works for any language
      </p>

      {/* Location / Trip selector */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:11, color:'var(--ink-muted)', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:8 }}>
          Exploring in
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
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
                fontWeight: isSelected ? 500 : 400, color: 'var(--ink)',
              }}>
                ✈️ {trip.destination}
                <span style={{ fontSize:10, borderRadius:10, padding:'1px 6px', background: status === 'active' ? 'var(--sage)' : 'var(--gold-light)', color: status === 'active' ? 'white' : 'var(--gold-deep)' }}>
                  {status === 'active' ? 'NOW' : 'SOON'}
                </span>
              </button>
            )
          })}
        </div>
        <div style={{ marginTop:10, padding:'10px 14px', borderRadius:10, fontSize:12, background: ctx.isTrip ? 'var(--sky-light)' : 'var(--sage-light)', border: `1px solid ${ctx.isTrip ? 'rgba(123,163,196,0.3)' : 'rgba(143,166,138,0.3)'}`, color:'var(--ink-soft)' }}>
          {ctx.isTrip ? `✈️ Exploring in ${ctx.label}` : `📍 Exploring near ${ctx.label}`}
        </div>
      </div>

      {/* ── UNIFIED SEARCH BAR ── */}
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:11, color:'var(--ink-muted)', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:6 }}>
          Search by vibe or place name
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && query.trim()) search() }}
            placeholder={ctx.isTrip
              ? `"Starbucks" · "best biryani" · "Van Vihar" · "rooftop café in ${ctx.label}"`
              : `"Starbucks" · "koi chill jagah" · "best pizza near me" · "quiet café WiFi"`
            }
            style={{
              flex:1, padding:'13px 16px', borderRadius:14,
              border:'1px solid var(--border)', background:'var(--white)',
              fontSize:13, fontFamily:'var(--font-body)', color:'var(--ink)',
              outline:'none', boxShadow:'var(--shadow-sm)',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--gold)'}
            onBlur={e  => e.target.style.borderColor = 'var(--border)'}
          />
          <Btn onClick={() => search()} variant="primary" style={{ padding:'0 24px', whiteSpace:'nowrap' }}>Search</Btn>
        </div>
        <div style={{ fontSize:11, color:'var(--ink-muted)', marginTop:6 }}>
          Works for specific place names, vibes, cuisines, and any language
        </div>
      </div>

      {/* Quick vibe chips */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
        {QUICK_VIBES.map(v => (
          <button key={v.label} onClick={() => { setQuery(v.vibe); search(v.vibe) }} style={{
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
                <input key={f} value={p[f]}
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

      <SectionHeader title="Results" action={() => query.trim() ? search() : null} actionLabel="↺ Refresh"/>

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
          desc={`Type anything above — a place name like "Starbucks", a vibe like "chill café", or even "${ctx.isTrip ? `best food in ${ctx.label}` : 'koi achha jagah batao'}"` }
        />
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {suggestions.map(s => <SuggestionCard key={s.id} s={s} onThumb={handleThumb}/>)}
        </div>
      )}
    </div>
  )
}