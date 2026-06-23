import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(root, '.env');

if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const i = t.indexOf('=');
        if (i === -1) continue;
        const key = t.slice(0, i).trim();
        const val = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) process.env[key] = val;
    }
}

const required = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'EDU_SESSION_SECRET',
    'ADMIN_USERNAME',
    'ADMIN_PASSWORD',
];

const missing = required.filter((k) => !String(process.env[k] || '').trim());
const secretShort =
    process.env.EDU_SESSION_SECRET && process.env.EDU_SESSION_SECRET.length < 32;

if (missing.length || secretShort) {
    console.error('Yetishmayapti yoki noto\'g\'ri:\n');
    missing.forEach((k) => console.error(`  • ${k}`));
    if (secretShort) console.error('  • EDU_SESSION_SECRET (kamida 32 belgi)');
    console.error('\nLokal: .env.example → .env');
    console.error('Vercel: vercel.env.example → Import .env\n');
    process.exit(1);
}

console.log('Barcha majburiy o\'zgaruvchilar mavjud.');
