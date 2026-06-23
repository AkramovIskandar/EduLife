import { getAdminSupabase } from '../_lib/supabase.js';
import { requireRole } from '../_lib/session.js';
import { setCors, handleOptions } from '../_lib/cors.js';

async function hashPassword(supabase, password) {
    const { data, error } = await supabase.rpc('hash_password', { p_password: password });
    if (error) throw error;
    return data;
}

export default async function handler(req, res) {
    setCors(res);
    if (handleOptions(req, res)) return;

    const session = requireRole(req, 'admin');
    if (!session) {
        return res.status(401).json({ error: 'Admin authentication required' });
    }

    const supabase = getAdminSupabase();

    try {
        if (req.method === 'GET') {
            const { data, error } = await supabase
                .from('student_accounts')
                .select('id, username, display_name, role, created_at')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return res.status(200).json({ students: data || [] });
        }

        if (req.method === 'POST') {
            const { username, password, display_name } = req.body || {};
            if (!username || !password || !display_name) {
                return res.status(400).json({ error: 'All fields required' });
            }
            const password_hash = await hashPassword(supabase, String(password));
            const { data, error } = await supabase
                .from('student_accounts')
                .insert([{
                    username: String(username).trim(),
                    password_hash,
                    display_name: String(display_name).trim(),
                    role: 'student'
                }])
                .select('id, username, display_name, role, created_at')
                .single();
            if (error) {
                if (error.code === '23505') return res.status(409).json({ error: 'Username already exists' });
                throw error;
            }
            return res.status(201).json({ student: data });
        }

        if (req.method === 'PUT') {
            const { id, username, password, display_name } = req.body || {};
            if (!id || !username || !password || !display_name) {
                return res.status(400).json({ error: 'All fields required' });
            }
            const password_hash = await hashPassword(supabase, String(password));
            const { error } = await supabase
                .from('student_accounts')
                .update({
                    username: String(username).trim(),
                    password_hash,
                    display_name: String(display_name).trim()
                })
                .eq('id', id);
            if (error) throw error;
            return res.status(200).json({ ok: true });
        }

        if (req.method === 'DELETE') {
            const id = req.query?.id || req.body?.id;
            if (!id) return res.status(400).json({ error: 'id required' });
            const { error } = await supabase.from('student_accounts').delete().eq('id', id);
            if (error) throw error;
            return res.status(200).json({ ok: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (err) {
        console.error('admin/students error:', err.message);
        return res.status(500).json({ error: err.message || 'Server error' });
    }
}
