import { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch } from '../api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        const saved = localStorage.getItem('sp_auth_user');
        return saved ? JSON.parse(saved) : null;
    });

    useEffect(() => {
        if (user) {
            localStorage.setItem('sp_auth_user', JSON.stringify(user));
        } else {
            localStorage.removeItem('sp_auth_user');
        }
    }, [user]);

    const login = async (role, emailInput = '') => {
        try {
            // 'auto' mode — email பார்த்து admin or staff decide பண்ணும்
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
                    return true;
                }
                return false;
            }

            // Legacy: direct role login (backward compat)
            if (role === 'admin') {
                const data = await apiFetch('/auth/login', {
                    method: 'POST',
                    body: JSON.stringify({ email: 'admin@taxportal.com' }),
                });
                if (data.success) {
                    setUser({ role: 'admin', name: data.user.name, email: data.user.email, id: data.user.id, token: data.token });
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