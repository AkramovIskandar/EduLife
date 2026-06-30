// Eski PWA / service worker cache ni tozalash (AI yordamchi va student app olib tashlangan)
(function clearLegacyAppCache() {
    const run = () => {
        if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;
        navigator.serviceWorker.getRegistrations().then((regs) => {
            regs.forEach((r) => r.unregister());
        }).catch(() => {});
        if (typeof caches !== 'undefined') {
            caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).catch(() => {});
        }
    };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 3000 });
    else setTimeout(run, 1500);
})();

// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();

        const targetId = this.getAttribute('href');
        const targetElement = document.querySelector(targetId);

        if (targetElement) {
            window.scrollTo({
                top: targetElement.offsetTop - 80,
                behavior: 'smooth'
            });
        }
    });
});

function applyTheme(theme) {
    const isDark = theme === 'dark';
    document.body.classList.toggle('dark-theme', isDark);

    const icon = document.querySelector('#themeToggle i');
    if (icon) {
        icon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
}

function initializeTheme() {
    const savedTheme = localStorage.getItem('edu_theme') || 'light';
    applyTheme(savedTheme);
}

function setupThemeToggle() {
    if (document.getElementById('themeToggle')) return;

    const navActions = document.querySelector('.nav-actions');
    const adminActions = document.querySelector('.admin-nav > div:last-child');
    const targetContainer = navActions || adminActions;

    const btn = document.createElement('button');
    btn.id = 'themeToggle';
    btn.type = 'button';
    btn.className = 'theme-toggle-btn';
    btn.setAttribute('aria-label', 'Toggle dark mode');
    btn.innerHTML = '<i class="fa-solid fa-moon"></i>';
    if (targetContainer) {
        targetContainer.prepend(btn);
    } else {
        btn.classList.add('theme-toggle-floating');
        document.body.appendChild(btn);
    }

    btn.addEventListener('click', () => {
        const nextTheme = document.body.classList.contains('dark-theme') ? 'light' : 'dark';
        localStorage.setItem('edu_theme', nextTheme);
        applyTheme(nextTheme);
    });
}

// Test Navigation Logic
const totalSections = 8;
const sections = [
    'section-grammar',
    'section-vocab',
    'section-pronunciation',
    'section-practical',
    'section-reading',
    'section-writing',
    'section-listening',
    'section-details'
];

// Global Exam Status Check (Prevents direct link bypass)
async function enforceExamSecurity() {
    const filename = window.location.pathname.split('/').pop();
    if (!filename || ['index.html', 'login.html', 'tests.html', 'admin.html', 'students.html'].includes(filename)) return;

    const testMapping = {
        'test.html': 'final',
        'progress.html': 'progress1',
        'progress2.html': 'progress2',
        'elementary-test.html': 'elementary',
        'elementary-progress-test-1.html': 'elementary_progress_1',
        'elementary-progress-test-2.html': 'elementary_progress_2',
        'pre-intermediate-test.html': 'preint',
        'pre-intermediate-progress-test-1.html': 'preint_progress_1',
        'pre-intermediate-progress-test-2.html': 'preint_progress_2'
    };

    // Unit test mapping (test_key SQL bilan mos: unit_1, elementary_unit_1, ...)
    for (let i = 1; i <= 12; i++) {
        testMapping[`unit${i}.html`] = `unit_${i}`;
        testMapping[`unit${i}-elementary.html`] = `elementary_unit_${i}`;
        testMapping[`unit${i}-pre-intermediate.html`] = `preint_unit_${i}`;
    }

    const testKey = testMapping[filename];
    if (!testKey) return;

    if (window.eduSupabase) {
        try {
            // 1. Initial check on load
            const { data } = await window.eduSupabase
                .from('test_settings')
                .select('is_enabled')
                .eq('test_key', testKey)
                .single();
            
            if (data && data.is_enabled === false) {
                alert('THIS TEST IS CURRENTLY DISABLED BY THE ADMINISTRATOR.');
                window.location.href = 'tests.html';
                return;
            }

            // 2. Real-time security: Kick out if disabled while on page
            window.eduSupabase
                .channel('test_status_check')
                .on('postgres_changes', { 
                    event: 'UPDATE', 
                    table: 'test_settings', 
                    filter: `test_key=eq.${testKey}` 
                }, payload => {
                    if (payload.new && payload.new.is_enabled === false) {
                        alert('This test has just been disabled by the Administrator.');
                        window.location.href = 'tests.html';
                    }
                })
                .subscribe();

        } catch (e) {
            console.error("Exam security sync error:", e);
        }
    }
}

function getSubmissionMaxPoints(sub) {
    const completion = sub.section_completion || {};
    const sectionTotal = Object.values(completion)
        .filter(v => v && typeof v.total === 'number' && v.total > 0)
        .reduce((sum, v) => sum + v.total, 0);
    if (sectionTotal > 0) return sectionTotal;

    const testType = sub.test_type || '';
    if (testType === 'Placement Test' || testType.includes('Progress')) return 125;
    return 100;
}

function getSubmissionPercentage(sub) {
    const stored = parseFloat(sub.percentage);
    if (!Number.isNaN(stored) && stored > 0) {
        return Math.min(100, Math.round(stored));
    }
    const score = parseFloat(sub.score) || 0;
    const maxPoints = getSubmissionMaxPoints(sub);
    return maxPoints > 0 ? Math.min(100, Math.round((score / maxPoints) * 100)) : 0;
}

function getSubmissionScoreColor(percentage) {
    if (percentage >= 80) return '#059669';
    if (percentage >= 50) return '#D97706';
    return '#DC2626';
}

function updateProgress(currentSectionIndex) {
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');

    if (progressBar && progressText) {
        const percentage = ((currentSectionIndex + 1) / totalSections) * 100;
        progressBar.style.width = `${percentage}%`;
        progressText.innerText = `Section ${currentSectionIndex + 1} of ${totalSections}`;
    }
}

function showSection(sectionId) {
    document.querySelectorAll('.test-section').forEach(section => {
        section.classList.remove('active');
    });

    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function nextSection(currentSectionIndex) {
    if (currentSectionIndex < sections.length) {
        showSection(sections[currentSectionIndex]);
        updateProgress(currentSectionIndex);
    }
}

function finalStep() {
    showSection('section-details');
    updateProgress(7);
}

/** Pastdagi alohida input ni gap ichidagi chiziqchaga ko'chiradi */
function inlineBlankInputs() {
    const blankRe = /_{2,}(\s*\([^)]+\))?/g;

    document.querySelectorAll('.test-section .q-item, .test-container .q-item').forEach((item) => {
        if (item.closest('#section-details, #section-result')) return;

        const p = item.querySelector(':scope > p');
        if (!p || p.querySelector('input[type="text"].inline-input')) return;

        const input = item.querySelector(
            ':scope > input[type="text"].answer-input, :scope > input[type="text"].word-input'
        );
        if (!input || (input.id && input.id.startsWith('reg'))) return;
        if (p.contains(input)) return;
        if (!/_{2,}/.test(p.textContent)) return;

        const text = p.textContent;
        const matches = [];
        let m;
        blankRe.lastIndex = 0;
        while ((m = blankRe.exec(text)) !== null) {
            matches.push({
                index: m.index,
                length: m[0].length,
                hint: m[1] ? m[1].trim() : null,
            });
        }
        if (!matches.length) return;

        const targetIdx = pickBlankIndex(matches);
        const target = matches[targetIdx];
        const hint = target.hint || null;

        input.classList.add('inline-input');
        if (matches.length > 1) input.classList.add('inline-input-wide');

        const ph = input.getAttribute('placeholder');
        if (ph === 'Your answer' || ph === 'answer' || ph === 'verb form') {
            input.removeAttribute('placeholder');
        }
        if (hint && !input.getAttribute('placeholder')) {
            input.setAttribute('placeholder', hint);
        }

        p.textContent = '';
        let cursor = 0;
        matches.forEach((bm, i) => {
            if (bm.index > cursor) {
                p.appendChild(document.createTextNode(text.slice(cursor, bm.index)));
            }
            if (i === targetIdx) {
                p.appendChild(input);
            }
            cursor = bm.index + bm.length;
        });
        if (cursor < text.length) {
            p.appendChild(document.createTextNode(text.slice(cursor)));
        }

        removeGrammarHintsFromParagraph(p, hint);
        normalizeParagraphText(p);
    });
}

function pickBlankIndex(matches) {
    for (let i = matches.length - 1; i >= 0; i--) {
        if (matches[i].hint) return i;
    }
    return matches.length - 1;
}

function removeGrammarHintsFromParagraph(p, primaryHint) {
    const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    let textNode;
    while ((textNode = walker.nextNode())) {
        if (textNode.parentElement?.tagName === 'INPUT') continue;
        textNode.textContent = textNode.textContent.replace(/\s*\([^)]+\)\s*/g, (m) => {
            const trimmed = m.trim();
            if (primaryHint && trimmed === primaryHint.trim()) return '';
            return isVerbHint(m) ? '' : m;
        });
    }
}

