import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(root, 'supabase-config.js');
const envPath = join(root, '.env');

function loadEnvFile() {
    if (!existsSync(envPath)) return;
    const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const i = t.indexOf('=');
        if (i === -1) continue;
        const key = t.slice(0, i).trim();
        const val = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) process.env[key] = val;
    }
}

loadEnvFile();

const BUILD_VARS = [
    { key: 'SUPABASE_URL', hint: 'Supabase → Settings → General → Project URL' },
    { key: 'SUPABASE_ANON_KEY', hint: 'Supabase → Settings → API → anon public' },
];

const missing = BUILD_VARS.filter(({ key }) => !String(process.env[key] || '').trim());

if (missing.length) {
    console.error('\n=== EduLife build to\'xtadi: Environment Variables yo\'q ===\n');
    for (const { key, hint } of missing) {
        console.error(`  • ${key}`);
        console.error(`    ${hint}\n`);
    }
    console.error('Vercel: Settings → Environment Variables');
    console.error('  → Import .env (vercel.env.example ni to\'ldirib)');
    console.error('  → Production + Preview + Development belgilang');
    console.error('  → Deployments → Redeploy\n');
    console.error('Qo\'llanma: DEPLOY-VERCEL-UZ.md\n');
    process.exit(1);
}

const url = process.env.SUPABASE_URL.trim();
const key = process.env.SUPABASE_ANON_KEY.trim();

if (url.includes('/rest/v1')) {
    console.error('SUPABASE_URL noto\'g\'ri: /rest/v1 qo\'shmang.');
    console.error('To\'g\'ri: https://YOUR_PROJECT.supabase.co');
    process.exit(1);
}

const content = `// Auto-generated — gitignore. Lokal: .env | Vercel: Environment Variables

const SUPABASE_URL = '${url.replace(/'/g, "\\'")}';
const SUPABASE_KEY = '${key.replace(/'/g, "\\'")}';

if (typeof supabase !== 'undefined') {
    window.eduSupabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('Supabase initialized successfully.');
} else {
    console.error('Supabase library not found. Make sure the script tag is included before this file.');
}
`;

writeFileSync(outPath, content, 'utf8');
console.log('supabase-config.js yaratildi.');
