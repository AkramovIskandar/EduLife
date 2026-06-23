import crypto from 'crypto';

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function getSecret() {
    const secret = process.env.EDU_SESSION_SECRET;
    if (!secret || secret.length < 32) {
        throw new Error('EDU_SESSION_SECRET must be at least 32 characters');
    }
    return secret;
}

export function signSession(payload) {
    const data = { ...payload, exp: Date.now() + MAX_AGE_MS };
    const body = Buffer.from(JSON.stringify(data)).toString('base64url');
    const sig = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
    return `${body}.${sig}`;
}

export function verifySession(token) {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [body, sig] = parts;
    const expected = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
    try {
        const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
        if (!data.exp || data.exp < Date.now()) return null;
        return data;
    } catch {
        return null;
    }
}

export function getBearerToken(req) {
    const header = req.headers.authorization || req.headers.Authorization || '';
    if (header.startsWith('Bearer ')) return header.slice(7).trim();
    return null;
}

export function requireRole(req, role) {
    const token = getBearerToken(req);
    const session = verifySession(token);
    if (!session || session.role !== role) return null;
    return session;
}
