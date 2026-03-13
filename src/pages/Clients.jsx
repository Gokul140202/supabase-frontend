import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Toast from '../components/Toast';
import useToast from '../hooks/useToast';
import { apiFetch } from '../api';


export default function Clients() {
    const navigate = useNavigate();
    const { toast, showToast } = useToast();
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');

    useEffect(() => {
        const fetchClients = async () => {
            setLoading(true);
            try {
                const response = await apiFetch('/admin/clients');
                if (response.success) {
                    // Map backend data to frontend requirements if needed
                    const mapped = response.data.map(c => ({
                        id: c.id,
                        name: c.name,
                        mobile: c.phone || 'N/A',
                        email: c.email || 'N/A',
                        docs: [] // Documents might need another fetch or join
                    }));
                    setClients(mapped);
                }
            } catch (err) {
                console.error('Fetch clients error:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchClients();
    }, []);

    // Docs list modal
    const [docsClient, setDocsClient] = useState(null);

    // Edit document modal
    const [editDoc, setEditDoc] = useState(null);
    const [editName, setEditName] = useState('');
    const [editFile, setEditFile] = useState(null);
    const [editFilePreview, setEditFilePreview] = useState('');

    // Add document modal
    const [addDocClientId, setAddDocClientId] = useState(null);
    const [newName, setNewName] = useState('');
    const [newType, setNewType] = useState('Other');
    const [newFile, setNewFile] = useState(null);
    const [newFilePreview, setNewFilePreview] = useState('');

    const filtered = clients.filter(c => {
        const q = search.toLowerCase();
        return !q ||
            c.name.toLowerCase().includes(q) ||
            c.id.toLowerCase().includes(q) ||
            c.mobile.includes(q) ||
            c.email.toLowerCase().includes(q);
    });

    /* ── Docs list ── */
    const openDocs = (client) => setDocsClient(client);
    const closeDocs = () => setDocsClient(null);

    /* ── View doc ── */
    const openView = (client, doc) => {
        if (doc.fileUrl) {
            window.open(doc.fileUrl, '_blank');
        } else {
            showToast('⚠️', `"${doc.name}" — No file uploaded yet. Click ✏️ Edit to upload the file.`, true);
        }
    };

    const openEdit = (clientId, doc) => {
        setEditDoc({ clientId, doc });
        setEditName(doc.name);
        setDocsClient(null);
    };
    const closeEdit = () => {
        setEditDoc(null);
        setEditName('');
        setEditFile(null);
        setEditFilePreview('');
    };

    const openAdd = (clientId) => {
        setAddDocClientId(clientId);
        setDocsClient(null);
    };
    const closeAdd = () => {
        setAddDocClientId(null);
        setNewName('');
        setNewType('Other');
        setNewFile(null);
        setNewFilePreview('');
    };

    const handleFileChange = (e, mode = 'edit') => {
        const file = e.target.files[0];
        if (!file) return;
        if (mode === 'edit') {
            setEditFile(file);
            setEditFilePreview(file.name);
            setEditName(file.name.replace(/\.[^/.]+$/, ''));
        } else {
            setNewFile(file);
            setNewFilePreview(file.name);
            setNewName(file.name.replace(/\.[^/.]+$/, ''));
        }
    };

    const getFileIcon = (fileName) => {
        const ext = fileName.split('.').pop().toLowerCase();
        return { pdf: '📕', jpg: '🖼️', jpeg: '🖼️', png: '🖼️', doc: '📝', docx: '📝', xlsx: '📊', xls: '📊', tax: '💸' }[ext] || '📄';
    };

    const saveEdit = () => {
        if (!editName.trim()) { showToast('❌', 'Document name cannot be empty.', true); return; }
        const ext = editFile ? editFile.name.split('.').pop() : editDoc.doc.name.split('.').pop();
        const newSize = editFile ? (editFile.size / (1024 * 1024)).toFixed(1) + ' MB' : editDoc.doc.size;
        const newDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const fileUrl = editFile ? URL.createObjectURL(editFile) : null;

        setClients(prev => prev.map(c => {
            if (c.id !== editDoc.clientId) return c;
            return {
                ...c,
                docs: c.docs.map(d =>
                    d.id === editDoc.doc.id
                        ? {
                            ...d,
                            name: editName.trim() + '.' + ext,
                            icon: getFileIcon(editName.trim() + '.' + ext),
                            ...(editFile && { size: newSize, date: newDate, fileUrl }),
                        }
                        : d
                ),
            };
        }));
        showToast('✅', editFile ? 'File uploaded & document updated!' : 'Document updated successfully!');
        closeEdit();
    };

    const saveAdd = () => {
        if (!newName.trim()) { showToast('❌', 'Document name cannot be empty.', true); return; }
        if (!newFile) { showToast('❌', 'Please select a file to upload.', true); return; }

        const ext = newFile.name.split('.').pop();
        const fullFileName = newName.trim() + '.' + ext;
        const icon = getFileIcon(fullFileName);
        const size = (newFile.size / (1024 * 1024)).toFixed(1) + ' MB';
        const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const fileUrl = URL.createObjectURL(newFile);

        const newDoc = {
            id: 'd' + Date.now(),
            name: fullFileName,
            icon,
            type: newType,
            date: today,
            size,
            fileUrl,
        };

        setClients(prev => prev.map(c => {
            if (c.id !== addDocClientId) return c;
            return { ...c, docs: [...c.docs, newDoc] };
        }));

        showToast('✅', 'New document added successfully!');
        closeAdd();
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
                                placeholder="Search by name, ID, mobile, email…"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <button className="btn-sm green" style={{ opacity: 0.5, cursor: 'default' }}>Search and Select Client to Add Docs</button>
                    </div>
                </div>

                <div className="page-content">
                    <div className="table-card">
                        <div className="table-header">
                            <span className="table-title">All Clients — {filtered.length}</span>
                        </div>
                        <table>
                            <thead>
                                <tr>
                                    <th>Customer ID</th>
                                    <th>Name</th>
                                    <th>Mobile</th>
                                    <th>Email</th>
                                    <th>Documents</th>
                                    <th>Result (Final PDF)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#475569' }}>
                                            No clients found.
                                        </td>
                                    </tr>
                                ) : filtered.map(c => (
                                    <tr key={c.id}>
                                        <td>
                                            <code style={{ background: 'rgba(99,102,241,0.15)', padding: '3px 8px', borderRadius: '6px', fontSize: '12px' }}>
                                                {c.id}
                                            </code>
                                        </td>
                                        <td><strong>{c.name}</strong></td>
                                        <td style={{ color: '#94a3b8', fontSize: '13px' }}>{c.mobile}</td>
                                        <td style={{ color: '#94a3b8', fontSize: '13px' }}>{c.email}</td>
                                        <td>
                                            <button className="btn-sm" onClick={() => openDocs(c)}>
                                                📁 {c.docs.length} Doc{c.docs.length !== 1 ? 's' : ''}
                                            </button>
                                        </td>
                                        <td>
                                            {c.resultFile ? (
                                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                    <button
                                                        className="btn-sm green"
                                                        onClick={() => window.open(c.resultFile.url, '_blank')}
                                                        title={c.resultFile.name}
                                                    >
                                                        📕 Open Result
                                                    </button>
                                                    <button
                                                        className="btn-sm"
                                                        style={{ color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}
                                                        onClick={() => {
                                                            if (window.confirm('Delete this result?')) {
                                                                setClients(prev => prev.map(p => p.id === c.id ? { ...p, resultFile: null } : p));
                                                            }
                                                        }}
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="upload-result-btn">
                                                    <input
                                                        type="file"
                                                        id={`res-upload-${c.id}`}
                                                        accept=".pdf"
                                                        style={{ display: 'none' }}
                                                        onChange={(e) => {
                                                            const file = e.target.files[0];
                                                            if (!file) return;
                                                            const url = URL.createObjectURL(file);
                                                            setClients(prev => prev.map(p => p.id === c.id ? { ...p, resultFile: { name: file.name, url } } : p));
                                                            showToast('✅', `Result PDF uploaded for ${c.name}`);
                                                        }}
                                                    />
                                                    <label htmlFor={`res-upload-${c.id}`} className="btn-sm" style={{ cursor: 'pointer', background: 'rgba(99,102,241,0.1)' }}>
                                                        ⬆️ Upload PDF
                                                    </label>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* ── DOCUMENTS LIST MODAL ── */}
            {docsClient && (
                <div
                    style={{
                        display: 'flex', position: 'fixed', inset: 0, zIndex: 200,
                        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
                        alignItems: 'center', justifyContent: 'center', padding: '20px',
                    }}
                    onClick={e => { if (e.target === e.currentTarget) closeDocs(); }}
                >
                    <div style={{
                        background: '#0f1629', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '20px', padding: '28px', width: '90%', maxWidth: '520px', position: 'relative',
                    }}>
                        <button onClick={closeDocs} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}>✕</button>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <div style={{ fontSize: '17px', fontWeight: 700 }}>📁 {docsClient.name} Documents</div>
                            <div style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 600 }}>Fixed: 5 Document Slots</div>
                        </div>
                        <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>
                            {docsClient.id} &nbsp;|&nbsp; {docsClient.mobile} &nbsp;|&nbsp; {docsClient.email}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {[...Array(5)].map((_, index) => {
                                const doc = docsClient.docs[index];
                                return doc ? (
                                    <div key={doc.id} className="recent-item">
                                        <span className="recent-doc-icon">{doc.icon}</span>
                                        <div className="recent-doc-info">
                                            <div className="recent-doc-name">{doc.name}</div>
                                            <div className="recent-doc-meta">
                                                {doc.type} &nbsp;•&nbsp; {doc.size} &nbsp;•&nbsp; {doc.date}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <button
                                                className="btn-sm"
                                                style={doc.fileUrl
                                                    ? { background: 'rgba(16,185,129,0.15)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.3)' }
                                                    : { background: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }
                                                }
                                                onClick={() => openView(docsClient, doc)}
                                            >
                                                {doc.fileUrl ? '📂 Open' : '👁 View'}
                                            </button>
                                            <button className="btn-sm" onClick={() => openEdit(docsClient.id, doc)}>
                                                ✏️ Edit
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div key={`empty-${index}`} className="recent-item" style={{ opacity: 0.6, borderStyle: 'dashed' }}>
                                        <span className="recent-doc-icon" style={{ opacity: 0.5 }}>📁</span>
                                        <div className="recent-doc-info">
                                            <div className="recent-doc-name" style={{ color: '#64748b' }}>Empty Slot {index + 1}</div>
                                            <div className="recent-doc-meta">No document uploaded</div>
                                        </div>
                                        <button className="btn-sm green" onClick={() => openAdd(docsClient.id)}>
                                            + Upload
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}


            {/* ── EDIT DOCUMENT MODAL ── */}
            {editDoc && (
                <div
                    style={{
                        display: 'flex', position: 'fixed', inset: 0, zIndex: 300,
                        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
                        alignItems: 'center', justifyContent: 'center', padding: '20px',
                    }}
                    onClick={e => { if (e.target === e.currentTarget) closeEdit(); }}
                >
                    <div style={{
                        background: '#0f1629', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '20px', padding: '32px', width: '90%', maxWidth: '440px', position: 'relative',
                    }}>
                        <button onClick={closeEdit} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}>✕</button>

                        <div style={{ fontSize: '17px', fontWeight: 700, marginBottom: '4px' }}>✏️ Edit Document</div>
                        <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '24px' }}>
                            {editDoc.doc.icon} {editDoc.doc.name}
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="edit-doc-name">Document Name</label>
                            <input
                                id="edit-doc-name"
                                className="form-input"
                                type="text"
                                value={editName}
                                onChange={e => setEditName(e.target.value)}
                                placeholder="Enter document name"
                            />
                        </div>


                        <div className="form-group">
                            <label className="form-label">Replace Document File</label>
                            <label htmlFor="edit-doc-file" style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                border: '1.5px dashed rgba(99,102,241,0.45)',
                                borderRadius: '10px', padding: '14px 16px',
                                cursor: 'pointer', transition: 'border-color 0.2s',
                                background: 'rgba(99,102,241,0.05)',
                            }}
                                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(99,102,241,0.85)'}
                                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(99,102,241,0.45)'}
                            >
                                <span style={{ fontSize: '22px' }}>📎</span>
                                <span style={{ fontSize: '13px', color: editFilePreview ? '#a5b4fc' : '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {editFilePreview || 'Click to upload a new file (PDF, JPG, PNG…)'}
                                </span>
                            </label>
                            <input
                                id="edit-doc-file"
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.tax"
                                style={{ display: 'none' }}
                                onChange={(e) => handleFileChange(e, 'edit')}
                            />
                            {editFile && (
                                <div style={{ marginTop: '6px', fontSize: '12px', color: '#4ade80', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    ✅ {editFile.name} &nbsp;·&nbsp; {(editFile.size / (1024 * 1024)).toFixed(1)} MB
                                    <button onClick={() => { setEditFile(null); setEditFilePreview(''); }}
                                        style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '13px', marginLeft: 'auto' }}>✕ Remove</button>
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                            <button className="btn-submit" style={{ margin: 0, flex: 1 }} onClick={saveEdit}>
                                {editFile ? '⬆️ Upload & Save' : 'Save Changes'}
                            </button>
                            <button className="btn-sm" style={{ padding: '12px 20px' }} onClick={closeEdit}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── ADD DOCUMENT MODAL ── */}
            {addDocClientId && (
                <div
                    style={{
                        display: 'flex', position: 'fixed', inset: 0, zIndex: 300,
                        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
                        alignItems: 'center', justifyContent: 'center', padding: '20px',
                    }}
                    onClick={e => { if (e.target === e.currentTarget) closeAdd(); }}
                >
                    <div style={{
                        background: '#0f1629', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '20px', padding: '32px', width: '90%', maxWidth: '440px', position: 'relative',
                    }}>
                        <button onClick={closeAdd} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}>✕</button>

                        <div style={{ fontSize: '17px', fontWeight: 700, marginBottom: '4px' }}>➕ Add New Document</div>
                        <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '24px' }}>
                            Upload a new file for this client.
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="new-doc-name">Document Name</label>
                            <input
                                id="new-doc-name"
                                className="form-input"
                                type="text"
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                placeholder="e.g. Income Tax Proof"
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="new-doc-type">Document Type</label>
                            <select
                                id="new-doc-type"
                                className="form-input"
                                value={newType}
                                onChange={e => setNewType(e.target.value)}
                                style={{ appearance: 'none', cursor: 'pointer' }}
                            >
                                <option value="Aadhaar Card">Aadhaar Card</option>
                                <option value="PAN Card">PAN Card</option>
                                <option value="Passport">Passport</option>
                                <option value="Voter ID">Voter ID</option>
                                <option value="ITR Filing">ITR Filing</option>
                                <option value="GST Return">GST Return</option>
                                <option value="Tax Document (.tax)">Tax Document (.tax)</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Upload File</label>
                            <label htmlFor="new-doc-file" style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                border: '1.5px dashed rgba(99,102,241,0.45)',
                                borderRadius: '10px', padding: '14px 16px',
                                cursor: 'pointer', transition: 'border-color 0.2s',
                                background: 'rgba(99,102,241,0.05)',
                            }}
                                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(99,102,241,0.85)'}
                                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(99,102,241,0.45)'}
                            >
                                <span style={{ fontSize: '22px' }}>📁</span>
                                <span style={{ fontSize: '13px', color: newFilePreview ? '#a5b4fc' : '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {newFilePreview || 'Click to select file (PDF, JPG, TAX…)'}
                                </span>
                            </label>
                            <input
                                id="new-doc-file"
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.tax"
                                style={{ display: 'none' }}
                                onChange={(e) => handleFileChange(e, 'add')}
                            />
                            {newFile && (
                                <div style={{ marginTop: '6px', fontSize: '12px', color: '#4ade80', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    ✅ File ready: {newFile.name}
                                    <button onClick={() => { setNewFile(null); setNewFilePreview(''); }}
                                        style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '13px', marginLeft: 'auto' }}>✕ Remove</button>
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                            <button className="btn-submit" style={{ margin: 0, flex: 1 }} onClick={saveAdd}>
                                📤 Upload & Save
                            </button>
                            <button className="btn-sm" style={{ padding: '12px 20px' }} onClick={closeAdd}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <Toast toast={toast} />
        </div>
    );
}

/* ── VIEW DOCUMENT INFO MODAL ── */
function ViewDocModal({ viewDoc, onClose }) {
    if (!viewDoc) return null;
    const { client, doc } = viewDoc;

    const typeColors = {
        'Aadhaar Card': '#6ee7b7', 'PAN Card': '#a5b4fc', 'Passport': '#fcd34d',
        'Voter ID': '#fb923c', 'Driving License': '#38bdf8', 'Bank Statement': '#4ade80',
        'Form 16': '#c084fc', 'Form 26AS': '#f472b6', 'ITR Filing': '#34d399',
        'GST Return': '#fbbf24', 'TDS Certificate': '#60a5fa', 'Tax Document (.tax)': '#a5b4fc', 'Other': '#94a3b8',
    };
    const badgeColor = typeColors[doc.type] || '#94a3b8';

    return (
        <div
            style={{
                display: 'flex', position: 'fixed', inset: 0, zIndex: 400,
                background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
                alignItems: 'center', justifyContent: 'center', padding: '20px',
            }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div style={{
                background: 'linear-gradient(145deg, #0f1629, #131d35)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '24px', width: '100%', maxWidth: '480px',
                boxShadow: '0 32px 80px rgba(0,0,0,0.7)', overflow: 'hidden',
            }}>
                {/* Header */}
                <div style={{
                    background: 'rgba(99,102,241,0.1)',
                    borderBottom: '1px solid rgba(255,255,255,0.07)',
                    padding: '22px 26px',
                    display: 'flex', alignItems: 'center', gap: '14px',
                }}>
                    <div style={{
                        fontSize: '34px', width: '56px', height: '56px', flexShrink: 0,
                        background: 'rgba(99,102,241,0.15)', borderRadius: '14px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{doc.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {doc.name}
                        </div>
                        <span style={{
                            fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px',
                            background: badgeColor + '22', color: badgeColor,
                            border: '1px solid ' + badgeColor + '55',
                            borderRadius: '6px', padding: '2px 8px',
                        }}>{doc.type}</span>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '22px', cursor: 'pointer', flexShrink: 0 }}>✕</button>
                </div>

                {/* No real file notice */}
                <div style={{
                    margin: '18px 26px 0',
                    background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
                    borderRadius: '10px', padding: '10px 14px',
                    fontSize: '12px', color: '#fcd34d', display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                    ⚠️ No file uploaded yet. Click ✏️ Edit to upload the actual document file.
                </div>

                {/* Client info */}
                <div style={{ padding: '16px 26px 0' }}>
                    <div style={{
                        background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)',
                        borderRadius: '12px', padding: '14px 16px',
                        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px',
                    }}>
                        <VRow label="Client" value={client.name} />
                        <VRow label="Customer ID" value={client.id} mono />
                        <VRow label="Mobile" value={client.mobile} />
                        <VRow label="Email" value={client.email} />
                    </div>
                </div>

                {/* Doc details */}
                <div style={{ padding: '6px 26px 4px' }}>
                    <VLine label="File Name" value={doc.name} />
                    <VLine label="Document Type" value={doc.type} />
                    <VLine label="File Size" value={doc.size} />
                    <VLine label="Uploaded On" value={doc.date} />
                </div>

                <div style={{ padding: '14px 26px 22px', display: 'flex', gap: '10px' }}>
                    <button className="btn-sm" style={{ flex: 1, padding: '12px' }} onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

function VRow({ label, value, mono }) {
    return (
        <div>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>{label}</div>
            <div style={{ fontSize: '13px', fontWeight: 600, fontFamily: mono ? 'monospace' : 'inherit', color: '#e2e8f0' }}>{value}</div>
        </div>
    );
}

function VLine({ label, value }) {
    return (
        <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}>
            <span style={{ fontSize: '13px', color: '#64748b' }}>{label}</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>{value}</span>
        </div>
    );
}
