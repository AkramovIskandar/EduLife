import crypto from 'crypto';
import { getAdminSupabase } from './_lib/supabase.js';
import { signSession } from './_lib/session.js';
import { setCors, handleOptions } from './_lib/cors.js';

function timingSafeEqual(a, b) {
    const ba = Buffer.from(String(a));
    const bb = Buffer.from(String(b));
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
}

export default async function handler(req, res) {
    setCors(res);
    if (handleOptions(req, res)) return;

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { username, password } = req.body || {};
        const cleanUsername = String(username || '').trim().toLowerCase();
        const pass = String(password || '');

        if (!cleanUsername || !pass) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        const adminUser = (process.env.ADMIN_USERNAME || '').trim().toLowerCase();
        const adminPass = process.env.ADMIN_PASSWORD || '';

        if (adminUser && adminPass && cleanUsername === adminUser && timingSafeEqual(pass, adminPass)) {
            const token = signSession({
                role: 'admin',
                username: adminUser,
                displayName: process.env.ADMIN_DISPLAY_NAME || 'Admin'
            });
            return res.status(200).json({
                token,
                user: {
                    username: adminUser,
                    role: 'admin',
                    displayName: process.env.ADMIN_DISPLAY_NAME || 'Admin'
                }
            });
        }

        const supabase = getAdminSupabase();
        const { data, error } = await supabase.rpc('verify_student_login', {
            p_username: cleanUsername,
            p_password: pass
        });

        if (error) {
            console.error('verify_student_login error:', error.message);
            return res.status(500).json({ error: 'Login service unavailable' });
        }

        const row = Array.isArray(data) ? data[0] : data;
        if (!row) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = signSession({
            role: row.role || 'student',
            username: row.username,
            displayName: row.display_name || row.username,
            level: row.level
        });

        return res.status(200).json({
            token,
            user: {
                username: row.username,
                role: row.role || 'student',
                displayName: row.display_name || row.username,
                level: row.level
            }
        });
    } catch (err) {
        console.error('Login handler error:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
