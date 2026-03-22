import { useState } from 'react'

// ── Card ──────────────────────────────────────────────────────────────────────
export function Card({ children, style={}, hover=true, onClick }) {
  return (
    <div onClick={onClick} style={{
      background:'var(--white)', borderRadius:'var(--radius)',
      border:'1px solid var(--border)', boxShadow:'var(--shadow-sm)',
      padding:24, cursor: onClick ? 'pointer' : 'default',
      transition: hover ? 'box-shadow 0.2s, transform 0.2s' : 'none', ...style,
    }}
      onMouseEnter={e=>{if(hover&&onClick){e.currentTarget.style.boxShadow='var(--shadow-md)';e.currentTarget.style.transform='translateY(-2px)'}}}
      onMouseLeave={e=>{if(hover&&onClick){e.currentTarget.style.boxShadow='var(--shadow-sm)';e.currentTarget.style.transform='translateY(0)'}}}
    >{children}</div>
  )
}

export function CardTitle({ children, style={} }) {
  return (
    <div style={{ fontFamily:'var(--font-display)', fontSize:18, fontWeight:600, letterSpacing:'-0.2px', color:'var(--ink)', marginBottom:16, ...style }}>
      {children}
    </div>
  )
}

// ── Badge ─────────────────────────────────────────────────────────────────────
export function Badge({ children, color='gold', style={} }) {
  const colors = {
    gold:  { bg:'var(--gold-light)',  text:'var(--gold-deep)' },
    sage:  { bg:'var(--sage-light)',  text:'var(--sage)' },
    sky:   { bg:'var(--sky-light)',   text:'var(--sky)' },
    blush: { bg:'var(--blush-light)', text:'var(--blush)' },
    ink:   { bg:'var(--ink)',         text:'var(--white)' },
    muted: { bg:'var(--cream)',       text:'var(--ink-muted)' },
  }
  const c = colors[color] || colors.gold
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:500, background:c.bg, color:c.text, ...style }}>
      {children}
    </span>
  )
}

// ── Button ────────────────────────────────────────────────────────────────────
export function Btn({ children, onClick, variant='outline', style={}, disabled=false, loading=false }) {
  const variants = {
    primary: { background:'var(--ink)',          color:'var(--white)', border:'none' },
    outline: { background:'var(--white)',         color:'var(--ink)',   border:'1px solid var(--border)' },
    gold:    { background:'var(--gold)',          color:'var(--white)', border:'none' },
    ghost:   { background:'transparent',          color:'var(--ink-soft)', border:'none' },
    danger:  { background:'var(--blush-light)',   color:'var(--blush)', border:'1px solid rgba(212,144,122,0.3)' },
  }
  const v = variants[variant] || variants.outline
  return (
    <button onClick={onClick} disabled={disabled||loading} style={{
      ...v, padding:'10px 18px', borderRadius:12, fontSize:13, fontWeight:500,
      fontFamily:'var(--font-body)', cursor: disabled ? 'not-allowed' : 'pointer',
      transition:'all 0.15s', opacity: disabled ? 0.5 : 1, ...style,
    }}>
      {loading
        ? <span style={{ display:'inline-flex', gap:3, alignItems:'center' }}>
            {[0,1,2].map(i=><span key={i} style={{ width:5, height:5, borderRadius:'50%', background:'currentColor', display:'inline-block', animation:`bounceDots 1.2s ${i*0.2}s infinite` }}/>)}
          </span>
        : children}
    </button>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
export function Skeleton({ width='100%', height=16, radius=6, style={} }) {
  return <div className="skeleton" style={{ width, height, borderRadius:radius, ...style }}/>
}

// ── Section header ────────────────────────────────────────────────────────────
export function SectionHeader({ title, action, actionLabel }) {
  return (
    <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:14 }}>
      <h2 style={{ fontFamily:'var(--font-display)', fontSize:20, fontWeight:600, letterSpacing:'-0.3px', color:'var(--ink)' }}>{title}</h2>
      {action && <span onClick={action} style={{ fontSize:12, color:'var(--gold)', cursor:'pointer', fontWeight:500 }}>{actionLabel || 'See all'}</span>}
    </div>
  )
}

