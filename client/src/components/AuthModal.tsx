/**
 * AuthModal — Login / Register modal for IOPHIN
 */
import { useState } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface Props {
  onClose: () => void;
}

export default function AuthModal({ onClose }: Props) {
  const login = useAuthStore(s => s.login);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'register') {
        await axios.post(`${API}/v1/auth/register`, { email, password, full_name: fullName });
      }
      const res = await axios.post(`${API}/v1/auth/login`, { email, password });
      login(res.data.user, res.data.token);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-panel)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: 32, width: 380, maxWidth: '90vw',
        boxShadow: '0 20px 60px rgba(0,0,0,.4)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'var(--text-quaternary)',
            cursor: 'pointer', fontSize: 18, lineHeight: 1,
          }}>&times;</button>
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {(['login', 'register'] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setError(''); }}
              className="rankings-toggle-btn"
              style={mode === m ? { background: 'var(--blue)', color: '#fff', borderColor: 'var(--blue)' } : { flex: 1 }}>
              {m === 'login' ? 'Sign In' : 'Register'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mode === 'register' && (
            <input className="intervention-input" type="text" placeholder="Full Name"
              value={fullName} onChange={e => setFullName(e.target.value)} required />
          )}
          <input className="intervention-input" type="email" placeholder="Email address"
            value={email} onChange={e => setEmail(e.target.value)} required />
          <input className="intervention-input" type="password" placeholder="Password (min 8 chars, letters + digits)"
            value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />

          {error && (
            <div className="report-message report-message-error">{error}</div>
          )}

          <button type="submit" disabled={loading} className="download-btn"
            style={{ marginTop: 4, opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p style={{ fontSize: 11, color: 'var(--text-quaternary)', marginTop: 16, textAlign: 'center' }}>
          {mode === 'login' ? 'Need an account? ' : 'Already have an account? '}
          <span onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
            style={{ color: 'var(--blue)', cursor: 'pointer', fontWeight: 500 }}>
            {mode === 'login' ? 'Register' : 'Sign in'}
          </span>
        </p>
      </div>
    </div>
  );
}
