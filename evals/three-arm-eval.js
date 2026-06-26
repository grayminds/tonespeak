#!/usr/bin/env node
// tonespeak/evals/three-arm-eval.js
//
// Three-arm evaluation harness for tonespeak dialects.
//
// For each (dialect, prompt) pair, runs three arms via the `claude` CLI:
//   - Arm A:  plain Claude (no system prompt).
//   - Arm B:  Claude + "Answer concisely." system prompt.
//   - Arm C:  Claude + the dialect's full SKILL.md as system prompt.
//
// Measures:  output token count (word-based approximation), per-arm latency,
// tone ratio of Arm C via evals/lint.js, and reduction vs Arms A and B.
//
// Output:  evals/snapshots/<family>-<dialect>.json with all responses and metrics.
//
// CLI:
//   node evals/three-arm-eval.js --smoke                       # 1 dialect, 1 prompt, 3 calls
//   node evals/three-arm-eval.js --dialect spacespeak/missioncontrol  # 1 dialect, all 15 prompts
//   node evals/three-arm-eval.js --dialect spacespeak/missioncontrol --prompt vlan-trunk
//   node evals/three-arm-eval.js --all                         # 24 dialects x 15 prompts (1080 calls)
//   node evals/three-arm-eval.js --all --max-budget-usd 5      # safety cap
//
// Default model:  haiku (fastest, cheapest for benchmarking).  Override with --model.
//
// Auth: by default uses your existing Claude Code subscription (OAuth/keychain).
// Pass --strict to add `--bare` for clean measurement (strips hooks, memory,
// CLAUDE.md, plugins) -- BUT --bare requires ANTHROPIC_API_KEY in env (OAuth is
// not honored in bare mode).  Without --strict the measurement is honest as
// long as ratios are what you care about (all three arms see the same
// CLAUDE.md / memory inflation, so the reduction percentages remain meaningful).

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { extractDialectConfig, listAllDialects } from './dialect-config.js';
import { loadDialect } from '../src/lib/loader.js';
import { lintResponse } from './lint.js';

// Resolve the claude binary once.  On Windows the `claude` name is a .cmd shim;
// `spawnSync` with shell:false needs the full path.  Falls back to bare name on POSIX.
function resolveClaude() {
  const isWin = process.platform === 'win32';
  const finder = isWin ? 'where' : 'which';
  const r = spawnSync(finder, ['claude'], { encoding: 'utf8', shell: false });
  if (r.status === 0 && r.stdout.trim()) {
    return r.stdout.split(/\r?\n/)[0].trim();
  }
  return 'claude';
}
const CLAUDE_BIN = resolveClaude();

// Run every claude call from an empty sandbox directory, never the repo root.
// Otherwise the CLI surfaces the working dir and git history to the model, and
// the bare arm "notices" it is inside the tonespeak project and answers "I'm
// confused" instead of doing the prompt -- contaminating the measurement (and
// leaking absolute paths into snapshots).  An empty cwd gives a clean room.
const EVAL_SANDBOX = join(tmpdir(), 'tonespeak-eval-sandbox');
mkdirSync(EVAL_SANDBOX, { recursive: true });

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const SNAPSHOTS_DIR = join(REPO_ROOT, 'evals', 'snapshots');
const PROMPTS_PATH = join(REPO_ROOT, 'benchmarks', 'prompts.json');

// ---------- Project-scoped env loading ----------
//
// Load ANTHROPIC_API_KEY (and any other vars) from a gitignored `.env.local`
// or `.env` at the repo root, so the key lives WITH the project instead of in
// a system-wide / shell-global environment variable.  An already-set real
// environment variable always wins;  the file only fills what is unset.
// No dependency -- a minimal KEY=VALUE parser is enough for this.
function loadProjectEnv() {
  for (const name of ['.env.local', '.env']) {
    const path = join(REPO_ROOT, name);
    if (!existsSync(path)) continue;
    for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (key && !(key in process.env)) process.env[key] = val;
    }
  }
}

loadProjectEnv();

const DEFAULT_MODEL = 'haiku';
const DEFAULT_TIMEOUT_MS = 180_000;

