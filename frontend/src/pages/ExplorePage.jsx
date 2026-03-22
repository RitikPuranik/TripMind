import { useState, useCallback, useRef } from 'react'
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

export default function ExplorePage() {
  const { coords, locationName } = useLocation()

  // Individual selectors
  const suggestions          = useStore(s => s.suggestions)
  const setSuggestions       = useStore(s => s.setSuggestions)
  const suggestionsLoading   = useStore(s => s.suggestionsLoading)
  const setSuggestionsLoading = useStore(s => s.setSuggestionsLoading)
  const budgetLevel          = useStore(s => s.preferences.budget_level)
  const dietary              = useStore(s => s.preferences.dietary)
  const interests            = useStore(s => s.preferences.interests)
  const addThumb             = useStore(s => s.addThumb)
  const weather              = useStore(s => s.weather)

  const [input,         setInput]         = useState('')
  const [hiddenGems,    setHiddenGems]    = useState(false)
  const [groupMode,     setGroupMode]     = useState(false)
  const [groupProfiles, setGroupProfiles] = useState([{ name:'', dietary:'', interests:'' }])

  const search = useCallback(async (vibe) => {
    if (!coords) { toast.error('Location not available'); return }
    setSuggestionsLoading(true)
    try {
      const cur = weather?.current
      const data = await suggestionsAPI.get({
        lat: coords.lat, lng: coords.lng, city: locationName,
        free_minutes: 180,
        weather_code: cur?.weathercode || 0,
        temperature: cur?.temperature_2m || 28,
        budget_level: budgetLevel,
        dietary,
        interests: interests || [],
        vibe: vibe || null,
        hidden_gems_only: hiddenGems,
        group_profiles: groupMode ? groupProfiles.filter(p=>p.name) : null,
      })
      setSuggestions(data)
    } catch { toast.error('Search failed') }
    setSuggestionsLoading(false)
  }, [coords?.lat, coords?.lng, hiddenGems, groupMode, groupProfiles]) // eslint-disable-line

  const handleThumb = useCallback((id, vote) => {
    const s = suggestions.find(x => x.id === id)
    if (s) addThumb({ id, name: s.name, type: s.place_type, v: vote })
    if (vote === 'down') setSuggestions(suggestions.filter(x => x.id !== id))
    suggestionsAPI.feedback(id, vote).catch(() => {})
  }, [suggestions]) // eslint-disable-line

  return (
    <div style={{ maxWidth:800 }}>
      <h1 style={{ fontFamily:'var(--font-display)', fontSize:28, fontWeight:600, letterSpacing:'-0.5px', marginBottom:6 }}>Explore</h1>
      <p style={{ fontSize:13, color:'var(--ink-muted)', marginBottom:24 }}>Find places near {locationName||'you'} — describe any vibe in any language</p>

      <div style={{ display:'flex', gap:10, marginBottom:16 }}>
        <input value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>{if(e.key==='Enter'&&input.trim()){search(input);setInput('')}}}
          placeholder="'koi chill jagah batao' or 'quiet café with WiFi'…"
          style={{ flex:1, padding:'13px 16px', borderRadius:14, border:'1px solid var(--border)', background:'var(--white)', fontSize:13, fontFamily:'var(--font-body)', color:'var(--ink)', outline:'none', boxShadow:'var(--shadow-sm)' }}
          onFocus={e=>e.target.style.borderColor='var(--gold)'} onBlur={e=>e.target.style.borderColor='var(--border)'}
        />
        <Btn onClick={()=>{search(input);setInput('')}} variant="primary" style={{ padding:'0 20px' }}>Search</Btn>
      </div>

      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
        {QUICK_VIBES.map(v=>(
          <button key={v.label} onClick={()=>search(v.vibe)} style={{ padding:'6px 14px', borderRadius:20, border:'1px solid var(--border)', background:'var(--white)', fontSize:12, cursor:'pointer', fontFamily:'var(--font-body)', color:'var(--ink-soft)', transition:'all 0.15s' }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--gold)';e.currentTarget.style.background='var(--gold-pale)'}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.background='var(--white)'}}
          >{v.label}</button>
        ))}
      </div>

      <div style={{ display:'flex', gap:12, marginBottom:20 }}>
        {[{label:'🔮 Hidden gems only',val:hiddenGems,set:setHiddenGems},{label:'👥 Group mode',val:groupMode,set:setGroupMode}].map(t=>(
          <button key={t.label} onClick={()=>t.set(v=>!v)} style={{ padding:'6px 14px', borderRadius:10, border:`1px solid ${t.val?'var(--gold)':'var(--border)'}`, background:t.val?'var(--gold-light)':'var(--white)', fontSize:12, cursor:'pointer', fontFamily:'var(--font-body)', color:'var(--ink)', fontWeight:t.val?500:400 }}>{t.label}</button>
        ))}
      </div>

      {groupMode && (
        <div style={{ background:'var(--cream)', borderRadius:14, padding:16, marginBottom:20, border:'1px solid var(--border)' }}>
          <div style={{ fontSize:13, fontWeight:500, marginBottom:12 }}>👥 Group Profiles</div>
          {groupProfiles.map((p,i)=>(
            <div key={i} style={{ display:'flex', gap:8, marginBottom:8 }}>
              {['name','dietary','interests'].map(f=>(
                <input key={f} value={p[f]} onChange={e=>{const arr=[...groupProfiles];arr[i]={...arr[i],[f]:e.target.value};setGroupProfiles(arr)}}
                  placeholder={f==='name'?`Person ${i+1}`:f==='dietary'?'Dietary':'Interests'}
                  style={{ flex:1, padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', fontSize:12, fontFamily:'var(--font-body)', outline:'none' }}
                />
              ))}
            </div>
          ))}
          <button onClick={()=>setGroupProfiles(p=>[...p,{name:'',dietary:'',interests:''}])} style={{ fontSize:12, color:'var(--gold)', border:'none', background:'none', cursor:'pointer', padding:0 }}>+ Add person</button>
        </div>
      )}

      <SectionHeader title="Results" action={()=>search(input)} actionLabel="↺ Refresh"/>

      {suggestionsLoading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {[1,2,3,4].map(i=>(
            <div key={i} style={{ display:'flex', gap:12, padding:14, borderRadius:12, border:'1px solid var(--border)', background:'var(--white)' }}>
              <Skeleton width={44} height={44} radius={10} style={{ flexShrink:0 }}/>
              <div style={{ flex:1 }}><Skeleton width="65%" height={14} style={{ marginBottom:8 }}/><Skeleton width="90%" height={11}/></div>
            </div>
          ))}
        </div>
      ) : suggestions.length===0 ? (
        <EmptyState icon="🧭" title="Start exploring" desc="Use the search bar or tap a vibe above."/>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {suggestions.map(s=><SuggestionCard key={s.id} s={s} onThumb={handleThumb}/>)}
        </div>
      )}
    </div>
  )
}
