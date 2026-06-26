// tonespeak/src/lib/flag.js
//
// Mutable session-scope state at ~/.tonespeak/state.json.
//
// Schema:
//   {
//     "active":     { "family": "...", "dialect": "...", "lite": bool } | null,
//     "parked":     { "family": "...", "dialect": "...", "lite": bool } | null,
//     "session_id": "<alphanumeric, dashes, underscores>",
//     "set_at":     "<ISO 8601 timestamp>"
//   }
//
// Security hardening (spec §7.3): the flag file is rendered to the terminal by
// the statusline.  A local attacker who can write the file could inject ANSI
// escape sequences.  Mitigations:
//   - O_NOFOLLOW on open: refuse to follow symlinks.
//   - 1 KB byte cap on read.
//   - Character whitelist on values that reach the statusline.
//   - Bad JSON / invalid schema disables tonespeak (returns null active).

import { openSync, readSync, writeFileSync, closeSync, statSync, existsSync, unlinkSync, constants } from 'node:fs';
import { join } from 'node:path';
import { getConfigDir, ensureConfigDir, VALID_FAMILIES } from './config.js';

const MAX_FLAG_BYTES = 1024;
const SAFE_CHAR_RE = /^[A-Za-z0-9_\-/]+$/;
const SESSION_ID_RE = /^[A-Za-z0-9_\-]{1,128}$/;

const O_NOFOLLOW = constants.O_NOFOLLOW || 0;

export function flagPath() {
  return process.env.TONESPEAK_STATE || join(getConfigDir(), 'state.json');
}

export function emptyFlag() {
  return { active: null, parked: null, session_id: null, set_at: null };
}

export function readFlag() {
  const path = flagPath();
  if (!existsSync(path)) return emptyFlag();

  let fd;
  try {
    const st = statSync(path);
    if (st.size > MAX_FLAG_BYTES) {
      process.stderr.write(`[tonespeak] state.json exceeds ${MAX_FLAG_BYTES} bytes;  ignoring\n`);
      return emptyFlag();
    }

    fd = openSync(path, constants.O_RDONLY | O_NOFOLLOW);
    const buf = Buffer.alloc(Math.min(st.size, MAX_FLAG_BYTES));
    readSync(fd, buf, 0, buf.length, 0);
    const parsed = JSON.parse(buf.toString('utf8'));
    return validateFlag(parsed) ? parsed : emptyFlag();
  } catch (err) {
    if (err.code === 'ELOOP') {
      process.stderr.write(`[tonespeak] state.json is a symlink;  refusing to read\n`);
    } else {
      process.stderr.write(`[tonespeak] state.json unreadable (${err.code || err.message});  using empty\n`);
    }
    return emptyFlag();
  } finally {
    if (fd !== undefined) {
      try { closeSync(fd); } catch { /* ignore */ }
    }
  }
}

export function writeFlag(state) {
  ensureConfigDir();
  if (!validateFlag(state)) {
    throw new Error('refusing to write invalid flag state');
  }
  const path = flagPath();

  if (existsSync(path)) {
    try {
      const st = statSync(path);
      if (st.isSymbolicLink && st.isSymbolicLink()) {
        throw new Error('state.json is a symlink;  refusing to write');
      }
    } catch (err) {
      if (err.message.includes('symlink')) throw err;
    }
  }

  const json = JSON.stringify(state, null, 2) + '\n';
  if (Buffer.byteLength(json, 'utf8') > MAX_FLAG_BYTES) {
    throw new Error(`state would exceed ${MAX_FLAG_BYTES} bytes`);
  }
  writeFileSync(path, json, { mode: 0o600, flag: 'w' });
}

export function clearFlag() {
  const path = flagPath();
  if (existsSync(path)) unlinkSync(path);
}

export function validateFlag(state) {
  if (!state || typeof state !== 'object') return false;
  if (!('active' in state) || !('parked' in state)) return false;

  if (state.active !== null && !validateModeRef(state.active)) return false;
  if (state.parked !== null && !validateModeRef(state.parked)) return false;

  if (state.session_id !== null && state.session_id !== undefined) {
    if (typeof state.session_id !== 'string' || !SESSION_ID_RE.test(state.session_id)) return false;
  }
  return true;
}

function validateModeRef(ref) {
  if (!ref || typeof ref !== 'object') return false;
  if (!VALID_FAMILIES.includes(ref.family)) return false;
  if (typeof ref.dialect !== 'string' || !SAFE_CHAR_RE.test(ref.dialect)) return false;
  if (typeof ref.lite !== 'boolean') return false;
  return true;
}

export function safeForStatusline(s) {
  if (typeof s !== 'string') return '';
  return SAFE_CHAR_RE.test(s) ? s : '';
}

export function nowIso() {
  return new Date().toISOString();
}
