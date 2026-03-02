/**
 * User Management Panel - RBAC Administration Interface
 * Super Administrator panel for managing users, roles, and permissions
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import type { UserWithRBAC, Role, UsersListResponse, GeographicScope } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

// Nigerian States
const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
  'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu',
  'FCT', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi',
  'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun',
  'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'
];

interface AddUserFormData {
  username: string;
  email: string;
  password: string;
  fullName: string;
  roleId: number;
  organization: string;
  geographicScopes: GeographicScope[];
}

interface EditUserFormData {
  username: string;
  email: string;
  fullName: string;
  roleId: number;
  organization: string;
  isActive: boolean;
  geographicScopes: GeographicScope[];
}

export function UserManagementPanel() {
  const { token, hasPermission, isSuperAdmin } = useAuthStore();
  
  // State
  const [users, setUsers] = useState<UserWithRBAC[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRBAC | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Form data
  const [addFormData, setAddFormData] = useState<AddUserFormData>({
    username: '',
    email: '',
    password: '',
    fullName: '',
    roleId: 3,
    organization: '',
    geographicScopes: []
  });
  
  const [editFormData, setEditFormData] = useState<EditUserFormData>({
    username: '',
    email: '',
    fullName: '',
    roleId: 3,
    organization: '',
    isActive: true,
    geographicScopes: []
  });

  // Check permissions
  const canViewUsers = hasPermission('users.view') || isSuperAdmin();
  const canCreateUsers = hasPermission('users.create') || isSuperAdmin();
  const canEditUsers = hasPermission('users.edit') || isSuperAdmin();
  const canDeleteUsers = hasPermission('users.delete') || isSuperAdmin();

  // Fetch users
  const fetchUsers = useCallback(async () => {
    if (!token || !canViewUsers) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      params.append('page', currentPage.toString());
      params.append('limit', '10');
      if (searchTerm) params.append('search', searchTerm);
      if (roleFilter) params.append('role', roleFilter);
      if (stateFilter) params.append('state', stateFilter);
      
      const response = await fetch(`${API_BASE}/users?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Failed to fetch users');
      
      const data: UsersListResponse = await response.json();
      setUsers(data.users);
      setTotalPages(data.totalPages);
      setTotalUsers(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [token, currentPage, searchTerm, roleFilter, stateFilter, canViewUsers]);

  // Fetch roles
  const fetchRoles = useCallback(async () => {
    if (!token) return;
    
    try {
      const response = await fetch(`${API_BASE}/roles`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setRoles(data);
      }
    } catch (err) {
      console.error('Failed to fetch roles:', err);
    }
  }, [token]);

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, [fetchUsers, fetchRoles]);

  // Handle add user
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !canCreateUsers) return;
    
    setSubmitting(true);
    setFormError(null);
    
    try {
      const response = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(addFormData)
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create user');
      }
      
      setShowAddModal(false);
      setAddFormData({
        username: '',
        email: '',
        password: '',
        fullName: '',
        roleId: 3,
        organization: '',
        geographicScopes: []
      });
      fetchUsers();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle edit user
  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !canEditUsers || !selectedUser) return;
    
    setSubmitting(true);
    setFormError(null);
    
    try {
      const response = await fetch(`${API_BASE}/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editFormData)
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update user');
      }
      
      setShowEditModal(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle revoke access
  const handleRevokeAccess = async (userId: number) => {
    if (!token || !canDeleteUsers) return;
    if (!confirm('Are you sure you want to revoke this user\'s access?')) return;
    
    try {
      const response = await fetch(`${API_BASE}/users/${userId}/revoke`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Failed to revoke access');
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  // Handle restore access
  const handleRestoreAccess = async (userId: number) => {
    if (!token || !canEditUsers) return;
    
    try {
      const response = await fetch(`${API_BASE}/users/${userId}/restore`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Failed to restore access');
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  // Open edit modal
  const openEditModal = async (user: UserWithRBAC) => {
    setSelectedUser(user);
    setEditFormData({
      username: user.username || '',
      email: user.email,
      fullName: user.full_name,
      roleId: user.role_id,
      organization: user.organization || '',
      isActive: user.is_active,
      geographicScopes: user.geographic_scopes || []
    });
    setShowEditModal(true);
  };

  // Format date
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Role badge styles
  const getRoleBadge = (roleName: string): { bg: string; color: string; border: string } => {
    switch (roleName) {
      case 'super_admin': return { bg: 'rgba(139,92,246,0.12)', color: '#c4b5fd', border: 'rgba(139,92,246,0.3)' };
      case 'admin': return { bg: 'rgba(99,102,241,0.12)', color: '#818cf8', border: 'rgba(99,102,241,0.3)' };
      case 'government': return { bg: 'rgba(16,185,129,0.12)', color: '#6ee7b7', border: 'rgba(16,185,129,0.3)' };
      case 'ngo': return { bg: 'rgba(245,158,11,0.12)', color: '#fcd34d', border: 'rgba(245,158,11,0.3)' };
      default: return { bg: 'rgba(255,255,255,0.06)', color: '#94a3b8', border: 'rgba(255,255,255,0.1)' };
    }
  };

  // Shared inline styles
  const S = {
    input: {
      width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 8,
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
      color: '#f1f5f9', outline: 'none', transition: 'border-color .15s',
    } as React.CSSProperties,
    label: { display: 'block', fontSize: 12, fontWeight: 500, color: '#94a3b8', marginBottom: 4 } as React.CSSProperties,
    card: {
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 12, padding: '16px 20px',
    } as React.CSSProperties,
  };

  if (!canViewUsers) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60, textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, fontSize: 24 }}>🔒</div>
        <p style={{ color: '#f1f5f9', fontSize: 16, fontWeight: 600, margin: '0 0 6px' }}>Access Denied</p>
        <p style={{ color: '#64748b', fontSize: 13 }}>You don't have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, color: '#f1f5f9', fontFamily: 'inherit' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 20 }}>👥</span>
            <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 20, margin: 0 }}>User Management</h2>
          </div>
          <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Manage users, roles, and geographic permissions</p>
        </div>
        {canCreateUsers && (
          <button onClick={() => setShowAddModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#fff', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', cursor: 'pointer', boxShadow: '0 2px 12px rgba(99,102,241,0.3)' }}>
            <span style={{ fontSize: 16 }}>+</span> Add New User
          </button>
        )}
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Users', value: totalUsers, icon: '👤', accent: '#818cf8' },
          { label: 'Active', value: users.filter(u => u.is_active).length, icon: '✅', accent: '#10b981' },
          { label: 'Inactive', value: users.filter(u => !u.is_active).length, icon: '⏸', accent: '#f59e0b' },
        ].map(stat => (
          <div key={stat.label} style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 12, flex: '1 1 140px', minWidth: 140 }}>
            <span style={{ fontSize: 18 }}>{stat.icon}</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: stat.accent, fontVariantNumeric: 'tabular-nums' }}>{stat.value}</div>
              <div style={{ fontSize: 11, color: '#64748b', letterSpacing: '0.02em' }}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#64748b', pointerEvents: 'none' }}>🔍</span>
          <input type="text" placeholder="Search users..." value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            style={{ ...S.input, paddingLeft: 32 }}
            onFocus={e => e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'}
            onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'} />
        </div>
        <select aria-label="Filter by role" value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setCurrentPage(1); }}
          style={S.input}>
          <option value="">All Roles</option>
          {roles.map(role => <option key={role.id} value={role.name}>{role.display_name}</option>)}
        </select>
        <select aria-label="Filter by state" value={stateFilter}
          onChange={(e) => { setStateFilter(e.target.value); setCurrentPage(1); }}
          style={S.input}>
          <option value="">All States</option>
          {NIGERIAN_STATES.map(state => <option key={state} value={state}>{state}</option>)}
        </select>
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 12, color: '#64748b' }}>
          Showing {users.length} of {totalUsers} users
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5', fontSize: 13 }}>
          ⚠ {error}
        </div>
      )}

      {/* Users list */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 240 }}>
          <div style={{ width: 36, height: 36, border: '3px solid rgba(99,102,241,0.2)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1.5fr 1.5fr 100px', gap: 8, padding: '10px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {['User', 'Email', 'Role', 'Scope', 'Last Active', 'Actions'].map(h => (
              <div key={h} style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>{h}</div>
            ))}
          </div>

          {/* User rows */}
          {users.map(user => {
            const badge = getRoleBadge(user.role_name);
            return (
              <div key={user.id}
                style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1.5fr 1.5fr 100px', gap: 8, padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.02)', opacity: user.is_active ? 1 : 0.5, transition: 'background .15s, border-color .15s', alignItems: 'center', cursor: 'default' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.2)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'; }}>
                {/* User info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {user.full_name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{user.full_name || 'Unknown'}</div>
                    <div style={{ fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>@{user.username || user.email.split('@')[0]}</div>
                  </div>
                </div>
                {/* Email */}
                <div style={{ fontSize: 12, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{user.email}</div>
                {/* Role */}
                <div>
                  <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, textTransform: 'uppercase' as const, letterSpacing: '0.03em' }}>
                    {user.role_display_name}
                  </span>
                </div>
                {/* Geographic scope */}
                <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 4, overflow: 'hidden' }}>
                  {user.assigned_states?.slice(0, 2).map(state => (
                    <span key={state} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}>{state}</span>
                  ))}
                  {user.assigned_states && user.assigned_states.length > 2 && (
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(99,102,241,0.1)', color: '#818cf8' }}>+{user.assigned_states.length - 2}</span>
                  )}
                  {(!user.assigned_states || user.assigned_states.length === 0) && (
                    <span style={{ fontSize: 10, color: '#475569', fontStyle: 'italic' }}>All States</span>
                  )}
                </div>
                {/* Last active */}
                <div style={{ fontSize: 11, color: '#64748b' }}>{formatDate(user.last_active || user.last_login)}</div>
                {/* Actions */}
                <div style={{ display: 'flex', gap: 4 }}>
                  {canEditUsers && (
                    <button onClick={() => openEditModal(user)} title="Edit user"
                      style={{ width: 30, height: 30, borderRadius: 6, border: 'none', background: 'rgba(99,102,241,0.1)', color: '#818cf8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, transition: 'background .15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.25)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(99,102,241,0.1)'}>
                      ✏️
                    </button>
                  )}
                  {user.is_active ? (
                    canDeleteUsers && (
                      <button onClick={() => handleRevokeAccess(user.id)} title="Revoke access"
                        style={{ width: 30, height: 30, borderRadius: 6, border: 'none', background: 'rgba(239,68,68,0.1)', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, transition: 'background .15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.25)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}>
                        🚫
                      </button>
                    )
                  ) : (
                    canEditUsers && (
                      <button onClick={() => handleRestoreAccess(user.id)} title="Restore access"
                        style={{ width: 30, height: 30, borderRadius: 6, border: 'none', background: 'rgba(16,185,129,0.1)', color: '#6ee7b7', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, transition: 'background .15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(16,185,129,0.25)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(16,185,129,0.1)'}>
                        ✅
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}

          {users.length === 0 && (
            <div style={{ padding: 48, textAlign: 'center', color: '#475569', fontSize: 13 }}>
              <span style={{ fontSize: 32, display: 'block', marginBottom: 8 }}>🔍</span>
              No users found
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
            style={{ padding: '8px 16px', fontSize: 12, fontWeight: 500, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: currentPage === 1 ? '#374151' : '#d1d5db', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}>
            ‹ Previous
          </button>
          <div style={{ display: 'flex', gap: 4 }}>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let page: number;
              if (totalPages <= 5) page = i + 1;
              else if (currentPage <= 3) page = i + 1;
              else if (currentPage >= totalPages - 2) page = totalPages - 4 + i;
              else page = currentPage - 2 + i;
              return (
                <button key={page} onClick={() => setCurrentPage(page)}
                  style={{ width: 36, height: 36, borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: currentPage === page ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(255,255,255,0.04)', color: currentPage === page ? '#fff' : '#94a3b8', transition: 'all .15s' }}>
                  {page}
                </button>
              );
            })}
          </div>
          <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
            style={{ padding: '8px 16px', fontSize: 12, fontWeight: 500, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: currentPage === totalPages ? '#374151' : '#d1d5db', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}>
            Next ›
          </button>
        </div>
      )}

      {/* Add User Modal */}
      {showAddModal && (
        <UserFormModal title="Add New User" formData={addFormData}
          setFormData={(data) => setAddFormData(data as AddUserFormData)}
          onSubmit={handleAddUser} onClose={() => setShowAddModal(false)}
          roles={roles} error={formError} submitting={submitting} isEdit={false} />
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <UserFormModal title="Edit User" formData={editFormData}
          setFormData={(data) => setEditFormData(data as EditUserFormData)}
          onSubmit={handleEditUser} onClose={() => { setShowEditModal(false); setSelectedUser(null); }}
          roles={roles} error={formError} submitting={submitting} isEdit={true} />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Modal ───────────────────────────────────────────────────────────────────

interface UserFormModalProps {
  title: string;
  formData: AddUserFormData | EditUserFormData;
  setFormData: React.Dispatch<React.SetStateAction<AddUserFormData | EditUserFormData>>;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  roles: Role[];
  error: string | null;
  submitting: boolean;
  isEdit: boolean;
}

function UserFormModal({ title, formData, setFormData, onSubmit, onClose, roles, error, submitting, isEdit }: UserFormModalProps) {
  const [selectedStates, setSelectedStates] = useState<string[]>(
    formData.geographicScopes.map(s => s.state)
  );

  const handleStateToggle = (state: string) => {
    const newStates = selectedStates.includes(state)
      ? selectedStates.filter(s => s !== state)
      : [...selectedStates, state];
    setSelectedStates(newStates);
    setFormData(prev => ({ ...prev, geographicScopes: newStates.map(s => ({ state: s })) }));
  };

  const selectAllStates = () => {
    setSelectedStates([]);
    setFormData(prev => ({ ...prev, geographicScopes: [] }));
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 8,
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
    color: '#f1f5f9', outline: 'none',
  };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 500, color: '#94a3b8', marginBottom: 4 };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      {/* Backdrop */}
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose} />

      {/* Modal */}
      <div style={{ position: 'relative', width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', borderRadius: 16, background: 'linear-gradient(160deg, #111827 0%, #0f172a 100%)', border: '1px solid rgba(99,102,241,0.2)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', padding: 28, animation: 'modalIn 0.2s ease' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h3 style={{ color: '#fff', fontWeight: 700, fontSize: 18, margin: 0 }}>{title}</h3>
          <button type="button" onClick={onClose} title="Close modal"
            style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.06)', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}>
            ✕
          </button>
        </div>

        {error && (
          <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5', fontSize: 13 }}>
            ⚠ {error}
          </div>
        )}

        <form onSubmit={onSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={labelStyle}>Full Name *</label>
              <input type="text" required value={formData.fullName}
                onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                style={inputStyle} placeholder="John Doe" />
            </div>
            <div>
              <label style={labelStyle}>Username</label>
              <input type="text" value={formData.username || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                style={inputStyle} placeholder="johndoe" />
            </div>
            <div>
              <label style={labelStyle}>Email *</label>
              <input type="email" required value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                style={inputStyle} placeholder="john@example.com" />
            </div>
            <div>
              <label style={labelStyle}>Organization</label>
              <input type="text" value={formData.organization || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, organization: e.target.value }))}
                style={inputStyle} placeholder="Ministry of Health" />
            </div>
            {!isEdit && (
              <div style={{ gridColumn: '1/3' }}>
                <label style={labelStyle}>Password *</label>
                <input type="password" required={!isEdit}
                  value={(formData as AddUserFormData).password || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  style={inputStyle} placeholder="Min 8 chars with letter and number" />
              </div>
            )}
            <div>
              <label style={labelStyle}>Role *</label>
              <select aria-label="Select user role" value={formData.roleId}
                onChange={(e) => setFormData(prev => ({ ...prev, roleId: parseInt(e.target.value) }))}
                style={inputStyle}>
                {roles.map(role => <option key={role.id} value={role.id}>{role.display_name}</option>)}
              </select>
            </div>
            {isEdit && (
              <div>
                <label style={labelStyle}>Status</label>
                <select aria-label="User status"
                  value={(formData as EditUserFormData).isActive ? 'active' : 'inactive'}
                  onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.value === 'active' }))}
                  style={inputStyle}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            )}
          </div>

          {/* Geographic Scope */}
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Geographic Scope (States)</label>
              <button type="button" onClick={selectAllStates}
                style={{ fontSize: 11, color: '#818cf8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                Clear Selection (All States)
              </button>
            </div>
            <div style={{ padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', maxHeight: 180, overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px 4px' }}>
                {NIGERIAN_STATES.map(state => {
                  const checked = selectedStates.includes(state);
                  return (
                    <label key={state} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: checked ? '#c4b5fd' : '#94a3b8', padding: '3px 6px', borderRadius: 6, background: checked ? 'rgba(99,102,241,0.1)' : 'transparent', transition: 'background .15s' }}>
                      <input type="checkbox" checked={checked} onChange={() => handleStateToggle(state)}
                        style={{ accentColor: '#6366f1', width: 14, height: 14 }} />
                      {state}
                    </label>
                  );
                })}
              </div>
            </div>
            <p style={{ marginTop: 6, fontSize: 11, color: '#475569' }}>
              {selectedStates.length === 0 ? 'User will have access to all states' : `${selectedStates.length} state(s) selected`}
            </p>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <button type="button" onClick={onClose}
              style={{ padding: '9px 20px', fontSize: 13, fontWeight: 500, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#d1d5db', cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 24px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', background: submitting ? 'rgba(99,102,241,0.4)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', cursor: submitting ? 'not-allowed' : 'pointer', boxShadow: '0 2px 12px rgba(99,102,241,0.3)' }}>
              {submitting && <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />}
              {isEdit ? 'Save Changes' : 'Create User'}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes modalIn { from { opacity: 0; transform: translateY(12px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

export default UserManagementPanel;
