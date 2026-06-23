/**
 * Hidden local + server backup for test results and writing answers.
 * Not linked in UI — loaded automatically after Supabase init.
 */
(function () {
    'use strict';

    const DB_NAME = 'edulife_vault_db';
    const DB_VERSION = 1;
    const STORE = 'snapshots';
    const LS_KEY = '_edv_snap_v1';
    const PENDING_KEY = '_edv_pending_v1';
    const MAX_LOCAL = 600;

    let dbPromise = null;

    function extractWriting(raw) {
        if (!raw || typeof raw !== 'object') return '';
        const parts = [];
        const direct = raw.writingText || raw.writing || raw.writingAnswers;
        if (typeof direct === 'string' && direct.trim()) parts.push(direct.trim());
        if (typeof raw.w1 === 'string' && raw.w1.trim()) parts.push(raw.w1.trim());
        if (typeof raw.w2 === 'string' && raw.w2.trim()) parts.push(raw.w2.trim());
        if (typeof raw.w3 === 'string' && raw.w3.trim()) parts.push(raw.w3.trim());
        Object.entries(raw).forEach(([key, val]) => {
            if (/^w\d+$/i.test(key) && typeof val === 'string' && val.trim() && !parts.includes(val.trim())) {
                parts.push(val.trim());
            }
        });
        return parts.join('\n\n---\n\n');
    }

    function extractSpeaking(raw) {
        if (!raw || typeof raw !== 'object') return '';
        return raw.speakingText || raw.speaking || '';
    }

    function normalizeRecord(row) {
        const rawAnswers = row.raw_answers || row.rawAnswers || {};
        return {
            vault_id: `vault_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
            saved_at: new Date().toISOString(),
            student_name: row.student_name || row.studentName || '',
            student_username: row.student_username || row.studentUsername || localStorage.getItem('currentUsername') || '',
            test_type: row.test_type || row.testType || row.type || '',
            test_key: row.test_key || row.testKey || '',
            level: row.level || localStorage.getItem('currentUserLevel') || '',
            score: row.score != null ? Number(row.score) : null,
            percentage: row.percentage != null ? Number(row.percentage) : null,
            group_name: row.group_name || row.group || '',
            phone: row.phone || '',
            section_completion: row.section_completion || row.sectionCompletion || {},
            raw_answers: rawAnswers,
            writing_text: extractWriting(rawAnswers) || extractWriting(row),
            speaking_text: extractSpeaking(rawAnswers),
            synced_to_server: false,
            server_sync_at: null
        };
    }

    function openDB() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                reject(new Error('IndexedDB unavailable'));
                return;
            }
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE)) {
                    const store = db.createObjectStore(STORE, { keyPath: 'vault_id' });
                    store.createIndex('saved_at', 'saved_at', { unique: false });
                    store.createIndex('student_username', 'student_username', { unique: false });
                    store.createIndex('synced_to_server', 'synced_to_server', { unique: false });
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        return dbPromise;
    }

    async function saveToIndexedDB(record) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).put(record);
            tx.oncomplete = () => resolve(record);
            tx.onerror = () => reject(tx.error);
        });
    }

    function readLocalList() {
        try {
            return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
        } catch {
            return [];
        }
    }

    function saveToLocalStorage(record) {
        try {
            const list = readLocalList();
            list.unshift(record);
            localStorage.setItem(LS_KEY, JSON.stringify(list.slice(0, MAX_LOCAL)));
        } catch (e) {
            console.warn('[vault] localStorage backup skipped');
        }
    }

    function readPending() {
        try {
            return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
        } catch {
            return [];
        }
    }

    function writePending(list) {
        try {
            localStorage.setItem(PENDING_KEY, JSON.stringify(list.slice(0, MAX_LOCAL)));
        } catch (e) {
            console.warn('[vault] pending queue save failed');
        }
    }

    function queuePending(record) {
        const pending = readPending();
        if (!pending.some((p) => p.vault_id === record.vault_id)) {
            pending.unshift(record);
            writePending(pending);
        }
    }

    function getApiBase() {
        if (window.EDU_API_BASE) return String(window.EDU_API_BASE).replace(/\/$/, '');
        if (window.location?.origin) return window.location.origin;
        return '';
    }

    async function syncRecordToServer(record) {
        const base = getApiBase();
        if (!base) return false;

        try {
            const res = await fetch(`${base}/api/vault/ingest`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(window.EDU_VAULT_INGEST_KEY ? { 'x-edu-vault-key': window.EDU_VAULT_INGEST_KEY } : {})
                },
                body: JSON.stringify({ record })
            });
            if (!res.ok) return false;
            const data = await res.json().catch(() => ({}));
            return data.ok === true;
        } catch {
            return false;
        }
    }

    async function markSynced(vaultId) {
        try {
            const db = await openDB();
            const tx = db.transaction(STORE, 'readwrite');
            const store = tx.objectStore(STORE);
            const getReq = store.get(vaultId);
            getReq.onsuccess = () => {
                const rec = getReq.result;
                if (rec) {
                    rec.synced_to_server = true;
                    rec.server_sync_at = new Date().toISOString();
                    store.put(rec);
                }
            };
        } catch (_) { /* silent */ }

        const pending = readPending().filter((p) => p.vault_id !== vaultId);
        writePending(pending);
    }

    async function eduVaultSave(rowOrRows) {
        const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];
        const saved = [];

        for (const raw of rows) {
            if (!raw || typeof raw !== 'object') continue;
            const record = normalizeRecord(raw);
            try {
                await saveToIndexedDB(record);
            } catch {
                /* IndexedDB failed — localStorage still has copy */
            }
            saveToLocalStorage(record);
            queuePending(record);
            saved.push(record);

            syncRecordToServer(record).then((ok) => {
                if (ok) markSynced(record.vault_id);
            });
        }

        return saved;
    }

    async function eduVaultRetrySync() {
        const pending = readPending();
        if (!pending.length) return;

        for (const record of pending.slice(0, 20)) {
            const ok = await syncRecordToServer(record);
            if (ok) await markSynced(record.vault_id);
        }
    }

    function patchSupabaseInserts() {
        if (!window.eduSupabase || window.eduSupabase._vaultPatched) return;

        const client = window.eduSupabase;
        const originalFrom = client.from.bind(client);

        client.from = function (table) {
            const builder = originalFrom(table);
            if (table === 'submissions') {
                const originalInsert = builder.insert.bind(builder);
                builder.insert = function (rows) {
                    const payload = Array.isArray(rows) ? rows : [rows];
                    payload.forEach((row) => {
                        eduVaultSave(row).catch(() => {});
                    });
                    return originalInsert(rows);
                };
            }
            return builder;
        };

        client._vaultPatched = true;
    }

    function init() {
        patchSupabaseInserts();
        const poll = setInterval(() => {
            patchSupabaseInserts();
            if (window.eduSupabase?._vaultPatched) clearInterval(poll);
        }, 300);

        document.addEventListener('DOMContentLoaded', () => {
            eduVaultRetrySync();
        });

        window.addEventListener('online', () => {
            eduVaultRetrySync();
        });
    }

    window.eduVaultSave = eduVaultSave;
    window.eduVaultRetrySync = eduVaultRetrySync;
    init();
})();
