// functions/api/calender.js — 赛程接口（Cloudflare Pages Function）
//
// KV 绑定：
//   KV —— 存放赛程覆盖数据（calendar_<year>，由 admin.js / 后台写入）

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
    const url = new URL(context.request.url);
    const year = url.searchParams.get('year') || '2026';

    // 校验年份，防止拼接进 URL 被用于请求操纵
    if (!/^\d{4}$/.test(year)) {
        return new Response(JSON.stringify({ error: 'Invalid year' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // 统计：赛程接口请求次数
    await bumpStat(context.env, 'apiRequests');

    try {
        // 1. 获取官方数据
        const apiRes = await fetch(`https://api.jolpi.ca/ergast/f1/${year}.json`);
        const apiData = await apiRes.json();

        // 2. 获取后台保存在 KV 的自定义数据
        const customDataStr = await context.env.KV.get(`calendar_${year}`);

        if (customDataStr) {
            let customRaces;
            try {
                customRaces = JSON.parse(customDataStr);
            } catch {
                customRaces = [];
            }
            let officialRaces = apiData.MRData.RaceTable.Races || [];

            // 3. 将自定义赛程注入或覆盖官方赛程
            customRaces.forEach(customRace => {
                const index = officialRaces.findIndex(r => r.round === customRace.round);
                if (index >= 0) {
                    officialRaces[index] = customRace; // 覆盖官方数据
                } else {
                    officialRaces.push(customRace);    // 添加新数据（例如 Sepang）
                }
            });

            // 重新按回合数字排序
            officialRaces.sort((a, b) => parseInt(a.round) - parseInt(b.round));
            apiData.MRData.RaceTable.Races = officialRaces;
        }

        return new Response(JSON.stringify(apiData), {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: 'Failed to fetch calendar' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
