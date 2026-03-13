import { useEffect, useRef } from 'react';

export default function Toast({ toast }) {
    const timerRef = useRef(null);

    useEffect(() => {
        // The parent controls show/hide via the `toast` prop
    }, [toast]);

    if (!toast) return null;

    return (
        <div className={`toast${toast.show ? ' show' : ''}${toast.error ? ' error' : ''}`}>
            <span className="toast-icon">{toast.icon}</span>
            <span className="toast-msg">{toast.msg}</span>
        </div>
    );
}
