import { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import Toast from '../components/Toast';
import useToast from '../hooks/useToast';
import { apiFetch } from '../api';

const formatTime = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const raw = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const [y, m, d] = raw.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    if (date.getTime() === today.getTime()) return 'Today';
    if (date.getTime() === yesterday.getTime()) return 'Yesterday';
    return `${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}/${y}`;
};

const calcWorkHours = (checkIn, checkOut) => {
    if (!checkIn || !checkOut) return '—';
    const diff = (new Date(checkOut) - new Date(checkIn)) / 1000 / 60;
    const h = Math.floor(diff / 60);
    const mn = Math.round(diff % 60);
    return `${h}h ${mn}m`;
};

// ═══════════════════════════════════════════════════════════
// STAFF VIEW
// ═══════════════════════════════════════════════════════════
function StaffAttendance({ showToast }) {
    const [today, setToday] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [filterMonth, setFilterMonth] = useState('');
    const [filterYear, setFilterYear] = useState('');

    const fetchData = useCallback(async () => {
        try {
            let histUrl = '/attendance/my/history?limit=60';
            if (filterMonth && filterYear) {
                histUrl += `&month=${filterMonth}&year=${filterYear}`;
            }
            const [todayRes, histRes] = await Promise.all([
                apiFetch('/attendance/my/today'),
                apiFetch(histUrl),
            ]);
            setToday(todayRes.data);
            setHistory(histRes.data || []);
        } catch (err) {
            console.error('Attendance fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [filterMonth, filterYear]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleCheckIn = async () => {
        setActionLoading(true);
        try {
            await apiFetch('/attendance/check-in', { method: 'POST', body: JSON.stringify({}) });
            showToast('👋', 'Checked In Successfully!');
            fetchData();
        } catch (err) {
            showToast('❌', err.message, true);
        } finally {
            setActionLoading(false);
        }
    };

    const handleCheckOut = async () => {
        setActionLoading(true);
        try {
            await apiFetch('/attendance/check-out', { method: 'POST', body: JSON.stringify({}) });
            showToast('🚪', 'Checked Out! Have a great rest!');
            fetchData();
        } catch (err) {
            showToast('❌', err.message, true);
        } finally {
            setActionLoading(false);
        }
    };

    const checkedIn = today?.check_in;
    const checkedOut = today?.check_out;
    const presentDays = history.filter(r => r.status === 'present' || r.status === 'completed').length;

    if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Hero */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1.5fr) 1fr', gap: '24px' }}>
                <div style={{
                    background: !checkedIn
                        ? 'linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(99,102,241,0.02) 100%)'
                        : 'linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(16,185,129,0.02) 100%)',
                    border: `1px solid ${!checkedIn ? 'rgba(99,102,241,0.2)' : 'rgba(16,185,129,0.2)'}`,
                    borderRadius: '24px', padding: '32px', position: 'relative', overflow: 'hidden'
                }}>
                    <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                                Today • {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </div>
                            <h2 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px', color: '#fff' }}>
                                {!checkedIn ? 'Ready for Work?' : checkedOut ? 'Shift Complete!' : 'On Duty ✅'}
                            </h2>
                            <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                                {!checkedIn ? "Don't forget to mark your attendance."
                                    : checkedOut ? `Worked ${calcWorkHours(today.check_in, today.check_out)} today.`
                                    : `Checked in at ${formatTime(today.check_in)}. Have a great day!`}
                            </div>
                        </div>
                        <div>
                            {!checkedIn ? (
                                <button onClick={handleCheckIn} disabled={actionLoading}
                                    style={{ background: 'var(--accent)', color: '#fff', border: 'none', padding: '16px 28px', borderRadius: '16px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', opacity: actionLoading ? 0.6 : 1 }}>
                                    {actionLoading ? '...' : 'Tap to Check-In ✌️'}
                                </button>
                            ) : !checkedOut ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', padding: '12px 20px', borderRadius: '12px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '11px', color: '#34d399', fontWeight: 700 }}>CHECKED IN</div>
                                        <div style={{ fontSize: '20px', color: '#fff', fontWeight: 800 }}>{formatTime(today.check_in)}</div>
                                    </div>
                                    <button onClick={handleCheckOut} disabled={actionLoading}
                                        style={{ background: '#f59e0b', color: '#fff', border: 'none', padding: '14px 28px', borderRadius: '16px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', opacity: actionLoading ? 0.6 : 1 }}>
                                        {actionLoading ? '...' : 'Shift Off 🚪'}
                                    </button>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', padding: '16px 20px', borderRadius: '16px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '11px', color: '#34d399', fontWeight: 700 }}>IN</div>
                                        <div style={{ fontSize: '18px', color: '#fff', fontWeight: 800 }}>{formatTime(today.check_in)}</div>
                                    </div>
                                    <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', padding: '16px 20px', borderRadius: '16px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '11px', color: '#fbbf24', fontWeight: 700 }}>OUT</div>
                                        <div style={{ fontSize: '18px', color: '#fff', fontWeight: 800 }}>{formatTime(today.check_out)}</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Quick Stats */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '20px', padding: '24px', flex: 1, display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div style={{ background: 'rgba(245,158,11,0.1)', width: '52px', height: '52px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>⏱️</div>
                        <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Today's Work</div>
                            <div style={{ fontSize: '17px', fontWeight: 700 }}>{checkedIn && checkedOut ? calcWorkHours(today.check_in, today.check_out) : checkedIn ? 'In Progress...' : 'Not Started'}</div>
                        </div>
                    </div>
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '20px', padding: '24px', flex: 1, display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div style={{ background: 'rgba(16,185,129,0.1)', width: '52px', height: '52px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>📈</div>
                        <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Total Present</div>
                            <div style={{ fontSize: '17px', fontWeight: 700 }}>{presentDays} Days</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* History Table */}
            <div className="table-card">
                <div className="table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <span style={{ fontWeight: 700, fontSize: '15px' }}>📅 My Attendance History</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
                            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: '#fff', padding: '6px 10px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
                            <option value="">All Months</option>
                            {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (
                                <option key={i+1} value={i+1}>{m}</option>
                            ))}
                        </select>
                        <select value={filterYear} onChange={e => setFilterYear(e.target.value)}
                            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: '#fff', padding: '6px 10px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
                            <option value="">All Years</option>
                            {Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - i).map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                        {(filterMonth || filterYear) && (
                            <button onClick={() => { setFilterMonth(''); setFilterYear(''); }}
                                style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                                Clear
                            </button>
                        )}
                    </div>
                </div>
                <table>
                    <thead>
                        <tr><th>Date</th><th>Check In</th><th>Check Out</th><th>Status</th><th>Working Hours</th></tr>
                    </thead>
                    <tbody>
                        {history.length === 0 ? (
                            <tr><td colSpan="5" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No attendance records yet. Check in to start tracking!</td></tr>
                        ) : history.map(r => {
                            const stColor = r.status === 'present' || r.status === 'completed' ? '#34d399' : r.status === 'leave' ? '#fbbf24' : '#f87171';
                            const stBg    = r.status === 'present' || r.status === 'completed' ? 'rgba(16,185,129,0.15)' : r.status === 'leave' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)';
                            const stBorder= r.status === 'present' || r.status === 'completed' ? 'rgba(16,185,129,0.3)'  : r.status === 'leave' ? 'rgba(245,158,11,0.3)'  : 'rgba(239,68,68,0.3)';
                            return (
                                <tr key={r.id}>
                                    <td><strong>{formatDate(r.date)}</strong></td>
                                    <td style={{ color: r.check_in ? '#fff' : 'var(--text-muted)', fontWeight: r.check_in ? 600 : 400 }}>{formatTime(r.check_in)}</td>
                                    <td style={{ color: r.check_out ? '#fff' : 'var(--text-muted)', fontWeight: r.check_out ? 600 : 400 }}>{formatTime(r.check_out)}</td>
                                    <td><span style={{ background: stBg, color: stColor, padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, border: `1px solid ${stBorder}` }}>{r.status}</span></td>
                                    <td style={{ color: 'var(--text-secondary)' }}>{calcWorkHours(r.check_in, r.check_out)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════
// ADMIN VIEW
// ═══════════════════════════════════════════════════════════
function AdminAttendance({ showToast }) {
    const [staffSummary, setStaffSummary] = useState([]);
    const [records, setRecords] = useState([]);
    const [selectedStaff, setSelectedStaff] = useState(null);
    const [staffDetail, setStaffDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filterMonth, setFilterMonth] = useState(() => String(new Date().getMonth() + 1));
    const [filterYear, setFilterYear]   = useState(() => String(new Date().getFullYear()));

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [sumRes, listRes] = await Promise.all([
                apiFetch(`/attendance/admin/summary?year=${filterYear}&month=${filterMonth}`),
                apiFetch(`/attendance/admin/list?year=${filterYear}&month=${filterMonth}`),
            ]);
            setStaffSummary(sumRes.data || []);
            setRecords(listRes.data || []);
        } catch (err) {
            console.error('Admin attendance fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [filterMonth, filterYear]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const openStaffDetail = async (staffId) => {
        setSelectedStaff(staffId);
        try {
            const res = await apiFetch(`/attendance/admin/staff/${staffId}?limit=60&month=${filterMonth}&year=${filterYear}`);
            setStaffDetail(res.data);
        } catch (err) {
            showToast('❌', err.message, true);
        }
    };

    const totalPresent = staffSummary.reduce((s, x) => s + Number(x.present_days || 0), 0);
    const totalHours   = staffSummary.reduce((s, x) => s + Number(x.total_hours  || 0), 0);

    // Staff drill-down
    if (selectedStaff && staffDetail) {
        const s   = staffDetail.staff;
        const sum = staffDetail.summary;
        const det = staffDetail.records?.data || [];
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <button onClick={() => { setSelectedStaff(null); setStaffDetail(null); }}
                    style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '8px 16px', borderRadius: '10px', cursor: 'pointer', width: 'fit-content', fontSize: '13px', fontWeight: 600 }}>
                    ← Back to All Staff
                </button>
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '20px', padding: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--accent-light)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '16px' }}>
                            {s?.name?.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '16px' }}>{s?.name}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{s?.email}</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '24px' }}>
                        {[
                            { label: 'PRESENT', value: sum?.present_days || 0, color: '#34d399' },
                            { label: 'HOURS',   value: sum?.total_hours ? Number(sum.total_hours).toFixed(1) : '0', color: '#60a5fa' },
                        ].map((st, i) => (
                            <div key={i} style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>{st.label}</div>
                                <div style={{ fontSize: '22px', fontWeight: 800, color: st.color }}>{st.value}</div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="table-card">
                    <div className="table-header"><span style={{ fontWeight: 700 }}>📋 {s?.name}'s Records</span></div>
                    <table>
                        <thead><tr><th>Date</th><th>Check In</th><th>Check Out</th><th>Status</th><th>Working Hours</th></tr></thead>
                        <tbody>
                            {det.length === 0
                                ? <tr><td colSpan="5" style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No records</td></tr>
                                : det.map(r => {
                                    const c = r.status === 'present' || r.status === 'completed' ? '#34d399' : '#f87171';
                                    const b = r.status === 'present' || r.status === 'completed' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)';
                                    return (
                                        <tr key={r.id}>
                                            <td style={{ fontWeight: 600 }}>{formatDate(r.date)}</td>
                                            <td style={{ color: r.check_in ? '#fff' : 'var(--text-muted)' }}>{formatTime(r.check_in)}</td>
                                            <td style={{ color: r.check_out ? '#fff' : 'var(--text-muted)' }}>{formatTime(r.check_out)}</td>
                                            <td><span style={{ background: b, color: c, padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>{r.status}</span></td>
                                            <td style={{ color: 'var(--text-secondary)' }}>{calcWorkHours(r.check_in, r.check_out)}</td>
                                        </tr>
                                    );
                                })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Filter */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ fontSize: '15px', fontWeight: 700 }}>📊 {monthNames[Number(filterMonth)-1]} {filterYear} — Staff Overview</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: '#fff', padding: '6px 10px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
                        {monthNames.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                    </select>
                    <select value={filterYear} onChange={e => setFilterYear(e.target.value)}
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: '#fff', padding: '6px 10px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
                        {Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - i).map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                {[
                    { label: 'Total Present', value: totalPresent, icon: '✅', color: '#34d399' },
                    { label: 'Total Hours',   value: totalHours.toFixed(1) + 'h', icon: '⏱️', color: '#60a5fa' },
                ].map((c, i) => (
                    <div key={i} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ fontSize: '22px' }}>{c.icon}</div>
                        <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{c.label}</div>
                            <div style={{ fontSize: '22px', fontWeight: 800, color: c.color }}>{c.value}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Staff Cards */}
            {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
            ) : staffSummary.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '32px', marginBottom: '12px' }}>📭</div>
                    <div>No attendance records for this month.</div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                    {staffSummary.map(s => (
                        <div key={s.staff_id} onClick={() => openStaffDetail(s.staff_id)}
                            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '20px', padding: '24px', cursor: 'pointer', transition: 'all 0.2s' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)';  e.currentTarget.style.transform = 'translateY(0)'; }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--accent-light)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px' }}>
                                    {s.staff_name?.split(' ').map(n => n[0]).join('')}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '14px' }}>{s.staff_name}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.staff_code}</div>
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                                {[
                                    { label: 'Present', value: s.present_days || 0, color: '#34d399', bg: 'rgba(16,185,129,0.1)' },
                                    { label: 'Hours',   value: s.total_hours || 0,   color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
                                ].map((stat, i) => (
                                    <div key={i} style={{ background: stat.bg, borderRadius: '12px', padding: '10px 8px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '20px', fontWeight: 800, color: stat.color }}>{stat.value}</div>
                                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginTop: '2px' }}>{stat.label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* All Records Table */}
            <div className="table-card">
                <div className="table-header">
                    <span style={{ fontWeight: 700, fontSize: '15px' }}>📅 All Records — {monthNames[Number(filterMonth)-1]} {filterYear}</span>
                    <button className="btn-sm" onClick={fetchData}>🔄 Refresh</button>
                </div>
                <table>
                    <thead>
                        <tr><th>Staff</th><th>Date</th><th>Check In</th><th>Check Out</th><th>Hours</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="6" style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>Loading...</td></tr>
                        ) : records.length === 0 ? (
                            <tr><td colSpan="6" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                                No attendance records for this month.<br/>
                                <span style={{ fontSize: '12px' }}>Staff needs to check-in from their dashboard.</span>
                            </td></tr>
                        ) : records.map((r, idx) => {
                            const st  = r.current_status;
                            const c   = st === 'present' || st === 'completed' ? '#34d399' : '#f87171';
                            const bg  = st === 'present' || st === 'completed' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)';
                            const lbl = st === 'completed' ? 'Shift Done' : st === 'present' ? 'Present' : 'Absent';
                            return (
                                <tr key={`${r.staff_id}-${r.date}-${idx}`} style={{ cursor: 'pointer' }} onClick={() => openStaffDetail(r.staff_id)}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--accent-light)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '11px' }}>
                                                {r.staff_name?.split(' ').map(n => n[0]).join('')}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '13px' }}>{r.staff_name}</div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{r.staff_code}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ fontWeight: 600 }}>{formatDate(r.date)}</td>
                                    <td style={{ color: r.check_in ? '#fff' : 'var(--text-muted)' }}>{formatTime(r.check_in)}</td>
                                    <td style={{ color: r.check_out ? '#fff' : 'var(--text-muted)' }}>{formatTime(r.check_out)}</td>
                                    <td style={{ color: 'var(--text-secondary)' }}>{calcWorkHours(r.check_in, r.check_out)}</td>
                                    <td><span style={{ background: bg, color: c, padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>{lbl}</span></td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════
export default function Attendance() {
    const { role } = useAuth();
    const { toast, showToast } = useToast();

    return (
        <div className="app-layout">
            <Sidebar />
            <div className="main-content">
                <div className="topbar">
                    <h1 className="topbar-title">{role === 'admin' ? '📅 Staff & Attendance' : '⏰ My Attendance'}</h1>
                </div>
                <div className="page-content">
                    {role === 'admin'
                        ? <AdminAttendance showToast={showToast} />
                        : <StaffAttendance showToast={showToast} />}
                </div>
            </div>
            <Toast toast={toast} />
        </div>
    );
}