(function initEduSpeaking() {
    const section = document.getElementById('section-speaking');
    if (!section) return;

    const chatEl = document.getElementById('speakingChat');
    const statusEl = document.getElementById('speakingStatus');
    const inputEl = document.getElementById('speakingInput');
    const sendBtn = document.getElementById('speakingSendBtn');
    const micBtn = document.getElementById('speakingMicBtn');
    const speakBtn = document.getElementById('speakingSpeakBtn');
    const clearBtn = document.getElementById('speakingClearBtn');
    const transcriptField = document.getElementById('speakingTranscript');
    const animationEl = document.getElementById('speakingAnimationContainer');
    const modesWrap = section.querySelector('.speaking-modes');
    const tipsEl = section.querySelector('.speaking-tips');

    function setAnimationState(state) {
        // Remove all state classes
        animationEl.classList.remove('state-idle', 'state-listening', 'state-thinking', 'state-speaking');
        // Add new state class
        animationEl.classList.add(`state-${state}`);
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const speechSupported = Boolean(SpeechRecognition);
    const ttsSupported = 'speechSynthesis' in window;

    const MODE_META = {
        free: {
            label: 'Free Talk',
            placeholder: 'Type your answer here...',
            tip: '<strong>Coach mode:</strong> Mia chats like a friendly IELTS buddy. Speak naturally and do not worry about small mistakes.',
            starter: 'Hey Mia! I want to practice English conversation. Please introduce yourself like a funny, friendly IELTS coach and ask me one easy question about my day.'
        },
        part1: {
            label: 'IELTS Part 1',
            placeholder: 'Answer the Part 1 question...',
            tip: '<strong>Part 1:</strong> Give short but complete answers. Mia will react naturally, fix one thing softly, and ask the next question.',
            starter: 'Hi Mia! I want IELTS Speaking Part 1 practice. Start with one easy personal question and sound like a supportive friend, not a strict examiner.'
        },
        part2: {
            label: 'IELTS Part 2',
            placeholder: 'Speak about the cue card topic...',
            tip: '<strong>Part 2:</strong> Try to speak for longer. Mia will give a cue card, then quick praise, one correction, and one improvement tip.',
            starter: 'Hi Mia! I want IELTS Speaking Part 2 practice. Give me one cue card topic with 3-4 bullet points and encourage me like a friendly coach.'
        },
        part3: {
            label: 'IELTS Part 3',
            placeholder: 'Give a deeper opinion...',
            tip: '<strong>Part 3:</strong> Explain your opinion and add a reason or example. Mia will push you with deeper follow-up questions.',
            starter: 'Hi Mia! I want IELTS Speaking Part 3 practice. Ask me one deeper discussion question connected to society, education, technology, or lifestyle in a warm natural tone.'
        },
        assessment: {
            label: 'IELTS Mock',
            placeholder: 'Answer like a real speaking test...',
            tip: '<strong>IELTS Mock:</strong> Mia runs a short IELTS-style speaking test, moves across Parts 1-3, and gives you a live level estimate.',
            starter: 'Hi Mia! Please start a short IELTS speaking mock test like ielts.gg style. Begin with Part 1 and act like a warm human examiner.'
        }
    };

    let mode = 'free';
    const level = section.dataset.level || 'intermediate';
    let history = [];
    let listening = false;
    let busy = false;
    let recognition = null;
    let preferredVoice = null;
    let lastFeedback = null;

    ensureModeButton('part3', 'IELTS Part 3');
    ensureModeButton('assessment', 'IELTS Mock');

    const feedbackEl = ensureFeedbackPanel();
    let modeButtons = Array.from(section.querySelectorAll('[data-speaking-mode]'));

    function ensureModeButton(modeName, label) {
        if (!modesWrap || modesWrap.querySelector(`[data-speaking-mode="${modeName}"]`)) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'speaking-mode-btn';
        btn.dataset.speakingMode = modeName;
        btn.textContent = label;
        modesWrap.appendChild(btn);
    }

    function ensureFeedbackPanel() {
        let panel = document.getElementById('speakingFeedback');
        if (panel) return panel;

        panel = document.createElement('div');
        panel.id = 'speakingFeedback';
        panel.className = 'speaking-feedback';
        panel.innerHTML = `
            <div class="speaking-feedback-header">
                <strong>Mia's quick coaching</strong>
                <span>Friendly mini-feedback after each reply</span>
            </div>
            <div class="speaking-feedback-empty">Start a session to see your mini feedback, correction, and focus area.</div>
        `;

        statusEl?.insertAdjacentElement('afterend', panel);
        return panel;
    }

    function setStatus(text, type) {
        if (!statusEl) return;
        statusEl.textContent = text;
        statusEl.dataset.type = type || 'info';
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function saveTranscript() {
        if (!transcriptField) return;
        const lines = history.map((t) => `${t.role === 'user' ? 'Student' : 'Mia'}: ${t.text}`);
        if (lastFeedback?.summary) {
            lines.push('');
            lines.push(`Coach Summary: ${lastFeedback.summary}`);
        }
        if (lastFeedback?.estimatedBand || lastFeedback?.cefrLevel) {
            lines.push(`Estimated Level: ${lastFeedback.estimatedBand || 'N/A'} | ${lastFeedback.cefrLevel || 'N/A'}`);
        }
        transcriptField.value = lines.join('\n');
    }

    function renderChat() {
        if (!chatEl) return;
        if (!history.length) {
            chatEl.innerHTML = `<div class="speaking-empty"><i class="fa-solid fa-robot"></i><p>Start ${escapeHtml(MODE_META[mode].label)} with Mia. Tap "Start AI Session" to begin.</p></div>`;
            return;
        }

        // Only render AI messages
        chatEl.innerHTML = history
            .filter(t => t.role === 'assistant')
            .map((turn) => {
                const label = 'Mia';
                return `<div class="speaking-msg ai"><span class="speaking-msg-label">${label}</span><p>${escapeHtml(turn.text)}</p></div>`;
            }).join('');
        chatEl.scrollTop = chatEl.scrollHeight;
    }

    function appendMessage(role, text) {
        history.push({ role, text });
        saveTranscript();
        renderChat();
    }

    function renderFeedback(feedback) {
        lastFeedback = feedback || null;
        if (!feedbackEl) return;

        if (!feedback) {
            feedbackEl.innerHTML = `
                <div class="speaking-feedback-header">
                    <strong>Mia's quick coaching</strong>
                    <span>Friendly mini-feedback after each reply</span>
                </div>
                <div class="speaking-feedback-empty">Start a session to see your mini feedback, correction, and focus area.</div>
            `;
            saveTranscript();
            return;
        }

        const metrics = [
            ['Fluency', feedback.fluency],
            ['Grammar', feedback.grammar],
            ['Vocabulary', feedback.vocabulary],
            ['Pronunciation', feedback.pronunciation],
            ['IELTS Estimate', feedback.estimatedBand],
            ['CEFR', feedback.cefrLevel],
            ['Stage', feedback.examPart]
        ].filter(([, value]) => value);

        const summaryParts = [feedback.examPart, feedback.estimatedBand, feedback.praise, feedback.correction, feedback.tip].filter(Boolean);
        feedback.summary = summaryParts.join(' | ');

        feedbackEl.innerHTML = `
            <div class="speaking-feedback-header">
                <strong>Mia's quick coaching${feedback.examPart ? ` - ${escapeHtml(feedback.examPart)}` : ''}</strong>
                <span>${escapeHtml(feedback.focus || 'Keep building smooth answers and clear ideas.')}</span>
            </div>
            <div class="speaking-feedback-grid">
                <div class="speaking-feedback-card">
                    <span class="feedback-label">What was good</span>
                    <p>${escapeHtml(feedback.praise || 'Nice effort. Keep talking naturally.')}</p>
                </div>
                <div class="speaking-feedback-card">
                    <span class="feedback-label">Better phrase</span>
                    <p>${escapeHtml(feedback.correction || 'Good job. Keep your sentences simple and clear.')}</p>
                </div>
                <div class="speaking-feedback-card">
                    <span class="feedback-label">Next tip</span>
                    <p>${escapeHtml(feedback.tip || 'Add one reason or example in your next answer.')}</p>
                </div>
            </div>
            <div class="speaking-feedback-metrics">
                ${metrics.map(([label, value]) => `<span class="feedback-chip"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</span>`).join('')}
            </div>
        `;
        saveTranscript();
    }

    function loadVoices() {
        if (!ttsSupported) return;
        const voices = window.speechSynthesis.getVoices();
        preferredVoice = voices.find((v) => /en-GB|en-US|Google UK English Female|Google US English/i.test(`${v.name} ${v.lang}`))
            || voices.find((v) => v.lang.startsWith('en'))
            || null;
    }

    function speakText(text) {
        if (!ttsSupported || !String(text || '').trim()) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(String(text).trim());
        utterance.lang = 'en-US';
        utterance.rate = 0.96;
        utterance.pitch = 1.04;
        if (preferredVoice) utterance.voice = preferredVoice;
        
        // Set animation state to speaking
        setAnimationState('speaking');
        
        utterance.onend = () => {
            setAnimationState('idle');
        };
        
        window.speechSynthesis.speak(utterance);
    }

    function updateModeUi() {
        const meta = MODE_META[mode] || MODE_META.free;
        modeButtons.forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.speakingMode === mode);
        });
        if (inputEl) inputEl.placeholder = meta.placeholder;
        if (tipsEl) tipsEl.innerHTML = meta.tip;
    }

    function setMode(nextMode) {
        mode = MODE_META[nextMode] ? nextMode : 'free';
        updateModeUi();
    }

    function setBusy(nextBusy) {
        busy = nextBusy;
        if (sendBtn) sendBtn.disabled = nextBusy;
        if (micBtn) micBtn.disabled = nextBusy || listening;
        if (inputEl) inputEl.disabled = nextBusy;
    }

    function getApiUrl(endpoint) {
        const base = String(window.EDU_API_BASE_URL || '').trim();
        if (!base) {
            const isLocalPreview = ['127.0.0.1', 'localhost'].includes(window.location.hostname) && !['3000', '3001', '3002'].includes(window.location.port);
            if (isLocalPreview) return `http://localhost:3002${endpoint}`;
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

    async function callAi(message, customHistory, options = {}) {
        let res;
        try {
            res = await fetchApi('/api/speaking', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message,
                    history: customHistory || history,
                    mode,
                    level,
                    sessionStart: Boolean(options.sessionStart)
                })
            });
        } catch {
            throw new Error('Speaking API bilan aloqa bo\'lmadi. Loyihani `vercel dev` orqali ishga tushiring yoki deploy qiling.');
        }

        const raw = await res.text();
        let data = {};
        try {
            data = raw ? JSON.parse(raw) : {};
        } catch {
            data = {};
        }

        if (!res.ok) {
            if (res.status === 404) {
                throw new Error('Speaking API topilmadi. `window.EDU_API_BASE_URL` ni to\'g\'ri backend URL ga ulang yoki serverni ishga tushiring.');
            }
            throw new Error(data.error || 'AI request failed.');
        }

        return {
            reply: data.reply || '',
            feedback: data.feedback || null
        };
    }

    async function sendMessage(rawText) {
        const text = String(rawText || '').trim();
        if (!text || busy) return;

        appendMessage('user', text);
        if (inputEl) inputEl.value = '';
        setBusy(true);
        setStatus('Mia is thinking...', 'loading');
        setAnimationState('thinking');

        try {
            const data = await callAi(text, history.slice(0, -1));
            appendMessage('assistant', data.reply);
            renderFeedback(data.feedback);
            speakText(data.reply);
            setStatus(mode === 'assessment' ? 'Mock running. Keep answering naturally.' : 'Nice. Keep going and sound natural.', 'ready');
        } catch (err) {
            setStatus(err.message || 'Could not reach AI. Use Vercel dev or deploy with GEMINI_API_KEY.', 'error');
            setAnimationState('idle');
        } finally {
            setBusy(false);
        }
    }

    function startListening() {
        if (!speechSupported || listening || busy) {
            if (!speechSupported) {
                setStatus('Voice input needs Chrome or Edge. You can type instead.', 'error');
            }
            return;
        }

        recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.continuous = false;

        recognition.onstart = () => {
            listening = true;
            if (micBtn) {
                micBtn.classList.add('recording');
                micBtn.disabled = true;
            }
            setStatus('Listening... speak now', 'listening');
            setAnimationState('listening');
        };

        recognition.onresult = (event) => {
            const transcript = Array.from(event.results)
                .map((r) => r[0].transcript)
                .join(' ')
                .trim();
            if (transcript) sendMessage(transcript);
        };

        recognition.onerror = (event) => {
            const msg = event.error === 'not-allowed'
                ? 'Microphone permission denied.'
                : `Voice error: ${event.error}`;
            setStatus(msg, 'error');
            setAnimationState('idle');
        };

        recognition.onend = () => {
            listening = false;
            if (micBtn) {
                micBtn.classList.remove('recording');
                micBtn.disabled = busy;
            }
            if (!busy) {
                setStatus('Ready. Tap "Start AI Session" or type your answer.', 'ready');
                setAnimationState('idle');
            }
        };

        recognition.start();
    }

    function stopListening() {
        if (recognition && listening) recognition.stop();
    }

    function clearChat() {
        history = [];
        renderFeedback(null);
        saveTranscript();
        renderChat();
        window.speechSynthesis?.cancel();
        setAnimationState('idle');
        setStatus('Chat cleared. Start again when ready.', 'info');
    }

    async function startSession() {
        if (history.length || busy) return;
        setBusy(true);
        setStatus(mode === 'assessment' ? 'Starting IELTS mock...' : 'Starting Mia...', 'loading');
        setAnimationState('thinking');
        try {
            const starter = (MODE_META[mode] || MODE_META.free).starter;
            const data = await callAi(starter, [], { sessionStart: true });
            appendMessage('assistant', data.reply);
            renderFeedback(data.feedback);
            speakText(data.reply);
            setStatus(mode === 'assessment' ? 'Mock started. Answer like a real test.' : 'Session started. Type your answer.', 'ready');
        } catch (err) {
            setStatus(err.message || 'Could not start session.', 'error');
            setAnimationState('idle');
        } finally {
            setBusy(false);
        }
    }

    function bindModeButtons() {
        modeButtons = Array.from(section.querySelectorAll('[data-speaking-mode]'));
        modeButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
                const nextMode = btn.dataset.speakingMode;
                if (nextMode === mode) return;
                setMode(nextMode);
                clearChat();
            });
        });
    }

    bindModeButtons();

    sendBtn?.addEventListener('click', () => sendMessage(inputEl?.value));
    inputEl?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(inputEl.value);
        }
    });
    micBtn?.addEventListener('click', () => {
        if (listening) stopListening();
        else startListening();
    });
    speakBtn?.addEventListener('click', () => {
        const lastAi = [...history].reverse().find((t) => t.role === 'assistant');
        if (lastAi) speakText(lastAi.text);
    });
    clearBtn?.addEventListener('click', clearChat);
    section.querySelector('#speakingStartBtn')?.addEventListener('click', startSession);

    if (ttsSupported) {
        loadVoices();
        window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    }

    setMode('free');
    renderFeedback(null);
    renderChat();
    setAnimationState('idle');
    setStatus(speechSupported ? 'Ready. Tap "Start AI Session" to begin.' : 'Type your message to practice.', 'info');
})();