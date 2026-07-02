import { verifySession, getBearerToken } from './_lib/session.js';
import { setCors, handleOptions } from './_lib/cors.js';

export default async function handler(req, res) {
    setCors(res);
    if (handleOptions(req, res)) return;

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const token = getBearerToken(req);
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const session = verifySession(token);
        if (!session) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        return res.status(200).json({ valid: true, user: session });
    } catch (err) {
        console.error('Verify handler error:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
