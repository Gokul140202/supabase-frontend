import { useState } from 'react';

/**
 * useLocalStorage — useState + localStorage sync
 * Usage: const [value, setValue] = useLocalStorage('key', defaultValue);
 */
export default function useLocalStorage(key, initialValue) {
    const [storedValue, setStoredValue] = useState(() => {
        try {
            const item = window.localStorage.getItem(key);
            if (!item) {
                // Persist initial value so other pages reading this key can find it
                window.localStorage.setItem(key, JSON.stringify(initialValue));
                return initialValue;
            }
            const parsed = JSON.parse(item);
            // If we expect an array but got something else, reset
            if (Array.isArray(initialValue) && !Array.isArray(parsed)) {
                window.localStorage.removeItem(key);
                return initialValue;
            }
            return parsed;
        } catch {
            // Corrupt data — wipe and start fresh
            try { window.localStorage.removeItem(key); } catch { }
            return initialValue;
        }
    });

    const setValue = (value) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (err) {
            console.error('useLocalStorage error:', err);
        }
    };

    return [storedValue, setValue];
}
