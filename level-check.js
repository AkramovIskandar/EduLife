(function initLevelCheck() {
    const overlay = document.getElementById('levelCheckOverlay');
    const chatEl = document.getElementById('levelCheckChat');
    const statusEl = document.getElementById('levelCheckStatus');
    const startBtn = document.getElementById('levelCheckStartBtn');
    const closeBtn = document.getElementById('levelCheckCloseBtn');
    const resultEl = document.getElementById('levelCheckResult');
    const resultTextEl = document.getElementById('levelCheckResultText');
    const goBtn = document.getElementById('levelCheckGoBtn');
    const animationEl = document.getElementById('levelCheckAnimationContainer');
    const DEBUG_SERVER_URL = 'http://127.0.0.1:7777/event';
    const DEBUG_SESSION_ID = 'ai-start-failure';
    const DEBUG_RUN_ID = 'pre-fix';

    if (!overlay || !chatEl) return;

    // #region debug-point A:report-helper
    function debugReport(hypothesisId, location, msg, data) {
        fetch(DEBUG_SERVER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: DEBUG_SESSION_ID,
                runId: DEBUG_RUN_ID,
                hypothesisId,
                location,
                msg: `[DEBUG] ${msg}`,
                data: data || {},
                ts: Date.now()
            })
        }).catch(() => {});
    }
    // #endregion

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const speechSupported = Boolean(SpeechRecognition);
    const ttsSupported = 'speechSynthesis' in window;

    let history = [];
    let userTurns = 0;
    let busy = false;
    let listening = false;
    let recognition = null;
    let recommendedLevel = null;
    let preferredVoice = null;
    let sessionStarted = false;

    const LEVEL_LABELS = {
        beginner: { name: 'Beginner', color: 'var(--primary)' },
        elementary: { name: 'Elementary', color: '#10B981' },
        preintermediate: { name: 'Pre-intermediate', color: '#7C3AED' }
    };

    function setAnimationState(state) {
        if (!animationEl) return;
        animationEl.classList.remove('state-idle', 'state-listening', 'state-thinking', 'state-speaking');
        animationEl.classList.add(`state-${state}`);
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function setStatus(text, type) {
        if (!statusEl) return;
        statusEl.textContent = text;
        statusEl.dataset.type = type || 'info';
    }

    function updateControls() {
        if (startBtn) {
            startBtn.disabled = busy || listening || sessionStarted;
            startBtn.hidden = sessionStarted;
            // #region debug-point D:update-controls
            debugReport('D', 'level-check.js:updateControls', 'Start button state updated', {
                busy,
                listening,
                sessionStarted,
                disabled: startBtn.disabled,
                hidden: startBtn.hidden
            });
            // #endregion
        }
    }

    function setBusy(nextBusy) {
        busy = nextBusy;
        updateControls();
    }

    function renderChat() {
        if (!history.length) {
            chatEl.innerHTML = '<div class="speaking-empty"><i class="fa-solid fa-wave-square"></i><p>Start tugmasini bosing. Alex savollarni ovozli beradi, siz esa javobni ovoz orqali aytasiz.</p></div>';
            return;
        }

        chatEl.innerHTML = history
            .filter((turn) => turn.role === 'assistant')
            .map((turn) => `<div class="speaking-msg ai"><span class="speaking-msg-label">Alex</span><p>${escapeHtml(turn.text)}</p></div>`)
            .join('');
        chatEl.scrollTop = chatEl.scrollHeight;
    }

    function appendMessage(role, text) {
        history.push({ role, text });
        renderChat();
    }

    function loadVoices() {
        if (!ttsSupported) return;
        const voices = window.speechSynthesis.getVoices();
        preferredVoice = voices.find((voice) => /en-GB|en-US|Google UK English Female|Google US English/i.test(`${voice.name} ${voice.lang}`))
            || voices.find((voice) => String(voice.lang || '').startsWith('en'))
            || null;
    }

    function stopRecognition() {
        if (recognition && listening) {
            try {
                recognition.stop();
            } catch {}
        }
        listening = false;
    }

    function speakText(text, options = {}) {
        const safeText = String(text || '').trim();
        const { listenAfter = false } = options;

        if (!safeText) {
            setAnimationState('idle');
            return;
        }

        if (!ttsSupported) {
            setAnimationState('idle');
            // #region debug-point C:tts-unsupported
            debugReport('C', 'level-check.js:speakText', 'speechSynthesis unsupported', { listenAfter });
            // #endregion
            setStatus('Brauzer voice playback ni qo\'llamaydi.', 'error');
            if (listenAfter) {
                window.setTimeout(() => {
                    void startListening();
                }, 120);
            }
            return;
        }

        try {
            window.speechSynthesis.cancel();
            setAnimationState('speaking');
            // #region debug-point C:tts-start
            debugReport('C', 'level-check.js:speakText', 'speechSynthesis start', {
                listenAfter,
                textPreview: safeText.slice(0, 80)
            });
            // #endregion
            const utterance = new SpeechSynthesisUtterance(safeText);
            utterance.lang = 'en-US';
            utterance.rate = 0.95;
            if (preferredVoice) utterance.voice = preferredVoice;
            utterance.onerror = () => {
                setAnimationState('idle');
                // #region debug-point C:tts-error
                debugReport('C', 'level-check.js:speakText', 'speechSynthesis error', { listenAfter });
                // #endregion
                setStatus('AI ovozini ijro qilishda xato bo\'ldi.', 'error');
            };
            utterance.onend = () => {
                // #region debug-point C:tts-end
                debugReport('C', 'level-check.js:speakText', 'speechSynthesis end', { listenAfter });
                // #endregion
                if (listenAfter && !recommendedLevel) {
                    void startListening();
                    return;
                }
                setAnimationState('idle');
            };
            window.speechSynthesis.resume?.();
            window.speechSynthesis.speak(utterance);
        } catch {
            setAnimationState('idle');
            // #region debug-point C:tts-catch
            debugReport('C', 'level-check.js:speakText', 'speechSynthesis exception', {});
            // #endregion
            setStatus('Voice playback ishga tushmadi.', 'error');
        }
    }

    function showResult(level, message) {
        recommendedLevel = level;
        const info = LEVEL_LABELS[level] || LEVEL_LABELS.beginner;
        if (resultTextEl) {
            resultTextEl.innerHTML = `<strong style="color:${info.color}">${info.name}</strong><br>${escapeHtml(message)}`;
        }
        if (resultEl) resultEl.hidden = false;
        if (goBtn) {
            goBtn.textContent = `Go to ${info.name}`;
            goBtn.style.background = info.color;
            goBtn.style.borderColor = info.color;
            goBtn.style.color = '#FFFFFF';
            goBtn.hidden = false;
        }
        setAnimationState('idle');
        setStatus('Daraja topildi. Endi mos levelga o\'tishingiz mumkin.', 'ready');
        updateControls();
    }

    function getApiUrl(endpoint) {
        const base = String(window.EDU_API_BASE_URL || '').trim();
        if (!base) {
            const isLocalPreview = ['127.0.0.1', 'localhost'].includes(window.location.hostname) && window.location.port !== '3000';
            if (isLocalPreview) return `http://localhost:3000${endpoint}`;
            return endpoint;
        }
        return `${base.replace(/\/+$/, '')}${endpoint}`;
    }

    async function fetchApi(endpoint, options) {
        if (typeof window.eduFetchApi === 'function') {
            return window.eduFetchApi(endpoint, options);
        }
        return fetch(getApiUrl(endpoint), options);
    }

    async function requestAi(message) {
        let res;
        try {
            // #region debug-point B:request-start
            debugReport('B', 'level-check.js:requestAi', 'requestAi start', {
                userTurns,
                historyLength: history.length,
                textPreview: String(message || '').slice(0, 80)
            });
            // #endregion
            res = await fetchApi('/api/level-check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, history, userTurns })
            });
        } catch {
            // #region debug-point B:request-network-fail
            debugReport('B', 'level-check.js:requestAi', 'requestAi network exception', {});
            // #endregion
            throw new Error('Level-check API bilan aloqa bo\'lmadi. Backend URL yoki serverni tekshiring.');
        }

        const raw = await res.text();
        let data = {};
        try {
            data = raw ? JSON.parse(raw) : {};
        } catch {
            data = {};
        }

        if (res.status === 404) {
            // #region debug-point B:request-404
            debugReport('B', 'level-check.js:requestAi', 'requestAi 404', { status: res.status, raw });
            // #endregion
            throw new Error('Level-check API topilmadi. `window.EDU_API_BASE_URL` ni backend URL ga ulang.');
        }
        // #region debug-point B:request-finish
        debugReport('B', 'level-check.js:requestAi', 'requestAi response received', {
            status: res.status,
            ok: res.ok,
            hasReply: Boolean(data.reply),
            hasLevel: Boolean(data.level)
        });
        // #endregion
        if (!res.ok) throw new Error(data.error || 'AI request failed.');
        return data;
    }

    async function sendMessage(rawText) {
        const text = String(rawText || '').trim();
        if (!text || busy || recommendedLevel) return;

        appendMessage('user', text);
        userTurns += 1;
        setBusy(true);
        setAnimationState('thinking');
        setStatus('Alex javob tayyorlayapti...', 'loading');

        try {
            const data = await requestAi(text);
            appendMessage('assistant', data.reply);

            if (data.level && LEVEL_LABELS[data.level]) {
                showResult(data.level, data.reply);
                speakText(data.reply);
            } else if (data.complete && userTurns >= 5) {
                showResult('beginner', data.reply);
                speakText(data.reply);
            } else {
                setStatus('Alex gapiryapti, keyin sizni tinglaydi...', 'ready');
                speakText(data.reply, { listenAfter: true });
            }
        } catch (err) {
            setAnimationState('idle');
            setStatus(err.message || 'AI bilan bog\'lanib bo\'lmadi.', 'error');
        } finally {
            setBusy(false);
        }
    }

    async function startCheck() {
        if (busy || listening || sessionStarted) return;
        sessionStarted = true;
        setBusy(true);
        setAnimationState('thinking');
        updateControls();
        // #region debug-point A:start-click
        debugReport('A', 'level-check.js:startCheck', 'startCheck invoked', {
            busy,
            listening,
            sessionStarted
        });
        // #endregion
        setStatus('AI suhbatni boshlayapti...', 'loading');

        try {
            const starter = 'Hi! I want to find my English level.';
            speakText('Hello, I am Alex. Let us start your English level check.');
            const data = await requestAi(`${starter} Please start with your first easy question.`);

            appendMessage('user', starter);
            appendMessage('assistant', data.reply);
            // #region debug-point A:start-success
            debugReport('A', 'level-check.js:startCheck', 'startCheck completed successfully', {
                replyPreview: String(data.reply || '').slice(0, 80)
            });
            // #endregion
            setStatus('Alex birinchi savolni bermoqda...', 'ready');
            speakText(data.reply, { listenAfter: true });
        } catch (err) {
            sessionStarted = false;
            setAnimationState('idle');
            // #region debug-point A:start-error
            debugReport('A', 'level-check.js:startCheck', 'startCheck failed', {
                error: err?.message || String(err)
            });
            // #endregion
            setStatus(err.message || 'Suhbatni boshlashda xato bo\'ldi.', 'error');
            speakText('I could not start the conversation. Please try again.');
        } finally {
            setBusy(false);
            updateControls();
        }
    }

    async function startListening() {
        if (listening || busy || recommendedLevel) return;

        if (!speechSupported) {
            setAnimationState('idle');
            setStatus('Voice input uchun Chrome yoki Edge kerak.', 'error');
            return;
        }

        const isLocalHost = ['127.0.0.1', 'localhost'].includes(window.location.hostname);
        if (!window.isSecureContext && !isLocalHost) {
            setAnimationState('idle');
            setStatus('Voice input uchun HTTPS yoki localhost kerak.', 'error');
            return;
        }

        try {
            if (navigator.mediaDevices?.getUserMedia) {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                stream.getTracks().forEach((track) => track.stop());
            }
        } catch {
            setAnimationState('idle');
            setStatus('Mikrofon ruxsati berilmagan.', 'error');
            return;
        }

        try {
            recognition = new SpeechRecognition();
            recognition.lang = 'en-US';
            recognition.interimResults = false;
            recognition.continuous = false;
            recognition.maxAlternatives = 1;

            recognition.onstart = () => {
                listening = true;
                setAnimationState('listening');
                updateControls();
                // #region debug-point C:recognition-start
                debugReport('C', 'level-check.js:startListening', 'speech recognition started', {});
                // #endregion
                setStatus('Tinglayapman... javobingizni ayting.', 'listening');
            };

            recognition.onresult = (event) => {
                const transcript = Array.from(event.results)
                    .map((result) => result[0]?.transcript || '')
                    .join(' ')
                    .trim();

                if (transcript) {
                    // #region debug-point C:recognition-result
                    debugReport('C', 'level-check.js:startListening', 'speech recognition result', {
                        transcriptPreview: transcript.slice(0, 80)
                    });
                    // #endregion
                    void sendMessage(transcript);
                }
            };

            recognition.onerror = (event) => {
                const error = event?.error || 'unknown';
                const errorMap = {
                    'audio-capture': 'Mikrofon topilmadi.',
                    'network': 'Voice service tarmoq xatosi berdi.',
                    'not-allowed': 'Mikrofon ruxsati rad etildi.',
                    'service-not-allowed': 'Speech service bloklangan.',
                    'no-speech': 'Ovoz aniqlanmadi, qayta urinib ko\'ring.'
                };
                listening = false;
                setAnimationState('idle');
                updateControls();
                // #region debug-point C:recognition-error
                debugReport('C', 'level-check.js:startListening', 'speech recognition error', {
                    error
                });
                // #endregion
                setStatus(errorMap[error] || `Voice error: ${error}`, 'error');
            };

            recognition.onend = () => {
                const wasListening = listening;
                listening = false;
                updateControls();
                // #region debug-point C:recognition-end
                debugReport('C', 'level-check.js:startListening', 'speech recognition ended', {
                    wasListening,
                    busy,
                    recommendedLevel: Boolean(recommendedLevel)
                });
                // #endregion
                if (wasListening && !busy && !recommendedLevel) {
                    setAnimationState('idle');
                }
            };

            recognition.start();
        } catch {
            listening = false;
            setAnimationState('idle');
            updateControls();
            setStatus('Voice recognition ishga tushmadi.', 'error');
        }
    }

    function resetCheck() {
        history = [];
        userTurns = 0;
        recommendedLevel = null;
        sessionStarted = false;
        stopRecognition();
        if (resultEl) resultEl.hidden = true;
        if (resultTextEl) resultTextEl.textContent = '';
        if (goBtn) {
            goBtn.hidden = true;
            goBtn.removeAttribute('style');
        }
        try {
            window.speechSynthesis?.cancel();
        } catch {}
        setAnimationState('idle');
        renderChat();
        setStatus('Start tugmasini bosing va suhbatni boshlang.', 'info');
        setBusy(false);
    }

    function openOverlay() {
        resetCheck();
        overlay.hidden = false;
        overlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    function closeOverlay() {
        overlay.hidden = true;
        overlay.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        stopRecognition();
        try {
            window.speechSynthesis?.cancel();
        } catch {}
    }

    document.getElementById('openLevelCheckBtn')?.addEventListener('click', openOverlay);
    closeBtn?.addEventListener('click', closeOverlay);
    startBtn?.addEventListener('click', startCheck);
    overlay?.addEventListener('click', (e) => {
        if (e.target === overlay) closeOverlay();
    });

    goBtn?.addEventListener('click', () => {
        if (!recommendedLevel) return;
        closeOverlay();
        if (typeof selectLevel === 'function') selectLevel(recommendedLevel);
    });

    if (ttsSupported) {
        loadVoices();
        window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    }

    renderChat();
    setAnimationState('idle');
    overlay.setAttribute('aria-hidden', overlay.hidden ? 'true' : 'false');
    updateControls();
})();
