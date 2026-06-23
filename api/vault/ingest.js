import { getAdminSupabase } from '../_lib/supabase.js';
import { setCors, handleOptions } from '../_lib/cors.js';

export default async function handler(req, res) {
    setCors(res);
    if (handleOptions(req, res)) return;

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const ingestKey = process.env.EDU_VAULT_INGEST_KEY;
    if (!ingestKey) {
        return res.status(503).json({ error: 'Vault ingest not configured' });
    }

    const provided = req.headers['x-edu-vault-key'] || req.body?.vaultKey;
    if (provided !== ingestKey) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const record = req.body?.record;
    if (!record || !record.vault_id) {
        return res.status(400).json({ error: 'Invalid record' });
    }

    try {
        const supabase = getAdminSupabase();
        const { error } = await supabase.from('submissions_vault').upsert([{
            vault_id: record.vault_id,
            student_name: record.student_name || null,
            student_username: record.student_username || null,
            test_type: record.test_type || null,
            test_key: record.test_key || null,
            level: record.level || null,
            score: record.score,
            percentage: record.percentage,
            group_name: record.group_name || null,
            phone: record.phone || null,
            writing_text: record.writing_text || null,
            speaking_text: record.speaking_text || null,
            section_completion: record.section_completion || {},
            raw_answers: record.raw_answers || {},
            payload: record,
            saved_at: record.saved_at || new Date().toISOString()
        }], { onConflict: 'vault_id' });

        if (error) throw error;
        return res.status(200).json({ ok: true });
    } catch (err) {
        console.error('vault/ingest error:', err.message);
        return res.status(500).json({ error: 'Vault save failed' });
    }
}