// ---------- Budget circuit breaker ----------
//
// Approximate USD pricing per 1M tokens (input, output).  This is a circuit
// breaker, not a billing meter:  token counts are word-based approximations and
// COST_FUDGE pads them toward stopping early so the real bill stays under the
// declared --max-budget-usd cap.
const PRICING = {
  haiku:  { in: 1, out: 5 },
  sonnet: { in: 3, out: 15 },
  opus:   { in: 5, out: 25 },
};
const COST_FUDGE = 1.5;  // word-approx tokens -> real tokens, padded to stop early

function priceFor(model) {
  const m = String(model).toLowerCase();
  if (m.includes('haiku')) return PRICING.haiku;
  if (m.includes('sonnet')) return PRICING.sonnet;
  if (m.includes('opus')) return PRICING.opus;
  return PRICING.opus;  // unknown model -> assume the most expensive, so the cap stays conservative
}

let spentUsd = 0;

function recordCost(model, inputTokens, outputTokens) {
  const p = priceFor(model);
  spentUsd += COST_FUDGE * ((inputTokens * p.in) + (outputTokens * p.out)) / 1e6;
}

class BudgetError extends Error {
  constructor(cap) {
    super(`budget cap reached:  ~$${spentUsd.toFixed(2)} estimated >= $${Number(cap).toFixed(2)} cap`);
    this.name = 'BudgetError';
  }
}

// ---------- CLI parsing ----------

function parseArgs(argv) {
  const out = {
    smoke: false,
    all: false,
    dialect: null,
    prompt: null,
    model: DEFAULT_MODEL,
    strict: false,
    max_budget_usd: null,
    out_dir: SNAPSHOTS_DIR,
    timeout_ms: DEFAULT_TIMEOUT_MS,
    dry_run: false,
    api: false,
    help: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--smoke') out.smoke = true;
    else if (a === '--all') out.all = true;
    else if (a === '--strict') out.strict = true;
    else if (a === '--dry-run') out.dry_run = true;
    else if (a === '--dialect') out.dialect = argv[++i];
    else if (a === '--prompt') out.prompt = argv[++i];
    else if (a === '--model') out.model = argv[++i];
    else if (a === '--out-dir') out.out_dir = argv[++i];
    else if (a === '--timeout') out.timeout_ms = parseInt(argv[++i], 10);
    else if (a === '--max-budget-usd') out.max_budget_usd = parseFloat(argv[++i]);
    else if (a === '--api') out.api = true;
  }
  return out;
}

function showHelp() {
  process.stdout.write(`tonespeak three-arm eval harness

USAGE
  node evals/three-arm-eval.js [options]

MODES
  --smoke                Run 1 dialect x 1 prompt x 3 arms (~30s, ~$0.10 on haiku)
  --all                  Run all dialects x all prompts (1080 calls, ~95min, ~$3-15)
  --dialect <slug>       Run one dialect against all prompts (~5min, ~$1)
  --prompt <id>          Limit to one prompt id (combine with --dialect or --all)

OPTIONS
  --model <name>         Model alias (haiku|sonnet|opus) or full id.  Default haiku.
  --strict               Add --bare to the claude calls.  Strips hooks, memory,
                         CLAUDE.md, plugins.  REQUIRES ANTHROPIC_API_KEY in env
                         (OAuth/keychain is not honored in bare mode).  Without
                         --strict the eval uses your Claude Code subscription and
                         accepts that CLAUDE.md / memory affects all three arms
                         equally (ratios remain meaningful).
  --api                  Call the Anthropic API directly over HTTP instead of
                         spawning the claude CLI per call.  One long-lived
                         process, the three arms fire concurrently, ~10x faster,
                         and no per-call process spawn (no Windows process-churn
                         /AV-scan stalls, no cwd to leak).  Requires
                         ANTHROPIC_API_KEY.  Equivalent measurement to --strict.
  --max-budget-usd <n>   Hard stop once estimated spend reaches this.  Approximate
                         (word-based token counts, padded to stop early);  a
                         circuit breaker, not an exact bill.  Completed dialect
                         snapshots are saved before stopping.
  --out-dir <path>       Snapshot output directory.  Default evals/snapshots/.
  --timeout <ms>         Per-call timeout.  Default 180000.  Calls retry once on
                         timeout or error before the arm is recorded as failed.
  --dry-run              Print the call plan without running.
  --help, -h             Show this message.

EXAMPLES
  node evals/three-arm-eval.js --smoke
  node evals/three-arm-eval.js --dialect spacespeak/missioncontrol
  node evals/three-arm-eval.js --dialect spacespeak/missioncontrol --prompt vlan-trunk
  node evals/three-arm-eval.js --all --model sonnet --max-budget-usd 10
`);
}

