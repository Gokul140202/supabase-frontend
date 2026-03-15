import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Toast from '../components/Toast';
import useToast from '../hooks/useToast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch, mapBackendTaskToFrontend } from '../api';
import { socket } from '../utils/socket';

export default function Tasks() {
    const { toast, showToast } = useToast();
    const navigate = useNavigate();
    const { role, user } = useAuth();
    const [allTasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [apiError, setApiError] = useState(null);

    const fetchTasks = async () => {
        setLoading(true);
        setApiError(null);
        console.log('🔄 Fetching tasks... Role:', role);
        try {
            const endpoint = role === 'admin' ? '/admin/tasks' : '/staff/tasks';
            const data = await apiFetch(endpoint);
            console.log('📥 Backend response:', data);
            // If backend has data, use it. Otherwise fallback to local storage dummy data
            if (data.success && data.data && data.data.length > 0) {
                const mappedTasks = data.data.map(mapBackendTaskToFrontend);
                console.log('✅ Mapped tasks:', mappedTasks);
                setTasks(mappedTasks);
            } else {
                console.warn('⚠️ No data from backend:', data);
                setApiError('No tasks returned from backend');
            }
        } catch (err) {
            console.error('❌ Failed to fetch tasks:', err);
            setApiError('Backend Error: ' + err.message);
            showToast('❌', 'Failed to load tasks: ' + err.message);
            // Keep local data on error
        } finally {
            setLoading(false);
        }
    };

    // Fetch tasks when component mounts
    useEffect(() => {
        if (role) {
            fetchTasks();
        }
    }, [role]);

    // Debug: Log when tasks change
    useEffect(() => {
        console.log('📊 Current allTasks state:', allTasks);
    }, [allTasks]);

    // Manual refresh button handler
    const handleRefresh = async () => {
        console.log('🔄 Manual refresh triggered');
        await fetchTasks();
        showToast('✅', 'Tasks refreshed!');
    };

    // 🌐 Real-time update listener
    useEffect(() => {
        const handleNewTask = (taskPayload) => {
            console.log('📡 Socket: New task received', taskPayload);
            const mappedTask = mapBackendTaskToFrontend(taskPayload);
            setTasks(prev => {
                if (prev.some(t => t.id === mappedTask.id)) return prev;
                return [mappedTask, ...prev];
            });
            showToast('🚀', `New task: ${mappedTask.task}`);
        };

        const handleDeletedTask = (payload) => {
            console.log('📡 Socket: Task deleted event received:', payload);
            if (payload && payload.id) {
                setTasks(prev => {
                    const newList = prev.filter(t => t.id !== payload.id);
                    console.log('📋 Updated task list count:', newList.length);
                    return newList;
                });
            }
        };

        const handleTaskStatusUpdated = (payload) => {
            console.log('📡 Socket: Task status updated', payload);
            setTasks(prev => 
                prev.map(t => {
                    if (t.id === payload.taskId) {
                        return { ...t, status: payload.newStatus || payload.status };
                    }
                    return t;
                })
            );
            showToast('🔄', `Task #${payload.taskId} status: ${payload.newStatus || payload.status}`);
        };

        socket.on('new_task', handleNewTask);
        socket.on('task_deleted', handleDeletedTask);
        socket.on('task_status_updated', handleTaskStatusUpdated);

        return () => {
            socket.off('new_task', handleNewTask);
            socket.off('task_deleted', handleDeletedTask);
            socket.off('task_status_updated', handleTaskStatusUpdated);
        };
    }, [showToast]);

    // Ensure data is loaded on first mount
    useEffect(() => {
        console.log('🚀 Tasks page mounted, current role:', role);
        if (role) {
            fetchTasks();
        }
    }, []); // Empty dependency - runs once

    const [filterStatus, setFilterStatus] = useState('All');
    const [showAssignModal, setShowAssignModal] = useState(false);

    // Fetch real staff list from backend (with UUIDs) for the assign modal
    const [backendStaff, setBackendStaff] = useState([]);
    useEffect(() => {
        if (role === 'admin') {
            apiFetch('/admin/staff').then(res => {
                if (res.success && res.data) setBackendStaff(res.data);
            }).catch(() => {});
        }
    }, [role]);

    const [newTask, setNewTask] = useState({ task: '', client: '', staffId: '' });

    const handleAddTask = async () => {
        if (!newTask.task || !newTask.client || !newTask.staffId) return showToast('⚠️', 'Fill task, client and staff');

        try {
            const data = await apiFetch('/admin/create-task', {
                method: 'POST',
                body: JSON.stringify({
                    clientName: newTask.client,
                    taskType: newTask.task,
                    staffId: newTask.staffId
                })
            });

            if (data.success) {
                showToast('🚀', 'Task assigned successfully!');
                fetchTasks();
                setShowAssignModal(false);
                setNewTask({ task: '', client: '', staffId: '' });
            }
        } catch (err) {
            // Fallback to local state if backend call fails
            const taskObj = {
                id: `T-${Date.now().toString().slice(-4)}`,
                task: newTask.task,
                client: newTask.client,
                users: backendStaff.find(s => s.id === newTask.staffId)?.name || newTask.staffId,
                assignedAt: new Date().toLocaleString(),
                openedAt: '-',
                completedAt: '-',
                status: 'Pending',
                docs: [],
                resultFile: null
            };

            setTasks([taskObj, ...allTasks]);
            setShowAssignModal(false);
            setNewTask({ task: '', client: '', staffId: '' });
            showToast('⚠️', 'Task saved locally: ' + err.message);
        }
    };

    const handleDeleteTask = async (id) => {
        if (confirm('Delete this task?')) {
            try {
                const data = await apiFetch(`/admin/tasks/${id}`, {
                    method: 'DELETE'
                });
                if (data.success) {
                    showToast('🗑️', 'Task removed successfully');
                    // local state update for the person who clicked delete
                    setTasks(prev => prev.filter(t => t.id !== id));
                }
            } catch (err) {
                console.error('Failed to delete task:', err);
                
                // If it's a 404 or a local ID (started with T-), just delete from UI
                if (err.message.includes('not found') || id.toString().startsWith('T-')) {
                    setTasks(prev => prev.filter(t => t.id !== id));
                    showToast('🗑️', 'Task removed from view');
                } else {
                    showToast('❌', 'Failed to delete task: ' + err.message);
                }
            }
        }
    };

    // Backend already handles staff-specific data for /staff/tasks and admin data for /admin/tasks
    const tasks = allTasks;

    const filteredTasks = tasks.filter(t => {
        return filterStatus === 'All' || t.status === filterStatus;
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
                    <h1 className="topbar-title">{role === 'admin' ? '📝 Assignment Center' : '📋 My Tasks'}</h1>
                    <div className="topbar-actions">
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
                    </div>
                </div>

                <div className="page-content">
                    <div className="table-card">
                        {apiError && (
                            <div style={{ textAlign: 'center', padding: '20px', color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)', marginBottom: '20px' }}>
                                <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>🔴 {apiError}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>The backend server is having issues. Please check the server logs or try again.</div>
                                <button className="btn-sm" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }} onClick={fetchTasks}>🔄 Retry Connection</button>
                            </div>
                        )}
                        {loading && <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>⏳ Loading tasks...</div>}
                        {!loading && !apiError && allTasks.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                <div style={{ fontSize: '14px', marginBottom: '10px' }}>📭 No tasks available</div>
                                <div style={{ fontSize: '12px' }}>No tasks have been assigned yet.</div>
                            </div>
                        )}
                        {!loading && !apiError && allTasks.length > 0 && (
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
                                {filteredTasks.length === 0 ? (
                                    <tr><td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No tasks with status: {filterStatus}</td></tr>
                                ) : filteredTasks.map((t) => (
                                    <tr key={t.id}>
                                        <td style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{t.assignedAt}</td>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{t.task}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.client}</div>
                                        </td>
                                        <td><span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>{t.users}</span></td>
                                        <td style={{ fontSize: '12px', color: 'var(--accent)' }}>{t.openedAt !== '-' ? t.openedAt : '—'}</td>
                                        <td style={{ fontSize: '12px', color: '#34d399' }}>{t.completedAt !== '-' ? t.completedAt : '—'}</td>
                                        <td style={{ fontSize: '12px', color: '#e879f9', fontWeight: 600 }}>{getDuration(t.openedAt, t.completedAt)}</td>
                                        <td>
                                            <span className={`badge ${t.status === 'Completed' ? 'pan' : t.status === 'In-Progress' ? 'entity' : 'orange'}`}>
                                                {t.status}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button className="btn-sm green" onClick={async () => {
                                                    if (role !== 'admin') {
                                                        try {
                                                            await apiFetch('/staff/tasks/start', {
                                                                method: 'PATCH',
                                                                body: JSON.stringify({ taskId: t.id })
                                                            });
                                                            showToast('✅', 'Task started!');
                                                            await fetchTasks();
                                                        } catch (err) {
                                                            console.error('Failed to start task:', err);
                                                            showToast('❌', 'Failed to start task: ' + err.message);
                                                        }
                                                    }
                                                    navigate(`/tasks/${t.id}`);
                                                }}>
                                                    {role === 'admin' ? '👁️ View' : '👁️ View & Start'}
                                                </button>
                                                {role === 'admin' && (
                                                    <button className="btn-sm" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }} onClick={() => handleDeleteTask(t.id)}>🗑️</button>
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

            {/* ASSIGN MODAL */}
            {showAssignModal && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAssignModal(false)}>
                    <div className="form-card" style={{ width: '400px', background: 'var(--bg-secondary)', border: '1px solid var(--border-active)' }}>
                        <h2 style={{ fontSize: '18px', marginBottom: '20px' }}>Assign New Task</h2>
                        <div className="form-group">
                            <label className="form-label">Task Name</label>
                            <input className="form-input" placeholder="e.g. GST Filing" value={newTask.task} onChange={e => setNewTask({ ...newTask, task: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Client Name</label>
                            <input className="form-input" placeholder="Customer Name" value={newTask.client} onChange={e => setNewTask({ ...newTask, client: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Assign To Staff</label>
                            <select className="form-input" value={newTask.staffId} onChange={e => setNewTask({ ...newTask, staffId: e.target.value })}>
                                <option value="">-- Select Staff --</option>
                                {backendStaff.map((s) => (
                                    <option key={s.id} value={s.id}>[{s.staff_code || 'S???'}] {s.name} ({s.category})</option>
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
