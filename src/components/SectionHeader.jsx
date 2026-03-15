/**
 * Reusable Section Header Component
 * Shows icon, label, count with colored styling
 * 
 * Props:
 * - icon: emoji or icon string
 * - label: section title
 * - count: number to display
 * - color: accent color (hex)
 * - bgColor: background color (rgba)
 * - action: optional { label, onClick } for action button
 */
export default function SectionHeader({ icon, label, count, color, bgColor, action }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                    width: '32px', height: '32px', borderRadius: '10px', background: bgColor,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px',
                }}>{icon}</div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>{label}</h3>
                <span style={{
                    background: bgColor, color: color, padding: '2px 10px', borderRadius: '8px',
                    fontSize: '12px', fontWeight: 700, border: `1px solid ${color}25`,
                }}>{count}</span>
            </div>
            {action && (
                <button className="btn-sm" onClick={action.onClick}>
                    {action.label}
                </button>
            )}
        </div>
    );
}
