import { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import Toast from '../components/Toast';
import useToast from '../hooks/useToast';
import { supabase } from '../api';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

export default function StaffManagement() {
    const { role } = useAuth();
    const { toast, showToast } = useToast();
    const [staffList, setStaffList] = useState([]);
    const [loading, setLoading] = useState(true);

    // Edit states
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');
    const [editPassword, setEditPassword] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const [saving, setSaving] = useState(false);
    const [showPassFor, setShowPassFor] = useState(null);

    // New staff modal
    const [showAddModal, setShowAddModal] = useState(false);
    const [newStaff, setNewStaff] = useState({
        name: '',
        email: '',
        password: 'jkfinstride@123',
        category: 'ITR_FILING',
    });
    const [adding, setAdding] = useState(false);

    // ── fetchStaff defined BEFORE any conditional return ──────────────────
    const fetchStaff = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('staff')
            .select('id, name, email, staff_code, category, status, password, created_at')
            .order('created_at');
        if (!error) setStaffList(data || []);
        setLoading(false);
    }, []);

    useEffect(() => {
        if (role === 'admin') fetchStaff();
    }, [role, fetchStaff]);

    // ── Guard: non-admin redirect (AFTER hooks) ───────────────────────────
    if (role !== 'admin') return <Navigate to="/" replace />;

    // ── Edit helpers ──────────────────────────────────────────────────────
    const startEdit = (s) => {
        setEditingId(s.id);
        setEditName(s.name || '');
        setEditEmail(s.email || '');
        setEditPassword('');
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditName('');
        setEditEmail('');
        setEditPassword('');
    };

    const handleSave = async (staffId) => {
        if (!editName.trim()) return showToast('⚠️', 'Name cannot be empty');
        setSaving(true);
        try {
            const updates = {
                name: editName.trim(),
                email: editEmail.trim().toLowerCase(),
                updated_at: new Date().toISOString(),
            };

            if (editPassword.trim()) {
                const { data: hashData, error: hashError } = await supabase.rpc('hash_password', {
                    p_password: editPassword.trim(),
                });
                if (hashError) throw new Error('Hash failed: ' + hashError.message);
                updates.password = hashData;
            }

            const { error } = await supabase.from('staff').update(updates).eq('id', staffId);
            if (error) throw new Error(error.message);
            showToast('✅', 'Staff updated successfully!');
            cancelEdit();
            await fetchStaff();
        } catch (err) {
            showToast('❌', 'Failed: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleToggleStatus = async (staffId, currentStatus) => {
        const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
        const { error } = await supabase
            .from('staff')
            .update({ status: newStatus })
            .eq('id', staffId);
        if (!error) {
            showToast('✅', `Staff ${newStatus === 'active' ? 'activated' : 'deactivated'}!`);
            await fetchStaff();
        } else {
            showToast('❌', 'Status update failed: ' + error.message);
        }
    };

    // ── FIX: hash password before inserting new staff ─────────────────────
    const handleAddStaff = async () => {
        if (!newStaff.name.trim() || !newStaff.email.trim())
            return showToast('⚠️', 'Name & Email required');

        setAdding(true);
        try {
            // 1. Hash the password via Supabase RPC
            const rawPassword = newStaff.password.trim() || 'jkfinstride@123';
            const { data: hashedPwd, error: hashError } = await supabase.rpc('hash_password', {
                p_password: rawPassword,
            });
            if (hashError) throw new Error('Password hash failed: ' + hashError.message);

            // 2. Insert staff with hashed password
            const { error } = await supabase.from('staff').insert({
                name: newStaff.name.trim(),
                email: newStaff.email.trim().toLowerCase(),
                password: hashedPwd,           // ✅ hashed, not plain text
                category: [newStaff.category],
                status: 'active',
            });
            if (error) throw new Error(error.message);

            showToast('✅', `Staff "${newStaff.name.trim()}" added successfully!`);
            setShowAddModal(false);
            setNewStaff({ name: '', email: '', password: 'jkfinstride@123', category: 'ITR_FILING' });
            await fetchStaff();
        } catch (err) {
            showToast('❌', 'Failed: ' + err.message);
        } finally {
            setAdding(false);
        }
    };

    const categories = ['ITR_FILING', 'GST_FILING', 'AUDIT'];

    return (
        <div className="app-layout">
            <Sidebar />
            <div className="main-content">
                <div className="topbar">
                    <h1 className="topbar-title">👨‍💼 Staff Management</h1>
                    {/* <button className="btn-primary" onClick={() => setShowAddModal(true)}>
                        ➕ Add New Staff
                    </button> */}
                </div>

                <div className="page-content">
                    {/* ── Stats ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                        {[
                            { label: 'Total Staff',  value: staffList.length,                                    icon: '👥', color: '#a5b4fc' },
                            { label: 'Active',       value: staffList.filter(s => s.status === 'active').length, icon: '✅', color: '#34d399' },
                            { label: 'Inactive',     value: staffList.filter(s => s.status !== 'active').length, icon: '⛔', color: '#f87171' },
                        ].map((s, i) => (
                            <div key={i} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                                <div style={{ fontSize: '24px' }}>{s.icon}</div>
                                <div>
                                    <div style={{ fontSize: '24px', fontWeight: 800, color: s.color }}>{s.value}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>{s.label}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* ── Staff Table ── */}
                    <div className="table-card">
                        <div className="table-header">
                            <span style={{ fontWeight: 700, fontSize: '15px' }}>👨‍💼 All Staff Members</span>
                            <button className="btn-sm" onClick={fetchStaff}>🔄 Refresh</button>
                        </div>

                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>⏳ Loading...</div>
                        ) : staffList.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                <div style={{ fontSize: '32px', marginBottom: '12px' }}>👤</div>
                                <div>No staff members yet. Add one!</div>
                            </div>
                        ) : (
                            <table>
                                <thead>
                                    <tr>
                                        <th>Staff</th>
                                        <th>Email</th>
                                        <th>Password</th>
                                        <th>Category</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {staffList.map(s => (
                                        <tr key={s.id}>
                                            {editingId === s.id ? (
                                                // ── EDIT MODE ──
                                                <>
                                                    <td>
                                                        <input
                                                            autoFocus
                                                            value={editName}
                                                            onChange={e => setEditName(e.target.value)}
                                                            placeholder="Staff name"
                                                            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--accent)', borderRadius: '8px', padding: '6px 10px', color: '#fff', fontSize: '13px', width: '140px', outline: 'none' }}
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            value={editEmail}
                                                            onChange={e => setEditEmail(e.target.value)}
                                                            placeholder="Email"
                                                            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 10px', color: '#fff', fontSize: '13px', width: '180px', outline: 'none' }}
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            value={editPassword}
                                                            onChange={e => setEditPassword(e.target.value)}
                                                            placeholder="New password (optional)"
                                                            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 10px', color: '#fff', fontSize: '13px', width: '180px', outline: 'none' }}
                                                        />
                                                    </td>
                                                    <td>
                                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                            {Array.isArray(s.category) ? s.category.join(', ') : s.category}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>
                                                            {s.status}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', gap: '6px' }}>
                                                            <button
                                                                className="btn-sm green"
                                                                onClick={() => handleSave(s.id)}
                                                                disabled={saving}
                                                                style={{ fontSize: '12px', padding: '5px 12px' }}
                                                            >
                                                                {saving ? '⏳' : '✅ Save'}
                                                            </button>
                                                            <button
                                                                className="btn-sm"
                                                                onClick={cancelEdit}
                                                                style={{ fontSize: '12px', padding: '5px 12px' }}
                                                            >
                                                                ✕ Cancel
                                                            </button>
                                                        </div>
                                                    </td>
                                                </>
                                            ) : (
                                                // ── VIEW MODE ──
                                                <>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                            <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'var(--accent-light)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '12px' }}>
                                                                {s.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                                            </div>
                                                            <div>
                                                                <div style={{ fontWeight: 700, fontSize: '13px' }}>{s.name}</div>
                                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.staff_code || '—'}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style={{ fontSize: '13px', color: '#94a3b8' }}>{s.email}</td>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <span style={{ fontFamily: 'monospace', fontSize: '13px', color: showPassFor === s.id ? '#fff' : 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '3px 10px', borderRadius: '6px', letterSpacing: showPassFor === s.id ? '0' : '2px' }}>
                                                                {showPassFor === s.id ? (s.password || '—') : '••••••••'}
                                                            </span>
                                                            {/* <button
                                                                onClick={() => setShowPassFor(showPassFor === s.id ? null : s.id)}
                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: 'var(--text-muted)', padding: '2px' }}
                                                            >
                                                                {showPassFor === s.id ? 'Hide' : 'Show'}
                                                            </button> */}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600 }}>
                                                            {Array.isArray(s.category) ? s.category.join(', ') : s.category || '—'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <button
                                                            onClick={() => handleToggleStatus(s.id, s.status)}
                                                            style={{
                                                                background: s.status === 'active' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                                                                color: s.status === 'active' ? '#34d399' : '#f87171',
                                                                border: `1px solid ${s.status === 'active' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                                                                padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                                                            }}
                                                        >
                                                            {s.status === 'active' ? '✅ Active' : '⛔ Inactive'}
                                                        </button>
                                                    </td>
                                                    <td>
                                                        <button
                                                            className="btn-sm"
                                                            onClick={() => startEdit(s)}
                                                            style={{ fontSize: '12px', padding: '5px 14px', background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }}
                                                        >
                                                            ✏️ Edit
                                                        </button>
                                                    </td>
                                                </>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>

            {/* ── ADD STAFF MODAL ── */}
            {showAddModal && (
                <div
                    className="modal-overlay"
                    onClick={e => e.target === e.currentTarget && setShowAddModal(false)}
                >
                    <div
                        className="form-card"
                        style={{ width: '420px', background: 'var(--bg-secondary)', border: '1px solid var(--border-active)' }}
                    >
                        <h2 style={{ fontSize: '18px', marginBottom: '20px' }}>➕ Add New Staff</h2>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div>
                                <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                                    FULL NAME
                                </label>
                                <input
                                    className="form-input"
                                    placeholder="e.g. Ravi Kumar"
                                    value={newStaff.name}
                                    onChange={e => setNewStaff({ ...newStaff, name: e.target.value })}
                                />
                            </div>

                            <div>
                                <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                                    EMAIL
                                </label>
                                <input
                                    className="form-input"
                                    type="email"
                                    placeholder="staff@taxportal.com"
                                    value={newStaff.email}
                                    onChange={e => setNewStaff({ ...newStaff, email: e.target.value })}
                                />
                            </div>

                            <div>
                                <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                                    PASSWORD
                                </label>
                                <input
                                    className="form-input"
                                    placeholder="Default: jkfinstride@123"
                                    value={newStaff.password}
                                    onChange={e => setNewStaff({ ...newStaff, password: e.target.value })}
                                />
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                    🔒 Password will be securely hashed before saving
                                </div>
                            </div>

                            <div>
                                <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                                    CATEGORY
                                </label>
                                <select
                                    className="form-input"
                                    value={newStaff.category}
                                    onChange={e => setNewStaff({ ...newStaff, category: e.target.value })}
                                >
                                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                            <button
                                className="btn-primary"
                                style={{ flex: 1 }}
                                onClick={handleAddStaff}
                                disabled={adding}
                            >
                                {adding ? '⏳ Adding...' : '✅ Add Staff'}
                            </button>
                            <button
                                className="btn-sm"
                                style={{ flex: 1 }}
                                onClick={() => {
                                    setShowAddModal(false);
                                    setNewStaff({ name: '', email: '', password: 'jkfinstride@123', category: 'ITR_FILING' });
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <Toast toast={toast} />
        </div>
    );
}