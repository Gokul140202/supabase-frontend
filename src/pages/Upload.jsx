import { useState, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import Toast from '../components/Toast';
import useToast from '../hooks/useToast';
import useLocalStorage from '../hooks/useLocalStorage';
import { clientData as initialData } from '../data/clientData';

function getFileIcon(name) {
    const ext = name.split('.').pop().toLowerCase();
    return { pdf: '📕', jpg: '🖼️', jpeg: '🖼️', png: '🖼️', doc: '📝', docx: '📝', xlsx: '📊', xls: '📊', tax: '💸' }[ext] || '📄';
}

function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function Upload() {
    const { toast, showToast } = useToast();

    // Shared localStorage — same keys as Clients.jsx & Dashboard.jsx
    const [clients, setClients] = useLocalStorage('sp_clients', initialData);
    const [recentUploads, setRecentUploads] = useLocalStorage('sp_recent_uploads', []);

    const [name, setName] = useState('');
    const [mobile, setMobile] = useState('');
    const [email, setEmail] = useState('');
    const [type, setType] = useState('Other');
    const [file, setFile] = useState(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const fileInputRef = useRef(null);

    const handleFileSelect = (f) => { if (f) setFile(f); };
    const removeFile = () => {
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDragOver = (e) => { e.preventDefault(); setIsDragOver(true); };
    const handleDragLeave = () => setIsDragOver(false);
    const handleDrop = (e) => {
        e.preventDefault(); setIsDragOver(false);
        const dropped = e.dataTransfer.files[0];
        if (dropped) handleFileSelect(dropped);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim()) { showToast('❌', 'Please enter the client name.', true); return; }
        if (mobile.length !== 10) { showToast('❌', 'Please enter a valid 10-digit mobile number.', true); return; }
        if (!email.trim() || !email.includes('@')) { showToast('❌', 'Please enter a valid email address.', true); return; }
        if (!file) { showToast('❌', 'Please select a document to upload.', true); return; }

        setSubmitting(true);
        setTimeout(async () => {
            const trimmedName = name.trim();
            const trimmedEmail = email.trim();
            const icon = getFileIcon(file.name);
            const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

            // Check if client already exists (by mobile)
            const existingIdx = clients.findIndex(c => c.mobile === mobile);
            const newDoc = {
                id: 'd' + Date.now(),
                name: file.name,
                icon,
                type: type,
                date: today,
                size: formatSize(file.size),
            };

            if (existingIdx >= 0) {
                // Add doc to existing client
                const updated = clients.map((c, i) =>
                    i === existingIdx ? { ...c, docs: [...c.docs, newDoc] } : c
                );
                setClients(updated);
            } else {
                // Create new client
                const newId = 'CUST-' + String(clients.length + 1).padStart(3, '0');
                const newClient = {
                    id: newId,
                    name: trimmedName,
                    mobile,
                    email: trimmedEmail,
                    docs: [newDoc],
                };
                setClients([...clients, newClient]);
            }

            // Save to recent uploads
            setRecentUploads(prev => [{
                icon,
                name: file.name,
                clientName: trimmedName,
                mobile,
                email: trimmedEmail,
                time: 'Just now',
            }, ...prev.slice(0, 19)]);

            // ── Webhook: Send result to external app ──
            try {
                await fetch('https://external-app.com/webhook/result-upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        event: 'test_result_uploaded',
                        client_name: trimmedName,
                        client_mobile: mobile,
                        file_name: file.name,
                        file_size: formatSize(file.size),
                        uploaded_at: new Date().toISOString()
                    })
                });
            } catch (err) {
                // Optionally show error or log
                console.error('Webhook send failed', err);
            }

            setSubmitting(false);
            setName(''); setMobile(''); setEmail(''); setFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            showToast('✅', 'Document uploaded & saved successfully!');
        }, 1200);
    };

    return (
        <div className="app-layout">
            <Sidebar />

            <div className="main-content">
                <div className="topbar">
                    <h1 className="topbar-title">📤 Upload Documents</h1>
                </div>

                <div className="page-content">
                    <div className="two-col">

                        {/* ── LEFT: FORM ── */}
                        <div>
                            <div className="form-card">
                                <div className="form-card-title"><span>📋</span> Client &amp; Document Details</div>

                                <form onSubmit={handleSubmit}>

                                    {/* Name */}
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="client-name">
                                            Client Name <span style={{ color: '#ef4444' }}>*</span>
                                        </label>
                                        <input
                                            id="client-name" className="form-input" type="text"
                                            placeholder="e.g. Ramesh Kumar"
                                            value={name}
                                            onChange={e => setName(e.target.value)}
                                            required
                                        />
                                    </div>

                                    {/* Mobile */}
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="mobile-number">
                                            Mobile Number <span style={{ color: '#ef4444' }}>*</span>
                                        </label>
                                        <input
                                            id="mobile-number" className="form-input" type="tel"
                                            placeholder="e.g. 9876543210" maxLength="10"
                                            value={mobile}
                                            onChange={e => setMobile(e.target.value.replace(/\D/g, ''))}
                                            required
                                        />
                                    </div>

                                    {/* Email */}
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="email-address">
                                            Email Address <span style={{ color: '#ef4444' }}>*</span>
                                        </label>
                                        <input
                                            id="email-address" className="form-input" type="email"
                                            placeholder="e.g. ramesh@gmail.com"
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            required
                                        />
                                    </div>

                                    {/* Document Type */}
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="doc-type">
                                            Document Type <span style={{ color: '#ef4444' }}>*</span>
                                        </label>
                                        <select
                                            id="doc-type" className="form-input"
                                            value={type}
                                            onChange={e => setType(e.target.value)}
                                            required
                                            style={{
                                                appearance: 'none',
                                                background: 'rgba(255, 255, 255, 0.03)',
                                                cursor: 'pointer',
                                                padding: '12px 16px',
                                                width: '100%',
                                                color: '#fff',
                                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                                borderRadius: '12px',
                                                outline: 'none'
                                            }}
                                        >
                                            <option value="Aadhaar Card">Aadhaar Card</option>
                                            <option value="PAN Card">PAN Card</option>
                                            <option value="ITR Filing">ITR Filing</option>
                                            <option value="GST Return">GST Return</option>
                                            <option value="Tax Document (.tax)">Tax Document (.tax)</option>
                                            <option value="Bank Statement">Bank Statement</option>
                                            <option value="Form 16">Form 16</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>

                                    {/* File Upload */}
                                    <div className="form-group">
                                        <label className="form-label">
                                            Upload Document <span style={{ color: '#ef4444' }}>*</span>
                                        </label>
                                        {!file ? (
                                            <div
                                                className={`upload-zone${isDragOver ? ' dragover' : ''}`}
                                                onClick={() => fileInputRef.current?.click()}
                                                onDragOver={handleDragOver}
                                                onDragLeave={handleDragLeave}
                                                onDrop={handleDrop}
                                            >
                                                <div className="upload-icon">📂</div>
                                                <div className="upload-text"><strong>Click to browse</strong> or drag &amp; drop</div>
                                                <div className="upload-hint">PDF, JPG, PNG, XLSX, TAX — Max 20 MB</div>
                                            </div>
                                        ) : (
                                            <div className="file-preview-wrap">
                                                <div className="file-preview">
                                                    <span className="file-preview-icon">{getFileIcon(file.name)}</span>
                                                    <span className="file-preview-name">{file.name}</span>
                                                    <span className="file-preview-size">{formatSize(file.size)}</span>
                                                    <button type="button" className="file-remove" onClick={removeFile}>✕</button>
                                                </div>
                                            </div>
                                        )}
                                        <input
                                            type="file" ref={fileInputRef}
                                            accept=".pdf,.jpg,.jpeg,.png,.docx,.doc,.xlsx,.tax"
                                            style={{ display: 'none' }}
                                            onChange={e => handleFileSelect(e.target.files[0])}
                                        />
                                    </div>

                                    <button
                                        type="submit" className="btn-submit"
                                        disabled={submitting}
                                        style={{ opacity: submitting ? 0.75 : 1 }}
                                    >
                                        <span>{submitting ? '⏳' : '📤'}</span>
                                        {submitting ? ' Uploading…' : ' Submit Document'}
                                    </button>
                                </form>
                            </div>
                        </div>

                        {/* ── RIGHT: RECENT UPLOADS ── */}
                        <div>
                            <div className="form-card">
                                <div className="form-card-title"><span>🕐</span> Recently Uploaded</div>

                                {recentUploads.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '40px 20px', color: '#475569', fontSize: '14px' }}>
                                        <div style={{ fontSize: '36px', marginBottom: '10px' }}>📭</div>
                                        No uploads yet.<br />Submit a document to see it here.
                                    </div>
                                ) : (
                                    <div className="recent-list">
                                        {recentUploads.map((u, i) => (
                                            <div key={i} className="recent-item">
                                                <span className="recent-doc-icon">{u.icon}</span>
                                                <div className="recent-doc-info">
                                                    <div className="recent-doc-name">{u.name}</div>
                                                    <div className="recent-doc-meta">
                                                        {u.clientName} &nbsp;•&nbsp; {u.mobile} &nbsp;•&nbsp; {u.email}
                                                    </div>
                                                </div>
                                                <span className="recent-doc-time">{u.time}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            <Toast toast={toast} />
        </div>
    );
}
