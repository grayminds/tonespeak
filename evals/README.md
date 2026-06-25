# Tonespeak Eval Harness

Measures each dialect against the 15-prompt benchmark via the `claude` CLI.  No Anthropic SDK, no separate library;  the harness shells out to whatever `claude` you already have installed.

## TL;DR

```powershell
# Smoke test:  3 calls, ~30 sec, ~$0.10 on haiku
node evals/three-arm-eval.js --smoke --strict

# One dialect:  45 calls, ~5 min, ~$1
node evals/three-arm-eval.js --dialect spacespeak/missioncontrol --strict

# Full audit:  1080 calls (24 dialects x 15 prompts x 3 arms).
# Prefer --api:  one process, HTTP calls, ~30 min, no per-call process spawn.
node evals/three-arm-eval.js --all --api --max-budget-usd 5

# The --strict CLI path still works but spawns a claude.exe per call (~hours,
# and the process churn can stall the desktop on Windows -- see below).
node evals/three-arm-eval.js --all --strict --max-budget-usd 20

# Aggregate snapshots into a markdown table
node evals/report.js
```

**Use `--api` for full runs.**  It calls the Anthropic API directly instead of
spawning the `claude` CLI per call -- an order of magnitude faster and it does
not stall the machine.  Why the CLI path is slow, why parallelizing it makes it
worse, and why the API path is the fix:  see
[../docs/eval-performance.md](../docs/eval-performance.md).

## The auth situation (read this first)

For an honest measurement, the harness uses `claude --bare`.  Bare mode strips hooks, memory, CLAUDE.md, plugins, and auto-discovery -- which is exactly what you want for measuring a dialect, because otherwise every Arm A / Arm B / Arm C call inherits your CLAUDE.md instructions and the comparison is polluted.

**Bare mode requires `ANTHROPIC_API_KEY` in env.**  OAuth and keychain are NOT honored in bare mode.

Keep the key **project-scoped**, not system-wide.  The harness auto-loads a gitignored `.env.local` (then `.env`) from the repo root before it runs;  an already-set real environment variable takes precedence.

```powershell
# One-time:  generate an API key at https://console.anthropic.com/settings/keys
# Copy the template, then paste your key into .env.local in your editor:
Copy-Item .env.example .env.local
#   ANTHROPIC_API_KEY=sk-ant-...

# Verify (the harness loads .env.local automatically -- no $env: needed)
node evals/three-arm-eval.js --smoke --strict
```

`.env.local` is gitignored;  it is never committed and stays on this machine only.  Setting a shell-global `$env:ANTHROPIC_API_KEY` still works and overrides the file, but the file keeps the key with the project.

If you do NOT have an API key and run without `--strict`, the harness uses your Claude Code subscription auth (OAuth).  The measurement still runs but is polluted by your user-scope CLAUDE.md and memory.  Ratios remain *somewhat* meaningful (the pollution affects all three arms equally) but the absolute numbers are inflated and the dialect comparison loses precision.

Default behavior is `--strict` off because we can't assume the API key is set.  Pass `--strict` explicitly to get clean measurement.

## What it does

For each `(dialect, prompt)` pair the harness runs three arms:

| Arm | Invocation | What it measures |
|---|---|---|
| **A** | `claude -p --bare --model X "<prompt>"` | Plain Claude baseline. |
| **B** | `claude -p --bare --model X --system-prompt "Answer concisely." "<prompt>"` | "Be concise" baseline.  The honest comparator. |
| **C** | `claude -p --bare --model X --system-prompt "$(cat dialect.md)" "<prompt>"` | The dialect's measured behavior. |

For each call it captures:
- Response text
- Word-based token approximation (ratios are meaningful, absolute counts are not)
- Wall-clock latency
- For Arm C:  tone ratio via `evals/lint.js` and anti-pattern hits

Snapshot lands at `evals/snapshots/<family>-<dialect>.json`.

## Why "vs B" is the honest delta

Comparing Arm C to Arm A makes any dialect look great because "Be concise" alone saves 40-60 percent of tokens.  Reporting Arm-C-vs-Arm-A inflates the win by attributing the "be concise" effect to the dialect.

The fair comparison is **Arm C vs Arm B**:  what the dialect adds on top of just telling Claude to be brief.  If a dialect is at +5% vs B that means it saves an additional 5 percent over a plain "be concise" instruction.  If it is at -10% vs B that means it actually costs 10 percent more than just being concise (which is fine for flavor-mode dialects like `doctorwho` or `shakespearean`).

This is caveman's established convention and tonespeak follows it.

## Modes

