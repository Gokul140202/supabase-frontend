import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
    const { login } = useAuth();
    const [loading, setLoading] = useState(false);
    // 'none' | 'admin' | 'staff'
    const [mode, setMode] = useState('none');
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!email.trim()) {
            setError('Please enter your email address');
            return;
        }
        setError('');
        setLoading(true);
        const success = await login('auto', email.trim().toLowerCase());
        if (!success) {
            setError('Email not found or account inactive.');
        }
        setLoading(false);
    };

    const handleAdminClick = () => {
        setMode('admin');
        setEmail('');
        setError('');
    };

    const handleStaffClick = () => {
        setMode('staff');
        setEmail('');
        setError('');
    };

    const handleBack = () => {
        setMode('none');
        setEmail('');
        setError('');
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
                <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '8px', letterSpacing: '-0.5px' }}>
                    Tax Portal
                </h1>
                <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '40px' }}>
                    Authentication Required
                </p>

                {/* ── Default: 2 Buttons ── */}
                {mode === 'none' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <button
                            className="btn-primary"
                            style={{
                                padding: '16px',
                                fontSize: '16px',
                                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                                border: 'none',
                                justifyContent: 'center',
                                cursor: 'pointer',
                            }}
                            onClick={handleAdminClick}
                        >
                            Login as Administrator
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '4px 0' }}>
                            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
                            <span style={{ fontSize: '12px', color: '#475569' }}>OR</span>
                            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
                        </div>

                        <button
                            className="btn-sm"
                            style={{
                                padding: '16px',
                                fontSize: '16px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                color: 'white',
                                cursor: 'pointer',
                            }}
                            onClick={handleStaffClick}
                        >
                            Login as Staff Member
                        </button>
                    </div>
                )}

                {/* ── Admin / Staff Email Input ── */}
                {(mode === 'admin' || mode === 'staff') && (
                    <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                        {/* Role label */}
                        <div style={{
                            background: mode === 'admin' ? 'rgba(99,102,241,0.1)' : 'rgba(16,185,129,0.1)',
                            border: `1px solid ${mode === 'admin' ? 'rgba(99,102,241,0.3)' : 'rgba(16,185,129,0.3)'}`,
                            borderRadius: '10px',
                            padding: '10px 16px',
                            fontSize: '13px',
                            fontWeight: 700,
                            color: mode === 'admin' ? '#a5b4fc' : '#34d399',
                        }}>
                            {mode === 'admin' ? '🔐 Administrator Login' : '👤 Staff Login'}
                        </div>

                        {/* Email input */}
                        <div style={{ textAlign: 'left' }}>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>
                                Email Address
                            </label>
                            <input
                                type="email"
                                placeholder={mode === 'admin' ? 'admin@taxportal.com' : 'staff1@taxportal.com'}
                                value={email}
                                onChange={e => { setEmail(e.target.value); setError(''); }}
                                autoFocus
                                disabled={loading}
                                style={{
                                    width: '100%',
                                    padding: '14px 16px',
                                    borderRadius: '12px',
                                    border: error ? '1px solid rgba(239,68,68,0.5)' : '1px solid rgba(255,255,255,0.1)',
                                    background: 'rgba(255,255,255,0.05)',
                                    color: '#fff',
                                    fontSize: '15px',
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                }}
                                onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.6)'}
                                onBlur={e => e.target.style.borderColor = error ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)'}
                            />
                        </div>

                        {/* Error */}
                        {error && (
                            <div style={{
                                background: 'rgba(239,68,68,0.1)',
                                border: '1px solid rgba(239,68,68,0.3)',
                                borderRadius: '10px',
                                padding: '10px 14px',
                                fontSize: '13px',
                                color: '#f87171',
                                textAlign: 'left',
                            }}>
                                ⚠️ {error}
                            </div>
                        )}

                        {/* Buttons */}
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                type="button"
                                onClick={handleBack}
                                disabled={loading}
                                style={{
                                    flex: 1,
                                    padding: '14px',
                                    fontSize: '14px',
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '12px',
                                    color: '#94a3b8',
                                    cursor: 'pointer',
                                }}
                            >
                                ← Back
                            </button>
                            <button
                                type="submit"
                                disabled={loading || !email.trim()}
                                style={{
                                    flex: 2,
                                    padding: '14px',
                                    fontSize: '15px',
                                    fontWeight: 700,
                                    background: loading || !email.trim()
                                        ? 'rgba(99,102,241,0.4)'
                                        : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                                    border: 'none',
                                    borderRadius: '12px',
                                    color: '#fff',
                                    cursor: loading || !email.trim() ? 'not-allowed' : 'pointer',
                                }}
                            >
                                {loading ? '⏳ Verifying...' : '🔐 Sign In'}
                            </button>
                        </div>
                    </form>
                )}

                <p style={{ marginTop: '40px', fontSize: '11px', color: '#475569' }}>
                    Authorized Personnel Only. <br />
                    All sessions are monitored and logged.
                </p>
            </div>
        </div>
    );
}