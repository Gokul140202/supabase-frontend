import { useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import useToast from '../hooks/useToast';
import Toast from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import { apiFetch } from '../api';

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

    const fetchRework = async () => {
        setLoading(true);
        try {
            const endpoint = role === 'admin' ? `/admin/reworks/${id}` : `/staff/reworks/${id}`;
            const data = await apiFetch(endpoint);
            if (data.success && data.data) {
                setRework(data.data);
            }
        } catch (err) {
            showToast('❌', 'Failed to load rework details');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchRework(); }, [id, role]);

    if (loading) {
        return (
            <div className="app-layout">
                <Sidebar />
                <div className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
                    <div style={{ fontSize: '18px', color: 'var(--text-secondary)' }}>⏳ Loading Rework Details...</div>
                </div>
            </div>
        );
    }

    if (!rework) {
        return (
            <div className="app-layout">
                <Sidebar />
                <div className="main-content">
                    <div style={{ padding: '40px', textAlign: 'center' }}>
                        <h2>Rework not found</h2>
                        <button className="btn-primary" style={{ margin: '20px auto' }} onClick={() => navigate('/rework')}>Back to Reworks</button>
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

    const taskName = rework.task_type || 'Unknown Task';
    const statusName = formatStatus(rework.status);
    const allDocuments = rework.documents || [];
    const documents = allDocuments.filter(d => d.doc_type !== 'result');
    const resultDocuments = allDocuments.filter(d => d.doc_type === 'result');

    const statusColor = statusName === 'Completed' ? '#10b981' : statusName === 'In-Progress' ? '#6366f1' : '#f59e0b';
    const statusBg = statusName === 'Completed' ? 'rgba(16,185,129,0.15)' : statusName === 'In-Progress' ? 'rgba(99,102,241,0.15)' : 'rgba(245,158,11,0.15)';

    const formatDate = (dateString) => {
        if (!dateString) return '—';
        try { return new Date(dateString).toLocaleString(); } catch { return dateString; }
    };

    const calculateDuration = (startDate, endDate) => {
        if (!startDate || !endDate) return '—';
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
            showToast('❌', `Invalid file format (${ext}).`);
            return false;
        }
        return true;
    };

    const handleDownload = async (fileUrl, fileName) => {
        try {
            const userRaw = localStorage.getItem('sp_auth_user');
            const token = userRaw ? JSON.parse(userRaw).token : '';
            const proxyUrl = `http://localhost:3000/api/documents/download?url=${encodeURIComponent(fileUrl)}&name=${encodeURIComponent(fileName || 'document')}`;
            const response = await fetch(proxyUrl, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
            });
            if (!response.ok) throw new Error('Download failed');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName || 'document';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch {
            window.open(fileUrl, '_blank');
        }
    };

    const handleUploadDocument = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!validateFileFormat(file)) { e.target.value = ''; setDocInputKey(Date.now()); return; }
        if (file.size > 50 * 1024 * 1024) { showToast('❌', 'File size exceeds 50MB'); return; }

        setUploadingDoc(true);
        try {
            const reworkId = rework?.id || id;
            const formData = new FormData();
            formData.append('documents[0]', file);

            const userRaw = localStorage.getItem('sp_auth_user');
            const token = userRaw ? JSON.parse(userRaw).token : '';

            const uploadUrl = `http://localhost:3000/api/rework-documents/upload?reworkId=${reworkId}&docType=attachment`;
            const uploadResponse = await fetch(uploadUrl, {
                method: 'POST',
                headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
                body: formData
            });

            if (!uploadResponse.ok) {
                const errorText = await uploadResponse.text();
                throw new Error(`Upload failed (${uploadResponse.status}): ${errorText}`);
            }

            showToast('✅', 'Document uploaded!');
            await fetchRework();
            e.target.value = '';
            setDocInputKey(Date.now());
        } catch (err) {
            showToast('❌', 'Failed: ' + err.message);
        } finally {
            setUploadingDoc(false);
        }
    };

    const handleUploadResult = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!validateFileFormat(file)) { e.target.value = ''; return; }
        if (file.size > 50 * 1024 * 1024) { showToast('❌', 'File size exceeds 50MB'); return; }

        setUploading(true);
        try {
            const reworkId = rework?.id || id;
            const formData = new FormData();
            formData.append('documents[0]', file);

            const userRaw = localStorage.getItem('sp_auth_user');
            const token = userRaw ? JSON.parse(userRaw).token : '';

            const baseUrl = role === 'admin' ? 'http://localhost:3000/api/admin/rework-documents/upload' : 'http://localhost:3000/api/rework-documents/upload';
            const uploadUrl = `${baseUrl}?reworkId=${reworkId}&docType=result`;

            const uploadResponse = await fetch(uploadUrl, {
                method: 'POST',
                headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
                body: formData
            });

            if (!uploadResponse.ok) {
                const errorText = await uploadResponse.text();
                throw new Error(`Upload failed (${uploadResponse.status}): ${errorText}`);
            }

            showToast('✅', 'Result uploaded!');
            await fetchRework();
            e.target.value = '';
        } catch (err) {
            showToast('❌', 'Failed: ' + err.message);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="app-layout">
            <Sidebar />
            <div className="main-content">
                {/* TOPBAR */}
                <div className="topbar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                        <button className="btn-sm" onClick={() => navigate('/rework')}>← Back</button>
                        <h1 className="topbar-title">🔄 {taskName}</h1>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ background: statusBg, color: statusColor, padding: '6px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, border: `1px solid ${statusColor}30` }}>
                            {statusName}
                        </span>
                    </div>
                </div>

                <div className="page-content" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>
                    {/* LEFT SIDE */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                        {/* Rework Info */}
                        <div className="form-card" style={{ background: 'var(--bg-secondary)', borderTop: '4px solid var(--accent)' }}>
                            <h2 style={{ fontSize: '16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>📌 Rework Details</h2>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <div>
                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '4px' }}>Task Type</div>
                                    <div style={{ fontSize: '15px', fontWeight: 700 }}>{taskName}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '4px' }}>Rework ID</div>
                                    <div style={{ fontSize: '13px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{rework.id || '—'}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '4px' }}>Status</div>
                                    <span style={{ background: statusBg, color: statusColor, padding: '3px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}>{statusName}</span>
                                </div>
                                <div>
                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '4px' }}>Rework Reason</div>
                                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{rework.rework_reason || 'No reason provided'}</div>
                                </div>
                            </div>
                        </div>

                        {/* Client Details */}
                        <div className="form-card" style={{ background: 'var(--bg-secondary)', borderLeft: '4px solid #10b981' }}>
                            <h2 style={{ fontSize: '16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>👤 Client Information</h2>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>Client ID</span>
                                    <span style={{ fontSize: '14px', fontWeight: 700, background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', padding: '2px 10px', borderRadius: '6px' }}>{rework.client_code || 'C???'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>Name</span>
                                    <span style={{ fontSize: '14px', fontWeight: 700 }}>{rework.client_name || 'N/A'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>Phone</span>
                                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#e879f9' }}>{rework.client_phone || 'N/A'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>Email</span>
                                    <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{rework.client_email || 'No Email'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Documents */}
                        <div className="form-card" style={{ background: 'var(--bg-secondary)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h2 style={{ fontSize: '16px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>📁 Attached Documents</h2>
                                {role !== 'admin' && statusName !== 'Completed' && (
                                    <label style={{ display: 'inline-block' }}>
                                        <input key={docInputKey} type="file" accept={acceptFormats} onChange={handleUploadDocument} disabled={uploadingDoc} style={{ display: 'none' }} />
                                        <span className="btn-sm blue" onClick={(e) => { setDocInputKey(Date.now()); setTimeout(() => { e.currentTarget.previousElementSibling.value = ''; e.currentTarget.previousElementSibling.click(); }, 0); }}
                                            style={{ cursor: uploadingDoc ? 'not-allowed' : 'pointer', opacity: uploadingDoc ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                                            {uploadingDoc ? '⏳ Uploading...' : '📤 Upload Document'}
                                        </span>
                                    </label>
                                )}
                            </div>

                            {documents.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px 20px', border: '1px dashed var(--border)', borderRadius: '12px', color: 'var(--text-muted)' }}>
                                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>📂</div>
                                    <div style={{ fontSize: '14px', fontWeight: 600 }}>No files attached.</div>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                                    {documents.map((d, i) => (
                                        <div key={i} style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border)', textAlign: 'center', transition: 'all 0.3s' }}
                                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-active)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                                            <div style={{ fontSize: '32px', marginBottom: '12px' }}>📄</div>
                                            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={d.file_name}>{d.file_name}</div>
                                            <button className="btn-sm green" style={{ width: '100%', marginTop: '8px' }} onClick={() => handleDownload(d.file_url, d.file_name)}>⬇️ Download</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Result Upload */}
                        <div className="form-card" style={{ background: 'var(--bg-secondary)', borderLeft: '4px solid #e879f9' }}>
                            <h2 style={{ fontSize: '16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>📤 Rework Result</h2>

                            <div style={{ textAlign: 'center', padding: '20px', border: '2px dashed var(--border)', borderRadius: '12px', color: 'var(--text-muted)', marginBottom: resultDocuments.length > 0 ? '20px' : '0' }}>
                                <div style={{ fontSize: '28px', marginBottom: '12px' }}>📁</div>
                                <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>Upload Result File</div>
                                <div style={{ fontSize: '12px', marginBottom: '16px' }}>Upload result document for this rework</div>
                                <label style={{ display: 'inline-block' }}>
                                    <input type="file" accept={acceptFormats} onChange={handleUploadResult} disabled={uploading} style={{ display: 'none' }} />
                                    <button className="btn-sm green" onClick={(e) => { e.preventDefault(); e.currentTarget.previousElementSibling.click(); }}
                                        disabled={uploading} style={{ cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.6 : 1 }}>
                                        {uploading ? '⏳ Uploading...' : '📄 Choose File'}
                                    </button>
                                </label>
                            </div>

                            {resultDocuments.length > 0 && (() => {
                                const finalDoc = resultDocuments[resultDocuments.length - 1];
                                return (
                                    <div style={{ textAlign: 'center', padding: '20px', background: 'rgba(232,121,249,0.1)', borderRadius: '12px', border: '1px solid rgba(232,121,249,0.3)' }}>
                                        <div style={{ fontSize: '28px', marginBottom: '12px' }}>📋</div>
                                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#e879f9', marginBottom: '12px' }}>Result File</div>
                                        <button className="btn-sm green" style={{ width: '100%' }} onClick={() => handleDownload(finalDoc.file_url, finalDoc.file_name)}>⬇️ {finalDoc.file_name}</button>
                                    </div>
                                );
                            })()}

                            {statusName === 'Completed' && rework.completed_at && (
                                <div style={{ textAlign: 'center', padding: '16px', background: 'rgba(16,185,129,0.1)', borderRadius: '12px', border: '1px solid rgba(16,185,129,0.3)', marginTop: '16px' }}>
                                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>✅</div>
                                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#10b981', marginBottom: '4px' }}>Rework Completed</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Completed on {formatDate(rework.completed_at)}</div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT SIDE: Timeline */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div className="form-card" style={{ background: 'var(--bg-secondary)' }}>
                            <h3 style={{ fontSize: '14px', marginBottom: '20px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>⏰ Timeline</h3>
                            <div style={{ position: 'relative', paddingLeft: '28px' }}>
                                <div style={{ position: 'absolute', left: '7px', top: '8px', bottom: '8px', width: '2px', background: 'linear-gradient(to bottom, #f59e0b, #6366f1, #10b981)', borderRadius: '2px', opacity: 0.3 }} />
                                {[
                                    { label: 'CREATED', time: formatDate(rework.created_at), color: '#f59e0b', active: true },
                                    { label: 'ASSIGNED', time: formatDate(rework.assigned_at), color: '#3b82f6', active: !!rework.assigned_at },
                                    { label: 'STARTED', time: formatDate(rework.started_at), color: '#6366f1', active: !!rework.started_at },
                                    { label: 'COMPLETED', time: formatDate(rework.completed_at), color: '#10b981', active: statusName === 'Completed' },
                                    ...(statusName === 'Completed' && rework.started_at && rework.completed_at ? [{ label: 'DURATION', time: calculateDuration(rework.started_at, rework.completed_at), color: '#e879f9', active: true }] : []),
                                ].map((step, i) => (
                                    <div key={i} style={{ marginBottom: i < 3 ? '22px' : 0, opacity: step.active ? 1 : 0.35 }}>
                                        <div style={{
                                            position: 'absolute', left: '0', width: '16px', height: '16px', borderRadius: '50%',
                                            background: step.active ? step.color : 'var(--bg-card)',
                                            border: `2px solid ${step.active ? step.color : 'var(--border)'}`,
                                            marginTop: `${i * 44}px`,
                                            boxShadow: step.active ? `0 0 10px ${step.color}40` : 'none',
                                        }} />
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
