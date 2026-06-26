#!/usr/bin/env node
// tonespeak/evals/report.js
//
// Aggregates evals/snapshots/*.json into a markdown table.
//
// CLI:
//   node evals/report.js                            # read all snapshots, write benchmarks/results/<date>.md
//   node evals/report.js --out -                    # write to stdout
//   node evals/report.js --snapshots <dir>          # custom snapshots dir
//
// Output:  per-dialect summary row plus an aggregate "best / worst / median"
// footer.  Suitable for pasting into README under a "Benchmarks" section.

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const DEFAULT_SNAPSHOTS = join(REPO_ROOT, 'evals', 'snapshots');
const DEFAULT_OUT_DIR = join(REPO_ROOT, 'benchmarks', 'results');

function parseArgs(argv) {
  const out = { snapshots: DEFAULT_SNAPSHOTS, out: null, help: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--snapshots') out.snapshots = argv[++i];
    else if (a === '--out') out.out = argv[++i];
  }
  return out;
}

function showHelp() {
  process.stdout.write(`tonespeak benchmark report

USAGE
  node evals/report.js [options]

OPTIONS
  --snapshots <dir>    Snapshots directory.  Default evals/snapshots/.
  --out <path|->       Output path.  "-" for stdout.  Default benchmarks/results/<date>.md.
  --help, -h           Show this message.
`);
}

function loadSnapshots(dir) {
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter(f => f.endsWith('.json'));
  return files.map(f => {
    try {
      return JSON.parse(readFileSync(join(dir, f), 'utf8'));
    } catch (err) {
      process.stderr.write(`[report] skipping unreadable ${f}: ${err.message}\n`);
      return null;
    }
  }).filter(Boolean);
}

function formatPct(n) {
  if (n === undefined || n === null || Number.isNaN(n)) return '—';
  return `${(n * 100).toFixed(0)}%`;
}

function formatPctSigned(n) {
  if (n === undefined || n === null || Number.isNaN(n)) return '—';
  const v = n * 100;
  return `${v >= 0 ? '+' : ''}${v.toFixed(0)}%`;
}

function buildReport(snapshots) {
  const date = new Date().toISOString().slice(0, 10);
  const lines = [];
  lines.push(`# Tonespeak Benchmark Results`);
  lines.push('');
  lines.push(`**Generated:**  ${new Date().toISOString()}`);
  lines.push(`**Snapshots:**  ${snapshots.length} dialect(s) measured.`);
  lines.push('');
  lines.push(`## Per-dialect summary`);
  lines.push('');
  lines.push(`Token counts are word-based approximations.  Ratios are meaningful;  absolute counts are not.  The honest reduction figure is "vs B" (the dialect's net improvement over a "be concise" baseline);  "vs A" inflates the win by attributing the "be concise" instruction's contribution to the dialect.`);
  lines.push('');
  lines.push(`| Dialect | n | tokens A (med) | tokens B (med) | tokens C (med) | vs B (med) | tone ratio | tone cap | pass | keyword cov |`);
  lines.push(`|---|---:|---:|---:|---:|---:|---:|---:|:---:|---:|`);

  const rows = snapshots.map(s => {
    const sum = s.summary || {};
    const ok_responses = (s.responses || []).filter(r => r.reduction_vs_b !== undefined);
    const medianTokens = arm => {
      if (ok_responses.length === 0) return null;
      const vals = ok_responses.map(r => r.arms[arm].tokens).filter(x => x !== null && x !== undefined).sort((x, y) => x - y);
      if (vals.length === 0) return null;
      return vals.length % 2 ? vals[(vals.length - 1) / 2]
                              : Math.round((vals[vals.length / 2 - 1] + vals[vals.length / 2]) / 2);
    };
    return {
      dialect: s.dialect,
      n: ok_responses.length,
      med_a: medianTokens('a'),
      med_b: medianTokens('b'),
      med_c: medianTokens('c'),
      red_b: sum.reduction_vs_b_median,
      tone: sum.tone_ratio_median,
      tone_cap: sum.tone_cap_declared,
      pass: sum.tone_pass,
      kw: sum.keyword_coverage_median,
    };
  }).sort((a, b) => (b.red_b || 0) - (a.red_b || 0));

  for (const r of rows) {
    lines.push(`| ${r.dialect} | ${r.n} | ${r.med_a ?? '—'} | ${r.med_b ?? '—'} | ${r.med_c ?? '—'} | ${formatPctSigned(r.red_b)} | ${formatPct(r.tone)} | ${formatPct(r.tone_cap)} | ${r.pass === true ? 'PASS' : r.pass === false ? 'FAIL' : '—'} | ${formatPct(r.kw)} |`);
  }

  // Aggregate footer
  lines.push('');
  lines.push(`## Aggregate`);
  lines.push('');
  const okRows = rows.filter(r => r.red_b !== undefined && r.red_b !== null);
  if (okRows.length > 0) {
    const best = okRows[0];
    const worst = okRows[okRows.length - 1];
    const medianReduction = okRows.length % 2
      ? okRows[(okRows.length - 1) / 2].red_b
      : (okRows[okRows.length / 2 - 1].red_b + okRows[okRows.length / 2].red_b) / 2;
    const passes = okRows.filter(r => r.pass).length;

    lines.push(`- **Best (highest reduction vs B):**  ${best.dialect} at ${formatPctSigned(best.red_b)}.`);
    lines.push(`- **Worst:**  ${worst.dialect} at ${formatPctSigned(worst.red_b)}.`);
    lines.push(`- **Median reduction vs B across dialects:**  ${formatPctSigned(medianReduction)}.`);
    lines.push(`- **Tone-cap pass rate:**  ${passes} of ${okRows.length}.`);
  } else {
    lines.push(`No completed runs to summarize yet.  Run \`node evals/three-arm-eval.js --smoke\` first.`);
  }

  lines.push('');
  lines.push(`## Methodology`);
  lines.push('');
  lines.push(`See \`evals/README.md\` and \`shared/BENCHMARK_PROMPTS.md\`.  Three arms per (dialect, prompt) pair:`);
  lines.push(`- **A:**  \`claude --print --bare --model <m>\`  (no system prompt).`);
  lines.push(`- **B:**  same with \`--system-prompt "Answer concisely."\`.`);
  lines.push(`- **C:**  same with \`--system-prompt "$(cat <dialect-skill.md>)"\`.`);
  lines.push('');
  lines.push(`Each row's metric is the median across the prompt set, not the mean.  Single run per (prompt, arm) at default temperature.  Caveats per the spec disclaimers:  word-token approximation, no statistical significance testing, no cross-model verification.`);

  return lines.join('\n') + '\n';
}

function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) { showHelp(); process.exit(0); }

  const snapshots = loadSnapshots(opts.snapshots);
  const report = buildReport(snapshots);

  if (opts.out === '-') {
    process.stdout.write(report);
    return;
  }

  const outPath = opts.out || (() => {
    if (!existsSync(DEFAULT_OUT_DIR)) mkdirSync(DEFAULT_OUT_DIR, { recursive: true });
    return join(DEFAULT_OUT_DIR, `${new Date().toISOString().slice(0, 10)}.md`);
  })();

  writeFileSync(outPath, report);
  process.stderr.write(`Report written: ${outPath}\n`);
  process.stderr.write(`Snapshots aggregated: ${snapshots.length}\n`);
}

main();
