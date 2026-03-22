// ── TripsPage ──────────────────────────────────────────────────────────────
import { useState } from 'react'
import { useStore } from '../store'
import { useTrips } from '../hooks'
import { tripsAPI } from '../services/api'
import { Card, CardTitle, Badge, Btn, SectionHeader, EmptyState, Skeleton } from '../components/UI'
import toast from 'react-hot-toast'

export default function TripsPage() {
  const { trips, loading, loadTrips, importFromGmail } = useTrips()
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ destination:'', start_date:'', end_date:'', budget_total:0, currency:'INR' })
  const addTrip = useStore(s => s.addTrip)

  const createTrip = async () => {
    try {
      const t = await tripsAPI.create(form)
      addTrip(t)
      setCreating(false)
      setForm({ destination:'', start_date:'', end_date:'', budget_total:0, currency:'INR' })
      toast.success('Trip created!')
    } catch { toast.error('Failed to create trip') }
  }

  const fmtDate = d => { try { return new Date(d).toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'}) } catch { return d || 'TBD' } }

  const now = new Date()
  const upcoming = trips.filter(t => { try { return new Date(t.start_date) > now } catch { return true } })
  const active   = trips.filter(t => { try { const s=new Date(t.start_date),e=new Date(t.end_date); return s<=now&&now<=e } catch { return false } })
  const past     = trips.filter(t => { try { return new Date(t.end_date) < now } catch { return false } })

  return (
    <div style={{ maxWidth:900 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <h1 style={{ fontFamily:'var(--font-display)', fontSize:28, fontWeight:600, letterSpacing:'-0.5px' }}>Your Trips</h1>
        <div style={{ display:'flex', gap:10 }}>
          <Btn onClick={importFromGmail} loading={loading} variant="outline">📧 Sync Gmail</Btn>
          <Btn onClick={() => setCreating(v=>!v)} variant="primary">+ New Trip</Btn>
        </div>
      </div>

      {/* Create form */}
      {creating && (
        <Card style={{ marginBottom:20, animation:'slideDown 0.3s ease' }}>
          <CardTitle>New Trip</CardTitle>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            {[
              { key:'destination', label:'Destination', type:'text', placeholder:'Mumbai, Dubai, Goa…' },
              { key:'budget_total', label:'Budget (₹)', type:'number', placeholder:'15000' },
              { key:'start_date', label:'Start Date', type:'date', placeholder:'' },
              { key:'end_date', label:'End Date', type:'date', placeholder:'' },
            ].map(f => (
              <div key={f.key}>
                <div style={{ fontSize:11, color:'var(--ink-muted)', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.5px' }}>{f.label}</div>
                <input type={f.type} placeholder={f.placeholder} value={form[f.key]}
                  onChange={e => setForm(p=>({...p, [f.key]: e.target.value}))}
                  style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1px solid var(--border)', fontSize:13, background:'var(--cream)', fontFamily:'var(--font-body)', outline:'none' }}
                />
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:10, marginTop:16 }}>
            <Btn onClick={createTrip} variant="primary">Create Trip</Btn>
            <Btn onClick={() => setCreating(false)} variant="outline">Cancel</Btn>
          </div>
        </Card>
      )}

      {loading && trips.length===0 ? (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          {[1,2,3,4].map(i=><Card key={i}><Skeleton width="60%" height={18} style={{marginBottom:10}}/><Skeleton width="40%" height={12}/></Card>)}
        </div>
      ) : trips.length===0 ? (
        <EmptyState icon="✈️" title="No trips yet" desc="TripMind scans your Gmail for flight, hotel & booking confirmations automatically. Or create a trip manually." action={importFromGmail} actionLabel="Sync from Gmail" />
      ) : (
        <>
          {active.length>0 && (
            <div style={{ marginBottom:20 }}>
              <SectionHeader title="Active Now" />
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:14 }}>
                {active.map(t => <TripCard key={t.id} trip={t} status="active" fmtDate={fmtDate} />)}
              </div>
            </div>
          )}
          {upcoming.length>0 && (
            <div style={{ marginBottom:20 }}>
              <SectionHeader title="Upcoming" />
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:14 }}>
                {upcoming.map(t => <TripCard key={t.id} trip={t} status="upcoming" fmtDate={fmtDate} />)}
              </div>
            </div>
          )}
          {past.length>0 && (
            <div>
              <SectionHeader title="Past Trips" />
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:14 }}>
                {past.map(t => <TripCard key={t.id} trip={t} status="past" fmtDate={fmtDate} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function TripCard({ trip, status, fmtDate }) {
  const budgetPct = trip.budget_total ? Math.min((trip.budget_spent/trip.budget_total)*100,100) : 0
  return (
    <div style={{
      background:'var(--white)', borderRadius:16, border:'1px solid var(--border)',
      padding:20, position:'relative', overflow:'hidden', cursor:'pointer',
      transition:'box-shadow 0.2s, transform 0.2s',
    }}
      onMouseEnter={e=>{e.currentTarget.style.boxShadow='var(--shadow-md)';e.currentTarget.style.transform='translateY(-2px)'}}
      onMouseLeave={e=>{e.currentTarget.style.boxShadow='none';e.currentTarget.style.transform='translateY(0)'}}
    >
      <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'linear-gradient(90deg,var(--gold),var(--blush))' }}/>
      <div style={{ fontSize:10, color:'var(--ink-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginTop:4 }}>{trip.trip_type || 'trip'}</div>
      <div style={{ fontFamily:'var(--font-display)', fontSize:20, fontWeight:600, marginTop:2 }}>{trip.destination}</div>
      <div style={{ fontSize:12, color:'var(--ink-muted)', marginTop:2 }}>{fmtDate(trip.start_date)} – {fmtDate(trip.end_date)}</div>
      <Badge color={status==='active'?'sage':status==='past'?'muted':'gold'} style={{ marginTop:10 }}>
        {status==='active'?'🟢 Active now':status==='upcoming'?'📅 Upcoming':'✓ Completed'}
      </Badge>
      {trip.raw_summary && <div style={{ fontSize:11, color:'var(--ink-muted)', marginTop:10, lineHeight:1.4 }}>{trip.raw_summary.slice(0,80)}…</div>}
      {trip.budget_total > 0 && (
        <div style={{ marginTop:12 }}>
          <div style={{ height:4, borderRadius:2, background:'var(--border)', overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${budgetPct}%`, background:'var(--gold)', borderRadius:2 }}/>
          </div>
          <div style={{ fontSize:11, color:'var(--ink-muted)', marginTop:4 }}>₹{trip.budget_spent||0} / ₹{trip.budget_total}</div>
        </div>
      )}
    </div>
  )
}
