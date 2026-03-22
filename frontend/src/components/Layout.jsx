import { Outlet, useNavigate, useLocation as useRouterLocation } from 'react-router-dom'
import { useState } from 'react'
import { useStore } from '../store'
import { useLocation, useWeather, useAlerts } from '../hooks'
import VoiceModal from './VoiceModal'
import AlertsPanel from './AlertsPanel'

const NAV = [
  { path:'/',          icon:'🏠', label:'Home' },
  { path:'/trips',     icon:'✈️', label:'Trips' },
  { path:'/explore',   icon:'🧭', label:'Explore' },
  { path:'/itinerary', icon:'🗓️', label:'Itinerary' },
  { path:'/chat',      icon:'💬', label:'Chat' },
  { path:'/analytics', icon:'📊', label:'Analytics' },
]

const wIcon = c => !c?'☀️':c>=95?'⛈️':c>=51?'🌧️':c>=2?'⛅':'☀️'

export default function Layout() {
  const navigate   = useNavigate()
  const routerLoc  = useRouterLocation()

  // Single-value selectors
  const user         = useStore(s => s.user)
  const logout       = useStore(s => s.logout)
  const voiceOpen    = useStore(s => s.voiceOpen)
  const setVoiceOpen = useStore(s => s.setVoiceOpen)

  const { locationName } = useLocation()
  const { weather }      = useWeather()
  const { unreadCount }  = useAlerts()

  const [alertsOpen, setAlertsOpen] = useState(false)
  const [menuOpen,   setMenuOpen]   = useState(false)

  const temp  = weather?.current?.temperature_2m
  const wcode = weather?.current?.weathercode ?? 0

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', background:'var(--cream)' }}>
      <header style={{ position:'fixed', top:0, left:0, right:0, height:64, zIndex:100, background:'rgba(250,250,247,0.92)', backdropFilter:'blur(20px)', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 24px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <span style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:600, letterSpacing:'-0.3px' }}>
            Trip<span style={{ color:'var(--gold)' }}>Mind</span>
          </span>
          {locationName && (
            <span style={{ fontSize:12, color:'var(--ink-muted)', display:'flex', gap:4, alignItems:'center' }}>
              📍 {locationName}
              {temp != null && <span style={{ marginLeft:4 }}>{wIcon(wcode)} {Math.round(temp)}°C</span>}
            </span>
          )}
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <button onClick={() => setAlertsOpen(v=>!v)} style={{ position:'relative', width:38, height:38, borderRadius:10, border:'1px solid var(--border)', background:'var(--white)', cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>
            🔔
            {unreadCount > 0 && <span style={{ position:'absolute', top:-4, right:-4, width:16, height:16, background:'var(--blush)', borderRadius:'50%', fontSize:9, fontWeight:700, color:'white', display:'flex', alignItems:'center', justifyContent:'center' }}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>
          <div style={{ position:'relative' }}>
            <div onClick={() => setMenuOpen(v=>!v)} style={{ width:36, height:36, borderRadius:'50%', cursor:'pointer', background:'linear-gradient(135deg,var(--gold-light),var(--gold))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:600, color:'var(--ink)', border:'2px solid var(--white)', boxShadow:'var(--shadow-sm)' }}>
              {user?.name?.[0]?.toUpperCase()||'T'}
            </div>
            {menuOpen && (
              <div style={{ position:'absolute', top:'calc(100% + 8px)', right:0, zIndex:300, background:'var(--white)', border:'1px solid var(--border)', borderRadius:16, boxShadow:'var(--shadow-lg)', padding:8, minWidth:180, animation:'scaleIn 0.15s ease' }}>
                <div style={{ padding:'8px 12px', fontSize:12, color:'var(--ink-muted)', borderBottom:'1px solid var(--border)' }}>{user?.email}</div>
                {[{label:'⚙️  Settings',path:'/settings'},{label:'📊  Analytics',path:'/analytics'}].map(i=>(
                  <button key={i.path} onClick={()=>{navigate(i.path);setMenuOpen(false)}} style={{ width:'100%', textAlign:'left', padding:'8px 12px', border:'none', background:'none', cursor:'pointer', fontSize:13, color:'var(--ink)', borderRadius:8 }}>{i.label}</button>
                ))}
                <div style={{ height:1, background:'var(--border)', margin:'4px 0' }}/>
                <button onClick={()=>{logout();navigate('/login')}} style={{ width:'100%', textAlign:'left', padding:'8px 12px', border:'none', background:'none', cursor:'pointer', fontSize:13, color:'var(--blush)', borderRadius:8 }}>Sign out</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div style={{ display:'flex', flex:1, paddingTop:64 }}>
        <nav style={{ width:72, position:'fixed', left:0, top:64, bottom:0, zIndex:90, background:'var(--white)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', alignItems:'center', padding:'16px 0', gap:2 }}>
          {NAV.map(n => {
            const active = n.path==='/' ? routerLoc.pathname==='/' : routerLoc.pathname.startsWith(n.path)
            return (
              <button key={n.path} onClick={()=>navigate(n.path)} title={n.label} style={{ width:48, height:48, borderRadius:12, border:'none', background:active?'var(--gold-light)':'transparent', cursor:'pointer', fontSize:20, position:'relative', display:'flex', alignItems:'center', justifyContent:'center', transition:'background 0.15s' }}>
                {n.icon}
                {active && <span style={{ position:'absolute', right:-1, top:10, bottom:10, width:3, background:'var(--gold)', borderRadius:'3px 0 0 3px' }}/>}
              </button>
            )
          })}
          <div style={{ flex:1 }}/>
          <div style={{ width:32, height:1, background:'var(--border)', margin:'8px 0' }}/>
          <button onClick={()=>navigate('/settings')} title="Settings" style={{ width:48, height:48, borderRadius:12, border:'none', background:routerLoc.pathname==='/settings'?'var(--gold-light)':'transparent', cursor:'pointer', fontSize:20, display:'flex', alignItems:'center', justifyContent:'center' }}>⚙️</button>
        </nav>

        <main style={{ marginLeft:72, flex:1, padding:28, overflowY:'auto', overflowX:'hidden' }}>
          <Outlet/>
        </main>
      </div>

      <button onClick={()=>setVoiceOpen(true)} style={{ position:'fixed', bottom:28, right:28, zIndex:200, width:60, height:60, borderRadius:'50%', border:'none', cursor:'pointer', fontSize:24, background:'linear-gradient(135deg,#1A1A18,#2D3B4A)', boxShadow:'var(--shadow-xl)', display:'flex', alignItems:'center', justifyContent:'center', transition:'transform 0.2s' }}
        onMouseEnter={e=>e.currentTarget.style.transform='scale(1.1)'}
        onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}
      >🎙️</button>

      {voiceOpen  && <VoiceModal   onClose={()=>setVoiceOpen(false)}/>}
      {alertsOpen && <AlertsPanel onClose={()=>setAlertsOpen(false)}/>}
    </div>
  )
}
