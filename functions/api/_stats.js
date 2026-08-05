// functions/api/_stats.js — 共享统计工具（基于 KV）
// 数据结构：stats:day:<YYYY-MM-DD> -> { visits, apiRequests, chatRequests, promptTokens, completionTokens, totalTokens }

export function dayKey(d) {
    const date = d || new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function readDay(env, key) {
    let s = {};
    try {
        s = JSON.parse((await env.KV.get(key)) || '{}');
    } catch (e) {
        s = {};
    }
    return s;
}

async function writeDay(env, key, s) {
    // 保留 45 天
    await env.KV.put(key, JSON.stringify(s), { expirationTtl: 45 * 86400 });
}

// 普通计数器（访问量 / API 请求 / AI 请求）
export async function bumpStat(env, field) {
    if (!env || !env.KV) return;
    try {
        const key = `stats:day:${dayKey()}`;
        const s = await readDay(env, key);
        s[field] = (s[field] || 0) + 1;
        await writeDay(env, key, s);
    } catch (e) {
        // 统计失败不影响业务
    }
}

// Token 用量累计
export async function addTokens(env, promptTokens, completionTokens) {
    if (!env || !env.KV) return;
    try {
        const key = `stats:day:${dayKey()}`;
        const s = await readDay(env, key);
        s.promptTokens = (s.promptTokens || 0) + (promptTokens || 0);
        s.completionTokens = (s.completionTokens || 0) + (completionTokens || 0);
        s.totalTokens = (s.totalTokens || 0) + (promptTokens || 0) + (completionTokens || 0);
        await writeDay(env, key, s);
    } catch (e) {
        // 统计失败不影响业务
    }
}
