# tonespeak

Multi-persona skill family for Claude Code and sibling agents.  It gives output a distinct voice (the tone) under a strict per-dialect tone budget, and trims length against default, unprompted output -- a median around 22 percent, up to about 63 percent for the leanest dialect.  Measured against an aggressive "be concise" instruction, most dialects run longer:  they spend that budget on character, so the trade is voice, not raw brevity.  The exception is `laconic`, the economy register, which holds about even with a bare concise instruction while keeping a persistent voice.  Honest per-dialect figures are in `benchmarks/results/`;  how to read them, in [docs/eval-performance.md](docs/eval-performance.md).

It ships as a Claude Code plugin:  two hooks plus a set of slash commands.  The architecture is pure-skill.  The model reads and applies the active dialect's SKILL.md rules itself;  there is no string-transforming runtime middleware.  This follows the approach of [`JuliusBrussee/caveman`](https://github.com/JuliusBrussee/caveman), a clean-room reimplementation with multi-dialect extension.  MIT licensed, same as caveman.

**Status:**  pre-release (v0.1).  Published on GitHub at `github.com/grayminds/tonespeak`;  primary development is mirrored from a private Gitea remote.  Treat the API as unstable until v1.0.

## Concept

Three persona families.  One umbrella tool.  Strict genre separation.

| Family | Default dialect | All dialects |
|---|---|---|
| bardspeak | tavern | tavern, viking, dnd, dragonlance, tolkien |
| spacespeak | missioncontrol | missioncontrol, solarclipper, expanse, firefly, startrek, starwars, doctorwho, galactica, stargate |
| stylespeak | noir | cavespeak, noir, cyberpunk, steampunk, pirate, western, deadpan, renfaire, shakespearean, laconic |

Twenty-four dialects total.  Each is a self-contained SKILL.md at `<family>/dialects/<dialect>.md`.  A dialect is a style or register, not a proper-noun lookup table.  The SessionStart hook injects the active dialect, and the UserPromptSubmit hook reinforces it each turn so the voice does not drift back to verbose after context compaction.

To pick a dialect by feel, each family has a voice-sample sheet -- a one-line description and a real sample of every dialect answering the same prompt, with its honest metrics:  [bardspeak](bardspeak/EXAMPLES.md), [spacespeak](spacespeak/EXAMPLES.md), [stylespeak](stylespeak/EXAMPLES.md).

## Prerequisites

- **Node.js >= 18** (declared in `package.json` engines).  Tested on Node 24.
- **Claude Code** installed and on `PATH` (the `claude` CLI).  The installer drives `claude plugin` subcommands, so it fails fast if `claude` is not found.  Get it at https://claude.com/claude-code.
- **git**, to clone the repository.
- **Zero runtime dependencies.**  `package.json` declares no `dependencies` or `devDependencies`;  everything runs on the Node standard library.

## Install on a new machine

Clone from the Gitea origin (the real source of truth for this project):

```bash
git clone https://github.com/grayminds/tonespeak.git
cd tonespeak
node bin/install.js
```

That runs the interactive installer.  Step by step, it:

1.  Detects the `claude` CLI on `PATH`.  If it is missing, it exits with a message to install Claude Code first.  Claude Code is the only supported install target in v0.1;  Codex, Cursor, Windsurf, Cline, Aider, OpenCode, OpenClaw, and Copilot are detected for reporting but have no install action yet.
2.  Registers a local single-plugin marketplace named `tonespeak-local` pointing at the repo root (`claude plugin marketplace add <repo>`), then installs the `tonespeak` plugin from it (`claude plugin install tonespeak@tonespeak-local`).  Re-running updates the marketplace and skips steps already done, so the installer is idempotent.
3.  Writes a dispatch shim at `$HOME/.tonespeak/bin/dispatch`.  This is a tiny bash script with the absolute path to `src/cmd/dispatch.js` baked in.  Slash-command bodies call it because `${CLAUDE_PLUGIN_ROOT}` is not exposed in plugin command preprocessing context;  `$HOME` is.  See INSTALL.md for the full rationale.
4.  Prompts for first-run config and writes `$HOME/.tonespeak/config.json` (default mode, default dialect, lite default, auto-activate, statusline).  Press Enter at each prompt to accept the default.  If a config already exists, it is kept untouched.

Once the plugin is installed, open a new Claude Code session.  Claude Code loads the SessionStart and UserPromptSubmit hooks and registers the slash commands from `commands/`.  No further wiring is needed.

For the non-interactive form, available flags (including `--dry-run`, `--list`, and `--uninstall`), and `$HOME` resolution details, see **[INSTALL.md](./INSTALL.md)**.

## Usage

Switch voice with a slash command inside a Claude Code session.  The voice applies from the next response.

| Command | Effect |
|---|---|
| `/bardspeak [dialect] [lite]` | Activate a bardspeak dialect.  No dialect uses the default, `tavern`. |
| `/spacespeak [dialect] [lite]` | Activate a spacespeak dialect.  Default `missioncontrol`. |
| `/stylespeak [dialect] [lite]` | Activate a stylespeak dialect.  Default `noir`. |
| `/cavespeak [lite]` | Convenience alias for `/stylespeak cavespeak`. |
| `/tonespeak <dialect> [lite]` | Activate any dialect by name;  the family is resolved automatically (dialect names are unique across families). |
| `/tonespeak stats` | Token-savings telemetry.  Stub in v0.1 (Phase 7 not yet built). |
| `/tonespeak park` | Save the active dialect and drop to plain prose. |
| `/tonespeak resume` | Restore the parked dialect. |
| `/tonespeak` | With no argument, print the trigger help. |
| `/normal` | Drop the active dialect.  Subsequent responses are plain prose. |

