const API_BASE_URL = 'http://localhost:3000/api';

export const getAuthHeaders = () => {
    const userRaw = localStorage.getItem('sp_auth_user');
    if (!userRaw) return {};
    
    const user = JSON.parse(userRaw);
    if (user.token) {
        return { 'Authorization': `Bearer ${user.token}` };
    }
    
    // Fallback for old sessions without JWT token
    if (user.role === 'admin') {
        return { 'x-admin-key': 'test-secret-12345' };
    }
    
    // Staff must have a valid token — force re-login
    return {};
};

export const apiFetch = async (endpoint, options = {}) => {
    const headers = {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
        ...options.headers,
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'API Request failed' }));
        throw new Error(error.message || 'API Request failed');
    }

    return response.json();
};

export const mapBackendTaskToFrontend = (bTask) => {
    let id, taskName, clientName, assignedAt, openedAt, completedAt, staffName, status, docs, docCount;
    
    // Check if format is the nested user requested format or flat backend format
    if (bTask.task && bTask.client && !bTask.client_name) {
        id = bTask.task.id || bTask.id;
        taskName = bTask.task.task_type || bTask.task.taskName;
        clientName = bTask.client.name;
        assignedAt = bTask.task.assigned_at;
        openedAt = bTask.task.started_at;
        completedAt = bTask.task.completed_at;
        staffName = bTask.assignedStaff?.name || 'Unassigned';
        status = bTask.task.status;
        docs = bTask.documents || [];
        docCount = bTask.task.document_count ?? docs.length;
    } else {
        id = bTask.id;
        taskName = bTask.task_type || 'Unknown Task';
        clientName = bTask.client_name || bTask.client_id;
        assignedAt = bTask.assigned_at;
        openedAt = bTask.started_at;
        completedAt = bTask.completed_at;
        staffName = bTask.staff_name || bTask.assigned_staff || 'Unassigned';
        status = bTask.status;
        docs = bTask.documents || [];
        docCount = bTask.document_count ?? docs.length;
    }

    const formatDate = (dateStr) => {
        if (!dateStr || dateStr === '-') return '-';
        try {
            return new Date(dateStr).toLocaleString();
        } catch (e) {
            return dateStr;
        }
    };

    const formatStatus = (s) => {
        if (!s) return 'Pending';
        const lower = s.toLowerCase();
        if (lower === 'completed') return 'Completed';
        if (lower === 'in_progress' || lower === 'in-progress' || lower === 'in_progress') return 'In-Progress';
        if (lower === 'assigned' || lower === 'pending') return 'Pending';
        return 'Pending'; // Default mapped to Pending
    };

    return {
        id,
        task: taskName,
        client: clientName,
        assignedAt: formatDate(assignedAt),
        openedAt: formatDate(openedAt),
        completedAt: formatDate(completedAt),
        users: staffName,
        status: formatStatus(status),
        docs,
        docCount,
        raw: bTask,
    };
};
