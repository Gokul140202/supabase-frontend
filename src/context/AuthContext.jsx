import { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch } from '../api';

const AuthContext = createContext();

// Today's date string — "2026-03-24"
const getTodayDate = () => new Date().toISOString().split('T')[0];

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        try {
            const saved = localStorage.getItem('sp_auth_user');
            if (!saved) return null;

            const parsed = JSON.parse(saved);

            // ── New day check ─────────────────────────────────────────────
            const loginDate = localStorage.getItem('sp_login_date');
            const today = getTodayDate();

            if (!loginDate || loginDate !== today) {
                // Different day — force logout
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

    // ── Background: every 1 min date change check ─────────────────────────
    useEffect(() => {
        if (!user) return;

        const interval = setInterval(() => {
            const loginDate = localStorage.getItem('sp_login_date');
            const today = getTodayDate();
            if (!loginDate || loginDate !== today) {
                setUser(null); // New day — auto logout
            }
        }, 60 * 1000);

        return () => clearInterval(interval);
    }, [user]);

    const login = async (role, emailInput = '') => {
        try {
            if (role === 'auto') {
                const data = await apiFetch('/auth/login', {
                    method: 'POST',
                    body: JSON.stringify({ email: emailInput }),
                });
                if (data.success) {
                    setUser({
                        role:  data.user.role,
                        name:  data.user.name,
                        email: data.user.email,
                        id:    data.user.id,
                        token: data.token,
                    });
                    localStorage.setItem('sp_login_date', getTodayDate());
                    return true;
                }
                return false;
            }

            if (role === 'admin') {
                const data = await apiFetch('/auth/login', {
                    method: 'POST',
                    body: JSON.stringify({ email: 'admin@taxportal.com' }),
                });
                if (data.success) {
                    setUser({ role: 'admin', name: data.user.name, email: data.user.email, id: data.user.id, token: data.token });
                    localStorage.setItem('sp_login_date', getTodayDate());
                    return true;
                }
            } else {
                if (!emailInput) return false;
                const data = await apiFetch('/auth/login', {
                    method: 'POST',
                    body: JSON.stringify({ email: emailInput }),
                });
                if (data.success) {
                    setUser({ role: data.user.role, name: data.user.name, email: data.user.email, id: data.user.id, token: data.token });
                    localStorage.setItem('sp_login_date', getTodayDate());
                    return true;
                }
            }
        } catch (err) {
            console.error('Login failed:', err.message);
        }
        return false;
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