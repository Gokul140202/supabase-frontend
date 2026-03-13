import { useState, useRef, useCallback } from 'react';

export default function useToast() {
    const [toast, setToast] = useState(null);
    const timerRef = useRef(null);

    const showToast = useCallback((icon, msg, error = false) => {
        clearTimeout(timerRef.current);
        setToast({ icon, msg, error, show: true });
        timerRef.current = setTimeout(() => {
            setToast(t => t ? { ...t, show: false } : null);
        }, 3500);
    }, []);

    return { toast, showToast };
}
