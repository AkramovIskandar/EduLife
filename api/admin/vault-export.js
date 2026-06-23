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

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const supabase = getAdminSupabase();
        const { data, error } = await supabase
            .from('submissions_vault')
            .select('*')
            .order('saved_at', { ascending: false });

        if (error) throw error;
        return res.status(200).json({ records: data || [], count: (data || []).length });
    } catch (err) {
        console.error('admin/vault-export error:', err.message);
        return res.status(500).json({ error: err.message || 'Server error' });
    }
}
