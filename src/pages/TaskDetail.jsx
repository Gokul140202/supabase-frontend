import { useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import useToast from '../hooks/useToast';
import Toast from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import { apiFetch } from '../api';

export default function TaskDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { role } = useAuth();
    const { toast, showToast } = useToast();
    const [task, setTask] = useState(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        const fetchTaskDetails = async () => {
            setLoading(true);
            try {
                const endpoint = role === 'admin' ? `/admin/tasks/${id}` : `/staff/tasks/${id}`;
                const data = await apiFetch(endpoint);
                if (data.success && data.data) {
                    setTask(data.data);
                }
            } catch (err) {
                console.error('Failed to fetch task detail:', err);
                showToast('❌', 'Failed to load task details');
            } finally {
                setLoading(false);
            }
        };
        fetchTaskDetails();
    }, [id, role]);

    if (loading) {
        return (
            <div className="app-layout">
                <Sidebar />
                <div className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
                    <div style={{ fontSize: '18px', color: 'var(--text-secondary)' }}>⏳ Loading Task Details...</div>
                </div>
            </div>
        );
    }

    if (!task) {
        return (
            <div className="app-layout">
                <Sidebar />
                <div className="main-content">
                    <div style={{ padding: '40px', textAlign: 'center' }}>
                        <h2>Task not found</h2>
                        <button className="btn-primary" style={{ margin: '20px auto' }} onClick={() => navigate('/tasks')}>Back to Tasks</button>
                    </div>
                </div>
            </div>
        );
    }

    const formatStatus = (s) => {
        if (!s) return 'Pending';
        const lower = s.toLowerCase();
        if (lower === 'completed') return 'Completed';
        if (lower === 'in_progress' || lower === 'in-progress' || lower === 'in_progress') return 'In-Progress';
        if (lower === 'assigned' || lower === 'pending') return 'Pending';
        return 'Pending';
    };

    const taskName = task.task_type || 'Unknown Task';
    const statusName = formatStatus(task.status);
    const documents = task.documents || [];

    const statusColor = statusName === 'Completed' ? '#10b981' : statusName === 'In-Progress' ? '#6366f1' : '#f59e0b';
    const statusBg = statusName === 'Completed' ? 'rgba(16,185,129,0.15)' : statusName === 'In-Progress' ? 'rgba(99,102,241,0.15)' : 'rgba(245,158,11,0.15)';

    // Date formatting helper
    const formatDate = (dateString) => {
        if (!dateString) return '—';
        try {
            return new Date(dateString).toLocaleString();
        } catch { return dateString; }
    };

    return (
        <div className="app-layout">
            <Sidebar />
            <div className="main-content">
                {/* ── TOPBAR ── */}
                <div className="topbar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                        <button className="btn-sm" onClick={() => navigate('/tasks')}>← Back</button>
                        <h1 className="topbar-title">📋 {taskName}</h1>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ background: statusBg, color: statusColor, padding: '6px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, border: `1px solid ${statusColor}30` }}>
                            {statusName}
                        </span>
                    </div>
                </div>

                <div className="page-content" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>
                    {/* ═══ LEFT SIDE: Task Details + Docs ═══ */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                        {/* ── Task Info Summary ── */}
                        <div className="form-card" style={{ background: 'var(--bg-secondary)', borderTop: '4px solid var(--accent)' }}>
                            <h2 style={{ fontSize: '16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                📌 Task Details
                            </h2>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <div>
                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '4px' }}>Task Name</div>
                                    <div style={{ fontSize: '15px', fontWeight: 700 }}>{taskName}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '4px' }}>Task ID</div>
                                    <div style={{ fontSize: '13px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{task.id || '—'}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '4px' }}>Status</div>
                                    <span style={{ background: statusBg, color: statusColor, padding: '3px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}>{statusName}</span>
                                </div>
                                <div>
                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '4px' }}>Notes</div>
                                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{task.notes || 'No additional notes'}</div>
                                </div>
                            </div>
                        </div>

                        {/* ── Client Details ── */}
                        <div className="form-card" style={{ background: 'var(--bg-secondary)', borderLeft: '4px solid #10b981' }}>
                            <h2 style={{ fontSize: '16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                👤 Client Information
                            </h2>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>Name</span>
                                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{task.client_name || 'N/A'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>Phone</span>
                                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#e879f9' }}>{task.client_phone || 'N/A'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>Email</span>
                                    <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{task.client_email || 'No Email Provided'}</span>
                                </div>
                            </div>
                        </div>

                        {/* ── Documents Section ── */}
                        <div className="form-card" style={{ background: 'var(--bg-secondary)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h2 style={{ fontSize: '16px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>📁 Attached Documents</h2>
                            </div>

                            {documents.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px 20px', border: '1px dashed var(--border)', borderRadius: '12px', color: 'var(--text-muted)' }}>
                                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>📂</div>
                                    <div style={{ fontSize: '14px', fontWeight: 600 }}>No files attached.</div>
                                    <div style={{ fontSize: '12px', marginTop: '4px' }}>Client hasn't provided any documents for this task.</div>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                                    {documents.map((d, i) => (
                                        <div key={i} style={{
                                            background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '16px',
                                            border: '1px solid var(--border)', textAlign: 'center', transition: 'all 0.3s',
                                        }}
                                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-active)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                        >
                                            <div style={{ fontSize: '32px', marginBottom: '12px' }}>📄</div>
                                            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={d.file_name}>{d.file_name}</div>
                                            <button className="btn-sm green" style={{ width: '100%', marginTop: '8px' }} onClick={() => window.open(d.file_url, '_blank')}>
                                                Download / View
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                    </div>

                    {/* ═══ RIGHT SIDE: Timeline & Staff Info ═══ */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                        {/* ── Timeline ── */}
                        <div className="form-card" style={{ background: 'var(--bg-secondary)' }}>
                            <h3 style={{ fontSize: '14px', marginBottom: '20px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>⏰ Timeline</h3>
                            <div style={{ position: 'relative', paddingLeft: '28px' }}>
                                <div style={{ position: 'absolute', left: '7px', top: '8px', bottom: '8px', width: '2px', background: 'linear-gradient(to bottom, #f59e0b, #6366f1, #10b981)', borderRadius: '2px', opacity: 0.3 }} />

                                {[
                                    { label: 'CREATED', time: formatDate(task.created_at), color: '#f59e0b', active: true },
                                    { label: 'ASSIGNED', time: formatDate(task.assigned_at), color: '#3b82f6', active: !!task.assigned_at },
                                    { label: 'STARTED', time: formatDate(task.started_at), color: '#6366f1', active: !!task.started_at },
                                    { label: 'COMPLETED', time: formatDate(task.completed_at), color: '#10b981', active: statusName === 'Completed' },
                                ].map((step, i) => (
                                    <div key={i} style={{ marginBottom: i < 3 ? '22px' : 0, opacity: step.active ? 1 : 0.35 }}>
                                        <div style={{
                                            position: 'absolute', left: '0', width: '16px', height: '16px', borderRadius: '50%',
                                            background: step.active ? step.color : 'var(--bg-card)',
                                            border: `2px solid ${step.active ? step.color : 'var(--border)'}`,
                                            marginTop: `${i * 44}px`,
                                            boxShadow: step.active ? `0 0 10px ${step.color}40` : 'none',
                                        }} />
                                        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.6px', color: step.active ? step.color : 'var(--text-muted)' }}>
                                            {step.label}
                                        </div>
                                        <div style={{ fontSize: '13px', fontWeight: 600, color: step.active ? 'var(--text-primary)' : 'var(--text-muted)', marginTop: '2px' }}>
                                            {step.time && step.time !== '—' ? step.time : '—'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                </div>
            </div>
            <Toast toast={toast} />
        </div>
    );
}
