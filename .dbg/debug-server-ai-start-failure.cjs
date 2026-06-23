const http = require('http');
const fs = require('fs');
const path = require('path');

const outDir = path.join(process.cwd(), '.dbg');
const logFile = path.join(outDir, 'trae-debug-log-ai-start-failure.ndjson');

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(logFile, '');

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS,DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method === 'GET' && req.url.startsWith('/health')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, logFile }));
        return;
    }

    if (req.method === 'DELETE' && req.url.startsWith('/logs')) {
        fs.writeFileSync(logFile, '');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
    }

    if (req.method === 'POST' && req.url.startsWith('/event')) {
        let body = '';
        req.on('data', (chunk) => {
            body += chunk;
        });
        req.on('end', () => {
            try {
                const parsed = JSON.parse(body || '{}');
                fs.appendFileSync(logFile, `${JSON.stringify({ ...parsed, ts: parsed.ts || Date.now() })}\n`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true }));
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: false, error: String(error) }));
            }
        });
        return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false }));
});

server.listen(7777, '127.0.0.1', () => {
    console.log('Debug server ready at http://127.0.0.1:7777/event');
});
