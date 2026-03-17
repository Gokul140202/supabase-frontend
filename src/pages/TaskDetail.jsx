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
    const [docInputKey, setDocInputKey] = useState(Date.now());

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

    useEffect(() => { fetchTaskDetails(); }, [id, role]);

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
        if (lower === 'in_progress' || lower === 'in-progress') return 'In-Progress';
        if (lower === 'assigned' || lower === 'pending') return 'Pending';
        return 'Pending';
    };

    const taskName = task.task_type || 'Unknown Task';
    const statusName = formatStatus(task.status);
    const allDocuments = task.documents || [];
    const documents = allDocuments.filter(d => d.doc_type !== 'result');
    const resultDocuments = allDocuments.filter(d => d.doc_type === 'result');

    const statusColor = statusName === 'Completed' ? '#10b981' : statusName === 'In-Progress' ? '#6366f1' : '#f59e0b';
    const statusBg   = statusName === 'Completed' ? 'rgba(16,185,129,0.15)' : statusName === 'In-Progress' ? 'rgba(99,102,241,0.15)' : 'rgba(245,158,11,0.15)';

    const formatDate = (dateString) => {
        if (!dateString) return '—';
        try { return new Date(dateString).toLocaleString(); } catch { return dateString; }
    };

    const calculateDuration = (startDate, endDate) => {
        if (!startDate || !endDate || startDate === '—' || endDate === '—') return '—';
        try {
            const diff = Math.abs(new Date(endDate) - new Date(startDate));
            const hours = Math.floor(diff / 3600000);
            const minutes = Math.floor((diff % 3600000) / 60000);
            if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h ${minutes}m`;
            return `${hours}h ${minutes}m`;
        } catch { return '—'; }
    };

    const allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.tif', '.txt', '.csv', '.zip', '.rar', '.tax'];
    const acceptFormats = allowedExtensions.join(',');

    const validateFileFormat = (file) => {
        const ext = '.' + file.name.split('.').pop().toLowerCase();
        if (!allowedExtensions.includes(ext)) {
            showToast('❌', `Invalid file format (${ext}). Allowed: PDF, DOC, XLS, JPG, PNG, ZIP, TAX`);
            return false;
        }
        return true;
    };

    // ─── Download: Supabase public URL direct open ───────────────
    const handleDownload = (fileUrl, fileName) => {
        window.open(fileUrl, '_blank');
    };

    // ─── Upload document (attachment) → Supabase Storage ────────
    const handleUploadDocument = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!validateFileFormat(file)) { e.target.value = ''; setDocInputKey(Date.now()); return; }
        if (file.size > 50 * 1024 * 1024) { showToast('❌', 'File size exceeds 50MB'); return; }

        setUploadingDoc(true);
        try {
            const taskId = task?.id || id;
            await uploadDocument(file, taskId, 'attachment');
            showToast('✅', `Document uploaded: ${file.name}`);
            await fetchTaskDetails(); // refresh so new doc shows in card
        } catch (err) {
            showToast('❌', 'Upload failed: ' + err.message);
        } finally {
            setUploadingDoc(false);
            e.target.value = '';
            setDocInputKey(Date.now());
        }
    };

    // ─── Upload result → Supabase Storage + CRM Webhook ─────────
    const handleUploadResult = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!validateFileFormat(file)) { e.target.value = ''; return; }
        if (file.size > 50 * 1024 * 1024) { showToast('❌', 'File size exceeds 50MB'); return; }

        setUploading(true);
        try {
            const taskId = task?.id || id;

            // ── 1. Upload to Supabase Storage ──────────────────────
            const result = await uploadDocument(file, taskId, 'result');
            showToast('✅', 'Result uploaded successfully!');

            // ── 2. Refresh task data to get latest info ────────────
            await fetchTaskDetails();

            // ── 3. Send webhook to CRM ─────────────────────────────
            const webhookPayload = {
                event:        'result_uploaded',
                task_id:      taskId,
                task_type:    task?.task_type || 'N/A',
                client_id:    task?.clients?.id   || task?.client_id   || null,
                client_name:  task?.clients?.name || task?.client_name || 'N/A',
                mobile_number: task?.clients?.phone || task?.client_phone || 'N/A',
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
                    {
                        method:  'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body:    JSON.stringify(webhookPayload),
                    }
                );
                console.log('✅ CRM webhook sent:', webhookPayload);
            } catch (webhookErr) {
                // Webhook fail ஆனாலும் upload success — silent log
                console.warn('⚠️ CRM webhook failed (upload still saved):', webhookErr.message);
            }

        } catch (err) {
            showToast('❌', 'Upload failed: ' + err.message);
        } finally {
            setUploading(false);
            e.target.value = '';
        }
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
                    {/* ═══ LEFT ═══ */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                        {/* Task Info */}
                        <div className="form-card" style={{ background: 'var(--bg-secondary)', borderTop: '4px solid var(--accent)' }}>
                            <h2 style={{ fontSize: '16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>📌 Task Details</h2>
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

                        {/* Client Info */}
                        <div className="form-card" style={{ background: 'var(--bg-secondary)', borderLeft: '4px solid #10b981' }}>
                            <h2 style={{ fontSize: '16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>👤 Client Information</h2>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                                {[
                                    { label: 'Client ID', value: task.client_code || 'C???', mono: true, accent: '#a5b4fc', bg: 'rgba(99,102,241,0.15)' },
                                    { label: 'Name',      value: task.client_name  || 'N/A' },
                                    { label: 'Phone',     value: task.client_phone || 'N/A', color: '#e879f9' },
                                    { label: 'Email',     value: task.client_email || 'No Email Provided' },
                                ].map((row, i, arr) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                                        <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>{row.label}</span>
                                        {row.bg ? (
                                            <span style={{ fontSize: '14px', fontWeight: 700, background: row.bg, color: row.accent, padding: '2px 10px', borderRadius: '6px' }}>{row.value}</span>
                                        ) : (
                                            <span style={{ fontSize: '14px', fontWeight: 600, color: row.color || 'var(--text-primary)' }}>{row.value}</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* ── Attached Documents ── */}
                        <div className="form-card" style={{ background: 'var(--bg-secondary)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h2 style={{ fontSize: '16px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    📁 Attached Documents
                                    {documents.length > 0 && (
                                        <span style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', padding: '2px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}>
                                            {documents.length}
                                        </span>
                                    )}
                                </h2>

                                {/* Upload button — visible for staff (not admin) when task not completed */}
                                {role !== 'admin' && statusName !== 'Completed' && (
                                    <label style={{ display: 'inline-block' }}>
                                        <input
                                            key={docInputKey}
                                            type="file"
                                            accept={acceptFormats}
                                            onChange={handleUploadDocument}
                                            disabled={uploadingDoc}
                                            style={{ display: 'none' }}
                                        />
                                        <span
                                            className="btn-sm"
                                            style={{
                                                cursor: uploadingDoc ? 'not-allowed' : 'pointer',
                                                opacity: uploadingDoc ? 0.6 : 1,
                                                background: 'rgba(99,102,241,0.15)',
                                                color: '#a5b4fc',
                                                border: '1px solid rgba(99,102,241,0.3)',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                            }}
                                            onClick={() => {
                                                setDocInputKey(Date.now());
                                                setTimeout(() => {
                                                    document.getElementById(`doc-upload-${id}`)?.click();
                                                }, 0);
                                            }}
                                        >
                                            {uploadingDoc ? '⏳ Uploading...' : '📤 Upload Document'}
                                        </span>
                                        <input
                                            id={`doc-upload-${id}`}
                                            type="file"
                                            accept={acceptFormats}
                                            onChange={handleUploadDocument}
                                            disabled={uploadingDoc}
                                            style={{ display: 'none' }}
                                        />
                                    </label>
                                )}

                                {/* Admin can also upload */}
                                {role === 'admin' && (
                                    <label style={{ display: 'inline-block' }}>
                                        <input
                                            key={docInputKey}
                                            type="file"
                                            accept={acceptFormats}
                                            onChange={handleUploadDocument}
                                            disabled={uploadingDoc}
                                            style={{ display: 'none' }}
                                        />
                                        <span
                                            className="btn-sm"
                                            style={{ cursor: uploadingDoc ? 'not-allowed' : 'pointer', opacity: uploadingDoc ? 0.6 : 1 }}
                                            onClick={(e) => { e.currentTarget.previousElementSibling.click(); }}
                                        >
                                            {uploadingDoc ? '⏳ Uploading...' : '📤 Add Document'}
                                        </span>
                                    </label>
                                )}
                            </div>

                            {documents.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px 20px', border: '1px dashed var(--border)', borderRadius: '12px', color: 'var(--text-muted)' }}>
                                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>📂</div>
                                    <div style={{ fontSize: '14px', fontWeight: 600 }}>No files attached yet.</div>
                                    <div style={{ fontSize: '12px', marginTop: '4px' }}>Upload a document using the button above.</div>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
                                    {documents.map((d, i) => {
                                        const ext = (d.file_name || '').split('.').pop().toLowerCase();
                                        const icon = { pdf: '📕', doc: '📘', docx: '📘', xls: '📗', xlsx: '📗', jpg: '🖼️', jpeg: '🖼️', png: '🖼️', zip: '📦', tax: '💸' }[ext] || '📄';
                                        return (
                                            <div key={d.id || i} style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border)', textAlign: 'center', transition: 'all 0.3s' }}
                                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-active)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                                                <div style={{ fontSize: '36px', marginBottom: '12px' }}>{icon}</div>
                                                <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={d.file_name}>
                                                    {d.file_name || 'document'}
                                                </div>
                                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase' }}>{ext} file</div>
                                                <button className="btn-sm green" style={{ width: '100%', fontSize: '12px' }} onClick={() => handleDownload(d.file_url, d.file_name)}>
                                                    ⬇️ Download
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* ── Result Upload ── */}
                        <div className="form-card" style={{ background: 'var(--bg-secondary)', borderLeft: '4px solid #e879f9' }}>
                            <h2 style={{ fontSize: '16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>📤 Task Result</h2>

                            {/* Upload area */}
                            <div style={{ textAlign: 'center', padding: '20px', border: '2px dashed var(--border)', borderRadius: '12px', color: 'var(--text-muted)', marginBottom: resultDocuments.length > 0 ? '20px' : '0' }}>
                                <div style={{ fontSize: '28px', marginBottom: '12px' }}>📁</div>
                                <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>Upload Result File</div>
                                <div style={{ fontSize: '12px', marginBottom: '16px' }}>Upload the completed result document for this task</div>
                                <label style={{ display: 'inline-block' }}>
                                    <input type="file" accept={acceptFormats} onChange={handleUploadResult} disabled={uploading} style={{ display: 'none' }} />
                                    <button className="btn-sm green"
                                        onClick={(e) => { e.preventDefault(); e.currentTarget.previousElementSibling.click(); }}
                                        disabled={uploading}
                                        style={{ cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.6 : 1 }}>
                                        {uploading ? '⏳ Uploading...' : '📄 Choose File'}
                                    </button>
                                </label>
                            </div>

                            {/* Latest result file */}
                            {resultDocuments.length > 0 && (() => {
                                const finalDoc = resultDocuments[resultDocuments.length - 1];
                                const ext = (finalDoc.file_name || '').split('.').pop().toLowerCase();
                                return (
                                    <div style={{ textAlign: 'center', padding: '20px', background: 'rgba(232,121,249,0.1)', borderRadius: '12px', border: '1px solid rgba(232,121,249,0.3)' }}>
                                        <div style={{ fontSize: '28px', marginBottom: '8px' }}>✅</div>
                                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#e879f9', marginBottom: '12px' }}>Result File Ready</div>
                                        <button className="btn-sm green" style={{ width: '100%' }} onClick={() => handleDownload(finalDoc.file_url, finalDoc.file_name)}>
                                            ⬇️ {finalDoc.file_name}
                                        </button>
                                    </div>
                                );
                            })()}

                            {statusName === 'Completed' && task.completed_at && (
                                <div style={{ textAlign: 'center', padding: '16px', background: 'rgba(16,185,129,0.1)', borderRadius: '12px', border: '1px solid rgba(16,185,129,0.3)', marginTop: '16px' }}>
                                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>✅</div>
                                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#10b981', marginBottom: '4px' }}>Task Completed</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Completed on {formatDate(task.completed_at)}</div>
                                </div>
                            )}
                        </div>

                    </div>

                    {/* ═══ RIGHT: Timeline ═══ */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div className="form-card" style={{ background: 'var(--bg-secondary)' }}>
                            <h3 style={{ fontSize: '14px', marginBottom: '20px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>⏰ Timeline</h3>
                            <div style={{ position: 'relative', paddingLeft: '28px' }}>
                                <div style={{ position: 'absolute', left: '7px', top: '8px', bottom: '8px', width: '2px', background: 'linear-gradient(to bottom, #f59e0b, #6366f1, #10b981)', borderRadius: '2px', opacity: 0.3 }} />

                                {[
                                    ...(role !== 'admin' ? [{ label: 'OPENED BY YOU', time: localStorage.getItem(`task_opened_${id}`) || '—', color: '#8b5cf6', active: true }] : []),
                                    { label: 'CREATED',   time: formatDate(task.created_at),   color: '#f59e0b', active: true },
                                    { label: 'ASSIGNED',  time: formatDate(task.assigned_at),  color: '#3b82f6', active: !!task.assigned_at },
                                    { label: 'STARTED',   time: formatDate(task.started_at),   color: '#6366f1', active: !!task.started_at },
                                    { label: 'COMPLETED', time: formatDate(task.completed_at), color: '#10b981', active: statusName === 'Completed' },
                                    ...(statusName === 'Completed' && task.started_at && task.completed_at
                                        ? [{ label: 'DURATION', time: calculateDuration(task.started_at, task.completed_at), color: '#e879f9', active: true }]
                                        : []),
                                ].map((step, i) => (
                                    <div key={i} style={{ marginBottom: i < 4 ? '22px' : 0, opacity: step.active ? 1 : 0.35 }}>
                                        <div style={{ position: 'absolute', left: '0', width: '16px', height: '16px', borderRadius: '50%', background: step.active ? step.color : 'var(--bg-card)', border: `2px solid ${step.active ? step.color : 'var(--border)'}`, marginTop: `${i * 44}px`, boxShadow: step.active ? `0 0 10px ${step.color}40` : 'none' }} />
                                        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.6px', color: step.active ? step.color : 'var(--text-muted)' }}>{step.label}</div>
                                        <div style={{ fontSize: '13px', fontWeight: 600, color: step.active ? 'var(--text-primary)' : 'var(--text-muted)', marginTop: '2px' }}>{step.time && step.time !== '—' ? step.time : '—'}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Assigned Staff */}
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

                        {/* Documents Summary */}
                        <div className="form-card" style={{ background: 'var(--bg-secondary)' }}>
                            <h3 style={{ fontSize: '14px', marginBottom: '16px', color: 'var(--text-secondary)' }}>📊 Summary</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {[
                                    { label: 'Attachments', value: documents.length, icon: '📁', color: '#a5b4fc' },
                                    { label: 'Result Files', value: resultDocuments.length, icon: '📋', color: '#e879f9' },
                                    { label: 'Total Files', value: allDocuments.length, icon: '🗂️', color: '#34d399' },
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