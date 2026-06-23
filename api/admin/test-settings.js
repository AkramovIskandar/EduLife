import { getAdminSupabase } from '../_lib/supabase.js';
import { requireRole } from '../_lib/session.js';
import { setCors, handleOptions } from '../_lib/cors.js';

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
            const { data, error } = await supabase.from('test_settings').select('test_key, is_enabled');
            if (error) throw error;
            return res.status(200).json({ settings: data || [] });
        }

        if (req.method === 'PUT') {
            const body = req.body;
            const rows = Array.isArray(body) ? body : [body];
            if (!rows.length || !rows[0]?.test_key) {
                return res.status(400).json({ error: 'test_key and is_enabled required' });
            }
            const { error } = await supabase.from('test_settings').upsert(rows, { onConflict: 'test_key' });
            if (error) throw error;
            return res.status(200).json({ ok: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (err) {
        console.error('admin/test-settings error:', err.message);
        return res.status(500).json({ error: err.message || 'Server error' });
    }
}
