// Shablon — GitHub da shu fayl turadi. Haqiqiy kalitlar supabase-config.js da (gitignore).
// Lokal: .env yarating va "npm run build" yoki "npm run config" ishga tushiring.

const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_KEY = 'YOUR_ANON_PUBLIC_KEY';

if (typeof supabase !== 'undefined') {
    window.eduSupabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('Supabase initialized successfully.');
} else {
    console.error('Supabase library not found. Make sure the script tag is included before this file.');
}