// ---------- Token counting (word-based approximation) ----------

const WORD_RE = /[A-Za-z][A-Za-z0-9'-]*/g;

function countTokens(text) {
  // Word-based approximation.  Strips fenced code from the count of the
  // "tone-flavored" portion via the lint module, but here we count the full
  // response.  Document this as approximate;  ratios are meaningful.
  const matches = text.match(WORD_RE) || [];
  return matches.length;
}

// ---------- Claude CLI invocation ----------

function callClaude({ prompt, systemPrompt, model, strict, timeoutMs, retries = 1 }) {
  const args = ['--print', '--model', model, '--no-session-persistence'];
  if (strict) args.push('--bare');
  if (systemPrompt) args.push('--system-prompt', systemPrompt);
  args.push(prompt);

  // The bare CLI occasionally hangs (telemetry / update check / transient
  // network) and trips the spawnSync timeout.  Retry once on error or non-zero
  // exit before giving up, so a single hang does not drop an arm.
  const t0 = Date.now();
  let result;
  let attempt = 0;
  while (true) {
    result = spawnSync(CLAUDE_BIN, args, {
      encoding: 'utf8',
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: EVAL_SANDBOX,  // isolate from the repo so the model sees no project context
    });
    const failed = result.error || result.status !== 0;
    if (!failed || attempt >= retries) break;
    attempt++;
  }
  const ms = Date.now() - t0;
  const attempts = attempt + 1;

  if (result.error) {
    return { ok: false, error: result.error.message, ms, attempts };
  }
  if (result.status !== 0) {
    return {
      ok: false,
      error: `exit ${result.status}: ${(result.stderr || '').trim() || '(no stderr)'}`,
      ms,
      stderr: result.stderr,
      attempts,
    };
  }
  return { ok: true, text: result.stdout, ms, attempts };
}

// ---------- Direct Anthropic API invocation (--api) ----------
//
// The CLI path spawns a fresh `claude.exe` per call -- ~1080 heavy process
// launches for a full run, which on Windows queues at the serialized
// process-creation path and a Defender scan apiece (system-wide UI stalls).
// A direct API call needs no process:  one long-lived Node process makes HTTP
// requests, so calls concurrency at the network layer (not the process gate),
// runs an order of magnitude faster, and has no working directory to leak
// (the bare CLI's cwd-contamination problem disappears).  `--bare` is just a
// thin wrapper over a no-system-prompt API call, so the measurement is
// equivalent;  all three arms use the same substrate, so the reduction ratios
// stay valid.
const API_MODEL_IDS = {
  haiku:  'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-6',
  opus:   'claude-opus-4-8',
};
function apiModelId(model) {
  const m = String(model).toLowerCase();
  if (API_MODEL_IDS[m]) return API_MODEL_IDS[m];
  if (m.includes('haiku')) return API_MODEL_IDS.haiku;
  if (m.includes('sonnet')) return API_MODEL_IDS.sonnet;
  if (m.includes('opus')) return API_MODEL_IDS.opus;
  return model;  // assume a full model id was passed
}

async function callViaApi({ prompt, systemPrompt, model, timeoutMs, retries = 2 }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, error: 'ANTHROPIC_API_KEY not set (see .env.local)', ms: 0, attempts: 0 };

  const body = { model: apiModelId(model), max_tokens: 4096, messages: [{ role: 'user', content: prompt }] };
  if (systemPrompt) body.system = systemPrompt;

  const t0 = Date.now();
  let attempt = 0;
  let lastErr = '';
  while (attempt <= retries) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (res.status === 429 || res.status >= 500) {
        lastErr = `HTTP ${res.status}`;
        attempt++;
        if (attempt > retries) break;
        await new Promise(r => setTimeout(r, 1500 * attempt));  // backoff on rate limit / overload
        continue;
      }
      if (!res.ok) {
        const t = await res.text();
        return { ok: false, error: `HTTP ${res.status}: ${t.slice(0, 200)}`, ms: Date.now() - t0, attempts: attempt + 1 };
      }
      const data = await res.json();
      const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
      return { ok: true, text, ms: Date.now() - t0, attempts: attempt + 1 };
    } catch (e) {
      clearTimeout(timer);
      lastErr = e.name === 'AbortError' ? `timeout ${timeoutMs}ms` : e.message;
      attempt++;
      if (attempt > retries) break;
      await new Promise(r => setTimeout(r, 1500 * attempt));
    }
  }
  return { ok: false, error: lastErr, ms: Date.now() - t0, attempts: attempt };
}

