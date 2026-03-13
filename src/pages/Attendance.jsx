import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import useLocalStorage from '../hooks/useLocalStorage';
import Toast from '../components/Toast';
import useToast from '../hooks/useToast';

export default function Attendance() {
    const { role } = useAuth();
    const [checkInTime, setCheckInTime] = useLocalStorage('sp_checkin', '-');
    const [checkOutTime, setCheckOutTime] = useLocalStorage('sp_checkout', '-');


    const { toast, showToast } = useToast();

    const initialStaff = [
        { name: 'Suresh Raina', role: 'ITR Filing', checkIn: '09:00 AM', checkOut: '-', status: 'Present' },
        { name: 'Meera Jasmine', role: 'GST Filing', checkIn: '09:15 AM', checkOut: '-', status: 'Present' },
        { name: 'Vijay Sethu', role: 'ITR Filing', checkIn: '-', checkOut: '-', status: 'Absent' },
        { name: 'Karthik Sivakumar', role: 'GST Filing', checkIn: '09:05 AM', checkOut: '-', status: 'Present' },
        { name: 'Anjali Menon', role: 'ITR Filing', checkIn: '-', checkOut: '-', status: 'Leave' },
    ];

    const [staffList, setStaffList] = useLocalStorage('sp_staff_list_v2', initialStaff);

    const staffLogs = [
        {
            name: 'Staff Member 1',
            role: 'Test Staff',
            checkIn: checkInTime,
            checkOut: checkOutTime,
            status: checkInTime !== '-' ? (checkOutTime !== '-' ? 'Shift Over' : 'Present') : 'Absent'
        },
        ...staffList
    ];

    const markAttendance = () => {
        const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (checkInTime === '-') {
            setCheckInTime(now);
            showToast('👋', 'Checked In Successfully');
        } else if (checkOutTime === '-') {
            setCheckOutTime(now);
            showToast('🚪', 'Shift Completed. Have a good rest!');
        }
    };

    return (
        <div className="app-layout">
            <Sidebar />
            <div className="main-content">
                <div className="topbar">
                    <h1 className="topbar-title">{role === 'admin' ? '📅 Staff Attendance Monitor' : '⏰ Mark My Attendance'}</h1>
                </div>

                <div className="page-content">
                    {role === 'admin' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            {/* Summary Metrics */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                                {[
                                    { label: 'Total Staff', value: staffLogs.length, icon: '👥', color: '#fff', accent: 'var(--accent)' },
                                    { label: 'Present Today', value: staffLogs.filter(s => s.status === 'Present').length, icon: '✅', color: '#34d399', accent: '#10b981' },
                                    { label: 'Absent', value: staffLogs.filter(s => s.status === 'Absent').length, icon: '❌', color: '#f87171', accent: '#ef4444' },
                                    { label: 'On Leave', value: staffLogs.filter(s => s.status === 'Leave').length, icon: '🌴', color: '#fbbf24', accent: '#f59e0b' },
                                ].map((s, i) => (
                                    <div key={i} style={{
                                        background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px',
                                        padding: '20px', textAlign: 'center', borderBottom: `3px solid ${s.accent}`,
                                        transition: 'all 0.3s',
                                    }}
                                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = 'var(--border-active)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                                    >
                                        <div style={{ fontSize: '20px', marginBottom: '6px' }}>{s.icon}</div>
                                        <div style={{ fontSize: '28px', fontWeight: 800, color: s.color }}>{s.value}</div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Main Attendance Table */}
                            <div className="table-card">
                                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 700, fontSize: '15px' }}>📅 Daily Attendance Logs — {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button className="btn-sm" style={{ padding: '8px 16px', fontSize: '12px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                            📥 Export
                                        </button>
                                    </div>
                                </div>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Staff Member</th>
                                            <th>Role</th>
                                            <th>Check-In</th>
                                            <th>Check-Out</th>
                                            <th>Status</th>
                                            <th>Remarks</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {staffLogs.map((s, idx) => {
                                            const stColor = s.status === 'Present' ? '#34d399' : s.status === 'Leave' ? '#fbbf24' : s.status === 'Shift Over' ? '#60a5fa' : '#f87171';
                                            const stBg = s.status === 'Present' ? 'rgba(16,185,129,0.15)' : s.status === 'Leave' ? 'rgba(245,158,11,0.15)' : s.status === 'Shift Over' ? 'rgba(96,165,250,0.15)' : 'rgba(239,68,68,0.15)';
                                            const stBorder = s.status === 'Present' ? 'rgba(16,185,129,0.3)' : s.status === 'Leave' ? 'rgba(245,158,11,0.3)' : s.status === 'Shift Over' ? 'rgba(96,165,250,0.3)' : 'rgba(239,68,68,0.3)';
                                            return (
                                                <tr key={idx} style={{ transition: 'all 0.2s', cursor: 'pointer' }}>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-light)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '12px' }}>
                                                                {s.name.split(' ').map(n => n[0]).join('')}
                                                            </div>
                                                            <div>
                                                                <div style={{ fontWeight: 600 }}>{s.name}</div>
                                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ID: EMP-{1000 + idx + 1}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style={{ color: 'var(--text-secondary)' }}>{s.role}</td>
                                                    <td style={{ fontWeight: s.checkIn !== '-' ? 600 : 400, color: s.checkIn !== '-' ? '#fff' : 'var(--text-muted)' }}>{s.checkIn}</td>
                                                    <td style={{ fontWeight: s.checkOut !== '-' ? 600 : 400, color: s.checkOut !== '-' ? '#fff' : 'var(--text-muted)' }}>{s.checkOut || '—'}</td>
                                                    <td>
                                                        <span style={{ background: stBg, color: stColor, padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, border: `1px solid ${stBorder}` }}>
                                                            {s.status}
                                                        </span>
                                                    </td>
                                                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                        {s.status === 'Present' ? 'On Time' : s.status === 'Absent' ? 'Uninformed' : s.status === 'Shift Over' ? 'Shift Completed' : 'Approved Leave'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            {/* Top Hero Section */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1.5fr) 1fr', gap: '24px' }}>

                                {/* Status Card */}
                                <div style={{
                                    background: checkInTime === '-' ? 'linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(99,102,241,0.02) 100%)' : 'linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(16,185,129,0.02) 100%)',
                                    border: `1px solid ${checkInTime === '-' ? 'rgba(99,102,241,0.2)' : 'rgba(16,185,129,0.2)'}`,
                                    borderRadius: '24px', padding: '32px', position: 'relative', overflow: 'hidden'
                                }}>
                                    <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                                                Today's Status • {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                            </div>
                                            <h2 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '8px', color: '#fff' }}>
                                                {checkInTime === '-' ? 'Ready for Work?' : 'On Duty'}
                                            </h2>
                                            <div style={{ fontSize: '15px', color: 'var(--text-muted)' }}>
                                                {checkInTime === '-' ? 'Don\'t forget to mark your attendance.' : `You checked in at ${checkInTime}. Have a great day!`}
                                            </div>
                                        </div>

                                        <div>
                                            {checkInTime === '-' ? (
                                                <button
                                                    style={{
                                                        background: 'var(--accent)', color: '#fff', border: 'none', padding: '16px 32px',
                                                        borderRadius: '16px', fontSize: '16px', fontWeight: 700, cursor: 'pointer',
                                                        boxShadow: '0 8px 16px rgba(99, 102, 241, 0.25)', transition: 'all 0.3s'
                                                    }}
                                                    onClick={markAttendance}
                                                    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                                                    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                                                >
                                                    Tap to Check-In ✌️
                                                </button>
                                            ) : checkOutTime === '-' ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                    <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', padding: '12px 24px', borderRadius: '12px', textAlign: 'center' }}>
                                                        <div style={{ fontSize: '12px', color: '#34d399', fontWeight: 700, marginBottom: '2px' }}>CHECKED IN</div>
                                                        <div style={{ fontSize: '20px', color: '#fff', fontWeight: 800 }}>{checkInTime}</div>
                                                    </div>
                                                    <button
                                                        style={{
                                                            background: '#f59e0b', color: '#fff', border: 'none', padding: '16px 32px',
                                                            borderRadius: '16px', fontSize: '16px', fontWeight: 700, cursor: 'pointer',
                                                            boxShadow: '0 8px 16px rgba(245, 158, 11, 0.25)', transition: 'all 0.3s'
                                                        }}
                                                        onClick={markAttendance}
                                                        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                                                        onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                                                    >
                                                        Shift Off 🚪
                                                    </button>
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', gap: '12px' }}>
                                                    <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', padding: '16px 24px', borderRadius: '16px', textAlign: 'center' }}>
                                                        <div style={{ fontSize: '12px', color: '#34d399', fontWeight: 700, marginBottom: '4px' }}>CHECKED IN</div>
                                                        <div style={{ fontSize: '20px', color: '#fff', fontWeight: 800 }}>{checkInTime}</div>
                                                    </div>
                                                    <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', padding: '16px 24px', borderRadius: '16px', textAlign: 'center' }}>
                                                        <div style={{ fontSize: '12px', color: '#fbbf24', fontWeight: 700, marginBottom: '4px' }}>SHIFT OFF</div>
                                                        <div style={{ fontSize: '20px', color: '#fff', fontWeight: 800 }}>{checkOutTime}</div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Decoration */}
                                    <div style={{
                                        position: 'absolute', right: '-10%', top: '-20%', fontSize: '200px', opacity: 0.03, zIndex: 1, pointerEvents: 'none'
                                    }}>
                                        {checkInTime === '-' ? '👋' : '☕'}
                                    </div>
                                </div>

                                {/* Quick Stats */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '20px', padding: '24px', flex: 1, display: 'flex', alignItems: 'center', gap: '20px' }}>
                                        <div style={{ background: 'rgba(245,158,11,0.1)', width: '56px', height: '56px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>⏱️</div>
                                        <div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Shift Timing</div>
                                            <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>09:00 AM - 06:00 PM</div>
                                        </div>
                                    </div>
                                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '20px', padding: '24px', flex: 1, display: 'flex', alignItems: 'center', gap: '20px' }}>
                                        <div style={{ background: 'rgba(16,185,129,0.1)', width: '56px', height: '56px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>📈</div>
                                        <div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>This Month</div>
                                            <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>21 Days Present</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Recent Logs Table */}
                            <div className="table-card">
                                <div className="table-header">
                                    <span style={{ fontWeight: 700, fontSize: '15px' }}>📅 Recent Attendance History</span>
                                </div>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Check In</th>
                                            <th>Check Out</th>
                                            <th>Status</th>
                                            <th>Working Hours</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td><div style={{ fontWeight: 600 }}>Yesterday, Mar 8</div><div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Friday</div></td>
                                            <td>08:55 AM</td>
                                            <td>06:10 PM</td>
                                            <td><span style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, border: '1px solid rgba(16,185,129,0.3)' }}>Present</span></td>
                                            <td style={{ color: 'var(--text-secondary)' }}>9h 15m</td>
                                        </tr>
                                        <tr>
                                            <td><div style={{ fontWeight: 600 }}>Mar 7</div><div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Thursday</div></td>
                                            <td>09:05 AM</td>
                                            <td>06:00 PM</td>
                                            <td><span style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, border: '1px solid rgba(16,185,129,0.3)' }}>Present</span></td>
                                            <td style={{ color: 'var(--text-secondary)' }}>8h 55m</td>
                                        </tr>
                                        <tr>
                                            <td><div style={{ fontWeight: 600 }}>Mar 6</div><div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Wednesday</div></td>
                                            <td>—</td>
                                            <td>—</td>
                                            <td><span style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, border: '1px solid rgba(239,68,68,0.3)' }}>Leave</span></td>
                                            <td style={{ color: 'var(--text-secondary)' }}>—</td>
                                        </tr>
                                        <tr>
                                            <td><div style={{ fontWeight: 600 }}>Mar 5</div><div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Tuesday</div></td>
                                            <td>08:50 AM</td>
                                            <td>06:30 PM</td>
                                            <td><span style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, border: '1px solid rgba(16,185,129,0.3)' }}>Present</span></td>
                                            <td style={{ color: 'var(--text-secondary)' }}>9h 40m</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <Toast toast={toast} />
        </div>
    );
}
