import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, stat } from 'node:fs/promises';

import healthHandler from './api/health.js';
import loginHandler from './api/login.js';
import levelCheckHandler from './api/level-check.js';
import speakingHandler from './api/speaking.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = __dirname;
const port = Number(process.env.PORT || 3000);

await loadEnvFile(path.join(rootDir, '.env'));

const apiRoutes = {
    '/api/health': healthHandler,
    '/api/login': loginHandler,
    '/api/level-check': levelCheckHandler,
    '/api/speaking': speakingHandler
};

const mimeTypes = {
    '.css': 'text/css; charset=utf-8',
    '.gif': 'image/gif',
    '.html': 'text/html; charset=utf-8',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.mp3': 'audio/mpeg',
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain; charset=utf-8',
    '.webp': 'image/webp'
};

const server = http.createServer(async (req, res) => {
    try {
        enhanceResponse(res);

        const url = new URL(req.url || '/', `http://${req.headers.host || `localhost:${port}`}`);
        const pathname = decodeURIComponent(url.pathname);

        if (apiRoutes[pathname]) {
            req.query = Object.fromEntries(url.searchParams.entries());
            req.body = await readRequestBody(req);
            await apiRoutes[pathname](req, res);
            if (!res.writableEnded) res.end();
            return;
        }

        await serveStaticFile(pathname, res);
    } catch (error) {
        console.error('Local dev server error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Local server error.' });
        } else if (!res.writableEnded) {
            res.end();
        }
    }
});

server.listen(port, () => {
    console.log(`EduLife local server running at http://localhost:${port}`);
    console.log(`Speaking API available at http://localhost:${port}/api/speaking`);
});

async function loadEnvFile(envPath) {
    try {
        const content = await readFile(envPath, 'utf8');
        for (const rawLine of content.split(/\r?\n/)) {
            const line = rawLine.trim();
            if (!line || line.startsWith('#')) continue;
            const eqIndex = line.indexOf('=');
            if (eqIndex === -1) continue;
            const key = line.slice(0, eqIndex).trim();
            let value = line.slice(eqIndex + 1).trim();
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            if (!(key in process.env)) {
                process.env[key] = value;
            }
        }
    } catch {}
}

function enhanceResponse(res) {
    res.status = function status(code) {
        res.statusCode = code;
        return res;
    };

    res.json = function json(payload) {
        if (!res.getHeader('Content-Type')) {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
        }
        res.end(JSON.stringify(payload));
        return res;
    };

    res.send = function send(payload) {
        if (typeof payload === 'object' && payload !== null && !Buffer.isBuffer(payload)) {
            return res.json(payload);
        }
        res.end(payload);
        return res;
    };
}

async function readRequestBody(req) {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method || '')) {
        return {};
    }

    const chunks = [];
    for await (const chunk of req) {
        chunks.push(Buffer.from(chunk));
    }

    if (!chunks.length) return {};

    const raw = Buffer.concat(chunks).toString('utf8').trim();
    if (!raw) return {};

    const contentType = String(req.headers['content-type'] || '').toLowerCase();
    if (contentType.includes('application/json')) {
        try {
            return JSON.parse(raw);
        } catch {
            return {};
        }
    }

    return { raw };
}

async function serveStaticFile(requestPath, res) {
    const safePath = normalizePath(requestPath);
    const candidates = buildStaticCandidates(safePath);

    for (const candidate of candidates) {
        try {
            const fileStat = await stat(candidate);
            if (!fileStat.isFile()) continue;

            const ext = path.extname(candidate).toLowerCase();
            const contentType = mimeTypes[ext] || 'application/octet-stream';
            const fileContent = await readFile(candidate);
            res.statusCode = 200;
            res.setHeader('Content-Type', contentType);
            res.end(fileContent);
            return;
        } catch {}
    }

    res.status(404).send('Not found');
}

function normalizePath(requestPath) {
    const trimmed = requestPath === '/' ? '/index.html' : requestPath;
    const normalized = path.posix.normalize(trimmed);
    if (normalized.includes('..')) {
        return '/index.html';
    }
    return normalized;
}

function buildStaticCandidates(safePath) {
    const relativePath = safePath.replace(/^\/+/, '');
    const candidates = [path.join(rootDir, relativePath)];

    if (!path.extname(relativePath)) {
        candidates.push(path.join(rootDir, `${relativePath}.html`));
        candidates.push(path.join(rootDir, relativePath, 'index.html'));
    }

    return candidates;
}
