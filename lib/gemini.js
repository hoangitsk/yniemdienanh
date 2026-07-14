'use strict';

const DEFAULT_GEMINI_MODELS = [
    'gemini-3-flash-preview',
    'gemini-3.5-flash',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemma-4-26b-a4b-it',
    'gemma-4-31b-it'
];

const FALLBACK_STATUSES = new Set([403, 404, 408, 429, 500, 502, 503, 504]);

function parseCsv(value) {
    return String(value || '').split(',').map(item => item.trim()).filter(Boolean);
}

function getGeminiConfig(env = process.env) {
    const keys = parseCsv(env.GEMINI_API_KEYS || env.GEMINI_API_KEY);
    const configuredModels = parseCsv(env.GEMINI_MODELS);
    return {
        keys,
        models: configuredModels.length ? configuredModels : DEFAULT_GEMINI_MODELS
    };
}

async function readJson(response) {
    try {
        return await response.json();
    } catch (_) {
        return null;
    }
}

function apiMessage(payload, fallback) {
    return payload?.error?.message || payload?.message || fallback;
}

function parseModelJson(text) {
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    try {
        return JSON.parse(cleaned);
    } catch (_) {
        // Một số model Gemma in phần suy luận rồi mới in JSON. Thu thập từng
        // object cân bằng và dùng object JSON hợp lệ cuối cùng.
        const objects = [];
        let start = -1;
        let depth = 0;
        let inString = false;
        let escaped = false;

        for (let index = 0; index < cleaned.length; index++) {
            const char = cleaned[index];
            if (inString) {
                if (escaped) escaped = false;
                else if (char === '\\') escaped = true;
                else if (char === '"') inString = false;
                continue;
            }
            if (char === '"' && depth > 0) {
                inString = true;
            } else if (char === '{') {
                if (depth === 0) start = index;
                depth++;
            } else if (char === '}' && depth > 0) {
                depth--;
                if (depth === 0 && start !== -1) {
                    try {
                        objects.push(JSON.parse(cleaned.slice(start, index + 1)));
                    } catch (_) {
                        // Tiếp tục tìm object JSON kế tiếp.
                    }
                    start = -1;
                }
            }
        }

        if (objects.length) return objects[objects.length - 1];
        throw _;
    }
}

async function generateGeminiJson(prompt, options = {}) {
    const fetchImpl = options.fetchImpl || global.fetch;
    const config = options.keys && options.models ? options : getGeminiConfig(options.env);
    const { keys, models } = config;

    if (typeof fetchImpl !== 'function') {
        throw Object.assign(new Error('Server không hỗ trợ fetch để gọi Gemini API.'), { status: 500 });
    }
    if (!keys.length) {
        throw Object.assign(new Error('GEMINI_API_KEY chưa được cấu hình trên server.'), { status: 500 });
    }
    if (!models.length) {
        throw Object.assign(new Error('GEMINI_MODELS chưa có model nào.'), { status: 500 });
    }

    const attempts = [];

    // Thử tuần tự model và key; các key có thể thuộc project/quota độc lập.
    for (const model of models) {
        for (const key of keys) {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
            let response;

            try {
                response = await fetchImpl(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        // Gemma tuân theo yêu cầu JSON trong prompt nhưng không dùng
                        // responseMimeType trên mọi phiên bản API.
                        ...(model.startsWith('gemma-')
                            ? {}
                            : { generationConfig: { responseMimeType: 'application/json' } })
                    })
                });
            } catch (error) {
                attempts.push({ model, status: 503, message: error.message });
                continue;
            }

            const payload = await readJson(response);
            if (!response.ok) {
                attempts.push({
                    model,
                    status: response.status,
                    message: apiMessage(payload, `HTTP ${response.status}`)
                });
                if (FALLBACK_STATUSES.has(response.status)) continue;
                throw Object.assign(
                    new Error(apiMessage(payload, 'Gemini từ chối yêu cầu.')),
                    { status: response.status, attempts }
                );
            }

            const text = payload?.candidates?.[0]?.content?.parts
                ?.map(part => part.text || '').join('').trim();
            if (!text) {
                attempts.push({ model, status: 502, message: 'Model không trả về nội dung.' });
                continue;
            }

            try {
                return { data: parseModelJson(text), model };
            } catch (_) {
                attempts.push({ model, status: 502, message: 'Model trả về JSON không hợp lệ.' });
            }
        }
    }

    const quotaLimited = attempts.some(attempt => attempt.status === 429);
    throw Object.assign(new Error(quotaLimited
        ? 'Tất cả model Gemini đang hết quota hoặc quá tải. Vui lòng thử lại sau.'
        : 'Không model Gemini nào khả dụng lúc này. Vui lòng thử lại sau.'), {
        status: quotaLimited ? 429 : 503,
        attempts
    });
}

module.exports = { DEFAULT_GEMINI_MODELS, generateGeminiJson, getGeminiConfig };
