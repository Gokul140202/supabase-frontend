import { useNavigate } from 'react-router-dom';

/**
 * Reusable Task Row Component
 * Shows task in a compact row format with client, status, and doc count
 * 
 * Props:
 * - task: { id, task, client, status, docCount, assignedAt }
 * - showClient: boolean (default: true)
 * - onClick: optional click handler
 */
export default function TaskRow({ task, showClient = true, onClick }) {
    const navigate = useNavigate();
    
    const handleClick = () => {
        if (onClick) {
            onClick(task);
        } else {
            navigate(`/tasks/${task.id}`);
        }
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'Completed':
                return { bg: 'rgba(16,185,129,0.15)', color: '#10b981' };
            case 'In-Progress':
                return { bg: 'rgba(99,102,241,0.15)', color: '#6366f1' };
            default:
                return { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' };
        }
    };

    const statusStyle = getStatusStyle(task.status);

    return (
        <div
            onClick={handleClick}
            style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 18px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px',
                border: '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-active)'; e.currentTarget.style.background = 'rgba(99,102,241,0.06)'; e.currentTarget.style.transform = 'translateX(4px)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.transform = 'translateX(0)'; }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{task.task}</div>
                {showClient && (
                    <>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>•</div>
                        <div style={{ fontSize: '12px', color: 'var(--accent)' }}>{task.client}</div>
                    </>
                )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>📂 {task.docCount || 0}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{task.assignedAt}</span>
                <span style={{ 
                    background: statusStyle.bg, 
                    color: statusStyle.color, 
                    padding: '3px 10px', 
                    borderRadius: '6px', 
                    fontSize: '11px', 
                    fontWeight: 700 
                }}>
                    {task.status}
                </span>
                <span style={{ fontSize: '18px', color: 'var(--text-muted)' }}>›</span>
            </div>
        </div>
    );
}
