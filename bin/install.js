#!/usr/bin/env node
// tonespeak/bin/install.js
//
// Multi-agent installer.  Wires tonespeak into Claude Code as a plugin (primary
// target) and writes ~/.tonespeak/config.json with user-confirmed defaults.
//
// Usage:
//   npx tonespeak                              # interactive install (default)
//   node bin/install.js                        # same, from local repo
//   node bin/install.js --non-interactive      # use defaults, no prompts
//   node bin/install.js --uninstall            # remove the plugin
//   node bin/install.js --uninstall --purge    # also remove ~/.tonespeak/
//   node bin/install.js --list                 # detect agents only
//   node bin/install.js --dry-run              # plan only, no writes
//   node bin/install.js --auto-activate true   # set auto-activate explicitly
//
// Other agents (Codex, Cursor, Cline, Aider, Windsurf, OpenClaw, Copilot) are
// listed for detection but only Claude Code has a working install path in v0.1.

import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir, platform } from 'node:os';
import { execSync, spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';

import { resolveHome } from '../src/lib/home.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const MARKETPLACE_NAME = 'tonespeak-local';
const PLUGIN_NAME = 'tonespeak';

// ---------- Provider catalog ----------

const PROVIDERS = [
  { id: 'claude',    detect: 'command:claude',                                    install: 'claude_plugin',         supported: true  },
  { id: 'codex',     detect: 'command:codex',                                     install: 'codex_hooks',           supported: false },
  { id: 'cursor',    detect: 'command:cursor||macapp:Cursor',                     install: 'rule_file',             supported: false, target: '.cursor/rules/tonespeak.mdc' },
  { id: 'windsurf',  detect: 'command:windsurf',                                  install: 'rule_file',             supported: false, target: '.windsurf/rules/tonespeak.md' },
  { id: 'cline',     detect: 'vscode-ext:cline',                                  install: 'rule_file',             supported: false, target: '.clinerules/tonespeak.md' },
  { id: 'aider',     detect: 'command:aider',                                     install: 'rule_file',             supported: false, target: '.aider.conf.yml' },
  { id: 'opencode',  detect: 'command:opencode',                                  install: 'rule_file',             supported: false, target: '.opencode/AGENTS.md' },
  { id: 'openclaw',  detect: 'command:openclaw||dir:$HOME/.openclaw/workspace',   install: 'openclaw_bootstrap',    supported: false },
  { id: 'copilot',   detect: 'soft',                                              install: 'rule_file',             supported: false, target: '.github/copilot-instructions.md', soft: true },
];

// ---------- Detection ----------

function detect(rule) {
  if (rule === 'soft') return false;
  for (const clause of rule.split('||')) {
    if (detectOne(clause.trim())) return true;
  }
  return false;
}

function detectOne(clause) {
  const [kind, ...rest] = clause.split(':');
  const arg = rest.join(':').trim();
  switch (kind) {
    case 'command':       return hasCommand(arg);
    case 'vscode-ext':    return hasVscodeExt(arg);
    case 'macapp':        return hasMacApp(arg);
    case 'dir':           return existsSync(expandPath(arg));
    case 'file':          return existsSync(expandPath(arg));
    default:              return false;
  }
}

function expandPath(p) {
  return p.replace(/^\$HOME/, homedir()).replace(/^~/, homedir());
}

function hasCommand(name) {
  const isWin = platform() === 'win32';
  const cmd = isWin ? `where ${name}` : `command -v ${name}`;
  try {
    execSync(cmd, { stdio: ['ignore', 'ignore', 'ignore'] });
    return true;
  } catch {
    return false;
  }
}

function hasVscodeExt(id) {
  const path = join(homedir(), '.vscode', 'extensions');
  if (!existsSync(path)) return false;
  try {
    const list = execSync('code --list-extensions', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return list.toLowerCase().includes(id.toLowerCase());
  } catch {
    return false;
  }
}

function hasMacApp(name) {
  if (platform() !== 'darwin') return false;
  return existsSync(`/Applications/${name}.app`);
}

// ---------- Claude CLI invocation ----------

function resolveClaude() {
  const isWin = platform() === 'win32';
  const finder = isWin ? 'where' : 'which';
  const r = spawnSync(finder, ['claude'], { encoding: 'utf8', shell: false });
  if (r.status === 0 && r.stdout.trim()) {
    return r.stdout.split(/\r?\n/)[0].trim();
  }
  return null;
}

function claudeCmd(args, opts = {}) {
  const bin = resolveClaude();
  if (!bin) {
    return { ok: false, error: 'claude CLI not found on PATH' };
  }
  const r = spawnSync(bin, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    timeout: opts.timeout || 30_000,
  });
  return {
    ok: r.status === 0,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
    status: r.status,
  };
}

// ---------- Claude Code plugin install ----------

function installClaude({ dryRun, repoRoot }) {
  process.stdout.write('Installing tonespeak into Claude Code...\n');

  if (dryRun) {
    process.stdout.write(`  [dry-run]  claude plugin marketplace add ${repoRoot}\n`);
    process.stdout.write(`  [dry-run]  claude plugin install ${PLUGIN_NAME}@${MARKETPLACE_NAME}\n`);
    return { ok: true };
  }

  // Check existing marketplaces (idempotent re-install).
  const listRes = claudeCmd(['plugin', 'marketplace', 'list']);
  const alreadyAdded = listRes.ok && listRes.stdout.includes(MARKETPLACE_NAME);

  if (alreadyAdded) {
    process.stdout.write(`  Marketplace ${MARKETPLACE_NAME} already registered;  updating...\n`);
    const upd = claudeCmd(['plugin', 'marketplace', 'update', MARKETPLACE_NAME]);
    if (!upd.ok) {
      process.stderr.write(`  Failed to update marketplace: ${upd.stderr || upd.stdout}\n`);
      return { ok: false };
    }
  } else {
    const add = claudeCmd(['plugin', 'marketplace', 'add', repoRoot]);
    if (!add.ok) {
      process.stderr.write(`  Failed to add marketplace: ${add.stderr || add.stdout}\n`);
      return { ok: false };
    }
    process.stdout.write(`  Marketplace added: ${MARKETPLACE_NAME}\n`);
  }

  // Check if plugin is already installed.
  const pluginList = claudeCmd(['plugin', 'list']);
  const alreadyInstalled = pluginList.ok && pluginList.stdout.includes(`${PLUGIN_NAME}@${MARKETPLACE_NAME}`);

  if (alreadyInstalled) {
    process.stdout.write(`  Plugin already installed.  Skipping install step.\n`);
  } else {
    const inst = claudeCmd(['plugin', 'install', `${PLUGIN_NAME}@${MARKETPLACE_NAME}`]);
    if (!inst.ok) {
      process.stderr.write(`  Failed to install plugin: ${inst.stderr || inst.stdout}\n`);
      return { ok: false };
    }
    process.stdout.write(`  Plugin installed.\n`);
  }

  return { ok: true };
}

function uninstallClaude({ dryRun }) {
  process.stdout.write('Uninstalling tonespeak from Claude Code...\n');

  if (dryRun) {
    process.stdout.write(`  [dry-run]  claude plugin uninstall ${PLUGIN_NAME}\n`);
    process.stdout.write(`  [dry-run]  claude plugin marketplace remove ${MARKETPLACE_NAME}\n`);
    return { ok: true };
  }

  const uninst = claudeCmd(['plugin', 'uninstall', PLUGIN_NAME]);
  if (!uninst.ok && !uninst.stderr.includes('not installed')) {
    process.stderr.write(`  Failed to uninstall plugin: ${uninst.stderr || uninst.stdout}\n`);
  } else {
    process.stdout.write(`  Plugin uninstalled.\n`);
  }

  const rmMkt = claudeCmd(['plugin', 'marketplace', 'remove', MARKETPLACE_NAME]);
  if (!rmMkt.ok && !rmMkt.stderr.includes('not found')) {
    process.stderr.write(`  Failed to remove marketplace: ${rmMkt.stderr || rmMkt.stdout}\n`);
  } else {
    process.stdout.write(`  Marketplace removed.\n`);
  }

  return { ok: true };
}

// ---------- Dispatch shim (~/.tonespeak/bin/dispatch) ----------
//
// Claude Code plugin command bodies support !`bash` inline preprocessing,
// which is the fast path (~1-2s).  But CLAUDE_PLUGIN_ROOT is NOT set in
// the preprocessing context (confirmed empirically against v2.1.148).
// The bash command also can't resolve the plugin's installed location
// from inside the body.  $HOME IS set, however.
//
// Workaround:  at install time, write a tiny bash shim at
// $HOME/.tonespeak/bin/dispatch that bakes in the absolute path to
// dispatch.js.  Command bodies then invoke the shim via:
//
//   !`bash "$HOME/.tonespeak/bin/dispatch" <family> $ARGUMENTS`
//
// This bypasses the CLAUDE_PLUGIN_ROOT gap and keeps the fast path.
// On uninstall, the shim is removed alongside the plugin.

function shimDir() {
  return process.env.TONESPEAK_BIN_DIR || join(resolveHome(), '.tonespeak', 'bin');
}

function shimPath() {
  return join(shimDir(), 'dispatch');
}

function dispatchAbsolutePath(repoRoot) {
  return join(repoRoot, 'src', 'cmd', 'dispatch.js');
}

export function buildShimContent(dispatchJsPath) {
  return [
    '#!/usr/bin/env bash',
    '# tonespeak dispatch shim -- auto-generated by bin/install.js.',
    '# Edit at your own risk;  reinstall the plugin to regenerate.',
    '',
    `exec node "${dispatchJsPath}" "$@"`,
    '',
  ].join('\n');
}

function writeDispatchShim(repoRoot) {
  const dir = shimDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o755 });
  const shim = shimPath();
  const content = buildShimContent(dispatchAbsolutePath(repoRoot));
  writeFileSync(shim, content, { mode: 0o755 });
  process.stdout.write(`  Dispatch shim:    ${shim}\n`);
  return shim;
}