// ── SuggestionCard ────────────────────────────────────────────────────────────
export function SuggestionCard({ s, onThumb }) {
  const [thumbed, setThumbed] = useState(null) // null | 'up' | 'down'

  const EMOJI_BG = {
    '☕':'#FFF8ED','🍜':'#FFF5F0','🌿':'#EFF5EE','🎭':'#F0F0FF',
    '🍹':'#F5F0FF','📚':'#F0F5FF','🏛️':'#F5F0E8','🛍️':'#FFF0F5',
    '🍽️':'#FFF5F0','🎪':'#F0F5FF','🌳':'#EFF5EE','🛒':'#FFF8ED',
    '📍':'var(--cream)',
  }
  const crowdColor = { low:'var(--sage)', medium:'var(--gold)', high:'var(--blush)' }

  const handleVote = (e, vote) => {
    e.stopPropagation()
    if (thumbed) return  // already voted
    setThumbed(vote)
    onThumb(s.id, vote)
  }

  // If thumbed down, card fades out (parent removes it)
  // If thumbed up, show green confirmation and keep card

  return (
    <div style={{
      display:'flex', gap:12, alignItems:'flex-start', padding:14,
      borderRadius:12, border:`1px solid ${thumbed==='up' ? 'var(--sage)' : 'var(--border)'}`,
      background: thumbed==='up' ? 'var(--sage-light)' : 'var(--white)',
      transition:'all 0.25s', opacity: thumbed==='down' ? 0.4 : 1,
    }}>
      <div style={{
        width:44, height:44, borderRadius:10, flexShrink:0,
        background: EMOJI_BG[s.emoji] || 'var(--cream)',
        display:'flex', alignItems:'center', justifyContent:'center', fontSize:22,
      }}>{s.emoji}</div>

      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:14, fontWeight:500, color:'var(--ink)', display:'flex', alignItems:'center', gap:6 }}>
          {s.name}
          {s.hidden_gem && <Badge color="sage" style={{ fontSize:9, padding:'1px 6px' }}>✦ Local gem</Badge>}
          {!s.safety_ok && <Badge color="blush" style={{ fontSize:9, padding:'1px 6px' }}>⚠ Caution</Badge>}
          {thumbed==='up' && <Badge color="sage" style={{ fontSize:9, padding:'1px 6px' }}>✓ Saved</Badge>}
        </div>

        <div style={{ fontSize:12, color:'var(--ink-muted)', marginTop:2 }}>
          {s.distance_text} · {s.duration_text} · {s.place_type}
        </div>

        <div style={{ fontSize:11, color:'var(--sage)', marginTop:4, fontStyle:'italic' }}>
          ✦ {s.reason}
        </div>

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:13, fontWeight:500 }}>{s.budget_text}</span>
            <span style={{ fontSize:11, color: crowdColor[s.crowd_level] || 'var(--ink-muted)' }}>
              ● {s.crowd_prediction}
            </span>
          </div>

          <div style={{ display:'flex', gap:6 }}>
            {/* Thumbs Up */}
            <button
              onClick={e => handleVote(e, 'up')}
              disabled={!!thumbed}
              title="Like this suggestion"
              style={{
                width:30, height:30, borderRadius:'50%', fontSize:14, cursor: thumbed ? 'default' : 'pointer',
                border:`1px solid ${thumbed==='up' ? 'var(--sage)' : 'var(--border)'}`,
                background: thumbed==='up' ? 'var(--sage)' : 'var(--white)',
                display:'flex', alignItems:'center', justifyContent:'center',
                transition:'all 0.2s', transform: thumbed==='up' ? 'scale(1.15)' : 'scale(1)',
              }}
            >👍</button>

            {/* Thumbs Down */}
            <button
              onClick={e => handleVote(e, 'down')}
              disabled={!!thumbed}
              title="Not interested"
              style={{
                width:30, height:30, borderRadius:'50%', fontSize:14, cursor: thumbed ? 'default' : 'pointer',
                border:`1px solid ${thumbed==='down' ? 'var(--blush)' : 'var(--border)'}`,
                background: thumbed==='down' ? 'var(--blush-light)' : 'var(--white)',
                display:'flex', alignItems:'center', justifyContent:'center',
                transition:'all 0.2s',
              }}
            >👎</button>
          </div>
        </div>

        {s.etiquette_tip && (
          <div style={{ fontSize:11, color:'var(--sky)', marginTop:4 }}>💡 {s.etiquette_tip}</div>
        )}
      </div>
    </div>
  )
}

// ── EmptyState ────────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, desc, action, actionLabel }) {
  return (
    <div style={{ textAlign:'center', padding:'48px 24px', color:'var(--ink-muted)' }}>
      <div style={{ fontSize:40, marginBottom:12 }}>{icon}</div>
      <div style={{ fontFamily:'var(--font-display)', fontSize:18, color:'var(--ink)', marginBottom:6 }}>{title}</div>
      <div style={{ fontSize:13, marginBottom: action ? 20 : 0, lineHeight:1.5 }}>{desc}</div>
      {action && <Btn onClick={action} variant="primary">{actionLabel}</Btn>}
    </div>
  )
}

export function Divider({ style={} }) {
  return <div style={{ height:1, background:'var(--border)', ...style }}/>
}
