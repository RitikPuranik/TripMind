import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useStore } from '../store'
import { useCalendar } from '../hooks'
import { itineraryAPI } from '../services/api'
import { Card, CardTitle, Btn, EmptyState, Skeleton } from '../components/UI'
import toast from 'react-hot-toast'

export default function ItineraryPage() {
  const { tripId } = useParams()
  const trips = useStore(s => s.trips)
  const prefs = useStore(s => s.preferences)
  const { calEvents } = useCalendar()
  const [itinerary, setItinerary] = useState(null)
  const [building, setBuilding] = useState(false)
  const [selectedTrip, setSelectedTrip] = useState(tripId || '')

  const trip = trips.find(t => t.id === selectedTrip)

  const build = async () => {
    if (!selectedTrip || !trip) { toast.error('Select a trip first'); return }
    setBuilding(true)
    try {
      const data = await itineraryAPI.build({
        trip_id: selectedTrip,
        destination: trip.destination,
        start_date: trip.start_date || new Date().toISOString(),
        end_date: trip.end_date || new Date(Date.now() + 86400000 * 3).toISOString(),
        budget_level: prefs.budget_level,
        dietary: prefs.dietary,
        interests: (prefs.interests || []).join(','),
      })
      setItinerary(data)
      toast.success('Itinerary built!')
    } catch { toast.error('Build failed — check your API keys') }
    setBuilding(false)
  }

  const catColors = {
    food: 'var(--blush)', sightseeing: 'var(--sky)',
    transport: 'var(--gold)', hotel: 'var(--sage)', meeting: 'var(--ink-muted)',
  }

  return (
    <div style={{ maxWidth: 800 }}>
      <h1 style={{ fontFamily:'var(--font-display)', fontSize:28, fontWeight:600, letterSpacing:'-0.5px', marginBottom:6 }}>
        Itinerary
      </h1>
      <p style={{ fontSize:13, color:'var(--ink-muted)', marginBottom:24 }}>
        Auto-built from Gmail + Calendar. Zero manual input.
      </p>

      <Card style={{ marginBottom: 20 }}>
        <CardTitle>Select Trip</CardTitle>
        <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
          <select value={selectedTrip} onChange={e => setSelectedTrip(e.target.value)} style={{
            flex:1, padding:'10px 12px', borderRadius:10, border:'1px solid var(--border)',
            background:'var(--cream)', fontSize:13, fontFamily:'var(--font-body)', outline:'none',
          }}>
            <option value="">Choose a trip…</option>
            {trips.map(t => (
              <option key={t.id} value={t.id}>
                {t.destination} — {t.start_date ? new Date(t.start_date).toLocaleDateString() : 'TBD'}
              </option>
            ))}
          </select>
          <Btn onClick={build} loading={building} variant="primary">✨ Auto-Build</Btn>
        </div>
        {trip && (
          <div style={{ marginTop:10, fontSize:12, color:'var(--ink-muted)' }}>
            Respecting {calEvents.length} calendar events · Budget: {prefs.budget_level} · Dietary: {prefs.dietary}
          </div>
        )}
      </Card>

      {building && (
        <Card style={{ marginBottom: 20 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ marginBottom:16 }}>
              <Skeleton width="30%" height={16} style={{ marginBottom:8 }}/>
              {[1,2,3].map(j => <Skeleton key={j} width="100%" height={12} style={{ marginBottom:6 }}/>)}
            </div>
          ))}
        </Card>
      )}

      {itinerary ? (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <div style={{ fontSize:13, color:'var(--ink-muted)' }}>
              {itinerary.gaps_filled} activities · {itinerary.meetings_respected} meetings respected
            </div>
            <Btn onClick={build} loading={building} variant="outline" style={{ fontSize:12 }}>↺ Rebuild</Btn>
          </div>
          {(itinerary.days || []).map((day, i) => (
            <div key={i} style={{ marginBottom:24 }}>
              <div style={{ fontFamily:'var(--font-display)', fontSize:18, fontWeight:600, marginBottom:12 }}>
                {day.day_label || `Day ${i + 1}`}
                <span style={{ fontSize:13, fontWeight:400, color:'var(--ink-muted)', marginLeft:10 }}>{day.date}</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {(day.items || []).map((item, j) => (
                  <div key={j} style={{
                    display:'flex', gap:14, padding:'12px 16px', borderRadius:12,
                    background:'var(--white)', border:'1px solid var(--border)',
                  }}>
                    <div style={{ fontSize:12, color:'var(--ink-muted)', minWidth:44, fontWeight:500, paddingTop:2 }}>
                      {item.time}
                    </div>
                    <div style={{ width:3, background: catColors[item.category] || 'var(--gold)', borderRadius:2, flexShrink:0 }}/>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:500 }}>{item.activity}</div>
                      {item.location && <div style={{ fontSize:11, color:'var(--ink-muted)', marginTop:1 }}>📍 {item.location}</div>}
                      {item.notes && <div style={{ fontSize:11, color:'var(--sky)', marginTop:3 }}>💡 {item.notes}</div>}
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      {item.budget_estimate && <div style={{ fontSize:12, fontWeight:500 }}>{item.budget_estimate}</div>}
                      {item.duration_mins && <div style={{ fontSize:11, color:'var(--ink-muted)' }}>{item.duration_mins}min</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : !building && (
        <EmptyState
          icon="🗓️"
          title="No itinerary yet"
          desc="Select a trip and click Auto-Build. TripMind reads your Gmail + Calendar and creates a complete day-by-day plan."
        />
      )}
    </div>
  )
}
