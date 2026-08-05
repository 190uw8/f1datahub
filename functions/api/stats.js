// functions/api/stats.js — 数据统计接口
//
//   GET  /api/stats  -> 今日 + 最近 14 天 + 汇总（需登录令牌）
//   POST /api/stats  -> 页面访问探针（公开，无需令牌，只计数）
//
// KV 绑定：KV

// ---- 统计辅助（内联，避免 Pages 把共享文件当路由编译）----
function dayKey(d) {
    const date = d || new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function bumpStat(env, field) {
    if (!env || !env.KV) return;
    try {
        const key = `stats:day:${dayKey()}`;
        let s = {};
        try { s = JSON.parse((await env.KV.get(key)) || '{}'); } catch (e) {}
        s[field] = (s[field] || 0) + 1;
        await env.KV.put(key, JSON.stringify(s), { expirationTtl: 45 * 86400 });
    } catch (e) {}
}

export async function onRequestGet(context) {
    if (!(await verifyToken(context.env, context.request))) {
        return json({ error: 'Unauthorized' }, 401);
    }

    const days = [];
    const totals = { visits: 0, apiRequests: 0, chatRequests: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    for (let i = 13; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        const key = `stats:day:${dayKey(d)}`;
        let s = {};
        try {
            s = JSON.parse((await context.env.KV.get(key)) || '{}');
        } catch (e) {
            s = {};
        }
        const row = {
            date: key.replace('stats:day:', ''),
            visits: s.visits || 0,
            apiRequests: s.apiRequests || 0,
            chatRequests: s.chatRequests || 0,
            promptTokens: s.promptTokens || 0,
            completionTokens: s.completionTokens || 0,
            totalTokens: s.totalTokens || 0
        };
        days.push(row);
        totals.visits += row.visits;
        totals.apiRequests += row.apiRequests;
        totals.chatRequests += row.chatRequests;
        totals.promptTokens += row.promptTokens;
        totals.completionTokens += row.completionTokens;
        totals.totalTokens += row.totalTokens;
    }

    return json({ today: days[days.length - 1], days, totals }, 200);
}

// 公开探针：统计一次页面访问
export async function onRequestPost(context) {
    await bumpStat(context.env, 'visits');
    return new Response(null, { status: 204 });
}

export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400'
        }
    });
}

// ---- 令牌校验（与 admin.js / ban.js 相同）----
async function verifyToken(env, request) {
    const secret = env.ADMIN_TOKEN_SECRET || env.ADMIN_PASSWORD;
    if (!secret) return false;
    const auth = request.headers.get('Authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const dot = token.indexOf('.');
    if (dot <= 0) return false;
    const exp = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    if (!/^\d+$/.test(exp) || Number(exp) <= Date.now()) return false;
    const expected = await hmacSign(secret, exp);
    return safeEqual(sig, expected);
}

async function hmacSign(secret, data) {
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
    return btoa(String.fromCharCode(...new Uint8Array(sig)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function safeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}

function json(obj, status) {
    return new Response(JSON.stringify(obj), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    });
}
