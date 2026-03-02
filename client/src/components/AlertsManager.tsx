/**
 * AlertsManager - Subscription management with email delivery & modern UI
 * Self-fetches subscriptions from API. Sends confirmation emails on subscribe.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import type { HotspotFeature } from '../types';
import { RISK_COLORS } from '../types';
import { useAuthStore, useFilterStore } from '../store';
import { getDynamicRiskLevel } from '../utils/riskTiers';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface Subscription {
  id: number;
  lga_name: string;
  state: string;
  alert_type: string;
  notify_email: boolean;
  created_at?: string;
}

interface Props {
  features: HotspotFeature[];
  subscriptions?: Subscription[];
  onRefresh?: () => void;
  searchQuery?: string;
  stateFilter?: string;
}

export default function AlertsManager({ features, onRefresh, searchQuery = '', stateFilter = '' }: Props) {
  const token = useAuthStore(s => s.token);
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const user = useAuthStore(s => s.user);
  const tieringMode = useFilterStore(s => s.tieringMode);

  const [lgaName, setLgaName] = useState('');
  const [alertType, setAlertType] = useState('risk_change');
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subError, setSubError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [mySubscriptions, setMySubscriptions] = useState<Subscription[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [lgaSearch, setLgaSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Fetch subscriptions from API
  const fetchSubscriptions = useCallback(async () => {
    if (!token) return;
    setLoadingSubs(true);
    try {
      const res = await axios.get(`${API}/v1/alerts/my`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMySubscriptions(res.data || []);
    } catch { /* silent */ }
    finally { setLoadingSubs(false); }
  }, [token]);

  useEffect(() => { fetchSubscriptions(); }, [fetchSubscriptions]);

  // Filter features
  const filteredFeatures = useMemo(() => {
    let list = [...features];
    if (stateFilter) list = list.filter(f => f.properties.State === stateFilter);
    if (searchQuery.length >= 2) {
      const term = searchQuery.toLowerCase();
      list = list.filter(f =>
        f.properties.LGA_Name.toLowerCase().includes(term) ||
        f.properties.State.toLowerCase().includes(term)
      );
    }
    return list;
  }, [features, searchQuery, stateFilter]);

  // LGA options with local search
  const lgaOptions = useMemo(() => {
    const names = [...new Set(filteredFeatures.map(f => f.properties.LGA_Name))].sort();
    if (!lgaSearch) return names;
    const term = lgaSearch.toLowerCase();
    return names.filter(n => n.toLowerCase().includes(term));
  }, [filteredFeatures, lgaSearch]);

  const getFeatureForLga = (name: string) =>
    features.find(f => f.properties.LGA_Name === name);

  // Filter subscriptions
  const filteredSubscriptions = useMemo(() => {
    let list = [...mySubscriptions];
    if (stateFilter) list = list.filter(s => s.state === stateFilter);
    if (searchQuery.length >= 2) {
      const term = searchQuery.toLowerCase();
      list = list.filter(s =>
        s.lga_name?.toLowerCase().includes(term) ||
        s.state?.toLowerCase().includes(term)
      );
    }
    return list;
  }, [mySubscriptions, searchQuery, stateFilter]);

  if (!isAuthenticated) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', gap: 16 }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(99,102,241,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="28" height="28" fill="none" stroke="#6366f1" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500 }}>Sign in to manage your alert subscriptions</p>
      </div>
    );
  }

  const subscribe = async () => {
    if (!lgaName) return;
    setSaving(true); setSubError(''); setSuccessMsg('');
    try {
      const feat = getFeatureForLga(lgaName);
      await axios.post(`${API}/v1/alerts/subscribe`,
        { lga_name: lgaName, state: feat?.properties.State || '', alert_type: alertType, notify_email: notifyEmail },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccessMsg(`Subscribed to ${lgaName}! ${notifyEmail ? 'A confirmation email has been sent.' : ''}`);
      setLgaName(''); setLgaSearch('');
      fetchSubscriptions(); onRefresh?.();
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      setSubError(err?.response?.data?.error || err.message || 'Subscription failed');
      setTimeout(() => setSubError(''), 5000);
    } finally { setSaving(false); }
  };

  const unsubscribe = async (id: number) => {
    setRemovingId(id);
    try {
      await axios.delete(`${API}/v1/alerts/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      fetchSubscriptions(); onRefresh?.();
    } catch { /* silent */ }
    finally { setRemovingId(null); }
  };

  const formatDate = (d?: string) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" fill="none" stroke="#fff" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Alert Subscriptions</h2>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-quaternary)' }}>Get notified about risk changes and anomalies via email</p>
          </div>
        </div>
      </div>

      {/* Subscribe Form Card */}
      <div style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border)', borderRadius: 14, padding: '24px 28px', marginBottom: 24, boxShadow: '0 4px 24px rgba(0,0,0,.12)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
          <svg width="16" height="16" fill="none" stroke="var(--text-tertiary)" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '-0.01em' }}>New Subscription</h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 12, alignItems: 'end' }}>
          {/* LGA selector with search */}
          <div style={{ position: 'relative' }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-quaternary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>LGA Area</label>
            <input type="text" placeholder="Search & select LGA..."
              value={lgaName || lgaSearch}
              onChange={(e) => { setLgaSearch(e.target.value); setLgaName(''); setDropdownOpen(true); }}
              onFocus={() => setDropdownOpen(true)}
              onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
              style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 13, fontWeight: 500, outline: 'none' }} />
            {dropdownOpen && !lgaName && (lgaSearch || !lgaName) && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, maxHeight: 200, overflowY: 'auto', background: 'var(--bg-sidebar)', border: '1px solid var(--border)', borderRadius: 10, marginTop: 4, boxShadow: '0 8px 32px rgba(0,0,0,.25)' }}>
                {lgaOptions.slice(0, 20).map(n => {
                  const feat = getFeatureForLga(n);
                  const risk = feat ? getDynamicRiskLevel(feat, tieringMode) : null;
                  return (
                    <button key={n} onMouseDown={() => { setLgaName(n); setLgaSearch(''); setDropdownOpen(false); }}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '9px 14px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-panel-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <span><span style={{ fontWeight: 600 }}>{n}</span>{feat && <span style={{ color: 'var(--text-quaternary)', marginLeft: 6, fontSize: 11 }}>{feat.properties.State}</span>}</span>
                      {risk && <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 9, fontWeight: 700, color: '#fff', background: RISK_COLORS[risk] || '#666' }}>{risk}</span>}
                    </button>
                  );
                })}
                {lgaOptions.length === 0 && <div style={{ padding: '12px 14px', color: 'var(--text-quaternary)', fontSize: 12 }}>No LGAs found</div>}
              </div>
            )}
          </div>

          {/* Alert type */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-quaternary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type</label>
            <select value={alertType} onChange={e => setAlertType(e.target.value)}
              style={{ padding: '10px 14px', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 13, fontWeight: 500, outline: 'none', cursor: 'pointer', minWidth: 130 }}>
              <option value="risk_change">Risk Change</option>
              <option value="anomaly">Anomaly</option>
              <option value="all">All Events</option>
            </select>
          </div>

          {/* Email toggle */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-quaternary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notify</label>
            <button onClick={() => setNotifyEmail(!notifyEmail)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: notifyEmail ? 'rgba(99,102,241,.12)' : 'var(--bg-panel)', border: `1px solid ${notifyEmail ? 'rgba(99,102,241,.35)' : 'var(--border)'}`, borderRadius: 10, color: notifyEmail ? '#818cf8' : 'var(--text-quaternary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              Email
            </button>
          </div>

          {/* Subscribe button */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'transparent', marginBottom: 6 }}>&nbsp;</label>
            <button onClick={subscribe} disabled={!lgaName || saving}
              style={{ padding: '10px 24px', background: (!lgaName || saving) ? 'rgba(99,102,241,.3)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: (!lgaName || saving) ? 'not-allowed' : 'pointer', opacity: (!lgaName || saving) ? 0.5 : 1, whiteSpace: 'nowrap' as const }}>
              {saving ? 'Subscribing...' : 'Subscribe'}
            </button>
          </div>
        </div>

        {/* Success / Error */}
        {successMsg && (
          <div style={{ marginTop: 14, padding: '10px 16px', borderRadius: 10, background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)', color: '#34d399', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {successMsg}
          </div>
        )}
        {subError && (
          <div style={{ marginTop: 14, padding: '10px 16px', borderRadius: 10, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: '#f87171', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {subError}
          </div>
        )}
      </div>

      {/* Active Subscriptions */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Active Subscriptions</h3>
            <span style={{ padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: 'rgba(99,102,241,.12)', color: '#818cf8' }}>{filteredSubscriptions.length}</span>
          </div>
          <button onClick={fetchSubscriptions} style={{ background: 'none', border: 'none', color: 'var(--text-quaternary)', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Refresh
          </button>
        </div>

        {loadingSubs ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
            <div className="spinner" />
          </div>
        ) : filteredSubscriptions.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', gap: 12, background: 'var(--bg-sidebar)', border: '1px dashed var(--border)', borderRadius: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(99,102,241,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" fill="none" stroke="var(--text-quaternary)" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            </div>
            <p style={{ margin: 0, color: 'var(--text-quaternary)', fontSize: 14, fontWeight: 500 }}>No active subscriptions</p>
            <p style={{ margin: 0, color: 'var(--text-quaternary)', fontSize: 12, opacity: 0.6 }}>Subscribe to an LGA above to start receiving alerts</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredSubscriptions.map(s => {
              const feat = getFeatureForLga(s.lga_name);
              const risk = feat ? getDynamicRiskLevel(feat, tieringMode) : null;
              const riskColor = risk ? RISK_COLORS[risk] || '#666' : '#666';
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: 'var(--bg-sidebar)', border: '1px solid var(--border)', borderRadius: 12, borderLeft: `3px solid ${riskColor}` }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: `${riskColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="16" height="16" fill="none" stroke={riskColor} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{s.lga_name || s.state}</span>
                      {s.state && s.lga_name && <span style={{ fontSize: 11, color: 'var(--text-quaternary)' }}>{s.state}</span>}
                      <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: 'rgba(99,102,241,.1)', color: '#818cf8', textTransform: 'capitalize' as const }}>{s.alert_type.replace(/_/g, ' ')}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                      {s.notify_email && <span style={{ fontSize: 11, color: 'var(--text-quaternary)', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        Email alerts on
                      </span>}
                      {s.created_at && <span style={{ fontSize: 11, color: 'var(--text-quaternary)', opacity: 0.6 }}>Since {formatDate(s.created_at)}</span>}
                    </div>
                  </div>
                  {risk && <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 10, fontWeight: 700, background: `${riskColor}22`, color: riskColor, border: `1px solid ${riskColor}33` }}>{risk}</span>}
                  <button onClick={() => unsubscribe(s.id)} disabled={removingId === s.id} title="Remove"
                    style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.15)', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: removingId === s.id ? 0.5 : 1 }}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info banner */}
      <div style={{ marginTop: 20, padding: '14px 18px', borderRadius: 12, background: 'rgba(99,102,241,.04)', border: '1px solid rgba(99,102,241,.1)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <svg width="16" height="16" fill="none" stroke="#6366f1" viewBox="0 0 24 24" style={{ marginTop: 1, flexShrink: 0 }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <div style={{ fontSize: 12, color: 'var(--text-quaternary)', lineHeight: 1.5 }}>
          <strong style={{ color: 'var(--text-tertiary)' }}>How it works:</strong> When risk levels change or anomalies are detected in your subscribed LGAs, you'll receive email notifications at <strong style={{ color: 'var(--text-tertiary)' }}>{user?.email || 'your email'}</strong>.
        </div>
      </div>
    </div>
  );
}
