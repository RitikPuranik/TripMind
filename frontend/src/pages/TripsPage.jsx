import { useState } from 'react'
import { useStore } from '../store'
import { tripsAPI } from '../services/api'
import { Card, CardTitle, Badge, Btn, SectionHeader, EmptyState, Skeleton } from '../components/UI'
import toast from 'react-hot-toast'

export default function TripsPage() {
  const trips      = useStore(s => s.trips)
  const setTrips   = useStore(s => s.setTrips)
  const addTrip    = useStore(s => s.addTrip)
  const [loading, setLoading]   = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    destination: '', city: '', start_date: '', end_date: '',
    budget_total: '', currency: 'INR', trip_type: 'general',
  })

  const createTrip = async () => {
    if (!form.destination.trim()) { toast.error('Enter a destination'); return }
    setLoading(true)
    try {
      const t = await tripsAPI.create({
        ...form,
        budget_total: parseFloat(form.budget_total) || 0,
      })
      addTrip(t)
      setCreating(false)
      setForm({ destination:'', city:'', start_date:'', end_date:'', budget_total:'', currency:'INR', trip_type:'general' })
      toast.success('Trip created!')
    } catch { toast.error('Failed to create trip') }
    setLoading(false)
  }

  const fmtDate = d => {
    try { return new Date(d).toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'}) }
    catch { return d || 'TBD' }
  }

  const now = new Date()
  const getStatus = t => {
    try {
      const s = new Date(t.start_date), e = new Date(t.end_date)
      if (e < now) return 'past'
      if (s <= now && now <= e) return 'active'
      return 'upcoming'
    } catch { return 'upcoming' }
  }

  const active   = trips.filter(t => getStatus(t) === 'active')
  const upcoming = trips.filter(t => getStatus(t) === 'upcoming')
  const past     = trips.filter(t => getStatus(t) === 'past')

  const inputStyle = {
    width:'100%', padding:'10px 12px', borderRadius:10,
    border:'1px solid var(--border)', background:'var(--cream)',
    fontSize:13, fontFamily:'var(--font-body)', outline:'none',
  }

  return (
    <div style={{ maxWidth:900 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <h1 style={{ fontFamily:'var(--font-display)', fontSize:28, fontWeight:600, letterSpacing:'-0.5px' }}>
          My Trips
        </h1>
        <Btn onClick={() => setCreating(v=>!v)} variant="primary">+ Add Trip</Btn>
      </div>

      {/* Create form */}
      {creating && (
        <Card style={{ marginBottom:20, animation:'slideDown 0.3s ease' }}>
          <CardTitle>New Trip</CardTitle>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <div style={{ fontSize:11, color:'var(--ink-muted)', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.5px' }}>Destination *</div>
              <input style={inputStyle} placeholder="Mumbai, Dubai, Goa…"
                value={form.destination} onChange={e=>setForm(p=>({...p,destination:e.target.value}))}/>
            </div>
            <div>
              <div style={{ fontSize:11, color:'var(--ink-muted)', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.5px' }}>City</div>
              <input style={inputStyle} placeholder="City name"
                value={form.city} onChange={e=>setForm(p=>({...p,city:e.target.value}))}/>
            </div>
            <div>
              <div style={{ fontSize:11, color:'var(--ink-muted)', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.5px' }}>Start Date</div>
              <input style={inputStyle} type="date"
                value={form.start_date} onChange={e=>setForm(p=>({...p,start_date:e.target.value}))}/>
            </div>
            <div>
              <div style={{ fontSize:11, color:'var(--ink-muted)', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.5px' }}>End Date</div>
              <input style={inputStyle} type="date"
                value={form.end_date} onChange={e=>setForm(p=>({...p,end_date:e.target.value}))}/>
            </div>
            <div>
              <div style={{ fontSize:11, color:'var(--ink-muted)', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.5px' }}>Budget (₹)</div>
              <input style={inputStyle} type="number" placeholder="15000"
                value={form.budget_total} onChange={e=>setForm(p=>({...p,budget_total:e.target.value}))}/>
            </div>
            <div>
              <div style={{ fontSize:11, color:'var(--ink-muted)', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.5px' }}>Trip Type</div>
              <select style={inputStyle} value={form.trip_type} onChange={e=>setForm(p=>({...p,trip_type:e.target.value}))}>
                <option value="general">General</option>
                <option value="flight">Flight</option>
                <option value="hotel">Hotel</option>
                <option value="road_trip">Road Trip</option>
                <option value="business">Business</option>
              </select>
            </div>
          </div>
          <div style={{ display:'flex', gap:10, marginTop:16 }}>
            <Btn onClick={createTrip} loading={loading} variant="primary">Create Trip</Btn>
            <Btn onClick={() => setCreating(false)} variant="outline">Cancel</Btn>
          </div>
        </Card>
      )}

      {/* Trip lists */}
      {trips.length === 0 ? (
        <EmptyState icon="✈️" title="No trips yet"
          desc="Add your first trip manually using the button above."
          action={() => setCreating(true)} actionLabel="+ Add Trip"/>
      ) : (
        <>
          {active.length > 0 && (
            <div style={{ marginBottom:24 }}>
              <SectionHeader title="Active Now"/>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:14 }}>
                {active.map(t => <TripCard key={t.id} trip={t} fmtDate={fmtDate} status="active"/>)}
              </div>
            </div>
          )}
          {upcoming.length > 0 && (
            <div style={{ marginBottom:24 }}>
              <SectionHeader title="Upcoming"/>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:14 }}>
                {upcoming.map(t => <TripCard key={t.id} trip={t} fmtDate={fmtDate} status="upcoming"/>)}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <SectionHeader title="Past Trips"/>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:14 }}>
                {past.map(t => <TripCard key={t.id} trip={t} fmtDate={fmtDate} status="past"/>)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function TripCard({ trip, fmtDate, status }) {
  const budgetPct = trip.budget_total ? Math.min((trip.budget_spent||0)/trip.budget_total*100,100) : 0
  return (
    <div style={{
      background:'var(--white)', borderRadius:16, border:'1px solid var(--border)',
      padding:20, position:'relative', overflow:'hidden',
      transition:'box-shadow 0.2s, transform 0.2s', cursor:'pointer',
    }}
      onMouseEnter={e=>{e.currentTarget.style.boxShadow='var(--shadow-md)';e.currentTarget.style.transform='translateY(-2px)'}}
      onMouseLeave={e=>{e.currentTarget.style.boxShadow='none';e.currentTarget.style.transform='translateY(0)'}}
    >
      <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'linear-gradient(90deg,var(--gold),var(--blush))' }}/>
      <div style={{ fontSize:10, color:'var(--ink-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginTop:4 }}>
        {trip.trip_type || 'trip'}
      </div>
      <div style={{ fontFamily:'var(--font-display)', fontSize:20, fontWeight:600, marginTop:4 }}>
        {trip.destination}
      </div>
      <div style={{ fontSize:12, color:'var(--ink-muted)', marginTop:2 }}>
        {fmtDate(trip.start_date)} – {fmtDate(trip.end_date)}
      </div>
      <Badge
        color={status==='active'?'sage':status==='past'?'muted':'gold'}
        style={{ marginTop:10 }}
      >
        {status==='active'?'🟢 Active now':status==='upcoming'?'📅 Upcoming':'✓ Completed'}
      </Badge>
      {trip.budget_total > 0 && (
        <div style={{ marginTop:12 }}>
          <div style={{ height:4, borderRadius:2, background:'var(--border)', overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${budgetPct}%`, background:'var(--gold)', borderRadius:2 }}/>
          </div>
          <div style={{ fontSize:11, color:'var(--ink-muted)', marginTop:4 }}>
            ₹{(trip.budget_spent||0).toLocaleString()} / ₹{trip.budget_total.toLocaleString()}
          </div>
        </div>
      )}
    </div>
  )
}