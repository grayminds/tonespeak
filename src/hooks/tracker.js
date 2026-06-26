#!/usr/bin/env node
// tonespeak/src/hooks/tracker.js
//
// Claude Code UserPromptSubmit hook (spec §8.1, §7.1, §7.2).
//
// Two responsibilities:
//
//   1. Slash command dispatch.  Parse user input for /cavespeak, /bardspeak,
//      /spacespeak, /normal, and /tonespeak <subcommand>.  Update state.json.
//      Returned via the decision:'block' channel so the prompt never reaches
//      Claude (saves a round trip).
//
//   2. Per-turn reinforcement.  When state.active is non-null on a normal prompt,
//      emit the active dialect's reminder (from frontmatter, capped at 200 chars)
//      via hookSpecificOutput.additionalContext.  Load-bearing per caveman:
//      without per-turn anchoring the dialect drifts back to verbose after
//      context compaction.
//
// Exit codes: 0 always.  Decisions and context are returned via stdout JSON.
//
// The core dispatch logic is exported as dispatchTrigger() so src/cmd/dispatch.js
// can call it directly when invoked from a slash-command markdown file.  Hook
// output and command output need different shapes (hook = JSON envelope, command
// = plain text), so the shared core returns a structured result and the two
// callers format it.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFlag, writeFlag, clearFlag, nowIso } from '../lib/flag.js';
import { loadDialect } from '../lib/loader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');

export const FAMILY_DIALECTS = Object.freeze({
  bardspeak: {
    default: 'tavern',
    valid: ['tavern', 'viking', 'dragonlance', 'dnd', 'tolkien'],
  },
  spacespeak: {
    default: 'missioncontrol',
    valid: ['missioncontrol', 'expanse', 'solarclipper', 'startrek', 'starwars', 'doctorwho', 'firefly', 'galactica', 'stargate'],
  },
  stylespeak: {
    default: 'noir',
    valid: ['cavespeak', 'noir', 'cyberpunk', 'steampunk', 'pirate', 'western', 'deadpan', 'renfaire', 'shakespearean', 'laconic'],
  },
});

const HELP_TEXT =
  'tonespeak triggers:\n' +
  '  /cavespeak [lite]                   (alias for /stylespeak cavespeak)\n' +
  '  /bardspeak [tavern|viking|dragonlance|dnd|tolkien] [lite]\n' +
  '  /spacespeak [missioncontrol|expanse|solarclipper|startrek|starwars|doctorwho|firefly|galactica|stargate] [lite]\n' +
  '  /stylespeak [cavespeak|noir|cyberpunk|steampunk|pirate|western|deadpan|renfaire|shakespearean|laconic] [lite]\n' +
  '  /tonespeak <dialect> [lite]   (any dialect by name, family resolved automatically)\n' +
  '  /normal\n' +
  '  /tonespeak stats\n' +
  '  /tonespeak park\n' +
  '  /tonespeak resume\n';

// Resolve a bare dialect name to its family.  Dialect names are unique across
// families, so `/tonespeak noir` is unambiguous.  Returns { family, dialect } or null.
export function resolveDialect(name) {
  for (const [family, spec] of Object.entries(FAMILY_DIALECTS)) {
    if (spec.valid.includes(name)) return { family, dialect: name };
  }
  return null;
}

// ---------- Stdout shape (hook-mode only) ----------

function emit(payload) {
  process.stdout.write(JSON.stringify(payload) + '\n');
  process.exit(0);
}

