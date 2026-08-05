// functions/api/calender.js — 赛程接口（Cloudflare Pages Function）
//
// KV 绑定：
//   KV —— 存放赛程覆盖数据（calendar_<year>，由 admin.js / 后台写入）

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