// Route a single arm to the API (async, no process) or the CLI (sync spawn).
async function callArm(opts, useApi) {
  return useApi ? await callViaApi(opts) : callClaude(opts);
}

// ---------- Three-arm runner ----------

async function runArms({ promptEntry, dialectSkill, skillTokens, model, strict, timeoutMs, maxBudgetUsd, useApi }) {
  const result = { prompt_id: promptEntry.id, prompt: promptEntry.prompt, arms: {} };
  const promptTokens = countTokens(promptEntry.prompt);

  // Stop before a prompt that would run past the cap.  In API mode the three
  // arms fire concurrently, so the overshoot is at most one prompt (three
  // calls);  in CLI mode callArm is sync, so the arms still run sequentially.
  if (maxBudgetUsd && spentUsd >= maxBudgetUsd) throw new BudgetError(maxBudgetUsd);

  const [a, b, c] = await Promise.all([
    callArm({ prompt: promptEntry.prompt, systemPrompt: null, model, strict, timeoutMs }, useApi),
    callArm({ prompt: promptEntry.prompt, systemPrompt: 'Answer concisely.', model, strict, timeoutMs }, useApi),
    callArm({ prompt: promptEntry.prompt, systemPrompt: dialectSkill, model, strict, timeoutMs }, useApi),
  ]);

  result.arms.a = { ...a, tokens: a.ok ? countTokens(a.text) : null };
  result.arms.b = { ...b, tokens: b.ok ? countTokens(b.text) : null };
  result.arms.c = { ...c, tokens: c.ok ? countTokens(c.text) : null };
  if (a.ok) recordCost(model, promptTokens, result.arms.a.tokens);
  if (b.ok) recordCost(model, promptTokens + 2, result.arms.b.tokens);
  if (c.ok) recordCost(model, promptTokens + skillTokens, result.arms.c.tokens);

  // Metrics.
  if (a.ok && b.ok && c.ok) {
    result.reduction_vs_a = (result.arms.a.tokens - result.arms.c.tokens) / result.arms.a.tokens;
    result.reduction_vs_b = (result.arms.b.tokens - result.arms.c.tokens) / result.arms.b.tokens;
    result.keyword_coverage = computeKeywordCoverage(c.text, promptEntry.expected_keywords);
  }

  return result;
}

function computeKeywordCoverage(text, keywords) {
  if (!keywords || keywords.length === 0) return null;
  const lower = text.toLowerCase();
  const hits = keywords.filter(k => lower.includes(k.toLowerCase()));
  return { hits: hits.length, total: keywords.length, ratio: hits.length / keywords.length, missed: keywords.filter(k => !hits.includes(k)) };
}

// ---------- Per-dialect runner ----------

