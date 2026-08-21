# 🎙️ Speech-to-Text Telegram Bot — ویس به متن

A **free, self-deployable Telegram bot** that turns voice messages into text using Google's **free** AI Studio (Gemini) quota. No server, no credit card, no monthly cost — everyone can deploy their own copy with their own free limits.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/mjalalimanesh/speech-to-text-telegram)

**📄 Step-by-step visual guide (English/Persian): https://mjalalimanesh.github.io/speech-to-text-telegram/**

---

## ✨ Features

- 🎙️ Voice message → text in seconds (language auto-detected, Persian supported)
- 🔒 Private by default — you claim the bot with `/claim`, no dashboard editing
- ☁️ Serverless on Cloudflare Workers (free: 100k requests/day)
- 🆓 Uses your own free Gemini API key (no AI costs)
- 🌐 Bilingual bot messages (فارسی / English, auto-detected per user)
- 🧩 Zero dependencies, single file, no build step
- 🚀 One-click Deploy-to-Cloudflare button (auto-provisions the KV store)

---

## 🧰 Prerequisites (all free)

| # | What | Where | Why |
|---|------|-------|-----|
| 1 | Telegram account | telegram.org | To create the bot |
| 2 | Cloudflare account | dash.cloudflare.com | Hosts the bot (free tier) |
| 3 | GitHub account | github.com | One-click deploy + this page |
| 4 | Gemini API key | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | Transcription (free quota) |

---

## 🚀 Deploy (Option A — one click, ~10 minutes)

1. **Create the bot**: open [@BotFather](https://t.me/BotFather) in Telegram → `/newbot` → choose a name and username → **copy the token** (looks like `123456:ABC...`).
2. **Get the Gemini key**: open [aistudio.google.com/apikey](https://aistudio.google.com/apikey) → **Create API key** → copy it. *(If you see 403 / "Access denied", use a stronger VPN.)*
3. **Deploy**: click the **Deploy to Cloudflare** button at the top of this README (or on the website). Connect your GitHub + Cloudflare accounts, and when asked, paste:
   - `BOT_TOKEN` = the token from step 1
   - `GEMINI_API_KEY` = the key from step 2
   The KV store for the owner is created automatically.
4. **Register the webhook (one click, instant after that)**: after deployment, click **Visit** on your worker's page in Cloudflare — the page Cloudflare shows you right after the Deploy button finishes. The status page registers the webhook automatically.
5. **Claim the bot**: open your bot in Telegram and send **`/claim`**. That's it — the bot locks itself to you.
6. **Done 🎉** — send a voice message and get the text back instantly.

> 💡 Already deployed but the bot ignores you? Re-open the worker URL once — the webhook may not be registered yet.

---

## 🧪 Deploy (Option B — advanced, via wrangler CLI)

```bash
git clone https://github.com/mjalalimanesh/speech-to-text-telegram.git
cd speech-to-text-telegram
npm install
npx wrangler login
npx wrangler kv namespace create OWNER_STORE   # paste the returned id into wrangler.jsonc
npx wrangler secret put BOT_TOKEN
npx wrangler secret put GEMINI_API_KEY
npx wrangler deploy
# then open your worker URL once to register the webhook, and send /claim in Telegram
```

## 📋 Deploy (Option C — no git, copy-paste)

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Worker** → name it → **Edit code**.
2. Delete the template, paste the whole content of [`src/worker.js`](src/worker.js), **Deploy**.
3. **Settings → Variables and Secrets** → add `BOT_TOKEN`, `GEMINI_API_KEY`, and `ALLOWED_CHAT_ID` (your chat ID — the bot prints it for you if you skip this step).
4. Open the worker URL in a browser once to register the webhook.

---

## ⚙️ Configuration

| Variable | Required | Description |
|---|---|---|
| `BOT_TOKEN` | ✅ | Telegram bot token from @BotFather |
| `GEMINI_API_KEY` | ✅ | Free key from Google AI Studio |
| `OWNER_STORE` (KV binding) | ✅ via Deploy button | Stores the owner's chat ID; set with `/claim` |
| `PUBLIC_BOT` | – | Set to `true` to let anyone use your bot (uses your Gemini quota) |
| `DAILY_LIMIT` | – | Per-chat daily cap in public mode (default `20`) |
| `GEMINI_MODEL` | – | Default `gemini-2.5-flash-lite` — free-tier friendly |
| `ALLOWED_CHAT_ID` | – | Fallback access control **only** when the KV binding is missing (e.g. copy-paste deploys) |

**Access model:**
- KV present → owner = whoever sent `/claim` first. Reset it from the worker status page if needed.
- KV missing → `ALLOWED_CHAT_ID` (comma-separated chat IDs) decides who can use the bot.
- `PUBLIC_BOT=true` → anyone can use it (with `DAILY_LIMIT` per chat).

---

## 🆓 Free limits (why this works forever)

- **Cloudflare Workers free**: 100,000 requests/day, HTTPS + webhook included.
- **Gemini free tier** (`gemini-2.5-flash-lite`): roughly 15 requests/minute and 1,000+ requests/day — plenty for personal use.
- Telegram voice notes are small (usually < 1 MB), so everything stays well within limits.

---

## 🛠️ Troubleshooting

- **Bot doesn't reply** → open the worker URL in a browser once (click **Visit** in Cloudflare — registers the webhook instantly). Check the status page shows ✅ for everything.
- **"Missing: /claim"** in /start → send `/claim` in Telegram.
- **Someone claimed it first** → open your worker URL → click «بازنشانی» (Reset) → send `/claim` again.
- **Google rate-limit message** → you hit the free quota; wait a minute or a day.
- **AI Studio 403 / "Access denied"** when creating the key → use a stronger VPN; Google is blocked in some regions.
- **Persian text with wrong direction/characters** → make sure you send the message to a real Telegram client; the transcript is returned as plain text.

---

## 🧱 How it works

```
Voice message → Telegram webhook → Cloudflare Worker
                                    ├─ validates secret header
                                    ├─ checks owner (KV) / ALLOWED_CHAT_ID
                                    ├─ downloads the .ogg file
                                    ├─ Gemini API (inline audio → text)
                                    └─ replies with the transcription
```

---

## 📄 GitHub Pages site

The single-page guide lives in [`docs/index.html`](docs/index.html) (already published at the link above). To update it, just push changes to `main`.

## 📝 License

MIT — use it, share it, fork it.