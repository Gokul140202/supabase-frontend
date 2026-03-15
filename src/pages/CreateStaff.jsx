import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import useToast from '../hooks/useToast';
import Toast from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { apiFetch } from '../api';

export default function CreateStaff() {
    const { role } = useAuth();
    const { toast, showToast } = useToast();
    const [staffList, setStaffList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    
    // Redirect if not admin
    if (role !== 'admin') {
        return <Navigate to="/" replace />;
    }

    const [newStaff, setNewStaff] = useState({ name: '', email: '', category: 'ITR Filing' });
    
    // Fetch staff from backend
    useEffect(() => {
        const fetchStaff = async () => {
            setLoading(true);
            try {
                const res = await apiFetch('/admin/staff');
                if (res.success && res.data) {
                    setStaffList(res.data);
                }
            } catch (err) {
                console.error('Failed to fetch staff:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchStaff();
    }, []);
    
    const handleAddStaff = async (e) => {
        e.preventDefault();
        if (!newStaff.name || !newStaff.email) {
            showToast('⚠️', 'Please fill Name and Email');
            return;
        }
        
        setCreating(true);
        try {
            const res = await apiFetch('/admin/create-staff', {
                method: 'POST',
                body: JSON.stringify({
                    name: newStaff.name,
                    email: newStaff.email,
                    category: newStaff.category,
                    status: 'active'
                })
            });
            
            if (res.success) {
                showToast('✅', `Staff "${newStaff.name}" created successfully!`);
                setNewStaff({ name: '', email: '', category: 'ITR Filing' });
                // Refresh staff list
                const refreshRes = await apiFetch('/admin/staff');
                if (refreshRes.success && refreshRes.data) {
                    setStaffList(refreshRes.data);
                }
            } else {
                showToast('❌', res.message || 'Failed to create staff');
            }
        } catch (err) {
            showToast('❌', err.message || 'Failed to create staff');
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="app-layout">
            <Sidebar />
            <div className="main-content">
                <div className="topbar">
                    <h1 className="topbar-title">👥 Create & Manage Staff</h1>
                </div>

                <div className="page-content" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
                    {/* Form Section */}
                    <div className="form-card" style={{ alignSelf: 'start' }}>
                        <h2 style={{ fontSize: '18px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            ➕ Add New Staff Member
                        </h2>
                        
                        <form onSubmit={handleAddStaff} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div className="form-group">
                                <label className="form-label">Full Name</label>
                                <input
                                    className="form-input"
                                    placeholder="e.g. John Doe"
                                    value={newStaff.name}
                                    onChange={e => setNewStaff({ ...newStaff, name: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Email Address (Username)</label>
                                <input
                                    className="form-input"
                                    type="email"
                                    placeholder="staff@example.com"
                                    value={newStaff.email}
                                    onChange={e => setNewStaff({ ...newStaff, email: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Assigned Category</label>
                                <select
                                    className="form-input"
                                    value={newStaff.category}
                                    onChange={e => setNewStaff({ ...newStaff, category: e.target.value })}
                                >
                                    <option>ITR Filing</option>
                                    <option>GST Filing</option>
                                    <option>Audit Manager</option>
                                    <option>Tax Assistant</option>
                                    <option>Accountant</option>
                                </select>
                            </div>

                            <button 
                                className="btn-primary" 
                                type="submit" 
                                style={{ marginTop: '8px', justifyContent: 'center' }}
                                disabled={creating}
                            >
                                {creating ? '⏳ Creating...' : '🚀 Create Staff Profile'}
                            </button>
                        </form>
                    </div>

                    {/* List Section */}
                    <div className="table-card" style={{ alignSelf: 'start' }}>
                        <div className="table-header">
                            <span style={{ fontWeight: 700, fontSize: '15px' }}>👨‍💼 Registered Staff Members</span>
                            <span style={{ 
                                background: 'rgba(99,102,241,0.15)', 
                                color: '#a5b4fc', 
                                padding: '4px 12px', 
                                borderRadius: '8px', 
                                fontSize: '12px', 
                                fontWeight: 700 
                            }}>
                                {staffList.length} Staff
                            </span>
                        </div>
                        <table>
                            <thead>
                                <tr>
                                    <th>Staff ID</th>
                                    <th>Staff Details</th>
                                    <th>Email</th>
                                    <th>Category</th>
                                    <th>Tasks</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>⏳ Loading...</td>
                                    </tr>
                                ) : staffList.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>No staff members registered yet.</td>
                                    </tr>
                                ) : staffList.map((s, idx) => (
                                    <tr key={s.id}>
                                        <td>
                                            <span style={{ 
                                                background: 'rgba(99,102,241,0.15)', 
                                                color: '#a5b4fc', 
                                                padding: '4px 10px', 
                                                borderRadius: '6px', 
                                                fontSize: '12px', 
                                                fontWeight: 700 
                                            }}>
                                                {s.staff_code || `S${String(idx + 1).padStart(3, '0')}`}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ 
                                                    width: '36px', 
                                                    height: '36px', 
                                                    borderRadius: '50%', 
                                                    background: 'var(--accent-light)', 
                                                    color: 'var(--accent)', 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    justifyContent: 'center', 
                                                    fontWeight: 700, 
                                                    fontSize: '13px' 
                                                }}>
                                                    {s.name?.split(' ').map(n => n[0]).join('') || '?'}
                                                </div>
                                                <div style={{ fontWeight: 600 }}>{s.name}</div>
                                            </div>
                                        </td>
                                        <td style={{ fontSize: '13px', color: '#94a3b8' }}>{s.email || '-'}</td>
                                        <td>
                                            <span style={{ 
                                                background: 'rgba(245,158,11,0.12)', 
                                                color: '#fbbf24', 
                                                padding: '4px 10px', 
                                                borderRadius: '6px', 
                                                fontSize: '11px', 
                                                fontWeight: 700 
                                            }}>
                                                {Array.isArray(s.category) ? s.category.join(', ') : s.category || 'N/A'}
                                            </span>
                                        </td>
                                        <td>
                                            <span style={{ 
                                                background: 'rgba(232,121,249,0.12)', 
                                                color: '#e879f9', 
                                                padding: '4px 10px', 
                                                borderRadius: '6px', 
                                                fontSize: '12px', 
                                                fontWeight: 600 
                                            }}>
                                                {s.task_count || 0} tasks
                                            </span>
                                        </td>
                                        <td>
                                            <span style={{ 
                                                background: s.status === 'active' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)', 
                                                color: s.status === 'active' ? '#34d399' : '#f87171', 
                                                padding: '4px 10px', 
                                                borderRadius: '6px', 
                                                fontSize: '11px', 
                                                fontWeight: 700 
                                            }}>
                                                {s.status === 'active' ? '✓ Active' : '✕ Inactive'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <Toast toast={toast} />
        </div>
    );
}
