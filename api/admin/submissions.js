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
            const { data, error } = await supabase
                .from('submissions')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return res.status(200).json({ submissions: data || [] });
        }

        if (req.method === 'DELETE') {
            const id = req.query?.id;
            if (id) {
                const { error } = await supabase.from('submissions').delete().eq('id', id);
                if (error) throw error;
                return res.status(200).json({ ok: true });
            }
            if (req.query?.all === '1') {
                const { error } = await supabase.from('submissions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                if (error) throw error;
                return res.status(200).json({ ok: true });
            }
            return res.status(400).json({ error: 'id or all=1 required' });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (err) {
        console.error('admin/submissions error:', err.message);
        return res.status(500).json({ error: err.message || 'Server error' });
    }
}
