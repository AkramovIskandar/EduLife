import { setCors, handleOptions } from './_lib/cors.js';
import { callGemini } from './_lib/gemini.js';

const PLACEMENT_PROMPT = `You are Alex, a warm and chatty English level checker at EDU LIFE — like a friendly person on the street, not a strict examiner.
Your job: discover whether the student fits Beginner (A1), Elementary (A2), or Pre-intermediate (B1) through a short spoken-style chat.

Rules:
- Ask ONE question at a time. Start very easy (name, daily life), then gradually use slightly harder grammar and vocabulary.
- Talk naturally. Use contractions (I'm, you're, gonna). Be upbeat and patient.
- The student may mix Uzbek/Russian with English or make mistakes — always understand the meaning.
- Keep each reply to 2-4 short sentences plus your question (except the final turn).
- Do NOT say "Beginner/Elementary/Pre-intermediate" until the final turn.

Final turn rules (when instructed this is the FINAL turn):
- Give your level recommendation using EXACTLY one of these tags on its own line:
[[LEVEL:beginner]]
[[LEVEL:elementary]]
[[LEVEL:preintermediate]]
- After the tag, write 2-3 friendly sentences explaining why and encourage them to choose that level on EDU LIFE.`;

function buildContents(history, message) {
    const contents = [];
    for (const turn of history.slice(-14)) {
        if (!turn?.role || !turn?.text?.trim()) continue;
        contents.push({
            role: turn.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: turn.text.trim() }]
        });
    }
    contents.push({ role: 'user', parts: [{ text: message.trim() }] });
    return contents;
}

function parseLevel(text) {
    const match = String(text || '').match(/\[\[LEVEL:(beginner|elementary|preintermediate)\]\]/i);
    return match ? match[1].toLowerCase() : null;
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
        const { message, history = [], userTurns = 0 } = req.body || {};
        const text = String(message || '').trim();
        if (!text) {
            return res.status(400).json({ error: 'Message is required.' });
        }

        const turns = Number(userTurns) || 0;
        const isFinal = turns >= 5;
        const turnHint = isFinal
            ? 'This is the FINAL turn. You MUST output [[LEVEL:beginner]], [[LEVEL:elementary]], or [[LEVEL:preintermediate]] and your recommendation. Do not ask another question.'
            : `The student has answered ${turns} question(s). Ask placement question number ${Math.min(turns + 1, 5)} of 5 — slightly harder if turns > 0.`;

        const contents = buildContents(Array.isArray(history) ? history : [], `${text}\n\n[System note for AI only: ${turnHint}]`);

        const result = await callGemini({
            apiKey,
            systemPrompt: PLACEMENT_PROMPT,
            contents,
            generationConfig: {
                temperature: 0.75,
                maxOutputTokens: 512
            }
        });

        const reply = String(result?.text || '').trim();
        if (!reply) {
            return res.status(502).json({ error: 'Empty response from AI.' });
        }

        const level = parseLevel(reply);
        const displayReply = reply.replace(/\[\[LEVEL:(beginner|elementary|preintermediate)\]\]/gi, '').trim();

        return res.status(200).json({
            reply: displayReply,
            level: level || null,
            complete: Boolean(level) || isFinal,
            userTurns: turns + 1
        });
    } catch (err) {
        console.error('Level check API error:', err);
        return res.status(500).json({ error: err?.message || 'Failed to process level check.' });
    }
}
