import { setCors, handleOptions } from './_lib/cors.js';

/** Deploy tekshiruvi — maxfiy ma'lumot qaytarmaydi */
export default async function handler(req, res) {
    setCors(res);
    if (handleOptions(req, res)) return;

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const checks = {
        SUPABASE_URL: !!process.env.SUPABASE_URL,
        SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
        OPENROUTER_API_KEY: !!process.env.OPENROUTER_API_KEY,
        EDU_SESSION_SECRET:
            !!process.env.EDU_SESSION_SECRET &&
            process.env.EDU_SESSION_SECRET.length >= 32,
        ADMIN_USERNAME: !!process.env.ADMIN_USERNAME,
        ADMIN_PASSWORD: !!process.env.ADMIN_PASSWORD,
    };

    const missing = Object.entries(checks)
        .filter(([, ok]) => !ok)
        .map(([name]) => name);

    const hasAnyAiKey = !!process.env.GEMINI_API_KEY || !!process.env.OPENROUTER_API_KEY;
    const filteredMissing = missing.filter((name) => {
        if (name === 'GEMINI_API_KEY' || name === 'OPENROUTER_API_KEY') {
            return !hasAnyAiKey;
        }
        return true;
    });
    const ok = filteredMissing.length === 0;

    return res.status(ok ? 200 : 503).json({
        ok,
        service: 'edulife',
        missing: ok ? undefined : filteredMissing,
        hint: ok ? undefined : 'Vercel Settings → Environment Variables. Qo‘llanma: DEPLOY-VERCEL-UZ.md',
    });
}
