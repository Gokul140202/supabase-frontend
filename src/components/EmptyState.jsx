/**
 * Reusable Empty State Component
 * Shows when no data is available
 * 
 * Props:
 * - icon: emoji or icon string
 * - title: main message
 * - description: optional secondary text
 * - action: optional { label, onClick } for action button
 */
export default function EmptyState({ icon = '📂', title, description, action }) {
    return (
        <div style={{ 
            padding: '40px 20px', 
            textAlign: 'center', 
            color: 'var(--text-muted)', 
            background: 'var(--bg-card)', 
            borderRadius: '14px', 
            border: '1px solid var(--border)' 
        }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>{icon}</div>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>{title}</div>
            {description && (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: action ? '16px' : '0' }}>
                    {description}
                </div>
            )}
            {action && (
                <button className="btn-sm" onClick={action.onClick}>
                    {action.label}
                </button>
            )}
        </div>
    );
}
