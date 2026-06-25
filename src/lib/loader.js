// tonespeak/src/lib/loader.js
//
// The selective dialect loader.
//
// Responsibilities (spec §2 "Key architectural notes", §7.5, §8.6):
//   1. Read a dialect's monolithic SKILL.md from <family>/SKILL.md or
//      <family>/dialects/<dialect>.md.
//   2. Parse YAML frontmatter into { name, description, reminder, axes }.
//   3. Merge axis values:  dialect defaults -> levels.json override -> preset -> final.
//   4. Walk the SKILL.md body and evaluate `<!-- when:<condition> -->...<!-- end -->`
//      marker fences against the resolved axes;  include or strip each block.
//   5. Return { skill, reminder, axes, name, description } for the activate hook.
//
// The loader is the runtime brain.  There is no string-transforming middleware;
// the model executes the rules in the returned `skill` text.

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getConfigDir } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');

// ---------- Axis catalog ----------

export const AXIS_ORDERING = Object.freeze({
  compression:     ['low', 'med', 'high', 'ultra'],
  lexicon_rate:    ['sparse', 'moderate', 'heavy'],
  trope_frequency: ['off', 'occasional', 'signature'],
  self_reference: ['off', 'rationed', 'free'],
  cadence:         ['loose', 'tight', 'hard-cap'],
  protocols:       ['off', 'situational', 'always'],
  auto_clarity:    ['relaxed', 'standard', 'aggressive'],
  // tone_cap is numeric, not enum
});

export const NUMERIC_AXES = new Set(['tone_cap']);

export const BUILTIN_PRESETS = Object.freeze({
  lite: {
    trope_frequency: 'off',
    self_reference: 'off',
  },
});

// ---------- Path resolution ----------

export function dialectPath(family, dialect, root = REPO_ROOT) {
  return join(root, family, 'dialects', `${dialect}.md`);
}

export function levelsPath() {
  return process.env.TONESPEAK_LEVELS || join(getConfigDir(), 'levels.json');
}

// ---------- Frontmatter ----------

export function parseFrontmatter(text) {
  // Normalize line endings so a Windows (CRLF) checkout parses identically to
  // a Unix (LF) one.  Without this, a CRLF file fails the `---\n` guard below,
  // silently yielding empty frontmatter (wrong name, no reminder, frontmatter
  // leaking into the skill body).  See .gitattributes for the repo-side guard.
  text = text.replace(/\r\n?/g, '\n');
  if (!text.startsWith('---\n')) {
    return { frontmatter: {}, body: text };
  }
  const end = text.indexOf('\n---\n', 4);
  if (end === -1) {
    return { frontmatter: {}, body: text };
  }
  const yamlSrc = text.slice(4, end);
  const body = text.slice(end + 5);
  return { frontmatter: parseMinimalYaml(yamlSrc), body };
}

