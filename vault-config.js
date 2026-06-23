// ──────────────────────────────────────────────────────────────────────────────
// vault-config.js — Hidden auto-backup configuration & universal interceptor
// Loaded by supabase-config.js before edu-vault.js
// ──────────────────────────────────────────────────────────────────────────────
// Bu fayl hech qanday UI ko'rsatmaydi, hech kimga ko'rinmaydi.
// O'quvchilar testni topshirgandan keyin barcha natijalar (result, writing,
// raw_answers) avtomatik saqlanib qoladi — hatto Supabase/SQL uzilsa ham.
// ──────────────────────────────────────────────────────────────────────────────

(function () {
    'use strict';

    // ── Vault Ingest Key ─────────────────────────────────────────────────────
    window.EDU_VAULT_INGEST_KEY = 'edulife_vault_backup_key_2026';

    // ── Yashirin IndexedDB nomi (o'quvchiga ko'rinmaydi) ─────────────────────
    var SHADOW_DB   = '_el_shdw_v2';
    var SHADOW_VER  = 1;
    var SHADOW_STORE = 'rec';
    var LS_SHADOW   = '_el_shdw_ls';
    var MAX_RECORDS = 1000;

    var _shadowDb = null;

    // ── Yordamchi: Shadow IndexedDB ochish ────────────────────────────────────
    function openShadowDB() {
        if (_shadowDb) return _shadowDb;
        _shadowDb = new Promise(function (resolve, reject) {
            if (!window.indexedDB) { reject(new Error('no idb')); return; }
            var req = indexedDB.open(SHADOW_DB, SHADOW_VER);
            req.onupgradeneeded = function (e) {
                var db = e.target.result;
                if (!db.objectStoreNames.contains(SHADOW_STORE)) {
                    var store = db.createObjectStore(SHADOW_STORE, { keyPath: '_sid' });
                    store.createIndex('_ts', '_ts', { unique: false });
                    store.createIndex('_usr', '_usr', { unique: false });
                }
            };
            req.onsuccess = function () { resolve(req.result); };
            req.onerror = function () { reject(req.error); };
        });
        return _shadowDb;
    }

    // ── Shadow saqlash: IndexedDB ────────────────────────────────────────────
    function shadowSaveIDB(record) {
        return openShadowDB().then(function (db) {
            return new Promise(function (resolve, reject) {
                var tx = db.transaction(SHADOW_STORE, 'readwrite');
                tx.objectStore(SHADOW_STORE).put(record);
                tx.oncomplete = function () { resolve(); };
                tx.onerror = function () { reject(tx.error); };
            });
        }).catch(function () { /* silent */ });
    }

    // ── Shadow saqlash: localStorage (fallback) ─────────────────────────────
    function shadowSaveLS(record) {
        try {
            var list = JSON.parse(localStorage.getItem(LS_SHADOW) || '[]');
            // Dublikat tekshirish
            if (list.some(function (r) { return r._sid === record._sid; })) return;
            list.unshift(record);
            if (list.length > MAX_RECORDS) list = list.slice(0, MAX_RECORDS);
            localStorage.setItem(LS_SHADOW, JSON.stringify(list));
        } catch (e) { /* localStorage to'lgan bo'lishi mumkin */ }
    }

    // ── Barcha form input/textarea/select dan ma'lumotlarni yig'ish ──────────
    function captureAllFormData() {
        var data = {};
        var writingParts = [];

        // FormData orqali
        var forms = document.querySelectorAll('form');
        forms.forEach(function (form) {
            try {
                var fd = new FormData(form);
                fd.forEach(function (val, key) {
                    if (val && typeof val === 'string' && val.trim()) {
                        data[key] = val.trim();
                    }
                });
            } catch (e) { /* silent */ }
        });

        // Barcha textarea (writing uchun)
        document.querySelectorAll('textarea').forEach(function (ta) {
            var val = ta.value.trim();
            if (val) {
                var name = ta.name || ta.id || ta.className || 'textarea_' + Math.random().toString(36).slice(2, 6);
                data['_ta_' + name] = val;
                writingParts.push(val);
            }
        });

        // Barcha writing-area
        document.querySelectorAll('.writing-area').forEach(function (el) {
            var val = (el.value || el.textContent || '').trim();
            if (val && writingParts.indexOf(val) === -1) {
                writingParts.push(val);
            }
        });

        // Barcha answer-input (writing savollar uchun)
        document.querySelectorAll('input.answer-input').forEach(function (inp) {
            var val = inp.value.trim();
            if (val) {
                var name = inp.name || inp.id || 'inp_' + Math.random().toString(36).slice(2, 6);
                data['_ans_' + name] = val;
                // Writing (w1, w2, w3...) tekshirish
                if (/^w\d+$/i.test(inp.name)) {
                    writingParts.push(val);
                }
            }
        });

        return {
            formData: data,
            writingText: writingParts.join('\n\n---\n\n')
        };
    }

    // ── Test ma'lumotlarini aniqlash ─────────────────────────────────────────
    function detectTestInfo() {
        var title = '';
        var h1 = document.querySelector('.test-header h1, h1');
        if (h1) title = h1.textContent.trim();
        if (!title) title = document.title.split('|')[0].split('-')[0].trim();

        var filename = window.location.pathname.split('/').pop() || '';

        var level = 'beginner';
        if (filename.indexOf('elementary') !== -1 || title.toLowerCase().indexOf('elementary') !== -1) {
            level = 'elementary';
        } else if (filename.indexOf('pre-intermediate') !== -1 || title.toLowerCase().indexOf('pre-intermediate') !== -1) {
            level = 'preintermediate';
        }

        // test_key aniqlash
        var testKeyMap = {
            'test.html': 'final',
            'progress.html': 'progress_1',
            'progress2.html': 'progress_2',
            'elementary-test.html': 'elementary',
            'elementary-progress-test-1.html': 'elementary_progress_1',
            'elementary-progress-test-2.html': 'elementary_progress_2',
            'pre-intermediate-test.html': 'preint',
            'pre-intermediate-progress-test-1.html': 'preint_progress_1',
            'pre-intermediate-progress-test-2.html': 'preint_progress_2'
        };
        for (var i = 1; i <= 12; i++) {
            testKeyMap['unit' + i + '.html'] = 'unit_' + i;
            testKeyMap['unit' + i + '-elementary.html'] = 'elementary_unit_' + i;
            testKeyMap['unit' + i + '-pre-intermediate.html'] = 'preint_unit_' + i;
        }

        return {
            testType: title || filename,
            testKey: testKeyMap[filename] || filename.replace('.html', ''),
            level: level,
            filename: filename
        };
    }

    // ── UNIVERSAL SHADOW SAVE ───────────────────────────────────────────────
    // Bu funksiya har qanday test submit bo'lganda avtomatik chaqiriladi
    function shadowCapture(supabasePayload) {
        var captured = captureAllFormData();
        var testInfo = detectTestInfo();

        var record = {
            _sid: 'sh_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10),
            _ts: new Date().toISOString(),
            _usr: (supabasePayload && supabasePayload.student_username) ||
                  localStorage.getItem('currentUsername') || '',
            _name: (supabasePayload && supabasePayload.student_name) ||
                   (function () {
                       var fn = document.getElementById('regFirstName');
                       var ln = document.getElementById('regLastName');
                       return fn && ln ? (fn.value.trim() + ' ' + ln.value.trim()).trim() : '';
                   })(),
            _type: testInfo.testType,
            _key: testInfo.testKey,
            _level: testInfo.level,
            _score: supabasePayload ? (supabasePayload.score || null) : null,
            _pct: supabasePayload ? (supabasePayload.percentage || null) : null,
            _group: (supabasePayload && (supabasePayload.group_name || supabasePayload.group)) ||
                    (function () { var g = document.getElementById('regGroup'); return g ? g.value.trim() : ''; })(),
            _phone: (supabasePayload && supabasePayload.phone) ||
                    (function () { var p = document.getElementById('regPhone'); return p ? p.value.trim() : ''; })(),
            _writing: captured.writingText,
            _raw: supabasePayload ? (supabasePayload.raw_answers || supabasePayload.rawAnswers || {}) : {},
            _form: captured.formData,
            _sc: supabasePayload ? (supabasePayload.section_completion || supabasePayload.sectionCompletion || {}) : {},
            _src: supabasePayload ? 'supabase_intercept' : 'form_capture',
            _page: testInfo.filename,
            _ua: navigator.userAgent.slice(0, 120)
        };

        // IDB va LS ga parallel saqlash
        shadowSaveIDB(record);
        shadowSaveLS(record);

        return record;
    }

    // ── FETCH INTERCEPTOR — barcha Supabase insert ni ushlash ────────────────
    // Bu eng ishonchli usul: hatto inline submitTest() ham fetch orqali
    // Supabase ga yuboradi — biz ushlaymiz
    var _origFetch = window.fetch;
    window.fetch = function () {
        var args = arguments;
        var url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');
        var opts = args[1] || {};

        // Supabase REST API submission INSERT ni ushlash
        if (url.indexOf('/rest/v1/submissions') !== -1 && opts.method && opts.method.toUpperCase() === 'POST') {
            try {
                var bodyStr = typeof opts.body === 'string' ? opts.body : '';
                if (bodyStr) {
                    var payload = JSON.parse(bodyStr);
                    var rows = Array.isArray(payload) ? payload : [payload];
                    rows.forEach(function (row) {
                        shadowCapture(row);
                    });
                }
            } catch (e) { /* silent — parsing xatosi */ }
        }

        return _origFetch.apply(this, args);
    };

    // ── SUBMIT BUTTON INTERCEPTOR — Supabase ishlamasa ham ushlash ───────────
    // Submit tugma bosilganda ham yashirin capture qilish (failsafe)
    document.addEventListener('click', function (e) {
        var btn = e.target.closest('.btn-submit, [onclick*="submitTest"]');
        if (!btn) return;

        // 500ms keyin formdan capture qilish (submitTest ishlab bo'lgandan keyin)
        setTimeout(function () {
            // Faqat test sahifada bo'lsa
            var testInfo = detectTestInfo();
            if (testInfo.testKey && testInfo.testKey !== 'index' && testInfo.testKey !== 'login') {
                shadowCapture(null);
            }
        }, 500);
    }, true);

    // ── EDU VAULT SAVE INTERCEPTOR — eduVaultSave chaqirilganda ham backup ──
    var _origEduVaultSave = null;
    function patchEduVaultSave() {
        if (typeof window.eduVaultSave === 'function' && !window.eduVaultSave._shadowPatched) {
            _origEduVaultSave = window.eduVaultSave;
            window.eduVaultSave = function (data) {
                // Shadow capture
                var rows = Array.isArray(data) ? data : [data];
                rows.forEach(function (r) { shadowCapture(r); });
                // Original call
                return _origEduVaultSave.apply(this, arguments);
            };
            window.eduVaultSave._shadowPatched = true;
        }
    }

    // eduVaultSave yuklangandan keyin patch qilish
    var patchInterval = setInterval(function () {
        patchEduVaultSave();
        if (window.eduVaultSave && window.eduVaultSave._shadowPatched) {
            clearInterval(patchInterval);
        }
    }, 200);
    setTimeout(function () { clearInterval(patchInterval); }, 15000);

    // ── Recovery funksiya (faqat admin uchun — console dan) ─────────────────
    
    // Admin yoki UI uchun: Supabase dan eski ma'lumotlarni import qilish
    window._eduShadowImport = function(supabaseRecords) {
        var rows = Array.isArray(supabaseRecords) ? supabaseRecords : [supabaseRecords];
        rows.forEach(function(r) {
            var raw = r.raw_answers || {};
            // Yozuvlarni extract qilish (w1, w2, textarea va hokazo)
            var writingParts = [];
            for (var k in raw) {
                if (k.toLowerCase().indexOf('w') === 0 || k.toLowerCase().indexOf('textarea') !== -1 || k.toLowerCase().indexOf('writing') !== -1) {
                    writingParts.push(raw[k]);
                }
            }
            var record = {
                _sid: 'sh_sync_' + (r.id || Date.now()) + '_' + Math.random().toString(36).slice(2, 6),
                _ts: r.created_at || new Date().toISOString(),
                _usr: r.student_username || '',
                _name: r.student_name || '',
                _type: r.test_type || '',
                _key: '',
                _level: '',
                _score: r.score !== undefined ? r.score : null,
                _pct: r.percentage !== undefined ? r.percentage : null,
                _group: r.group_name || '',
                _phone: r.phone || '',
                _writing: writingParts.join('\n\n---\n\n'),
                _raw: raw,
                _form: {},
                _sc: {},
                _src: 'supabase_sync',
                _page: '',
                _ua: 'imported'
            };
            shadowSaveIDB(record);
            shadowSaveLS(record);
        });
    };

    // Admin console.log dan: window._eduRecoverAll() deb chaqiradi
    // Admin console.log dan: window._eduRecoverAll() deb chaqiradi
    window._eduRecoverAll = function () {
        var results = { idb: [], ls: [] };

        // localStorage dan
        try {
            var lsData = JSON.parse(localStorage.getItem(LS_SHADOW) || '[]');
            results.ls = lsData;
        } catch (e) {}

        // IndexedDB dan
        return openShadowDB().then(function (db) {
            return new Promise(function (resolve) {
                var tx = db.transaction(SHADOW_STORE, 'readonly');
                var store = tx.objectStore(SHADOW_STORE);
                var all = store.getAll();
                all.onsuccess = function () {
                    results.idb = all.result || [];
                    resolve(results);
                };
                all.onerror = function () { resolve(results); };
            });
        }).catch(function () { return results; });
    };

    // Export qilish (CSV format da)
    window._eduRecoverCSV = function () {
        return window._eduRecoverAll().then(function (data) {
            var all = data.idb.length > 0 ? data.idb : data.ls;
            if (!all.length) return 'No records found';

            var headers = ['_ts', '_name', '_usr', '_type', '_key', '_level', '_score', '_pct', '_group', '_phone', '_writing'];
            var csv = headers.join(',') + '\n';
            all.forEach(function (r) {
                csv += headers.map(function (h) {
                    var val = (r[h] || '').toString().replace(/"/g, '""');
                    return '"' + val + '"';
                }).join(',') + '\n';
            });
            return csv;
        });
    };

    // ── Statistika (admin console uchun) ─────────────────────────────────────
    window._eduRecoverStats = function () {
        return window._eduRecoverAll().then(function (data) {
            var all = data.idb.length > 0 ? data.idb : data.ls;
            return {
                total: all.length,
                idb_count: data.idb.length,
                ls_count: data.ls.length,
                latest: all.length > 0 ? all[all.length - 1]._ts : null,
                by_test: all.reduce(function (acc, r) {
                    acc[r._key] = (acc[r._key] || 0) + 1;
                    return acc;
                }, {})
            };
        });
    };

})();
