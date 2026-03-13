import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
    const { login } = useAuth();
    const [loading, setLoading] = useState(false);
    const [staffEmail, setStaffEmail] = useState('');
    const [showStaffInput, setShowStaffInput] = useState(false);

    const handleAdminLogin = async () => {
        setLoading(true);
        await login('admin');
        setLoading(false);
    };

    const handleStaffLogin = async () => {
        if (!staffEmail) {
            alert("Please enter a valid staff email id");
            return;
        }
        setLoading(true);
        const success = await login('staff', staffEmail);
        if(!success) {
            alert("Staff not found or check backend connection.");
        }
        setLoading(false);
    };

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'radial-gradient(circle at top left, #1e293b, #0f172a)'
        }}>
            <div style={{
                width: '100%',
                maxWidth: '450px',
                background: 'rgba(30, 41, 59, 0.7)',
                backdropFilter: 'blur(20px)',
                padding: '48px',
                borderRadius: '32px',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                textAlign: 'center'
            }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚖️</div>
                <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '8px', letterSpacing: '-0.5px' }}>Tax Portal</h1>
                <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '40px' }}>Authentication Required</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <button
                        className="btn-primary"
                        style={{
                            padding: '16px',
                            fontSize: '16px',
                            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                            border: 'none',
                            justifyContent: 'center',
                            cursor: 'pointer'
                        }}
                        disabled={loading}
                        onClick={handleAdminLogin}
                    >
                        {loading ? 'Authenticating...' : '🔐 Login as Administrator'}
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '8px 0' }}>
                        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                        <span style={{ fontSize: '12px', color: '#475569' }}>OR</span>
                        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                    </div>

                    {!showStaffInput ? (
                        <button
                            className="btn-sm"
                            style={{
                                padding: '16px',
                                fontSize: '16px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                color: 'white',
                                justifyContent: 'center',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                cursor: 'pointer'
                            }}
                            disabled={loading}
                            onClick={() => setShowStaffInput(true)}
                        >
                            👤 Login as Staff Member
                        </button>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <input 
                                type="email" 
                                placeholder="Enter Staff Email Address" 
                                value={staffEmail}
                                onChange={(e) => setStaffEmail(e.target.value)}
                                style={{ 
                                    padding: '14px', 
                                    borderRadius: '12px', 
                                    border: '1px solid #475569', 
                                    background: 'rgba(0,0,0,0.2)', 
                                    color: 'white', 
                                    fontSize: '14px',
                                    outline: 'none'
                                }}
                            />
                            <button
                                className="btn-sm"
                                style={{
                                    padding: '14px',
                                    fontSize: '14px',
                                    background: '#10b981',
                                    border: 'none',
                                    color: 'white',
                                    justifyContent: 'center',
                                    display: 'flex',
                                    alignItems: 'center',
                                    cursor: 'pointer',
                                    fontWeight: 700,
                                    borderRadius: '12px'
                                }}
                                disabled={loading}
                                onClick={handleStaffLogin}
                            >
                                {loading ? 'Checking...' : 'Sign In'}
                            </button>
                        </div>
                    )}
                </div>

                <p style={{ marginTop: '40px', fontSize: '11px', color: '#475569' }}>
                    Authorized Personnel Only. <br />
                    All sessions are monitored and logged.
                </p>
            </div>
        </div>
    );
}