async function runDialect({ family, dialect, prompts, model, strict, timeoutMs, dryRun, maxBudgetUsd, useApi }) {
  const dialectConfig = extractDialectConfig(family, dialect, { root: REPO_ROOT });
  const loaded = loadDialect(family, dialect, { root: REPO_ROOT });
  const dialectSkill = loaded.skill;

  const snapshot = {
    dialect: `${family}/${dialect}`,
    model,
    strict,
    timestamp: new Date().toISOString(),
    declared_tone_cap: dialectConfig.tone_cap,
    skill_token_count: countTokens(dialectSkill),
    responses: [],
    summary: {},
  };

  process.stderr.write(`\n[${family}/${dialect}]  ${prompts.length} prompt(s),  3 arms each\n`);
  process.stderr.write(`  dialect SKILL.md: ${snapshot.skill_token_count} tokens (approximate)\n`);

  if (dryRun) {
    snapshot.responses = prompts.map(p => ({ prompt_id: p.id, dry_run: true }));
    return snapshot;
  }

  for (const promptEntry of prompts) {
    process.stderr.write(`  ${promptEntry.id} ... `);
    let r;
    try {
      r = await runArms({
        promptEntry, dialectSkill,
        skillTokens: snapshot.skill_token_count,
        model, strict, timeoutMs, maxBudgetUsd, useApi,
      });
    } catch (err) {
      if (err instanceof BudgetError) {
        // Preserve the prompts completed so far on this dialect, then stop.
        process.stderr.write('budget reached\n');
        snapshot.summary = summarizeSnapshot(snapshot);
        err.partialSnapshot = snapshot;
      }
      throw err;
    }
    if (r.arms.c && r.arms.c.ok) {
      const lint = lintResponse(r.arms.c.text, dialectConfig);
      r.tone_ratio = lint.tone_ratio;
      r.tone_pass = lint.tone_pass;
      r.lint_fails = lint.fails;
      r.lint_warns = lint.warns;
      r.anti_patterns = lint.anti_patterns;
    }
    snapshot.responses.push(r);

    if (r.arms.a.ok && r.arms.b.ok && r.arms.c.ok) {
      process.stderr.write(
        `A=${r.arms.a.tokens}t  B=${r.arms.b.tokens}t  C=${r.arms.c.tokens}t  ` +
        `(${(r.reduction_vs_b * 100).toFixed(0)}% vs B,  tone=${(r.tone_ratio * 100).toFixed(0)}%)\n`
      );
    } else {
      const failing = ['a', 'b', 'c'].filter(arm => !r.arms[arm].ok);
      process.stderr.write(`FAILED arms: ${failing.join(',')}\n`);
      for (const arm of failing) {
        process.stderr.write(`    ${arm}: ${r.arms[arm].error}\n`);
      }
    }
  }

  snapshot.summary = summarizeSnapshot(snapshot);
  return snapshot;
}

function summarizeSnapshot(snapshot) {
  const ok = snapshot.responses.filter(r => r.reduction_vs_b !== undefined);
  if (ok.length === 0) return { ok_count: 0 };

  const reductions_a = ok.map(r => r.reduction_vs_a).sort((x, y) => x - y);
  const reductions_b = ok.map(r => r.reduction_vs_b).sort((x, y) => x - y);
  const tones = ok.map(r => r.tone_ratio).sort((x, y) => x - y);
  const med = arr => arr.length % 2 ? arr[(arr.length - 1) / 2]
                                    : (arr[arr.length / 2 - 1] + arr[arr.length / 2]) / 2;

  const tone_cap = snapshot.declared_tone_cap;
  const tone_median = med(tones);

  return {
    ok_count: ok.length,
    failed_count: snapshot.responses.length - ok.length,
    reduction_vs_a_median: med(reductions_a),
    reduction_vs_b_median: med(reductions_b),
    tone_ratio_median: tone_median,
    tone_cap_declared: tone_cap,
    tone_pass: tone_median <= tone_cap,
    keyword_coverage_median: med(ok.map(r => (r.keyword_coverage && r.keyword_coverage.ratio) || 0)),
  };
}

// ---------- Snapshot persistence ----------

function snapshotPath(family, dialect, outDir) {
  return join(outDir, `${family}-${dialect}.json`);
}

function writeSnapshot(snapshot, outDir) {
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const path = snapshotPath(snapshot.dialect.split('/')[0], snapshot.dialect.split('/')[1], outDir);
  writeFileSync(path, JSON.stringify(snapshot, null, 2) + '\n');
  return path;
}

// ---------- Main ----------

function loadPrompts() {
  const raw = JSON.parse(readFileSync(PROMPTS_PATH, 'utf8'));
  return raw.prompts;
}

