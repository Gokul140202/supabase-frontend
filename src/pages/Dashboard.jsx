import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, mapBackendTaskToFrontend, supabase } from '../api';
import Sidebar from '../components/Sidebar';
import Toast from '../components/Toast';
import useToast from '../hooks/useToast';
import { useAuth } from '../context/AuthContext';

const STAGE_STYLE = {
    new:       { color: '#22d3ee', bg: 'rgba(6,182,212,0.12)',  label: 'Ready to File' },
    contacted: { color: '#fbbf24', bg: 'rgba(245,158,11,0.12)', label: 'Contacted' },
    qualified: { color: '#c084fc', bg: 'rgba(139,92,246,0.12)', label: 'Qualified' },
    proposal:  { color: '#60a5fa', bg: 'rgba(59,130,246,0.12)', label: 'Proposal Sent' },
    won:       { color: '#34d399', bg: 'rgba(16,185,129,0.12)', label: 'Won' },
    lost:      { color: '#f87171', bg: 'rgba(239,68,68,0.12)',  label: 'Lost' },
};

export default function Dashboard() {
    const navigate = useNavigate();
    const { role, user } = useAuth();
    const { toast, showToast } = useToast();
    const [allTasks, setAllTasks]           = useState([]);
    const [clients, setClients]             = useState([]);
    const [loading, setLoading]             = useState(false);
    const [dashboardStats, setDashboardStats] = useState(null);
    const [reworkCount, setReworkCount]     = useState(0);
    const [crmData, setCrmData]             = useState([]);
    const [crmLoading, setCrmLoading]       = useState(false);
    const [selectedCrm, setSelectedCrm]     = useState(null);
    const [showCrmModal, setShowCrmModal]   = useState(false);
    const [crmHasNew, setCrmHasNew]         = useState(false);
    const crmInitDone = useRef(false);

    // ── CRM Remove (delete from crm_contacts) ──
    const [removingCrm, setRemovingCrm] = useState(false);

    const handleRemoveCrmContact = async () => {
        if (!selectedCrm?.id) return;
        if (!confirm(`Remove "${selectedCrm.name}" from CRM Pipeline?`)) return;
        setRemovingCrm(true);
        try {
            // Delete linked opportunities first (FK)
            await supabase.from('crm_opportunities').delete().eq('contact_id', selectedCrm.id);
            const { error } = await supabase.from('crm_contacts').delete().eq('id', selectedCrm.id);
            if (error) throw new Error(error.message);

            setCrmData(prev => prev.filter(c => c.id !== selectedCrm.id));
            showToast('🗑️', `${selectedCrm.name} removed from CRM Pipeline`);
            setSelectedCrm(null);
        } catch (err) {
            showToast('❌', 'Failed to remove: ' + err.message);
        } finally {
            setRemovingCrm(false);
        }
    };

    // ── Client ID Generator (mobile → JKC code + CRM callback) ──
    const [clientIdMobile, setClientIdMobile] = useState('');
    const [clientIdName, setClientIdName]     = useState('');
    const [clientIdLoading, setClientIdLoading] = useState(false);
    const [clientIdResult, setClientIdResult] = useState(null);

    const handleGenerateClientId = async () => {
        const cleanPhone = clientIdMobile.replace(/\D/g, '').slice(-10);
        if (cleanPhone.length !== 10) {
            showToast('⚠️', 'Enter a valid 10-digit mobile number');
            return;
        }
        setClientIdLoading(true);
        setClientIdResult(null);
        try {
            const res = await fetch(
                'https://wzvzzcuennotfutklulh.supabase.co/functions/v1/client-intake',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6dnp6Y3Vlbm5vdGZ1dGtsdWxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMDY0MjEsImV4cCI6MjA4ODc4MjQyMX0.f3Uk8LSTil0_F9f9V6vg54u3pXL9I88f1a-AkLRuiCI',
                    },
                    body: JSON.stringify({
                        name: clientIdName.trim() || 'Unknown',
                        phone: cleanPhone,
                    }),
                }
            );
            const json = await res.json();
            if (!json.success) throw new Error(json.error || 'Failed');
            setClientIdResult(json);
            if (json.is_new) {
                showToast('✅', `New client created: ${json.client_id} — sent to CRM`);
            } else {
                showToast('ℹ️', `Existing client: ${json.client_id} — resent to CRM`);
            }
        } catch (err) {
            showToast('❌', 'Failed: ' + err.message);
        } finally {
            setClientIdLoading(false);
        }
    };

    useEffect(() => {
        const fetchDashboardData = async () => {
            setLoading(true);
            try {
                const endpoint = role === 'admin' ? '/admin/tasks' : '/staff/tasks';
                const data = await apiFetch(endpoint);
                if (data.success && data.data && data.data.length > 0) {
                    setAllTasks(data.data.map(mapBackendTaskToFrontend));
                }

                try {
                    const reworkEndpoint = role === 'admin' ? '/admin/reworks' : '/staff/reworks';
                    const reworkData = await apiFetch(reworkEndpoint);
                    if (reworkData.success && reworkData.data) {
                        setReworkCount(reworkData.data.length);
                    }
                } catch (e) {}

                if (role === 'admin') {
                    const stats = await apiFetch('/admin/dashboard');
                    if (stats.success) setDashboardStats(stats.data);

                    const clientsRes = await apiFetch('/admin/clients');
                    if (clientsRes.success) {
                        const enrichedClients = (clientsRes.data || []).map(client => {
                            const clientTasks = data.data?.filter(t =>
                                t.client_id === client.id || t.client_name === client.name
                            ) || [];
                            const taskTypes = [...new Set(clientTasks.map(t => t.task_type))];
                            return { ...client, taskCount: clientTasks.length, taskTypes };
                        });
                        setClients(enrichedClients);
                    }
                } else {
                    if (data.success && data.data) {
                        const clientMap = new Map();
                        data.data.forEach(task => {
                            const clientKey = task.client_phone || task.client_id;
                            if (clientKey) {
                                if (!clientMap.has(clientKey)) {
                                    clientMap.set(clientKey, {
                                        id: task.client_id,
                                        name: task.client_name || 'Unknown',
                                        phone: task.client_phone || 'N/A',
                                        email: task.client_email || 'N/A',
                                        taskTypes: [task.task_type],
                                        taskCount: 1
                                    });
                                } else {
                                    const existing = clientMap.get(clientKey);
                                    if (!existing.taskTypes.includes(task.task_type)) existing.taskTypes.push(task.task_type);
                                    existing.taskCount++;
                                }
                            }
                        });
                        setClients(Array.from(clientMap.values()));
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

    // ── CRM Pipeline: direct fetch (supabase.functions.invoke sends POST not GET) ──
    const fetchCrmPipeline = async (isRealtime = false) => {
        if (!isRealtime) setCrmLoading(true);
        try {
            const staffParam = role === 'staff' && user?.id ? `?staff_id=${user.id}` : '';
            const res = await fetch(
                `https://wzvzzcuennotfutklulh.supabase.co/functions/v1/crm-pipeline${staffParam}`,
                {
                    method: 'GET',
                    headers: {
                        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6dnp6Y3Vlbm5vdGZ1dGtsdWxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMDY0MjEsImV4cCI6MjA4ODc4MjQyMX0.f3Uk8LSTil0_F9f9V6vg54u3pXL9I88f1a-AkLRuiCI',
                    },
                }
            );
            const json = await res.json();
            if (json?.success) {
                setCrmData(json.data || []);
                if (isRealtime && crmInitDone.current) {
                    setCrmHasNew(true);
                }
                if (!isRealtime) crmInitDone.current = true;
            }
        } catch (err) {
            console.error('CRM fetch error:', err);
        } finally {
            if (!isRealtime) setCrmLoading(false);
        }
    };

    useEffect(() => {
        fetchCrmPipeline();

        // Live: GHL webhook → edge function POST → broadcasts 'pipeline_change'
        // Also listen to direct DB changes (crm_contacts table)
        const channel = supabase
            .channel('crm-pipeline-updates')
            .on('broadcast', { event: 'pipeline_change' }, () => {
                fetchCrmPipeline(true);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_contacts' }, () => {
                fetchCrmPipeline(true);
            })
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, [role]);

    // Staff: only their assigned CRM contacts
    const myCrmContacts = role === 'staff'
        ? crmData.filter(c => c.assigned_staff === user?.id)
        : crmData;

    const tasks         = allTasks;
    const recentTasks   = tasks.slice(0, 5);
    const pendingTasks  = tasks.filter(t => t.status === 'Pending');
    const progressTasks = tasks.filter(t => t.status === 'In-Progress');
    const completedTasks= tasks.filter(t => t.status === 'Completed');

    const TaskRow = ({ t }) => (
        <div
            onClick={() => navigate(`/tasks/${t.id}`)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.2s' }}
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

    const SectionHeader = ({ icon, label, count, color, bgColor }) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>{icon}</div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>{label}</h3>
                <span style={{ background: bgColor, color: color, padding: '2px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, border: `1px solid ${color}25` }}>{count}</span>
            </div>
        </div>
    );

    const StageTag = ({ stage }) => {
        const s = STAGE_STYLE[stage] || { color: '#94a3b8', bg: 'rgba(255,255,255,0.06)', label: stage };
        return (
            <span style={{ background: s.bg, color: s.color, padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                {s.label}
            </span>
        );
    };

    const generateClientIdCard = (
        <div className="table-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(34,211,238,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>🆔</div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Generate Client ID</h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>— Check by mobile, create if not found and send to CRM</span>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                    type="tel"
                    placeholder="Mobile number (10 digits)"
                    value={clientIdMobile}
                    onChange={e => setClientIdMobile(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !clientIdLoading) handleGenerateClientId(); }}
                    disabled={clientIdLoading}
                    style={{
                        flex: '1 1 200px',
                        padding: '10px 14px',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid var(--border)',
                        borderRadius: '10px',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                        outline: 'none',
                    }}
                />
                <input
                    type="text"
                    placeholder="Name (optional)"
                    value={clientIdName}
                    onChange={e => setClientIdName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !clientIdLoading) handleGenerateClientId(); }}
                    disabled={clientIdLoading}
                    style={{
                        flex: '1 1 200px',
                        padding: '10px 14px',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid var(--border)',
                        borderRadius: '10px',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                        outline: 'none',
                    }}
                />
                <button
                    onClick={handleGenerateClientId}
                    disabled={clientIdLoading}
                    style={{
                        padding: '10px 22px',
                        background: clientIdLoading ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #06b6d4, #6366f1)',
                        border: 'none',
                        borderRadius: '10px',
                        color: '#fff',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: clientIdLoading ? 'not-allowed' : 'pointer',
                        opacity: clientIdLoading ? 0.6 : 1,
                    }}
                >
                    {clientIdLoading ? 'Processing…' : 'Submit'}
                </button>
            </div>
            {clientIdResult && (
                <div style={{
                    marginTop: '14px',
                    padding: '12px 14px',
                    background: clientIdResult.is_new ? 'rgba(16,185,129,0.08)' : 'rgba(34,211,238,0.08)',
                    border: `1px solid ${clientIdResult.is_new ? 'rgba(16,185,129,0.3)' : 'rgba(34,211,238,0.3)'}`,
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    flexWrap: 'wrap',
                }}>
                    <span style={{ fontSize: '18px' }}>{clientIdResult.is_new ? '🆕' : '♻️'}</span>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '2px' }}>
                            {clientIdResult.is_new ? 'New client created' : 'Existing client found'} — Sent to CRM
                        </div>
                        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '13px' }}>
                            <span><strong style={{ color: '#22d3ee' }}>{clientIdResult.client_id}</strong></span>
                            <span style={{ color: 'var(--text-muted)' }}>{clientIdResult.name}</span>
                            <span style={{ color: 'var(--text-muted)' }}>📞 {clientIdResult.phone}</span>
                        </div>
                    </div>
                    <button
                        onClick={() => { setClientIdMobile(''); setClientIdName(''); setClientIdResult(null); }}
                        style={{
                            padding: '6px 14px',
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            color: 'var(--text-primary)',
                            fontSize: '12px',
                            cursor: 'pointer',
                        }}
                    >
                        Clear
                    </button>
                </div>
            )}
        </div>
    );

    return (
        <div className="app-layout">
            <style>{`
                @keyframes crm-ping {
                    0%   { box-shadow: 0 0 0 0 rgba(239,68,68,0.7); }
                    70%  { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
                    100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
                }
            `}</style>
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
                    {/* ── Stats Grid ── */}
                    <div className="stats-grid">
                        <div className="stat-card" onClick={() => navigate(role === 'admin' ? '/clients' : '/tasks')} style={{ cursor: 'pointer' }}>
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
                        {/* ── CRM Pipeline Card ── */}
                        <div className="stat-card" style={{ borderLeft: '3px solid #06b6d4', cursor: 'pointer', position: 'relative' }}
                            onClick={() => { setCrmHasNew(false); setShowCrmModal(true); }}>
                            {crmHasNew && (
                                <span style={{
                                    position: 'absolute', top: '10px', right: '10px',
                                    width: '10px', height: '10px', borderRadius: '50%',
                                    background: '#ef4444',
                                    boxShadow: '0 0 0 0 rgba(239,68,68,0.7)',
                                    animation: 'crm-ping 1.4s ease-in-out infinite',
                                    display: 'inline-block',
                                }} />
                            )}
                            <div style={{ fontSize: '20px' }}>🔗</div>
                            <div className="stat-value" style={{ color: '#22d3ee' }}>
                                {crmLoading ? '…' : (role === 'staff' ? myCrmContacts.length : crmData.length)}
                            </div>
                            <div className="stat-label">CRM Pipeline</div>
                        </div>
                        <div className="stat-card" style={{ cursor: 'pointer', borderLeft: '3px solid #e879f9' }} onClick={() => navigate('/rework')}>
                            <div style={{ fontSize: '20px' }}>🔁</div>
                            <div className="stat-value" style={{ color: '#e879f9' }}>{reworkCount}</div>
                            <div className="stat-label">Reworks</div>
                        </div>
                    </div>

                    {role === 'admin' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                            {/* ── Generate Client ID Card ── */}
                            {generateClientIdCard}

                            {/* ── Recent Tasks ── */}
                            <div className="table-card">
                                <div className="table-header">
                                    <span style={{ fontWeight: 700, fontSize: '14px' }}>📋 Recent Task Activity</span>
                                    <button className="btn-sm" onClick={() => navigate('/tasks')}>View All →</button>
                                </div>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Client Name</th><th>Task Type</th><th>Assigned To</th><th>Documents</th><th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {recentTasks.length === 0 ? (
                                            <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>No tasks yet</td></tr>
                                        ) : recentTasks.map(t => (
                                            <tr key={t.id} onClick={() => navigate(`/tasks/${t.id}`)} style={{ cursor: 'pointer' }}>
                                                <td><strong>{t.client}</strong></td>
                                                <td style={{ color: '#94a3b8' }}>{t.task}</td>
                                                <td style={{ color: '#94a3b8' }}>{t.users}</td>
                                                <td>📂 {t.docCount || 0} Files</td>
                                                <td><span className={`badge ${t.status === 'Completed' ? 'entity' : t.status === 'In-Progress' ? 'individual' : 'trust'}`}>{t.status}</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* ── Client List ── */}
                            <div className="table-card">
                                <div className="table-header">
                                    <span style={{ fontWeight: 700, fontSize: '14px' }}>👥 Client List</span>
                                    <button className="btn-sm" onClick={() => navigate('/clients')}>View All →</button>
                                </div>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Client ID</th><th>Client Name</th><th>Phone Number</th><th>Task Types</th><th>Total Tasks</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {clients.length === 0 ? (
                                            <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>No clients yet</td></tr>
                                        ) : clients.slice(0, 5).map((c, index) => (
                                            <tr key={c.id} onClick={() => navigate('/clients')} style={{ cursor: 'pointer' }}>
                                                <td>
                                                    <span style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}>
                                                        {c.client_code || `C${String(index + 1).padStart(3, '0')}`}
                                                    </span>
                                                </td>
                                                <td><strong style={{ color: '#e879f9' }}>{c.name}</strong></td>
                                                <td style={{ color: '#94a3b8' }}>📱 {c.phone || 'N/A'}</td>
                                                <td>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                        {(c.taskTypes || []).slice(0, 2).map((type, idx) => (
                                                            <span key={idx} style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>{type}</span>
                                                        ))}
                                                        {(c.taskTypes || []).length > 2 && <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>+{c.taskTypes.length - 2}</span>}
                                                    </div>
                                                </td>
                                                <td><span style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>{c.taskCount || 0} tasks</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* ── CRM Pipeline Table (Admin — all contacts) ── */}
                            <div className="table-card" style={crmHasNew ? { boxShadow: '0 0 0 2px rgba(239,68,68,0.45)', transition: 'box-shadow 0.3s' } : {}}>
                                <div className="table-header">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontWeight: 700, fontSize: '14px' }}>🔗 CRM Pipeline — Live</span>
                                        {crmHasNew && (
                                            <span style={{ background: '#ef4444', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '8px', letterSpacing: '0.3px' }}>
                                                NEW
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{crmData.length} contacts</span>
                                        <button className="btn-sm" onClick={() => { setCrmHasNew(false); fetchCrmPipeline(); }} style={{ background: 'rgba(6,182,212,0.1)', color: '#22d3ee', border: '1px solid rgba(6,182,212,0.3)' }}>🔄</button>
                                    </div>
                                </div>
                                {crmLoading ? (
                                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>⏳ Loading CRM...</div>
                                ) : crmData.length === 0 ? (
                                    <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        <div style={{ fontSize: '32px', marginBottom: '10px' }}>🔗</div>
                                        <div style={{ fontSize: '13px' }}>No CRM contacts yet. GHL pipeline contacts will appear here automatically.</div>
                                    </div>
                                ) : (
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Client Name</th>
                                                <th>Client ID</th>
                                                <th>Staff</th>
                                                <th>Task ID</th>
                                                <th>Stage</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {crmData.map(c => {
                                                const opp = c.crm_opportunities?.[0] || null;
                                                return (
                                                    <tr key={c.id} style={{ cursor: 'pointer' }}
                                                        onClick={() => { setSelectedCrm({ ...c, opp }); setShowCrmModal(true); }}>
                                                        <td><strong style={{ color: '#e879f9' }}>{c.name}</strong></td>
                                                        <td>
                                                            <span style={{ background: 'rgba(6,182,212,0.1)', color: '#22d3ee', padding: '3px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>
                                                                📱 {c.whatsapp_number || 'N/A'}
                                                            </span>
                                                        </td>
                                                        <td style={{ fontSize: '12px' }}>
                                                            {c.staff
                                                                ? <span style={{ color: '#a5b4fc' }}>[{c.staff.staff_code}] {c.staff.name}</span>
                                                                : <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>}
                                                        </td>
                                                        <td>
                                                            {c.notes
                                                                ? <span style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', padding: '3px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>{c.notes}</span>
                                                                : <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>—</span>}
                                                        </td>
                                                        <td><StageTag stage={c.stage} /></td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                            {/* ── Generate Client ID Card ── */}
                            {generateClientIdCard}

                            {/* ── Staff: CRM Pipeline (their contacts only) ── */}
                            {myCrmContacts.length > 0 && (
                                <div>
                                    <SectionHeader icon="🔗" label="My CRM Clients" count={myCrmContacts.length} color="#22d3ee" bgColor="rgba(6,182,212,0.12)" />
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {myCrmContacts.map(c => {
                                            const opp = c.crm_opportunities?.[0] || null;
                                            return (
                                                <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'rgba(6,182,212,0.04)', borderRadius: '12px', border: '1px solid rgba(6,182,212,0.15)', cursor: 'pointer' }}
                                                    onClick={() => { setSelectedCrm({ ...c, opp }); setShowCrmModal(true); }}>
                                                    <div>
                                                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '13px' }}>{c.name}</div>
                                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>📱 {c.whatsapp_number || 'N/A'}</div>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                        <StageTag stage={c.stage} />
                                                        {opp?.task_type && (
                                                            <span style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600 }}>
                                                                {opp.task_type}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div>
                                <SectionHeader icon="⏳" label="Pending Tasks" count={pendingTasks.length} color="#f59e0b" bgColor="rgba(245,158,11,0.12)" />
                                {pendingTasks.length === 0
                                    ? <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid var(--border)', fontSize: '13px' }}>🎉 No pending tasks!</div>
                                    : <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>{pendingTasks.map(t => <TaskRow key={t.id} t={t} />)}</div>
                                }
                            </div>
                            <div>
                                <SectionHeader icon="🔄" label="In-Progress Tasks" count={progressTasks.length} color="#6366f1" bgColor="rgba(99,102,241,0.12)" />
                                {progressTasks.length === 0
                                    ? <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid var(--border)', fontSize: '13px' }}>No tasks in progress</div>
                                    : <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>{progressTasks.map(t => <TaskRow key={t.id} t={t} />)}</div>
                                }
                            </div>
                            <div>
                                <SectionHeader icon="✅" label="Completed Tasks" count={completedTasks.length} color="#10b981" bgColor="rgba(16,185,129,0.12)" />
                                {completedTasks.length === 0
                                    ? <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid var(--border)', fontSize: '13px' }}>No completed tasks yet</div>
                                    : <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>{completedTasks.map(t => <TaskRow key={t.id} t={t} />)}</div>
                                }
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {/* ── CRM Pipeline Modal ── */}
            {showCrmModal && (
                <div
                    style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
                    onClick={e => { if (e.target === e.currentTarget) { setShowCrmModal(false); setSelectedCrm(null); } }}
                >
                    <div style={{ background: '#0f1629', border: '1px solid rgba(6,182,212,0.3)', borderRadius: '20px', padding: '28px', width: '100%', maxWidth: '620px', maxHeight: '85vh', overflowY: 'auto', position: 'relative' }}>
                        <button
                            onClick={() => { setShowCrmModal(false); setSelectedCrm(null); }}
                            style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}>✕</button>

                        {selectedCrm ? (
                            /* ── Single Contact Detail ── */
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                                    <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'rgba(6,182,212,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>👤</div>
                                    <div>
                                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#22d3ee' }}>{selectedCrm.name}</div>
                                        <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '2px' }}>📱 {selectedCrm.whatsapp_number || 'N/A'}</div>
                                    </div>
                                    <div style={{ marginLeft: 'auto' }}>
                                        <StageTag stage={selectedCrm.stage} />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
                                    {[
                                        { label: 'Phone', value: selectedCrm.whatsapp_number || 'N/A', icon: '📱' },
                                        { label: 'Stage', value: STAGE_STYLE[selectedCrm.stage]?.label || selectedCrm.stage || 'N/A', icon: '🔗' },
                                        { label: 'Staff', value: selectedCrm.staff ? `[${selectedCrm.staff.staff_code}] ${selectedCrm.staff.name}` : 'Unassigned', icon: '👤' },
                                        { label: 'Added On', value: selectedCrm.created_at ? new Date(selectedCrm.created_at).toLocaleDateString() : 'N/A', icon: '📅' },
                                    ].map((item, i) => (
                                        <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '14px 16px' }}>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>{item.icon} {item.label}</div>
                                            <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>{item.value}</div>
                                        </div>
                                    ))}
                                </div>

                                {selectedCrm.opp && (
                                    <div style={{ background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.2)', borderRadius: '14px', padding: '18px', marginBottom: '16px' }}>
                                        <div style={{ fontSize: '12px', color: '#22d3ee', fontWeight: 700, marginBottom: '12px', textTransform: 'uppercase' }}>🏆 Opportunity</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                            {[
                                                { label: 'Title',     value: selectedCrm.opp.title     || '—' },
                                                { label: 'Task Type', value: selectedCrm.opp.task_type  || '—' },
                                                { label: 'Stage',     value: selectedCrm.opp.stage      || '—' },
                                                { label: 'Status',    value: selectedCrm.opp.status     || '—' },
                                            ].map((f, i) => (
                                                <div key={i}>
                                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '3px' }}>{f.label}</div>
                                                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{f.value}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <button
                                        onClick={() => setSelectedCrm(null)}
                                        style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.3)', color: '#22d3ee', padding: '8px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                                        ← Back to All Contacts
                                    </button>
                                    {role === 'admin' && (
                                        <button
                                            onClick={handleRemoveCrmContact}
                                            disabled={removingCrm}
                                            style={{
                                                background: removingCrm ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.12)',
                                                border: '1px solid rgba(239,68,68,0.35)',
                                                color: '#f87171',
                                                padding: '8px 18px',
                                                borderRadius: '10px',
                                                fontSize: '13px',
                                                fontWeight: 700,
                                                cursor: removingCrm ? 'not-allowed' : 'pointer',
                                                opacity: removingCrm ? 0.6 : 1,
                                                marginLeft: 'auto',
                                            }}
                                        >
                                            {removingCrm ? '⏳ Removing…' : '🗑️ Remove from CRM'}
                                        </button>
                                    )}
                                </div>
                            </>
                        ) : (
                            /* ── All Contacts List ── */
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                                    <div style={{ fontSize: '22px' }}>🔗</div>
                                    <div>
                                        <div style={{ fontSize: '18px', fontWeight: 700 }}>CRM Pipeline</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                            {role === 'staff' ? myCrmContacts.length : crmData.length} contacts
                                        </div>
                                    </div>
                                </div>

                                {(role === 'staff' ? myCrmContacts : crmData).length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                        <div style={{ fontSize: '32px', marginBottom: '10px' }}>📭</div>
                                        <div>No pipeline contacts yet</div>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {(role === 'staff' ? myCrmContacts : crmData).map(c => {
                                            const opp = c.crm_opportunities?.[0] || null;
                                            return (
                                                <div key={c.id}
                                                    onClick={() => setSelectedCrm({ ...c, opp })}
                                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'rgba(6,182,212,0.04)', borderRadius: '12px', border: '1px solid rgba(6,182,212,0.15)', cursor: 'pointer', transition: 'all 0.2s' }}
                                                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(6,182,212,0.4)'; e.currentTarget.style.background = 'rgba(6,182,212,0.08)'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(6,182,212,0.15)'; e.currentTarget.style.background = 'rgba(6,182,212,0.04)'; }}
                                                >
                                                    <div>
                                                        <div style={{ fontWeight: 700, fontSize: '14px' }}>{c.name}</div>
                                                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>📱 {c.whatsapp_number || 'N/A'}</div>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                        <StageTag stage={c.stage} />
                                                        {opp?.task_type && (
                                                            <span style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600 }}>
                                                                {opp.task_type}
                                                            </span>
                                                        )}
                                                        <span style={{ fontSize: '16px', color: 'var(--text-muted)' }}>›</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            <Toast toast={toast} />
        </div>
    );
}
