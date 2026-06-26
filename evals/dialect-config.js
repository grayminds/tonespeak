// tonespeak/evals/dialect-config.js
//
// Extracts a lint-ready config from a dialect's monolithic SKILL.md.  Avoids
// duplicating the lexicon and trope list in two places;  the SKILL.md is the
// single source of truth.
//
// The extractor reads:
//   - YAML frontmatter `name`, `description`, `axes.tone_cap`.
//   - A `## Tropes` or `<!-- when:trope_frequency... -->` block;  pulls trope
//     names from bulleted backtick-quoted markers.
//   - A `## Self-reference` block;  pulls marker phrases from inline quoted text
//     and from the per-dialect declared markers.
//   - The dialect's primary lexicon table (the one labeled "specific lexicon"
//     or the only lexicon table if there is just one).  Pulls plain -> dialect
//     pairs.
//   - The `## Tropes` section's "Iconic openers" if present, to populate
//     `flourish_openers`.
//
// Returns the lint config shape expected by evals/lint.js:
//   { name, tone_cap, tropes, self_reference_markers, lexicon, flourish_openers }

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter, dialectPath } from '../src/lib/loader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

const FAMILY_DIALECTS = Object.freeze({
  spacespeak: ['missioncontrol', 'expanse', 'solarclipper', 'startrek', 'starwars', 'doctorwho', 'firefly', 'galactica', 'stargate'],
  bardspeak: ['tavern', 'viking', 'dragonlance', 'dnd', 'tolkien'],
  stylespeak: ['cavespeak', 'noir', 'cyberpunk', 'steampunk', 'pirate', 'western', 'deadpan', 'renfaire', 'shakespearean', 'laconic'],
});

export function listAllDialects() {
  const out = [];
  for (const [family, dialects] of Object.entries(FAMILY_DIALECTS)) {
    for (const d of dialects) out.push({ family, dialect: d });
  }
  return out;
}

export function extractDialectConfig(family, dialect, opts = {}) {
  const root = opts.root || REPO_ROOT;
  const path = dialectPath(family, dialect, root);
  if (!existsSync(path)) {
    throw new Error(`dialect file not found: ${path}`);
  }
  const raw = readFileSync(path, 'utf8');
  const { frontmatter, body } = parseFrontmatter(raw);

  return {
    name: `${family}/${dialect}`,
    description: frontmatter.description || '',
    tone_cap: (frontmatter.axes && frontmatter.axes.tone_cap) || 0.12,
    tropes: extractTropes(body),
    self_reference_markers: extractSelfReferenceMarkers(body, family, dialect),
    lexicon: extractLexicon(body),
    flourish_openers: extractFlourishOpeners(body, family, dialect),
  };
}

// ---------- Extractors ----------

