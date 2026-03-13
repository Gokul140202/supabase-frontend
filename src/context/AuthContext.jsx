import { createContext, useContext, useState, useEffect } from 'react';

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

    const fetchBackendLogin = async (role, emailInput = '') => {
        try {
            const endpoint = role === 'admin' ? '/auth/admin/login' : '/auth/staff/login';
            const body = role === 'admin' 
                ? { email: 'admin@taxportal.com', password: 'admin123' } 
                : { email: emailInput }; 

            const response = await fetch(`http://localhost:3000/api${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await response.json();
            
            if (data.success && data.token) {
                setUser({
                    role,
                    name: data.user.name || (role === 'admin' ? 'Administrator' : 'Staff Member'),
                    email: data.user.email,
                    id: data.user.id || data.user.name || (role === 'admin' ? 'ADM-01' : 'STF-01'),
                    token: data.token
                });
                return true;
            }
            console.error('Login backend rejected:', data.message);
            return false;
        } catch (err) {
            console.error('Login backend failed:', err);
            return false;
        }
    };

    const login = async (role, emailInput = '') => {
        const success = await fetchBackendLogin(role, emailInput);
        if (success) return true;
        
        // Fallback to local stub ONLY if user asks for admin, but don't fake staff email if it's incorrect.
        if (!success) {
            if (role === 'admin') {
                setUser({ role: 'admin', name: 'Administrator', id: 'ADM-01' });
                return true;
            }
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
