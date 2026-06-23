import { setCors, handleOptions } from './_lib/cors.js';
import { callGemini } from './_lib/gemini.js';

const LEVEL_HINTS = {
    beginner: `Student level: Beginner (A1). Use very simple words and short sentences. Ask easy questions about daily life, family, food, and hobbies.`,
    elementary: `Student level: Elementary (A2). Use clear everyday English. Questions can be a bit longer but still simple.`,
    'pre-intermediate': `Student level: Pre-intermediate (B1). Use natural conversational English. You can ask slightly deeper questions.`,
    intermediate: `Student level: Intermediate. Use natural conversational English.`
};

const RESPONSE_RULES = `You are Mia, a warm, playful, supportive IELTS speaking coach at EDU LIFE.
Sound like a smart funny friend, not a robotic teacher.
Use natural English with contractions. Be upbeat, relaxed, and human.
The student may mix Uzbek or Russian with English or make mistakes. Understand the meaning first.
Never shame, never over-correct, never sound strict.
Keep the main reply short and natural. Usually 2-4 short sentences.
If there is a mistake, fix only the most useful one in a gentle way.
Always keep the conversation moving with one clear next question unless you are giving a cue card.
Do not use markdown, bullet symbols, or labels inside the reply text.
Return ONLY valid JSON with this exact shape:
{
  "reply": "string",
  "feedback": {
    "praise": "short string",
    "correction": "short string",
    "tip": "short string",
    "focus": "short string",
    "fluency": "short string",
    "grammar": "short string",
    "vocabulary": "short string",
    "pronunciation": "short string",
    "estimatedBand": "short string",
    "cefrLevel": "short string",
    "examPart": "short string"
  }
}
Feedback must be short, clear, and student-friendly.
If no correction is needed, still fill "correction" with a positive better-phrase style note.
"estimatedBand" should be a realistic current IELTS speaking estimate like "Band 4.5-5.0" or "Band 6.0".
"cefrLevel" should be one short CEFR label like "A2", "B1", or "B1-B2".
"examPart" should be one short label like "Free Talk", "Part 1", "Part 2", "Part 3", or "Mock Review".`;

const MODE_PROMPTS = {
    free: `Mode: Free Talk.
Chat like a friendly speaking buddy.
Ask easy everyday questions about school, hobbies, family, food, future plans, and daily life.
React naturally first, then guide softly, then ask one simple follow-up.`,

    part1: `Mode: IELTS Speaking Part 1.
Ask only one personal question at a time about familiar topics like home, studies, work, routines, food, music, travel, or hobbies.
After the student's answer, do this flow naturally:
1. short warm reaction
2. one tiny correction or better phrase
3. one short next question
Keep it light and friendly, like a real coach.`,

    part2: `Mode: IELTS Speaking Part 2.
If the user asks to start or asks for a topic, give exactly one cue card topic with 3-4 simple prompt lines inside the reply.
Tell the student to speak for 1-2 minutes in a natural way.
After the student answers, praise one strength, give one better phrase, give one tip, then offer either a follow-up question or a new cue card.`,

    part3: `Mode: IELTS Speaking Part 3.
Ask deeper opinion questions related to education, technology, society, lifestyle, media, work, or culture.
Push the student to explain reasons, comparisons, results, and examples.
After each answer, react warmly, improve one phrase if useful, then ask one deeper follow-up question.`,

    assessment: `Mode: IELTS Speaking Mock Assessment.
Run a short IELTS-style speaking mock while still sounding warm and human.
Follow this structure:
- Opening: greet briefly and ask one Part 1 question.
- After answer 1: short reaction, one useful improvement, then another Part 1 question.
- After answer 2: move to Part 2 and give exactly one cue card topic with 3-4 short prompt lines.
- After answer 3: react briefly, improve one phrase, then ask one Part 3 question connected to the cue card topic.
- After answer 4: ask one deeper Part 3 follow-up question.
- After answer 5 or later: keep the reply short, give a natural final follow-up or mock wrap-up, and make feedback reflect the student's current level clearly.
Keep the conversation examiner-like, but still friendly and encouraging.
Always fill "estimatedBand", "cefrLevel", and "examPart" in feedback.`
};

function buildAssessmentTurnHint(history, sessionStart) {
    if (sessionStart) {
        return `Assessment step:
- This is the start of the mock.
- Ask one warm IELTS Part 1 question only.
- Set feedback.examPart to "Part 1".`;
    }

    const answeredCount = history.filter((turn) => turn?.role === 'user' && turn?.text?.trim()).length + 1;

    if (answeredCount <= 1) {
        return `Assessment step:
- The student has just answered Part 1 question 1.
- Give a short reaction, one gentle better phrase, and ask one more Part 1 question.
- Set feedback.examPart to "Part 1".`;
    }

    if (answeredCount === 2) {
        return `Assessment step:
- The student has completed Part 1.
- Move to Part 2 now.
- Give exactly one cue card topic with 3-4 short prompt lines and invite the student to speak for 1-2 minutes.
- Set feedback.examPart to "Part 2".`;
    }

    if (answeredCount === 3) {
        return `Assessment step:
- The student has answered the Part 2 cue card.
- React briefly, improve one phrase, and ask one connected Part 3 question.
- Set feedback.examPart to "Part 3".`;
    }

    if (answeredCount === 4) {
        return `Assessment step:
- The student has answered Part 3 question 1.
- Ask one deeper Part 3 follow-up question.
- Set feedback.examPart to "Part 3".`;
    }

    return `Assessment step:
- The student has finished a short mock.
- Keep the conversation natural.
- Give a short wrap-up style reply or one final reflective question.
- Make the feedback clearly reflect the student's current speaking level.
- Set feedback.examPart to "Mock Review".`;
}

