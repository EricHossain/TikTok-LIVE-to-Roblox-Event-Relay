// Validates Roblox usernames via the public users API, with caching.
import { config } from './config.js';

const cache = new Map(); // lower -> { name, id } | null
const TTL = 30 * 60 * 1000;

export async function resolveRobloxName(name) {
  if (!config.validateNames) return { name, id: null };
  const key = name.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  try {
    const res = await fetch('https://users.roblox.com/v1/usernames/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ usernames: [name], excludeBannedUsers: true }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const u = json.data?.[0];
    const value = u ? { name: u.name, id: u.id } : null;
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch (err) {
    // API down / rate limited: let it through, Roblox validates again anyway
    console.warn(`[roblox] lookup failed for ${name}: ${err.message}`);
    return { name, id: null };
  }
}
