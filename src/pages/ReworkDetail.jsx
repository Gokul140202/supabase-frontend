import { useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import useToast from '../hooks/useToast';
import Toast from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import { apiFetch } from '../api';
import { supabase } from '../api';

export default function ReworkDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { role } = useAuth();
    const { toast, showToast } = useToast();
    const [rework, setRework] = useState(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [uploadingDoc, setUploadingDoc] = useState(false);
    const [docInputKey, setDocInputKey] = useState(Date.now());
    const [clientDocs, setClientDocs] = useState([]);
    const [clientDocsLoading, setClientDocsLoading] = useState(false);
    const [completing, setCompleting] = useState(false);
    const [editingFileId, setEditingFileId] = useState(null);
    const [fileNameVal, setFileNameVal] = useState('');
    const [savingFileId, setSavingFileId] = useState(null);

    const handleSaveFileName = async (docId) => {
        if (!fileNameVal.trim() || savingFileId) return;
        setSavingFileId(docId);
        try {
            await apiFetch(`/rework-documents/${docId}/filename`, { method: 'PATCH', body: JSON.stringify({ file_name: fileNameVal.trim() }) });
            setEditingFileId(null); showToast('✅', 'File name updated!'); await fetchRework();
        } catch (err) { showToast('❌', 'Failed: ' + err.message); }
        finally { setSavingFileId(null); }
    };

    const fetchClientDocs = async (clientId) => {
        if (!clientId) return;
        setClientDocsLoading(true);
        try {
            const { data, error } = await supabase.from('client_documents').select('*').eq('client_id', clientId).order('created_at', { ascending: false });
            if (!error && data) setClientDocs(data);
        } catch (err) { console.error('client_documents fetch:', err); }
        finally { setClientDocsLoading(false); }
    };

    const fetchRework = async () => {
        setLoading(true);
        try {
            const endpoint = role === 'admin' ? `/admin/reworks/${id}` : `/staff/reworks/${id}`;
            const data = await apiFetch(endpoint);
            if (data.success && data.data) {
                setRework(data.data);
                const clientId = data.data.clients?.id || data.data.client_id_raw || data.data.client_id;
                if (clientId) fetchClientDocs(clientId);
            }
        } catch (err) { showToast('❌', 'Failed to load rework details'); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchRework(); }, [id, role]);

    const handleAdminStatusChange = async (newStatus) => {
        if (completing) return;
        setCompleting(true);
        try {
            const statusMap = { 'Pending': 'assigned', 'In-Progress': 'in_progress', 'Completed': 'completed' };
            const res = await apiFetch('/admin/reworks/changestatus', { method: 'PATCH', body: JSON.stringify({ reworkId: rework.id, status: statusMap[newStatus] }) });
            if (res.success) { showToast('✅', `Status → ${newStatus}`); await fetchRework(); }
            else showToast('❌', res.error || 'Failed', true);
        } catch (err) { showToast('❌', 'Failed: ' + err.message, true); }
        finally { setCompleting(false); }
    };

    if (loading) return (<div className="app-layout"><Sidebar /><div className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}><div style={{ fontSize: '18px', color: 'var(--text-secondary)' }}>⏳ Loading Rework Details...</div></div></div>);
    if (!rework) return (<div className="app-layout"><Sidebar /><div className="main-content"><div style={{ padding: '40px', textAlign: 'center' }}><h2>Rework not found</h2><button className="btn-primary" style={{ margin: '20px auto' }} onClick={() => navigate('/rework')}>Back to Reworks</button></div></div></div>);

    const formatStatus = (s) => { if (!s) return 'Pending'; const l = s.toLowerCase(); if (l === 'completed') return 'Completed'; if (l === 'in_progress' || l === 'in-progress') return 'In-Progress'; return 'Pending'; };
    const taskName = rework.task_type || 'Unknown Task';
    const statusName = formatStatus(rework.status);
    const allDocuments = rework.documents || [];
    const resultDocuments = allDocuments.filter(d => d.doc_type === 'result');
    const statusColor = statusName === 'Completed' ? '#10b981' : statusName === 'In-Progress' ? '#6366f1' : '#f59e0b';
    const statusBg = statusName === 'Completed' ? 'rgba(16,185,129,0.15)' : statusName === 'In-Progress' ? 'rgba(99,102,241,0.15)' : 'rgba(245,158,11,0.15)';
    const formatDate = (d) => { if (!d) return '—'; try { return new Date(d).toLocaleString(); } catch { return d; } };
    const calcDuration = (s, e) => { if (!s || !e) return '—'; try { const diff = Math.abs(new Date(e) - new Date(s)); const h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000); return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h ${m}m` : `${h}h ${m}m`; } catch { return '—'; } };
    const allowedExt = ['.pdf','.doc','.docx','.xls','.xlsx','.jpg','.jpeg','.png','.gif','.bmp','.tiff','.tif','.txt','.csv','.zip','.rar','.tax'];
    const acceptFormats = allowedExt.join(',');
    const validateFile = (file) => { const ext = '.' + file.name.split('.').pop().toLowerCase(); if (!allowedExt.includes(ext)) { showToast('❌', `Invalid format (${ext})`); return false; } return true; };
    const docIcon = (name) => ({ pdf:'📕',doc:'📘',docx:'📘',xls:'📗',xlsx:'📗',jpg:'🖼️',jpeg:'🖼️',png:'🖼️',zip:'📦',tax:'💸' })[(name||'').split('.').pop().toLowerCase()] || '📄';
    const openFile = (url, name) => { if (!url || url === '[]' || url === '' || url === 'null' || url.startsWith('[')) { showToast('❌', `"${name}" — file URL invalid.`); return; } const a = document.createElement('a'); a.href = url; a.download = name || 'document'; a.target = '_blank'; a.rel = 'noreferrer'; document.body.appendChild(a); a.click(); document.body.removeChild(a); };

    // Upload → client_documents table (same as CRM docs)
    const handleUploadDocument = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !validateFile(file)) { e.target.value = ''; setDocInputKey(Date.now()); return; }
        if (file.size > 50 * 1024 * 1024) { showToast('❌', 'File size exceeds 50MB'); return; }
        setUploadingDoc(true);
        try {
            const clientId = rework?.clients?.id || rework?.client_id_raw || rework?.client_id;
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
            else if (lower.includes('passport')) docType = 'Passport';
            else if (lower.includes('salary') || lower.includes('payslip')) docType = 'Salary Slip';
            else if (lower.includes('bank') || lower.includes('statement')) docType = 'Bank Statement';
            else if (lower.includes('itr') || lower.includes('income')) docType = 'ITR';
            else if (lower.includes('gst')) docType = 'GST Document';
            await supabase.from('client_documents').insert({ client_id: clientId, file_url: publicUrl, file_name: file.name, file_type: file.type || `application/${ext}`, doc_type: docType, source: 'manual' });
            showToast('✅', `Uploaded: ${file.name}`);
            await fetchClientDocs(clientId);
        } catch (err) { showToast('❌', 'Upload failed: ' + err.message); }
        finally { setUploadingDoc(false); e.target.value = ''; setDocInputKey(Date.now()); }
    };

    const handleUploadResult = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !validateFile(file)) { e.target.value = ''; return; }
        if (file.size > 50 * 1024 * 1024) { showToast('❌', 'File size exceeds 50MB'); return; }
        setUploading(true);
        try {
            const reworkUUID = rework?.id || id;
            const ext = file.name.split('.').pop();
            const storagePath = `reworks/${reworkUUID}/result_${Date.now()}.${ext}`;
            const { error: storageError } = await supabase.storage.from('rework-documents').upload(storagePath, file, { upsert: true });
            if (storageError) throw new Error('Storage upload failed: ' + storageError.message);
            const { data: { publicUrl } } = supabase.storage.from('rework-documents').getPublicUrl(storagePath);
            await supabase.from('rework_documents').insert({ rework_id: reworkUUID, file_url: publicUrl, file_name: file.name, file_type: file.type || ext, doc_type: 'result' });
            showToast('✅', 'Result uploaded.'); await fetchRework();
            try { await fetch('https://services.leadconnectorhq.com/hooks/GmLfYZp3rjJ0jWt1nZtb/webhook-trigger/c8acafca-2d52-4f75-a8b9-31b783957fdb', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'rework_result_uploaded', task_id: rework.rework_code || reworkUUID, client_id: rework.client_code || rework.client_id, task_type: rework.task_type || 'N/A', client_name: rework.client_name || 'N/A', mobile_number: rework.client_phone || 'N/A', rework_reason: rework.rework_reason || null, document: { file_name: file.name, file_size: `${(file.size/(1024*1024)).toFixed(2)} MB`, file_type: file.type || ext, doc_type: 'result', url: publicUrl }, uploaded_at: new Date().toISOString() }) }); } catch (wErr) { console.warn('⚠️ CRM webhook failed:', wErr.message); }
        } catch (err) { showToast('❌', 'Failed: ' + err.message); }
        finally { setUploading(false); e.target.value = ''; }
    };

    return (
        <div className="app-layout">
            <Sidebar />
            <div className="main-content">
                <div className="topbar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                        <button className="btn-sm" onClick={() => navigate('/rework')}>← Back</button>
                        <h1 className="topbar-title">🔄 {taskName}</h1>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {role === 'admin' ? (
                            <select value={statusName} disabled={completing} onChange={e => handleAdminStatusChange(e.target.value)} style={{ background: statusBg, color: statusColor, border: `1px solid ${statusColor}50`, padding: '6px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: completing ? 'not-allowed' : 'pointer', outline: 'none', opacity: completing ? 0.6 : 1 }}>
                                <option value="Pending">⏳ Pending</option><option value="In-Progress">🔄 In-Progress</option><option value="Completed">✅ Completed</option>
                            </select>
                        ) : (<span style={{ background: statusBg, color: statusColor, padding: '6px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, border: `1px solid ${statusColor}30` }}>{statusName}</span>)}
                    </div>
                </div>

                <div className="page-content" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                        {/* Rework Info */}
                        <div className="form-card" style={{ background: 'var(--bg-secondary)', borderTop: '4px solid var(--accent)' }}>
                            <h2 style={{ fontSize: '16px', marginBottom: '20px' }}>📌 Rework Details</h2>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                {[{ label: 'Task Type', value: taskName }, { label: 'Rework ID', value: rework.rework_code || rework.id, bg: 'rgba(99,102,241,0.15)', accent: '#a5b4fc', mono: true }, { label: 'Status', value: statusName, color: statusColor }, { label: 'Rework Reason', value: rework.rework_reason || 'No reason provided' }].map((row, i) => (
                                    <div key={i}>
                                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '4px' }}>{row.label}</div>
                                        {row.bg ? <span style={{ background: row.bg, color: row.accent, padding: '3px 10px', borderRadius: '6px', fontSize: '13px', fontWeight: 700, fontFamily: row.mono ? 'monospace' : 'inherit' }}>{row.value}</span>
                                            : <div style={{ fontSize: '14px', fontWeight: 600, color: row.color || 'var(--text-secondary)' }}>{row.value}</div>}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Client Info */}
                        <div className="form-card" style={{ background: 'var(--bg-secondary)', borderLeft: '4px solid #10b981' }}>
                            <h2 style={{ fontSize: '16px', marginBottom: '20px' }}>👤 Client Information</h2>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                                {[{ label: 'Client ID', value: rework.client_code || rework.client_id || 'N/A', bg: 'rgba(16,185,129,0.15)', accent: '#34d399', mono: true }, { label: 'Name', value: rework.client_name || 'N/A' }, { label: 'Phone', value: rework.client_phone || 'N/A', color: '#e879f9' }, { label: 'Email', value: rework.client_email || 'No Email' }].map((row, i, arr) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                                        <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>{row.label}</span>
                                        {row.bg ? <span style={{ fontSize: '14px', fontWeight: 700, background: row.bg, color: row.accent, padding: '2px 10px', borderRadius: '6px', fontFamily: row.mono ? 'monospace' : 'inherit' }}>{row.value}</span>
                                            : <span style={{ fontSize: '14px', fontWeight: 600, color: row.color || 'var(--text-primary)' }}>{row.value}</span>}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* ══════ ATTACHED DOCUMENTS — single merged section ══════ */}
                        <div className="form-card" style={{ background: 'var(--bg-secondary)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h2 style={{ fontSize: '16px', margin: 0 }}>
                                    📁 Attached Documents
                                    {clientDocs.length > 0 && <span style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', padding: '2px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, marginLeft: '8px' }}>{clientDocs.length}</span>}
                                </h2>
                                <div>
                                    <input key={docInputKey} id={`doc-upload-rw-${id}`} type="file" accept={acceptFormats} onChange={handleUploadDocument} disabled={uploadingDoc} style={{ display: 'none' }} />
                                    <span className="btn-sm" style={{ cursor: uploadingDoc ? 'not-allowed' : 'pointer', opacity: uploadingDoc ? 0.6 : 1, background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }}
                                        onClick={() => { if (!uploadingDoc) document.getElementById(`doc-upload-rw-${id}`)?.click(); }}>
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
                                        const isManual = d.source === 'manual';
                                        const isInvalid = !d.file_url || d.file_url === '[]' || d.file_url.startsWith('[');
                                        return (
                                            <div key={d.id || i} style={{ background: 'rgba(255,255,255,0.03)', padding: '18px', borderRadius: '14px', border: '1px solid var(--border)', textAlign: 'center', transition: 'all 0.2s' }}
                                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-active)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                                                <div style={{ fontSize: '30px', marginBottom: '10px' }}>{isInvalid ? '⚠️' : docIcon(d.file_name)}</div>
                                                <div style={{ fontSize: '11px', fontWeight: 600, marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={d.file_name}>{d.file_name || 'document'}</div>
                                                <div style={{ fontSize: '10px', marginBottom: '4px', fontWeight: 600, color: isInvalid ? '#ef4444' : isManual ? '#a5b4fc' : '#fbbf24' }}>
                                                    {isInvalid ? '❌ Invalid' : isManual ? '📤 Manual' : '🔗 CRM'}
                                                </div>
                                                <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px', fontWeight: 600 }}>{d.doc_type || 'Document'}</div>
                                                <div style={{ fontSize: '9px', color: '#475569', marginBottom: '10px' }}>{new Date(d.created_at).toLocaleDateString()}</div>
                                                <button className="btn-sm green" style={{ width: '100%', fontSize: '11px', ...(isInvalid ? { background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' } : {}) }}
                                                    onClick={() => openFile(d.file_url, d.file_name)}>
                                                    {isInvalid ? '⚠️ Invalid' : '⬇️ Download'}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* ══════ RESULT FILE ══════ */}
                        <div className="form-card" style={{ background: 'var(--bg-secondary)', borderLeft: '4px solid #e879f9' }}>
                            <h2 style={{ fontSize: '16px', marginBottom: '20px' }}>📤 Rework Result</h2>
                            <div style={{ textAlign: 'center', padding: '20px', border: '2px dashed var(--border)', borderRadius: '12px', color: 'var(--text-muted)', marginBottom: resultDocuments.length > 0 ? '20px' : '0' }}>
                                <div style={{ fontSize: '28px', marginBottom: '12px' }}>📁</div>
                                <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>Upload Result File</div>
                                <label><input type="file" accept={acceptFormats} onChange={handleUploadResult} disabled={uploading} style={{ display: 'none' }} />
                                    <button className="btn-sm green" onClick={e => { e.preventDefault(); e.currentTarget.previousElementSibling.click(); }} disabled={uploading} style={{ cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.6 : 1 }}>{uploading ? '⏳ Uploading...' : '📄 Choose File'}</button>
                                </label>
                            </div>
                            {resultDocuments.length > 0 && (() => { const d = resultDocuments[resultDocuments.length - 1]; return (
                                <div style={{ textAlign: 'center', padding: '20px', background: 'rgba(232,121,249,0.1)', borderRadius: '12px', border: '1px solid rgba(232,121,249,0.3)' }}>
                                    <div style={{ fontSize: '28px', marginBottom: '8px' }}>✅</div>
                                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#e879f9', marginBottom: '12px' }}>Result File Ready</div>
                                    <button className="btn-sm green" style={{ width: '100%' }} onClick={() => openFile(d.file_url, d.file_name)}>⬇️ {d.file_name}</button>
                                </div>); })()}
                            {statusName === 'Completed' && rework.completed_at && (
                                <div style={{ textAlign: 'center', padding: '16px', background: 'rgba(16,185,129,0.1)', borderRadius: '12px', border: '1px solid rgba(16,185,129,0.3)', marginTop: '16px' }}>
                                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#10b981' }}>✅ Completed on {formatDate(rework.completed_at)}</div>
                                </div>)}
                        </div>
                    </div>

                    {/* RIGHT SIDEBAR */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div className="form-card" style={{ background: 'var(--bg-secondary)' }}>
                            <h3 style={{ fontSize: '14px', marginBottom: '20px', color: 'var(--text-secondary)' }}>⏰ Timeline</h3>
                            <div style={{ position: 'relative', paddingLeft: '28px' }}>
                                <div style={{ position: 'absolute', left: '7px', top: '8px', bottom: '8px', width: '2px', background: 'linear-gradient(to bottom, #f59e0b, #6366f1, #10b981)', borderRadius: '2px', opacity: 0.3 }} />
                                {[{ label: 'CREATED', time: formatDate(rework.created_at), color: '#f59e0b', active: true },
                                    { label: 'ASSIGNED', time: formatDate(rework.assigned_at), color: '#3b82f6', active: !!rework.assigned_at },
                                    { label: 'STARTED', time: formatDate(rework.started_at), color: '#6366f1', active: !!rework.started_at },
                                    { label: 'COMPLETED', time: formatDate(rework.completed_at), color: '#10b981', active: statusName === 'Completed' },
                                    ...(statusName === 'Completed' && rework.started_at && rework.completed_at ? [{ label: 'DURATION', time: calcDuration(rework.started_at, rework.completed_at), color: '#e879f9', active: true }] : []),
                                ].map((step, i) => (
                                    <div key={i} style={{ marginBottom: i < 3 ? '22px' : 0, opacity: step.active ? 1 : 0.35 }}>
                                        <div style={{ position: 'absolute', left: '0', width: '16px', height: '16px', borderRadius: '50%', background: step.active ? step.color : 'var(--bg-card)', border: `2px solid ${step.active ? step.color : 'var(--border)'}`, marginTop: `${i * 44}px`, boxShadow: step.active ? `0 0 10px ${step.color}40` : 'none' }} />
                                        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.6px', color: step.active ? step.color : 'var(--text-muted)' }}>{step.label}</div>
                                        <div style={{ fontSize: '13px', fontWeight: 600, color: step.active ? 'var(--text-primary)' : 'var(--text-muted)', marginTop: '2px' }}>{step.time && step.time !== '—' ? step.time : '—'}</div>
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