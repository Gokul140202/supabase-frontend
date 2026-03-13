import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import useToast from '../hooks/useToast';
import Toast from '../components/Toast';
import useLocalStorage from '../hooks/useLocalStorage';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

export default function CreateStaff() {
    const { role } = useAuth();
    const { toast, showToast } = useToast();
    
    // Redirect if not admin
    if (role !== 'admin') {
        return <Navigate to="/" replace />;
    }

    const initialStaff = [
        { name: 'Suresh Raina', email: 'suresh@company.com', password: 'password123', role: 'ITR Filing', checkIn: '09:00 AM', checkOut: '-', status: 'Present' },
        { name: 'Meera Jasmine', email: 'meera@company.com', password: 'password123', role: 'GST Filing', checkIn: '09:15 AM', checkOut: '-', status: 'Present' },
        { name: 'Vijay Sethu', email: 'vijay@company.com', password: 'password123', role: 'ITR Filing', checkIn: '-', checkOut: '-', status: 'Absent' },
        { name: 'Karthik Sivakumar', email: 'karthik@company.com', password: 'password123', role: 'GST Filing', checkIn: '09:05 AM', checkOut: '-', status: 'Present' },
        { name: 'Anjali Menon', email: 'anjali@company.com', password: 'password123', role: 'ITR Filing', checkIn: '-', checkOut: '-', status: 'Leave' },
    ];

    const [staffList, setStaffList] = useLocalStorage('sp_staff_list_v2', initialStaff);
    const [newStaff, setNewStaff] = useState({ name: '', email: '', password: '', role: 'ITR Filing' });
    
    const handleAddStaff = (e) => {
        e.preventDefault();
        if (!newStaff.name || !newStaff.email || !newStaff.password) {
            showToast('⚠️', 'Please fill all fields (Name, Email, Password)');
            return;
        }
        
        // Check if email already exists
        const emailExists = staffList.some(s => s.email === newStaff.email);
        if (emailExists) {
            showToast('⚠️', 'Email already registered!');
            return;
        }

        setStaffList([{ ...newStaff, checkIn: '-', checkOut: '-', status: 'Absent' }, ...staffList]);
        setNewStaff({ name: '', email: '', password: '', role: 'ITR Filing' });
        showToast('✅', `Staff "${newStaff.name}" created successfully!`);
    };

    const handleDeleteStaff = (email) => {
        if(window.confirm('Are you sure you want to remove this staff member?')) {
            setStaffList(staffList.filter(s => s.email !== email));
            showToast('🗑️', 'Staff removed successfully');
        }
    }

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
                                <label className="form-label">Login Password</label>
                                <input
                                    className="form-input"
                                    type="text"
                                    placeholder="••••••••"
                                    value={newStaff.password}
                                    onChange={e => setNewStaff({ ...newStaff, password: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Assigned Role</label>
                                <select
                                    className="form-input"
                                    value={newStaff.role}
                                    onChange={e => setNewStaff({ ...newStaff, role: e.target.value })}
                                >
                                    <option>ITR Filing</option>
                                    <option>GST Filing</option>
                                    <option>Audit Manager</option>
                                    <option>Tax Assistant</option>
                                    <option>Accountant</option>
                                </select>
                            </div>

                            <button className="btn-primary" type="submit" style={{ marginTop: '8px', justifyContent: 'center' }}>🚀 Create Staff Profile</button>
                        </form>
                    </div>

                    {/* List Section */}
                    <div className="table-card" style={{ alignSelf: 'start' }}>
                         <div className="table-header">
                            <span style={{ fontWeight: 700, fontSize: '15px' }}>👨‍💼 Registered Staff Members</span>
                        </div>
                        <table>
                            <thead>
                                <tr>
                                    <th>Staff Details</th>
                                    <th>Login Info</th>
                                    <th>Role</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {staffList.map((s, idx) => (
                                    <tr key={idx}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--accent-light)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px' }}>
                                                    {s.name.split(' ').map(n => n[0]).join('')}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600 }}>{s.name}</div>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>ID: EMP-{1000 + idx + 1}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ fontSize: '13px', color: '#e2e8f0' }}>{s.email || '-'}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{s.password ? `Pass: ${s.password}` : 'No Password'}</div>
                                        </td>
                                        <td>
                                            <span style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, border: `1px solid rgba(99,102,241,0.3)` }}>
                                                {s.role}
                                            </span>
                                        </td>
                                        <td>
                                            <button className="btn-sm" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }} onClick={() => handleDeleteStaff(s.email)}>🗑️ Remove</button>
                                        </td>
                                    </tr>
                                ))}
                                {staffList.length === 0 && (
                                    <tr>
                                        <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>No staff members registered yet.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <Toast toast={toast} />
        </div>
    );
}