function block(reason) {
  emit({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', decision: 'block', reason } });
}

function passWithContext(text) {
  if (!text) emit({});
  emit({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: text } });
}

function readPrompt() {
  try {
    if (process.stdin.isTTY) return '';
    const buf = readFileSync(0, 'utf8');
    if (!buf) return '';
    try {
      const parsed = JSON.parse(buf);
      return parsed.prompt || parsed.user_prompt || parsed.message || '';
    } catch {
      return buf;
    }
  } catch {
    return '';
  }
}

// ---------- Trigger parsing ----------

const TRIGGER_RE = /^\s*\/(cavespeak|bardspeak|spacespeak|stylespeak|normal|tonespeak)\b(.*)$/i;

export function parseTrigger(prompt) {
  const m = prompt.match(TRIGGER_RE);
  if (!m) return null;
  const cmd = m[1].toLowerCase();
  const rest = m[2].trim().toLowerCase();

  if (cmd === 'normal') return { kind: 'normal' };

  if (cmd === 'tonespeak') {
    const parts = rest.split(/\s+/).filter(Boolean);
    if (!parts.length) return { kind: 'help' };
    const first = parts[0];

    // Subcommands keep priority over dialect resolution.
    if (first === 'help') return { kind: 'help' };
    if (first === 'stats' || first === 'park' || first === 'resume') {
      return { kind: 'subcommand', subcommand: first };
    }

    // Otherwise resolve a bare dialect name across all families, so
    // `/tonespeak noir` activates stylespeak/noir without naming the family.
    const resolved = resolveDialect(first);
    if (resolved) {
      const lite = parts.includes('lite');
      return { kind: 'activate', family: resolved.family, dialect: resolved.dialect, lite };
    }

    // Unknown token:  fall through to subcommand handling (yields a helpful error).
    return { kind: 'subcommand', subcommand: first };
  }

  // Family activation
  const parts = rest.split(/\s+/).filter(Boolean);
  let dialect = null;
  let lite = false;
  for (const p of parts) {
    if (p === 'lite') lite = true;
    else if (!dialect) dialect = p;
  }

  // /cavespeak is a convenience alias:  cavespeak is no longer its own family,
  // it lives in stylespeak.  Keep the old trigger working.
  if (cmd === 'cavespeak') {
    return { kind: 'activate', family: 'stylespeak', dialect: 'cavespeak', lite };
  }

  const family = cmd;
  const family_spec = FAMILY_DIALECTS[family];
  if (!family_spec) return null;

  if (!dialect) dialect = family_spec.default;
  if (!family_spec.valid.includes(dialect)) {
    return { kind: 'invalid_dialect', family, dialect, valid: family_spec.valid };
  }
  return { kind: 'activate', family, dialect, lite };
}

// ---------- Shared dispatch core ----------
//
// Returns a structured result of the form:
//   { kind: 'no_trigger' }                          -- not a trigger
//   { kind: 'activated', family, dialect, lite, message }
//   { kind: 'normal', message }                     -- /normal cleared state
//   { kind: 'parked' | 'resumed', message }
//   { kind: 'help' | 'stats', message }
//   { kind: 'invalid_dialect', family, dialect, message }
//   { kind: 'unknown_subcommand', message }
//   { kind: 'nothing_to_park' | 'nothing_to_resume', message }
//   { kind: 'write_error', message }                -- writeFlag failed

export function dispatchTrigger(prompt) {
  const trigger = parseTrigger(prompt);
  if (!trigger) return { kind: 'no_trigger' };

  if (trigger.kind === 'normal') {
    clearFlag();
    return { kind: 'normal', message: 'Tonespeak deactivated.  Plain prose mode.' };
  }

  if (trigger.kind === 'invalid_dialect') {
    return {
      kind: 'invalid_dialect',
      family: trigger.family,
      dialect: trigger.dialect,
      message: `Unknown ${trigger.family} dialect "${trigger.dialect}".  Valid: ${trigger.valid.join(', ')}.`,
    };
  }

  if (trigger.kind === 'activate') {
    const state = readFlag();
    state.active = { family: trigger.family, dialect: trigger.dialect, lite: trigger.lite };
    state.set_at = nowIso();
    try {
      writeFlag(state);
    } catch (err) {
      return {
        kind: 'write_error',
        message: `Could not activate ${trigger.family}/${trigger.dialect}: ${err.message}`,
      };
    }
    const lite_suffix = trigger.lite ? ' (lite preset)' : '';
    return {
      kind: 'activated',
      family: trigger.family,
      dialect: trigger.dialect,
      lite: trigger.lite,
      message: `Tonespeak active: ${trigger.family}/${trigger.dialect}${lite_suffix}.  Voice applies from next response.`,
    };
  }

  if (trigger.kind === 'help') {
    return { kind: 'help', message: HELP_TEXT };
  }

  if (trigger.kind === 'subcommand') {
    return dispatchSubcommand(trigger.subcommand);
  }

  return { kind: 'no_trigger' };
}

function dispatchSubcommand(sub) {
  const state = readFlag();

  if (sub === 'park') {
    if (!state.active) return { kind: 'nothing_to_park', message: 'Nothing to park;  no active dialect.' };
    state.parked = state.active;
    state.active = null;
    state.set_at = nowIso();
    try {
      writeFlag(state);
    } catch (err) {
      return { kind: 'write_error', message: `Could not park: ${err.message}` };
    }
    return {
      kind: 'parked',
      message: `Tonespeak parked: ${state.parked.family}/${state.parked.dialect}.  Use /tonespeak resume to reactivate.`,
    };
  }

  if (sub === 'resume') {
    if (!state.parked) return { kind: 'nothing_to_resume', message: 'Nothing to resume;  no parked dialect.' };
    state.active = state.parked;
    state.parked = null;
    state.set_at = nowIso();
    try {
      writeFlag(state);
    } catch (err) {
      return { kind: 'write_error', message: `Could not resume: ${err.message}` };
    }
    return {
      kind: 'resumed',
      message: `Tonespeak resumed: ${state.active.family}/${state.active.dialect}.`,
    };
  }

  if (sub === 'stats') {
    return {
      kind: 'stats',
      message:
        'Tonespeak stats are not implemented yet.  ' +
        'Phase 7 wires src/stats.js to walk Claude Code session JSONL and report ' +
        'token savings per dialect.',
    };
  }

  return {
    kind: 'unknown_subcommand',
    message: `Unknown /tonespeak subcommand "${sub}".  Try: stats, park, resume.`,
  };
}

// ---------- Hook main (UserPromptSubmit) ----------

function main() {
  const prompt = readPrompt();
  const result = dispatchTrigger(prompt);

  if (result.kind !== 'no_trigger') {
    return block(result.message);
  }

  // No trigger.  Inject per-turn reminder if a dialect is active.
  const state = readFlag();
  if (!state.active) return emit({});

  try {
    const loaded = loadDialect(state.active.family, state.active.dialect, {
      root: REPO_ROOT,
      preset: state.active.lite ? 'lite' : null,
    });
    if (loaded.reminder) return passWithContext(loaded.reminder);
  } catch {
    /* fall through */
  }
  return emit({});
}

// Only run as CLI when invoked directly;  import (for tests) is a no-op.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
