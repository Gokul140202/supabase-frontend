import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Toast from '../components/Toast';
import useToast from '../hooks/useToast';
import { apiFetch, supabase } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Clients() {
    const navigate = useNavigate();
    const { role } = useAuth();
    const { toast, showToast } = useToast();
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [selectedClient, setSelectedClient] = useState(null);
    const [clientDocs, setClientDocs] = useState([]);
    const [resultDocs, setResultDocs] = useState([]);
    const [clientDocsLoading, setClientDocsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('crm_docs');

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

                            let hasResult = false;
                            let resultFile = null;

                            clientTasks.forEach(task => {
                                if ((task.has_result === true || task.has_result === 't') && task.result_file_url) {
                                    hasResult = true;
                                    resultFile = { name: 'Result', url: task.result_file_url };
                                }
                            });

                            return {
                                id: c.id,
                                clientCode: c.client_code || null,
                                name: c.name,
                                mobile: c.phone || 'N/A',
                                taskTypes,
                                taskCount: clientTasks.length,
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
                                const hasResult = (task.has_result === true || task.has_result === 't') && task.result_file_url;
                                const resultFile = hasResult ? { name: 'Result', url: task.result_file_url } : null;

                                if (!clientMap.has(clientKey)) {
                                    clientMap.set(clientKey, {
                                        id: task.client_id_raw || task.client_id || clientKey,
                                        clientCode: task.client_code || null,
                                        name: task.client_name || 'Unknown',
                                        mobile: task.client_phone || 'N/A',
                                        taskTypes: [task.task_type],
                                        taskCount: 1,
                                        hasResult,
                                        resultFile
                                    });
                                } else {
                                    const existing = clientMap.get(clientKey);
                                    if (!existing.taskTypes.includes(task.task_type)) existing.taskTypes.push(task.task_type);
                                    existing.taskCount++;
                                    if (hasResult) { existing.hasResult = true; existing.resultFile = resultFile; }
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

    const handleSelectClient = async (client) => {
        setSelectedClient(client);
        setActiveTab('crm_docs');
        setClientDocs([]);
        setResultDocs([]);
        setClientDocsLoading(true);
        try {
            // 1. Fetch CRM documents from client_documents table
            const res = await apiFetch(`/clients/${client.id}/documents`);
            if (res.success) {
                setClientDocs((res.data || []).filter(d => d.doc_type !== 'result'));
            }

            // 2. Fetch result documents from documents table (task results)
            let allResults = [];

            const { data: taskIds } = await supabase
                .from('tasks')
                .select('id')
                .eq('client_id', client.id);

            if (taskIds && taskIds.length > 0) {
                const { data: taskResultDocs } = await supabase
                    .from('documents')
                    .select('id, file_url, file_name, file_type, doc_type, created_at')
                    .in('task_id', taskIds.map(t => t.id))
                    .eq('doc_type', 'result')
                    .order('created_at', { ascending: false });
                if (taskResultDocs) allResults = [...allResults, ...taskResultDocs];
            }

            // 3. Fetch result documents from rework_documents table (rework results)
            const { data: reworkIds } = await supabase
                .from('reworks')
                .select('id')
                .eq('client_id', client.id);

            if (reworkIds && reworkIds.length > 0) {
                const { data: reworkResultDocs } = await supabase
                    .from('rework_documents')
                    .select('id, file_url, file_name, file_type, doc_type, created_at')
                    .in('rework_id', reworkIds.map(r => r.id))
                    .eq('doc_type', 'result')
                    .order('created_at', { ascending: false });
                if (reworkResultDocs) allResults = [...allResults, ...reworkResultDocs];
            }

            // Sort all results by date (newest first)
            allResults.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            setResultDocs(allResults);

        } catch (err) {
            console.error('client documents fetch error:', err);
        } finally {
            setClientDocsLoading(false);
        }
    };

    const filtered = clients.filter(c => {
        const q = search.toLowerCase();
        return !q || c.name.toLowerCase().includes(q) || c.mobile.includes(q);
    });

    const handleDeleteClient = async (clientId, e) => {
        e.stopPropagation();
        if (confirm('Delete this client and all their tasks? This cannot be undone.')) {
            try {
                const data = await apiFetch(`/admin/clients/${clientId}`, { method: 'DELETE' });
                if (data.success) {
                    showToast('🗑️', 'Client deleted successfully');
                    setClients(prev => prev.filter(c => c.id !== clientId));
                }
            } catch (err) {
                showToast('❌', 'Failed to delete client: ' + err.message);
            }
        }
    };

    const docIcon = (name) => ({ pdf:'📕', doc:'📘', docx:'📘', xls:'📗', xlsx:'📗', jpg:'🖼️', jpeg:'🖼️', png:'🖼️', zip:'📦', txt:'📄', csv:'📊', tax:'💸' })[(name||'').split('.').pop().toLowerCase()] || '📄';

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
                                    <tr key={c.id} onClick={() => handleSelectClient(c)} style={{ cursor: 'pointer' }}>
                                        <td>
                                            <span style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}>
                                                {c.clientCode || `C${String(index + 1).padStart(3, '0')}`}
                                            </span>
                                        </td>
                                        <td><strong style={{ color: '#e879f9' }}>{c.name}</strong></td>
                                        <td style={{ color: '#94a3b8' }}>📱 {c.mobile}</td>
                                        <td>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                {(c.taskTypes || []).slice(0, 2).map((type, idx) => (
                                                    <span key={idx} style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
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
                                                <a
                                                    href={c.resultFile?.url}
                                                    download={c.resultFile?.name || 'result'}
                                                    target="_blank" rel="noreferrer"
                                                    onClick={e => e.stopPropagation()}
                                                    style={{ display:'inline-block', background:'rgba(16,185,129,0.15)', color:'#34d399', padding:'4px 10px', borderRadius:'6px', fontSize:'11px', fontWeight:700, textDecoration:'none', border:'1px solid rgba(16,185,129,0.3)' }}
                                                >
                                                    ✅ Result Added
                                                </a>
                                            ) : (
                                                <span style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600 }}>
                                                    ❌ Not Added
                                                </span>
                                            )}
                                        </td>
                                        {role === 'admin' && (
                                            <td>
                                                <button className="btn-sm" onClick={(e) => handleDeleteClient(c.id, e)} style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', fontSize: '11px', padding: '4px 10px' }}>
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

            {/* ── CLIENT DETAIL MODAL ── */}
            {selectedClient && (
                <div
                    style={{ display: 'flex', position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
                    onClick={e => { if (e.target === e.currentTarget) setSelectedClient(null); }}
                >
                    <div style={{ background: '#0f1629', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '28px', width: '90%', maxWidth: '640px', maxHeight: '85vh', overflowY: 'auto', position: 'relative' }}>
                        <button onClick={() => setSelectedClient(null)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}>✕</button>

                        {/* Client Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                            <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'rgba(232,121,249,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px' }}>👤</div>
                            <div>
                                <div style={{ fontSize: '20px', fontWeight: 700, color: '#e879f9' }}>{selectedClient.name}</div>
                                <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '2px' }}>📱 {selectedClient.mobile}</div>
                                {selectedClient.clientCode && (
                                    <span style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, fontFamily: 'monospace' }}>
                                        {selectedClient.clientCode}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* ── TAB SWITCHER ── */}
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                            <button
                                onClick={() => setActiveTab('crm_docs')}
                                style={{
                                    padding: '8px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, border: 'none', cursor: 'pointer',
                                    background: activeTab === 'crm_docs' ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
                                    color: activeTab === 'crm_docs' ? '#a5b4fc' : '#94a3b8',
                                    display: 'flex', alignItems: 'center', gap: '6px'
                                }}
                            >
                                🔗 CRM Documents
                                {clientDocs.length > 0 && (
                                    <span style={{ background: 'rgba(99,102,241,0.3)', color: '#a5b4fc', padding: '1px 6px', borderRadius: '4px', fontSize: '11px' }}>
                                        {clientDocs.length}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => setActiveTab('result_docs')}
                                style={{
                                    padding: '8px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, border: 'none', cursor: 'pointer',
                                    background: activeTab === 'result_docs' ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)',
                                    color: activeTab === 'result_docs' ? '#34d399' : '#94a3b8',
                                    display: 'flex', alignItems: 'center', gap: '6px'
                                }}
                            >
                                📄 Result Documents
                                {resultDocs.length > 0 && (
                                    <span style={{ background: 'rgba(16,185,129,0.3)', color: '#34d399', padding: '1px 6px', borderRadius: '4px', fontSize: '11px' }}>
                                        {resultDocs.length}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* ── TAB: CRM Documents ── */}
                        {activeTab === 'crm_docs' && (
                            <div>
                                {clientDocsLoading ? (
                                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>⏳ Loading...</div>
                                ) : clientDocs.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', border: '1px dashed rgba(99,102,241,0.3)', borderRadius: '14px' }}>
                                        <div style={{ fontSize: '40px', marginBottom: '12px' }}>📭</div>
                                        <div style={{ fontSize: '14px', fontWeight: 600 }}>No CRM documents yet</div>
                                    </div>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '14px' }}>
                                        {clientDocs.map((doc, i) => (
                                            <div key={doc.id || i}
                                                style={{ background: 'rgba(99,102,241,0.05)', padding: '18px', borderRadius: '14px', border: '1px solid rgba(99,102,241,0.2)', textAlign: 'center', transition: 'all 0.2s', cursor: 'pointer' }}
                                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.2)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                            >
                                                <div style={{ fontSize: '30px', marginBottom: '10px' }}>{docIcon(doc.file_name)}</div>
                                                <div style={{ fontSize: '11px', fontWeight: 600, marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={doc.file_name}>
                                                    {doc.file_name}
                                                </div>
                                                <div style={{ fontSize: '10px', color: '#a5b4fc', marginBottom: '10px', fontWeight: 600 }}>
                                                    {doc.doc_type || 'Document'}
                                                </div>
                                                <div style={{ fontSize: '10px', color: '#475569', marginBottom: '10px' }}>
                                                    {new Date(doc.created_at).toLocaleDateString()}
                                                </div>
                                                <a
                                                    href={doc.file_url}
                                                    download={doc.file_name}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    style={{
                                                        display: 'block', textAlign: 'center',
                                                        padding: '8px 14px', borderRadius: '8px',
                                                        fontSize: '11px', fontWeight: 600,
                                                        textDecoration: 'none',
                                                        background: 'rgba(99,102,241,0.15)',
                                                        color: '#a5b4fc',
                                                        border: '1px solid rgba(99,102,241,0.3)',
                                                    }}
                                                >
                                                    ⬇️ Download
                                                </a>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── TAB: Result Documents ── */}
                        {activeTab === 'result_docs' && (
                            <div>
                                {clientDocsLoading ? (
                                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>⏳ Loading...</div>
                                ) : resultDocs.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', border: '1px dashed rgba(16,185,129,0.3)', borderRadius: '14px' }}>
                                        <div style={{ fontSize: '40px', marginBottom: '12px' }}>📄</div>
                                        <div style={{ fontSize: '14px', fontWeight: 600 }}>No result documents yet</div>
                                    </div>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '14px' }}>
                                        {resultDocs.map((doc, i) => (
                                            <div key={doc.id || i}
                                                style={{ background: 'rgba(16,185,129,0.05)', padding: '18px', borderRadius: '14px', border: '1px solid rgba(16,185,129,0.2)', textAlign: 'center', transition: 'all 0.2s', cursor: 'pointer' }}
                                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(16,185,129,0.5)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(16,185,129,0.2)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                            >
                                                <div style={{ fontSize: '30px', marginBottom: '10px' }}>{docIcon(doc.file_name)}</div>
                                                <div style={{ fontSize: '11px', fontWeight: 600, marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={doc.file_name}>
                                                    {doc.file_name}
                                                </div>
                                                <div style={{ fontSize: '10px', color: '#34d399', marginBottom: '10px', fontWeight: 600 }}>
                                                    ✅ Result
                                                </div>
                                                <div style={{ fontSize: '10px', color: '#475569', marginBottom: '10px' }}>
                                                    {new Date(doc.created_at).toLocaleDateString()}
                                                </div>
                                                <a
                                                    href={doc.file_url}
                                                    download={doc.file_name}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    style={{
                                                        display: 'block', textAlign: 'center',
                                                        padding: '8px 14px', borderRadius: '8px',
                                                        fontSize: '11px', fontWeight: 600,
                                                        textDecoration: 'none',
                                                        background: 'rgba(16,185,129,0.15)',
                                                        color: '#34d399',
                                                        border: '1px solid rgba(16,185,129,0.3)',
                                                    }}
                                                >
                                                    ⬇️ Download
                                                </a>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <Toast toast={toast} />
        </div>
    );
}