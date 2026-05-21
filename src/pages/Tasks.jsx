import { useState, useEffect, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import Toast from '../components/Toast';
import useToast from '../hooks/useToast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch, mapBackendTaskToFrontend, supabase } from '../api';

export default function Tasks() {
    const { toast, showToast } = useToast();
    const navigate = useNavigate();
    const { role } = useAuth();
    const [allTasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [apiError, setApiError] = useState(null);
    const [filterStatus, setFilterStatus] = useState('All');
    const [search, setSearch] = useState('');
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [backendStaff, setBackendStaff] = useState([]);
    const [newTask, setNewTask] = useState({ task: '', client: '', mobile: '', staffId: '' });

    // Task type → specific staff IDs (UUID, constant)
    const TASK_TYPES = [
        { label: 'GST Filling',                            value: 'GST_FILLING' },
        { label: 'GST Registration',                       value: 'GST_REGISTRATION' },
        { label: 'Salary Income',                          value: 'SALARY_INCOME' },
        { label: 'Salary & Trading Income',                value: 'SALARY_TRADING' },
        { label: 'Salary, Trading & RSU',                  value: 'SALARY_TRADING_RSU' },
        { label: 'Salary & Business Income',               value: 'SALARY_BUSINESS_INCOME' },
        { label: 'Salary + Trading + Business Income',     value: 'SALARY_TRADING_BUSINESS_INCOME' },
        { label: 'Business Income',                        value: 'BUSINESS_INCOME' },
        { label: 'Business Income + P&L + BS',             value: 'BUSINESS_INCOME_PL_BS' },
        { label: 'Business Income + P&L + BS + Audit Sign', value: 'BUSINESS_INCOME_PL_BS_AUDIT' },
        { label: 'Income Tax',                             value: 'INCOME_TAX' },
        { label: 'Other Income',                           value: 'OTHER_INCOME' },
        { label: 'Private Ltd Registration',               value: 'PRIVATE_LTD_REGISTRATION' },
    ];
    const LAKSHMIPRIYA_ID = '29b24107-b76c-4529-8140-e90f2035c448'; // STF-001
    const TASK_STAFF_MAP = {
        'SALARY_TRADING_BUSINESS_INCOME': [LAKSHMIPRIYA_ID],                                                    // STF-001 only
        'SALARY_TRADING':                 ['adf414d3-9c7d-4190-bdb0-748ec330dcf6', 'f581c3eb-4b64-4280-99bb-7227f622e184'], // STF-003, STF-004
        'SALARY_TRADING_RSU':             ['58706a6b-a72d-4da8-979b-9fb7c7b26c1b'],                             // STF-005
    };
    // Round robin task types — auto-assign to next active staff in rotation
    const ROUND_ROBIN_TYPES = new Set(['BUSINESS_INCOME', 'BUSINESS_INCOME_PL_BS', 'BUSINESS_INCOME_PL_BS_AUDIT']);
    const KARTHIKEYAN_ID = '58706a6b-a72d-4da8-979b-9fb7c7b26c1b'; // STF-005

    const getRoundRobinStaff = () => {
        const active = backendStaff.filter(s => s.status === 'active');
        if (active.length === 0) return null;
        const idx = parseInt(localStorage.getItem('rr_task_idx') || '0', 10);
        return active[idx % active.length];
    };
    const advanceRoundRobin = () => {
        const active = backendStaff.filter(s => s.status === 'active');
        if (active.length === 0) return;
        const idx = parseInt(localStorage.getItem('rr_task_idx') || '0', 10);
        localStorage.setItem('rr_task_idx', String((idx + 1) % active.length));
    };

    const getEligibleStaff = (taskType) => {
        const active = backendStaff.filter(s => s.status === 'active');
        if (!taskType) return active;
        const ids = TASK_STAFF_MAP[taskType];
        if (ids) return active.filter(s => ids.includes(s.id));
        return active.filter(s => s.id !== KARTHIKEYAN_ID);
    };
    const [reassigning, setReassigning] = useState(null);
    const [statusChanging, setStatusChanging] = useState(null);
    const [liveIndicator, setLiveIndicator] = useState(false); // realtime pulse
    const channelRef = useRef(null);

    const fetchTasks = async () => {
        setLoading(true);
        setApiError(null);
        try {
            const endpoint = role === 'admin' ? '/admin/tasks' : '/staff/tasks';
            const data = await apiFetch(endpoint);
            if (data.success && data.data && data.data.length > 0) {
                setTasks(data.data.map(mapBackendTaskToFrontend));
            } else {
                setTasks([]);
                if (!data.success) setApiError('No tasks returned from backend');
            }
        } catch (err) {
            setApiError('Backend Error: ' + err.message);
            showToast('❌', 'Failed to load tasks: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (role) fetchTasks();
    }, [role]);

    useEffect(() => {
        if (role === 'admin') {
            apiFetch('/admin/staff').then(res => {
                if (res.success && res.data) setBackendStaff(res.data);
            }).catch(() => {});
        }
    }, [role]);

    // ── Supabase Realtime: live status sync ────────────────────────────────
    useEffect(() => {
        if (!role) return;

        // Cleanup previous channel
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
        }

        const channel = supabase
            .channel('tasks-realtime-' + role)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'tasks' },
                (payload) => {
                    const updated = payload.new;
                    if (!updated?.id) return;

                    // Live pulse indicator
                    setLiveIndicator(true);
                    setTimeout(() => setLiveIndicator(false), 2000);

                    // Update the matching task's status in local state
                    setTasks(prev => prev.map(t => {
                        if (t.id !== updated.id) return t;

                        const formatStatus = (s) => {
                            if (!s) return 'Pending';
                            const l = s.toLowerCase();
                            if (l === 'completed') return 'Completed';
                            if (l === 'in_progress' || l === 'in-progress') return 'In-Progress';
                            return 'Pending';
                        };

                        const formatDate = (d) => {
                            if (!d) return '-';
                            try { return new Date(d).toLocaleString(); } catch { return d; }
                        };

                        return {
                            ...t,
                            status:      formatStatus(updated.status),
                            openedAt:    formatDate(updated.started_at),
                            completedAt: formatDate(updated.completed_at),
                            raw: { ...t.raw, ...updated },
                        };
                    }));
                }
            )
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'tasks' },
                () => {
                    // New task added → full refresh
                    fetchTasks();
                }
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'tasks' },
                (payload) => {
                    if (payload.old?.id) {
                        setTasks(prev => prev.filter(t => t.id !== payload.old.id));
                    }
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('✅ Realtime subscribed — tasks table');
                }
            });

        channelRef.current = channel;

        return () => {
            supabase.removeChannel(channel);
        };
    }, [role]);

    const handleRefresh = async () => {
        await fetchTasks();
        showToast('✅', 'Tasks refreshed!');
    };

    const handleAddTask = async () => {
        if (!newTask.task || !newTask.client || !newTask.staffId) return showToast('⚠️', 'Fill task, client and staff');
        try {
            const data = await apiFetch('/admin/create-task', {
                method: 'POST',
                body: JSON.stringify({ clientName: newTask.client, taskType: newTask.task, staffId: newTask.staffId, mobile: newTask.mobile || null })
            });
            if (data.success) {
                if (ROUND_ROBIN_TYPES.has(newTask.task)) advanceRoundRobin();
                showToast('🚀', 'Task assigned successfully!');
                fetchTasks();
                setShowAssignModal(false);
                setNewTask({ task: '', client: '', mobile: '', staffId: '' });
            }
        } catch (err) {
            showToast('❌', 'Failed: ' + err.message);
        }
    };

    const handleDeleteTask = async (id) => {
        if (confirm('Delete this task?')) {
            try {
                const data = await apiFetch(`/admin/tasks/${id}`, { method: 'DELETE' });
                if (data.success) {
                    showToast('🗑️', 'Task removed successfully');
                    setTasks(prev => prev.filter(t => t.id !== id));
                }
            } catch (err) {
                if (err.message.includes('not found') || id.toString().startsWith('T-')) {
                    setTasks(prev => prev.filter(t => t.id !== id));
                    showToast('🗑️', 'Task removed from view');
                } else {
                    showToast('❌', 'Failed to delete task: ' + err.message);
                }
            }
        }
    };

    const handleReassignStaff = async (taskId, newStaffId) => {
        if (!newStaffId) return;
        setReassigning(taskId);
        try {
            const { error } = await supabase
                .from('tasks')
                .update({ assigned_staff: newStaffId, assigned_at: new Date().toISOString() })
                .eq('id', taskId);
            if (error) throw new Error(error.message);
            showToast('✅', 'Staff reassigned!');
            await fetchTasks();
        } catch (err) {
            showToast('❌', 'Failed: ' + err.message);
        } finally {
            setReassigning(null);
        }
    };

    const handleStatusChange = async (taskId, newStatus) => {
        if (!newStatus) return;
        setStatusChanging(taskId);
        try {
            const updates = { status: newStatus };
            if (newStatus === 'in_progress') updates.started_at = new Date().toISOString();
            if (newStatus === 'completed') updates.completed_at = new Date().toISOString();
            if (newStatus === 'assigned') { updates.started_at = null; updates.completed_at = null; updates.inprogress_webhook_sent = false; }

            const { error } = await supabase
                .from('tasks')
                .update(updates)
                .eq('id', taskId);
            if (error) throw new Error(error.message);
            showToast('✅', 'Status updated!');
            await fetchTasks();
        } catch (err) {
            showToast('❌', 'Failed: ' + err.message);
        } finally {
            setStatusChanging(null);
        }
    };

    const filteredTasks = allTasks.filter(t => {
        const statusMatch = filterStatus === 'All' || t.status === filterStatus;
        const q = search.toLowerCase();
        const searchMatch = !q || t.client?.toLowerCase().includes(q) || t.task?.toLowerCase().includes(q) || t.users?.toLowerCase().includes(q);
        return statusMatch && searchMatch;
    });

    const getDuration = (start, end) => {
        if (!start || start === '-' || !end || end === '-') return '—';
        try {
            const diff = Math.abs(new Date(end) - new Date(start));
            const hours = Math.floor(diff / 3600000);
            const minutes = Math.floor((diff % 3600000) / 60000);
            if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h ${minutes}m`;
            return `${hours}h ${minutes}m`;
        } catch { return '—'; }
    };

    const getStatusDbValue = (displayStatus) => {
        if (displayStatus === 'Completed') return 'completed';
        if (displayStatus === 'In-Progress') return 'in_progress';
        return 'assigned';
    };

    const getTaskStaffId = (task) => {
        return task.raw?.staff?.id || task.raw?.assigned_staff || null;
    };

    return (
        <div className="app-layout">
            <Sidebar />
            <div className="main-content">
                <div className="topbar">
                    <h1 className="topbar-title">{role === 'admin' ? '📝 Assignment Center' : '📋 My Tasks'}</h1>
                    <div className="topbar-actions">
                        {/* ── Live indicator ── */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{
                                width: '8px', height: '8px', borderRadius: '50%',
                                background: liveIndicator ? '#f59e0b' : '#10b981',
                                boxShadow: liveIndicator
                                    ? '0 0 8px #f59e0b'
                                    : '0 0 8px #10b981',
                                transition: 'all 0.3s',
                            }} />
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                                {liveIndicator ? 'Updating...' : 'Live'}
                            </span>
                        </div>

                        {role === 'admin' && (
                            <button className="btn-primary" onClick={() => setShowAssignModal(true)}>+ New Assignment</button>
                        )}
                        <button className="btn-sm" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }} onClick={handleRefresh} title="Refresh tasks">🔄</button>
                        <select className="btn-sm" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                            <option value="All">All Status</option>
                            <option>Pending</option>
                            <option>In-Progress</option>
                            <option>Completed</option>
                        </select>
                        <input
                            type="text"
                            placeholder="🔍 Search client, task, staff..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: '#fff', padding: '7px 12px', borderRadius: '8px', fontSize: '13px', outline: 'none', width: '220px' }}
                        />
                    </div>
                </div>

                <div className="page-content">
                    <div className="table-card">
                        {apiError && (
                            <div style={{ textAlign: 'center', padding: '20px', color: '#ef4444', background: 'rgba(239,68,68,0.1)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)', marginBottom: '20px' }}>
                                <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>🔴 {apiError}</div>
                                <button className="btn-sm" style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }} onClick={fetchTasks}>🔄 Retry</button>
                            </div>
                        )}
                        {loading && <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>⏳ Loading tasks...</div>}
                        {!loading && !apiError && allTasks.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                <div style={{ fontSize: '14px', marginBottom: '10px' }}>📭 No tasks available</div>
                            </div>
                        )}
                        {!loading && !apiError && allTasks.length > 0 && (
                            <table>
                                <thead>
                                    <tr>
                                        <th>ASSIGNED</th>
                                        <th>TASK & CLIENT</th>
                                        <th>STAFF</th>
                                        <th>START TIME</th>
                                        <th>COMPLETED</th>
                                        <th>DURATION</th>
                                        <th>STATUS</th>
                                        <th>ACTION</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredTasks.length === 0 ? (
                                        <tr><td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No tasks with status: {filterStatus}</td></tr>
                                    ) : filteredTasks.map(t => (
                                        <tr key={t.id}>
                                            <td style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{t.assignedAt}</td>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{t.task}</div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.client}</div>
                                            </td>
                                            <td>
                                                {role === 'admin' ? (
                                                    <select
                                                        value={getTaskStaffId(t) || ''}
                                                        onChange={(e) => handleReassignStaff(t.id, e.target.value)}
                                                        disabled={reassigning === t.id}
                                                        style={{
                                                            background: 'rgba(99,102,241,0.1)',
                                                            border: '1px solid rgba(99,102,241,0.3)',
                                                            color: '#a5b4fc',
                                                            padding: '4px 8px',
                                                            borderRadius: '6px',
                                                            fontSize: '11px',
                                                            fontWeight: 600,
                                                            cursor: reassigning === t.id ? 'not-allowed' : 'pointer',
                                                            opacity: reassigning === t.id ? 0.5 : 1,
                                                            maxWidth: '140px',
                                                        }}
                                                    >
                                                        <option value="">-- Select --</option>
                                                        {backendStaff.map(s => (
                                                            <option key={s.id} value={s.id}>{s.name}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>{t.users}</span>
                                                )}
                                            </td>
                                            <td style={{ fontSize: '12px', color: 'var(--accent)' }}>{t.openedAt !== '-' ? t.openedAt : '—'}</td>
                                            <td style={{ fontSize: '12px', color: '#34d399' }}>{t.completedAt !== '-' ? t.completedAt : '—'}</td>
                                            <td style={{ fontSize: '12px', color: '#e879f9', fontWeight: 600 }}>{getDuration(t.openedAt, t.completedAt)}</td>
                                            <td>
                                                {role === 'admin' ? (
                                                    <select
                                                        value={getStatusDbValue(t.status)}
                                                        onChange={(e) => handleStatusChange(t.id, e.target.value)}
                                                        disabled={statusChanging === t.id}
                                                        style={{
                                                            background: t.status === 'Completed' ? 'rgba(16,185,129,0.15)' :
                                                                       t.status === 'In-Progress' ? 'rgba(99,102,241,0.15)' :
                                                                       'rgba(245,158,11,0.15)',
                                                            color: t.status === 'Completed' ? '#34d399' :
                                                                   t.status === 'In-Progress' ? '#a5b4fc' :
                                                                   '#fbbf24',
                                                            border: '1px solid ' + (t.status === 'Completed' ? 'rgba(16,185,129,0.3)' :
                                                                   t.status === 'In-Progress' ? 'rgba(99,102,241,0.3)' :
                                                                   'rgba(245,158,11,0.3)'),
                                                            padding: '4px 8px',
                                                            borderRadius: '6px',
                                                            fontSize: '11px',
                                                            fontWeight: 700,
                                                            cursor: statusChanging === t.id ? 'not-allowed' : 'pointer',
                                                            opacity: statusChanging === t.id ? 0.5 : 1,
                                                        }}
                                                    >
                                                        <option value="assigned">⏳ Pending</option>
                                                        <option value="in_progress">🔄 In-Progress</option>
                                                        <option value="completed">✅ Completed</option>
                                                    </select>
                                                ) : (
                                                    <span className={`badge ${t.status === 'Completed' ? 'pan' : t.status === 'In-Progress' ? 'entity' : 'orange'}`}>
                                                        {t.status}
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button className="btn-sm green" onClick={() => navigate(`/tasks/${t.id}`)}>
                                                        {role === 'admin' ? '👁️ View' : '👁️ View & Start'}
                                                    </button>
                                                    {role === 'admin' && (
                                                        <button className="btn-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }} onClick={() => handleDeleteTask(t.id)}>🗑️</button>
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

            {showAssignModal && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAssignModal(false)}>
                    <div className="form-card" style={{ width: '400px', background: 'var(--bg-secondary)', border: '1px solid var(--border-active)' }}>
                        <h2 style={{ fontSize: '18px', marginBottom: '20px' }}>Assign New Task</h2>
                        <div className="form-group">
                            <label className="form-label">Task Type</label>
                            <select className="form-input" value={newTask.task} onChange={e => {
                                const taskType = e.target.value;
                                let staffId = '';
                                if (taskType === 'SALARY_TRADING_BUSINESS_INCOME') {
                                    staffId = LAKSHMIPRIYA_ID;
                                } else if (ROUND_ROBIN_TYPES.has(taskType)) {
                                    staffId = getRoundRobinStaff()?.id || '';
                                }
                                setNewTask({ ...newTask, task: taskType, staffId });
                            }}>
                                <option value="">-- Select Task Type --</option>
                                {TASK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Client Name</label>
                            <input className="form-input" placeholder="Customer Name" value={newTask.client} onChange={e => setNewTask({ ...newTask, client: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Mobile Number</label>
                            <input className="form-input" placeholder="10-digit mobile number" value={newTask.mobile} onChange={e => setNewTask({ ...newTask, mobile: e.target.value })} maxLength={10} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">
                                Assign To Staff
                                {ROUND_ROBIN_TYPES.has(newTask.task) && (
                                    <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--accent)', fontWeight: 500 }}>(Auto Round Robin)</span>
                                )}
                                {newTask.task === 'SALARY_TRADING_BUSINESS_INCOME' && (
                                    <span style={{ marginLeft: '8px', fontSize: '11px', color: '#f59e0b', fontWeight: 500 }}>(Lakshmipriya Only)</span>
                                )}
                            </label>
                            <select
                                className="form-input"
                                value={newTask.staffId}
                                onChange={e => setNewTask({ ...newTask, staffId: e.target.value })}
                                disabled={newTask.task === 'SALARY_TRADING_BUSINESS_INCOME'}
                            >
                                <option value="">-- Select Staff --</option>
                                {getEligibleStaff(newTask.task).map(s => (
                                    <option key={s.id} value={s.id}>[{s.staff_code || 'S???'}] {s.name}</option>
                                ))}
                            </select>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                            <button className="btn-primary" style={{ flex: 1 }} onClick={handleAddTask}>Assign Now</button>
                            <button className="btn-sm" style={{ flex: 1 }} onClick={() => setShowAssignModal(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            <Toast toast={toast} />
        </div>
    );
}