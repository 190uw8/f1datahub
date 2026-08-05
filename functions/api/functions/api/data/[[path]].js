// functions/api/data/[[path]].js — F1 数据缓存代理
//
// 浏览器不再直连 api.jolpi.ca，而是请求 /api/data/<路径>，
// 由本函数在服务器端抓取并缓存到 KV，避免 CORS 问题和第三方限流。
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

const CACHE_TTL_SECONDS = 600; // 缓存 10 分钟

export async function onRequestGet(context) {
    const { request, env } = context;
    const url = new URL(request.url);

    let path = url.pathname.replace(/^\/api\/data\//, '');
    if (!path) return json({ error: 'Bad request' }, 400);
    if (path.includes('..') || path.includes('//')) return json({ error: 'Bad request' }, 400);

    const cacheKey = `f1:${path}${url.search}`;

    // 统计：数据代理请求次数
    await bumpStat(env, 'apiRequests');

    // 1) 命中缓存直接返回
    const cached = await env.KV.get(cacheKey);
    if (cached) {
        return new Response(cached, {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }

    // 2) 服务器端抓取上游
    const upstream = await fetch(`https://api.jolpi.ca/ergast/f1/${path}${url.search}`);
    if (!upstream.ok) {
        return json({ error: 'Upstream error' }, 502);
    }
    const text = await upstream.text();

    // 3) 写缓存（失败不影响返回）
    await env.KV.put(cacheKey, text, { expirationTtl: CACHE_TTL_SECONDS }).catch(() => {});

    return new Response(text, {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
}

export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400'
        }
    });
}

function json(obj, status) {
    return new Response(JSON.stringify(obj), {
        status,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
}
