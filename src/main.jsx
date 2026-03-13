import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { AuthProvider } from './context/AuthContext';

// Auto-clear old/corrupt localStorage data on version mismatch
const APP_VERSION = 'v4'; // Upgraded version for new auth structure
if (localStorage.getItem('sp_version') !== APP_VERSION) {
    localStorage.clear(); // Fresh start for the new auth system
    localStorage.setItem('sp_version', APP_VERSION);
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <AuthProvider>
            <BrowserRouter>
                <App />
            </BrowserRouter>
        </AuthProvider>
    </React.StrictMode>
);
