/**
 * AuthModal — Login / Register modal for IOPHIN
 * Supports role selection and organization during registration
 */
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store';
import type { Role } from '../types';

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
  const [role, setRole] = useState('user');
  const [organization, setOrganization] = useState('');
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch available roles for registration
  useEffect(() => {
    if (mode === 'register') {
      axios.get(`${API}/v1/auth/roles`).then(res => {
        setAvailableRoles(res.data);
      }).catch(() => {
        // Fallback roles if endpoint not available
        setAvailableRoles([
          { id: 2, name: 'admin', display_name: 'Administrator', is_system_role: true, created_at: '' },
          { id: 3, name: 'user', display_name: 'Standard User', is_system_role: true, created_at: '' },
        ]);
      });
    }
  }, [mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let res;
      if (mode === 'register') {
        res = await axios.post(`${API}/v1/auth/register`, {
          email,
          password,
          full_name: fullName,
          role: role || 'user',
          organization: organization || undefined,
        });
      } else {
        res = await axios.post(`${API}/v1/auth/login`, { email, password });
      }
      const { user, token } = res.data;
      login(user, token, user.permissions);
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
        borderRadius: 'var(--radius-lg)', padding: 32, width: 420, maxWidth: '90vw',
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
              style={mode === m ? { background: 'var(--blue)', color: '#fff', borderColor: 'var(--blue)', flex: 1 } : { flex: 1 }}>
              {m === 'login' ? 'Sign In' : 'Register'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mode === 'register' && (
            <input className="intervention-input" type="text" placeholder="Full Name *"
              value={fullName} onChange={e => setFullName(e.target.value)} required />
          )}
          <input className="intervention-input" type="email" placeholder="Email address *"
            value={email} onChange={e => setEmail(e.target.value)} required />
          <input className="intervention-input" type="password" placeholder="Password (min 8 chars, letters + digits) *"
            value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />

          {mode === 'register' && (
            <>
              {/* Role selection */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>
                  Account Role
                </label>
                <select
                  className="filter-select"
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', fontSize: 13 }}
                  title="Select account role"
                >
                  {availableRoles.length > 0 ? (
                    availableRoles.map(r => (
                      <option key={r.name} value={r.name}>{r.display_name}</option>
                    ))
                  ) : (
                    <>
                      <option value="user">Standard User</option>
                      <option value="admin">Administrator</option>
                      <option value="government">Government Official</option>
                      <option value="ngo">NGO Worker</option>
                    </>
                  )}
                </select>
                <span style={{ fontSize: 10, color: 'var(--text-quaternary)' }}>
                  Determines your access level and permissions
                </span>
              </div>

              {/* Organization */}
              <input className="intervention-input" type="text" placeholder="Organization (optional)"
                value={organization} onChange={e => setOrganization(e.target.value)} />
            </>
          )}

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
