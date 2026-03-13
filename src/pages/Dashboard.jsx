import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, mapBackendTaskToFrontend } from '../api';
import Sidebar from '../components/Sidebar';
import Toast from '../components/Toast';
import useToast from '../hooks/useToast';
import { useAuth } from '../context/AuthContext';
import { socket } from '../utils/socket';

export default function Dashboard() {
    const navigate = useNavigate();
    const { role, user } = useAuth();
    const { toast, showToast } = useToast();
    const [allTasks, setAllTasks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [dashboardStats, setDashboardStats] = useState(null);

    useEffect(() => {
        const fetchDashboardData = async () => {
            setLoading(true);
            try {
                const endpoint = role === 'admin' ? '/admin/tasks' : '/staff/tasks';
                const data = await apiFetch(endpoint);
                if (data.success && data.data && data.data.length > 0) {
                    setAllTasks(data.data.map(mapBackendTaskToFrontend));
                }

                // Fetch admin dashboard stats for real counts
                if (role === 'admin') {
                    const stats = await apiFetch('/admin/dashboard');
                    if (stats.success) {
                        setDashboardStats(stats.data);
                    }
                }
            } catch (err) {
                console.error('Dashboard fetch error:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchDashboardData();
    }, [role]);

    // 🌐 Multi-device real-time sync with Socket.io
    useEffect(() => {
        const handleNewTask = (taskPayload) => {
            console.log('📡 Socket: New task received', taskPayload);
            const mappedTask = mapBackendTaskToFrontend(taskPayload);
            setAllTasks(prev => {
                if (prev.some(t => t.id === mappedTask.id)) return prev;
                return [mappedTask, ...prev];
            });
            showToast('🚀', `New task: ${mappedTask.task}`);
        };

        const handleDeletedTask = (payload) => {
            console.log('📡 Socket: Task deleted event received:', payload);
            if (payload && payload.id) {
                setAllTasks(prev => prev.filter(t => t.id !== payload.id));
            }
        };

        socket.on('new_task', handleNewTask);
        socket.on('task_deleted', handleDeletedTask);

        return () => {
            socket.off('new_task', handleNewTask);
            socket.off('task_deleted', handleDeletedTask);
        };
    }, [showToast]);

    // Backend handles separation of tasks
    const tasks = allTasks;

    const recentTasks = tasks.slice(0, 5);

    // Tasks grouped by status
    const pendingTasks = tasks.filter(t => t.status === 'Pending');
    const progressTasks = tasks.filter(t => t.status === 'In-Progress');
    const completedTasks = tasks.filter(t => t.status === 'Completed');

    // Task card renderer — reused for each section
    const TaskRow = ({ t }) => (
        <div
            onClick={() => navigate(`/tasks/${t.id}`)}
            style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 18px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px',
                border: '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-active)'; e.currentTarget.style.background = 'rgba(99,102,241,0.06)'; e.currentTarget.style.transform = 'translateX(4px)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.transform = 'translateX(0)'; }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{t.task}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>•</div>
                <div style={{ fontSize: '12px', color: 'var(--accent)' }}>{t.client}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>📂 {t.docCount || 0}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.assignedAt}</span>
                <span style={{ fontSize: '18px', color: 'var(--text-muted)' }}>›</span>
            </div>
        </div>
    );

    // Section header with colored accent
    const SectionHeader = ({ icon, label, count, color, bgColor }) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                    width: '32px', height: '32px', borderRadius: '10px', background: bgColor,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px',
                }}>{icon}</div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>{label}</h3>
                <span style={{
                    background: bgColor, color: color, padding: '2px 10px', borderRadius: '8px',
                    fontSize: '12px', fontWeight: 700, border: `1px solid ${color}25`,
                }}>{count}</span>
            </div>
        </div>
    );

    return (
        <div className="app-layout">
            <Sidebar />

            <div className="main-content">
                <div className="topbar">
                    <h1 className="topbar-title">{role === 'admin' ? '🏢 Admin Overview' : '🏠 Staff Dashboard'}</h1>
                    <div className="topbar-actions">
                        <div className="search-wrap">
                            <span className="search-icon">🔍</span>
                            <input className="topbar-search" type="text" placeholder="Search…" />
                        </div>
                    </div>
                </div>

                <div className="page-content">
                    {/* STATS */}
                    <div className="stats-grid">
                        <div className="stat-card" onClick={() => navigate('/tasks')} style={{ cursor: 'pointer' }}>
                            <div style={{ fontSize: '20px' }}>{role === 'admin' ? '👥' : '📝'}</div>
                            <div className="stat-value">{role === 'admin' ? (dashboardStats?.totalClients ?? 0) : tasks.length}</div>
                            <div className="stat-label">{role === 'admin' ? 'Total Clients' : 'Total Tasks'}</div>
                        </div>
                        <div className="stat-card" style={{ cursor: 'pointer', borderLeft: '3px solid #f59e0b' }} onClick={() => navigate('/tasks')}>
                            <div style={{ fontSize: '20px' }}>⏳</div>
                            <div className="stat-value" style={{ color: '#fbbf24' }}>{pendingTasks.length}</div>
                            <div className="stat-label">Pending</div>
                        </div>
                        <div className="stat-card" style={{ cursor: 'pointer', borderLeft: '3px solid #6366f1' }} onClick={() => navigate('/tasks')}>
                            <div style={{ fontSize: '20px' }}>🔄</div>
                            <div className="stat-value" style={{ color: '#a5b4fc' }}>{progressTasks.length}</div>
                            <div className="stat-label">In-Progress</div>
                        </div>
                        <div className="stat-card" style={{ cursor: 'pointer', borderLeft: '3px solid #10b981' }} onClick={() => navigate('/tasks')}>
                            <div style={{ fontSize: '20px' }}>✅</div>
                            <div className="stat-value" style={{ color: '#34d399' }}>{completedTasks.length}</div>
                            <div className="stat-label">Completed</div>
                        </div>
                    </div>

                    {role === 'admin' ? (
                        /* ── ADMIN: Recent Tasks Table (real DB data) ── */
                        <div className="table-card">
                            <div className="table-header">
                                <span style={{ fontWeight: 700, fontSize: '14px' }}>📂 Recent Task Activity</span>
                                <button className="btn-sm" onClick={() => navigate('/tasks')}>View All →</button>
                            </div>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Client Name</th>
                                        <th>Task Type</th>
                                        <th>Assigned To</th>
                                        <th>Documents</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentTasks.length === 0 ? (
                                        <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>No tasks yet</td></tr>
                                    ) : (
                                        recentTasks.map(t => (
                                            <tr key={t.id} onClick={() => navigate(`/tasks/${t.id}`)} style={{ cursor: 'pointer' }}>
                                                <td><strong>{t.client}</strong></td>
                                                <td style={{ color: '#94a3b8' }}>{t.task}</td>
                                                <td style={{ color: '#94a3b8' }}>{t.users}</td>
                                                <td>📂 {t.docCount || 0} Files</td>
                                                <td><span className={`badge ${t.status === 'Completed' ? 'entity' : t.status === 'In-Progress' ? 'individual' : 'trust'}`}>{t.status}</span></td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        /* ── STAFF: Task Groups by Status ── */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

                            {/* ⏳ PENDING TASKS */}
                            <div>
                                <SectionHeader icon="⏳" label="Pending Tasks" count={pendingTasks.length} color="#f59e0b" bgColor="rgba(245,158,11,0.12)" />
                                {pendingTasks.length === 0 ? (
                                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid var(--border)', fontSize: '13px' }}>
                                        🎉 No pending tasks!
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {pendingTasks.map(t => <TaskRow key={t.id} t={t} />)}
                                    </div>
                                )}
                            </div>

                            {/* 🔄 IN-PROGRESS TASKS */}
                            <div>
                                <SectionHeader icon="🔄" label="In-Progress Tasks" count={progressTasks.length} color="#6366f1" bgColor="rgba(99,102,241,0.12)" />
                                {progressTasks.length === 0 ? (
                                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid var(--border)', fontSize: '13px' }}>
                                        No tasks in progress
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {progressTasks.map(t => <TaskRow key={t.id} t={t} />)}
                                    </div>
                                )}
                            </div>

                            {/* ✅ COMPLETED TASKS */}
                            <div>
                                <SectionHeader icon="✅" label="Completed Tasks" count={completedTasks.length} color="#10b981" bgColor="rgba(16,185,129,0.12)" />
                                {completedTasks.length === 0 ? (
                                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid var(--border)', fontSize: '13px' }}>
                                        No completed tasks yet
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {completedTasks.map(t => <TaskRow key={t.id} t={t} />)}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <Toast toast={toast} />
        </div>
    );
}
