#!/usr/bin/env node
// tonespeak/src/cmd/dispatch.js
//
// Bridge between Claude Code slash commands (commands/*.md) and the shared
// dispatch core in src/hooks/tracker.js.  Hooks need a JSON envelope on stdout
// and never see plain text;  slash commands invoke this script via the
// `!`bash`` action and surface whatever the script prints to the user (and to
// the model as additional prompt context).
//
// Usage from a command body:
//   !`node "${CLAUDE_PLUGIN_ROOT}/src/cmd/dispatch.js" spacespeak $ARGUMENTS`
//   !`node "${CLAUDE_PLUGIN_ROOT}/src/cmd/dispatch.js" tonespeak park`
//   !`node "${CLAUDE_PLUGIN_ROOT}/src/cmd/dispatch.js" normal`
//
// argv layout:
//   argv[0]  node
//   argv[1]  dispatch.js
//   argv[2]  family name or top-level command (cavespeak|bardspeak|spacespeak|normal|tonespeak)
//   argv[3+] dialect / subcommand / lite flag
//
// Behavior:
//   - Synthesize the equivalent slash-command string.
//   - Call dispatchTrigger() from tracker.js.
//   - Print the human-readable message.
//   - Exit 0 on success kinds, 1 on error kinds, 2 on argv misuse.

import { pathToFileURL } from 'node:url';
import { dispatchTrigger } from '../hooks/tracker.js';

const SUCCESS_KINDS = new Set([
  'activated',
  'normal',
  'parked',
  'resumed',
  'help',
  'stats',
]);

const ERROR_KINDS = new Set([
  'invalid_dialect',
  'unknown_subcommand',
  'write_error',
  'nothing_to_park',
  'nothing_to_resume',
]);

export function buildPrompt(argv) {
  // argv here is just the user-supplied tokens (post-`dispatch.js`), so the
  // caller passes argv.slice(2) from a real CLI invocation.
  if (argv.length === 0) return null;
  const head = argv[0];
  const rest = argv.slice(1).filter(Boolean).join(' ').trim();
  return rest.length > 0 ? `/${head} ${rest}` : `/${head}`;
}

function main() {
  const userArgv = process.argv.slice(2);
  const prompt = buildPrompt(userArgv);

  if (!prompt) {
    process.stderr.write('Usage: dispatch.js <family|normal|tonespeak> [args...]\n');
    process.exit(2);
  }

  const result = dispatchTrigger(prompt);

  if (result.kind === 'no_trigger') {
    // Should not happen because we synthesized a trigger explicitly.  If it
    // does, surface the input for debugging.
    process.stderr.write(`tonespeak: not a recognized trigger:  ${prompt}\n`);
    process.exit(2);
  }

  process.stdout.write(result.message + '\n');

  if (SUCCESS_KINDS.has(result.kind)) process.exit(0);
  if (ERROR_KINDS.has(result.kind)) process.exit(1);

  // Unknown kind:  treat as error so the model is alerted.
  process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
