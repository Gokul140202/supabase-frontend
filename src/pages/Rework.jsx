import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Toast from '../components/Toast';
import useToast from '../hooks/useToast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch, mapBackendTaskToFrontend } from '../api';
import { socket } from '../utils/socket';

export default function Rework() {
    const { toast, showToast } = useToast();
    const navigate = useNavigate();
    const { role, user } = useAuth();
    const [allReworks, setReworks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [apiError, setApiError] = useState(null);

    const fetchReworks = async () => {
        setLoading(true);
        setApiError(null);
        try {
            const endpoint = role === 'admin' ? '/admin/reworks' : '/staff/reworks';
            const data = await apiFetch(endpoint);
            if (data.success && data.data && data.data.length > 0) {
                const mapped = data.data.map(mapBackendTaskToFrontend);
                setReworks(mapped);
            } else {
                setReworks([]);
                if (!data.success) setApiError('Failed to load reworks');
            }
        } catch (err) {
            setApiError('Backend Error: ' + err.message);
            showToast('❌', 'Failed to load reworks: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (role) fetchReworks();
    }, [role]);

    const handleRefresh = async () => {
        await fetchReworks();
        showToast('✅', 'Reworks refreshed!');
    };

    // Real-time updates
    useEffect(() => {
        const handleNewRework = (payload) => {
            const mapped = mapBackendTaskToFrontend(payload);
            setReworks(prev => {
                if (prev.some(r => r.id === mapped.id)) return prev;
                return [mapped, ...prev];
            });
            showToast('🔄', `New rework: ${mapped.task}`);
        };

        const handleDeletedRework = (payload) => {
            if (payload && payload.id) {
                setReworks(prev => prev.filter(r => r.id !== payload.id));
            }
        };

        const handleReworkStatusUpdated = (payload) => {
            setReworks(prev =>
                prev.map(r => {
                    if (r.id === payload.reworkId) {
                        return { ...r, status: payload.newStatus || payload.status };
                    }
                    return r;
                })
            );
        };

        socket.on('new_rework', handleNewRework);
        socket.on('rework_deleted', handleDeletedRework);
        socket.on('rework_status_updated', handleReworkStatusUpdated);

        return () => {
            socket.off('new_rework', handleNewRework);
            socket.off('rework_deleted', handleDeletedRework);
            socket.off('rework_status_updated', handleReworkStatusUpdated);
        };
    }, [showToast]);

    const [filterStatus, setFilterStatus] = useState('All');
    const [showAssignModal, setShowAssignModal] = useState(false);

    const [backendStaff, setBackendStaff] = useState([]);
    useEffect(() => {
        if (role === 'admin') {
            apiFetch('/admin/staff').then(res => {
                if (res.success && res.data) setBackendStaff(res.data);
            }).catch(() => {});
        }
    }, [role]);

    const [newRework, setNewRework] = useState({ task: '', client: '', staffId: '', reason: '' });

    const handleAddRework = async () => {
        if (!newRework.task || !newRework.client || !newRework.staffId) return showToast('⚠️', 'Fill task, client and staff');

        try {
            const data = await apiFetch('/admin/create-rework', {
                method: 'POST',
                body: JSON.stringify({
                    clientName: newRework.client,
                    taskType: newRework.task,
                    staffId: newRework.staffId,
                    reworkReason: newRework.reason || null
                })
            });

            if (data.success) {
                showToast('🔄', 'Rework assigned successfully!');
                fetchReworks();
                setShowAssignModal(false);
                setNewRework({ task: '', client: '', staffId: '', reason: '' });
            }
        } catch (err) {
            showToast('❌', 'Failed to create rework: ' + err.message);
        }
    };

    const handleDeleteRework = async (id) => {
        if (confirm('Delete this rework?')) {
            try {
                const data = await apiFetch(`/admin/reworks/${id}`, { method: 'DELETE' });
                if (data.success) {
                    showToast('🗑️', 'Rework removed');
                    setReworks(prev => prev.filter(r => r.id !== id));
                }
            } catch (err) {
                if (err.message.includes('not found')) {
                    setReworks(prev => prev.filter(r => r.id !== id));
                    showToast('🗑️', 'Rework removed from view');
                } else {
                    showToast('❌', 'Failed to delete: ' + err.message);
                }
            }
        }
    };

    const filteredReworks = allReworks.filter(r => {
        return filterStatus === 'All' || r.status === filterStatus;
    });

    const getDuration = (start, end) => {
        if (!start || start === '-' || !end || end === '-') return '—';
        try {
            const s = new Date(start);
            const e = new Date(end);
            const diff = Math.abs(e - s);
            const hours = Math.floor(diff / 3600000);
            const minutes = Math.floor((diff % 3600000) / 60000);
            if (hours >= 24) {
                const days = Math.floor(hours / 24);
                return `${days}d ${hours % 24}h ${minutes}m`;
            }
            return `${hours}h ${minutes}m`;
        } catch { return '—'; }
    };

    return (
        <div className="app-layout">
            <Sidebar />
            <div className="main-content">
                <div className="topbar">
                    <h1 className="topbar-title">{role === 'admin' ? '🔄 Rework Center' : '🔄 My Reworks'}</h1>
                    <div className="topbar-actions">
                        {role === 'admin' && (
                            <button className="btn-primary" onClick={() => setShowAssignModal(true)}>+ New Rework</button>
                        )}
                        <button className="btn-sm" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }} onClick={handleRefresh} title="Refresh">🔄</button>
                        <select className="btn-sm" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                            <option value="All">All Status</option>
                            <option>Pending</option>
                            <option>In-Progress</option>
                            <option>Completed</option>
                        </select>
                    </div>
                </div>

                <div className="page-content">
                    <div className="table-card">
                        {apiError && (
                            <div style={{ textAlign: 'center', padding: '20px', color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)', marginBottom: '20px' }}>
                                <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>🔴 {apiError}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>Please check the server or try again.</div>
                                <button className="btn-sm" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }} onClick={fetchReworks}>🔄 Retry</button>
                            </div>
                        )}
                        {loading && <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>⏳ Loading reworks...</div>}
                        {!loading && !apiError && allReworks.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                <div style={{ fontSize: '14px', marginBottom: '10px' }}>📭 No reworks available</div>
                                <div style={{ fontSize: '12px' }}>No reworks have been assigned yet.</div>
                            </div>
                        )}
                        {!loading && !apiError && allReworks.length > 0 && (
                        <table>
                            <thead>
                                <tr>
                                    <th>ASSIGNED</th>
                                    <th>TASK & CLIENT</th>
                                    <th>STAFF</th>
                                    <th>OPENED</th>
                                    <th>COMPLETED</th>
                                    <th>DURATION</th>
                                    <th>STATUS</th>
                                    <th>ACTION</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredReworks.length === 0 ? (
                                    <tr><td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No reworks with status: {filterStatus}</td></tr>
                                ) : filteredReworks.map((r) => (
                                    <tr key={r.id}>
                                        <td style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{r.assignedAt}</td>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{r.task}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{r.client}</div>
                                        </td>
                                        <td><span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>{r.users}</span></td>
                                        <td style={{ fontSize: '12px', color: 'var(--accent)' }}>{r.openedAt !== '-' ? r.openedAt : '—'}</td>
                                        <td style={{ fontSize: '12px', color: '#34d399' }}>{r.completedAt !== '-' ? r.completedAt : '—'}</td>
                                        <td style={{ fontSize: '12px', color: '#e879f9', fontWeight: 600 }}>{getDuration(r.openedAt, r.completedAt)}</td>
                                        <td>
                                            <span className={`badge ${r.status === 'Completed' ? 'pan' : r.status === 'In-Progress' ? 'entity' : 'orange'}`}>
                                                {r.status}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button className="btn-sm green" onClick={async () => {
                                                    if (role !== 'admin') {
                                                        try {
                                                            await apiFetch('/reworks/start', {
                                                                method: 'PATCH',
                                                                body: JSON.stringify({ reworkId: r.id })
                                                            });
                                                            showToast('✅', 'Rework started!');
                                                            await fetchReworks();
                                                        } catch (err) {
                                                            console.error('Failed to start rework:', err);
                                                            showToast('❌', 'Failed to start: ' + err.message);
                                                        }
                                                    }
                                                    navigate(`/rework/${r.id}`);
                                                }}>
                                                    {role === 'admin' ? '👁️ View' : '👁️ View & Start'}
                                                </button>
                                                {role === 'admin' && (
                                                    <button className="btn-sm" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }} onClick={() => handleDeleteRework(r.id)}>🗑️</button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        )}
                    </div>
                </div>
            </div>

            {/* ASSIGN REWORK MODAL */}
            {showAssignModal && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAssignModal(false)}>
                    <div className="form-card" style={{ width: '400px', background: 'var(--bg-secondary)', border: '1px solid var(--border-active)' }}>
                        <h2 style={{ fontSize: '18px', marginBottom: '20px' }}>Assign New Rework</h2>
                        <div className="form-group">
                            <label className="form-label">Task Type</label>
                            <input className="form-input" placeholder="e.g. GST Filing" value={newRework.task} onChange={e => setNewRework({ ...newRework, task: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Client Name</label>
                            <input className="form-input" placeholder="Customer Name" value={newRework.client} onChange={e => setNewRework({ ...newRework, client: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Assign To Staff</label>
                            <select className="form-input" value={newRework.staffId} onChange={e => setNewRework({ ...newRework, staffId: e.target.value })}>
                                <option value="">-- Select Staff --</option>
                                {backendStaff.map((s) => (
                                    <option key={s.id} value={s.id}>[{s.staff_code || 'S???'}] {s.name} ({s.category})</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Rework Reason (optional)</label>
                            <input className="form-input" placeholder="Reason for rework" value={newRework.reason} onChange={e => setNewRework({ ...newRework, reason: e.target.value })} />
                        </div>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                            <button className="btn-primary" style={{ flex: 1 }} onClick={handleAddRework}>Assign Now</button>
                            <button className="btn-sm" style={{ flex: 1 }} onClick={() => setShowAssignModal(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            <Toast toast={toast} />
        </div>
    );
}
