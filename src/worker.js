/**
 * Speech-to-Text Telegram Bot — Cloudflare Worker
 *
 * Turns Telegram voice messages into text using the free Google AI Studio
 * (Gemini) API. Zero dependencies, no build step.
 *
 * Deploy it with GitHub "Use this template" → "Deploy from existing repository"
 * in Cloudflare, with the Deploy-to-Cloudflare button, or with `wrangler deploy`.
 *
 * Setup (webhook-based — instant replies):
 *   1. Set BOT_TOKEN + GEMINI_API_KEY (prompted by the Cloudflare deploy wizard).
 *   2. After deploying, click "Visit" on your worker's page in Cloudflare —
 *      the webhook registers automatically (one time, takes one click).
 *   3. In Telegram, send any message to the bot — it replies with your chat ID.
 *      Add it as ALLOWED_CHAT_ID (Settings → Variables and Secrets) to lock
 *      the bot to yourself.
 *
 * Env / vars (Settings → Variables and Secrets):
 *   BOT_TOKEN         Telegram bot token from @BotFather (required)
 *   GEMINI_API_KEY    Free API key from https://aistudio.google.com/apikey (required)
 *   ALLOWED_CHAT_ID   Comma-separated chat IDs allowed to use the bot (default path)
 *   PUBLIC_BOT        "true" to let anyone use the bot (optional)
 *   DAILY_LIMIT       Per-chat daily cap in public mode, default 20 (optional)
 *   GEMINI_MODEL      Model name, default gemini-2.5-flash-lite (optional)
 *
 * KV binding (optional, advanced):
 *   OWNER_STORE       If present, the first /claim in Telegram stores the owner's
 *                     chat ID here and ALLOWED_CHAT_ID is ignored.
 */

const I18N = {
  en: {
    startTitle: '🎙️ Voice-to-Text Bot is live!',
    statusOk: '✅ All set. Send me a voice message and I will transcribe it.',
    missing: '⚠️ Missing: %s',
    notVoice:
      'Send me a <b>voice message</b> 🎙️ and I will transcribe it for free.',
    noOwner:
      '🚧 <b>This bot has no owner yet.</b>\n\nIf you just deployed it, send <code>/claim</code> to make it yours. Nobody else can use it until then.',
    claimed:
      '🎉 <b>You are now the owner!</b>\n\nSend me a voice message and I will transcribe it.',
    alreadyOwner: 'You are already the owner. Send me a voice message 🎙️',
    unauthorized: '⛔ You are not allowed to use this bot.',
    chatIdSetup:
      '🚧 <b>Setup required</b>\n\nYour chat ID is <code>%d</code>.\n\nAdd it as the <code>ALLOWED_CHAT_ID</code> secret in your Cloudflare Worker settings (Settings → Variables and Secrets), then send a voice message again.',
    rateLimit: '🕒 Daily limit reached for this chat. Try again tomorrow.',
    geminiRateLimit:
      '😴 Google AI is rate-limiting us. Wait about a minute and try again.',
    geminiError:
      '🤖 Sorry, transcription failed (%s). Try again in a few seconds.',
    emptyTranscript: '🤔 I could not hear anything clear in that voice message.',
    statusPublic: 'Public mode: anyone can use it (%d/day)',
    ownerInfo: '👤 Owner: chat %s',
    noOwnerInfo: '👤 Owner: none — send /claim in Telegram',
  },
  fa: {
    startTitle: '🎙️ بات تبدیل ویس به متن فعال است!',
    statusOk: '✅ همه‌چیز آماده است. یک ویس بفرستید تا متنش را بنویسم.',
    missing: '⚠️ ناقص: %s',
    notVoice: 'یک <b>ویس</b> بفرستید 🎙️ تا متنش را بنویسم.',
    noOwner:
      '🚧 <b>این بات هنوز صاحب ندارد.</b>\n\nاگر همین الان دیپلوی کرده‌اید، دستور <code>/claim</code> را بفرستید تا بات فقط برای شما باشد. تا قبل از آن هیچ‌کس نمی‌تواند استفاده کند.',
    claimed:
      '🎉 <b>شما صاحب این بات شدید!</b>\n\nحالا یک ویس بفرستید تا متنش را بنویسم.',
    alreadyOwner: 'شما صاحب بات هستید. یک ویس بفرستید 🎙️',
    unauthorized: '⛔ شما مجاز به استفاده از این بات نیستید.',
    chatIdSetup:
      '🚧 <b>راه‌اندازی لازم است</b>\n\nشناسه چت شما: <code>%d</code>\n\nاین مقدار را به‌عنوان <code>ALLOWED_CHAT_ID</code> در تنظیمات وورکر کلادفلر (Settings → Variables and Secrets) ذخیره کنید و دوباره ویس بفرستید.',
    rateLimit: '🕒 سقف روزانه این چت پر شده است. فردا دوباره امتحان کنید.',
    geminiRateLimit:
      '😴 گوگل موقتاً ما را محدود کرده است. یک دقیقه صبر کنید و دوباره بفرستید.',
    geminiError:
      '🤖 متأسفانه تبدیل انجام نشد (%s). چند ثانیه بعد دوباره تلاش کنید.',
    emptyTranscript: '🤔 صدای واضحی در این ویس نشنیدم.',
    statusPublic: 'حالت عمومی: هر کسی می‌تواند استفاده کند (روزانه %d پیام)',
    ownerInfo: '👤 صاحب: چت %s',
    noOwnerInfo: '👤 صاحب: ثبت نشده — در تلگرام /claim بفرستید',
  },
};

