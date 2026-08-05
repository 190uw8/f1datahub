// functions/api/admin.js — 后台管理接口（Cloudflare Pages Function）
//
// 环境变量：
//   ADMIN_PASSWORD   （必填）管理员密码
//   ADMIN_TOKEN_SECRET（可选）登录令牌签名密钥，默认用 ADMIN_PASSWORD
// KV 绑定：
//   KV —— 存放赛程覆盖数据（calendar_<year>）
//
// 接口：
//   POST   /api/admin   {action:'login', password}      -> 返回登录令牌
//   POST   /api/admin   {year,round,raceName,...}        -> 添加/修改覆盖（需令牌）
//   GET    /api/admin   ?year=2026                       -> 列出该年覆盖（需令牌）
//   DELETE /api/admin   {year, round}                    -> 删除覆盖（需令牌）

const TOKEN_TTL_MS = 2 * 60 * 60 * 1000; // 令牌有效期 2 小时

export async function onRequestGet(context) {
    if (!(await verifyToken(context.env, context.request))) {
        return json({ error: 'Unauthorized' }, 401);
    }
    const url = new URL(context.request.url);
    const year = url.searchParams.get('year') || '';
    if (!/^\d{4}$/.test(year)) {
        return json({ error: 'Invalid year' }, 400);
    }
    const data = await context.env.KV.get(`calendar_${year}`);
    return json({ races: data ? JSON.parse(data) : [] }, 200);
}

export async function onRequestPost(context) {
    let body;
    try {
        body = await context.request.json();
    } catch {
        return json({ error: 'Invalid JSON' }, 400);
    }

    // 登录：只校验密码，不需要令牌
    if (body.action === 'login') {
        return login(context, body);
    }

    // 其他操作需要令牌
    if (!(await verifyToken(context.env, context.request))) {
        return json({ error: 'Unauthorized' }, 401);
    }

    const year = String(body.year || '');
    const round = String(body.round || '');
    if (!/^\d{4}$/.test(year)) return json({ error: 'Invalid year' }, 400);
    if (!/^\d{1,2}$/.test(round)) return json({ error: 'Invalid round' }, 400);
    if (!body.raceName || !body.circuitId || !body.circuitName || !body.date) {
        return json({ error: 'Missing required fields' }, 400);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.date))) {
        return json({ error: 'Invalid date' }, 400);
    }

    const newRace = {
        round: round,
        raceName: String(body.raceName).slice(0, 120),
        Circuit: {
            circuitId: String(body.circuitId).slice(0, 60),
            circuitName: String(body.circuitName).slice(0, 120)
        },
        date: String(body.date),
        Sprint: body.hasSprint ? 'Yes' : undefined
    };

    const key = `calendar_${year}`;
    let customRaces = [];
    const existingData = await context.env.KV.get(key);
    if (existingData) {
        try { customRaces = JSON.parse(existingData); } catch { customRaces = []; }
    }

    const existingIndex = customRaces.findIndex(r => r.round === newRace.round);
    if (existingIndex >= 0) {
        customRaces[existingIndex] = newRace;
    } else {
        customRaces.push(newRace);
    }

    await context.env.KV.put(key, JSON.stringify(customRaces));
    return json({ success: true, message: 'Race updated successfully!' }, 200);
}

export async function onRequestDelete(context) {
    if (!(await verifyToken(context.env, context.request))) {
        return json({ error: 'Unauthorized' }, 401);
    }
    let body;
    try {
        body = await context.request.json();
    } catch {
        return json({ error: 'Invalid JSON' }, 400);
    }

    const year = String(body.year || '');
    const round = String(body.round || '');
    if (!/^\d{4}$/.test(year)) return json({ error: 'Invalid year' }, 400);
    if (!/^\d{1,2}$/.test(round)) return json({ error: 'Invalid round' }, 400);

    const key = `calendar_${year}`;
    const existingData = await context.env.KV.get(key);
    if (!existingData) return json({ error: 'Not found' }, 404);

    let customRaces;
    try { customRaces = JSON.parse(existingData); } catch { return json({ error: 'Data corrupted' }, 500); }
    const filtered = customRaces.filter(r => r.round !== round);
    if (filtered.length === customRaces.length) return json({ error: 'Not found' }, 404);

    await context.env.KV.put(key, JSON.stringify(filtered));
    return json({ success: true }, 200);
}

export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400'
        }
    });
}

// ---- 登录：校验密码，签发 2 小时有效的 HMAC 令牌 ----
async function login(context, body) {
    const expected = context.env.ADMIN_PASSWORD || '';
    const provided = String(body.password || '');
    if (!expected || !safeEqual(expected, provided)) {
        return json({ error: 'Unauthorized' }, 401);
    }
    const secret = context.env.ADMIN_TOKEN_SECRET || expected;
    const exp = String(Date.now() + TOKEN_TTL_MS);
    const sig = await hmacSign(secret, exp);
    return json({ token: `${exp}.${sig}` }, 200);
}

// ---- 令牌校验 ----
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

// 常数时间比较，防止时序攻击
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
