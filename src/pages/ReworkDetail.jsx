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
    const [crmDocs, setCrmDocs] = useState([]);  
    // ── Inline edit states ────────────────────────────────────────────────────
    const [editingFileId, setEditingFileId] = useState(null);
    const [fileNameVal, setFileNameVal] = useState('');
    const [savingFileId, setSavingFileId] = useState(null);

    const handleSaveFileName = async (docId) => {
        if (!fileNameVal.trim() || savingFileId) return;
        setSavingFileId(docId);
        try {
            await apiFetch(`/rework-documents/${docId}/filename`, {
                method: 'PATCH',
                body: JSON.stringify({ file_name: fileNameVal.trim() }),
            });
            setEditingFileId(null);
            showToast('✅', 'File name updated!');
            await fetchRework();
        } catch (err) {
            showToast('❌', 'Failed: ' + err.message);
        } finally {
            setSavingFileId(null);
        }
    };

    const fetchRework = async () => {
        setLoading(true);
        try {
            const endpoint = role === 'admin' ? `/admin/reworks/${id}` : `/staff/reworks/${id}`;
            const data = await apiFetch(endpoint);
            if (data.success && data.data) {
                setRework(data.data);
                
                try {
                    const crmData = await apiFetch(`/reworks/${id}/crm-documents`);
                    if (crmData.success) setCrmDocs(crmData.data || []);
                } catch (e) { setCrmDocs([]); }
            }
        } catch (err) { showToast('❌', 'Failed to load rework details'); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchRework(); }, [id, role]);

    if (loading) return (
        <div className="app-layout"><Sidebar />
            <div className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
                <div style={{ fontSize: '18px', color: 'var(--text-secondary)' }}>⏳ Loading Rework Details...</div>
            </div>
        </div>
    );

    if (!rework) return (
        <div className="app-layout"><Sidebar />
            <div className="main-content">
                <div style={{ padding: '40px', textAlign: 'center' }}>
                    <h2>Rework not found</h2>
                    <button className="btn-primary" style={{ margin: '20px auto' }} onClick={() => navigate('/rework')}>Back to Reworks</button>
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

    const taskName        = rework.task_type || 'Unknown Task';
    const statusName      = formatStatus(rework.status);
    const allDocuments    = rework.documents || [];
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
            const reworkId = rework?.id || id;
            const ext = file.name.split('.').pop();
            const storagePath = `reworks/${reworkId}/attachment_${Date.now()}.${ext}`;
            const { error: storageError } = await supabase.storage.from('rework-documents').upload(storagePath, file, { upsert: true });
            if (storageError) throw new Error('Storage upload failed: ' + storageError.message);
            const { data: { publicUrl } } = supabase.storage.from('rework-documents').getPublicUrl(storagePath);
            await supabase.from('rework_documents').insert({
                rework_id: reworkId, file_url: publicUrl, file_name: file.name,
                file_type: file.type || ext, doc_type: 'attachment',
            });
            showToast('✅', `Document uploaded: ${file.name}`);
            await fetchRework();
        } catch (err) { showToast('❌', 'Failed: ' + err.message); }
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

            
            await supabase.from('rework_documents').insert({
                rework_id: reworkUUID, file_url: publicUrl, file_name: file.name,
                file_type: file.type || ext, doc_type: 'result',
            });

            showToast('✅', 'Result uploaded.');
            await fetchRework();

            
            const webhookPayload = {
                event:         'rework_result_uploaded',
                task_id:       rework.rework_code  || reworkUUID,
                client_id:     rework.client_code  || rework.client_id,
                task_type:     rework.task_type    || 'N/A',
                client_name:   rework.client_name  || 'N/A',
                mobile_number: rework.client_phone || 'N/A',
                rework_reason: rework.rework_reason || null,
                document: {
                    file_name: file.name,
                    file_size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
                    file_type: file.type || ext,
                    doc_type:  'result',
                    url:       publicUrl,
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

        } catch (err) { showToast('❌', 'Failed: ' + err.message); }
        finally { setUploading(false); e.target.value = ''; }
    };

    const docIcon = (name) => ({ pdf:'📕',doc:'📘',docx:'📘',xls:'📗',xlsx:'📗',jpg:'🖼️',jpeg:'🖼️',png:'🖼️',zip:'📦',tax:'💸' })[(name||'').split('.').pop().toLowerCase()] || '📄';

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
                        <span style={{ background: statusBg, color: statusColor, padding: '6px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, border: `1px solid ${statusColor}30` }}>{statusName}</span>
                    </div>
                </div>

                <div className="page-content" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                        {/* Rework Info */}
                        <div className="form-card" style={{ background: 'var(--bg-secondary)', borderTop: '4px solid var(--accent)' }}>
                            <h2 style={{ fontSize: '16px', marginBottom: '20px' }}>📌 Rework Details</h2>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                {[
                                    { label: 'Task Type',     value: taskName },
                                    { label: 'Rework ID',     value: rework.rework_code || rework.id, bg: 'rgba(99,102,241,0.15)', accent: '#a5b4fc', mono: true },
                                    { label: 'Status',        value: statusName, color: statusColor },
                                    { label: 'Rework Reason', value: rework.rework_reason || 'No reason provided' },
                                ].map((row, i) => (
                                    <div key={i}>
                                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '4px' }}>{row.label}</div>
                                        {row.bg
                                            ? <span style={{ background: row.bg, color: row.accent, padding: '3px 10px', borderRadius: '6px', fontSize: '13px', fontWeight: 700, fontFamily: row.mono ? 'monospace' : 'inherit' }}>{row.value}</span>
                                            : <div style={{ fontSize: '14px', fontWeight: 600, color: row.color || 'var(--text-secondary)' }}>{row.value}</div>
                                        }
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Client Info */}
                        <div className="form-card" style={{ background: 'var(--bg-secondary)', borderLeft: '4px solid #10b981' }}>
                            <h2 style={{ fontSize: '16px', marginBottom: '20px' }}>👤 Client Information</h2>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                                {[
                                    { label: 'Client ID',  value: rework.client_code || rework.client_id || 'N/A', bg: 'rgba(16,185,129,0.15)', accent: '#34d399', mono: true },
                                    { label: 'Name',       value: rework.client_name  || 'N/A' },
                                    { label: 'Phone',      value: rework.client_phone || 'N/A', color: '#e879f9' },
                                    { label: 'Email',      value: rework.client_email || 'No Email' },
                                ].map((row, i, arr) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                                        <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>{row.label}</span>
                                        {row.bg
                                            ? <span style={{ fontSize: '14px', fontWeight: 700, background: row.bg, color: row.accent, padding: '2px 10px', borderRadius: '6px', fontFamily: row.mono ? 'monospace' : 'inherit' }}>{row.value}</span>
                                            : <span style={{ fontSize: '14px', fontWeight: 600, color: row.color || 'var(--text-primary)' }}>{row.value}</span>
                                        }
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* CRM Documents — mobile numberல send பண்ண docs மட்டும் */}
                        <div className="form-card" style={{ background: 'var(--bg-secondary)', borderLeft: '4px solid #f59e0b' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                                <h2 style={{ fontSize: '16px', margin: 0 }}>📎 CRM Documents</h2>
                                {crmDocs.length > 0 && (
                                    <span style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24', padding: '2px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}>
                                        {crmDocs.length}
                                    </span>
                                )}
                        
                            </div>
                            {crmDocs.length === 0
                                ? <div style={{ textAlign: 'center', padding: '32px', border: '1px dashed rgba(245,158,11,0.3)', borderRadius: '12px', color: 'var(--text-muted)' }}>
                                    <div style={{ fontSize: '28px', marginBottom: '8px' }}>📂</div>
                    
                                </div>
                                : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
                                    {crmDocs.map((d, i) => (
                                        <div key={d.id || i} style={{ background: 'rgba(245,158,11,0.04)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(245,158,11,0.2)', textAlign: 'center', transition: 'all 0.3s' }}
                                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.5)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.2)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                                            <div style={{ fontSize: '32px', marginBottom: '10px' }}>{docIcon(d.file_name)}</div>
                                            <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={d.file_name}>{d.file_name || 'document'}</div>
                                            <div style={{ fontSize: '10px', color: '#fbbf24', marginBottom: '10px', fontWeight: 600 }}>🔗 CRM</div>
                                            <button className="btn-sm" style={{ width: '100%', fontSize: '12px', background: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' }}
                                                onClick={() => window.open(d.file_url, '_blank')}>⬇️ Download</button>
                                        </div>
                                    ))}
                                </div>
                            }
                        </div>

                        {/* Result Upload */}
                        <div className="form-card" style={{ background: 'var(--bg-secondary)', borderLeft: '4px solid #e879f9' }}>
                            <h2 style={{ fontSize: '16px', marginBottom: '20px' }}>📤 Rework Result</h2>
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
                                        <button className="btn-sm green" style={{ width: '100%' }} onClick={() => window.open(d.file_url, '_blank')}>⬇️ {d.file_name}</button>
                                    </div>
                                );
                            })()}
                            {statusName === 'Completed' && rework.completed_at && (
                                <div style={{ textAlign: 'center', padding: '16px', background: 'rgba(16,185,129,0.1)', borderRadius: '12px', border: '1px solid rgba(16,185,129,0.3)', marginTop: '16px' }}>
                                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#10b981' }}>✅ Completed on {formatDate(rework.completed_at)}</div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div className="form-card" style={{ background: 'var(--bg-secondary)' }}>
                            <h3 style={{ fontSize: '14px', marginBottom: '20px', color: 'var(--text-secondary)' }}>⏰ Timeline</h3>
                            <div style={{ position: 'relative', paddingLeft: '28px' }}>
                                <div style={{ position: 'absolute', left: '7px', top: '8px', bottom: '8px', width: '2px', background: 'linear-gradient(to bottom, #f59e0b, #6366f1, #10b981)', borderRadius: '2px', opacity: 0.3 }} />
                                {[
                                    { label: 'CREATED',   time: formatDate(rework.created_at),   color: '#f59e0b', active: true },
                                    { label: 'ASSIGNED',  time: formatDate(rework.assigned_at),  color: '#3b82f6', active: !!rework.assigned_at },
                                    { label: 'STARTED',   time: formatDate(rework.started_at),   color: '#6366f1', active: !!rework.started_at },
                                    { label: 'COMPLETED', time: formatDate(rework.completed_at), color: '#10b981', active: statusName === 'Completed' },
                                    ...(statusName === 'Completed' && rework.started_at && rework.completed_at
                                        ? [{ label: 'DURATION', time: calcDuration(rework.started_at, rework.completed_at), color: '#e879f9', active: true }] : []),
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