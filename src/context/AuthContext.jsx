import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../api';

const AuthContext = createContext();

const getTodayDate = () => new Date().toISOString().split('T')[0];

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        try {
            const saved = localStorage.getItem('sp_auth_user');
            if (!saved) return null;
            const parsed = JSON.parse(saved);
            const loginDate = localStorage.getItem('sp_login_date');
            const today = getTodayDate();
            if (!loginDate || loginDate !== today) {
                localStorage.removeItem('sp_auth_user');
                localStorage.removeItem('sp_login_date');
                return null;
            }
            return parsed;
        } catch {
            return null;
        }
    });

    useEffect(() => {
        if (user) {
            localStorage.setItem('sp_auth_user', JSON.stringify(user));
        } else {
            localStorage.removeItem('sp_auth_user');
            localStorage.removeItem('sp_login_date');
        }
    }, [user]);

    useEffect(() => {
        if (!user) return;
        const interval = setInterval(() => {
            const loginDate = localStorage.getItem('sp_login_date');
            const today = getTodayDate();
            if (!loginDate || loginDate !== today) setUser(null);
        }, 60 * 1000);
        return () => clearInterval(interval);
    }, [user]);

    const login = async (role, emailInput = '', passwordInput = '') => {
        try {
            const email = emailInput.toLowerCase().trim();
            const password = passwordInput.trim();
            if (!email || !password) return false;

            // ── Verify via DB bcrypt (pgcrypto) ──────────────────────────
            // Check admins
            const { data: adminRows } = await supabase.rpc('verify_password', {
                p_email: email,
                p_password: password,
                p_table: 'admins'
            });

            if (adminRows?.verified) {
                const { data: adminData } = await supabase
                    .from('admins')
                    .select('id, name, email')
                    .eq('email', email)
                    .eq('status', 'active')
                    .maybeSingle();
                if (adminData) {
                    setUser({ role: 'admin', name: adminData.name, email: adminData.email, id: adminData.id, token: 'admin-' + adminData.id });
                    localStorage.setItem('sp_login_date', getTodayDate());
                    return true;
                }
            }

            // Check staff
            const { data: staffRows } = await supabase.rpc('verify_password', {
                p_email: email,
                p_password: password,
                p_table: 'staff'
            });

            if (staffRows?.verified) {
                const { data: staffData } = await supabase
                    .from('staff')
                    .select('id, name, email')
                    .eq('email', email)
                    .eq('status', 'active')
                    .maybeSingle();
                if (staffData) {
                    setUser({ role: 'staff', name: staffData.name, email: staffData.email, id: staffData.id, token: 'staff-' + staffData.id });
                    localStorage.setItem('sp_login_date', getTodayDate());
                    return true;
                }
            }

            return false;
        } catch (err) {
            console.error('Login failed:', err.message);
            return false;
        }
    };

    const logout = () => setUser(null);

    return (
        <AuthContext.Provider value={{ user, role: user?.role, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
export const useRole = () => {
    const { role } = useAuth();
    return { role };
};