| Mode | Calls | Time (haiku) | Cost (haiku) | Time (sonnet) | Cost (sonnet) |
|---|---:|---:|---:|---:|---:|
| `--smoke` | 3 | ~30s | ~$0.10 | ~30s | ~$0.30 |
| `--dialect <slug>` | 45 | ~5 min | ~$1 | ~10 min | ~$3 |
| `--dialect <slug> --prompt <id>` | 3 | ~30s | ~$0.10 | ~30s | ~$0.30 |
| `--all` | 675 | ~60 min | ~$5-10 | ~120 min | ~$15-30 |

Pin the model with `--model haiku` / `--model sonnet` / `--model opus`.  Default is `haiku` because it is fastest and cheapest;  swap to `sonnet` when you want measurements that match production use.

Set `--max-budget-usd <n>` as a safety cap to abort if accumulated cost would exceed.

## Workflow

1. **Author or refine a dialect** at `<family>/dialects/<dialect>.md`.
2. **Smoke-test:**  `node evals/three-arm-eval.js --smoke --strict --dialect <family>/<dialect>`.  Three calls, eyeball the snapshot.
3. **Run dialect-wide:**  `node evals/three-arm-eval.js --dialect <family>/<dialect> --strict`.  Snapshot lands at `evals/snapshots/<family>-<dialect>.json`.
4. **Read the summary** at the tail of the snapshot:  median reduction vs A, median reduction vs B, median tone ratio, tone-cap pass/fail, keyword coverage median.
5. **Iterate** on the dialect SKILL.md if metrics miss the targets in the dialect's frontmatter.
6. **Aggregate:**  `node evals/report.js` rolls all snapshots into a markdown table at `benchmarks/results/<date>.md`.

## What "tone ratio" means

`evals/lint.js` counts dialect-flavored tokens against total output tokens.  Flavored tokens = trope-marker occurrences + multi-word self-reference marker length + lexicon surplus + flourish-opener punctuation.

The lint loads its per-dialect config via `evals/dialect-config.js`, which extracts the lexicon, tropes, and self-reference markers directly from the dialect's SKILL.md.  No duplication;  the SKILL.md is the single source of truth.

If a dialect's median tone ratio exceeds its declared `tone_cap` in frontmatter, the snapshot summary reports `tone_pass: false` and the report flags it.  Either tighten the dialect or relabel it as flavor-only in its description.

## Keyword coverage

Each benchmark prompt declares `expected_keywords` in `benchmarks/prompts.json`.  The harness checks whether the dialect's response contains each keyword.  This is the basic correctness guard:  if the dialect's compression caused it to drop a load-bearing technical term, coverage drops and the dialect needs review.

Coverage threshold is informal at v0.1.  Spec target is >= 60 percent;  the report surfaces the median across the prompt set.

## Caveats

- **Word-based tokens are approximate.**  Real tokenization uses BPE;  our word count is a stand-in.  Ratios are meaningful;  absolute numbers are not.
- **Single run per (prompt, arm) at default temperature.**  No statistical significance.  Re-run a few times to spot variance if a number surprises you.
- **No cross-model verification.**  A dialect that hits its tone cap on haiku may behave differently on sonnet or opus.  Re-run with `--model sonnet` to spot the drift.
- **No fidelity check beyond keyword coverage.**  The eval does not verify that the dialect's response is technically correct in the same way a code review would.  Manual spot-check the snapshots for at least one or two prompts per dialect.
- **--bare disables hooks, MCP servers, and skills.**  If your dialect depends on a hook (the runtime activate.js path), `--bare` will not exercise that path.  The eval measures the SKILL.md content in isolation, which is what the dialect comparison wants.

## Files

- `evals/three-arm-eval.js` -- the harness.
- `evals/lint.js` -- tone-ratio measurement (called by the harness, also usable standalone via `node evals/lint.js <snapshot.json>`).
- `evals/dialect-config.js` -- extracts lint config from a dialect SKILL.md.
- `evals/report.js` -- aggregates snapshots into a markdown table.
- `evals/snapshots/` -- per-dialect snapshot JSON files (committed for traceability).
- `benchmarks/prompts.json` -- the 15 benchmark prompts in machine-readable form.
- `benchmarks/results/<date>.md` -- generated aggregate reports (committed when meaningful).
- `shared/BENCHMARK_PROMPTS.md` -- human-readable companion to `benchmarks/prompts.json`.

## Open known issue

When the harness runs without `--strict`, Michael's user-scope CLAUDE.md and memory load into every call.  The smoke-test snapshot at `evals/snapshots/spacespeak-ops.json` documents this:  Arm B's response was "I've loaded your context, voice contract, skills inventory" -- the model was responding to the auto-loaded session context, not to the actual user prompt.  This is precisely why `--bare` (via `--strict`) is required for a valid measurement, and why `ANTHROPIC_API_KEY` is required for `--bare`.
