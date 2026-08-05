# F1 Data Hub

An unofficial, fan-made Formula 1 data dashboard — season calendars, driver and constructor standings, career profiles, race weekend results, and an AI assistant that answers F1 questions.

**Live site:** [https://f1data.cc](https://f1data.cc)

---

## Features

- **Season calendar** — every round of the current season with sprint race badges
- **Standings** — driver and constructor standings for any season (1950 – present)
- **Global search** — find drivers, teams, and circuits instantly
- **Career profiles** — detailed driver, constructor, and track histories: wins, podiums, race counts, and more
- **Race weekend data** — practice, qualifying, sprint, and race results per round
- **AI assistant** — ask anything about F1 telemetry, strategy, drivers, or regulations, with a built-in offline fallback when the backend is unavailable
- **Responsive design** — automatically adapts to phone, tablet, and desktop

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | Vanilla HTML / CSS / JavaScript (single-page app, no build step) |
| Hosting | Cloudflare Pages + Cloudflare Functions |
| Data | [api.jolpi.ca](https://api.jolpi.ca) (community-maintained, Ergast-compatible F1 API) |
| AI | DeepSeek API, called server-side through a `/api/chat` proxy |
| Markdown rendering | marked.js + DOMPurify (sanitized before display) |

## Project Structure

```text
.
├── index.html                 # Main application (UI, styles, inline app logic)
├── chat.js                    # AI chat client logic
├── functions/
│   └── api/
│       ├── admin.js           # Admin API endpoint(s)
│       ├── calender.js        # Season calendar proxy
│       └── chat.js            # Serverless chat proxy (Cloudflare Function)
├── robots.txt                 # Crawler rules
├── LICENSE                    # MIT License
└── README.md
```

## Getting Started (Local Development)

The site is static, so the frontend runs from any simple web server:

```bash
python3 -m http.server 8080
# or
npx serve .
```

The AI chat endpoint (`/api/chat`) is a Cloudflare Function, so it requires the Functions runtime locally:

```bash
npx wrangler pages dev .
```

### Environment Variables

Set the DeepSeek API key in your environment (never hardcode it in client code):

```bash
AI_API_KEY=sk-your-key-here
```

## Deployment (Cloudflare Pages)

1. Connect your repository to Cloudflare Pages.
2. No build command is needed (static site).
3. Set the output directory to `/`.
4. Add the `AI_API_KEY` environment variable under **Settings → Environment variables**.
5. Deploy.

## Security Notes

- AI output is sanitized with DOMPurify before rendering — raw HTML from the model is never executed in visitors' browsers.
- API keys live only on the server; the browser never sees them.
- The chat endpoint is unauthenticated — enable rate limiting (e.g., Cloudflare WAF rate-limiting rules) and a request size cap to control cost.
- Keep CORS headers restricted to your own origin if any endpoint returns sensitive data.

## Data Source & Attribution

- All F1 race data is provided by [api.jolpi.ca](https://api.jolpi.ca), a community-maintained, Ergast-compatible API.
- This project is **unofficial** and is **not affiliated with, endorsed by, or connected to** Formula 1, FIA, any F1 team, driver, or sponsor.
- All trademarks, logos, and team names are the property of their respective owners and are used for identification purposes only.

## 免责声明

本网站为个人爱好者项目，与 Formula 1、FIA、各车队、车手及赞助商无任何关联，亦未获其授权或认可。

1. **数据仅供参考**：站内所有比赛数据均来自第三方公开数据源（api.jolpi.ca），可能存在延迟、遗漏或错误，不保证数据的完整性、准确性与实时性。
2. **AI 回答不构成专业建议**：AI 助手生成的内容基于模型训练数据，可能包含错误或过时信息，请勿将其作为决策依据。因使用本网站内容造成的任何直接或间接损失，本站不承担责任。
3. **知识产权**：本站引用的车队名称、商标、Logo 等均归其各自所有者所有，仅用于识别与展示目的。
4. **使用风险自负**：访问和使用本网站即表示您同意自行承担相关风险。

*This site is provided "as is" without warranties of any kind, express or implied. Use at your own risk.*

## License

This project is released under the [MIT License](LICENSE).

Copyright (c) 2026 Personal Developer. See the `LICENSE` file for details.
