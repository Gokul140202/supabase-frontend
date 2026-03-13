import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import useLocalStorage from '../hooks/useLocalStorage';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import { apiFetch, mapBackendTaskToFrontend } from '../api';

export default function Reports() {
    const navigate = useNavigate();
    const { role, user } = useAuth();
    const [allTasks, setAllTasks] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchReports = async () => {
            setLoading(true);
            try {
                const endpoint = role === 'admin' ? '/admin/tasks' : '/staff/tasks';
                const data = await apiFetch(endpoint);
                if (data.success && data.data && data.data.length > 0) {
                    setAllTasks(data.data.map(mapBackendTaskToFrontend));
                }
            } catch (err) {
                console.error('Failed to fetch reports:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchReports();
    }, [role]);
    const [filterStatus, setFilterStatus] = useState('All');

    // Backend handles separation of tasks
    const tasks = allTasks;

    // Filter tasks
    const filtered = filterStatus === 'All' ? tasks : tasks.filter(t => t.status === filterStatus);

    // Stats
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'Completed');
    const inProgressTasks = tasks.filter(t => t.status === 'In-Progress');
    const pendingTasks = tasks.filter(t => t.status === 'Pending');

    // Status badge colors
    const getStatusStyle = (status) => {
        if (status === 'Completed') return { bg: 'rgba(16,185,129,0.15)', color: '#34d399', border: 'rgba(16,185,129,0.3)' };
        if (status === 'In-Progress') return { bg: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: 'rgba(99,102,241,0.3)' };
        return { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: 'rgba(245,158,11,0.3)' };
    };

    // Calculate duration between two dates
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
                    <h1 className="topbar-title">{role === 'admin' ? '📊 Audit Reports — All Staff' : '📊 My Task Reports'}</h1>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <select className="btn-sm" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                            value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                            <option value="All">All Status</option>
                            <option>Pending</option>
                            <option>In-Progress</option>
                            <option>Completed</option>
                        </select>
                    </div>
                </div>

                <div className="page-content">
                    {/* ── Summary Stats ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
                        {[
                            { label: 'Total Tasks', value: totalTasks, icon: '📋', color: '#fff', accent: 'var(--accent)' },
                            { label: 'Pending', value: pendingTasks.length, icon: '⏳', color: '#fbbf24', accent: '#f59e0b' },
                            { label: 'In-Progress', value: inProgressTasks.length, icon: '🔄', color: '#a5b4fc', accent: '#6366f1' },
                            { label: 'Completed', value: completedTasks.length, icon: '✅', color: '#34d399', accent: '#10b981' },
                        ].map((s, i) => (
                            <div key={i} style={{
                                background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px',
                                padding: '20px', textAlign: 'center', borderBottom: `3px solid ${s.accent}`,
                                transition: 'all 0.3s',
                            }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = 'var(--border-active)'; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                            >
                                <div style={{ fontSize: '20px', marginBottom: '6px' }}>{s.icon}</div>
                                <div style={{ fontSize: '28px', fontWeight: 800, color: s.color }}>{s.value}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
                            </div>
                        ))}
                    </div>

                    {/* ── Completed Task Reports (Detailed Cards) ── */}
                    {completedTasks.length > 0 && (filterStatus === 'All' || filterStatus === 'Completed') && (
                        <div style={{ marginBottom: '28px' }}>
                            <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                ✅ Completion Reports
                                <span style={{ background: 'rgba(16,185,129,0.12)', color: '#34d399', padding: '2px 10px', borderRadius: '8px', fontSize: '12px' }}>{completedTasks.length}</span>
                            </h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {completedTasks.map(t => (
                                    <div key={t.id}>
                                        {role === 'admin' ? (
                                            <div style={{
                                                background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '20px',
                                                padding: '24px', borderLeft: '4px solid #10b981', transition: 'all 0.3s', cursor: 'pointer',
                                            }}
                                                onClick={() => navigate(`/tasks/${t.id}`)}
                                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-active)'; e.currentTarget.style.transform = 'translateX(4px)'; }}
                                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateX(0)'; }}
                                            >
                                                {/* Header Row */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                                    <div>
                                                        <div style={{ fontSize: '16px', fontWeight: 700 }}>{t.task}</div>
                                                        <div style={{ fontSize: '12px', color: 'var(--accent)', marginTop: '2px' }}>{t.client} • {t.id}</div>
                                                    </div>
                                                    <span style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', padding: '5px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700 }}>
                                                        ✅ Completed
                                                    </span>
                                                </div>

                                                {/* Timeline Grid */}
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '14px', border: '1px solid var(--border)' }}>
                                                    <div>
                                                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>📅 Assigned</div>
                                                        <div style={{ fontSize: '13px', fontWeight: 600 }}>{t.assignedAt}</div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>👀 Opened</div>
                                                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent)' }}>{t.openedAt !== '-' ? t.openedAt : '—'}</div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>🏁 Completed</div>
                                                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#34d399' }}>{t.completedAt !== '-' ? t.completedAt : '—'}</div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>⏱️ Duration</div>
                                                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#e879f9' }}>{getDuration(t.openedAt, t.completedAt)}</div>
                                                    </div>
                                                </div>

                                                {/* Footer Row */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        <span style={{ fontSize: '12px', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '6px' }}>👤 {t.users}</span>
                                                        <span style={{ fontSize: '12px', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '6px' }}>🏷️ {t.tags || 'N/A'}</span>
                                                        <span style={{ fontSize: '12px', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '6px' }}>📂 {t.docs?.length || 0} docs</span>
                                                    </div>
                                                    {t.resultFile && (
                                                        <button className="btn-sm green" onClick={(e) => { e.stopPropagation(); window.open(t.resultFile.url, '_blank'); }}>
                                                            📄 View Result PDF
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{
                                                background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '20px',
                                                padding: '24px', borderLeft: '4px solid #10b981', transition: 'all 0.3s', cursor: 'default',
                                            }}>
                                                {/* Header Row */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                                    <div>
                                                        <div style={{ fontSize: '16px', fontWeight: 700 }}>{t.task}</div>
                                                        <div style={{ fontSize: '12px', color: 'var(--accent)', marginTop: '2px' }}>{t.client} • {t.id}</div>
                                                    </div>
                                                    <span style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', padding: '5px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700 }}>
                                                        ✅ Completed
                                                    </span>
                                                </div>

                                                {/* Timeline Grid */}
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '14px', border: '1px solid var(--border)' }}>
                                                    <div>
                                                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>📅 Assigned</div>
                                                        <div style={{ fontSize: '13px', fontWeight: 600 }}>{t.assignedAt}</div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>👀 Opened</div>
                                                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent)' }}>{t.openedAt !== '-' ? t.openedAt : '—'}</div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>🏁 Completed</div>
                                                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#34d399' }}>{t.completedAt !== '-' ? t.completedAt : '—'}</div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>⏱️ Duration</div>
                                                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#e879f9' }}>{getDuration(t.openedAt, t.completedAt)}</div>
                                                    </div>
                                                </div>

                                                {/* Footer Row */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        <span style={{ fontSize: '12px', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '6px' }}>👤 {t.users}</span>
                                                        <span style={{ fontSize: '12px', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '6px' }}>🏷️ {t.tags || 'N/A'}</span>
                                                        <span style={{ fontSize: '12px', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '6px' }}>📂 {t.docs?.length || 0} docs</span>
                                                    </div>
                                                    {t.resultFile && (
                                                        <button className="btn-sm green" onClick={(e) => { e.stopPropagation(); window.open(t.resultFile.url, '_blank'); }}>
                                                            📄 View Result PDF
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── All Tasks Audit Table ── */}
                    <div className="table-card">
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 700, fontSize: '14px' }}>📋 {role === 'admin' ? 'Full Audit Log' : 'Task History'}</span>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{filtered.length} tasks</span>
                        </div>
                        <table>
                            <thead>
                                <tr>
                                    <th>TASK & CLIENT</th>
                                    <th>STAFF</th>
                                    <th>ASSIGNED</th>
                                    <th>OPENED</th>
                                    <th>COMPLETED</th>
                                    <th>DURATION</th>
                                    <th>STATUS</th>
                                    <th>RESULT</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr><td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No tasks found.</td></tr>
                                ) : filtered.map(t => {
                                    const st = getStatusStyle(t.status);
                                    return (
                                        <tr key={t.id} onClick={() => role === 'admin' ? navigate(`/tasks/${t.id}`) : null} style={{ cursor: role === 'admin' ? 'pointer' : 'default', transition: 'all 0.2s' }}>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{t.task}</div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.client}</div>
                                            </td>
                                            <td><span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px' }}>{t.users}</span></td>
                                            <td style={{ fontSize: '12px' }}>{t.assignedAt}</td>
                                            <td style={{ fontSize: '12px', color: 'var(--accent)' }}>{t.openedAt !== '-' ? t.openedAt : '—'}</td>
                                            <td style={{ fontSize: '12px', color: '#34d399' }}>{t.completedAt !== '-' ? t.completedAt : '—'}</td>
                                            <td style={{ fontSize: '12px', color: '#e879f9' }}>{getDuration(t.openedAt, t.completedAt)}</td>
                                            <td>
                                                <span style={{ background: st.bg, color: st.color, padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, border: `1px solid ${st.border}` }}>
                                                    {t.status}
                                                </span>
                                            </td>
                                            <td>
                                                {t.resultFile ? (
                                                    <button className="btn-sm green" style={{ fontSize: '11px' }} onClick={(e) => { e.stopPropagation(); window.open(t.resultFile.url, '_blank'); }}>📄 PDF</button>
                                                ) : (
                                                    <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>—</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
