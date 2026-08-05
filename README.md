# F1 Data Hub

An unofficial, fan-made Formula 1 data dashboard — season calendars, driver and constructor standings, career profiles, race weekend results, and an AI assistant with a full admin backend.

**Live site:** [https://f1data.cc](https://f1data.cc)

---

## Features

- **Season calendar** — every round of the current season with sprint race badges
- **Standings** — driver and constructor standings for any season (1950 – present)
- **Global search** — find drivers, teams, and circuits instantly
- **Career profiles** — driver, constructor, and track histories: wins, podiums, race counts, and more
- **Race weekend data** — practice, qualifying, sprint, and race results
- **AI assistant** — F1 questions answered via DeepSeek, with offline fallback and automatic abuse protection
- **Admin dashboard** — traffic statistics, token usage, calendar overrides, and IP ban management
- **Responsive design** — automatically adapts to phone, tablet, and desktop

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | Vanilla HTML / CSS / JavaScript (single-page app, no build step) |
| Hosting | Cloudflare Pages + Cloudflare Functions |
| Data | [api.jolpi.ca](https://api.jolpi.ca), proxied and cached server-side |
| AI | DeepSeek API, called server-side through a `/api/chat` proxy |
| Markdown rendering | marked.js + DOMPurify (sanitized before display) |
| Persistence | Cloudflare KV (calendar overrides, cache, stats, IP bans) |

## Project Structure

```text
.
├── index.html                  # Main application (UI, styles, app logic, responsive layout)
├── chat.js                     # AI chat client (DOMPurify sanitization)
├── dashboard.html              # Admin dashboard (login, stats, calendar overrides, IP bans)
├── functions/
│   └── api/
│       ├── admin.js            # Admin API: token login + calendar override CRUD
│       ├── ban.js              # IP ban list / unban API
│       ├── calender.js         # Season calendar API (merges custom overrides)
│       ├── chat.js             # AI chat proxy (rate limit, permanent ban, token stats)
│       ├── stats.js            # Statistics API + page-visit beacon
│       └── data/
│           └── [[path]].js     # Caching proxy for F1 data
├── robots.txt                  # Crawler rules
├── LICENSE                     # MIT License
└── README.md
```

Statistics counters are inlined in each function file so that every file under `functions/` is a valid Pages route.

## API Endpoints

| Method | Path | Description | Auth |
| --- | --- | --- | --- |
| POST | `/api/chat` | AI conversation | Public (rate-limited, ban-protected) |
| GET | `/api/data/*` | F1 data proxy with KV cache | Public |
| GET | `/api/calendar?year=` | Season calendar with overrides | Public |
| POST | `/api/admin` | Login, or save a calendar override | Login: public / Save: token |
| GET | `/api/admin?year=` | List calendar overrides | Token |
| DELETE | `/api/admin` | Delete a calendar override | Token |
| GET | `/api/ban` | List banned IPs | Token |
| DELETE | `/api/ban` | Unban an IP | Token |
| GET | `/api/stats` | Traffic / API / token statistics | Token |
| POST | `/api/stats` | Page-visit beacon | Public (counts only) |

## Getting Started (Local Development)

The frontend is static and runs from any simple web server:

```bash
python3 -m http.server 8080
# or
npx serve .
```

The API functions require the Cloudflare Functions runtime:

```bash
npx wrangler pages dev .
```

## Environment Variables

Set these in Cloudflare Pages → **Settings → Environment variables** (never hardcode them in code):

| Variable | Required | Description |
| --- | --- | --- |
| `AI_API_KEY` | Yes | DeepSeek API key (server-side only) |
| `ADMIN_PASSWORD` | Yes | Admin dashboard password |
| `AI_MODEL` | No | Model name, defaults to `deepseek-v4-flash` |
| `ADMIN_TOKEN_SECRET` | No | HMAC secret for admin tokens, defaults to `ADMIN_PASSWORD` |

## KV Bindings

| Binding | Purpose |
| --- | --- |
| `KV` | Calendar overrides, F1 data cache, daily statistics |
| `RATE_LIMIT_KV` | AI abuse detection (request counters + permanent ban list) |

## Deployment (Cloudflare Pages)

1. Connect the repository to Cloudflare Pages.
2. No build command is needed (static site); set the output directory to `/`.
3. Add the environment variables above.
4. Create the two KV namespaces and bind them as `KV` and `RATE_LIMIT_KV`.
5. Deploy. The admin dashboard is available at `/dashboard.html`.

## Security

- AI output is sanitized with DOMPurify before rendering; all third-party data is HTML-escaped before insertion.
- Admin APIs use HMAC-signed, expiring login tokens; passwords live in environment variables, never in code or markup.
- The AI endpoint is rate-limited and permanently bans abusive IPs (managed via the dashboard).
- Request bodies are size-limited and validated; client errors return 400/413, upstream failures return generic 502 responses without leaking internals.
- CDN dependencies are version-pinned with Subresource Integrity (SRI) hashes.
- CORS and preflight requests are handled explicitly for all API functions.

## Admin Dashboard

Visit `/dashboard.html` and log in with `ADMIN_PASSWORD`.

- **数据统计 (Statistics)** — today's visits, API requests, AI requests, and token usage; 14-day trend table.
- **赛程覆盖 (Calendar overrides)** — add, edit, list, and delete custom races for any season.
- **IP 封禁 (IP bans)** — view permanently banned IPs from AI abuse and unban them.

## Data Source & Attribution

- All F1 race data is provided by [api.jolpi.ca](https://api.jolpi.ca), a community-maintained, Ergast-compatible API.
- This project is **unofficial** and is **not affiliated with, endorsed by, or connected to** Formula 1, FIA, any F1 team, driver, or sponsor.
- All trademarks, logos, and team names are the property of their respective owners and are used for identification purposes only.

## 免责声明

本网站为个人爱好者项目，与 Formula 1、FIA、各车队、车手及赞助商无任何关联，亦未获其授权或认可。

1. **数据仅供参考**：站内所有比赛数据均来自第三方公开数据源（api.jolpi.ca），可能存在延迟、遗漏或错误，不保证数据的完整性、准确性与实时性。
2. **AI 回答不构成专业建议**：AI 助手生成的内容基于模型训练数据，可能包含错误或过时信息，请勿将其作为决策依据。因使用本网站内容造成的任何直接或间接损失，本站开发者不承担责任。
3. **知识产权**：本站引用的车队名称、商标、Logo 等均归其各自所有者所有，仅用于识别与展示目的。
4. **使用风险自负**：访问和使用本网站即表示您同意自行承担相关风险。

*This site is provided "as is" without warranties of any kind, express or implied. Use at your own risk.*

## License

This project is released under the [MIT License](LICENSE).

Copyright (c) 2026 Personal Developer. See the `LICENSE` file for details.
