import { useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import useToast from '../hooks/useToast';
import Toast from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import { apiFetch, uploadDocument } from '../api';

export default function TaskDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { role } = useAuth();
    const { toast, showToast } = useToast();
    const [task, setTask] = useState(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [uploadingDoc, setUploadingDoc] = useState(false);
    const [completing, setCompleting] = useState(false);
    const [docInputKey, setDocInputKey] = useState(Date.now());

    // ── Inline edit states ────────────────────────────────────────────────────
    const [editingClientName, setEditingClientName] = useState(false);
    const [clientNameVal, setClientNameVal] = useState('');
    const [savingClientName, setSavingClientName] = useState(false);
    const [editingFileId, setEditingFileId] = useState(null);
    const [fileNameVal, setFileNameVal] = useState('');
    const [savingFileId, setSavingFileId] = useState(null);

    const fetchTaskDetails = async () => {
        setLoading(true);
        try {
            const endpoint = role === 'admin' ? `/admin/tasks/${id}` : `/staff/tasks/${id}`;
            const data = await apiFetch(endpoint);
            if (data.success && data.data) {
                setTask(data.data);
                if (role !== 'admin') {
                    localStorage.setItem(`task_opened_${id}`, new Date().toLocaleString());
                }
            }
        } catch (err) {
            showToast('❌', 'Failed to load task details');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveClientName = async () => {
        if (!clientNameVal.trim() || savingClientName) return;
        setSavingClientName(true);
        try {
            const clientId = task?.clients?.id || task?.client_id_raw;
            if (!clientId) throw new Error('Client ID not found');
            await apiFetch(`/clients/${clientId}/name`, {
                method: 'PATCH',
                body: JSON.stringify({ name: clientNameVal.trim() }),
            });
            setEditingClientName(false);
            showToast('✅', 'Client name updated!');
            await fetchTaskDetails();
        } catch (err) {
            showToast('❌', 'Failed: ' + err.message);
        } finally {
            setSavingClientName(false);
        }
    };

    const handleSaveFileName = async (docId) => {
        if (!fileNameVal.trim() || savingFileId) return;
        setSavingFileId(docId);
        try {
            await apiFetch(`/documents/${docId}/filename`, {
                method: 'PATCH',
                body: JSON.stringify({ file_name: fileNameVal.trim() }),
            });
            setEditingFileId(null);
            showToast('✅', 'File name updated!');
            await fetchTaskDetails();
        } catch (err) {
            showToast('❌', 'Failed: ' + err.message);
        } finally {
            setSavingFileId(null);
        }
    };

    useEffect(() => { fetchTaskDetails(); }, [id, role]);

    if (loading) return (
        <div className="app-layout"><Sidebar />
            <div className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
                <div style={{ fontSize: '18px', color: 'var(--text-secondary)' }}>⏳ Loading Task Details...</div>
            </div>
        </div>
    );

    if (!task) return (
        <div className="app-layout"><Sidebar />
            <div className="main-content">
                <div style={{ padding: '40px', textAlign: 'center' }}>
                    <h2>Task not found</h2>
                    <button className="btn-primary" style={{ margin: '20px auto' }} onClick={() => navigate('/tasks')}>Back to Tasks</button>
                </div>
            </div>
        </div>
    );

    const formatStatus = (s) => {
        if (!s) return 'Pending';
        const lower = s.toLowerCase();
        if (lower === 'completed') return 'Completed';
        if (lower === 'in_progress' || lower === 'in-progress') return 'In-Progress';
        if (lower === 'assigned' || lower === 'pending') return 'Pending';
        return 'Pending';
    };

    const taskName        = task.task_type || 'Unknown Task';
    const statusName      = formatStatus(task.status);
    const taskSource      = task.source || 'crm';
    const allDocuments    = task.documents || [];
    // ── CHANGE: CRM docs + staff docs ஒரே section-ல (result மட்டும் தனியா) ──
    const documents       = allDocuments.filter(d => d.doc_type !== 'result');   // attachment + CRM docs both
    const crmDocuments    = allDocuments.filter(d => d.doc_type !== 'result' && d.doc_type !== 'attachment'); // summary-க்காக மட்டும்
    const resultDocuments = allDocuments.filter(d => d.doc_type === 'result');

    const statusColor = statusName === 'Completed' ? '#10b981' : statusName === 'In-Progress' ? '#6366f1' : '#f59e0b';
    const statusBg    = statusName === 'Completed' ? 'rgba(16,185,129,0.15)' : statusName === 'In-Progress' ? 'rgba(99,102,241,0.15)' : 'rgba(245,158,11,0.15)';

    const formatDate = (d) => { if (!d) return '—'; try { return new Date(d).toLocaleString(); } catch { return d; } };
    const calcDuration = (s, e) => {
        if (!s || !e) return '—';
        try {
            const diff = Math.abs(new Date(e) - new Date(s));
            const h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000);
            return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h ${m}m` : `${h}h ${m}m`;
        } catch { return '—'; }
    };

    const allowedExt = ['.pdf','.doc','.docx','.xls','.xlsx','.jpg','.jpeg','.png','.gif','.bmp','.tiff','.tif','.txt','.csv','.zip','.rar','.tax'];
    const acceptFormats = allowedExt.join(',');
    const validateFile = (file) => {
        const ext = '.' + file.name.split('.').pop().toLowerCase();
        if (!allowedExt.includes(ext)) { showToast('❌', `Invalid format (${ext})`); return false; }
        return true;
    };

    const handleUploadDocument = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !validateFile(file)) { e.target.value = ''; setDocInputKey(Date.now()); return; }
        if (file.size > 50 * 1024 * 1024) { showToast('❌', 'File size exceeds 50MB'); return; }
        setUploadingDoc(true);
        try {
            await uploadDocument(file, task?.id || id, 'attachment');
            showToast('✅', `Document uploaded: ${file.name}`);
            await fetchTaskDetails();
        } catch (err) { showToast('❌', 'Upload failed: ' + err.message); }
        finally { setUploadingDoc(false); e.target.value = ''; setDocInputKey(Date.now()); }
    };

    const handleUploadResult = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !validateFile(file)) { e.target.value = ''; return; }
        if (file.size > 50 * 1024 * 1024) { showToast('❌', 'File size exceeds 50MB'); return; }
        setUploading(true);
        try {
            const taskUUID = task?.id || id;
            const result = await uploadDocument(file, taskUUID, 'result');
            showToast('✅', 'Result uploaded successfully!');
            await fetchTaskDetails();

            const webhookPayload = {
                event:         'result_uploaded',
                task_id:       task.task_code   || taskUUID,
                client_id:     task.client_code || task.client_id,
                task_type:     task.task_type   || 'N/A',
                client_name:   task.client_name  || 'N/A',
                mobile_number: task.client_phone || 'N/A',
                document: {
                    file_name: file.name,
                    file_size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
                    file_type: file.type || file.name.split('.').pop(),
                    doc_type:  'result',
                    url:       result.file_url,
                },
                uploaded_at: new Date().toISOString(),
            };

            try {
                await fetch(
                    'https://services.leadconnectorhq.com/hooks/GmLfYZp3rjJ0jWt1nZtb/webhook-trigger/c8acafca-2d52-4f75-a8b9-31b783957fdb',
                    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(webhookPayload) }
                );
                console.log('✅ CRM webhook → task_id:', webhookPayload.task_id, 'client_id:', webhookPayload.client_id);
            } catch (wErr) { console.warn('⚠️ CRM webhook failed:', wErr.message); }

        } catch (err) { showToast('❌', 'Upload failed: ' + err.message); }
        finally { setUploading(false); e.target.value = ''; }
    };

    const handleAdminComplete = async () => {
        if (!confirm('Mark this task as Completed?')) return;
        setCompleting(true);
        try {
            const res = await apiFetch('/admin/tasks/complete', { method: 'PATCH', body: JSON.stringify({ taskId: task.id }) });
            if (res.success) { showToast('✅', 'Task marked as Completed!'); await fetchTaskDetails(); }
            else if (res.code === 'CRM_TASK_LOCKED') showToast('⚠️', 'CRM tasks cannot be manually completed.', true);
            else showToast('❌', res.error || 'Failed', true);
        } catch (err) { showToast('❌', 'Failed: ' + err.message, true); }
        finally { setCompleting(false); }
    };

    const docIcon = (name) => ({ pdf:'📕',doc:'📘',docx:'📘',xls:'📗',xlsx:'📗',jpg:'🖼️',jpeg:'🖼️',png:'🖼️',zip:'📦',tax:'💸' })[(name||'').split('.').pop().toLowerCase()] || '📄';

    const openFile = (url, name) => {
        if (!url || url === '[]' || url === '' || url === 'null' || url.startsWith('[')) {
            showToast('❌', `"${name}" — file URL invalid. CRM-ல file properly attach பண்ணி retry பண்ணுங்க.`);
            return;
        }
        window.open(url, '_blank');
    };

    return (
        <div className="app-layout">
            <Sidebar />
            <div className="main-content">
                {/* TOPBAR */}
                <div className="topbar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                        <button className="btn-sm" onClick={() => navigate('/tasks')}>← Back</button>
                        <h1 className="topbar-title">📋 {taskName}</h1>
                        <span style={{ background: taskSource === 'admin' ? 'rgba(99,102,241,0.15)' : 'rgba(245,158,11,0.15)', color: taskSource === 'admin' ? '#a5b4fc' : '#fbbf24', padding: '3px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 700 }}>
                            {taskSource === 'admin' ? '🏢 Admin' : '🔗 CRM'}
                        </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ background: statusBg, color: statusColor, padding: '6px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, border: `1px solid ${statusColor}30` }}>{statusName}</span>
                        {role === 'admin' && taskSource === 'admin' && statusName !== 'Completed' && (
                            <button className="btn-sm green" onClick={handleAdminComplete} disabled={completing} style={{ padding: '8px 16px', fontWeight: 700, opacity: completing ? 0.6 : 1 }}>
                                {completing ? '⏳...' : '✅ Mark Complete'}
                            </button>
                        )}
                    </div>
                </div>

                <div className="page-content" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>
                    {/* LEFT */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                                  

                        {/* Task Info */}
                        <div className="form-card" style={{ background: 'var(--bg-secondary)', borderTop: '4px solid var(--accent)' }}>
                            <h2 style={{ fontSize: '16px', marginBottom: '20px' }}>📌 Task Details</h2>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                {[
                                    { label: 'Task Name',  value: taskName },
                                    { label: 'Task ID',    value: task.task_code || task.id, mono: true, bg: 'rgba(99,102,241,0.15)', accent: '#a5b4fc' },
                                    { label: 'Status',     value: statusName, color: statusColor },
                                    { label: 'Source',     value: taskSource === 'admin' ? '🏢 Admin Created' : '🔗 CRM', color: taskSource === 'admin' ? '#a5b4fc' : '#fbbf24' },
                                    { label: 'Notes',      value: task.notes || 'No additional notes', span: true },
                                ].map((row, i) => (
                                    <div key={i} style={row.span ? { gridColumn: '1/-1' } : {}}>
                                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '4px' }}>{row.label}</div>
                                        {row.bg
                                            ? <span style={{ background: row.bg, color: row.accent, padding: '3px 10px', borderRadius: '6px', fontSize: '13px', fontWeight: 700, fontFamily: row.mono ? 'monospace' : 'inherit' }}>{row.value}</span>
                                            : <div style={{ fontSize: '14px', fontWeight: 600, color: row.color || 'var(--text-primary)' }}>{row.value}</div>
                                        }
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Client Info */}
                        <div className="form-card" style={{ background: 'var(--bg-secondary)', borderLeft: '4px solid #10b981' }}>
                            <h2 style={{ fontSize: '16px', marginBottom: '20px' }}>👤 Client Information</h2>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>

                                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>Client ID</span>
                                    <span style={{ fontSize: '14px', fontWeight: 700, background: 'rgba(16,185,129,0.15)', color: '#34d399', padding: '2px 10px', borderRadius: '6px', fontFamily: 'monospace' }}>
                                        {task.client_code || task.client_id || 'N/A'}
                                    </span>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>Name</span>
                                    {editingClientName ? (
                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                            <input
                                                autoFocus
                                                value={clientNameVal}
                                                onChange={e => setClientNameVal(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter') handleSaveClientName(); if (e.key === 'Escape') setEditingClientName(false); }}
                                                style={{ background: 'var(--bg-card)', border: '1px solid var(--accent)', borderRadius: '8px', padding: '4px 10px', color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600, width: '180px', outline: 'none' }}
                                            />
                                            <button className="btn-sm green" onClick={handleSaveClientName} disabled={savingClientName} style={{ padding: '4px 10px', fontSize: '12px' }}>
                                                {savingClientName ? '⏳' : '✅'}
                                            </button>
                                            <button className="btn-sm" onClick={() => setEditingClientName(false)} style={{ padding: '4px 10px', fontSize: '12px' }}>✕</button>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{task.client_name || 'N/A'}</span>
                                            <button onClick={() => { setClientNameVal(task.client_name || ''); setEditingClientName(true); }}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--text-muted)', padding: '2px 4px', borderRadius: '4px' }}
                                                title="Edit name">✏️</button>
                                        </div>
                                    )}
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>Phone</span>
                                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#e879f9' }}>{task.client_phone || 'N/A'}</span>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>Email</span>
                                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{task.client_email || 'No Email Provided'}</span>
                                </div>

                            </div>
                        </div>

                        {/* Attached Documents — CRM docs + staff docs ஒரே section-ல */}
                        <div className="form-card" style={{ background: 'var(--bg-secondary)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h2 style={{ fontSize: '16px', margin: 0 }}>
                                    📁 Attached Documents
                                    {documents.length > 0 && <span style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', padding: '2px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, marginLeft: '8px' }}>{documents.length}</span>}
                                </h2>
                                {/* Single hidden input, span directly clicks it */}
                                <input
                                    key={docInputKey}
                                    id={`doc-upload-${id}`}
                                    type="file"
                                    accept={acceptFormats}
                                    onChange={handleUploadDocument}
                                    disabled={uploadingDoc}
                                    style={{ display: 'none' }}
                                />
                                <span
                                    className="btn-sm"
                                    style={{ cursor: uploadingDoc ? 'not-allowed' : 'pointer', opacity: uploadingDoc ? 0.6 : 1, background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }}
                                    onClick={() => { if (!uploadingDoc) document.getElementById(`doc-upload-${id}`)?.click(); }}
                                >
                                    {uploadingDoc ? '⏳ Uploading...' : '📤 Upload Document'}
                                </span>
                            </div>
                            {documents.length === 0
                                ? <div style={{ textAlign: 'center', padding: '40px', border: '1px dashed var(--border)', borderRadius: '12px', color: 'var(--text-muted)' }}><div style={{ fontSize: '32px', marginBottom: '8px' }}>📂</div><div>No files attached yet.</div></div>
                                : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
                                    {documents.map((d, i) => {
                                        const isCrm = d.doc_type !== 'attachment';
                                        const isInvalidUrl = !d.file_url || d.file_url === '[]' || d.file_url.startsWith('[');
                                        return (
                                            <div key={d.id || i} style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border)', textAlign: 'center', transition: 'all 0.3s' }}
                                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-active)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                                                <div style={{ fontSize: '36px', marginBottom: '12px' }}>{isInvalidUrl ? '⚠️' : docIcon(d.file_name)}</div>

                                                {/* File name — inline editable (CRM docs-க்கும் attachment-க்கும்) */}
                                                {editingFileId === d.id ? (
                                                    <div style={{ marginBottom: '8px' }}>
                                                        <input
                                                            autoFocus
                                                            value={fileNameVal}
                                                            onChange={e => setFileNameVal(e.target.value)}
                                                            onKeyDown={e => { if (e.key === 'Enter') handleSaveFileName(d.id); if (e.key === 'Escape') setEditingFileId(null); }}
                                                            style={{ background: 'var(--bg-card)', border: '1px solid var(--accent)', borderRadius: '6px', padding: '4px 6px', color: 'var(--text-primary)', fontSize: '11px', width: '100%', outline: 'none', textAlign: 'center' }}
                                                        />
                                                        <div style={{ display: 'flex', gap: '4px', marginTop: '6px', justifyContent: 'center' }}>
                                                            <button className="btn-sm green" onClick={() => handleSaveFileName(d.id)} disabled={savingFileId === d.id} style={{ padding: '3px 8px', fontSize: '11px' }}>
                                                                {savingFileId === d.id ? '⏳' : '✅'}
                                                            </button>
                                                            <button className="btn-sm" onClick={() => setEditingFileId(null)} style={{ padding: '3px 8px', fontSize: '11px' }}>✕</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '4px' }}>
                                                        <div style={{ fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }} title={d.file_name}>{d.file_name || 'document'}</div>
                                                        <button onClick={() => { setFileNameVal(d.file_name || ''); setEditingFileId(d.id); }}
                                                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: 'var(--text-muted)', padding: '1px 2px', flexShrink: 0 }}
                                                            title="Rename">✏️</button>
                                                    </div>
                                                )}

                                                {/* CRM / Staff badge */}
                                                <div style={{ fontSize: '10px', marginBottom: '12px', fontWeight: 600, color: isInvalidUrl ? '#ef4444' : isCrm ? '#fbbf24' : 'var(--text-muted)', textTransform: 'uppercase' }}>
                                                    {isInvalidUrl ? '❌ Invalid URL' : isCrm ? '🔗 CRM' : `${(d.file_name||'').split('.').pop()} file`}
                                                </div>

                                                <button
                                                    className="btn-sm green"
                                                    style={{ width: '100%', fontSize: '12px', ...(isInvalidUrl ? { background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' } : {}) }}
                                                    onClick={() => openFile(d.file_url, d.file_name)}
                                                >
                                                    {isInvalidUrl ? '⚠️ Invalid' : '⬇️ Download'}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            }
                        </div>

                        
                        {taskSource === 'crm' && (
                            <div className="form-card" style={{ background: 'var(--bg-secondary)', borderLeft: '4px solid #e879f9' }}>
                                <h2 style={{ fontSize: '16px', marginBottom: '20px' }}>📤 Task Result</h2>
                                <div style={{ textAlign: 'center', padding: '20px', border: '2px dashed var(--border)', borderRadius: '12px', color: 'var(--text-muted)', marginBottom: resultDocuments.length > 0 ? '20px' : '0' }}>
                                    <div style={{ fontSize: '28px', marginBottom: '12px' }}>📁</div>
                                    <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>Upload Result File</div>
                                    <label>
                                        <input type="file" accept={acceptFormats} onChange={handleUploadResult} disabled={uploading} style={{ display: 'none' }} />
                                        <button className="btn-sm green" onClick={e => { e.preventDefault(); e.currentTarget.previousElementSibling.click(); }} disabled={uploading} style={{ cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.6 : 1 }}>
                                            {uploading ? '⏳ Uploading...' : '📄 Choose File'}
                                        </button>
                                    </label>
                                </div>
                                {resultDocuments.length > 0 && (() => {
                                    const d = resultDocuments[resultDocuments.length - 1];
                                    return (
                                        <div style={{ textAlign: 'center', padding: '20px', background: 'rgba(232,121,249,0.1)', borderRadius: '12px', border: '1px solid rgba(232,121,249,0.3)' }}>
                                            <div style={{ fontSize: '28px', marginBottom: '8px' }}>✅</div>
                                            <div style={{ fontSize: '14px', fontWeight: 700, color: '#e879f9', marginBottom: '12px' }}>Result File Ready</div>
                                            <button className="btn-sm green" style={{ width: '100%' }} onClick={() => openFile(d.file_url, d.file_name)}>⬇️ {d.file_name}</button>
                                        </div>
                                    );
                                })()}
                                {statusName === 'Completed' && task.completed_at && (
                                    <div style={{ textAlign: 'center', padding: '16px', background: 'rgba(16,185,129,0.1)', borderRadius: '12px', border: '1px solid rgba(16,185,129,0.3)', marginTop: '16px' }}>
                                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#10b981' }}>✅ Completed on {formatDate(task.completed_at)}</div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Admin task completed */}
                        {taskSource === 'admin' && statusName === 'Completed' && (
                            <div className="form-card" style={{ background: 'var(--bg-secondary)', borderLeft: '4px solid #10b981' }}>
                                <div style={{ textAlign: 'center', padding: '24px' }}>
                                    <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
                                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#10b981', marginBottom: '6px' }}>Task Completed</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Completed on {formatDate(task.completed_at)}</div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RIGHT */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div className="form-card" style={{ background: 'var(--bg-secondary)' }}>
                            <h3 style={{ fontSize: '14px', marginBottom: '20px', color: 'var(--text-secondary)' }}>⏰ Timeline</h3>
                            <div style={{ position: 'relative', paddingLeft: '28px' }}>
                                <div style={{ position: 'absolute', left: '7px', top: '8px', bottom: '8px', width: '2px', background: 'linear-gradient(to bottom, #f59e0b, #6366f1, #10b981)', borderRadius: '2px', opacity: 0.3 }} />
                                {[
                                    ...(role !== 'admin' ? [{ label: 'OPENED BY YOU', time: localStorage.getItem(`task_opened_${id}`) || '—', color: '#8b5cf6', active: true }] : []),
                                    { label: 'CREATED',   time: formatDate(task.created_at),   color: '#f59e0b', active: true },
                                    { label: 'ASSIGNED',  time: formatDate(task.assigned_at),  color: '#3b82f6', active: !!task.assigned_at },
                                    { label: 'STARTED',   time: formatDate(task.started_at),   color: '#6366f1', active: !!task.started_at },
                                    { label: 'COMPLETED', time: formatDate(task.completed_at), color: '#10b981', active: statusName === 'Completed' },
                                    ...(statusName === 'Completed' && task.started_at && task.completed_at
                                        ? [{ label: 'DURATION', time: calcDuration(task.started_at, task.completed_at), color: '#e879f9', active: true }] : []),
                                ].map((step, i) => (
                                    <div key={i} style={{ marginBottom: i < 4 ? '22px' : 0, opacity: step.active ? 1 : 0.35 }}>
                                        <div style={{ position: 'absolute', left: '0', width: '16px', height: '16px', borderRadius: '50%', background: step.active ? step.color : 'var(--bg-card)', border: `2px solid ${step.active ? step.color : 'var(--border)'}`, marginTop: `${i * 44}px`, boxShadow: step.active ? `0 0 10px ${step.color}40` : 'none' }} />
                                        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.6px', color: step.active ? step.color : 'var(--text-muted)' }}>{step.label}</div>
                                        <div style={{ fontSize: '13px', fontWeight: 600, color: step.active ? 'var(--text-primary)' : 'var(--text-muted)', marginTop: '2px' }}>{step.time && step.time !== '—' ? step.time : '—'}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="form-card" style={{ background: 'var(--bg-secondary)' }}>
                            <h3 style={{ fontSize: '14px', marginBottom: '16px', color: 'var(--text-secondary)' }}>👤 Assigned Staff</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: '14px', border: '1px solid var(--border)' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, var(--accent), #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 800, color: '#fff' }}>
                                    {typeof task.staff_name === 'string' ? task.staff_name.charAt(0) : '?'}
                                </div>
                                <div>
                                    <div style={{ fontSize: '14px', fontWeight: 700 }}>{task.staff_name || 'Unassigned'}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Team Member</div>
                                </div>
                            </div>
                        </div>

                        <div className="form-card" style={{ background: 'var(--bg-secondary)' }}>
                            <h3 style={{ fontSize: '14px', marginBottom: '16px', color: 'var(--text-secondary)' }}>📊 Summary</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {[
                                    { label: 'CRM Docs',    value: crmDocuments.length,    icon: '🔗', color: '#fbbf24' },
                                    { label: 'Attachments', value: documents.length - crmDocuments.length, icon: '📁', color: '#a5b4fc' },
                                    { label: 'Result Files', value: resultDocuments.length, icon: '📋', color: '#e879f9' },
                                ].map((s, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{s.icon} {s.label}</span>
                                        <span style={{ fontSize: '16px', fontWeight: 800, color: s.color }}>{s.value}</span>
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