function removeDispatchShim() {
  const shim = shimPath();
  if (existsSync(shim)) {
    rmSync(shim, { force: true });
    process.stdout.write(`  Dispatch shim removed: ${shim}\n`);
  }
  // Don't remove shimDir() itself -- the user may have other files there.
}

// ---------- Config file (~/.tonespeak/config.json) ----------

const DEFAULT_CONFIG = Object.freeze({
  default_mode: 'spacespeak',
  default_dialect: 'missioncontrol',
  default_lite: false,
  tone_cap: 0.12,
  statusline_enabled: true,
  telemetry_enabled: true,
  auto_activate: false,
});

const FAMILIES = {
  bardspeak: { default: 'tavern', valid: ['tavern', 'viking', 'dragonlance', 'dnd', 'tolkien'] },
  spacespeak: { default: 'missioncontrol', valid: ['missioncontrol', 'expanse', 'solarclipper', 'startrek', 'starwars', 'doctorwho', 'firefly', 'galactica', 'stargate'] },
  stylespeak: { default: 'noir', valid: ['cavespeak', 'noir', 'cyberpunk', 'steampunk', 'pirate', 'western', 'deadpan', 'renfaire', 'shakespearean'] },
};

function configDir() {
  return process.env.TONESPEAK_CONFIG_DIR || join(resolveHome(), '.tonespeak');
}

