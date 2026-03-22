import { useAlerts } from '../hooks'

const TYPE_STYLE = {
  weather:   { bg:'var(--sky-light)',   border:'rgba(123,163,196,0.3)' },
  free_time: { bg:'var(--gold-pale)',   border:'rgba(200,169,106,0.3)' },
  meal:      { bg:'var(--blush-light)', border:'rgba(212,144,122,0.3)' },
  hotel:     { bg:'var(--sage-light)',  border:'rgba(143,166,138,0.3)' },
  flight:    { bg:'var(--sky-light)',   border:'rgba(123,163,196,0.3)' },
  currency:  { bg:'var(--gold-pale)',   border:'rgba(200,169,106,0.3)' },
  visa:      { bg:'var(--blush-light)', border:'rgba(212,144,122,0.3)' },
  event:     { bg:'var(--sage-light)',  border:'rgba(143,166,138,0.3)' },
  default:   { bg:'var(--cream)',       border:'var(--border)' },
}

export default function AlertsPanel({ onClose }) {
  const { alerts, markAlertRead } = useAlerts()

  return (
    <div onClick={e => e.target===e.currentTarget && onClose()} style={{
      position:'fixed', inset:0, zIndex:300,
      background:'rgba(26,26,24,0.4)', backdropFilter:'blur(6px)',
      display:'flex', justifyContent:'flex-end', padding:20,
      animation:'fadeIn 0.2s ease',
    }}>
      <div style={{
        width:360, background:'var(--white)', borderRadius:24,
        boxShadow:'var(--shadow-xl)', display:'flex', flexDirection:'column',
        animation:'slideUp 0.25s ease', maxHeight:'80vh',
      }}>
        <div style={{
          padding:'20px 20px 16px', borderBottom:'1px solid var(--border)',
          display:'flex', justifyContent:'space-between', alignItems:'center',
        }}>
          <span style={{ fontFamily:'var(--font-display)', fontSize:20, fontWeight:600 }}>Alerts</span>
          <button onClick={onClose} style={{
            width:32, height:32, borderRadius:8, border:'1px solid var(--border)',
            background:'var(--cream)', cursor:'pointer', fontSize:14,
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>✕</button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:12 }}>
          {alerts.length === 0 ? (
            <div style={{ padding:'40px 20px', textAlign:'center', color:'var(--ink-muted)' }}>
              <div style={{ fontSize:32, marginBottom:8 }}>🔔</div>
              <div style={{ fontSize:13 }}>No alerts yet. TripMind will notify you proactively.</div>
            </div>
          ) : alerts.map(a => {
            const s = TYPE_STYLE[a.alert_type] || TYPE_STYLE.default
            return (
              <div key={a.id} onClick={() => markAlertRead(a.id)} style={{
                background: s.bg, border:`1px solid ${s.border}`,
                borderRadius:12, padding:'12px 14px', marginBottom:8,
                cursor:'pointer', opacity: a.read ? 0.6 : 1,
                transition:'opacity 0.2s',
              }}>
                <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                  <span style={{ fontSize:20, flexShrink:0 }}>{a.icon}</span>
                  <div>
                    <div style={{ fontSize:13, fontWeight:500, color:'var(--ink)', marginBottom:2 }}>
                      {a.title}
                      {!a.read && <span style={{
                        width:6, height:6, borderRadius:'50%', background:'var(--gold)',
                        display:'inline-block', marginLeft:6, verticalAlign:'middle',
                      }}/>}
                    </div>
                    <div style={{ fontSize:12, color:'var(--ink-soft)', lineHeight:1.4 }}>{a.body}</div>
                    <div style={{ fontSize:10, color:'var(--ink-muted)', marginTop:4 }}>
                      {new Date(a.created_at).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
