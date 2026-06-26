// tonespeak/evals/lint.js
//
// Eval-time tone-ratio and anti-pattern detection (spec §3.4, §11.1, §11.2).
//
// Not a runtime component.  Runs against benchmark outputs to verify that a
// dialect (a) keeps its tone-flavored content under tone_cap, and (b) does not
// trigger the forbidden anti-patterns from ANTI_PATTERNS.md.
//
// "Token" here is a word-level approximation:  whitespace-split, code-block
// content excluded.  Ratios are meaningful;  absolute counts are not.  The
// benchmark harness later substitutes tiktoken counts for absolute reporting.
//
// CLI usage:
//   node evals/lint.js <snapshot.json>
//
// Library usage:
//   import { lintResponse, lintSnapshot } from './lint.js';
//   const r = lintResponse(text, dialectConfig);

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// ---------- Tokenization ----------

const CODE_FENCE_RE = /```[\s\S]*?```/g;
const INLINE_CODE_RE = /`[^`\n]+`/g;
const WORD_RE = /[A-Za-z][A-Za-z0-9'-]*/g;

export function tokenize(text) {
  const stripped = text
    .replace(CODE_FENCE_RE, ' ')
    .replace(INLINE_CODE_RE, ' ');
  return stripped.match(WORD_RE) || [];
}

export function tokenizeRaw(text) {
  return text.match(WORD_RE) || [];
}

// ---------- Tone-flavored token counting ----------

export function countToneTokens(text, dialect) {
  const tokens = tokenize(text);
  const lower = tokens.map(t => t.toLowerCase());
  let tone = 0;

  // Tropes:  count the trope-marker word itself, once per occurrence.
  for (const trope of dialect.tropes || []) {
    const lo = trope.toLowerCase();
    for (const t of lower) if (t === lo) tone += 1;
  }

  // Self-reference markers:  count the words in the marker phrase, per
  // occurrence.  Single-word markers ("caveman") count 1;  multi-word markers
  // ("the skald tells") count their word length.
  for (const marker of dialect.self_reference_markers || []) {
    const target = marker.toLowerCase().split(/\s+/);
    for (let i = 0; i <= lower.length - target.length; i++) {
      let match = true;
      for (let j = 0; j < target.length; j++) {
        if (lower[i + j] !== target[j]) { match = false; break; }
      }
      if (match) tone += target.length;
    }
  }

  // Lexicon substitutions where the dialect term is longer than the plain term.
  // `lexicon` shape: [{ plain: 'firewall', dialect: 'packet-warden' }, ...]
  // Count only the surplus tokens caused by dialect lexicon presence.
  for (const entry of dialect.lexicon || []) {
    const plainTokens = entry.plain.split(/\s+/).length;
    const dialectTokens = entry.dialect.split(/\s+/).length;
    if (dialectTokens <= plainTokens) continue;
    const surplus = dialectTokens - plainTokens;

    const target = entry.dialect.toLowerCase().split(/\s+/);
    for (let i = 0; i <= lower.length - target.length; i++) {
      let match = true;
      for (let j = 0; j < target.length; j++) {
        if (lower[i + j] !== target[j]) { match = false; break; }
      }
      if (match) tone += surplus;
    }
  }

  // Stylized punctuation openers ("Lo,", "Hark!", "Aye,", etc.)
  // Count one token per opener occurrence (the opener word itself).
  for (const opener of dialect.flourish_openers || []) {
    const re = new RegExp(`\\b${escapeRe(opener)}\\b[!,]`, 'gi');
    const matches = text.match(re);
    if (matches) tone += matches.length;
  }

  return { tone, total: tokens.length };
}

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

export function toneRatio(text, dialect) {
  const { tone, total } = countToneTokens(text, dialect);
  return total === 0 ? 0 : tone / total;
}

// ---------- Anti-pattern detection ----------

export function detectAntiPatterns(text, dialect) {
  const hits = [];
  const tokens = tokenize(text);
  const lower = tokens.map(t => t.toLowerCase());

  // 1. Self-reference loop:  same marker >=3 times in one response.
  for (const marker of dialect.self_reference_markers || []) {
    const lo = marker.toLowerCase();
    const count = lower.filter(t => t === lo).length;
    if (count >= 3) {
      hits.push({ severity: 'fail', kind: 'self_reference_loop', marker, count });
    } else if (count === 2) {
      hits.push({ severity: 'warn', kind: 'self_reference_double', marker, count });
    }
  }

  // 2. Double-trope stacking:  3+ different tropes in one paragraph.
  for (const para of text.split(/\n\s*\n/)) {
    const paraLower = (tokenize(para) || []).map(t => t.toLowerCase());
    const tropesIn = new Set();
    for (const trope of dialect.tropes || []) {
      if (paraLower.includes(trope.toLowerCase())) tropesIn.add(trope);
    }
    if (tropesIn.size >= 3) {
      hits.push({ severity: 'fail', kind: 'trope_stacking', tropes: [...tropesIn] });
    }
  }

  // 3. Opening flourish:  first non-empty line starts with a banned opener.
  const first = (text.split('\n').find(l => l.trim()) || '').trim().toLowerCase();
  const FLOURISH_OPENERS = ['hark', 'lo', 'greetings', 'welcome', 'sure', 'certainly',
    'absolutely', 'great question', 'of course', 'happy to help'];
  for (const f of FLOURISH_OPENERS) {
    if (first.startsWith(f + ' ') || first.startsWith(f + ',') || first.startsWith(f + '!')) {
      hits.push({ severity: 'fail', kind: 'opening_flourish', opener: f });
      break;
    }
  }

  // 4. Persona inside code blocks.
  const codeBlocks = text.match(CODE_FENCE_RE) || [];
  for (const block of codeBlocks) {
    const blockLower = block.toLowerCase();
    for (const marker of (dialect.self_reference_markers || [])) {
      if (blockLower.includes(marker.toLowerCase())) {
        hits.push({ severity: 'fail', kind: 'persona_in_code', marker });
        break;
      }
    }
    for (const trope of (dialect.tropes || [])) {
      if (blockLower.includes(trope.toLowerCase())) {
        hits.push({ severity: 'fail', kind: 'trope_in_code', trope });
        break;
      }
    }
  }

  return hits;
}

// ---------- Top-level lint ----------

export function lintResponse(text, dialect, opts = {}) {
  const tone_cap = opts.tone_cap ?? dialect.tone_cap ?? 0.12;
  const { tone, total } = countToneTokens(text, dialect);
  const tone_ratio = total === 0 ? 0 : tone / total;
  const antiPatterns = detectAntiPatterns(text, dialect);
  const fails = antiPatterns.filter(h => h.severity === 'fail');
  const warns = antiPatterns.filter(h => h.severity === 'warn');

  return {
    dialect: dialect.name || 'unknown',
    tokens_total: total,
    tokens_tone: tone,
    tone_ratio,
    tone_cap,
    tone_pass: tone_ratio <= tone_cap,
    anti_patterns: antiPatterns,
    fails: fails.length,
    warns: warns.length,
    pass: fails.length === 0 && tone_ratio <= tone_cap,
  };
}

export function lintSnapshot(snapshot) {
  const results = [];
  for (const entry of snapshot.responses || []) {
    const r = lintResponse(entry.text, snapshot.dialect, { tone_cap: snapshot.tone_cap });
    results.push({ prompt_id: entry.prompt_id, ...r });
  }
  const ratios = results.map(r => r.tone_ratio).sort((a, b) => a - b);
  const median = ratios.length === 0 ? 0
    : ratios.length % 2 === 1
      ? ratios[(ratios.length - 1) / 2]
      : (ratios[ratios.length / 2 - 1] + ratios[ratios.length / 2]) / 2;

  const all_pass = results.every(r => r.pass);
  return {
    dialect: snapshot.dialect.name,
    count: results.length,
    tone_ratio_median: median,
    tone_cap: snapshot.tone_cap || snapshot.dialect.tone_cap || 0.12,
    all_pass,
    results,
  };
}

// ---------- CLI ----------

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const path = process.argv[2];
  if (!path) {
    process.stderr.write('usage: node evals/lint.js <snapshot.json>\n');
    process.exit(2);
  }
  const snapshot = JSON.parse(readFileSync(path, 'utf8'));
  const result = lintSnapshot(snapshot);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exit(result.all_pass ? 0 : 1);
}
