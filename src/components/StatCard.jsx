/**
 * Reusable Stat Card Component
 * Shows a metric with icon, value, and label
 * 
 * Props:
 * - icon: emoji or icon string
 * - value: number or string to display
 * - label: description text
 * - color: value text color (optional)
 * - borderColor: left border accent color (optional)
 * - onClick: optional click handler
 */
export default function StatCard({ icon, value, label, color, borderColor, onClick }) {
    return (
        <div 
            className="stat-card" 
            onClick={onClick}
            style={{ 
                cursor: onClick ? 'pointer' : 'default',
                borderLeft: borderColor ? `3px solid ${borderColor}` : undefined,
            }}
        >
            <div style={{ fontSize: '20px' }}>{icon}</div>
            <div className="stat-value" style={{ color: color || 'inherit' }}>{value}</div>
            <div className="stat-label">{label}</div>
        </div>
    );
}