// Minimal YAML subset:
//   - top-level scalar: `key: value`
//   - top-level multi-line scalar: `key: |` then indented lines
//   - one level of nesting: `parent:` then indented `  child: value`
//   - lines starting with `#` are comments
//   - booleans true/false, numbers, otherwise strings
function parseMinimalYaml(src) {
  const lines = src.split('\n');
  const out = {};
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) { i++; continue; }

    // Top-level key: ...
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
    if (!m) { i++; continue; }
    const key = m[1];
    const rest = m[2];

    if (rest === '|' || rest === '|-' || rest === '>') {
      // Multi-line scalar
      i++;
      const chunks = [];
      while (i < lines.length) {
        const l = lines[i];
        if (l.match(/^\S/) || l === '') {
          if (l === '' && i + 1 < lines.length && lines[i + 1].match(/^\s+\S/)) {
            chunks.push('');
            i++;
            continue;
          }
          break;
        }
        chunks.push(l.replace(/^\s\s/, ''));
        i++;
      }
      out[key] = chunks.join('\n').trimEnd();
      continue;
    }

    if (rest === '') {
      // Nested object: read indented children
      i++;
      const child = {};
      while (i < lines.length) {
        const l = lines[i];
        if (!l.trim()) { i++; continue; }
        if (!l.startsWith('  ')) break;
        const cm = l.match(/^\s+([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
        if (!cm) { i++; continue; }
        child[cm[1]] = coerceScalar(cm[2]);
        i++;
      }
      out[key] = child;
      continue;
    }

    out[key] = coerceScalar(rest);
    i++;
  }
  return out;
}

function coerceScalar(raw) {
  const v = raw.trim().replace(/^['"]|['"]$/g, '');
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v === 'null' || v === '~' || v === '') return null;
  if (/^-?\d+$/.test(v)) return parseInt(v, 10);
  if (/^-?\d*\.\d+$/.test(v)) return parseFloat(v);
  return v;
}

// ---------- Levels (~/.tonespeak/levels.json) ----------

export function readLevels() {
  const path = levelsPath();
  if (!existsSync(path)) {
    return { dialects: {}, presets: { ...BUILTIN_PRESETS } };
  }
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    return {
      dialects: parsed.dialects || {},
      presets: { ...BUILTIN_PRESETS, ...(parsed.presets || {}) },
    };
  } catch (err) {
    process.stderr.write(`[tonespeak] levels.json unreadable (${err.message});  using built-in only\n`);
    return { dialects: {}, presets: { ...BUILTIN_PRESETS } };
  }
}

// ---------- Axis resolution ----------

export function resolveAxes(dialectDefaults, opts = {}) {
  const { dialectKey, levels, preset } = opts;
  const merged = { ...dialectDefaults };

  if (levels && dialectKey && levels.dialects && levels.dialects[dialectKey]) {
    Object.assign(merged, levels.dialects[dialectKey]);
  }

  if (preset) {
    const presetMap = (levels && levels.presets) || BUILTIN_PRESETS;
    if (presetMap[preset]) {
      Object.assign(merged, presetMap[preset]);
    }
  }
  return merged;
}

// ---------- Condition parser + evaluator ----------

export function evaluateCondition(condition, axes) {
  const raw = String(condition || '').trim();
  if (!raw) return true;

  const hasAnd = raw.includes('&');
  const hasOr = raw.includes('|');

  let parts;
  let join;
  if (hasAnd && hasOr) {
    process.stderr.write(`[tonespeak] mixed & and | in condition "${raw}";  treating all as AND\n`);
    parts = raw.split(/[&|]/);
    join = 'and';
  } else if (hasOr) {
    parts = raw.split('|');
    join = 'or';
  } else {
    parts = raw.split('&');
    join = 'and';
  }

  const results = parts.map(p => evaluateAtom(p.trim(), axes));
  return join === 'or' ? results.some(Boolean) : results.every(Boolean);
}

function evaluateAtom(atom, axes) {
  if (!atom) return true;

  const m = atom.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(!=|>=|<=|=)\s*(.+)$/);
  if (!m) {
    process.stderr.write(`[tonespeak] malformed condition atom "${atom}";  failing open (include)\n`);
    return true;
  }
  const [, axis, op, rawValue] = m;
  const value = rawValue.trim();

  if (!(axis in axes)) {
    process.stderr.write(`[tonespeak] unknown axis "${axis}" in condition;  failing open\n`);
    return true;
  }
  const actual = axes[axis];

  if (NUMERIC_AXES.has(axis)) {
    const v = parseFloat(value);
    const a = parseFloat(actual);
    if (Number.isNaN(v) || Number.isNaN(a)) {
      process.stderr.write(`[tonespeak] non-numeric comparison on numeric axis "${axis}";  failing open\n`);
      return true;
    }
    switch (op) {
      case '=':  return a === v;
      case '!=': return a !== v;
      case '>=': return a >= v;
      case '<=': return a <= v;
    }
  }

  const ordering = AXIS_ORDERING[axis];
  if (!ordering) {
    process.stderr.write(`[tonespeak] no ordering for axis "${axis}";  failing open\n`);
    return true;
  }
  const ai = ordering.indexOf(actual);
  const vi = ordering.indexOf(value);
  if (ai === -1 || vi === -1) {
    process.stderr.write(`[tonespeak] unknown value "${actual}" or "${value}" for axis "${axis}";  failing open\n`);
    return true;
  }
  switch (op) {
    case '=':  return ai === vi;
    case '!=': return ai !== vi;
    case '>=': return ai >= vi;
    case '<=': return ai <= vi;
  }
  return true;
}

// ---------- Marker-fence stripper ----------

// Match `<!-- when:<condition> -->...<!-- end -->`.
// Condition may include `=`, `>=`, `<=`, `!=`, `&`, `|`, alphanumerics, and dots
// (for numeric axis values).  Newlines in conditions are not supported.
const FENCE_RE = /<!--\s*when:([^\n]+?)\s*-->([\s\S]*?)<!--\s*end\s*-->/g;

export function stripFences(body, axes) {
  return body.replace(FENCE_RE, (match, condition, block) => {
    return evaluateCondition(condition, axes) ? block : '';
  });
}

// ---------- Top-level loader ----------

export function loadDialect(family, dialect, opts = {}) {
  const { root = REPO_ROOT, preset = null, levelsOverride = null } = opts;
  const path = dialectPath(family, dialect, root);

  if (!existsSync(path)) {
    throw new Error(`dialect file not found: ${path}`);
  }
  const raw = readFileSync(path, 'utf8');
  const { frontmatter, body } = parseFrontmatter(raw);

  const dialectKey = `${family}/${dialect}`;
  const levels = levelsOverride !== null ? levelsOverride : readLevels();
  const axes = resolveAxes(frontmatter.axes || {}, { dialectKey, levels, preset });

  const skill = stripFences(body, axes).replace(/\n{3,}/g, '\n\n').trim() + '\n';
  const reminder = typeof frontmatter.reminder === 'string'
    ? frontmatter.reminder.slice(0, 200).trim()
    : '';

  return {
    family,
    dialect,
    dialectKey,
    name: frontmatter.name || dialectKey,
    description: frontmatter.description || '',
    reminder,
    axes,
    skill,
  };
}
