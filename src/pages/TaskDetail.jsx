import { useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import useToast from '../hooks/useToast';
import Toast from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch, uploadDocument, supabase } from '../api';

const WEBHOOK_IN_PROGRESS = 'https://services.leadconnectorhq.com/hooks/GmLfYZp3rjJ0jWt1nZtb/webhook-trigger/8d35401e-f610-49fe-ab54-780883429d16';
const WEBHOOK_RESULT       = 'https://services.leadconnectorhq.com/hooks/GmLfYZp3rjJ0jWt1nZtb/webhook-trigger/c8acafca-2d52-4f75-a8b9-31b783957fdb';

export default function TaskDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { role } = useAuth();
    const { toast, showToast } = useToast();

    const [task, setTask]                           = useState(null);
    const [loading, setLoading]                     = useState(true);
    const [uploading, setUploading]                 = useState(false);
    const [uploadingDoc, setUploadingDoc]           = useState(false);
    const [completing, setCompleting]               = useState(false);
    const [docInputKey, setDocInputKey]             = useState(Date.now());
    const [clientDocs, setClientDocs]               = useState([]);
    const [clientDocsLoading, setClientDocsLoading] = useState(false);
    const [editingClientName, setEditingClientName] = useState(false);
    const [clientNameVal, setClientNameVal]         = useState('');
    const [savingClientName, setSavingClientName]   = useState(false);
    const [editingFileId, setEditingFileId]         = useState(null);
    const [fileNameVal, setFileNameVal]             = useState('');
    const [savingFileId, setSavingFileId]           = useState(null);
    const [clientNotes, setClientNotes]             = useState('');
    const [editingNotes, setEditingNotes]           = useState(false);
    const [notesVal, setNotesVal]                   = useState('');
    const [savingNotes, setSavingNotes]             = useState(false);

    // ── This ref prevents duplicate in_progress trigger ──────────────────
    const inProgressDone = useRef(false);

    const formatStatus = (s) => {
        if (!s) return 'Pending';
        const l = s.toLowerCase();
        if (l === 'completed') return 'Completed';
        if (l === 'in_progress' || l === 'in-progress') return 'In-Progress';
        return 'Pending';
    };
    const formatDate = (d) => { if (!d) return '—'; try { return new Date(d).toLocaleString(); } catch { return d; } };
    const calcDuration = (s, e) => {
        if (!s || !e) return '—';
        try {
            const diff = Math.abs(new Date(e) - new Date(s));
            const h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000);
            return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h ${m}m` : `${h}h ${m}m`;
        } catch { return '—'; }
    };
    const allowedExt    = ['.pdf','.doc','.docx','.xls','.xlsx','.jpg','.jpeg','.png','.gif','.bmp','.tiff','.tif','.txt','.csv','.zip','.rar','.tax'];
    const acceptFormats = allowedExt.join(',');
    const validateFile  = (file) => {
        const ext = '.' + file.name.split('.').pop().toLowerCase();
        if (!allowedExt.includes(ext)) { showToast('❌', `Invalid format (${ext})`); return false; }
        return true;
    };
    const docIcon  = (name) => ({ pdf:'📕',doc:'📘',docx:'📘',xls:'📗',xlsx:'📗',jpg:'🖼️',jpeg:'🖼️',png:'🖼️',zip:'📦',tax:'💸' })[(name||'').split('.').pop().toLowerCase()] || '📄';
    const openFile = (url, name) => {
        if (!url || url === '[]' || url === 'null' || url.startsWith('[')) { showToast('❌', `"${name}" — file URL invalid.`); return; }
        const a = document.createElement('a'); a.href = url; a.download = name || 'document'; a.target = '_blank'; a.rel = 'noreferrer';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    };

    const fetchClientDocs = async (clientId) => {
        if (!clientId) return;
        setClientDocsLoading(true);
        try {
            const { data, error } = await supabase.from('client_documents').select('*').eq('client_id', clientId).order('created_at', { ascending: false });
            if (!error && data) setClientDocs(data);
        } finally { setClientDocsLoading(false); }
    };

    const fetchClientNotes = async (clientId) => {
        if (!clientId) return;
        try {
            const { data } = await supabase.from('clients').select('notes').eq('id', clientId).maybeSingle();
            const n = data?.notes || ''; setClientNotes(n); setNotesVal(n);
        } catch {}
    };

    const fetchTaskDetails = useCallback(async () => {
        setLoading(true);
        try {
            const endpoint = role === 'admin' ? `/admin/tasks/${id}` : `/staff/tasks/${id}`;
            const data = await apiFetch(endpoint);
            if (data.success && data.data) {
                setTask(data.data);
                const clientId = data.data.clients?.id || data.data.client_id_raw || data.data.client_id;
                if (clientId) { fetchClientDocs(clientId); fetchClientNotes(clientId); }
            }
        } catch { showToast('❌', 'Failed to load task details'); }
        finally { setLoading(false); }
    }, [id, role]);

    useEffect(() => { fetchTaskDetails(); }, [fetchTaskDetails]);

    // ── STAFF: task open → in_progress + webhook (ONCE, tracked by DB flag) ─
    useEffect(() => {
        if (!task || role === 'admin') return;
        if (inProgressDone.current) return; // session-level lock

        // Already completed → skip everything
        if (task.status === 'completed') {
            inProgressDone.current = true;
            return;
        }

        // Webhook already sent for this task → skip
        if (task.inprogress_webhook_sent) {
            inProgressDone.current = true;
            return;
        }

        inProgressDone.current = true; // lock immediately to prevent double-fire

        (async () => {
            try {
                const needsStatusUpdate = task.status !== 'in_progress';

                // Step 1: Update status to in_progress (if not already) + mark webhook sent
                const dbUpdates = { inprogress_webhook_sent: true };
                if (needsStatusUpdate) {
                    dbUpdates.status = 'in_progress';
                    dbUpdates.started_at = new Date().toISOString();
                }

                const { error: updateError } = await supabase
                    .from('tasks')
                    .update(dbUpdates)
                    .eq('id', task.id);

                if (updateError) {
                    console.warn('⚠️ DB update failed:', updateError.message);
                } else {
                    console.log('✅ Status → in_progress, inprogress_webhook_sent = true');
                }

                // Step 2: Fire webhook
                try {
                    const webhookRes = await fetch(WEBHOOK_IN_PROGRESS, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            event:         'task_status_changed_to_in_progress',
                            triggered_by:  'staff',
                            task_id:       task.task_code || task.id,
                            client_id:     task.client_code || task.client_id_raw || '',
                            client_name:   task.client_name || '',
                            task_type:     task.task_type || '',
                            staff_name:    task.staff_name || '',
                            mobile_number: task.client_phone || '',
                            changed_at:    new Date().toISOString(),
                        }),
                    });
                    console.log('✅ in_progress webhook sent, status:', webhookRes.status);
                } catch (webhookErr) {
                    console.warn('⚠️ Webhook fire failed:', webhookErr.message);
                }

                // Step 3: Refresh task details
                await fetchTaskDetails();

            } catch (e) {
                console.warn('in_progress flow error:', e.message);
            }
        })();
    }, [task?.id]);

    const handleAdminStatusChange = async (newStatus) => {
        if (completing) return;
        setCompleting(true);
        try {
            const statusMap = { 'Pending': 'assigned', 'In-Progress': 'in_progress', 'Completed': 'completed' };
            const res = await apiFetch('/admin/tasks/changestatus', { method: 'PATCH', body: JSON.stringify({ taskId: task.id, status: statusMap[newStatus] }) });
            if (res.success) { showToast('✅', `Status → ${newStatus}`); await fetchTaskDetails(); }
            else showToast('❌', res.error || 'Failed', true);
        } catch (err) { showToast('❌', 'Failed: ' + err.message, true); }
        finally { setCompleting(false); }
    };

    const handleSaveClientName = async () => {
        if (!clientNameVal.trim() || savingClientName) return;
        setSavingClientName(true);
        try {
            const clientId = task?.clients?.id || task?.client_id_raw;
            if (!clientId) throw new Error('Client ID not found');
            await apiFetch(`/clients/${clientId}/name`, { method: 'PATCH', body: JSON.stringify({ name: clientNameVal.trim() }) });
            setEditingClientName(false); showToast('✅', 'Client name updated!'); await fetchTaskDetails();
        } catch (err) { showToast('❌', 'Failed: ' + err.message); }
        finally { setSavingClientName(false); }
    };

    const handleSaveFileName = async (docId) => {
        if (!fileNameVal.trim() || savingFileId) return;
        setSavingFileId(docId);
        try {
            await apiFetch(`/documents/${docId}/filename`, { method: 'PATCH', body: JSON.stringify({ file_name: fileNameVal.trim() }) });
            setEditingFileId(null); showToast('✅', 'File name updated!'); await fetchTaskDetails();
        } catch (err) { showToast('❌', 'Failed: ' + err.message); }
        finally { setSavingFileId(null); }
    };

    const handleSaveNotes = async () => {
        if (savingNotes) return;
        setSavingNotes(true);
        try {
            const clientId = task?.clients?.id || task?.client_id_raw || task?.client_id;
            if (!clientId) throw new Error('Client ID not found');
            const { error } = await supabase.from('clients').update({ notes: notesVal.trim(), updated_at: new Date().toISOString() }).eq('id', clientId);
            if (error) throw new Error(error.message);
            setClientNotes(notesVal.trim()); setEditingNotes(false); showToast('✅', 'Notes saved!');
        } catch (err) { showToast('❌', 'Failed: ' + err.message); }
        finally { setSavingNotes(false); }
    };

    const handleUploadDocument = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !validateFile(file)) { e.target.value = ''; setDocInputKey(Date.now()); return; }
        if (file.size > 50 * 1024 * 1024) { showToast('❌', 'File size exceeds 50MB'); return; }
        setUploadingDoc(true);
        try {
            const clientId = task?.clients?.id || task?.client_id_raw || task?.client_id;
            if (!clientId) throw new Error('Client ID not found');
            const ext = file.name.split('.').pop();
            const storagePath = `clients/${clientId}/manual_${Date.now()}.${ext}`;
            const { error: storageError } = await supabase.storage.from('task-documents').upload(storagePath, file, { upsert: true });
            if (storageError) throw new Error('Storage upload failed: ' + storageError.message);
            const { data: { publicUrl } } = supabase.storage.from('task-documents').getPublicUrl(storagePath);
            const lower = file.name.toLowerCase();
            let docType = 'Document';
            if (lower.includes('aadhaar') || lower.includes('aadhar')) docType = 'Aadhaar Card';
            else if (lower.includes('pan')) docType = 'PAN Card';
            else if (lower.includes('salary') || lower.includes('payslip')) docType = 'Salary Slip';
            else if (lower.includes('bank') || lower.includes('statement')) docType = 'Bank Statement';
            else if (lower.includes('itr') || lower.includes('income')) docType = 'ITR';
            else if (lower.includes('gst')) docType = 'GST Document';
            else if (lower.includes('form16') || lower.includes('form_16')) docType = 'Form 16';
            await supabase.from('client_documents').insert({ client_id: clientId, file_url: publicUrl, file_name: file.name, file_type: file.type || `application/${ext}`, doc_type: docType, source: 'manual' });
            showToast('✅', `Uploaded: ${file.name}`);
            await fetchClientDocs(clientId);
        } catch (err) { showToast('❌', 'Upload failed: ' + err.message); }
        finally { setUploadingDoc(false); e.target.value = ''; setDocInputKey(Date.now()); }
    };

    // ── RESULT UPLOAD — old result deleted, webhook always fires ─────────────
    const handleUploadResult = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !validateFile(file)) { e.target.value = ''; return; }
        if (file.size > 50 * 1024 * 1024) { showToast('❌', 'File size exceeds 50MB'); return; }
        if (uploading) return;
        setUploading(true);
        try {
            const taskUUID = task?.id || id;

            // 1. Delete old result docs — CRM-ku only new file poganum
            await supabase
                .from('documents')
                .delete()
                .eq('task_id', taskUUID)
                .eq('doc_type', 'result');

            // 2. Upload new result file
            const result = await uploadDocument(file, taskUUID, 'result');

            // 3. Update task: completed + reset webhook flag
            await supabase.from('tasks').update({
                status: 'completed',
                completed_at: new Date().toISOString(),
                result_webhook_sent: true,
            }).eq('id', taskUUID);

            // 3b. DB-la irunthu fresh assigned_staff + staff_code fetch — stale task state use pannama
            const { data: freshTask } = await supabase
                .from('tasks')
                .select('assigned_staff, task_code, task_type, staff:assigned_staff ( id, staff_code )')
                .eq('id', taskUUID)
                .single();
            const currentStaffCode = freshTask?.staff?.staff_code || task.staff?.staff_code || freshTask?.assigned_staff || '';

            showToast('✅', 'Result uploaded! Task completed.');
            await fetchTaskDetails();

            // 4. Always fire webhook — current assigned staff id use pannurom
            fetch(WEBHOOK_RESULT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event:         'result_uploaded',
                    task_id:       task.task_code || taskUUID,
                    client_id:     task.client_code || task.client_id_raw || '',
                    task_type:     task.task_type || 'N/A',
                    client_name:   task.client_name || 'N/A',
                    mobile_number: task.client_phone || 'N/A',
                    staff_id:      currentStaffCode,
                    document: {
                        file_name: file.name,
                        file_size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
                        file_type: file.type || file.name.split('.').pop(),
                        doc_type:  'result',
                        url:       result.file_url,
                    },
                    uploaded_at: new Date().toISOString(),
                }),
            }).catch(err => console.warn('result webhook failed:', err.message));
            console.log('✅ result webhook fired, staff_id:', currentStaffCode);

        } catch (err) { showToast('❌', 'Upload failed: ' + err.message); }
        finally { setUploading(false); e.target.value = ''; }
    };

    const handleAdminComplete = async () => {
        if (!confirm('Mark this task as Completed?')) return;
        setCompleting(true);
        try {
            const res = await apiFetch('/admin/tasks/complete', { method: 'PATCH', body: JSON.stringify({ taskId: task.id }) });
            if (res.success) { showToast('✅', 'Completed!'); await fetchTaskDetails(); }
            else showToast('❌', res.error || 'Failed', true);
        } catch (err) { showToast('❌', 'Failed: ' + err.message, true); }
        finally { setCompleting(false); }
    };

    if (loading) return (<div className="app-layout"><Sidebar /><div className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}><div style={{ fontSize: '18px', color: 'var(--text-secondary)' }}>⏳ Loading Task Details...</div></div></div>);
    if (!task) return (<div className="app-layout"><Sidebar /><div className="main-content"><div style={{ padding: '40px', textAlign: 'center' }}><h2>Task not found</h2><button className="btn-primary" style={{ margin: '20px auto' }} onClick={() => navigate('/tasks')}>Back to Tasks</button></div></div></div>);

    const taskName        = task.task_type || 'Unknown Task';
    const statusName      = formatStatus(task.status);
    const taskSource      = task.source || 'crm';
    const allDocuments    = task.documents || [];
    const resultDocuments = allDocuments.filter(d => d.doc_type === 'result');
    const statusColor     = statusName === 'Completed' ? '#10b981' : statusName === 'In-Progress' ? '#6366f1' : '#f59e0b';
    const statusBg        = statusName === 'Completed' ? 'rgba(16,185,129,0.15)' : statusName === 'In-Progress' ? 'rgba(99,102,241,0.15)' : 'rgba(245,158,11,0.15)';

    return (
        <div className="app-layout">
            <Sidebar />
            <div className="main-content">
                <div className="topbar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                        <button className="btn-sm" onClick={() => navigate('/tasks')}>← Back</button>
                        <h1 className="topbar-title">📋 {taskName}</h1>
                        <span style={{ background: taskSource === 'admin' ? 'rgba(99,102,241,0.15)' : 'rgba(245,158,11,0.15)', color: taskSource === 'admin' ? '#a5b4fc' : '#fbbf24', padding: '3px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 700 }}>{taskSource === 'admin' ? '🏢 Admin' : '🔗 CRM'}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {role === 'admin' ? (
                            <select value={statusName} disabled={completing} onChange={e => handleAdminStatusChange(e.target.value)} style={{ background: statusBg, color: statusColor, border: `1px solid ${statusColor}50`, padding: '6px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: completing ? 'not-allowed' : 'pointer', outline: 'none', opacity: completing ? 0.6 : 1 }}>
                                <option value="Pending">⏳ Pending</option>
                                <option value="In-Progress">🔄 In-Progress</option>
                                <option value="Completed">✅ Completed</option>
                            </select>
                        ) : (
                            <span style={{ background: statusBg, color: statusColor, padding: '6px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, border: `1px solid ${statusColor}30` }}>{statusName}</span>
                        )}
                        {role === 'admin' && taskSource === 'admin' && statusName !== 'Completed' && (
                            <button className="btn-sm green" onClick={handleAdminComplete} disabled={completing} style={{ padding: '8px 16px', fontWeight: 700, opacity: completing ? 0.6 : 1 }}>{completing ? '⏳...' : '✅ Mark Complete'}</button>
                        )}
                    </div>
                </div>

                <div className="page-content" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                        {/* Task Info */}
                        <div className="form-card" style={{ background: 'var(--bg-secondary)', borderTop: '4px solid var(--accent)' }}>
                            <h2 style={{ fontSize: '16px', marginBottom: '20px' }}>📌 Task Details</h2>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                {[
                                    { label: 'Task Name', value: taskName },
                                    { label: 'Task ID', value: task.task_code || task.id, mono: true, bg: 'rgba(99,102,241,0.15)', accent: '#a5b4fc' },
                                    { label: 'Status', value: statusName, color: statusColor },
                                    { label: 'Source', value: taskSource === 'admin' ? '🏢 Admin Created' : '🔗 CRM', color: taskSource === 'admin' ? '#a5b4fc' : '#fbbf24' },
                                    { label: 'Notes', value: task.notes || 'No additional notes', span: true },
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
                                    <span style={{ fontSize: '14px', fontWeight: 700, background: 'rgba(16,185,129,0.15)', color: '#34d399', padding: '2px 10px', borderRadius: '6px', fontFamily: 'monospace' }}>{task.client_code || task.client_id || 'N/A'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>Name</span>
                                    {editingClientName ? (
                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                            <input autoFocus value={clientNameVal} onChange={e => setClientNameVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSaveClientName(); if (e.key === 'Escape') setEditingClientName(false); }} style={{ background: 'var(--bg-card)', border: '1px solid var(--accent)', borderRadius: '8px', padding: '4px 10px', color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600, width: '180px', outline: 'none' }} />
                                            <button className="btn-sm green" onClick={handleSaveClientName} disabled={savingClientName} style={{ padding: '4px 10px', fontSize: '12px' }}>{savingClientName ? '⏳' : '✅'}</button>
                                            <button className="btn-sm" onClick={() => setEditingClientName(false)} style={{ padding: '4px 10px', fontSize: '12px' }}>✕</button>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '14px', fontWeight: 600 }}>{task.client_name || 'N/A'}</span>
                                            <button onClick={() => { setClientNameVal(task.client_name || ''); setEditingClientName(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--text-muted)' }}>✏️</button>
                                        </div>
                                    )}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>Phone</span>
                                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#e879f9' }}>{task.client_phone || 'N/A'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>Email</span>
                                    <span style={{ fontSize: '14px', fontWeight: 600 }}>{task.client_email || 'No Email'}</span>
                                </div>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                        <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>📝 Notes</span>
                                        {!editingNotes && (
                                            <button onClick={() => { setNotesVal(clientNotes); setEditingNotes(true); }} style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#fbbf24', padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                                                ✏️ {clientNotes.trim() ? 'Edit' : 'Add'}
                                            </button>
                                        )}
                                    </div>
                                    {editingNotes ? (
                                        <div>
                                            <textarea autoFocus value={notesVal} onChange={e => setNotesVal(e.target.value)} placeholder="Add notes about this client..." style={{ width: '100%', minHeight: '100px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: '10px', padding: '10px 14px', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'Inter, sans-serif', resize: 'vertical', outline: 'none', lineHeight: '1.6', boxSizing: 'border-box' }} />
                                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-end' }}>
                                                <button onClick={() => setEditingNotes(false)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: '#94a3b8', padding: '5px 12px', borderRadius: '7px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                                                <button onClick={handleSaveNotes} disabled={savingNotes} style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', color: '#fbbf24', padding: '5px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: 700, cursor: savingNotes ? 'not-allowed' : 'pointer', opacity: savingNotes ? 0.6 : 1 }}>
                                                    {savingNotes ? '⏳...' : '✅ Save'}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ background: clientNotes.trim() ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${clientNotes.trim() ? 'rgba(245,158,11,0.2)' : 'var(--border)'}`, borderRadius: '10px', padding: '10px 14px', fontSize: '13px', color: clientNotes.trim() ? 'var(--text-primary)' : 'var(--text-muted)', lineHeight: '1.6', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontStyle: clientNotes.trim() ? 'normal' : 'italic' }}>
                                            {clientNotes.trim() || 'No notes added yet'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Attached Documents */}
                        <div className="form-card" style={{ background: 'var(--bg-secondary)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h2 style={{ fontSize: '16px', margin: 0 }}>
                                    📁 Attached Documents
                                    {clientDocs.length > 0 && <span style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', padding: '2px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, marginLeft: '8px' }}>{clientDocs.length}</span>}
                                </h2>
                                <div>
                                    <input key={docInputKey} id={`doc-upload-${id}`} type="file" accept={acceptFormats} onChange={handleUploadDocument} disabled={uploadingDoc} style={{ display: 'none' }} />
                                    <span className="btn-sm" style={{ cursor: uploadingDoc ? 'not-allowed' : 'pointer', opacity: uploadingDoc ? 0.6 : 1, background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }}
                                        onClick={() => { if (!uploadingDoc) document.getElementById(`doc-upload-${id}`)?.click(); }}>
                                        {uploadingDoc ? '⏳ Uploading...' : '📤 Upload Document'}
                                    </span>
                                </div>
                            </div>
                            {clientDocsLoading ? (
                                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>⏳ Loading...</div>
                            ) : clientDocs.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px', border: '1px dashed var(--border)', borderRadius: '12px', color: 'var(--text-muted)' }}>
                                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>📂</div>
                                    <div>No documents yet. Upload or wait for CRM.</div>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '14px' }}>
                                    {clientDocs.map((d, i) => {
                                        const isManual  = d.source === 'manual';
                                        const isInvalid = !d.file_url || d.file_url === '[]' || d.file_url.startsWith('[');
                                        return (
                                            <div key={d.id || i} style={{ background: 'rgba(255,255,255,0.03)', padding: '18px', borderRadius: '14px', border: '1px solid var(--border)', textAlign: 'center', transition: 'all 0.2s' }}
                                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-active)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                                                <div style={{ fontSize: '30px', marginBottom: '10px' }}>{isInvalid ? '⚠️' : docIcon(d.file_name)}</div>
                                                {editingFileId === d.id ? (
                                                    <div style={{ marginBottom: '8px' }}>
                                                        <input autoFocus value={fileNameVal} onChange={e => setFileNameVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSaveFileName(d.id); if (e.key === 'Escape') setEditingFileId(null); }} style={{ background: 'var(--bg-card)', border: '1px solid var(--accent)', borderRadius: '6px', padding: '4px 6px', color: 'var(--text-primary)', fontSize: '11px', width: '100%', outline: 'none', textAlign: 'center' }} />
                                                        <div style={{ display: 'flex', gap: '4px', marginTop: '6px', justifyContent: 'center' }}>
                                                            <button className="btn-sm green" onClick={() => handleSaveFileName(d.id)} disabled={savingFileId === d.id} style={{ padding: '3px 8px', fontSize: '11px' }}>{savingFileId === d.id ? '⏳' : '✅'}</button>
                                                            <button className="btn-sm" onClick={() => setEditingFileId(null)} style={{ padding: '3px 8px', fontSize: '11px' }}>✕</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '4px' }}>
                                                        <div style={{ fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '110px' }} title={d.file_name}>{d.file_name || 'document'}</div>
                                                        <button onClick={() => { setFileNameVal(d.file_name || ''); setEditingFileId(d.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: 'var(--text-muted)', padding: '1px 2px', flexShrink: 0 }}>✏️</button>
                                                    </div>
                                                )}
                                                <div style={{ fontSize: '10px', marginBottom: '4px', fontWeight: 600, color: isInvalid ? '#ef4444' : isManual ? '#a5b4fc' : '#fbbf24' }}>
                                                    {isInvalid ? '❌ Invalid' : isManual ? '📤 Manual' : '🔗 CRM'}
                                                </div>
                                                <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px', fontWeight: 600 }}>{d.doc_type || 'Document'}</div>
                                                <div style={{ fontSize: '9px', color: '#475569', marginBottom: '10px' }}>{new Date(d.created_at).toLocaleDateString()}</div>
                                                <button className="btn-sm green" style={{ width: '100%', fontSize: '11px', ...(isInvalid ? { background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' } : {}) }} onClick={() => openFile(d.file_url, d.file_name)}>
                                                    {isInvalid ? '⚠️ Invalid' : '⬇️ Download'}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Result Upload */}
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
                                {resultDocuments.length > 0 && (() => { const d = resultDocuments[resultDocuments.length - 1]; return (
                                    <div style={{ textAlign: 'center', padding: '20px', background: 'rgba(232,121,249,0.1)', borderRadius: '12px', border: '1px solid rgba(232,121,249,0.3)' }}>
                                        <div style={{ fontSize: '28px', marginBottom: '8px' }}>✅</div>
                                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#e879f9', marginBottom: '12px' }}>Result File Ready</div>
                                        <button className="btn-sm green" style={{ width: '100%' }} onClick={() => openFile(d.file_url, d.file_name)}>⬇️ {d.file_name}</button>
                                    </div>
                                ); })()}
                                {statusName === 'Completed' && task.completed_at && (
                                    <div style={{ textAlign: 'center', padding: '16px', background: 'rgba(16,185,129,0.1)', borderRadius: '12px', border: '1px solid rgba(16,185,129,0.3)', marginTop: '16px' }}>
                                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#10b981' }}>✅ Completed on {formatDate(task.completed_at)}</div>
                                    </div>
                                )}
                            </div>
                        )}
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

                    {/* Right Sidebar */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div className="form-card" style={{ background: 'var(--bg-secondary)' }}>
                            <h3 style={{ fontSize: '14px', marginBottom: '20px', color: 'var(--text-secondary)' }}>⏰ Timeline</h3>
                            <div style={{ position: 'relative', paddingLeft: '28px' }}>
                                <div style={{ position: 'absolute', left: '7px', top: '8px', bottom: '8px', width: '2px', background: 'linear-gradient(to bottom, #f59e0b, #6366f1, #10b981)', borderRadius: '2px', opacity: 0.3 }} />
                                {[
                                    { label: 'CREATED',   time: formatDate(task.created_at),   color: '#f59e0b', active: true },
                                    { label: 'ASSIGNED',  time: formatDate(task.assigned_at),  color: '#3b82f6', active: !!task.assigned_at },
                                    { label: 'STARTED',   time: formatDate(task.started_at),   color: '#6366f1', active: !!task.started_at },
                                    { label: 'COMPLETED', time: formatDate(task.completed_at), color: '#10b981', active: statusName === 'Completed' },
                                    ...(statusName === 'Completed' && task.started_at && task.completed_at ? [{ label: 'DURATION', time: calcDuration(task.started_at, task.completed_at), color: '#e879f9', active: true }] : []),
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
                                    { label: 'Attached Docs', value: clientDocs.length,      icon: '📁', color: '#a5b4fc' },
                                    { label: 'Result Files',  value: resultDocuments.length, icon: '📋', color: '#e879f9' },
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