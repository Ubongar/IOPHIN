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
    return <div className="p-4 text-gray-400 text-sm">Please log in to manage alert subscriptions.</div>;
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
    <div className="p-4">
      <h2 className="text-lg font-bold text-gray-100 mb-4">Alert Subscriptions</h2>
      <div className="bg-gray-800 rounded p-4 mb-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Subscribe to LGA</h3>
        <div className="flex gap-2 flex-wrap">
          <select className="text-xs bg-gray-700 text-gray-200 rounded px-2 py-1 border border-gray-600 flex-1 min-w-32"
            value={lgaName} onChange={e => setLgaName(e.target.value)}>
            <option value="">Select LGA...</option>
            {lgaNames.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <select className="text-xs bg-gray-700 text-gray-200 rounded px-2 py-1 border border-gray-600"
            value={alertType} onChange={e => setAlertType(e.target.value)}>
            <option value="risk_change">Risk Change</option>
            <option value="anomaly">Anomaly</option>
          </select>
          <label className="flex items-center gap-1 text-xs text-gray-300">
            <input type="checkbox" checked={notifyEmail} onChange={e => setNotifyEmail(e.target.checked)} />
            Email
          </label>
          <button onClick={subscribe} disabled={!lgaName || saving}
            className="text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-3 py-1 rounded">
            Subscribe
          </button>
        </div>
        {subError && <p className="text-red-400 text-xs mt-2">{subError}</p>}
      </div>
      <h3 className="text-sm font-semibold text-gray-300 mb-2">Active Subscriptions ({subscriptions.length})</h3>
      <div className="space-y-1">
        {subscriptions.map(s => (
          <div key={s.id} className="flex items-center justify-between bg-gray-800 rounded px-3 py-2">
            <div className="text-xs text-gray-300">
              <span className="font-medium">{s.lga_name || s.state}</span>
              <span className="text-gray-500 ml-2">{s.alert_type}</span>
              {s.notify_email && <span className="ml-2 text-blue-400">✉</span>}
            </div>
            <button onClick={() => unsubscribe(s.id)}
              className="text-xs text-red-400 hover:text-red-300 ml-2">✕</button>
          </div>
        ))}
        {subscriptions.length === 0 && <p className="text-gray-500 text-sm">No active subscriptions.</p>}
      </div>
    </div>
  );
}
