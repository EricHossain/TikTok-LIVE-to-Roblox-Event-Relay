import { config } from './config.js';

const NAME_RE = /^[A-Za-z0-9_]{3,20}$/;
// Common chat words that are also valid Roblox usernames - ignored in "single" mode
const BLOCK = new Set(`hi hey hello hii hiii yo sup lol lmao lmfao omg wow yes yea yeah yep nah nope no
bro bruh sis ok okay oki pls plz please thanks thank thx ty love cute nice cool fire gg wtf idk
haha hahaha xd follow followed me mine next who what why how when where here join joined me2
first second third goat slay queen king mom dad hehe lets ready done wait stop go`.split(/\s+/));

/**
 * Returns a Roblox username from a TikTok comment, or null.
 *
 * prefix mode (recommended): the comment must start with the keyword, e.g.
 *   "user Eric_Z"  "user: Eric_Z"  "user {Eric_Z}"  "USER @Eric_Z"  "user  Eric_Z !!"
 * single mode: the whole comment must be one username.
 */
export function extractUsername(comment) {
  if (!comment) return null;
  let text = comment.trim();

  if (config.commentMode === 'prefix') {
    const prefix = config.commentPrefix;
    if (!text.toLowerCase().startsWith(prefix)) return null;
    text = text.slice(prefix.length);
    // Tolerate whatever separator they typed: ": ", " {", " @", etc.
    text = text.replace(/^[\s:,\-=>{[("'@]+/u, '');
    // Cut at the first closing bracket / quote / whitespace after the name
    text = text.split(/[\s}\])"'!?.,]/u)[0] ?? '';
  } else {
    text = text.replace(/^@/, '').replace(/[^\w\s].*$/u, '').trim();
    if (text.includes(' ')) return null;
  }

  text = text.trim();
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