function isVerbHint(fragment) {
    const inner = fragment.replace(/[()]/g, '').trim().toLowerCase();
    if (!inner) return false;
    const words = inner.split(/\s+/);
    const verbish = /^(not\s+)?[\w'-]+(ing|ed)?$|^(do|does|did|be|is|are|was|were|have|has|had|can|could|will|would|shall|should|may|might|must)$/;
    return words.every((w) => verbish.test(w) || w === 'not');
}

function normalizeParagraphText(p) {
    const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    let textNode;
    while ((textNode = walker.nextNode())) {
        if (textNode.parentElement?.tagName === 'INPUT') continue;
        textNode.textContent = textNode.textContent.replace(/\s{2,}/g, ' ');
    }
}

function prevSection(currentSectionIndex) {
    if (currentSectionIndex - 2 >= 0) {
        showSection(sections[currentSectionIndex - 2]);
        updateProgress(currentSectionIndex - 2);
    }
}

// Helper: normalize text for comparison
function normalize(s) {
    if (!s) return '';
    return s.toString().trim().toLowerCase()
        .replace(/'m\b/g, ' am')
        .replace(/'re\b/g, ' are')
        .replace(/'s\b/g, ' is')
        .replace(/n't\b/g, ' not')
        .replace(/[?!.,;:'"()]/g, '')
        .replace(/\s+/g, ' ');
}

// Helper: check radio answers against an answer key object
function gradeRadios(sectionSelector, answerKey) {
    let score = 0;
    const section = typeof sectionSelector === 'string' ? document.querySelector(sectionSelector) : sectionSelector;
    if (!section) return 0;

    Object.keys(answerKey).forEach(name => {
        const checked = section.querySelector(`input[name="${name}"]:checked`);
        const expected = answerKey[name];
        if (checked) {
            const actual = checked.value;
            if (Array.isArray(expected)) {
                if (expected.some(e => normalize(e) === normalize(actual))) score++;
            } else if (normalize(actual) === normalize(expected)) {
                score++;
            }
        }
    });
    return score;
}

// Helper: check text inputs against ordered answer array or key-value object
function gradeTextInputs(inputs, answers, startIndex, endIndex) {
    let score = 0;
    if (Array.isArray(answers)) {
        for (let i = startIndex; i < endIndex; i++) {
            if (!inputs[i]) continue;
            const val = normalize(inputs[i].value);
            const expected = answers[i - startIndex];
            if (Array.isArray(expected)) {
                if (expected.some(e => normalize(e) === val)) score++;
            } else if (val === normalize(expected)) {
                score++;
            }
        }
    } else {
        // If answers is an object mapping name to expected value
        Object.keys(answers).forEach(name => {
            const input = document.getElementsByName(name)[0];
            if (input) {
                const val = normalize(input.value);
                const expected = answers[name];
                if (Array.isArray(expected)) {
                    if (expected.some(e => normalize(e) === val)) score++;
                } else if (val === normalize(expected)) {
                    score++;
                }
            }
        });
    }
    return score;
}

// Global speaking automation and recording removed.

async function submitTest() {
    function sectionStats(sectionId) {
        const section = document.getElementById(sectionId);
        if (!section) return { answered: 0, total: 0, percent: 0 };
        const radioGroups = Array.from(section.querySelectorAll('input[type="radio"]')).reduce((acc, r) => {
            acc.add(r.name);
            return acc;
        }, new Set());
        const radioAnswered = Array.from(radioGroups).filter(name => section.querySelector(`input[name="${name}"]:checked`)).length;
        const textInputs = Array.from(section.querySelectorAll('input[type="text"]'));
        const textAnswered = textInputs.filter(i => i.value.trim().length > 0).length;
        const textareas = Array.from(section.querySelectorAll('textarea'));
        const taAnswered = textareas.filter(t => t.value.trim().length > 0).length;
        const total = radioGroups.size + textInputs.length + textareas.length;
        const answered = radioAnswered + textAnswered + taAnswered;
        return { answered, total, percent: total ? Math.round((answered / total) * 100) : 0 };
    }

    // Collect final details
    const firstName = document.getElementById('regFirstName').value.trim();
    const lastName = document.getElementById('regLastName').value.trim();
    const group = document.getElementById('regGroup').value.trim();
    const phone = document.getElementById('regPhone').value.trim();

    if (!firstName || !lastName || !group || !phone) {
        alert('Iltimos, barcha majburiy maydonlarni (Ism, Familiya, Guruh, Telefon) to\'ldiring!');
        return;
    }

    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 12) {
        alert('Iltimos, telefon raqamingizni to\'liq kiriting (+998 -- --- -- --)');
        return;
    }

    const studentName = `${firstName} ${lastName}`;

    // ============ GRAMMAR (30 points) ============

    // Q1: MCQ g1-g15 (15 pts)
    const grammarChoiceAns = { g1:'A', g2:'C', g3:'B', g4:'C', g5:'A', g6:'C', g7:'A', g8:'C', g9:'B', g10:'B', g11:'C', g12:'B', g13:'B', g14:'A', g15:'C' };
    const grammarQ1 = gradeRadios('#section-grammar input[type="radio"]', grammarChoiceAns);

    // Q2: Verb fill-in (10 pts)
    const grammarVerbAns = ["isn't", "has", "works", "moved", "was", "studied", "finished", "didn't get", "went", ["travelled", "traveled"]];
    const verbInputs = document.querySelectorAll('#section-grammar .inline-input');
    const grammarQ2 = gradeTextInputs(verbInputs, grammarVerbAns, 0, verbInputs.length);

    // Q3: Word order (5 pts)
    const wordOrderAns = [
        "when do you get up at the weekend?",
        "tina is wearing a beautiful red dress.",
        "samantha always does the housework on saturday.",
        "is there a japanese restaurant near here?",
        "what did you do last night?"
    ];
    const wordOrderInputs = document.querySelectorAll('#section-grammar .full-input');
    const grammarQ3 = gradeTextInputs(wordOrderInputs, wordOrderAns, 0, wordOrderInputs.length);

    const grammarScore = grammarQ1 + grammarQ2 + grammarQ3;

    // ============ VOCABULARY (40 points) ============

    const allVocabWords = document.querySelectorAll('#section-vocab .word-input');

    // Q4: Fill-in suffixes (10 pts) — indices 0-9
    const vocabSuffixAns = [
        ["aughter", "daughter"], ["usband", "husband"], ["offee", "coffee"],
        ["ice", "rice"], ["eakfast", "breakfast"], ["udies", "studies"],
        ["ay", "play"], ["uy", "buy"], ["acket", "jacket"], ["irt", "shirt"]
    ];
    const vocabQ4 = gradeTextInputs(allVocabWords, vocabSuffixAns, 0, 10);

    // Q5: MCQ v1-v15 (15 pts) — v10 fixed to 'C' (shower)
    const vocabChoiceAns = { v1:'B', v2:'C', v3:'C', v4:'C', v5:'B', v6:'B', v7:'B', v8:'C', v9:'A', v10:'C', v11:'A', v12:'B', v13:'B', v14:'C', v15:'C' };
    const vocabQ5 = gradeRadios('#section-vocab input[type="radio"]', vocabChoiceAns);

    // Q6: Missing words (15 pts) — indices 10-24
    const vocabMissingAns = [
        "people", "brazilian", "ugly", "hospital", "december",
        "tickets", "thursday", ["difficult", "hard"],
        "fourth", "listen", "shop",
        ["awful", "horrible", "dreadful", "terrible"],
        "wife",
        ["a car", "car"],
        "ring"
    ];
    const vocabQ6 = gradeTextInputs(allVocabWords, vocabMissingAns, 10, 25);

    const vocabScore = vocabQ4 + vocabQ5 + vocabQ6;

    // ============ PRONUNCIATION (20 points) ============

    // Q7: Stress (10 pts)
    const stressAns = { p1:'1', p2:'2', p3:'1', p4:'3', p5:'1', p6:'2', p7:'1', p8:'3', p9:'1', p10:'1' };
    const pronQ7 = gradeRadios('#section-pronunciation input[type="radio"]', stressAns);

    // Q8: Sound matching (10 pts — 2 per pair)
    const soundAns = [
        ["eight", "great"], ["there", "wear"], ["coffee", "watch"],
        ["four", "draw"], ["blue", "you"]
    ];
    let pronQ8 = 0;
    const soundInputs = document.querySelectorAll('#section-pronunciation .word-input');
    for (let i = 0; i < 5; i++) {
        const v1 = normalize(soundInputs[i * 2].value);
        const v2 = normalize(soundInputs[i * 2 + 1].value);
        const exp = soundAns[i];
        if (exp.includes(v1) && exp.includes(v2) && v1 !== v2) {
            pronQ8 += 2;
        } else if (exp.includes(v1) || exp.includes(v2)) {
            pronQ8 += 1;
        }
    }

    const pronunciationScore = pronQ7 + pronQ8;

    // ============ PRACTICAL ENGLISH (10 points) ============
    const practicalAns = ['c', 'h', 'k', 'f', 'd', 'i', 'j', 'e', 'b', 'g'];
    const practicalInputs = document.querySelectorAll('#section-practical .word-input');
    let practicalScore = 0;
    practicalInputs.forEach((input, i) => {
        if (normalize(input.value) === practicalAns[i]) practicalScore++;
    });

    // ============ READING (15 points) ============

    // Q1: Fill sentences (5 pts)
    const readingFillAns = ["teacher", "souvenirs", "boyfriend", "factory", ["16", "sixteen"]];
    const readingWordInputs = document.querySelectorAll('#section-reading .word-input');
    const readingQ1 = gradeTextInputs(readingWordInputs, readingFillAns, 0, readingWordInputs.length);

    // Q2: True/False (10 pts)
    const readingTFAns = { r1:'True', r2:'False', r3:'True', r4:'False', r5:'False', r6:'True', r7:'False', r8:'False', r9:'True', r10:'False' };
    const readingQ2 = gradeRadios('#section-reading input[type="radio"]', readingTFAns);

    const readingScore = readingQ1 + readingQ2;

    // ============ LISTENING (10 points) ============
    // Part 1: Toby & Mother (B, A, C, B, C)
    // Part 2: Five conversations (A, C, B, C, B)
    const listeningAns = { 
        l1:'B', l2:'A', l3:'C', l4:'B', l5:'C', 
        l6:'A', l7:'C', l8:'B', l9:'C', l10:'B' 
    };
    const listeningScore = gradeRadios('#section-listening input[type="radio"]', listeningAns);

    // MANUAL SECTIONS
    const writingText = document.querySelector('.writing-area')?.value || '';
    const speakingText = document.getElementById('speakingTranscript')?.value?.trim() || '';

    // Total auto-graded: 125 out of 150 (Writing 10 + Speaking 15 manual)
    const totalAutoScore = grammarScore + vocabScore + pronunciationScore + practicalScore + readingScore + listeningScore;

    // Final Submission Object
    const submission = {
        studentName: studentName,
        studentUsername: localStorage.getItem('currentUsername') || ('guest_' + Date.now()),
        testType: document.querySelector('.test-header h1')?.innerText?.trim() || 'Unit Test',
        score: totalAutoScore,
        group: group,
        phone: phone,
        rawAnswers: {
            writingText,
            speakingText,
            grammarScore, vocabScore, pronunciationScore, practicalScore, readingScore, listeningScore
        },
        sectionCompletion: {
            grammar: sectionStats('section-grammar'),
            vocabulary: sectionStats('section-vocab'),
            pronunciation: sectionStats('section-pronunciation'),
            practicalEnglish: sectionStats('section-practical'),
            reading: sectionStats('section-reading'),
            writing: sectionStats('section-writing'),
            listening: sectionStats('section-listening'),
            speaking: sectionStats('section-speaking')
        }
    };

    const pathParts = window.location.pathname.split('/');
    const filename = pathParts[pathParts.length - 1] || 'test.html';

    const testKeyMap = {
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

    for (let i = 1; i <= 12; i++) {
        testKeyMap[`unit${i}.html`] = `unit_${i}`;
        testKeyMap[`unit${i}-elementary.html`] = `elementary_unit_${i}`;
        testKeyMap[`unit${i}-pre-intermediate.html`] = `preint_unit_${i}`;
    }

    const testKey = testKeyMap[filename] || 'unknown_test';

    let level = 'beginner';
    if (filename.includes('elementary')) level = 'elementary';
    else if (filename.includes('pre-intermediate')) level = 'preintermediate';
    else level = localStorage.getItem('currentUserLevel') || 'beginner';

    const percentage = Math.round((totalAutoScore / 125) * 100);

    // 1. Hidden vault backup (always — even if cloud fails)
    const cloudPayload = {
        student_name: submission.studentName,
        student_username: submission.studentUsername,
        test_type: submission.testType,
        test_key: testKey,
        level: level,
        score: submission.score,
        percentage: percentage,
        group_name: submission.group,
        phone: submission.phone,
        raw_answers: submission.rawAnswers,
        section_completion: submission.sectionCompletion
    };

    if (typeof window.eduVaultSave === 'function') {
        await window.eduVaultSave(cloudPayload).catch(() => {});
    }

    // 2. Save locally for fallback
    const existing = JSON.parse(localStorage.getItem('edu_submissions')) || [];
    existing.push({ ...submission, timestamp: new Date().toISOString(), submissionId: `sub_${Date.now()}` });
    localStorage.setItem('edu_submissions', JSON.stringify(existing));
    if (window.eduSupabase && submission.studentUsername) {
        await Promise.all([
            window.eduSupabase.from('submissions').insert([{
                student_name: submission.studentName,
                student_username: submission.studentUsername,
                test_type: submission.testType,
                test_key: testKey,
                level: level,
                score: submission.score,
                percentage: percentage,
                group_name: submission.group,
                phone: submission.phone,
                raw_answers: submission.rawAnswers,
                section_completion: submission.sectionCompletion
            }]),
            
            window.eduSupabase.from('student_progress').upsert([{
                student_username: submission.studentUsername,
                level: level,
                test_key: testKey,
                test_name: submission.testType,
                completed: true,
                score: submission.score,
                percentage: percentage,
                completed_at: new Date().toISOString()
            }])
        ]).then(([{ error: subError }, { error: progError }]) => {
            if (subError) console.error("Submission Save Error:", subError.message);
            if (progError) console.error("Progress Save Error:", progError.message);
            if (!subError && !progError) console.log("Test results and progress synced to cloud.");
        });
    }

    // UI Updates
    document.querySelectorAll('.test-section').forEach(section => {
        section.classList.remove('active');
    });

    const header = document.querySelector('.test-header');
    if (header) header.style.display = 'none';

    const resultSection = document.getElementById('section-result');
    if (resultSection) {
        resultSection.style.display = 'block';
        resultSection.classList.add('active');
        const resultTitle = resultSection.querySelector('h2');
        const resultText = resultSection.querySelector('p');
        if (resultTitle) resultTitle.innerText = `${submission.testType} Submitted Successfully! 🎉`;
        if (resultText) resultText.innerText = `Congratulations! Your score: ${totalAutoScore} / 125 (${percentage}%). Redirecting to dashboard in 5 seconds...`;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const progressContainer = document.querySelector('.test-progress');
    if (progressContainer) progressContainer.style.display = 'none';
    setTimeout(() => {
        window.location.href = 'dashboard.html';
    }, 5000);
}

// Initialization (bitta DOMContentLoaded — ikki marta chaqirilmasin)
document.addEventListener('DOMContentLoaded', () => {
    inlineBlankInputs();
    enforceExamSecurity();
    initializeTheme();
    setupThemeToggle();

    updateProgress(0);

    // Mobile Menu Toggle
    const menuToggle = document.getElementById('menuToggle');
    const navLinks = document.getElementById('navLinks');

    if (menuToggle && navLinks) {
        const navbar = menuToggle.closest('.navbar, .test-nav, .admin-nav');

        const setMobileMenuOpen = (isOpen) => {
            if (navbar) navbar.classList.toggle('menu-open', isOpen);
            document.body.classList.toggle('nav-menu-open', isOpen);
            const icon = menuToggle.querySelector('i');
            if (!icon) return;
            icon.classList.toggle('fa-bars', !isOpen);
            icon.classList.toggle('fa-xmark', isOpen);
        };

        menuToggle.addEventListener('click', () => {
            const isOpen = !navLinks.classList.contains('active');
            navLinks.classList.toggle('active', isOpen);
            setMobileMenuOpen(isOpen);
        });

        navLinks.addEventListener('click', (e) => {
            if (!e.target.closest('a')) return;
            navLinks.classList.remove('active');
            setMobileMenuOpen(false);
        });

        window.addEventListener('resize', () => {
            if (window.innerWidth > 768 && navLinks.classList.contains('active')) {
                navLinks.classList.remove('active');
                setMobileMenuOpen(false);
            }
        });
    }

    // Phone Prefix Enforcement (+998)
    const phoneInput = document.getElementById('regPhone');
    if (phoneInput) {
        phoneInput.addEventListener('input', function (e) {
            if (!this.value.startsWith('+998 ')) {
                this.value = '+998 ';
            }
        });

        phoneInput.addEventListener('keydown', function (e) {
            if (this.selectionStart < 5 && (e.key === 'Backspace' || e.key === 'Delete')) {
                e.preventDefault();
            }
        });
    }

    // Dropdown toggle for mobile
    const dropdownToggle = document.querySelector('.dropdown-toggle');
    if (dropdownToggle) {
        dropdownToggle.addEventListener('click', (e) => {
            if (window.innerWidth <= 768) {
                e.stopPropagation();
                const content = dropdownToggle.nextElementSibling;
                const isVisible = content.style.display === 'block';
                content.style.display = isVisible ? 'none' : 'block';
            }
        });
    }

    // Initialize Enhanced Listening Security
    function initializeListeningSecurity() {
        const audioTracks = document.querySelectorAll('.listening-audio');
        if (!audioTracks.length) return;

        // Get unique test ID for storage key
        const testTitle = document.title.split('|')[0].trim().replace(/\s+/g, '_').toLowerCase();

        audioTracks.forEach((audio, idx) => {
            const audioSrc = audio.querySelector('source')?.getAttribute('src') || audio.getAttribute('src') || 'unknown';
            const storageKey = `edu_listen_${testTitle}_${idx}`;
            
            // State management
            let playCount = parseInt(localStorage.getItem(storageKey)) || 0;
            const maxPlays = 2;
            let lastUpdate = 0;

            // Hide native controls
            audio.controls = false;
            audio.style.display = 'none';

            // Create Premium UI
            const player = document.createElement('div');
            player.className = `edu-audio-player ${playCount >= maxPlays ? 'disabled' : ''}`;
            player.innerHTML = `
                <div class="edu-audio-header">
                    <div class="edu-audio-title"><i class="fa-solid fa-volume-high"></i> Listening Section</div>
                    <div class="edu-audio-attempts">${playCount} / ${maxPlays} listens used</div>
                </div>
                <div class="edu-audio-main">
                    <button type="button" class="edu-play-btn" ${playCount >= maxPlays ? 'disabled' : ''}>
                        <i class="fa-solid fa-play"></i>
                    </button>
                    <div class="edu-audio-track-container">
                        <div class="edu-audio-track"><div class="edu-audio-progress"></div></div>
                        <div class="edu-audio-time">
                            <span class="curr-time">0:00</span>
                            <span class="total-time">0:00</span>
                        </div>
                    </div>
                </div>
                <div class="edu-countdown-overlay">
                    <div class="edu-countdown-text">3</div>
                </div>
                <div class="edu-audio-message"></div>
            `;

            audio.after(player);

            const playBtn = player.querySelector('.edu-play-btn');
            const progress = player.querySelector('.edu-audio-progress');
            const currTimeText = player.querySelector('.curr-time');
            const totalTimeText = player.querySelector('.total-time');
            const attemptsText = player.querySelector('.edu-audio-attempts');
            const overlay = player.querySelector('.edu-countdown-overlay');
            const countdownText = player.querySelector('.edu-countdown-text');
            const msg = player.querySelector('.edu-audio-message');

            const formatTime = (s) => {
                if (isNaN(s)) return '0:00';
                const m = Math.floor(s / 60);
                const sec = Math.floor(s % 60);
                return `${m}:${sec < 10 ? '0' : ''}${sec}`;
            };

            audio.addEventListener('loadedmetadata', () => {
                totalTimeText.innerText = formatTime(audio.duration);
            });

            // Prevent Seeking and Logic Update (throttled — smoother UI)
            let lastTimeTick = 0;
            audio.addEventListener('timeupdate', () => {
                const now = performance.now();
                if (audio.currentTime < lastUpdate - 1) {
                    audio.currentTime = lastUpdate;
                }
                lastUpdate = audio.currentTime;

                if (now - lastTimeTick < 250) return;
                lastTimeTick = now;

                const percent = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
                progress.style.width = `${percent}%`;
                currTimeText.innerText = formatTime(audio.currentTime);
            });

            audio.addEventListener('ended', () => {
                playBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i>';
                if (playCount >= maxPlays) {
                    playBtn.disabled = true;
                    msg.innerText = 'Listening limit reached.';
                    msg.className = 'edu-audio-message error';
                }
            });

            audio.addEventListener('play', () => {
                document.querySelectorAll('audio').forEach(a => { if(a !== audio) a.pause(); });
            });

            playBtn.addEventListener('click', () => {
                if (playCount >= maxPlays && (audio.paused || audio.ended)) return;

                if (!audio.paused && !audio.ended) {
                    // Currently playing, so Pause
                    audio.pause();
                    playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
                } else {
                    // If at start, trigger countdown
                    if (audio.currentTime === 0 || audio.ended) {
                        if (playCount >= maxPlays) {
                            alert('You have used all listening attempts for this track.');
                            return;
                        }

                        // Unlock audio context immediately during the click event
                        const playPromise = audio.play();
                        if (playPromise !== undefined) {
                            playPromise.then(_ => {
                                audio.pause();
                                audio.currentTime = 0;
                            }).catch(error => {
                                console.warn("Audio unlock failed:", error);
                            });
                        }

                        playBtn.disabled = true;
                        overlay.style.display = 'flex';
                        let count = 3;
                        countdownText.innerText = count;

                        const timer = setInterval(() => {
                            count--;
                            if (count > 0) {
                                countdownText.innerText = count;
                            } else {
                                clearInterval(timer);
                                overlay.style.display = 'none';
                                
                                playCount++;
                                localStorage.setItem(storageKey, playCount);
                                attemptsText.innerText = `${playCount} / ${maxPlays} listens used`;
                                
                                audio.currentTime = 0;
                                lastUpdate = 0;
                                
                                const finalPlay = audio.play();
                                if (finalPlay !== undefined) {
                                    finalPlay.catch(e => {
                                        console.error("Playback failed after countdown:", e);
                                        msg.innerText = "Error playing audio. Please try again.";
                                        msg.className = 'edu-audio-message error';
                                    });
                                }
                                
                                playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
                                playBtn.disabled = false;
                            }
                        }, 1000);
                    } else {
                        // Resuming from pause
                        audio.play();
                        playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
                    }
                }
            });
        });
    }

    initializeListeningSecurity();

    // Reading text highlight
    document.addEventListener('mouseup', () => {
        const selection = window.getSelection();
        if (!selection.rangeCount || selection.isCollapsed) return;

        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;

        const isInsidePassage = container.nodeType === 3
            ? container.parentNode.closest('.reading-passages, .passage')
            : container.closest('.reading-passages, .passage');

        if (isInsidePassage && selection.toString().trim().length > 0) {
            const span = document.createElement('span');
            span.className = 'highlighted-text';

            try {
                range.surroundContents(span);
            } catch (err) {
                try {
                    const fragment = range.extractContents();
                    span.appendChild(fragment);
                    range.insertNode(span);
                } catch (e2) {
                    console.warn('Could not highlight multi-element selection perfectly.');
                }
            }

            window.getSelection().removeAllRanges();
        }
    });

    document.addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('highlighted-text')) {
            const parent = target.parentNode;
            while (target.firstChild) {
                parent.insertBefore(target.firstChild, target);
            }
            parent.removeChild(target);
            parent.normalize();
        }
    });
});

// Centralized Supabase Submission Handler
async function saveSubmissionToSupabase(submission) {
    console.log('Starting Supabase submission...', submission);
    if (window.eduSupabase) {
        try {
            // Normalizing different section names from various unit tests to a standard format
            const rawSC = submission.sectionCompletion || {};
            const normalizedSC = {};
            if (Object.keys(rawSC).length === 0) {
                normalizedSC.grammar = { answered: 0, total: 0, percent: 0 };
                normalizedSC.reading = { answered: 0, total: 0, percent: 0 };
                normalizedSC.writing = { answered: 0, total: 0, percent: 0 };
                normalizedSC.listening = { answered: 0, total: 0, percent: 0 };
            } else {
                Object.entries(rawSC).forEach(([k, v]) => {
                    normalizedSC[k] = v || { answered: 0, total: 0, percent: 0 };
                });
            }

            // Normalizing raw answers (writing/speaking) from different unit tests
            const rawRA = submission.rawAnswers || {};
            const normalizedRA = {
                writingText: rawRA.writingText || rawRA.writing || rawRA.writingAnswers || ""
            };

            const insertData = {
                student_name: submission.studentName,
                student_username: localStorage.getItem('currentUsername') || sessionStorage.getItem('currentUsername') || '',
                test_type: submission.type,
                score: (submission.scores && typeof submission.scores.totalObjectiveScore === 'number') ? submission.scores.totalObjectiveScore : 0,
                group_name: submission.group || submission.group_name || '',
                phone: submission.phone || '',
                raw_answers: normalizedRA,
                section_completion: normalizedSC
            };

            if (typeof window.eduVaultSave === 'function') {
                await window.eduVaultSave(insertData).catch(() => {});
            }
            
            console.log('Sending data to Supabase:', insertData);

            const { error } = await window.eduSupabase
                .from('submissions')
                .insert([insertData]);
            
            if (error) {
                console.error('Supabase DB Error:', error);
                alert('Natija bulutga saqlanmadi: ' + error.message + '\n\nAdmin tekshirsin: Supabase ulanishi va Vercel Environment Variables.');
                return false;
            }
            console.log('Submission saved to Supabase successfully.');
            return true;
        } catch (err) {
            console.error('Supabase Catch Error:', err);
            alert('Bulutga ulanish xatosi. Internet va sayt sozlamalarini tekshiring.');
            return false;
        }
    } else {
        console.error('Supabase instance (window.eduSupabase) not found!');
        alert('Supabase ulanmagan. Vercel da SUPABASE_URL va SUPABASE_ANON_KEY qo\'yilganini tekshiring, keyin Redeploy qiling.');
        return false;
    }
}
