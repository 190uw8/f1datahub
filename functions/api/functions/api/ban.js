// functions/api/ban.js — IP 封禁管理接口（Cloudflare Pages Function）
//
// KV 绑定：
//   RATE_LIMIT_KV —— 存放封禁名单（键名 ban:<ip>，由 chat.js 写入）
//
// 接口（均需登录令牌）：
//   GET    /api/ban          -> 列出所有被封禁的 IP
//   DELETE /api/ban  {ip}    -> 解封该 IP

const BAN_PREFIX = 'ban:';

export async function onRequestGet(context) {
    if (!(await verifyToken(context.env, context.request))) {
        return json({ error: 'Unauthorized' }, 401);
    }
    const bans = [];
    try {
        const list = await context.env.RATE_LIMIT_KV.list({ prefix: BAN_PREFIX });
        for (const key of list.keys) {
            const bannedAt = await context.env.RATE_LIMIT_KV.get(key.name);
            bans.push({ ip: key.name.slice(BAN_PREFIX.length), bannedAt });
        }
    } catch (err) {
        return json({ error: 'Failed to list bans' }, 500);
    }
    return json({ bans }, 200);
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
    const ip = String(body.ip || '');
    if (!ip) return json({ error: 'Missing ip' }, 400);

    await context.env.RATE_LIMIT_KV.delete(BAN_PREFIX + ip);
    return json({ success: true }, 200);
}

export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400'
        }
    });
}

// ---- 令牌校验（与 admin.js 相同）----
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
