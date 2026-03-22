import { useState, useEffect } from 'react'
import { useStore } from '../store'
import { analyticsAPI } from '../services/api'
import { Card, CardTitle, Badge, EmptyState } from '../components/UI'

export default function AnalyticsPage() {
  const [dashboard, setDashboard] = useState(null)
  const [digest,    setDigest]    = useState(null)
  const trips     = useStore(s => s.trips)
  const prefs     = useStore(s => s.preferences)
  const thumbsLog = useStore(s => s.thumbsLog)

  useEffect(() => {
    analyticsAPI.getDashboard().then(setDashboard).catch(() => {})
    analyticsAPI.getWeeklyDigest().then(setDigest).catch(() => {})
  }, [])

  const accepted = thumbsLog.filter(t => t.v === 'up').length
  const rejected = thumbsLog.filter(t => t.v === 'down').length
  const total    = accepted + rejected
  const rate     = total ? Math.round((accepted / total) * 100) : 0

  const statCards = [
    { icon:'✈️', label:'Total Trips',      val: dashboard?.total_trips ?? trips.length },
    { icon:'📍', label:'Destinations',     val: dashboard?.destinations_visited?.length ?? 0 },
    { icon:'👍', label:'Acceptance Rate',  val: `${rate}%` },
    { icon:'💬', label:'Feedback Given',   val: thumbsLog.length },
  ]

  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ fontFamily:'var(--font-display)', fontSize:28, fontWeight:600, letterSpacing:'-0.5px', marginBottom:24 }}>
        Analytics
      </h1>

      {/* Stat cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24 }}>
        {statCards.map(s => (
          <Card key={s.label} style={{ padding:20, textAlign:'center' }}>
            <div style={{ fontSize:28, marginBottom:6 }}>{s.icon}</div>
            <div style={{ fontFamily:'var(--font-display)', fontSize:26, fontWeight:600 }}>{s.val}</div>
            <div style={{ fontSize:11, color:'var(--ink-muted)', marginTop:2 }}>{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Preference map */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:24 }}>
        <Card>
          <CardTitle>👍 You Like</CardTitle>
          {(prefs.liked_types || []).length > 0
            ? (prefs.liked_types || []).slice(0, 8).map(t => (
                <Badge key={t} color="sage" style={{ marginRight:6, marginBottom:6 }}>{t}</Badge>
              ))
            : <div style={{ fontSize:13, color:'var(--ink-muted)' }}>
                No feedback yet — thumb up suggestions you enjoy!
              </div>
          }
        </Card>
        <Card>
          <CardTitle>👎 Not Your Style</CardTitle>
          {(prefs.disliked_types || []).length > 0
            ? (prefs.disliked_types || []).slice(0, 8).map(t => (
                <Badge key={t} color="blush" style={{ marginRight:6, marginBottom:6 }}>{t}</Badge>
              ))
            : <div style={{ fontSize:13, color:'var(--ink-muted)' }}>Nothing disliked yet.</div>
          }
        </Card>
      </div>

      {/* Trip list */}
      {trips.length > 0 && (
        <Card style={{ marginBottom:24 }}>
          <CardTitle>Trip History</CardTitle>
          {trips.map((t, i) => (
            <div key={t.id || i} style={{
              display:'flex', justifyContent:'space-between', alignItems:'center',
              padding:'10px 0', borderBottom:'1px solid var(--border)',
            }}>
              <div>
                <div style={{ fontSize:14, fontWeight:500 }}>{t.destination}</div>
                <div style={{ fontSize:11, color:'var(--ink-muted)' }}>
                  {t.start_date ? new Date(t.start_date).toLocaleDateString([], { month:'short', day:'numeric', year:'numeric' }) : 'TBD'}
                  {t.budget_spent > 0 && <span style={{ marginLeft:8 }}>· ₹{t.budget_spent.toLocaleString()} spent</span>}
                </div>
              </div>
              <Badge color={t.status === 'active' ? 'sage' : t.status === 'past' ? 'muted' : 'gold'}>
                {t.status === 'active' ? '🟢 Now' : t.status === 'past' ? '✓ Done' : '📅 Soon'}
              </Badge>
            </div>
          ))}
        </Card>
      )}

      {/* Weekly digest */}
      {digest && (
        <Card>
          <CardTitle>📋 Weekly Digest</CardTitle>
          <div style={{ fontSize:13, color:'var(--ink-soft)', lineHeight:1.7, whiteSpace:'pre-wrap', marginBottom:16 }}>
            {digest.digest}
          </div>
          {(digest.reminders || []).length > 0 && (
            <div>
              <div style={{ fontSize:11, fontWeight:500, color:'var(--ink-muted)', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.5px' }}>
                Reminders
              </div>
              {digest.reminders.map((r, i) => (
                <div key={i} style={{
                  fontSize:13, padding:'8px 0', borderBottom:'1px solid var(--border)', color:'var(--ink-soft)',
                }}>{r}</div>
              ))}
            </div>
          )}
        </Card>
      )}

      {trips.length === 0 && !digest && (
        <EmptyState icon="📊" title="No data yet" desc="Sync your Gmail to import trips, then start rating suggestions. Analytics will build up over time." />
      )}
    </div>
  )
}
