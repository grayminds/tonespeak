# Installing tonespeak

This document covers the installer in detail:  every flag, what gets written where, idempotency, uninstall, and the cross-platform `$HOME` handling.  For the short path, see the Install section of [README.md](./README.md).

## What the installer is

`bin/install.js` is a plain Node script with zero dependencies.  It wires tonespeak into Claude Code as a plugin and writes the user config and dispatch shim.  It targets Claude Code only in v0.1.  Other agents (Codex, Cursor, Windsurf, Cline, Aider, OpenCode, OpenClaw, Copilot) are detected for reporting, but their per-agent install actions are not built yet.

## Prerequisites

- Node.js >= 18.  Tested on Node 24.
- The `claude` CLI on `PATH`.  The installer locates it with `where` (Windows) or `which` (POSIX) and refuses to run if it is absent.
- A clone of the repository:

```bash
git clone https://github.com/grayminds/tonespeak.git
cd tonespeak
```

## The default install

```bash
node bin/install.js
```

This performs four actions, in order.

### 1.  Detect Claude Code

If `claude` is not on `PATH`, the installer exits with code 2 and a pointer to https://claude.com/claude-code.

### 2.  Register the marketplace and install the plugin

It runs, in effect:

```bash
claude plugin marketplace add <repo-root>          # marketplace name: tonespeak-local
claude plugin install tonespeak@tonespeak-local
```

The installer is idempotent.  On a re-run it checks `claude plugin marketplace list` and `claude plugin list` first.  If the `tonespeak-local` marketplace is already registered, it updates it (`claude plugin marketplace update`) instead of adding it again.  If the plugin is already installed, it skips the install step.

The plugin definition lives in `.claude-plugin/plugin.json`.  It declares the commands directory (`./commands`) and two hooks:

- **SessionStart** runs `node "${CLAUDE_PLUGIN_ROOT}/src/hooks/activate.js"` to inject the active dialect on session start.
- **UserPromptSubmit** runs `node "${CLAUDE_PLUGIN_ROOT}/src/hooks/tracker.js"` to dispatch slash commands and reinforce the active dialect each turn.

### 3.  Write the dispatch shim

The installer writes `$HOME/.tonespeak/bin/dispatch` (mode 0755), a two-line bash script:

```bash
#!/usr/bin/env bash
exec node "<repo-root>/src/cmd/dispatch.js" "$@"
```

**Why the shim exists.**  Slash-command bodies use Claude Code's inline `` !`bash` `` preprocessing, which is the fast path.  In that preprocessing context, `${CLAUDE_PLUGIN_ROOT}` is not set (confirmed empirically against Claude Code v2.1.148), so a command body cannot find the plugin's installed location on its own.  `$HOME` is set, however.  The installer therefore bakes the absolute path to `src/cmd/dispatch.js` into a shim under `$HOME/.tonespeak/bin/`, and each command body invokes it as:

```
!`bash "$HOME/.tonespeak/bin/dispatch" <family> $ARGUMENTS`
```

If Claude Code later exposes `${CLAUDE_PLUGIN_ROOT}` in command preprocessing, the shim can be dropped.

### 4.  Write the config

On first run (no existing `config.json`), the installer prompts for:

- Default mode (`bardspeak` / `spacespeak` / `stylespeak`)
- Default dialect for that mode
- Lite by default (y/N)
- Auto-activate on every Claude session (y/N)
- Statusline (Y/n)

Press Enter to accept the bracketed default at each prompt.  It writes `$HOME/.tonespeak/config.json` (mode 0600).  If a config already exists, the installer reports that it is keeping it and skips the prompts.

## Flags

| Flag | Effect |
|---|---|
| (none) | Interactive install for Claude Code. |
| `--non-interactive` | Use defaults, skip all prompts.  Writes the default config unless one exists. |
| `--auto-activate true\|false` | Set `auto_activate` explicitly (default `false`). |
| `--force` | In non-interactive mode, overwrite an existing config instead of keeping it. |
| `--only <id>` | Install for one agent only.  `claude` is the only supported v0.1 target;  any other value exits with code 2. |
| `--list` | List detected agents and exit.  Writes nothing. |
| `--dry-run` | Print the full plan (marketplace add, plugin install, shim path, config path) and exit.  Writes nothing. |
| `--uninstall` | Remove the plugin, the marketplace, and the dispatch shim.  Keeps `config.json`. |
| `--uninstall --purge` | Also remove `$HOME/.tonespeak/` entirely. |
| `--help`, `-h` | Print usage and exit. |

`package.json` also exposes a convenience script:  `npm run install:dry` runs `node bin/install.js --dry-run --list`.

## Inspecting before you commit

```bash
node bin/install.js --list        # which agents are detected on this machine
node bin/install.js --dry-run     # the exact plan, no writes
```

## Uninstall

```bash
node bin/install.js --uninstall            # plugin + marketplace + shim;  config kept
node bin/install.js --uninstall --purge    # also delete ~/.tonespeak/
```

Uninstall tolerates a partially-installed state:  a missing plugin or marketplace is reported, not treated as a failure.  The shim file is removed, but the `$HOME/.tonespeak/bin/` directory is left in place in case you keep other files there.

## Where `$HOME` resolves

tonespeak's own data (`config.json`, `state.json`, `levels.json`, `sessions/`, and the dispatch shim) is rooted at `resolveHome()` from `src/lib/home.js`.  That helper honors the `HOME` environment variable when it is set and non-empty, and falls back to `os.homedir()` otherwise.

This matters on Windows.  Node's `os.homedir()` returns `%USERPROFILE%` and ignores `$HOME`, even when a user has deliberately set `$HOME` to a non-default location.  `resolveHome()` honors that `$HOME` first, so tonespeak's data lands where the user's other dotfiles live.  On POSIX hosts `os.homedir()` already follows `$HOME`, so behavior is unchanged.

Two environment variables override the data location directly for tests or non-standard setups:

- `TONESPEAK_CONFIG_DIR` - override the `.tonespeak` directory.
- `TONESPEAK_BIN_DIR` - override the shim directory.

Note:  Claude Code itself caches the installed plugin under `%USERPROFILE%\.claude\plugins\cache\tonespeak-local\tonespeak\<version>\`, using `%USERPROFILE%` regardless of `$HOME`.  That is Claude Code's own path, not tonespeak's.