function configPath() {
  return join(configDir(), 'config.json');
}

function readExistingConfig() {
  if (!existsSync(configPath())) return null;
  try {
    return JSON.parse(readFileSync(configPath(), 'utf8'));
  } catch {
    return null;
  }
}

function writeConfig(cfg) {
  if (!existsSync(configDir())) mkdirSync(configDir(), { recursive: true, mode: 0o700 });
  writeFileSync(configPath(), JSON.stringify(cfg, null, 2) + '\n', { mode: 0o600 });
}

async function prompt(rl, question, defaultVal) {
  return new Promise(resolve => {
    rl.question(`${question} [${defaultVal}]: `, ans => {
      resolve((ans || '').trim() || String(defaultVal));
    });
  });
}

async function firstRunPrompts() {
  const existing = readExistingConfig();
  if (existing) {
    process.stdout.write(`Existing config found at ${configPath()};  keeping it.\n`);
    return existing;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  process.stdout.write('\nFirst-run setup.  Press Enter at each prompt to accept the default.\n\n');

  const mode = (await prompt(rl, 'Default mode (bardspeak / spacespeak / stylespeak)', DEFAULT_CONFIG.default_mode)).toLowerCase();
  const family = FAMILIES[mode] || FAMILIES[DEFAULT_CONFIG.default_mode];

  let dialect = family.default;
  if (family.valid.length > 1) {
    dialect = (await prompt(rl, `Default dialect for ${mode} (${family.valid.join(' / ')})`, family.default)).toLowerCase();
    if (!family.valid.includes(dialect)) dialect = family.default;
  }

  const lite = ((await prompt(rl, 'Lite by default (y/N)', 'n')).toLowerCase().startsWith('y'));
  const autoAct = ((await prompt(rl, 'Auto-activate on every Claude session (y/N)', 'n')).toLowerCase().startsWith('y'));
  const status = ((await prompt(rl, 'Statusline (Y/n)', 'y')).toLowerCase() !== 'n');

  rl.close();

  const cfg = {
    ...DEFAULT_CONFIG,
    default_mode: mode in FAMILIES ? mode : DEFAULT_CONFIG.default_mode,
    default_dialect: dialect,
    default_lite: lite,
    statusline_enabled: status,
    auto_activate: autoAct,
  };
  writeConfig(cfg);
  process.stdout.write(`\nWrote ${configPath()}\n`);
  return cfg;
}

function writeNonInteractiveConfig(opts) {
  const existing = readExistingConfig();
  if (existing && !opts.force) return existing;
  const cfg = { ...DEFAULT_CONFIG };
  if (opts.auto_activate !== undefined) cfg.auto_activate = opts.auto_activate;
  writeConfig(cfg);
  process.stdout.write(`Wrote default config to ${configPath()}\n`);
  return cfg;
}

// ---------- CLI argument parsing ----------

function parseArgs(argv) {
  const out = {
    list: false,
    dry_run: false,
    uninstall: false,
    purge: false,
    non_interactive: false,
    only: null,
    auto_activate: null,
    force: false,
    help: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--list') out.list = true;
    else if (a === '--dry-run') out.dry_run = true;
    else if (a === '--uninstall') out.uninstall = true;
    else if (a === '--purge') out.purge = true;
    else if (a === '--non-interactive') out.non_interactive = true;
    else if (a === '--force') out.force = true;
    else if (a === '--only') out.only = argv[++i];
    else if (a === '--auto-activate') out.auto_activate = argv[++i] === 'true';
  }
  return out;
}

function showHelp() {
  process.stdout.write(`tonespeak installer

USAGE
  npx tonespeak                       # interactive install for Claude Code
  node bin/install.js                 # same, from a local checkout
  node bin/install.js --uninstall     # remove the plugin (config kept)
  node bin/install.js --uninstall --purge   # also remove ~/.tonespeak/

OPTIONS
  --non-interactive          Use defaults, skip prompts
  --auto-activate true|false Set auto-activation explicitly (default: false)
  --only <id>                Install for one agent only (claude is the only
                             supported v0.1 target)
  --list                     List detected agents and exit
  --dry-run                  Print the plan, do not write anything
  --force                    Overwrite existing config in non-interactive mode
  --help, -h                 Show this message

SUPPORTED AGENTS
  claude (full plugin install)

PLANNED FOR LATER PHASES
  codex, cursor, windsurf, cline, aider, opencode, openclaw, copilot
  Detection works today;  per-agent install actions ship post-v0.1.
`);
}

// ---------- Main ----------

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) { showHelp(); process.exit(0); }

  // Detection list.
  const detected = PROVIDERS.map(p => ({ ...p, present: detect(p.detect) }));

  if (opts.list) {
    process.stdout.write('Tonespeak agent detection:\n');
    process.stdout.write('============================================\n');
    for (const p of detected) {
      const tag = p.present ? '[detected]' : '[absent]   ';
      const sup = p.supported ? '' : '  (install not yet supported)';
      process.stdout.write(`  ${tag}  ${p.id.padEnd(10)}  via ${p.install}${sup}\n`);
    }
    process.stdout.write('============================================\n');
    process.exit(0);
  }

  if (opts.uninstall) {
    const r = uninstallClaude({ dryRun: opts.dry_run });
    if (!opts.dry_run) {
      removeDispatchShim();
    } else {
      process.stdout.write(`  [dry-run]  rm ${shimPath()}\n`);
    }
    if (opts.purge && !opts.dry_run) {
      if (existsSync(configDir())) {
        rmSync(configDir(), { recursive: true, force: true });
        process.stdout.write(`Removed ${configDir()}\n`);
      }
    } else if (opts.purge && opts.dry_run) {
      process.stdout.write(`  [dry-run]  rm -rf ${configDir()}\n`);
    }
    process.exit(r.ok ? 0 : 1);
  }

  // Only install for claude in v0.1 unless --only forces something else.
  const onlyId = opts.only || 'claude';
  if (onlyId !== 'claude') {
    process.stderr.write(`Install for "${onlyId}" is not supported in v0.1.  Only "claude" works today.\n`);
    process.exit(2);
  }

  const claudeDetected = detected.find(p => p.id === 'claude');
  if (!claudeDetected.present) {
    process.stderr.write(`Claude CLI not found on PATH.  Install Claude Code first (https://claude.com/claude-code).\n`);
    process.exit(2);
  }

  // Plugin install.
  const inst = installClaude({ dryRun: opts.dry_run, repoRoot: REPO_ROOT });
  if (!inst.ok) {
    process.stderr.write(`Plugin install failed.  Try --dry-run to inspect the plan.\n`);
    process.exit(1);
  }

  // Dispatch shim.  See section comment for rationale.
  if (opts.dry_run) {
    process.stdout.write(`  [dry-run]  Write ${shimPath()}\n`);
  } else {
    writeDispatchShim(REPO_ROOT);
  }

  // Config.
  if (opts.dry_run) {
    process.stdout.write(`  [dry-run]  Write ${configPath()}\n`);
  } else if (opts.non_interactive) {
    writeNonInteractiveConfig({ ...opts, auto_activate: opts.auto_activate });
  } else {
    await firstRunPrompts();
  }

  process.stdout.write(`\nDone.  Tonespeak ready.\n`);
  if (!opts.dry_run) {
    process.stdout.write(`\nNext steps:\n`);
    process.stdout.write(`  - Open a new Claude Code session.\n`);
    process.stdout.write(`  - Type /tonespeak <dialect> (e.g. /tonespeak missioncontrol) to switch voice.\n`);
    process.stdout.write(`  - /normal to exit.  /tonespeak stats for telemetry.\n`);
    process.stdout.write(`  - To uninstall:  node bin/install.js --uninstall\n`);
  }
  process.exit(0);
}

main().catch(err => {
  process.stderr.write(`Install error: ${err.message}\n`);
  process.exit(1);
});
