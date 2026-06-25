#!/usr/bin/env node
// tonespeak/src/hooks/activate.js
//
// Claude Code SessionStart hook (spec §8.1).
//
// Runs once per session.  Two responsibilities:
//
//   1. Session boundary enforcement.  On every fresh session (session_id
//      differs from the one stored in state.json), reset state.active.
//      With auto_activate=true, seed state.active from config defaults.
//      With auto_activate=false, clear state.active so dialects from a
//      prior session do not leak.  In both cases preserve state.parked so
//      cross-session /tonespeak resume continues to work.
//
//   2. Dialect injection.  If state.active is set after the boundary
//      check, load the dialect SKILL.md via loader and emit it as
//      additionalContext via the structured hook output shape.
//
// Standalone fallback (dialect file not on disk, e.g. for users who
// installed only the hook and not the full repo) emits a minimal
// hardcoded ruleset.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readConfig } from '../lib/config.js';
import { readFlag, writeFlag, nowIso } from '../lib/flag.js';
import { loadDialect } from '../lib/loader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');

const STANDALONE_FALLBACK = `# tonespeak (standalone fallback)

Tonespeak is active but the dialect files are not on disk at this install.
Until the full repo is installed, follow this minimal compression set:

- Drop articles (the, a, an) unless inside code, errors, or quotes.
- Drop linking verbs in declarative fragments.
- Use sentence fragments where they read clearly.
- Prefer tables and bullets over prose for lists and comparisons.
- No preamble.  No closing tagline.  No hedging chains.

Drop into plain prose for any of:  destructive operation, security warning,
credential, repeated question, dollar amount, deadline, safety consequence.
`;

function readSessionId() {
  // Claude Code passes session info on stdin as JSON.  Synchronous read on the
  // hook's finite stdin pipe.
  try {
    if (process.stdin.isTTY) return null;
    const buf = readFileSync(0, 'utf8');
    if (!buf) return null;
    const parsed = JSON.parse(buf);
    return parsed.session_id || parsed.sessionId || null;
  } catch {
    return null;
  }
}

export function applySessionBoundary(state, sessionId, cfg) {
  // Session boundary detection:  if we can read sessionId AND it differs
  // from what state.json remembers, this is a fresh session.  Reset
  // state.active per auto_activate.  Preserve parked.
  //
  // If sessionId cannot be read (null), preserve state as-is (best we can
  // do without a session identity).
  const newSession = sessionId && state.session_id !== sessionId;

  if (!newSession) return state;

  if (cfg.auto_activate) {
    return {
      active: {
        family: cfg.default_mode,
        dialect: cfg.default_dialect,
        lite: cfg.default_lite,
      },
      parked: state.parked || null,
      session_id: sessionId,
      set_at: nowIso(),
    };
  }

  return {
    active: null,
    parked: state.parked || null,
    session_id: sessionId,
    set_at: nowIso(),
  };
}

function main() {
  const cfg = readConfig();
  const sessionId = readSessionId();
  let state = readFlag();

  const resetState = applySessionBoundary(state, sessionId, cfg);
  if (resetState !== state) {
    state = resetState;
    try {
      writeFlag(state);
    } catch (err) {
      process.stderr.write(`[tonespeak] could not reset state for new session (${err.message})\n`);
    }
  }

  if (!state.active) {
    process.exit(0);
  }

  // Load the dialect and emit.  Claude Code SessionStart hooks require
  // hookSpecificOutput.hookEventName + additionalContext;  raw stdout is
  // no longer accepted as injected context (validated against v2.1.145).
  let skillText;
  try {
    const loaded = loadDialect(state.active.family, state.active.dialect, {
      root: REPO_ROOT,
      preset: state.active.lite ? 'lite' : null,
    });
    skillText = loaded.skill;
  } catch (err) {
    process.stderr.write(`[tonespeak] dialect load failed (${err.message});  emitting fallback\n`);
    skillText = STANDALONE_FALLBACK;
  }
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: skillText,
    },
  }) + '\n');
}

// Only run as CLI when invoked directly;  import is a no-op.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
