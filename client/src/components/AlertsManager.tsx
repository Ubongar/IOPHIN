import { useState } from 'react';
import axios from 'axios';
import type { HotspotFeature } from '../types';
import { useAuthStore } from '../store';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface Subscription { id: number; lga_name: string; state: string; alert_type: string; notify_email: boolean; }

interface Props {
  features: HotspotFeature[];
  subscriptions: Subscription[];
  onRefresh?: () => void;
}

export default function AlertsManager({ features, subscriptions, onRefresh }: Props) {
  const token = useAuthStore(s => s.token);
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const [lgaName, setLgaName] = useState('');
  const [alertType, setAlertType] = useState('risk_change');
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subError, setSubError] = useState('');

  if (!isAuthenticated) {
    return (
      <div className="rankings-empty">
        <p>Please log in to manage alert subscriptions.</p>
      </div>
    );
  }

  const lgaNames = [...new Set(features.map(f => f.properties.LGA_Name))].sort();

  const subscribe = async () => {
    if (!lgaName) return;
    setSaving(true);
    try {
      await axios.post(`${API}/v1/alerts/subscribe`,
        { lga_name: lgaName, alert_type: alertType, notify_email: notifyEmail },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      onRefresh?.();
      setLgaName('');
      setSubError('');
    } catch (err: any) {
      setSubError(err.message || 'Subscription failed');
    } finally { setSaving(false); }
  };

  const unsubscribe = async (id: number) => {
    try {
      await axios.delete(`${API}/v1/alerts/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      onRefresh?.();
    } catch { /* silent */ }
  };

  return (
    <div>
      <div className="rankings-header">
        <h2 className="rankings-title">Alert Subscriptions</h2>
        <p className="rankings-subtitle">Subscribe to risk changes and anomalies for specific LGAs</p>
      </div>

      <div className="metric-card" style={{ marginBottom: 20, padding: 20 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 14 }}>Subscribe to LGA</h3>
        <div className="intervention-form">
          <select className="filter-select" style={{ flex: 1, minWidth: 160 }}
            value={lgaName} onChange={e => setLgaName(e.target.value)}>
            <option value="">Select LGA...</option>
            {lgaNames.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <select className="filter-select" value={alertType} onChange={e => setAlertType(e.target.value)}>
            <option value="risk_change">Risk Change</option>
            <option value="anomaly">Anomaly</option>
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-tertiary)', cursor: 'pointer' }}>
            <input type="checkbox" checked={notifyEmail} onChange={e => setNotifyEmail(e.target.checked)}
              style={{ accentColor: 'var(--blue)' }} />
            Email
          </label>
          <button onClick={subscribe} disabled={!lgaName || saving} className="download-btn"
            style={{ width: 'auto', padding: '8px 20px', fontSize: 12, opacity: (!lgaName || saving) ? 0.5 : 1 }}>
            Subscribe
          </button>
        </div>
        {subError && <p style={{ color: '#f87171', fontSize: 12, marginTop: 8 }}>{subError}</p>}
      </div>

      <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>
        Active Subscriptions ({subscriptions.length})
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {subscriptions.map(s => (
          <div key={s.id} className="metric-card" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px'
          }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              <span style={{ fontWeight: 600 }}>{s.lga_name || s.state}</span>
              <span className="risk-pill" style={{
                marginLeft: 10, background: 'rgba(99,102,241,.12)', color: '#818cf8'
              }}>{s.alert_type.replace('_', ' ')}</span>
              {s.notify_email && <span style={{ marginLeft: 8, color: 'var(--blue)' }}>✉</span>}
            </div>
            <button onClick={() => unsubscribe(s.id)} style={{
              background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)',
              color: '#f87171', borderRadius: 'var(--radius-sm)', padding: '4px 10px',
              fontSize: 11, cursor: 'pointer', fontWeight: 600, transition: 'all .15s'
            }}>Remove</button>
          </div>
        ))}
        {subscriptions.length === 0 && (
          <div className="rankings-empty"><p>No active subscriptions.</p></div>
        )}
      </div>
    </div>
  );
}
