// 客户端聊天脚本 —— 放到项目根目录，作为 /chat.js 部署
// 注意：这不是 functions/api/chat.js（服务器代理），别搞混了

const AI_CHAT_API_URL = '/api/chat';
const MAX_CHAT_HISTORY = 40;
const AI_LOCAL_FALLBACK = true;
var chatHistory = [];

function toggleAIChat() {
    const w = document.getElementById('aiChatWindow');
    if (w) w.classList.toggle('active');
}

function handleChatKey(e) {
    if (e.key === 'Enter') sendChatMessage();
}

function escapeHTML(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderMarkdown(text) {
    if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
        const raw = marked.parse(text);
        // DOMPurify 过滤掉 HTML/事件属性，防止 AI 输出被用来执行脚本
        return typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(raw) : escapeHTML(text);
    }
    return escapeHTML(text).replace(/\n/g, '<br>');
}

function localFallbackReply(text) {
    const q = text.toLowerCase();
    if (q.includes('champion') || q.includes('winner') || q.includes('won')) return 'The 2024 F1 World Champion was **Max Verstappen** (Red Bull), his 4th title in a row. 🏆';
    if (q.includes('verstappen')) return '**Max Verstappen** — 4-time F1 World Champion (2021–2024), racing for Red Bull Racing. 🇳🇱';
    if (q.includes('hamilton')) return '**Lewis Hamilton** — 7-time F1 World Champion, most race wins in F1 history (tied with Schumacher). 🇬🇧';
    if (q.includes('ferrari')) return '**Ferrari** — the oldest and most successful team in F1, 16 Constructors\' titles and 240+ race wins. 🏎️';
    if (q.includes('mclaren')) return '**McLaren** — 9 Constructors\' titles, home of legends like Senna, Prost and Hamilton. 🏎️';
    if (q.includes('points')) return 'F1 points (since 2010): **25-18-15-12-10-8-6-4-2-1** for P1–P10. Sprint races award 8 down to 1.';
    if (q.includes('drs')) return '**DRS** opens the rear wing on straights to reduce drag and enable overtaking — allowed when a car is within 1 second of the car ahead in a DRS zone.';
    if (q.includes('tire') || q.includes('tyre')) return 'Pirelli tires: **Soft / Medium / Hard**. The hardest compound must be used for one stint each race.';
    if (q.includes('calendar') || q.includes('season')) return 'F1 seasons run March–December with ~**24 races** across 5 continents, ending at Abu Dhabi.';
    if (q.includes('circuit') || q.includes('track')) return 'Legendary circuits: **Monza, Spa, Silverstone, Monaco** — the crown jewel of the calendar. 🏁';
    return 'AI backend not connected yet. Meanwhile try: champions, teams, points system, DRS, tires, circuits. 🤖';
}

function handleFailure(msgBox, errMsg) {
    console.error(errMsg);
    // 先把真实错误以小字灰/红提示显示，方便排查（被封禁、服务未配置等）
    msgBox.innerHTML += `<div class="chat-msg system-err">${escapeHTML(errMsg)}</div>`;
    if (AI_LOCAL_FALLBACK) {
        const lastUserMsg = chatHistory[chatHistory.length - 1]?.content || '';
        const localReply = localFallbackReply(lastUserMsg);
        msgBox.innerHTML += `<div class="chat-msg bot">${renderMarkdown(localReply)}</div>`;
        chatHistory.push({ role: 'assistant', content: localReply });
    } else {
        msgBox.innerHTML += `<div class="chat-msg system-err">${escapeHTML(errMsg)}</div>`;
    }
    msgBox.scrollTop = msgBox.scrollHeight;
}

async function sendChatMessage() {
    const inputEl = document.getElementById('aiQueryInput');
    const msgBox  = document.getElementById('aiMessagesBox');
    if (!inputEl || !msgBox) return;

    const text = inputEl.value.trim();
    if (!text) return;

    msgBox.innerHTML += `<div class="chat-msg user">${escapeHTML(text)}</div>`;
    inputEl.value = '';
    msgBox.scrollTop = msgBox.scrollHeight;

    chatHistory.push({ role: 'user', content: text });
    if (chatHistory.length > MAX_CHAT_HISTORY) chatHistory = chatHistory.slice(-MAX_CHAT_HISTORY);

    const loadingId = 'msg-load-' + Date.now();
    msgBox.innerHTML += `<div class="chat-msg bot" id="${loadingId}">Typing...</div>`;
    msgBox.scrollTop = msgBox.scrollHeight;
    const removeLoading = () => {
        const el = document.getElementById(loadingId);
        if (el && el.parentNode) el.remove();
    };

    let response;
    try {
        response = await fetch(AI_CHAT_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: chatHistory })
        });
    } catch (err) {
        removeLoading();
        handleFailure(msgBox, `Cannot reach ${AI_CHAT_API_URL} (${err.message})`);
        return;
    }

    let raw = '';
    try {
        raw = await response.text();
    } catch (err) {
        removeLoading();
        handleFailure(msgBox, `Could not read server response (${err.message})`);
        return;
    }
    removeLoading();

    let data = {};
    if (raw) {
        try {
            data = JSON.parse(raw);
        } catch (err) {
            handleFailure(msgBox, `Server replied HTTP ${response.status} with non-JSON content.`);
            return;
        }
    }

    if (!response.ok) {
        handleFailure(msgBox, `Error (HTTP ${response.status}): ${data.error || response.statusText}`);
        return;
    }

    const reply = data.choices?.[0]?.message?.content ?? data.reply ?? data.content ?? '';
    if (!reply) {
        handleFailure(msgBox, 'Empty response from AI endpoint.');
        return;
    }

    msgBox.innerHTML += `<div class="chat-msg bot">${renderMarkdown(reply)}</div>`;
    chatHistory.push({ role: 'assistant', content: reply });
    if (chatHistory.length > MAX_CHAT_HISTORY) chatHistory = chatHistory.slice(-MAX_CHAT_HISTORY);
    msgBox.scrollTop = msgBox.scrollHeight;
}
