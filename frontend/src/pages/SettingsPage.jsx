import { useState } from 'react'
import { useStore } from '../store'
import { prefsAPI } from '../services/api'
import { Card, CardTitle, Btn } from '../components/UI'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  // Individual selectors — never use inline object selector
  const preferences    = useStore(s => s.preferences)
  const setPreferences = useStore(s => s.setPreferences)
  const user           = useStore(s => s.user)
  const coords         = useStore(s => s.coords)
  const thumbsLog      = useStore(s => s.thumbsLog)

  const [saving, setSaving] = useState(false)
  const [form, setForm]     = useState({ ...preferences })

  const save = async () => {
    setSaving(true)
    try {
      const updated = await prefsAPI.update(form)
      setPreferences({ ...preferences, ...updated })
      toast.success('Preferences saved ✓')
    } catch {
      setPreferences({ ...preferences, ...form })
      toast.success('Saved locally ✓')
    }
    setSaving(false)
  }

  const pillGroup = (key, label, opts) => (
    <div style={{ marginBottom:18 }}>
      <div style={{ fontSize:11, color:'var(--ink-muted)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.5px' }}>{label}</div>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        {opts.map(o => (
          <button key={o.val} onClick={() => setForm(p => ({ ...p, [key]: o.val }))} style={{
            padding:'7px 14px', borderRadius:20, fontSize:12, cursor:'pointer',
            fontFamily:'var(--font-body)', transition:'all 0.15s',
            border: `1px solid ${form[key] === o.val ? 'var(--gold)' : 'var(--border)'}`,
            background: form[key] === o.val ? 'var(--gold-light)' : 'var(--white)',
            color: form[key] === o.val ? 'var(--ink)' : 'var(--ink-muted)',
            fontWeight: form[key] === o.val ? 500 : 400,
          }}>{o.label}</button>
        ))}
      </div>
    </div>
  )

  const textField = (key, label, placeholder = '') => (
    <div style={{ marginBottom:18 }}>
      <div style={{ fontSize:11, color:'var(--ink-muted)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.5px' }}>{label}</div>
      <input
        value={form[key] || ''}
        onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
        placeholder={placeholder}
        style={{
          width:'100%', padding:'10px 14px', borderRadius:10,
          border:'1px solid var(--border)', background:'var(--cream)',
          fontSize:13, fontFamily:'var(--font-body)', color:'var(--ink)', outline:'none',
          transition:'border-color 0.2s',
        }}
        onFocus={e => e.target.style.borderColor = 'var(--gold)'}
        onBlur={e  => e.target.style.borderColor = 'var(--border)'}
      />
    </div>
  )

  return (
    <div style={{ maxWidth:600 }}>
      <h1 style={{ fontFamily:'var(--font-display)', fontSize:28, fontWeight:600, letterSpacing:'-0.5px', marginBottom:24 }}>
        Settings
      </h1>

      {/* Account */}
      <Card style={{ marginBottom:16 }}>
        <CardTitle>Account</CardTitle>
        <div style={{ display:'flex', gap:14, alignItems:'center' }}>
          <div style={{
            width:52, height:52, borderRadius:'50%', flexShrink:0,
            background:'linear-gradient(135deg,var(--gold-light),var(--gold))',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:20, fontWeight:600, color:'var(--ink)',
          }}>
            {user?.name?.[0]?.toUpperCase() || 'T'}
          </div>
          <div>
            <div style={{ fontWeight:500, fontSize:14 }}>{user?.name || 'Traveler'}</div>
            <div style={{ fontSize:12, color:'var(--ink-muted)' }}>{user?.email || 'Not signed in'}</div>
          </div>
        </div>
      </Card>

      {/* Preferences */}
      <Card style={{ marginBottom:16 }}>
        <CardTitle>Travel Preferences</CardTitle>
        {pillGroup('budget_level', 'Budget', [
          { val:'low',       label:'💰 Budget' },
          { val:'mid-range', label:'💳 Mid-range' },
          { val:'high',      label:'💎 Premium' },
        ])}
        {pillGroup('dietary', 'Dietary', [
          { val:'no restrictions', label:'🍽️ Everything' },
          { val:'vegetarian',      label:'🥗 Vegetarian' },
          { val:'vegan',           label:'🌱 Vegan' },
          { val:'halal',           label:'☪️ Halal' },
          { val:'jain',            label:'🪷 Jain' },
        ])}
        {pillGroup('trip_purpose', 'Trip Purpose', [
          { val:'leisure',  label:'🌴 Leisure' },
          { val:'business', label:'💼 Business' },
        ])}
        {pillGroup('travel_mode', 'Travel Mode', [
          { val:'leisure',   label:'🌴 Leisure' },
          { val:'business',  label:'💼 Business' },
          { val:'adventure', label:'🧗 Adventure' },
          { val:'family',    label:'👨‍👩‍👧 Family' },
        ])}
        {pillGroup('notification_freq', 'Notification Frequency', [
          { val:'minimal', label:'🔕 Minimal' },
          { val:'normal',  label:'🔔 Normal' },
          { val:'high',    label:'🔊 All alerts' },
        ])}
        {textField('home_city',       'Home City',              'Mumbai, Delhi, Bangalore…')}
        {textField('whatsapp_number', 'WhatsApp (for digests)', '+91 9876543210')}
        <Btn onClick={save} loading={saving} variant="primary" style={{ width:'100%' }}>
          Save Preferences
        </Btn>
      </Card>

      {/* Privacy */}
      <Card style={{ marginBottom:16 }}>
        <CardTitle>Data & Privacy</CardTitle>
        {[
          { label:'Gmail access',     val:'Read-only ✓',                            ok:true  },
          { label:'Calendar access',  val:'Read-only ✓',                            ok:true  },
          { label:'Location',         val: coords ? 'Active ✓' : 'Not granted',    ok:!!coords },
          { label:'Email sending',    val:'Never — TripMind never sends emails',    ok:true  },
          { label:'Email deletion',   val:'Never — TripMind never deletes anything',ok:true  },
          { label:'Feedback signals', val:`${thumbsLog.length} preferences learned`, ok:true },
        ].map(r => (
          <div key={r.label} style={{
            display:'flex', justifyContent:'space-between', alignItems:'center',
            padding:'10px 0', borderBottom:'1px solid var(--border)', fontSize:13,
          }}>
            <span style={{ color:'var(--ink-muted)' }}>{r.label}</span>
            <span style={{ fontWeight:500, color: r.ok ? 'var(--sage)' : 'var(--blush)' }}>{r.val}</span>
          </div>
        ))}
        <div style={{ marginTop:12, fontSize:12, color:'var(--ink-muted)', lineHeight:1.5 }}>
          TripMind requests read-only Gmail and Calendar access only. Your Google tokens never leave your backend server.
        </div>
      </Card>

      {/* About */}
      <Card>
        <CardTitle>About</CardTitle>
        <div style={{ fontSize:13, color:'var(--ink-soft)', lineHeight:1.7 }}>
          <strong>TripMind v2.0</strong> — AI Travel Companion<br/>
          FastAPI · React PWA · Groq Llama 3.3 70B · Open-Meteo · Google OAuth<br/><br/>
          <strong>Gmail:</strong> Read-only &nbsp;·&nbsp; <strong>Calendar:</strong> Read-only &nbsp;·&nbsp; <strong>Voice:</strong> Whisper (99 languages)
        </div>
      </Card>
    </div>
  )
}
