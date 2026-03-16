import { Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Tasks from './pages/Tasks';
import Attendance from './pages/Attendance';
import Reports from './pages/Reports';
import TaskDetail from './pages/TaskDetail';
import Rework from './pages/Rework';
import ReworkDetail from './pages/ReworkDetail';
import Login from './pages/Login';

import Sidebar from './components/Sidebar';
import { useAuth } from './context/AuthContext';

const PlaceholderPage = ({ title }) => (
    <div className="app-layout">
        <Sidebar />
        <div className="main-content">
            <div className="topbar"><h1 className="topbar-title">{title}</h1></div>
            <div className="page-content">
                <div className="table-card" style={{ padding: '40px', textAlign: 'center' }}>
                    <h2 style={{ color: '#94a3b8' }}>Analysis & Dummy Data for {title} coming soon...</h2>
                </div>
            </div>
        </div>
    </div>
);

export default function App() {
    const { user } = useAuth();

    if (!user) {
        return (
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        );
    }

    return (
        <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/tasks/:id" element={<TaskDetail />} />
            <Route path="/rework" element={<Rework />} />
            <Route path="/rework/:id" element={<ReworkDetail />} />
            <Route path="/attendance" element={<Attendance />} />

            <Route path="/reports" element={<Reports />} />

            {/* Keeping others as placeholders but with Sidebar */}
            <Route path="/todo" element={<PlaceholderPage title="To-Do List" />} />

            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}
