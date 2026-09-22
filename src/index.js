import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { TikTokLiveConnection, WebcastEvent, ControlEvent } from 'tiktok-live-connector';
import { config } from './config.js';
import * as events from './events.js';
import { extractUsername, giftTier } from './parse.js';
import { resolveRobloxName } from './roblox.js';

// TikTok viewer -> Roblox name they registered. Gifts from that viewer boost their avatar.
const links = new Map(); // tiktokId -> { roblox, at }
const status = { tiktok: config.tiktokUsername ? 'connecting' : 'disabled', since: Date.now(), lastError: null };

// ───────── core handlers (also used by the /test endpoints) ─────────
const DEBUG = (process.env.DEBUG_CHAT ?? '').trim() === 'true';

async function handleComment(tiktokId, nickname, comment) {
  const raw = extractUsername(comment);
  if (DEBUG) console.log(`[chat] ${tiktokId}: ${JSON.stringify(comment)} -> ${raw ?? 'IGNORED (did not match comment format)'}`);
  if (!raw) return { ok: false, reason: 'not a username' };

  const prev = links.get(tiktokId);
  if (prev && prev.roblox.toLowerCase() === raw.toLowerCase()) {
    if (DEBUG) console.log(`[chat] ${tiktokId} already linked to ${raw} - ignoring`);
    return { ok: false, reason: 'already linked' };
  }
  if (prev && Date.now() - prev.at < config.joinCooldownMs) {
    const wait = Math.ceil((config.joinCooldownMs - (Date.now() - prev.at)) / 1000);
    if (DEBUG) console.log(`[chat] ${tiktokId} on cooldown for another ${wait}s`);
    return { ok: false, reason: 'cooldown' };
  }

  const user = await resolveRobloxName(raw);
  if (!user) {
    if (DEBUG) console.log(`[chat] "${raw}" is not a real Roblox username - ignoring`);
    return { ok: false, reason: 'no such Roblox user' };
  }

  links.set(tiktokId, { roblox: user.name, at: Date.now() });
  const ev = events.push('join', { roblox: user.name, robloxId: user.id, tiktok: tiktokId, nickname });
  console.log(`[join] ${tiktokId} -> ${user.name}`);
  return { ok: true, event: ev };
}

function handleGift(tiktokId, nickname, giftName, diamondsEach, count) {
  const diamonds = Math.max(1, diamondsEach) * Math.max(1, count);
  const tier = giftTier(diamonds);
  const link = links.get(tiktokId);
  const ev = events.push('gift', {
    roblox: link?.roblox ?? null, tiktok: tiktokId, nickname, giftName, count, diamonds, tier,
  });
  console.log(`[gift] ${tiktokId} ${giftName} x${count} (${diamonds}💎, ${tier}) -> ${link?.roblox ?? 'current walker'}`);
  return ev;
}

// ───────── TikTok connection with auto-reconnect ─────────
function startTikTok() {
  if (!config.tiktokUsername) {
    console.log('[tiktok] TIKTOK_USERNAME not set - running in test-only mode');
    return;
  }
  const conn = new TikTokLiveConnection(config.tiktokUsername, {
    ...(config.eulerKey ? { signApiKey: config.eulerKey } : {}),
    enableExtendedGiftInfo: false,
    processInitialData: false,
  });

  let retryTimer = null;
  const retry = (delay) => {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(connect, delay);
  };

  async function connect() {
    status.tiktok = 'connecting';
    try {
      const state = await conn.connect();
      status.tiktok = 'connected'; status.since = Date.now(); status.lastError = null;
      console.log(`[tiktok] connected to @${config.tiktokUsername} (room ${state.roomId})`);
    } catch (err) {
      status.tiktok = 'offline'; status.lastError = err?.message ?? String(err);
      console.warn(`[tiktok] connect failed: ${status.lastError} - retrying in 15s`);
      retry(15000);
    }
  }

  conn.on(WebcastEvent.CHAT, (data) => {
    const id = data.user?.uniqueId;
    if (!id) return;
    handleComment(id, data.user?.nickname ?? id, data.comment).catch((e) => console.warn('[chat]', e.message));
  });

  conn.on(WebcastEvent.GIFT, (data) => {
    const details = data.giftDetails ?? {};
    // Streakable gifts (type 1) fire repeatedly - only count the final event of the streak
    if (details.giftType === 1 && !data.repeatEnd) return;
    const id = data.user?.uniqueId;
    if (!id) return;
    handleGift(id, data.user?.nickname ?? id, details.giftName ?? `gift ${data.giftId}`, details.diamondCount ?? 1, data.repeatCount ?? 1);
  });

  conn.on(WebcastEvent.STREAM_END, () => {
    status.tiktok = 'offline'; console.log('[tiktok] stream ended - waiting for next live');
    retry(30000);
  });
  conn.on(ControlEvent.DISCONNECTED, () => {
    if (status.tiktok === 'connected') {
      status.tiktok = 'offline'; console.warn('[tiktok] disconnected - reconnecting in 5s');
      retry(5000);
    }
  });
  conn.on(ControlEvent.ERROR, ({ info }) => console.warn('[tiktok] error:', info));

  connect();
}

// ───────── HTTP API ─────────
function authed(req) {
  const given = Buffer.from(String(req.headers['x-runway-secret'] ?? ''));
  const want = Buffer.from(config.secret);
  return given.length === want.length && want.length > 0 && timingSafeEqual(given, want);
}

function send(res, code, body) {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 10_000) throw new Error('body too large');
  }
  return body ? JSON.parse(body) : {};
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname === '/health') {
      return send(res, 200, { ok: true, tiktok: status.tiktok });
    }
    if (!authed(req)) return send(res, 401, { error: 'unauthorized' });

    if (req.method === 'GET' && url.pathname === '/events') {
      const cursor = Number(url.searchParams.get('since') ?? 0) || 0;
      return send(res, 200, { ...events.since(cursor), tiktok: status.tiktok });
    }
    if (req.method === 'GET' && url.pathname === '/status') {
      return send(res, 200, { ...status, links: links.size, ...events.stats(), channel: config.tiktokUsername || null });
    }
    // Fake events for testing without going live
    if (req.method === 'POST' && url.pathname === '/test/comment') {
      const b = await readJson(req);
      const r = await handleComment(b.tiktok ?? `tester_${Math.random().toString(36).slice(2, 7)}`, b.tiktok ?? 'tester', String(b.comment ?? ''));
      return send(res, 200, r);
    }
    if (req.method === 'POST' && url.pathname === '/test/gift') {
      const b = await readJson(req);
      const ev = handleGift(b.tiktok ?? 'tester', b.tiktok ?? 'tester', b.giftName ?? 'Rose', Number(b.diamonds ?? 1), Number(b.count ?? 1));
      return send(res, 200, { ok: true, event: ev });
    }
    send(res, 404, { error: 'not found' });
  } catch (err) {
    send(res, 400, { error: err.message });
  }
});

server.listen(config.port, () => {
  console.log(`[http] Runway relay listening on :${config.port}`);
  console.log(`[config] commentMode=${config.commentMode}` + (config.commentMode === 'prefix' ? ` prefix="${config.commentPrefix}"` : '') + ` validateNames=${config.validateNames} debugChat=${DEBUG}`);
  startTikTok();
});