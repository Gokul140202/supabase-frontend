import { useNavigate } from 'react-router-dom';

/**
 * Reusable Client Card Component
 * Shows client details with name, phone, task count, and task types
 * 
 * Props:
 * - client: { id, name, phone, email, taskCount, taskTypes }
 * - variant: 'card' | 'row' (default: 'card')
 * - onClick: optional click handler
 */
export default function ClientCard({ client, variant = 'card', onClick }) {
    const navigate = useNavigate();
    
    const handleClick = () => {
        if (onClick) {
            onClick(client);
        } else {
            navigate(`/clients`);
        }
    };

    if (variant === 'row') {
        return (
            <div
                onClick={handleClick}
                style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 18px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px',
                    border: '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-active)'; e.currentTarget.style.background = 'rgba(232,121,249,0.06)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(232,121,249,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>
                        👤
                    </div>
                    <div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{client.name}</div>
                        <div style={{ fontSize: '12px', color: '#e879f9' }}>📱 {client.phone || 'N/A'}</div>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {(client.taskTypes || []).slice(0, 2).map((type, idx) => (
                        <span key={idx} style={{ 
                            background: 'rgba(245,158,11,0.12)', 
                            color: '#fbbf24', 
                            padding: '3px 8px', 
                            borderRadius: '6px', 
                            fontSize: '11px', 
                            fontWeight: 600 
                        }}>
                            {type}
                        </span>
                    ))}
                    <span style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>
                        {client.taskCount || 0} Tasks
                    </span>
                </div>
            </div>
        );
    }

    // Default card variant
    return (
        <div
            onClick={handleClick}
            style={{
                padding: '18px', background: 'rgba(255,255,255,0.03)', borderRadius: '14px',
                border: '1px solid var(--border)', transition: 'all 0.2s', cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-active)'; e.currentTarget.style.background = 'rgba(232,121,249,0.06)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(232,121,249,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>
                    👤
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>{client.name}</div>
                        <span style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 700 }}>
                            {client.taskCount || 0} {(client.taskCount || 0) === 1 ? 'Task' : 'Tasks'}
                        </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#e879f9', marginBottom: '8px' }}>📱 {client.phone || 'N/A'}</div>
                    {client.email && client.email !== 'N/A' && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>✉️ {client.email}</div>
                    )}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {(client.taskTypes || []).map((type, idx) => (
                            <span key={idx} style={{ 
                                background: 'rgba(245,158,11,0.12)', 
                                color: '#fbbf24', 
                                padding: '3px 8px', 
                                borderRadius: '6px', 
                                fontSize: '11px', 
                                fontWeight: 600,
                                border: '1px solid rgba(245,158,11,0.2)'
                            }}>
                                📋 {type}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
