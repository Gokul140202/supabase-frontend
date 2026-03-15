import ClientCard from './ClientCard';
import SectionHeader from './SectionHeader';
import EmptyState from './EmptyState';

/**
 * Reusable Client List Component
 * Shows a list of clients with header and empty state
 * 
 * Props:
 * - clients: array of client objects
 * - title: section title (default: 'Clients')
 * - icon: header icon (default: '👥')
 * - variant: 'card' | 'row' | 'grid' (default: 'card')
 * - limit: max number to show (optional)
 * - showHeader: boolean (default: true)
 * - emptyMessage: custom empty state message
 * - onClientClick: optional click handler
 * - onViewAll: optional view all handler
 */
export default function ClientList({ 
    clients = [], 
    title = 'Clients',
    icon = '👥',
    variant = 'card',
    limit,
    showHeader = true,
    emptyMessage = 'No clients found',
    onClientClick,
    onViewAll
}) {
    const displayClients = limit ? clients.slice(0, limit) : clients;

    const getLayout = () => {
        switch (variant) {
            case 'grid':
                return { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' };
            case 'row':
                return { display: 'flex', flexDirection: 'column', gap: '10px' };
            default:
                return { display: 'flex', flexDirection: 'column', gap: '12px' };
        }
    };

    return (
        <div>
            {showHeader && (
                <SectionHeader 
                    icon={icon} 
                    label={title} 
                    count={clients.length} 
                    color="#e879f9" 
                    bgColor="rgba(232,121,249,0.12)"
                    action={onViewAll ? { label: 'View All →', onClick: onViewAll } : undefined}
                />
            )}
            
            {displayClients.length === 0 ? (
                <EmptyState 
                    icon="👥" 
                    title={emptyMessage}
                />
            ) : (
                <div style={getLayout()}>
                    {displayClients.map(client => (
                        <ClientCard 
                            key={client.id} 
                            client={client} 
                            variant={variant === 'grid' ? 'card' : variant}
                            onClick={onClientClick}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
