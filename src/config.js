import { readFileSync, existsSync } from 'node:fs';

// Tiny .env loader (no dependency needed)
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const env = (k, d) => (process.env[k] ?? '').trim() || d;
const num = (k, d) => Number(env(k, d)) || d;

export const config = {
  tiktokUsername: env('TIKTOK_USERNAME', '').replace(/^@/, ''),
  secret: env('SHARED_SECRET', ''),
  port: num('PORT', 8080),
  eulerKey: env('EULER_API_KEY', ''),
  commentMode: env('COMMENT_MODE', 'single'),
  commentPrefix: env('COMMENT_PREFIX', '!walk').toLowerCase(),
  joinCooldownMs: num('JOIN_COOLDOWN_SEC', 300) * 1000,
  tierMedium: num('TIER_MEDIUM_DIAMONDS', 10),
  tierGiant: num('TIER_GIANT_DIAMONDS', 100),
  validateNames: env('VALIDATE_ROBLOX_NAMES', 'true') !== 'false',
  maxEvents: 1000,
};

if (!config.secret || config.secret.startsWith('change-me')) {
  console.warn('[config] SHARED_SECRET is not set to a real value - set one before going live!');
}
