import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Sidebar() {
    const { role, logout, user } = useAuth();

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <div style={{ display: 'flex', flexDirection: 'column', padding: '0 16px', gap: '4px' }}>
                    <div className="sidebar-brand" style={{ fontSize: '18px', fontWeight: '800' }}>TAX PORTAL</div>
                    <div style={{
                        fontSize: '10px',
                        color: 'var(--accent)',
                        fontWeight: 700,
                        background: 'rgba(99,102,241,0.1)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        display: 'inline-block',
                        width: 'fit-content'
                    }}>
                        {role.toUpperCase()} MODE
                    </div>
                </div>
            </div>

            <nav className="sidebar-nav">
                <div style={{ padding: '0 16px', marginBottom: '16px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>LOGGED IN AS</div>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{user?.name}</div>
                </div>

                {role === 'admin' ? (
                    <>
                        <NavLink to="/" end className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
                            <span className="nav-icon">📊</span> Admin Dashboard
                        </NavLink>
                        <NavLink to="/tasks" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
                            <span className="nav-icon">➕</span> Assign Tasks
                        </NavLink>
                        <NavLink to="/rework" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
                            <span className="nav-icon">🔄</span> Rework
                        </NavLink>
                        <NavLink to="/clients" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
                            <span className="nav-icon">👥</span> Manage Clients
                        </NavLink>
                        <NavLink to="/attendance" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
                            <span className="nav-icon">📅</span> Staff & Attendance
                        </NavLink>
                        <NavLink to="/staff-management" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
                            <span className="nav-icon">⚙️</span> Staff Management
                        </NavLink>
                        <NavLink to="/reports" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
                            <span className="nav-icon">📈</span> Audit Reports
                        </NavLink>
                    </>
                ) : (
                    <>
                        <NavLink to="/" end className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
                            <span className="nav-icon">🏠</span> My Workspace
                        </NavLink>
                        <NavLink to="/tasks" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
                            <span className="nav-icon">📝</span> My Tasks
                        </NavLink>
                        <NavLink to="/rework" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
                            <span className="nav-icon">🔄</span> Rework
                        </NavLink>
                        <NavLink to="/clients" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
                            <span className="nav-icon">👥</span> Clients List
                        </NavLink>
                        <NavLink to="/attendance" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
                            <span className="nav-icon">📅</span> Attendance
                        </NavLink>
                        <NavLink to="/reports" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
                            <span className="nav-icon">📊</span> My Reports
                        </NavLink>
                    </>
                )}

                <div className="sidebar-divider"></div>

                <button
                    onClick={logout}
                    className="nav-item"
                    style={{ width: '100%', border: 'none', background: 'none', color: '#ef4444', textAlign: 'left', cursor: 'pointer' }}
                >
                    <span className="nav-icon">🚪</span> Logout Session
                </button>
            </nav>
        </aside>
    );
}