function buildSystemPrompt(mode, level, history = [], sessionStart = false) {
    const modeKey = MODE_PROMPTS[mode] ? mode : 'free';
    const levelKey = LEVEL_HINTS[level] ? level : 'intermediate';
    const assessmentHint = modeKey === 'assessment'
        ? `\n\n${buildAssessmentTurnHint(history, sessionStart)}`
        : '';
    return `${RESPONSE_RULES}\n\n${MODE_PROMPTS[modeKey]}\n\n${LEVEL_HINTS[levelKey]}${assessmentHint}`;
}

function buildContents(history, message) {
    const contents = [];
    for (const turn of history.slice(-12)) {
        if (!turn?.role || !turn?.text?.trim()) continue;
        contents.push({
            role: turn.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: turn.text.trim() }]
        });
    }
    contents.push({ role: 'user', parts: [{ text: message.trim() }] });
    return contents;
}

function tryParseJson(text) {
    if (!text) return null;

    try {
        return JSON.parse(text);
    } catch {}

    const fencedMatch = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/i);
    if (fencedMatch?.[1]) {
        try {
            return JSON.parse(fencedMatch[1].trim());
        } catch {}
    }

    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd > jsonStart) {
        try {
            return JSON.parse(text.slice(jsonStart, jsonEnd + 1));
        } catch {}
    }

    return null;
}

function normalizeFeedback(feedback = {}) {
    return {
        praise: String(feedback.praise || 'Nice effort. You kept the conversation going.').trim(),
        correction: String(feedback.correction || 'Better phrase: keep your sentence simple and clear.').trim(),
        tip: String(feedback.tip || 'Next time add one reason or example.').trim(),
        focus: String(feedback.focus || 'Focus on clear ideas and smooth answers.').trim(),
        fluency: String(feedback.fluency || 'Getting smoother').trim(),
        grammar: String(feedback.grammar || 'Mostly clear').trim(),
        vocabulary: String(feedback.vocabulary || 'Good everyday words').trim(),
        pronunciation: String(feedback.pronunciation || 'Speak a bit slower').trim(),
        estimatedBand: String(feedback.estimatedBand || 'Band 4.5-5.0').trim(),
        cefrLevel: String(feedback.cefrLevel || 'A2-B1').trim(),
        examPart: String(feedback.examPart || 'Free Talk').trim()
    };
}

function normalizeAiPayload(text) {
    const parsed = tryParseJson(text);
    if (parsed?.reply) {
        return {
            reply: String(parsed.reply).trim(),
            feedback: normalizeFeedback(parsed.feedback)
        };
    }

    return {
        reply: String(text || '').trim(),
        feedback: normalizeFeedback()
    };
}

export default async function handler(req, res) {
    setCors(res);
    if (handleOptions(req, res)) return;

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.GEMINI_API_KEY || '';
    if (!apiKey && !process.env.OPENROUTER_API_KEY) {
        return res.status(500).json({ error: 'No AI API key is configured on the server. Set OPENROUTER_API_KEY or GEMINI_API_KEY.' });
    }

    try {
        const { message, history = [], mode = 'free', level = 'intermediate', sessionStart = false } = req.body || {};
        const text = String(message || '').trim();
        if (!text) {
            return res.status(400).json({ error: 'Message is required.' });
        }

        const modeKey = MODE_PROMPTS[mode] ? mode : 'free';
        const safeHistory = Array.isArray(history) ? history : [];
        const systemPrompt = buildSystemPrompt(
            modeKey,
            String(level || 'intermediate').toLowerCase(),
            safeHistory,
            Boolean(sessionStart)
        );
        const contents = buildContents(safeHistory, text);

        const result = await callGemini({
            apiKey,
            systemPrompt,
            contents,
            generationConfig: {
                temperature: 0.8,
                maxOutputTokens: 512,
                responseMimeType: 'application/json'
            }
        });

        const rawText = String(result?.text || '').trim();
        if (!rawText) {
            return res.status(502).json({ error: 'Empty response from AI.' });
        }

        const payload = normalizeAiPayload(rawText);
        if (!payload.reply) {
            return res.status(502).json({ error: 'Empty response from AI.' });
        }

        return res.status(200).json({ reply: payload.reply, feedback: payload.feedback, mode: modeKey });
    } catch (err) {
        console.error('Speaking API error:', err);
        return res.status(500).json({ error: err?.message || 'Failed to process speaking request.' });
    }
}
