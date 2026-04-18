import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../api'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { token } = await login(password)
      localStorage.setItem('fa_music_token', token)
      navigate('/')
      window.location.reload() // Refresh to update axios headers and shell
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to login. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page" style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
      padding: '20px'
    }}>
      <div className="card" style={{ 
        maxWidth: 400, 
        width: '100%', 
        padding: '2.5rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        border: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(30, 41, 59, 0.7)',
        backdropFilter: 'blur(12px)',
        borderRadius: 24
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ 
            fontSize: '3rem', 
            marginBottom: '1rem',
            filter: 'drop-shadow(0 0 10px rgba(234, 179, 8, 0.4))'
          }}>🔐</div>
          <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800 }}>FA Music Admin</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 8 }}>Please enter your password to continue</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600 }}>Password</label>
            <input 
              type="password" 
              className="input" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoFocus
              style={{ 
                marginTop: 8,
                background: 'rgba(15, 23, 42, 0.6)',
                height: 48,
                fontSize: 16
              }}
            />
          </div>

          {error && (
            <div style={{ 
              color: '#f87171', 
              fontSize: '0.85rem', 
              textAlign: 'center', 
              marginBottom: '1.5rem',
              padding: '10px',
              background: 'rgba(239, 68, 68, 0.1)',
              borderRadius: 8,
              border: '1px solid rgba(239, 68, 68, 0.2)'
            }}>
              ⚠️ {error}
            </div>
          )}

          <button 
            className="btn btn-primary" 
            style={{ width: '100%', height: 48, fontSize: 16, fontWeight: 700 }}
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Access Dashboard'}
          </button>
        </form>

        <p style={{ 
          textAlign: 'center', 
          fontSize: '0.75rem', 
          color: 'var(--text-muted)', 
          marginTop: '2rem',
          opacity: 0.5 
        }}>
          FA Music Institute &copy; 2026
        </p>
      </div>
    </div>
  )
}
