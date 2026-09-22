import { config } from './config.js';

const NAME_RE = /^[A-Za-z0-9_]{3,20}$/;
// Common chat words that are also valid Roblox usernames - ignore them
const BLOCK = new Set(`hi hey hello hii hiii yo sup lol lmao lmfao omg wow yes yea yeah yep nah nope no
bro bruh sis ok okay oki pls plz please thanks thank thx ty love cute nice cool fire gg wtf idk
haha hahaha xd follow followed me mine next who what why how when where here join joined me2
first second third goat slay queen king mom dad hehe lets ready done wait stop go`.split(/\s+/));

/** Returns a Roblox username from a TikTok comment, or null. */
export function extractUsername(comment) {
  if (!comment) return null;
  let text = comment.trim();
  if (config.commentMode === 'prefix') {
    if (!text.toLowerCase().startsWith(config.commentPrefix)) return null;
    text = text.slice(config.commentPrefix.length).trim();
  }
  // Allow "@name", "name!", "name 🔥" - but must be a single word otherwise
  text = text.replace(/^@/, '').replace(/[^\w\s].*$/u, '').trim();
  if (text.includes(' ')) return null;
  if (!NAME_RE.test(text)) return null;
  if (text.startsWith('_') || text.endsWith('_')) return null;
  if (config.commentMode === 'single' && BLOCK.has(text.toLowerCase())) return null;
  return text;
}

export function giftTier(diamonds) {
  if (diamonds >= config.tierGiant) return 'giant';
  if (diamonds >= config.tierMedium) return 'medium';
  return 'small';
}
