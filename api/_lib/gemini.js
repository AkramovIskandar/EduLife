const DEFAULT_GEMINI_MODELS = [
    'gemini-1.5-flash',
    'gemini-1.5-flash-8b',
    'gemini-2.0-flash'
];

const DEFAULT_OPENROUTER_MODEL = 'openrouter/free';

export async function callLanguageModel({ apiKey, systemPrompt, contents, generationConfig = {}, provider = 'auto' }) {
    const selectedProvider = resolveProvider(provider, apiKey);

    if (selectedProvider === 'openrouter') {
        return callOpenRouter({
            apiKey: process.env.OPENROUTER_API_KEY,
            systemPrompt,
            contents,
            generationConfig
        });
    }

    return callGeminiDirect({
        apiKey,
        systemPrompt,
        contents,
        generationConfig
    });
}

export async function callGemini(args) {
    return callLanguageModel(args);
}

async function callGeminiDirect({ apiKey, systemPrompt, contents, generationConfig = {} }) {
    const models = getGeminiModelCandidates();
    let lastError = null;

    for (const model of models) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: systemPrompt }] },
                contents,
                generationConfig
            })
        });

        const data = await response.json();
        if (response.ok) {
            return {
                provider: 'gemini',
                model,
                text: extractGeminiText(data),
                data
            };
        }

        lastError = {
            status: response.status,
            message: data?.error?.message || `Gemini API error (${response.status})`,
            model
        };

        if (!shouldTryNextGeminiModel(lastError.message, response.status)) {
            break;
        }
    }

    if (lastError && /quota|rate limit|billing/i.test(lastError.message)) {
        throw new Error(`Gemini quota tugagan yoki billing yoqilmagan. Ishlagan model topilmadi. Oxirgi urinish: ${lastError.model}.`);
    }

    throw new Error(lastError?.message || 'Gemini API request failed.');
}

async function callOpenRouter({ apiKey, systemPrompt, contents, generationConfig = {} }) {
    if (!apiKey) {
        throw new Error('OPENROUTER_API_KEY is not configured on the server.');
    }

    const model = String(process.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL).trim();
    const payload = {
        model,
        messages: buildOpenRouterMessages(systemPrompt, contents),
        temperature: generationConfig.temperature,
        max_tokens: generationConfig.maxOutputTokens
    };

    if (generationConfig.responseMimeType === 'application/json') {
        payload.response_format = { type: 'json_object' };
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://edulife.local',
            'X-Title': process.env.OPENROUTER_APP_NAME || 'EduLife'
        },
        body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
        const message = data?.error?.message || `OpenRouter API error (${response.status})`;
        if (response.status === 429) {
            throw new Error('OpenRouter limitiga yetilgan. Biroz kutib qayta urinib ko‘ring yoki boshqa free model tanlang.');
        }
        throw new Error(message);
    }

    return {
        provider: 'openrouter',
        model: data?.model || model,
        text: extractOpenRouterText(data),
        data
    };
}

function resolveProvider(provider, apiKey) {
    if (provider === 'gemini' || provider === 'openrouter') {
        return provider;
    }

    if (process.env.OPENROUTER_API_KEY) {
        return 'openrouter';
    }

    if (apiKey || process.env.GEMINI_API_KEY) {
        return 'gemini';
    }

    throw new Error('No AI provider configured. Set OPENROUTER_API_KEY or GEMINI_API_KEY.');
}

function getGeminiModelCandidates() {
    const envModels = String(process.env.GEMINI_MODEL || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

    return Array.from(new Set([...envModels, ...DEFAULT_GEMINI_MODELS]));
}

function buildOpenRouterMessages(systemPrompt, contents = []) {
    const messages = [];

    if (String(systemPrompt || '').trim()) {
        messages.push({ role: 'system', content: String(systemPrompt).trim() });
    }

    for (const item of contents) {
        const role = item?.role === 'model' ? 'assistant' : 'user';
        const text = Array.isArray(item?.parts)
            ? item.parts.map((part) => String(part?.text || '')).join('\n').trim()
            : '';
        if (!text) continue;
        messages.push({ role, content: text });
    }

    return messages;
}

function extractGeminiText(data) {
    return data?.candidates?.[0]?.content?.parts?.map((part) => part.text).join('').trim() || '';
}

function extractOpenRouterText(data) {
    const choice = data?.choices?.[0]?.message;
    if (typeof choice?.content === 'string') {
        return choice.content.trim();
    }
    if (Array.isArray(choice?.content)) {
        return choice.content
            .map((part) => (typeof part === 'string' ? part : String(part?.text || '')))
            .join('')
            .trim();
    }
    return '';
}

function shouldTryNextGeminiModel(message, status) {
    if (status === 404 || status === 429) return true;
    return /quota|rate limit|not found|unsupported|not available for generatecontent/i.test(String(message || ''));
}