// Tropes:  pull backticked single-word markers from any "## Tropes" section,
// up to the next "## " heading.
function extractTropes(body) {
  const section = sliceSection(body, /^##\s+Tropes/m);
  if (!section) return [];
  const tropes = new Set();
  const RE = /`([a-z][a-z0-9-]*)`/g;
  let m;
  while ((m = RE.exec(section)) !== null) {
    const word = m[1].toLowerCase();
    if (word.length >= 3 && word.length <= 20) tropes.add(word);
  }
  return [...tropes];
}

// Self-reference markers:  combine a per-dialect curated list with anything
// extracted from a "## Self-reference" section.
function extractSelfReferenceMarkers(body, family, dialect) {
  const out = new Set();

  // Per-dialect curated markers (covers cases the SKILL.md doesn't itself spell out).
  const curated = {
    'stylespeak/cavespeak': ['caveman'],
    'spacespeak/missioncontrol': ['houston', 'flight', 'capcom', 'cdr', 'control'],
    'spacespeak/expanse': ['beratna', 'beltalowda', 'bosmang'],
    'spacespeak/solarclipper': ['watch log', 'shipmates'],
    'spacespeak/startrek': ["captain's log", 'bridge'],
    'spacespeak/starwars': ['control', 'red five'],
    'spacespeak/doctorwho': ['the doctor'],
    'spacespeak/firefly': ['captain', 'crew here'],
    'spacespeak/galactica': ['cic', 'actual', 'the admiral'],
    'spacespeak/stargate': ['sgc', 'sg-1', 'command'],
    'bardspeak/tavern': ['the keeper'],
    'bardspeak/viking': ['the skald'],
    'bardspeak/dragonlance': ['companions', 'the bard'],
    'bardspeak/dnd': ['the dm'],
    'bardspeak/tolkien': ['the chronicler of the elder days'],
    'stylespeak/noir': ['the detective', 'gumshoe'],
    'stylespeak/cyberpunk': ['netrunner', 'console cowboy'],
    'stylespeak/steampunk': ['this engineer', 'your correspondent'],
    'stylespeak/pirate': ['the captain', 'the crew'],
    'stylespeak/western': ['the posse', 'reckon'],
    'stylespeak/deadpan': [],
    'stylespeak/laconic': [],
    'stylespeak/renfaire': ["m'lord", "m'lady"],
    'stylespeak/shakespearean': ['your humble player', 'good sir', 'good madam'],
  };
  const key = `${family}/${dialect}`;
  const curatedList = curated[key] || [];
  for (const m of curatedList) out.add(m.toLowerCase());

  // Anything in the body that looks like a self-reference declaration:  "X" as a single-occurrence opener.
  const selfRefSection = sliceSection(body, /^##\s+Self-reference/m);
  if (selfRefSection) {
    const RE = /`([A-Za-z][A-Za-z0-9 ',-]*)`/g;
    let m;
    while ((m = RE.exec(selfRefSection)) !== null) {
      const phrase = m[1].toLowerCase().trim();
      if (phrase.length >= 3 && phrase.length <= 40 && !phrase.includes('--')) {
        out.add(phrase);
      }
    }
  }
  return [...out];
}

// Lexicon:  parse the first markdown table that has "Plain term" or similar
// in its header and a per-dialect terms column.  Returns [{plain, dialect}, ...].
function extractLexicon(body) {
  // Find every markdown table;  keep the one whose header includes "Plain term" or "Plain".
  const tables = findTables(body);
  const entries = [];
  for (const table of tables) {
    if (!/Plain/i.test(table.headerLine)) continue;
    for (const row of table.rows) {
      if (row.length < 2) continue;
      const plain = row[0].trim();
      const dialect = row[1].trim();
      // Skip header-row-looking and dash-only rows.
      if (!plain || !dialect) continue;
      if (/^---/.test(plain) || /^---/.test(dialect)) continue;
      // Split "/" alternates in plain (e.g. "good / done")
      const plains = plain.split(/\s*\/\s*/).map(s => s.trim()).filter(Boolean);
      for (const p of plains) {
        entries.push({ plain: p, dialect: dialect });
      }
    }
  }
  return entries;
}

function extractFlourishOpeners(body, family, dialect) {
  const curated = {
    'stylespeak/shakespearean': ['hark', 'lo', 'yonder'],
    'stylespeak/renfaire': ['hark', 'huzzah'],
    'bardspeak/tolkien': [],
    'bardspeak/tavern': [],
    'bardspeak/viking': [],
    'bardspeak/dragonlance': ['hark'],
    'bardspeak/dnd': [],
    'spacespeak/doctorwho': ['lovely'],
  };
  const key = `${family}/${dialect}`;
  return curated[key] || [];
}

// ---------- Helpers ----------

function sliceSection(body, headingRe) {
  const startMatch = body.match(headingRe);
  if (!startMatch) return null;
  const start = startMatch.index;
  const after = body.slice(start + startMatch[0].length);
  const nextHeading = after.search(/\n##\s+/);
  return after.slice(0, nextHeading === -1 ? after.length : nextHeading);
}

function findTables(body) {
  const lines = body.split('\n');
  const tables = [];
  let i = 0;
  while (i < lines.length) {
    if (!/^\|/.test(lines[i])) { i++; continue; }
    // Check for separator line under header
    if (i + 1 >= lines.length || !/^\|[\s\-:|]+\|$/.test(lines[i + 1])) { i++; continue; }
    const headerLine = lines[i];
    const rows = [];
    let j = i + 2;
    while (j < lines.length && /^\|/.test(lines[j])) {
      const cells = lines[j].split('|').slice(1, -1).map(s => s.trim());
      rows.push(cells);
      j++;
    }
    tables.push({ headerLine, rows });
    i = j;
  }
  return tables;
}

// ---------- CLI ----------

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === '--all') {
    const out = listAllDialects().map(({ family, dialect }) => {
      try {
        return extractDialectConfig(family, dialect);
      } catch (err) {
        return { family, dialect, error: err.message };
      }
    });
    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  } else {
    const [family, dialect] = args[0].split('/');
    const out = extractDialectConfig(family, dialect);
    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  }
}
