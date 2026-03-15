import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Toast from '../components/Toast';
import useToast from '../hooks/useToast';
import { apiFetch } from '../api';
import { useAuth } from '../context/AuthContext';


export default function Clients() {
    const navigate = useNavigate();
    const { role } = useAuth();
    const { toast, showToast } = useToast();
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [selectedClient, setSelectedClient] = useState(null);

    useEffect(() => {
        const fetchClients = async () => {
            setLoading(true);
            try {
                if (role === 'admin') {
                    const [clientsRes, tasksRes] = await Promise.all([
                        apiFetch('/admin/clients'),
                        apiFetch('/admin/tasks')
                    ]);
                    
                    if (clientsRes.success) {
                        const tasksData = tasksRes.success ? tasksRes.data : [];
                        const mapped = clientsRes.data.map(c => {
                            const clientTasks = tasksData.filter(t => 
                                t.client_id === c.id || t.client_name === c.name
                            );
                            const taskTypes = [...new Set(clientTasks.map(t => t.task_type))];
                            
                            // Group documents by task type & check for result files
                            const taskDocuments = {};
                            let hasResult = false;
                            let resultFile = null;
                            
                            clientTasks.forEach(task => {
                                // Check for result from backend (handle PostgreSQL 't'/'f' strings)
                                if ((task.has_result === true || task.has_result === 't') && task.result_file_url) {
                                    hasResult = true;
                                    resultFile = {
                                        name: 'Result',
                                        url: task.result_file_url
                                    };
                                }
                                
                                taskDocuments[task.task_type] = {
                                    taskId: task.id,
                                    status: task.status,
                                    documents: []
                                };
                            });
                            
                            return {
                                id: c.id,
                                clientCode: c.client_code || null,
                                name: c.name,
                                mobile: c.phone || 'N/A',
                                taskTypes,
                                taskCount: clientTasks.length,
                                taskDocuments,
                                hasResult,
                                resultFile
                            };
                        });
                        setClients(mapped);
                    }
                } else {
                    const response = await apiFetch('/staff/tasks');
                    if (response.success && response.data) {
                        const clientMap = new Map();
                        response.data.forEach(task => {
                            const clientKey = task.client_phone || task.client_id;
                            if (clientKey) {
                                // Check for result from backend (handle PostgreSQL 't'/'f' strings)
                                const hasResult = (task.has_result === true || task.has_result === 't') && task.result_file_url;
                                const resultFile = hasResult ? {
                                    name: 'Result',
                                    url: task.result_file_url
                                } : null;
                                
                                if (!clientMap.has(clientKey)) {
                                    clientMap.set(clientKey, {
                                        id: task.client_id || clientKey,
                                        clientCode: task.client_code || null,
                                        name: task.client_name || 'Unknown',
                                        mobile: task.client_phone || 'N/A',
                                        taskTypes: [task.task_type],
                                        taskCount: 1,
                                        taskDocuments: {
                                            [task.task_type]: {
                                                taskId: task.id,
                                                status: task.status,
                                                documents: []
                                            }
                                        },
                                        hasResult,
                                        resultFile
                                    });
                                } else {
                                    const existing = clientMap.get(clientKey);
                                    if (!existing.taskTypes.includes(task.task_type)) {
                                        existing.taskTypes.push(task.task_type);
                                    }
                                    existing.taskCount++;
                                    existing.taskDocuments[task.task_type] = {
                                        taskId: task.id,
                                        status: task.status,
                                        documents: []
                                    };
                                    // Update result if found
                                    if (hasResult) {
                                        existing.hasResult = true;
                                        existing.resultFile = resultFile;
                                    }
                                }
                            }
                        });
                        setClients(Array.from(clientMap.values()));
                    }
                }
            } catch (err) {
                console.error('Fetch clients error:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchClients();
    }, [role]);

    const filtered = clients.filter(c => {
        const q = search.toLowerCase();
        return !q || c.name.toLowerCase().includes(q) || c.mobile.includes(q);
    });

    const handleDeleteClient = async (clientId, e) => {
        e.stopPropagation();
        if (confirm('Delete this client and all their tasks? This cannot be undone.')) {
            try {
                const data = await apiFetch(`/admin/clients/${clientId}`, {
                    method: 'DELETE'
                });
                if (data.success) {
                    showToast('🗑️', 'Client deleted successfully');
                    setClients(prev => prev.filter(c => c.id !== clientId));
                }
            } catch (err) {
                console.error('Failed to delete client:', err);
                showToast('❌', 'Failed to delete client: ' + err.message);
            }
        }
    };

    return (
        <div className="app-layout">
            <Sidebar />

            <div className="main-content">
                <div className="topbar">
                    <h1 className="topbar-title">👥 Clients</h1>
                    <div className="topbar-actions">
                        <div className="search-wrap">
                            <span className="search-icon">🔍</span>
                            <input
                                className="topbar-search"
                                type="text"
                                placeholder="Search by name, mobile…"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className="page-content">
                    <div className="table-card">
                        <div className="table-header">
                            <span className="table-title">{role === 'admin' ? 'All Clients' : 'My Clients'} — {filtered.length}</span>
                        </div>
                        <table>
                            <thead>
                                <tr>
                                    <th>Client ID</th>
                                    <th>Client Name</th>
                                    <th>Phone Number</th>
                                    <th>Task Types</th>
                                    <th>Total Tasks</th>
                                    <th>Result</th>
                                    {role === 'admin' && <th>Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={role === 'admin' ? 7 : 6} style={{ textAlign: 'center', padding: '40px', color: '#475569' }}>
                                            No clients found.
                                        </td>
                                    </tr>
                                ) : filtered.map((c, index) => (
                                    <tr key={c.id} onClick={() => setSelectedClient(c)} style={{ cursor: 'pointer' }}>
                                        <td>
                                            <span style={{ 
                                                background: 'rgba(99,102,241,0.15)', 
                                                color: '#a5b4fc', 
                                                padding: '4px 10px', 
                                                borderRadius: '6px', 
                                                fontSize: '12px', 
                                                fontWeight: 700 
                                            }}>
                                                {c.clientCode || `C${String(index + 1).padStart(3, '0')}`}
                                            </span>
                                        </td>
                                        <td><strong style={{ color: '#e879f9' }}>{c.name}</strong></td>
                                        <td style={{ color: '#94a3b8' }}>📱 {c.mobile}</td>
                                        <td>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                {(c.taskTypes || []).slice(0, 2).map((type, idx) => (
                                                    <span key={idx} style={{ 
                                                        background: 'rgba(245,158,11,0.12)', 
                                                        color: '#fbbf24', 
                                                        padding: '2px 6px', 
                                                        borderRadius: '4px', 
                                                        fontSize: '11px', 
                                                        fontWeight: 600 
                                                    }}>
                                                        {type}
                                                    </span>
                                                ))}
                                                {(c.taskTypes || []).length > 2 && (
                                                    <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>+{c.taskTypes.length - 2}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <span style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>
                                                {c.taskCount || 0} tasks
                                            </span>
                                        </td>
                                        <td>
                                            {c.hasResult ? (
                                                <button 
                                                    className="btn-sm green"
                                                    onClick={(e) => { e.stopPropagation(); window.open(c.resultFile?.url, '_blank'); }}
                                                    style={{ fontSize: '11px', padding: '4px 10px' }}
                                                >
                                                    ✅ Result Added
                                                </button>
                                            ) : (
                                                <span style={{ 
                                                    background: 'rgba(239,68,68,0.12)', 
                                                    color: '#f87171', 
                                                    padding: '4px 10px', 
                                                    borderRadius: '6px', 
                                                    fontSize: '11px', 
                                                    fontWeight: 600 
                                                }}>
                                                    ❌ Not Added
                                                </span>
                                            )}
                                        </td>
                                        {role === 'admin' && (
                                            <td>
                                                <button 
                                                    className="btn-sm"
                                                    onClick={(e) => handleDeleteClient(c.id, e)}
                                                    style={{ 
                                                        background: 'rgba(239,68,68,0.15)', 
                                                        color: '#f87171', 
                                                        border: '1px solid rgba(239,68,68,0.3)',
                                                        fontSize: '11px', 
                                                        padding: '4px 10px' 
                                                    }}
                                                >
                                                    🗑️ Delete
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* CLIENT DETAIL MODAL - Task-wise Documents */}
            {selectedClient && (
                <div
                    style={{
                        display: 'flex', position: 'fixed', inset: 0, zIndex: 200,
                        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
                        alignItems: 'center', justifyContent: 'center', padding: '20px',
                    }}
                    onClick={e => { if (e.target === e.currentTarget) setSelectedClient(null); }}
                >
                    <div style={{
                        background: '#0f1629', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '20px', padding: '28px', width: '90%', maxWidth: '600px',
                        maxHeight: '85vh', overflowY: 'auto', position: 'relative',
                    }}>
                        <button onClick={() => setSelectedClient(null)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}>✕</button>

                        {/* Client Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                            <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'rgba(232,121,249,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px' }}>👤</div>
                            <div>
                                <div style={{ fontSize: '20px', fontWeight: 700, color: '#e879f9' }}>{selectedClient.name}</div>
                                <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>📱 {selectedClient.mobile}</div>
                            </div>
                        </div>

                        {/* Task-wise Documents */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {Object.entries(selectedClient.taskDocuments || {}).map(([taskType, taskData]) => (
                                <div key={taskType} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '14px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                                    {/* Task Type Header */}
                                    <div style={{ 
                                        padding: '14px 18px', 
                                        background: 'rgba(245,158,11,0.08)', 
                                        borderBottom: '1px solid var(--border)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ fontSize: '18px' }}>📋</span>
                                            <span style={{ fontWeight: 700, color: '#fbbf24', fontSize: '14px' }}>{taskType}</span>
                                        </div>
                                        <span style={{ 
                                            fontSize: '11px', 
                                            padding: '3px 10px', 
                                            borderRadius: '6px',
                                            background: taskData.status === 'completed' ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.15)',
                                            color: taskData.status === 'completed' ? '#34d399' : '#a5b4fc',
                                            fontWeight: 600
                                        }}>
                                            {taskData.status}
                                        </span>
                                    </div>
                                    
                                    {/* Documents List */}
                                    <div style={{ padding: '14px 18px' }}>
                                        {(taskData.documents || []).length === 0 ? (
                                            <div style={{ textAlign: 'center', padding: '16px', color: '#64748b', fontSize: '13px' }}>
                                                📭 No documents submitted for this task
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {taskData.documents.map((doc, idx) => (
                                                    <div key={doc.id || idx} style={{
                                                        display: 'flex', alignItems: 'center', gap: '10px',
                                                        padding: '10px 12px', background: 'rgba(255,255,255,0.02)',
                                                        borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)',
                                                    }}>
                                                        <span style={{ fontSize: '20px' }}>
                                                            {doc.name?.toLowerCase().endsWith('.pdf') ? '📕' :
                                                             doc.name?.toLowerCase().match(/\.(jpg|jpeg|png)$/) ? '🖼️' : '📄'}
                                                        </span>
                                                        <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13px', color: 'var(--text-primary)' }}>
                                                            {doc.name}
                                                        </div>
                                                        {doc.url && (
                                                            <button
                                                                className="btn-sm green"
                                                                onClick={() => window.open(doc.url, '_blank')}
                                                                style={{ flexShrink: 0, fontSize: '11px', padding: '4px 10px' }}
                                                            >
                                                                📂 Open
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            
                            {Object.keys(selectedClient.taskDocuments || {}).length === 0 && (
                                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                                    <div style={{ fontSize: '40px', marginBottom: '12px' }}>📭</div>
                                    <div>No tasks assigned for this client</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <Toast toast={toast} />
        </div>
    );
}
