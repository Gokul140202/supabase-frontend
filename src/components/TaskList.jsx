import TaskRow from './TaskRow';
import SectionHeader from './SectionHeader';
import EmptyState from './EmptyState';

/**
 * Reusable Task List Component
 * Shows a list of tasks with header and empty state
 * 
 * Props:
 * - tasks: array of task objects
 * - title: section title
 * - icon: header icon
 * - color: accent color for header
 * - bgColor: background color for header
 * - limit: max number to show (optional)
 * - showHeader: boolean (default: true)
 * - showClient: boolean (default: true)
 * - emptyMessage: custom empty state message
 * - emptyIcon: custom empty state icon
 * - onTaskClick: optional click handler
 * - onViewAll: optional view all handler
 */
export default function TaskList({ 
    tasks = [], 
    title = 'Tasks',
    icon = '📋',
    color = '#6366f1',
    bgColor = 'rgba(99,102,241,0.12)',
    limit,
    showHeader = true,
    showClient = true,
    emptyMessage = 'No tasks found',
    emptyIcon = '📋',
    onTaskClick,
    onViewAll
}) {
    const displayTasks = limit ? tasks.slice(0, limit) : tasks;

    return (
        <div>
            {showHeader && (
                <SectionHeader 
                    icon={icon} 
                    label={title} 
                    count={tasks.length} 
                    color={color} 
                    bgColor={bgColor}
                    action={onViewAll ? { label: 'View All →', onClick: onViewAll } : undefined}
                />
            )}
            
            {displayTasks.length === 0 ? (
                <EmptyState 
                    icon={emptyIcon} 
                    title={emptyMessage}
                />
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {displayTasks.map(task => (
                        <TaskRow 
                            key={task.id} 
                            task={task} 
                            showClient={showClient}
                            onClick={onTaskClick}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
