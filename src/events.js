// Cursor-based event log. Roblox asks for everything after the last id it saw,
// so a failed request never loses events.
import { config } from './config.js';

let nextId = 1;
const log = [];

export function push(type, data) {
  const ev = { id: nextId++, t: Date.now(), type, ...data };
  log.push(ev);
  if (log.length > config.maxEvents) log.splice(0, log.length - config.maxEvents);
  return ev;
}

export function since(cursor, limit = 50) {
  const events = log.filter((e) => e.id > cursor).slice(0, limit);
  return { events, last: events.length ? events[events.length - 1].id : Math.max(cursor, nextId - 1), now: Date.now() };
}

export function stats() {
  return { total: nextId - 1, buffered: log.length };
}