function selectTargets(opts) {
  const allDialects = listAllDialects();
  const allPrompts = loadPrompts();

  if (opts.smoke) {
    return {
      targets: [{ family: 'spacespeak', dialect: 'missioncontrol' }],
      prompts: [allPrompts.find(p => p.id === 'vlan-trunk')],
    };
  }

  let targets = allDialects;
  if (opts.dialect) {
    const [family, dialect] = opts.dialect.split('/');
    targets = allDialects.filter(d => d.family === family && d.dialect === dialect);
    if (targets.length === 0) {
      throw new Error(`unknown dialect: ${opts.dialect}.  Valid: ${allDialects.map(d => `${d.family}/${d.dialect}`).join(', ')}`);
    }
  } else if (!opts.all) {
    // Default behavior:  show help and exit.
    return null;
  }

  let prompts = allPrompts;
  if (opts.prompt) {
    prompts = allPrompts.filter(p => p.id === opts.prompt);
    if (prompts.length === 0) {
      throw new Error(`unknown prompt id: ${opts.prompt}.  Valid: ${allPrompts.map(p => p.id).join(', ')}`);
    }
  }

  return { targets, prompts };
}

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) { showHelp(); process.exit(0); }

  const sel = selectTargets(opts);
  if (!sel) { showHelp(); process.exit(2); }

  const totalCalls = sel.targets.length * sel.prompts.length * 3;
  process.stderr.write(`Plan:  ${sel.targets.length} dialect(s) x ${sel.prompts.length} prompt(s) x 3 arms = ${totalCalls} calls\n`);
  process.stderr.write(`Mode:  ${opts.api ? 'API (direct HTTP, no process spawn, arms concurrent)' : 'CLI (spawn claude per call)'}\n`);
  process.stderr.write(`Model:  ${opts.model}  strict:  ${opts.strict}  timeout:  ${opts.timeout_ms}ms` +
    `${opts.max_budget_usd ? `  budget cap:  $${Number(opts.max_budget_usd).toFixed(2)}` : ''}\n`);

  if (opts.dry_run) {
    process.stderr.write(`Dry-run.  No calls made.\n`);
    process.exit(0);
  }

  const t0 = Date.now();
  let stoppedForBudget = false;
  for (const { family, dialect } of sel.targets) {
    try {
      const snapshot = await runDialect({
        family, dialect,
        prompts: sel.prompts,
        model: opts.model,
        strict: opts.strict,
        timeoutMs: opts.timeout_ms,
        dryRun: opts.dry_run,
        maxBudgetUsd: opts.max_budget_usd,
        useApi: opts.api,
      });
      const path = writeSnapshot(snapshot, opts.out_dir);
      process.stderr.write(`  -> ${path}\n`);
      if (snapshot.summary && snapshot.summary.ok_count > 0) {
        const s = snapshot.summary;
        process.stderr.write(
          `  median: vs A ${(s.reduction_vs_a_median * 100).toFixed(1)}%,  ` +
          `vs B ${(s.reduction_vs_b_median * 100).toFixed(1)}%,  ` +
          `tone ${(s.tone_ratio_median * 100).toFixed(1)}% (cap ${(s.tone_cap_declared * 100).toFixed(0)}%) ` +
          `${s.tone_pass ? 'PASS' : 'FAIL'}\n`
        );
      }
    } catch (err) {
      if (err instanceof BudgetError) {
        // Save the in-progress dialect's completed prompts, then stop entirely.
        if (err.partialSnapshot && err.partialSnapshot.responses.some(r => r.arms)) {
          const path = writeSnapshot(err.partialSnapshot, opts.out_dir);
          process.stderr.write(`  -> ${path}  (partial)\n`);
        }
        process.stderr.write(`\n*** STOPPED on budget:  ${err.message}\n`);
        process.stderr.write(`*** Completed dialect snapshots are saved;  ${family}/${dialect} was cut short.\n`);
        stoppedForBudget = true;
        break;
      }
      process.stderr.write(`  FAILED: ${err.message}\n`);
    }
  }

  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  process.stderr.write(`\nEstimated spend:  ~$${spentUsd.toFixed(2)} (approximate circuit-breaker figure, not a bill)\n`);
  process.stderr.write(`Done in ${dt}s${stoppedForBudget ? '  (stopped early on budget)' : ''}\n`);
}

main().catch(err => {
  process.stderr.write(`\nFATAL: ${err.stack || err.message}\n`);
  process.exit(1);
});
