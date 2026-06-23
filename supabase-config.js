// Auto-generated — gitignore. Lokal: .env | Vercel: Environment Variables

const SUPABASE_URL = 'https://xyfwopaavukfwgnaccil.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5ZndvcGFhdnVrZndnbmFjY2lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NTg3ODMsImV4cCI6MjA5NzMzNDc4M30.TTo3ZDEHH1CiQcn1yx2xe_hdviyEvDrvykTYpHRP5vw';

// Initialize Supabase
(function() {
    if (window.supabase && !window.eduSupabase) {
        window.eduSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log('Supabase initialized successfully.');
    } else if (!window.supabase) {
        console.error('Supabase library not found. Make sure the script tag is included before this file.');
    }

    function loadScript(src, next) {
        const s = document.createElement('script');
        s.src = src;
        s.async = false;
        s.onload = () => { if (next) next(); };
        s.onerror = () => { if (next) next(); };
        document.head.appendChild(s);
    }

    loadScript('vault-config.js?v=' + Date.now(), () => loadScript('edu-vault.js?v=' + Date.now()));
})();

