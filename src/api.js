import { createClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────
// Supabase Client
// ─────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://wzvzzcuennotfutklulh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6dnp6Y3Vlbm5vdGZ1dGtsdWxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMDY0MjEsImV4cCI6MjA4ODc4MjQyMX0.f3Uk8LSTil0_F9f9V6vg54u3pXL9I88f1a-AkLRuiCI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─────────────────────────────────────────────────────────────────
// Auth helpers (kept for backward compat)
// ─────────────────────────────────────────────────────────────────
export const getAuthHeaders = () => {
    const userRaw = localStorage.getItem('sp_auth_user');
    if (!userRaw) return {};
    try {
        const user = JSON.parse(userRaw);
        if (user.token) return { 'Authorization': `Bearer ${user.token}` };
    } catch {}
    return {};
};

// Get current logged-in staff UUID from localStorage
const getCurrentStaffId = () => {
    const userRaw = localStorage.getItem('sp_auth_user');
    if (!userRaw) return null;
    try {
        const user = JSON.parse(userRaw);
        // Staff users have UUID as id; admin id is 'ADM-01'
        if (user.id && user.id !== 'ADM-01' && user.role === 'staff') return user.id;
        return null;
    } catch { return null; }
};

// ─────────────────────────────────────────────────────────────────
// Supabase select strings with joins
// ─────────────────────────────────────────────────────────────────
const TASK_SELECT = `
    id, task_type, status, assigned_at, started_at, completed_at,
    notes, created_at, updated_at, priority, deadline,
    clients:client_id ( id, name, phone, email, client_code ),
    staff:assigned_staff ( id, name, email, staff_code ),
    documents ( id, file_url, file_name, file_type, doc_type, created_at )
`;

const REWORK_SELECT = `
    id, task_type, status, rework_reason, assigned_at, started_at,
    completed_at, notes, created_at, updated_at, priority,
    clients:client_id ( id, name, phone, email, client_code ),
    staff:assigned_staff ( id, name, email, staff_code ),
    rework_documents ( id, file_url, file_name, file_type, doc_type, created_at )
`;

// ─────────────────────────────────────────────────────────────────
// Map helpers — convert Supabase rows to frontend shape
// ─────────────────────────────────────────────────────────────────
const mapTaskRow = (t) => {
    const docs = t.documents || [];
    const resultDoc = docs.find(d => d.doc_type === 'result');
    return {
        ...t,
        client_name:     t.clients?.name        || null,
        client_phone:    t.clients?.phone       || null,
        client_email:    t.clients?.email       || null,
        client_code:     t.clients?.client_code || null,
        staff_name:      t.staff?.name          || 'Unassigned',
        has_result:      !!resultDoc,
        result_file_url: resultDoc?.file_url    || null,
        document_count:  docs.length,
    };
};

const mapReworkRow = (r) => ({
    ...r,
    client_name:  r.clients?.name        || null,
    client_phone: r.clients?.phone       || null,
    client_email: r.clients?.email       || null,
    client_code:  r.clients?.client_code || null,
    staff_name:   r.staff?.name          || 'Unassigned',
    documents:    r.rework_documents     || [],
});

// Upsert a client by name, return their UUID
const upsertClientByName = async (clientName, phone = null) => {
    const { data: existing } = await supabase
        .from('clients')
        .select('id')
        .eq('name', clientName)
        .maybeSingle();
    if (existing) return existing.id;

    const { data: created, error } = await supabase
        .from('clients')
        .insert({ name: clientName, phone: phone || Date.now().toString().slice(-10) })
        .select('id')
        .single();
    if (error) throw new Error('Client create failed: ' + error.message);
    return created.id;
};

// ─────────────────────────────────────────────────────────────────
// apiFetch — routes URL patterns to Supabase operations
// Response format: { success: true, data: ... } (same as old backend)
// ─────────────────────────────────────────────────────────────────
export const apiFetch = async (endpoint, options = {}) => {
    const method = (options.method || 'GET').toUpperCase();
    let body = null;
    if (options.body) {
        try { body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body; }
        catch { body = options.body; }
    }

    const base = 'http://x';
    const parsed = new URL(endpoint.startsWith('/') ? base + endpoint : endpoint, base);
    const path = parsed.pathname;
    const params = Object.fromEntries(parsed.searchParams);

    try {

        // ── AUTH — Unified login (email auto-detects admin vs staff) ─
        if (path === '/auth/login') {
            const { email } = body || {};
            if (!email) throw new Error('Email required');

            // 1. Check admins table first
            const { data: adminData } = await supabase
                .from('admins')
                .select('id, name, email, status')
                .eq('email', email.toLowerCase())
                .eq('status', 'active')
                .maybeSingle();

            if (adminData) {
                return {
                    success: true,
                    token: 'admin-' + adminData.id,
                    user: { role: 'admin', name: adminData.name, email: adminData.email, id: adminData.id },
                };
            }

            // 2. Check staff table
            const { data: staffData, error: staffError } = await supabase
                .from('staff')
                .select('id, name, email, staff_code, category, status')
                .eq('email', email.toLowerCase())
                .eq('status', 'active')
                .maybeSingle();

            if (staffData) {
                return {
                    success: true,
                    token: 'staff-' + staffData.id,
                    user: { role: 'staff', name: staffData.name, email: staffData.email, id: staffData.id },
                };
            }

            throw new Error('Email not found or account inactive');
        }

        // ── AUTH — Legacy endpoints (backward compat) ────────────
        if (path === '/auth/admin/login') {
            return {
                success: true,
                token: 'admin-token',
                user: { role: 'admin', name: 'Administrator', email: 'admin@taxportal.com', id: 'ADM-01' },
            };
        }

        if (path === '/auth/staff/login') {
            const { email } = body || {};
            if (!email) throw new Error('Email required');
            const { data, error } = await supabase
                .from('staff')
                .select('id, name, email, staff_code, category, status')
                .eq('email', email)
                .eq('status', 'active')
                .single();
            if (error || !data) throw new Error('Staff not found or inactive');
            return {
                success: true,
                token: 'staff-' + data.id,
                user: { role: 'staff', name: data.name, email: data.email, id: data.id },
            };
        }

        // ── DASHBOARD ────────────────────────────────────────────
        if (path === '/admin/dashboard') {
            const [{ count: totalClients }, { count: totalTasks }] = await Promise.all([
                supabase.from('clients').select('id', { count: 'exact', head: true }),
                supabase.from('tasks').select('id', { count: 'exact', head: true }),
            ]);
            return { success: true, data: { totalClients: totalClients || 0, totalTasks: totalTasks || 0 } };
        }

        // ── TASKS ────────────────────────────────────────────────
        if (path === '/admin/tasks' && method === 'GET') {
            const { data, error } = await supabase
                .from('tasks').select(TASK_SELECT).order('created_at', { ascending: false });
            if (error) throw error;
            return { success: true, data: (data || []).map(mapTaskRow) };
        }

        if (path === '/staff/tasks' && method === 'GET') {
            const staffId = getCurrentStaffId();
            if (!staffId) throw new Error('Not authenticated as staff');
            const { data, error } = await supabase
                .from('tasks').select(TASK_SELECT)
                .eq('assigned_staff', staffId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return { success: true, data: (data || []).map(mapTaskRow) };
        }

        const adminTaskMatch = path.match(/^\/admin\/tasks\/([^/]+)$/);
        if (adminTaskMatch) {
            const id = adminTaskMatch[1];
            if (method === 'GET') {
                const { data, error } = await supabase.from('tasks').select(TASK_SELECT).eq('id', id).single();
                if (error) throw error;
                return { success: true, data: mapTaskRow(data) };
            }
            if (method === 'DELETE') {
                // documents & task_history cascade automatically via FK ON DELETE CASCADE
                const { error } = await supabase.from('tasks').delete().eq('id', id);
                if (error) throw new Error('Delete failed: ' + error.message);
                return { success: true };
            }
        }

        const staffTaskMatch = path.match(/^\/staff\/tasks\/([^/]+)$/);
        if (staffTaskMatch && method === 'GET') {
            const id = staffTaskMatch[1];
            const { data, error } = await supabase.from('tasks').select(TASK_SELECT).eq('id', id).single();
            if (error) throw error;
            return { success: true, data: mapTaskRow(data) };
        }

        if (path === '/staff/tasks/start' && method === 'PATCH') {
            const { taskId } = body || {};
            const { error } = await supabase.from('tasks')
                .update({ status: 'in_progress', started_at: new Date().toISOString() })
                .eq('id', taskId);
            if (error) throw error;
            return { success: true };
        }

        if (path === '/admin/create-task' && method === 'POST') {
            const { clientName, taskType, staffId } = body || {};
            if (!clientName || !taskType || !staffId) throw new Error('clientName, taskType, staffId required');
            const clientId = await upsertClientByName(clientName);
            const { data: task, error } = await supabase.from('tasks')
                .insert({ client_id: clientId, task_type: taskType, assigned_staff: staffId, assigned_at: new Date().toISOString(), status: 'assigned' })
                .select('id').single();
            if (error) throw error;
            await supabase.rpc('increment_task_count', { staff_id: staffId }).maybeSingle();
            return { success: true, data: task };
        }

        // ── CLIENTS ──────────────────────────────────────────────
        if (path === '/admin/clients' && method === 'GET') {
            const { data, error } = await supabase.from('clients').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            return { success: true, data: data || [] };
        }

        const adminClientMatch = path.match(/^\/admin\/clients\/([^/]+)$/);
        if (adminClientMatch && method === 'DELETE') {
            const id = adminClientMatch[1];
            // tasks → documents & task_history cascade via FK ON DELETE CASCADE
            // client → tasks cascade via FK ON DELETE CASCADE
            // reworks delete manually (no cascade from clients)
            await supabase.from('rework_documents').delete().in(
                'rework_id',
                (await supabase.from('reworks').select('id').eq('client_id', id)).data?.map(r => r.id) || []
            );
            await supabase.from('reworks').delete().eq('client_id', id);
            const { error } = await supabase.from('clients').delete().eq('id', id);
            if (error) throw new Error('Delete failed: ' + error.message);
            return { success: true };
        }

        // ── STAFF ────────────────────────────────────────────────
        if (path === '/admin/staff' && method === 'GET') {
            const { data, error } = await supabase.from('staff').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            return { success: true, data: data || [] };
        }

        if (path === '/admin/create-staff' && method === 'POST') {
            const { name, email, category, status } = body || {};
            if (!name || !email) throw new Error('name and email required');
            const categoryArr = Array.isArray(category) ? category : [category || 'General'];
            const { data, error } = await supabase.from('staff')
                .insert({ name, email, category: categoryArr, status: status || 'active' })
                .select().single();
            if (error) throw error;
            return { success: true, data };
        }

        // ── REWORKS ──────────────────────────────────────────────
        if (path === '/admin/reworks' && method === 'GET') {
            const { data, error } = await supabase.from('reworks').select(REWORK_SELECT).order('created_at', { ascending: false });
            if (error) throw error;
            return { success: true, data: (data || []).map(mapReworkRow) };
        }

        if (path === '/staff/reworks' && method === 'GET') {
            const staffId = getCurrentStaffId();
            if (!staffId) throw new Error('Not authenticated as staff');
            const { data, error } = await supabase.from('reworks').select(REWORK_SELECT)
                .eq('assigned_staff', staffId).order('created_at', { ascending: false });
            if (error) throw error;
            return { success: true, data: (data || []).map(mapReworkRow) };
        }

        const adminReworkMatch = path.match(/^\/admin\/reworks\/([^/]+)$/);
        if (adminReworkMatch) {
            const id = adminReworkMatch[1];
            if (method === 'GET') {
                const { data, error } = await supabase.from('reworks').select(REWORK_SELECT).eq('id', id).single();
                if (error) throw error;
                return { success: true, data: mapReworkRow(data) };
            }
            if (method === 'DELETE') {
                await supabase.from('rework_documents').delete().eq('rework_id', id);
                await supabase.from('rework_history').delete().eq('rework_id', id);
                const { error } = await supabase.from('reworks').delete().eq('id', id);
                if (error) throw error;
                return { success: true };
            }
        }

        const staffReworkMatch = path.match(/^\/staff\/reworks\/([^/]+)$/);
        if (staffReworkMatch && method === 'GET') {
            const id = staffReworkMatch[1];
            const { data, error } = await supabase.from('reworks').select(REWORK_SELECT).eq('id', id).single();
            if (error) throw error;
            return { success: true, data: mapReworkRow(data) };
        }

        if (path === '/admin/create-rework' && method === 'POST') {
            const { clientName, taskType, staffId, reworkReason } = body || {};
            if (!clientName || !taskType || !staffId) throw new Error('clientName, taskType, staffId required');
            const clientId = await upsertClientByName(clientName);
            const { data: rework, error } = await supabase.from('reworks')
                .insert({ client_id: clientId, task_type: taskType, assigned_staff: staffId, rework_reason: reworkReason || null, assigned_at: new Date().toISOString(), status: 'assigned' })
                .select('id').single();
            if (error) throw error;
            return { success: true, data: rework };
        }

        if (path === '/reworks/start' && method === 'PATCH') {
            const { reworkId } = body || {};
            const { error } = await supabase.from('reworks')
                .update({ status: 'in_progress', started_at: new Date().toISOString() })
                .eq('id', reworkId);
            if (error) throw error;
            return { success: true };
        }

        // ── ATTENDANCE ───────────────────────────────────────────
        if (path === '/attendance/my/today' && method === 'GET') {
            const staffId = getCurrentStaffId();
            if (!staffId) return { success: true, data: null };
            const today = new Date().toISOString().split('T')[0];
            const { data } = await supabase.from('attendance').select('*').eq('staff_id', staffId).eq('date', today).maybeSingle();
            return { success: true, data };
        }

        if (path === '/attendance/my/history' && method === 'GET') {
            const staffId = getCurrentStaffId();
            if (!staffId) return { success: true, data: [] };
            let query = supabase.from('attendance').select('*').eq('staff_id', staffId).order('date', { ascending: false });
            if (params.month && params.year) {
                const mStr = String(params.month).padStart(2, '0');
                const lastDay = new Date(params.year, params.month, 0).getDate();
                query = query.gte('date', `${params.year}-${mStr}-01`).lte('date', `${params.year}-${mStr}-${lastDay}`);
            }
            if (params.limit) query = query.limit(parseInt(params.limit));
            const { data, error } = await query;
            if (error) throw error;
            return { success: true, data: data || [] };
        }

        if (path === '/attendance/check-in' && method === 'POST') {
            const staffId = getCurrentStaffId();
            if (!staffId) throw new Error('Not authenticated as staff');
            const today = new Date().toISOString().split('T')[0];
            const { data: existing } = await supabase.from('attendance').select('id').eq('staff_id', staffId).eq('date', today).maybeSingle();
            if (existing) throw new Error('Already checked in today');
            const { error } = await supabase.from('attendance').insert({ staff_id: staffId, date: today, check_in: new Date().toISOString(), status: 'present' });
            if (error) throw error;
            return { success: true };
        }

        if (path === '/attendance/check-out' && method === 'POST') {
            const staffId = getCurrentStaffId();
            if (!staffId) throw new Error('Not authenticated as staff');
            const today = new Date().toISOString().split('T')[0];
            const { error } = await supabase.from('attendance').update({ check_out: new Date().toISOString(), status: 'completed' }).eq('staff_id', staffId).eq('date', today);
            if (error) throw error;
            return { success: true };
        }

        if (path === '/attendance/admin/summary' && method === 'GET') {
            const y = params.year  || new Date().getFullYear();
            const m = params.month || (new Date().getMonth() + 1);
            const mStr = String(m).padStart(2, '0');
            const lastDay = new Date(y, m, 0).getDate();
            const start = `${y}-${mStr}-01`, end = `${y}-${mStr}-${lastDay}`;

            const [{ data: staffList }, { data: records }] = await Promise.all([
                supabase.from('staff').select('id, name, email, staff_code').eq('status', 'active'),
                supabase.from('attendance').select('staff_id, status, check_in, check_out').gte('date', start).lte('date', end),
            ]);
            const summary = (staffList || []).map(s => {
                const sr = (records || []).filter(r => r.staff_id === s.id);
                const presentDays = sr.filter(r => r.status === 'present' || r.status === 'completed').length;
                const totalHours = sr.reduce((sum, r) => {
                    if (r.check_in && r.check_out) return sum + (new Date(r.check_out) - new Date(r.check_in)) / 3600000;
                    return sum;
                }, 0);
                return { staff_id: s.id, staff_name: s.name, staff_email: s.email, staff_code: s.staff_code, present_days: presentDays, absent_days: 0, total_hours: totalHours.toFixed(1) };
            });
            return { success: true, data: summary };
        }

        if (path === '/attendance/admin/list' && method === 'GET') {
            const y = params.year  || new Date().getFullYear();
            const m = params.month || (new Date().getMonth() + 1);
            const mStr = String(m).padStart(2, '0');
            const lastDay = new Date(y, m, 0).getDate();
            const start = `${y}-${mStr}-01`, end = `${y}-${mStr}-${lastDay}`;
            const { data, error } = await supabase.from('attendance')
                .select('*, staff:staff_id(id, name, email, staff_code)')
                .gte('date', start).lte('date', end).order('date', { ascending: false });
            if (error) throw error;
            return { success: true, data: (data || []).map(r => ({ ...r, staff_name: r.staff?.name, staff_email: r.staff?.email, staff_code: r.staff?.staff_code, current_status: r.status })) };
        }

        const adminAttStaffMatch = path.match(/^\/attendance\/admin\/staff\/([^/]+)$/);
        if (adminAttStaffMatch && method === 'GET') {
            const staffId = adminAttStaffMatch[1];
            const y = params.year, mo = params.month;

            const { data: staffData } = await supabase.from('staff').select('id, name, email, staff_code').eq('id', staffId).single();
            let q = supabase.from('attendance').select('*').eq('staff_id', staffId).order('date', { ascending: false });
            if (y && mo) {
                const mStr = String(mo).padStart(2, '0');
                const lastDay = new Date(y, mo, 0).getDate();
                q = q.gte('date', `${y}-${mStr}-01`).lte('date', `${y}-${mStr}-${lastDay}`);
            }
            if (params.limit) q = q.limit(parseInt(params.limit));
            const { data: records } = await q;

            const presentDays = (records || []).filter(r => r.status === 'present' || r.status === 'completed').length;
            const totalHours = (records || []).reduce((sum, r) => {
                if (r.check_in && r.check_out) return sum + (new Date(r.check_out) - new Date(r.check_in)) / 3600000;
                return sum;
            }, 0);
            return {
                success: true,
                data: {
                    staff: staffData,
                    summary: { present_days: presentDays, absent_days: 0, total_hours: totalHours.toFixed(1) },
                    records: { data: records || [] },
                },
            };
        }

        throw new Error(`Unknown endpoint: ${path} [${method}]`);

    } catch (err) {
        throw new Error(err.message || 'Supabase request failed');
    }
};

// ─────────────────────────────────────────────────────────────────
// mapBackendTaskToFrontend
// Used by Dashboard, Tasks, Reports, Rework pages
// ─────────────────────────────────────────────────────────────────
export const mapBackendTaskToFrontend = (bTask) => {
    let id, taskName, clientName, assignedAt, openedAt, completedAt, staffName, status, docs, docCount;

    if (bTask.task && bTask.client && !bTask.client_name) {
        // Legacy nested format
        id          = bTask.task.id || bTask.id;
        taskName    = bTask.task.task_type || bTask.task.taskName;
        clientName  = bTask.client.name;
        assignedAt  = bTask.task.assigned_at;
        openedAt    = bTask.task.started_at;
        completedAt = bTask.task.completed_at;
        staffName   = bTask.assignedStaff?.name || 'Unassigned';
        status      = bTask.task.status;
        docs        = bTask.documents || [];
        docCount    = bTask.task.document_count ?? docs.length;
    } else {
        // Flat format from Supabase
        id          = bTask.id;
        taskName    = bTask.task_type || 'Unknown Task';
        clientName  = bTask.client_name || bTask.client_id;
        assignedAt  = bTask.assigned_at;
        openedAt    = bTask.started_at;
        completedAt = bTask.completed_at;
        staffName   = bTask.staff_name || bTask.assigned_staff || 'Unassigned';
        status      = bTask.status;
        docs        = bTask.documents || [];
        docCount    = bTask.document_count ?? docs.length;
    }

    const formatDate = (dateStr) => {
        if (!dateStr || dateStr === '-') return '-';
        try { return new Date(dateStr).toLocaleString(); } catch { return dateStr; }
    };

    const formatStatus = (s) => {
        if (!s) return 'Pending';
        const lower = s.toLowerCase();
        if (lower === 'completed') return 'Completed';
        if (lower === 'in_progress' || lower === 'in-progress') return 'In-Progress';
        if (lower === 'assigned' || lower === 'pending') return 'Pending';
        return 'Pending';
    };

    const resultDoc = Array.isArray(docs) ? docs.find(d => d.doc_type === 'result') : null;

    return {
        id,
        task:        taskName,
        client:      clientName,
        assignedAt:  formatDate(assignedAt),
        openedAt:    formatDate(openedAt),
        completedAt: formatDate(completedAt),
        users:       staffName,
        status:      formatStatus(status),
        docs,
        docCount,
        resultFile:  resultDoc ? { name: resultDoc.file_name, url: resultDoc.file_url } : null,
        raw:         bTask,
    };
};

// ─────────────────────────────────────────────────────────────────
// File Upload Helpers — use these in TaskDetail.jsx & ReworkDetail.jsx
// instead of the direct fetch calls to localhost:3000
//
// TaskDetail.jsx usage:
//   import { uploadDocument } from '../api';
//   const result = await uploadDocument(file, taskId, 'result'); // or 'attachment'
//
// ReworkDetail.jsx usage:
//   import { uploadReworkDocument } from '../api';
//   const result = await uploadReworkDocument(file, reworkId, 'result');
// ─────────────────────────────────────────────────────────────────

export const uploadDocument = async (file, taskId, docType = 'attachment') => {
    if (!file || !taskId) throw new Error('file and taskId required');

    const ext = file.name.split('.').pop();
    const storagePath = `tasks/${taskId}/${docType}_${Date.now()}.${ext}`;

    const { error: storageError } = await supabase.storage
        .from('task-documents')
        .upload(storagePath, file, { upsert: true });
    if (storageError) throw new Error('Storage upload failed: ' + storageError.message);

    const { data: { publicUrl } } = supabase.storage.from('task-documents').getPublicUrl(storagePath);

    const { error: dbError } = await supabase.from('documents').insert({
        task_id:   taskId,
        file_url:  publicUrl,
        file_name: file.name,
        file_type: file.type || ext,
        doc_type:  docType,
    });
    if (dbError) throw new Error('DB insert failed: ' + dbError.message);

    return { file_url: publicUrl, file_name: file.name };
};

export const uploadReworkDocument = async (file, reworkId, docType = 'attachment') => {
    if (!file || !reworkId) throw new Error('file and reworkId required');

    const ext = file.name.split('.').pop();
    const storagePath = `reworks/${reworkId}/${docType}_${Date.now()}.${ext}`;

    const { error: storageError } = await supabase.storage
        .from('rework-documents')
        .upload(storagePath, file, { upsert: true });
    if (storageError) throw new Error('Storage upload failed: ' + storageError.message);

    const { data: { publicUrl } } = supabase.storage.from('rework-documents').getPublicUrl(storagePath);

    const updates = docType === 'result'
        ? { status: 'completed', completed_at: new Date().toISOString() }
        : {};

    await Promise.all([
        supabase.from('rework_documents').insert({
            rework_id: reworkId,
            file_url:  publicUrl,
            file_name: file.name,
            file_type: file.type || ext,
            doc_type:  docType,
        }),
        Object.keys(updates).length
            ? supabase.from('reworks').update(updates).eq('id', reworkId)
            : Promise.resolve(),
    ]);

    return { file_url: publicUrl, file_name: file.name };
};

// ─────────────────────────────────────────────────────────────────
// Realtime helpers (can be used directly by any component)
// ─────────────────────────────────────────────────────────────────
export const fetchTasks = async (staffId = null) => {
    let query = supabase.from('tasks').select(TASK_SELECT).order('assigned_at', { ascending: false });
    if (staffId) query = query.eq('assigned_staff', staffId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data || []).map(t => mapBackendTaskToFrontend(mapTaskRow(t)));
};

export const fetchTaskDocuments = async (taskId) => {
    const { data, error } = await supabase
        .from('documents')
        .select('id, file_url, file_name, file_type, doc_type, created_at')
        .eq('task_id', taskId);
    if (error) throw new Error(error.message);
    return data || [];
};

export const subscribeToNewTasks = (onNewTask) => {
    const channel = supabase.channel('tasks-realtime')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks' },
            (payload) => onNewTask(mapBackendTaskToFrontend(payload.new)))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks' },
            (payload) => onNewTask(mapBackendTaskToFrontend(payload.new)))
        .subscribe();
    return () => supabase.removeChannel(channel);
};