Append `lite` to any activation to apply the lite preset, which turns trope frequency and self-reference off for a lighter touch (e.g. `/spacespeak expanse lite`).

Examples:

```
/spacespeak missioncontrol     # Apollo mission control voice
/tonespeak noir                # stylespeak/noir, family auto-resolved
/bardspeak viking lite         # viking voice, lite preset
/normal                        # back to plain prose
```

## Configuration

User preferences live at `$HOME/.tonespeak/config.json`, written by the installer.  Defaults:

| Key | Default | Meaning |
|---|---|---|
| `default_mode` | `spacespeak` | Family used when auto-activate is on. |
| `default_dialect` | `missioncontrol` | Dialect within the default family. |
| `default_lite` | `false` | Apply the lite preset by default. |
| `tone_cap` | `0.12` | Global tone-ratio budget (per-dialect frontmatter can declare its own). |
| `statusline_enabled` | `true` | Show the tonespeak statusline segment. |
| `telemetry_enabled` | `true` | Allow token-savings telemetry collection. |
| `auto_activate` | `false` | Activate the default dialect on every session, no slash command needed. |

Two sibling files in the same directory:

- `$HOME/.tonespeak/state.json` - mutable session state (active dialect, parked dialect).  Managed by the hooks;  do not hand-edit.
- `$HOME/.tonespeak/levels.json` - optional per-axis tone overrides and custom presets.  Each dialect declares tunable axes (compression intensity, lexicon rate, trope frequency, self-reference, cadence, tone cap) in its SKILL.md frontmatter;  `levels.json` overrides those per dialect or defines named presets.  The merge order is dialect defaults, then `levels.json`, then preset (e.g. `lite`).

To turn on auto-activation after install without re-running the prompts, set `"auto_activate": true` in `config.json`, or run `node bin/install.js --non-interactive --auto-activate true --force`.

## Uninstall

The installer removes everything it wrote:

```bash
node bin/install.js --uninstall            # uninstall plugin, remove marketplace and shim;  keep config
node bin/install.js --uninstall --purge    # also remove ~/.tonespeak/ entirely
```

`--uninstall` runs `claude plugin uninstall tonespeak`, removes the `tonespeak-local` marketplace, and deletes the dispatch shim.  It leaves `config.json` in place unless you add `--purge`.

## Running the evals

The eval harness measures each dialect against a 15-prompt benchmark by shelling out to the `claude` CLI.  Quick smoke test:

```bash
node evals/three-arm-eval.js --smoke --strict
```

For a valid measurement you need `--strict` (which runs `claude --bare`, stripping hooks, memory, CLAUDE.md, and plugins so the comparison is not polluted) and an Anthropic API key, because bare mode does not honor OAuth or keychain auth.  Keep the key project-scoped:  copy the template and paste your key in.

```bash
cp .env.example .env.local
# edit .env.local:  ANTHROPIC_API_KEY=sk-ant-...
```

`.env.local` is gitignored;  the harness loads it automatically.  Full harness usage, the three-arm methodology, cost and time tables, and the aggregation step (`node evals/report.js`) are documented in **[evals/README.md](./evals/README.md)**.

## Development

Run the tests:

```bash
npm test
```

The `test` script runs `node --test "tests/*.test.js"`.  The quoted glob matters:  the bare `node --test tests/` form fails on Node 24, so invoke the suite through `npm test` (or the quoted glob directly), not `node --test tests/`.  As of this writing, 152 tests pass and 1 is skipped (POSIX-only).

Repository layout:

| Path | What |
|---|---|
| `bardspeak/`, `spacespeak/`, `stylespeak/` | The three families.  Dialects live in `<family>/dialects/<dialect>.md`;  shared lexicon, cadence, and protocol files sit alongside. |
| `shared/` | Cross-family material:  compression core, tone budget, anti-patterns, preservation rules, the authoring guide, benchmark prompts. |
| `src/lib/` | `loader.js` (YAML frontmatter, axis merge, preset application), `config.js`, `home.js` ($HOME resolution), `flag.js` (state.json read/write). |
| `src/hooks/` | `activate.js` (SessionStart), `tracker.js` (UserPromptSubmit;  holds the authoritative `FAMILY_DIALECTS` roster and slash-command dispatch). |
| `src/cmd/dispatch.js` | Bridge from a slash-command body into `tracker.js` `dispatchTrigger()`. |
| `commands/` | The six slash-command markdown files (bardspeak, spacespeak, stylespeak, cavespeak, normal, tonespeak). |
| `bin/install.js` | The plugin installer. |
| `tests/` | `node --test` suite. |
| `evals/`, `benchmarks/` | The eval harness and the 15-prompt benchmark set. |
| `.claude-plugin/` | `plugin.json` (hooks, commands dir) and `marketplace.json` (the local marketplace declaration). |

## Forward compatibility

Each dialect declares its tunable axes in SKILL.md frontmatter, and user overrides live in `$HOME/.tonespeak/levels.json`.  A planned `tonespeak-studio` web UI would let users adjust axis points on a radar chart and preview the rendered tone live.  v0.1 ships the data plumbing;  the studio is reserved for a later release.

## Contributing

Pull requests are welcome.  See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup,
the LF line-ending rule, and how to add or change a dialect.  Security reports go
to the address in [SECURITY.md](./SECURITY.md).  Notable changes are tracked in
[CHANGELOG.md](./CHANGELOG.md).

## License

MIT.  See [LICENSE](./LICENSE).
