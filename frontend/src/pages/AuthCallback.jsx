import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useStore } from '../store'

export default function AuthCallback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const setAuth = useStore(s => s.setAuth)

  useEffect(() => {
    const token  = params.get('token')
    const userId = params.get('user_id')
    const name   = params.get('name')
    const email  = params.get('email')
    const avatar = params.get('avatar')

    if (token) {
      setAuth(token, { id: userId, name, email, avatar_url: avatar })
      navigate('/', { replace: true })
    } else {
      navigate('/login', { replace: true })
    }
  }, [])

  return (
    <div style={{
      minHeight:'100vh', background:'var(--cream)',
      display:'flex', alignItems:'center', justifyContent:'center',
    }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:32, marginBottom:12, animation:'spin 1s linear infinite', display:'inline-block' }}>✈️</div>
        <div style={{ fontFamily:'var(--font-display)', fontSize:20, color:'var(--ink)' }}>Signing you in…</div>
      </div>
    </div>
  )
}