const DAILY_COUNTS = new Map();

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'GET') return handleGet(request, env);
    if (request.method === 'POST') return handlePost(request, env, ctx);
    return new Response('Method not allowed', { status: 405 });
  },
};

async function handlePost(request, env, ctx) {
  if (!env.BOT_TOKEN) return json({ ok: false }, 500);
  const secret = await deriveSecret(env.BOT_TOKEN);
  if (request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== secret) {
    return json({ ok: false }, 403);
  }
  const update = await request.json();
  ctx.waitUntil(processUpdate(update, env));
  return json({ ok: true });
}

async function handleGet(request, env) {
  const url = new URL(request.url);
  const base = `${url.origin}${url.pathname}`;
  const kv = env.OWNER_STORE;

  const reset = url.searchParams.get('reset');
  const resetCode = await deriveResetCode(env.BOT_TOKEN || '');
  if (reset) {
    if (!env.BOT_TOKEN || reset !== resetCode) {
      return new Response('Forbidden', { status: 403 });
    }
    if (kv) await kv.delete('owner');
    return Response.redirect(`${base}?reset=ok`, 302);
  }

  const owner = kv ? (await kv.get('owner')) || '' : '';
  const webhookUrl = base;
  const checks = [
    ['BOT_TOKEN', !!env.BOT_TOKEN],
    ['GEMINI_API_KEY', !!env.GEMINI_API_KEY],
    [kv ? 'OWNER_STORE' : 'ALLOWED_CHAT_ID', kv ? true : !!env.ALLOWED_CHAT_ID],
  ];
  let webhook = '<span style="color:#f59e0b">⚠ ثبت نشده</span>';
  if (env.BOT_TOKEN) {
    const secret = await deriveSecret(env.BOT_TOKEN);
    const r = await tg('setWebhook', env.BOT_TOKEN, {
      url: webhookUrl,
      secret_token: secret,
      allowed_updates: ['message'],
    });
    webhook = r?.ok
      ? '<span style="color:#22c55e">✅ ثبت شد → ' + webhookUrl + '</span>'
      : '<span style="color:#ef4444">❌ ' + (r?.description || 'failed') + '</span>';
  }
  const rows = checks
    .map(
      ([name, ok]) =>
        `<li><code>${name}</code> ${ok ? '✅' : '❌ missing'}</li>`
    )
    .join('');
  const ownerLine = kv
    ? owner
      ? `<li>👤 صاحب: <code>${owner}</code> &nbsp;<a href="${base}?reset=${resetCode}">بازنشانی</a></li>`
      : `<li>👤 صاحب: <b style="color:#f59e0b">ثبت نشده</b> — در تلگرام به بات <code>/claim</code> بفرستید</li>`
    : '';
  const note = env.BOT_TOKEN && env.GEMINI_API_KEY && (kv || env.ALLOWED_CHAT_ID)
    ? '<p class="ok">✅ همه‌چیز آماده است. در تلگرام به بات <code>/claim</code> بفرستید (یا اگر مالک هستید، ویس بفرستید).</p>'
    : '<p>اگر چیزی ❌ است، مقدار را در Cloudflare → وورکر → <code>Settings → Variables and Secrets</code> اضافه کنید و این صفحه را دوباره باز کنید.</p>';
  return new Response(
    `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>🎙️ وضعیت بات تبدیل ویس به متن</title>
<style>
body{background:#0f172a;color:#e2e8f0;font-family:Vazirmatn,Segoe UI,Tahoma,sans-serif;display:flex;justify-content:center;padding:40px 16px;margin:0}
.card{background:#1e293b;border:1px solid #334155;border-radius:16px;padding:28px;max-width:520px;width:100%}
h1{font-size:20px;margin:0 0 16px}
ul{list-style:none;padding:0;margin:0 0 16px}
li{padding:8px 0;border-bottom:1px dashed #334155}
p{line-height:1.9;font-size:14px;color:#94a3b8}
code{background:#0f172a;padding:2px 8px;border-radius:6px;font-size:13px}
.ok{color:#22c55e;font-weight:bold}
a{color:#7dd3fc}
</style></head>
<body>
<div class="card">
<h1>🎙️ وضعیت بات تبدیل ویس به متن</h1>
<ul>${rows}${ownerLine}</ul>
<p>وب‌هوک: ${webhook}</p>
${note}
<p>این صفحه فقط برای راه‌اندازی است؛ هر بار بازدید، وب‌هوک دوباره ثبت می‌شود.</p>
</div>
</body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

async function processUpdate(update, env) {
  const msg = update?.message;
  if (!msg || !msg.chat?.id) return;
  const chatId = msg.chat.id;
  const lang = getLang(msg);
  const strings = I18N[lang];
  const token = env.BOT_TOKEN;
  const publicMode = env.PUBLIC_BOT === 'true';
  const kv = env.OWNER_STORE || null;
  const owner = kv ? (await kv.get('owner')) || '' : '';

  if (msg.text === '/start') {
    return sendMessage(token, chatId, buildStart(env, strings, owner), msg.message_id);
  }

  if (msg.text === '/claim') {
    if (!kv) {
      return sendMessage(
        token,
        chatId,
        strings.chatIdSetup.replace('%d', String(chatId)),
        msg.message_id
      );
    }
    if (owner) {
      return sendMessage(token, chatId, strings.alreadyOwner, msg.message_id);
    }
    await kv.put('owner', String(chatId));
    return sendMessage(token, chatId, strings.claimed, msg.message_id);
  }

  if (msg.voice) {
    if (publicMode) {
      if (!checkDailyLimit(chatId, env)) {
        return sendMessage(token, chatId, strings.rateLimit, msg.message_id);
      }
    } else if (kv) {
      if (!owner) {
        return sendMessage(token, chatId, strings.noOwner, msg.message_id);
      }
      if (String(chatId) !== owner) {
        return sendMessage(token, chatId, strings.unauthorized, msg.message_id);
      }
    } else {
      const allowed = parseIds(env.ALLOWED_CHAT_ID);
      if (allowed.length && !allowed.includes(chatId)) {
        return sendMessage(token, chatId, strings.unauthorized, msg.message_id);
      }
      if (!allowed.length) {
        return sendMessage(
          token,
          chatId,
          strings.chatIdSetup.replace('%d', String(chatId)),
          msg.message_id
        );
      }
    }
    return transcribe(update, env, lang);
  }

  return sendMessage(token, chatId, strings.notVoice, msg.message_id);
}

async function transcribe(update, env, lang) {
  const msg = update.message;
  const chatId = msg.chat.id;
  const token = env.BOT_TOKEN;
  const strings = I18N[lang];
  tg('sendChatAction', token, { chat_id: chatId, action: 'typing' }).catch(() => {});

  try {
    const file = await tg('getFile', token, { file_id: msg.voice.file_id });
    if (!file?.ok || !file?.result?.file_path) {
      throw new Error('getFile failed: ' + (file?.description || 'unknown'));
    }
    const res = await fetch(
      `https://api.telegram.org/file/bot${token}/${file.result.file_path}`
    );
    if (!res.ok) throw new Error('download failed: ' + res.status);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const text = await transcribeWithGemini(
      bytes,
      msg.voice.mime_type || 'audio/ogg',
      env
    );
    const clean = (text || '').trim();
    if (!clean) {
      return sendMessage(token, chatId, strings.emptyTranscript, msg.message_id);
    }
    return sendMessage(token, chatId, escapeHtml(clean), msg.message_id);
  } catch (err) {
    console.error('[transcribe]', err?.message || err);
    if (err?.status === 429) {
      return sendMessage(token, chatId, strings.geminiRateLimit, msg.message_id);
    }
    const reason = (err?.message || 'internal').slice(0, 80);
    return sendMessage(
      token,
      chatId,
      strings.geminiError.replace('%s', reason),
      msg.message_id
    );
  }
}

