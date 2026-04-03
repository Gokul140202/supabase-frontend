import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
    const { login } = useAuth();
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState('none'); // 'none' | 'admin' | 'staff'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!email.trim()) { setError('Please enter your email address'); return; }
        if (!password.trim()) { setError('Please enter your password'); return; }
        setError('');
        setLoading(true);
        const success = await login('auto', email.trim().toLowerCase(), password.trim());
        if (!success) setError('Invalid email or password.');
        setLoading(false);
    };

    const handleBack = () => { setMode('none'); setEmail(''); setPassword(''); setError(''); };

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'radial-gradient(circle at top left, #1e293b, #0f172a)',
        }}>
            <div style={{
                width: '100%',
                maxWidth: '440px',
                background: 'rgba(30, 41, 59, 0.75)',
                backdropFilter: 'blur(20px)',
                padding: '48px',
                borderRadius: '32px',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                textAlign: 'center',
            }}>
                {/* Logo / Brand */}
                <div style={{ marginBottom: '32px' }}>
                    <div style={{
                        width: '72px', height: '72px',
                        background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                        borderRadius: '20px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '32px',
                        margin: '0 auto 20px',
                        boxShadow: '0 8px 24px rgba(99,102,241,0.4)',
                    }}>
                        ⚖️
                    </div>
                    <h1 style={{ fontSize: '26px', fontWeight: 800, marginBottom: '4px', letterSpacing: '-0.5px', color: '#fff' }}>
                        JK FINSTRIDE
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
                        Staff Portal — Authentication Required
                    </p>
                </div>

                {/* Mode: None — 2 buttons */}
                {mode === 'none' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <button
                            style={{
                                padding: '15px',
                                fontSize: '15px',
                                fontWeight: 700,
                                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                                border: 'none',
                                borderRadius: '14px',
                                color: '#fff',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                width: '100%',
                            }}
                            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                            onClick={() => { setMode('admin'); setEmail(''); setPassword(''); setError(''); }}
                        >
                            Login as Administrator
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
                            <span style={{ fontSize: '12px', color: '#475569' }}>OR</span>
                            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
                        </div>

                        <button
                            style={{
                                padding: '15px',
                                fontSize: '15px',
                                fontWeight: 600,
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '14px',
                                color: '#fff',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                width: '100%',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                            onClick={() => { setMode('staff'); setEmail(''); setPassword(''); setError(''); }}
                        >
                            Login as Staff Member
                        </button>
                    </div>
                )}

                {/* Mode: Admin / Staff — Email + Password */}
                {(mode === 'admin' || mode === 'staff') && (
                    <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

                        {/* Role label */}
                        <div style={{
                            background: mode === 'admin' ? 'rgba(99,102,241,0.12)' : 'rgba(16,185,129,0.12)',
                            border: `1px solid ${mode === 'admin' ? 'rgba(99,102,241,0.3)' : 'rgba(16,185,129,0.3)'}`,
                            borderRadius: '12px',
                            padding: '10px 16px',
                            fontSize: '13px',
                            fontWeight: 700,
                            color: mode === 'admin' ? '#a5b4fc' : '#34d399',
                        }}>
                            {mode === 'admin' ? 'Administrator Login' : 'Staff Login'}
                        </div>

                        {/* Email */}
                        <div style={{ textAlign: 'left' }}>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>
                                Email Address
                            </label>
                            <input
                                type="email"
                                placeholder="Enter your email"
                                value={email}
                                onChange={e => { setEmail(e.target.value); setError(''); }}
                                autoFocus
                                disabled={loading}
                                style={{
                                    width: '100%',
                                    padding: '13px 16px',
                                    borderRadius: '12px',
                                    border: error ? '1px solid rgba(239,68,68,0.5)' : '1px solid rgba(255,255,255,0.1)',
                                    background: 'rgba(255,255,255,0.05)',
                                    color: '#fff',
                                    fontSize: '14px',
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                    transition: 'border-color 0.2s',
                                }}
                                onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.6)'}
                                onBlur={e => e.target.style.borderColor = error ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)'}
                            />
                        </div>

                        {/* Password */}
                        <div style={{ textAlign: 'left' }}>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>
                                Password
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={e => { setPassword(e.target.value); setError(''); }}
                                    disabled={loading}
                                    style={{
                                        width: '100%',
                                        padding: '13px 46px 13px 16px',
                                        borderRadius: '12px',
                                        border: error ? '1px solid rgba(239,68,68,0.5)' : '1px solid rgba(255,255,255,0.1)',
                                        background: 'rgba(255,255,255,0.05)',
                                        color: '#fff',
                                        fontSize: '14px',
                                        outline: 'none',
                                        boxSizing: 'border-box',
                                        transition: 'border-color 0.2s',
                                    }}
                                    onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.6)'}
                                    onBlur={e => e.target.style.borderColor = error ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)'}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                                        background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px',
                                        color: '#64748b', padding: '4px',
                                    }}
                                >
                                    {showPassword ? 'Hide' : 'Show'}
                                </button>
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', color: '#f87171', textAlign: 'left' }}>
                                ⚠️ {error}
                            </div>
                        )}

                        {/* Buttons */}
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                type="button"
                                onClick={handleBack}
                                disabled={loading}
                                style={{ flex: 1, padding: '13px', fontSize: '14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#94a3b8', cursor: 'pointer' }}
                            >
                                ← Back
                            </button>
                            <button
                                type="submit"
                                disabled={loading || !email.trim() || !password.trim()}
                                style={{
                                    flex: 2,
                                    padding: '13px',
                                    fontSize: '14px',
                                    fontWeight: 700,
                                    background: (loading || !email.trim() || !password.trim()) ? 'rgba(99,102,241,0.4)' : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                                    border: 'none',
                                    borderRadius: '12px',
                                    color: '#fff',
                                    cursor: (loading || !email.trim() || !password.trim()) ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s',
                                }}
                            >
                                {loading ? '⏳ Verifying...' : 'Sign In'}
                            </button>
                        </div>
                    </form>
                )}

                <p style={{ marginTop: '32px', fontSize: '11px', color: '#334155', lineHeight: 1.6 }}>
                    Authorized Personnel Only.<br />
                    All sessions are monitored and logged.<br />
                    Powered by JHB Automations
                </p>
            </div>
        </div>
    );
}