# 🎙️ Speech-to-Text Telegram Bot — ویس به متن

A **free, self-deployable Telegram bot** that turns voice messages into text using Google's **free** AI Studio (Gemini) quota. No server, no credit card, no monthly cost — everyone can deploy their own copy with their own free limits.

**📄 Step-by-step visual guide (English/Persian): https://mjalalimanesh.github.io/speech-to-text-telegram/**

---

## ✨ Features

- 🎙️ Voice message → text in seconds (language auto-detected, Persian supported)
- 🔒 Private by default — lock it to yourself with one `ALLOWED_CHAT_ID` value, no dashboard editing
- ☁️ Serverless on Cloudflare Workers (free: 100k requests/day)
- 🆓 Uses your own free Gemini API key (no AI costs)
- 🌐 Bilingual bot messages (فارسی / English, auto-detected per user)
- 🧩 Zero dependencies, single file, no build step
- 📋 One-click copy of the code via GitHub **"Use this template"**, then deploy from your own repo (no Cloudflare repo-creation needed)

---

## 🧰 Prerequisites (all free)

| # | What | Where | Why |
|---|------|-------|-----|
| 1 | Telegram account | telegram.org | To create the bot |
| 2 | Cloudflare account | dash.cloudflare.com | Hosts the bot (free tier) |
| 3 | GitHub account | github.com | To copy the code + deploy |
| 4 | Gemini API key | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | Transcription (free quota) |

---

## 🚀 Deploy (Option A — recommended, ~10 minutes)

1. **Create the bot**: open [@BotFather](https://t.me/BotFather) in Telegram → `/newbot` → choose a name and username → **copy the token** (looks like `123456:ABC...`).
2. **Get the Gemini key**: open [aistudio.google.com/apikey](https://aistudio.google.com/apikey) → **Create API key** → copy it. *(If you see 403 / "Access denied", use a stronger VPN.)*
3. **Get your chat ID**: message [@userinfobot](https://t.me/userinfobot) (or @getidsbot) in Telegram → send `/start` → copy your numeric chat ID (e.g. `123456789`).
4. **Copy the code (create the repository manually, one click)**: open [github.com/new?template_name=speech-to-text-telegram&template_owner=mjalalimanesh](https://github.com/new?template_name=speech-to-text-telegram&template_owner=mjalalimanesh) — it opens the create-repo page with this code pre-filled. Give the copy a name (e.g. `my-voice-bot`) and click **Create repository**. *(No GitHub account yet? Create a free one at github.com first.)*
5. **Deploy from your existing repository**: go to the **Workers & Pages** page in Cloudflare ([direct link: dash.cloudflare.com/?to=/:account/workers-and-pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages)) → **Create application** → **Import an existing Git repository** → connect **GitHub** → choose the repo you just created → click **Deploy**.
6. **Add the three values and turn it on**: in your worker → **Settings → Variables and Secrets** → the three placeholders are listed empty — click **Edit** on each and paste `BOT_TOKEN` (step 1), `GEMINI_API_KEY` (step 2), `ALLOWED_CHAT_ID` (step 3) → **Deploy** → go back to your worker's main page and click **Visit** at the top once. *(If you see "No URLs enabled": go to **Settings → Domains & Routes** and click **Enable** in the **Workers.dev** section, then open the generated `https://your-worker.xxxx.workers.dev` URL in a new tab — same effect.)*
7. **Done 🎉** — send a voice message and get the text back instantly.

---

## ⚙️ Configuration

| Variable | Required | Description |
|---|---|---|
| `BOT_TOKEN` | ✅ | Telegram bot token from @BotFather |
| `GEMINI_API_KEY` | ✅ | Free key from Google AI Studio |
| `ALLOWED_CHAT_ID` | ✅ | Your chat ID — the only person allowed to use the bot (get it from @userinfobot; comma-separated for multiple) |
| `PUBLIC_BOT` | – | Set to `true` to let anyone use your bot (uses your Gemini quota) |
| `DAILY_LIMIT` | – | Per-chat daily cap in public mode (default `20`) |
| `GEMINI_MODEL` | – | Default `gemini-2.5-flash-lite` — free-tier friendly |
| `OWNER_STORE` (KV binding) | – | Optional: enables `/claim` (first sender owns the bot). Requires manual KV setup |

**Access model:**
- Default (no KV) → `ALLOWED_CHAT_ID` (comma-separated chat IDs) decides who can use the bot. Get your ID from @userinfobot in Telegram.
- KV present → owner = whoever sent `/claim` first. Reset it from the worker status page if needed.
- `PUBLIC_BOT=true` → anyone can use it (with `DAILY_LIMIT` per chat).

---

## 🆓 Free limits (why this works forever)

- **Cloudflare Workers free**: 100,000 requests/day, HTTPS + webhook included.
- **Gemini free tier** (`gemini-2.5-flash-lite`): roughly 15 requests/minute and 1,000+ requests/day — plenty for personal use.
- Telegram voice notes are small (usually < 1 MB), so everything stays well within limits.

---

## 🛠️ Troubleshooting

- **Bot doesn't reply** → open the worker URL in a browser once (click **Visit** in Cloudflare — registers the webhook instantly). Check the status page shows ✅ for everything.
- **"Missing: ALLOWED_CHAT_ID"** in /start → send any message to the bot, copy the chat ID it replies with, and add it as `ALLOWED_CHAT_ID`.
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