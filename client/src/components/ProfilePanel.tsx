/**
 * ProfilePanel - User Profile Management
 * View/edit profile, see role & permissions, change password, promote to super admin
 */
import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import type { Permission } from '../types';

const ROLE_BADGES: Record<string, { label: string; color: string; bg: string }> = {
  super_admin: { label: 'Super Admin', color: '#fff', bg: '#7C3AED' },
  admin: { label: 'Administrator', color: '#fff', bg: '#2563EB' },
  government: { label: 'Government', color: '#fff', bg: '#059669' },
  ngo: { label: 'NGO', color: '#fff', bg: '#D97706' },
  public: { label: 'Public', color: '#fff', bg: '#6B7280' },
  user: { label: 'Standard User', color: '#fff', bg: '#6B7280' },
};

// Group permissions by module
function groupPermissions(permissions: Permission[]): Record<string, Permission[]> {
  return permissions.reduce((acc, p) => {
    const mod = p.module || 'general';
    if (!acc[mod]) acc[mod] = [];
    acc[mod].push(p);
    return acc;
  }, {} as Record<string, Permission[]>);
}

export default function ProfilePanel() {
  const {
    user, permissions, isAuthenticated,
    updateProfile, promoteSuperAdmin, fetchProfile,
    isSuperAdmin
  } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'permissions'>('profile');
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [organization, setOrganization] = useState(user?.organization || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [promoting, setPromoting] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setOrganization(user.organization || '');
    }
  }, [user]);

  if (!isAuthenticated || !user) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <svg width="48" height="48" fill="none" stroke="var(--text-quaternary)" viewBox="0 0 24 24" style={{ margin: '0 auto 16px' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <h3 style={{ color: 'var(--text-secondary)', fontSize: 16, marginBottom: 8 }}>Not Signed In</h3>
        <p style={{ color: 'var(--text-quaternary)', fontSize: 13 }}>
          Please sign in to view and manage your profile.
        </p>
      </div>
    );
  }

  const roleBadge = ROLE_BADGES[user.role] || ROLE_BADGES.user;
  const groupedPerms = groupPermissions(permissions);

  const handleProfileSave = async () => {
    setSaving(true);
    setMessage(null);
    const result = await updateProfile({ fullName, organization });
    if (result.success) {
      setMessage({ type: 'success', text: 'Profile updated successfully' });
      setEditing(false);
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to update profile' });
    }
    setSaving(false);
  };

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }
    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters' });
      return;
    }
    if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setMessage({ type: 'error', text: 'Password must contain at least one letter and one digit' });
      return;
    }
    setSaving(true);
    setMessage(null);
    const result = await updateProfile({ currentPassword, newPassword });
    if (result.success) {
      setMessage({ type: 'success', text: 'Password changed successfully' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to change password' });
    }
    setSaving(false);
  };

  const handlePromote = async () => {
    if (!confirm('Are you sure you want to promote yourself to Super Administrator? This grants full system access.')) return;
    setPromoting(true);
    setMessage(null);
    const result = await promoteSuperAdmin();
    if (result.success) {
      setMessage({ type: 'success', text: result.message || 'Promoted to Super Administrator!' });
      await fetchProfile();
    } else {
      setMessage({ type: 'error', text: result.error || 'Promotion failed' });
    }
    setPromoting(false);
  };

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--blue), #7C3AED)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, fontWeight: 700, color: '#fff',
        }}>
          {user.full_name?.charAt(0)?.toUpperCase() || user.email.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {user.full_name || 'User'}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{user.email}</span>
            <span style={{
              display: 'inline-block', padding: '2px 10px', borderRadius: 12,
              fontSize: 11, fontWeight: 600,
              color: roleBadge.color, background: roleBadge.bg,
            }}>
              {roleBadge.label}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
        {(['profile', 'security', 'permissions'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setMessage(null); }}
            className="rankings-toggle-btn"
            style={activeTab === tab
              ? { background: 'var(--blue)', color: '#fff', borderColor: 'var(--blue)' }
              : {}}
          >
            {tab === 'profile' ? 'Profile' : tab === 'security' ? 'Security' : 'Permissions'}
          </button>
        ))}
      </div>

      {/* Message */}
      {message && (
        <div className={`report-message report-message-${message.type}`} style={{ marginBottom: 16 }}>
          {message.text}
        </div>
      )}

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: 24,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Profile Information
              </h3>
              {!editing ? (
                <button onClick={() => setEditing(true)} className="rankings-toggle-btn" style={{ fontSize: 12 }}>
                  Edit Profile
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => { setEditing(false); setFullName(user.full_name || ''); setOrganization(user.organization || ''); }}
                    className="rankings-toggle-btn" style={{ fontSize: 12 }}>
                    Cancel
                  </button>
                  <button onClick={handleProfileSave} disabled={saving}
                    className="download-btn" style={{ fontSize: 12, padding: '4px 16px', opacity: saving ? 0.6 : 1 }}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px', display: 'block', marginBottom: 4 }}>
                  Full Name
                </label>
                {editing ? (
                  <input className="intervention-input" type="text" value={fullName}
                    onChange={e => setFullName(e.target.value)} style={{ width: '100%' }} />
                ) : (
                  <p style={{ fontSize: 14, color: 'var(--text-primary)', margin: 0 }}>{user.full_name || '—'}</p>
                )}
              </div>

              <div>
                <label style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px', display: 'block', marginBottom: 4 }}>
                  Email
                </label>
                <p style={{ fontSize: 14, color: 'var(--text-primary)', margin: 0 }}>{user.email}</p>
              </div>

              <div>
                <label style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px', display: 'block', marginBottom: 4 }}>
                  Organization
                </label>
                {editing ? (
                  <input className="intervention-input" type="text" value={organization}
                    onChange={e => setOrganization(e.target.value)} style={{ width: '100%' }}
                    placeholder="Enter organization" />
                ) : (
                  <p style={{ fontSize: 14, color: 'var(--text-primary)', margin: 0 }}>{user.organization || '—'}</p>
                )}
              </div>

              <div>
                <label style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px', display: 'block', marginBottom: 4 }}>
                  Role
                </label>
                <span style={{
                  display: 'inline-block', padding: '3px 12px', borderRadius: 12,
                  fontSize: 12, fontWeight: 600,
                  color: roleBadge.color, background: roleBadge.bg,
                }}>
                  {roleBadge.label}
                </span>
              </div>

              <div>
                <label style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px', display: 'block', marginBottom: 4 }}>
                  User ID
                </label>
                <p style={{ fontSize: 14, color: 'var(--text-primary)', margin: 0 }}>#{user.id}</p>
              </div>
            </div>
          </div>

          {/* Promote to Super Admin card - only show if not already super_admin */}
          {user.role !== 'super_admin' && (
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)', padding: 24,
            }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>
                Role Elevation
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '0 0 16px' }}>
                If you are the first user or need full system access, you can promote your account to Super Administrator.
                This is only available if no other Super Admin exists.
              </p>
              <button onClick={handlePromote} disabled={promoting}
                className="download-btn"
                style={{
                  background: '#7C3AED', borderColor: '#7C3AED',
                  fontSize: 12, padding: '6px 20px',
                  opacity: promoting ? 0.6 : 1,
                }}>
                {promoting ? 'Promoting...' : 'Promote to Super Administrator'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: 24,
        }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 20px' }}>
            Change Password
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 400 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px', display: 'block', marginBottom: 4 }}>
                Current Password
              </label>
              <input className="intervention-input" type="password" value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)} style={{ width: '100%' }}
                placeholder="Enter current password" />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px', display: 'block', marginBottom: 4 }}>
                New Password
              </label>
              <input className="intervention-input" type="password" value={newPassword}
                onChange={e => setNewPassword(e.target.value)} style={{ width: '100%' }}
                placeholder="Enter new password (min 8 chars, letters + digits)" />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px', display: 'block', marginBottom: 4 }}>
                Confirm New Password
              </label>
              <input className="intervention-input" type="password" value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)} style={{ width: '100%' }}
                placeholder="Confirm new password" />
            </div>
            <button onClick={handlePasswordChange} disabled={saving || !currentPassword || !newPassword || !confirmPassword}
              className="download-btn"
              style={{ marginTop: 4, fontSize: 12, padding: '8px 20px', width: 'fit-content', opacity: (saving || !currentPassword || !newPassword) ? 0.5 : 1 }}>
              {saving ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </div>
      )}

      {/* Permissions Tab */}
      {activeTab === 'permissions' && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: 24,
        }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>
            Your Permissions
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '0 0 20px' }}>
            Permissions are determined by your role ({roleBadge.label}).
            {isSuperAdmin() && ' As Super Admin, you have access to all system features.'}
          </p>

          {isSuperAdmin() ? (
            <div style={{
              padding: 16, background: 'rgba(124, 58, 237, 0.1)',
              border: '1px solid rgba(124, 58, 237, 0.3)', borderRadius: 8,
            }}>
              <p style={{ fontSize: 13, color: '#A78BFA', fontWeight: 600, margin: 0 }}>
                Full Access — Super Administrators have unrestricted access to all features and modules.
              </p>
            </div>
          ) : permissions.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {Object.entries(groupedPerms).map(([module, perms]) => (
                <div key={module}>
                  <h4 style={{
                    fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)',
                    textTransform: 'uppercase', letterSpacing: '.5px', margin: '0 0 8px',
                  }}>
                    {module}
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {perms.map(p => (
                      <span key={p.id} style={{
                        display: 'inline-block', padding: '3px 10px',
                        borderRadius: 6, fontSize: 11, fontWeight: 500,
                        background: 'rgba(59, 130, 246, 0.1)',
                        border: '1px solid rgba(59, 130, 246, 0.2)',
                        color: 'var(--blue)',
                      }} title={p.description || p.name}>
                        {p.display_name || p.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--text-quaternary)' }}>
              No specific permissions assigned. Contact an administrator for access.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