async function transcribeWithGemini(bytes, mime, env) {
  const model = env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: 'Transcribe the following audio exactly as spoken. Output only the transcription with correct punctuation. No commentary, no preamble, no notes. Detect the language automatically.',
              },
              {
                inline_data: {
                  mime_type: mime,
                  data: bytesToBase64(bytes),
                },
              },
            ],
          },
        ],
      }),
    }
  );
  if (res.status === 429) {
    const err = new Error('rate limited');
    err.status = 429;
    throw err;
  }
  if (!res.ok) {
    const err = new Error('gemini ' + res.status);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((p) => p.text || '')
      .join('') || '';
  return text;
}

function buildStart(env, strings, owner) {
  const lines = [strings.startTitle, ''];
  lines.push(`• BOT_TOKEN: ${env.BOT_TOKEN ? '✅' : '❌'}`);
  lines.push(`• GEMINI_API_KEY: ${env.GEMINI_API_KEY ? '✅' : '❌'}`);
  if (env.OWNER_STORE) {
    lines.push(`• ${owner ? strings.ownerInfo.replace('%s', owner) : strings.noOwnerInfo}`);
  } else {
    lines.push(
      `• ALLOWED_CHAT_ID: ${env.ALLOWED_CHAT_ID ? '✅ ' + env.ALLOWED_CHAT_ID : '❌'}`
    );
  }
  if (env.PUBLIC_BOT === 'true') {
    lines.push(`• 🌐 ${strings.statusPublic.replace('%d', env.DAILY_LIMIT || '20')}`);
  }
  lines.push('');
  const missing = [];
  if (!env.BOT_TOKEN) missing.push('BOT_TOKEN');
  if (!env.GEMINI_API_KEY) missing.push('GEMINI_API_KEY');
  if (!env.OWNER_STORE && !env.ALLOWED_CHAT_ID && env.PUBLIC_BOT !== 'true') {
    missing.push('ALLOWED_CHAT_ID');
  }
  if (env.OWNER_STORE && !owner && env.PUBLIC_BOT !== 'true') {
    missing.push('/claim');
  }
  lines.push(missing.length ? strings.missing.replace('%s', missing.join(', ')) : strings.statusOk);
  return lines.join('\n');
}

function checkDailyLimit(chatId, env) {
  const limit = parseInt(env.DAILY_LIMIT || '20', 10);
  const key = `${new Date().toISOString().slice(0, 10)}:${chatId}`;
  const count = (DAILY_COUNTS.get(key) || 0) + 1;
  DAILY_COUNTS.set(key, count);
  if (DAILY_COUNTS.size > 10000) DAILY_COUNTS.clear();
  return count <= limit;
}

function getLang(msg) {
  return (msg?.from?.language_code || '').startsWith('fa') ? 'fa' : 'en';
}

function parseIds(value) {
  return (value || '')
    .split(',')
    .map((x) => parseInt(x.trim(), 10))
    .filter((n) => Number.isFinite(n));
}

async function tg(method, token, payload) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  return res.json();
}

async function sendMessage(token, chatId, text, replyTo) {
  return tg('sendMessage', token, {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    ...(replyTo ? { reply_to_message_id: replyTo } : {}),
  });
}

async function deriveSecret(token) {
  return (await sha256Hex(token)).slice(0, 32);
}

async function deriveResetCode(token) {
  return (await sha256Hex(token)).slice(0, 12);
}

async function sha256Hex(input) {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(input)
  );
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]
  );
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}