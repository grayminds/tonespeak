// tests/loader.test.js
//
// Loader behavior:  frontmatter parse, axis merge order, marker-fence evaluation
// across all four condition forms, AND/OR joins, numeric axes, lite-preset
// parity, malformed-condition fail-open.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  parseFrontmatter,
  resolveAxes,
  evaluateCondition,
  stripFences,
  loadDialect,
  AXIS_ORDERING,
  BUILTIN_PRESETS,
} from '../src/lib/loader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(__dirname, 'fixtures', 'fixture-dialect.md');
const FIXTURE_TEXT = readFileSync(FIXTURE_PATH, 'utf8');

// ---------- parseFrontmatter ----------

test('parseFrontmatter: extracts frontmatter and body', () => {
  const { frontmatter, body } = parseFrontmatter(FIXTURE_TEXT);
  assert.equal(frontmatter.name, 'tonespeak-fixture');
  assert.ok(frontmatter.description.includes('Test fixture'));
  assert.ok(frontmatter.reminder.startsWith('TONESPEAK fixture active'));
  assert.equal(typeof frontmatter.axes, 'object');
  assert.equal(frontmatter.axes.compression, 'high');
  assert.equal(frontmatter.axes.tone_cap, 0.12);
  assert.ok(body.startsWith('\n# tonespeak fixture dialect'));
});

test('parseFrontmatter: body without frontmatter', () => {
  const { frontmatter, body } = parseFrontmatter('no frontmatter here');
  assert.deepEqual(frontmatter, {});
  assert.equal(body, 'no frontmatter here');
});

// ---------- resolveAxes ----------

test('resolveAxes: defaults only', () => {
  const defaults = { compression: 'high', trope_frequency: 'occasional' };
  const result = resolveAxes(defaults, {});
  assert.deepEqual(result, defaults);
});

test('resolveAxes: levels override dialect defaults', () => {
  const defaults = { compression: 'high', trope_frequency: 'occasional' };
  const levels = {
    dialects: { 'foo/bar': { trope_frequency: 'signature' } },
    presets: {},
  };
  const result = resolveAxes(defaults, { dialectKey: 'foo/bar', levels });
  assert.equal(result.compression, 'high');
  assert.equal(result.trope_frequency, 'signature');
});

test('resolveAxes: preset overrides dialect override', () => {
  const defaults = { trope_frequency: 'occasional', self_reference: 'rationed' };
  const levels = {
    dialects: { 'foo/bar': { trope_frequency: 'signature' } },
    presets: BUILTIN_PRESETS,
  };
  const result = resolveAxes(defaults, { dialectKey: 'foo/bar', levels, preset: 'lite' });
  // lite preset flips trope_frequency to off (overriding the signature override)
  // and self_reference to off
  assert.equal(result.trope_frequency, 'off');
  assert.equal(result.self_reference, 'off');
});

// ---------- evaluateCondition ----------

const AXES_DEFAULT = {
  compression: 'high',
  lexicon_rate: 'heavy',
  trope_frequency: 'occasional',
  self_reference: 'rationed',
  cadence: 'tight',
  protocols: 'situational',
  auto_clarity: 'standard',
  tone_cap: 0.12,
};

test('evaluateCondition: exact match', () => {
  assert.equal(evaluateCondition('compression=high', AXES_DEFAULT), true);
  assert.equal(evaluateCondition('compression=ultra', AXES_DEFAULT), false);
});

test('evaluateCondition: at-or-above', () => {
  assert.equal(evaluateCondition('trope_frequency>=occasional', AXES_DEFAULT), true);
  assert.equal(evaluateCondition('trope_frequency>=signature', AXES_DEFAULT), false);
});

test('evaluateCondition: at-or-below', () => {
  assert.equal(evaluateCondition('cadence<=tight', AXES_DEFAULT), true);
  assert.equal(evaluateCondition('cadence<=loose', AXES_DEFAULT), false);
});

test('evaluateCondition: negation', () => {
  assert.equal(evaluateCondition('compression!=ultra', AXES_DEFAULT), true);
  assert.equal(evaluateCondition('compression!=high', AXES_DEFAULT), false);
});

test('evaluateCondition: AND join', () => {
  assert.equal(
    evaluateCondition('compression>=high & trope_frequency>=occasional', AXES_DEFAULT),
    true
  );
  assert.equal(
    evaluateCondition('compression>=high & trope_frequency>=signature', AXES_DEFAULT),
    false
  );
});

test('evaluateCondition: OR join', () => {
  assert.equal(
    evaluateCondition('cadence=loose | cadence=tight', AXES_DEFAULT),
    true
  );
  assert.equal(
    evaluateCondition('cadence=loose | cadence=hard-cap', AXES_DEFAULT),
    false
  );
});

test('evaluateCondition: numeric axis', () => {
  assert.equal(evaluateCondition('tone_cap>=0.12', AXES_DEFAULT), true);
  assert.equal(evaluateCondition('tone_cap>=0.15', AXES_DEFAULT), false);
  assert.equal(evaluateCondition('tone_cap<=0.15', AXES_DEFAULT), true);
  assert.equal(evaluateCondition('tone_cap=0.12', AXES_DEFAULT), true);
});

test('evaluateCondition: malformed fails open', () => {
  // Should return true (include the block) on garbage.
  assert.equal(evaluateCondition('nonsense', AXES_DEFAULT), true);
  assert.equal(evaluateCondition('compression+high', AXES_DEFAULT), true);
  assert.equal(evaluateCondition('unknown_axis=foo', AXES_DEFAULT), true);
});

test('evaluateCondition: empty condition always true', () => {
  assert.equal(evaluateCondition('', AXES_DEFAULT), true);
});

// ---------- stripFences ----------

test('stripFences: includes blocks that match', () => {
  const body = `pre
<!-- when:compression=high -->kept
<!-- end -->
post`;
  const result = stripFences(body, AXES_DEFAULT);
  assert.ok(result.includes('kept'));
});

test('stripFences: removes blocks that do not match', () => {
  const body = `pre
<!-- when:compression=ultra -->should be removed
<!-- end -->
post`;
  const result = stripFences(body, AXES_DEFAULT);
  assert.ok(!result.includes('should be removed'));
  assert.ok(result.includes('pre'));
  assert.ok(result.includes('post'));
});

test('stripFences: multiple fences', () => {
  const body = `
<!-- when:trope_frequency>=occasional -->TROPES
<!-- end -->
<!-- when:trope_frequency>=signature -->SIGNATURE
<!-- end -->
<!-- when:self_reference>=rationed -->SELFREF
<!-- end -->
`;
  const result = stripFences(body, AXES_DEFAULT);
  assert.ok(result.includes('TROPES'));
  assert.ok(!result.includes('SIGNATURE'));
  assert.ok(result.includes('SELFREF'));
});

test('stripFences: malformed condition includes block', () => {
  const body = `<!-- when:malformed nonsense -->should appear<!-- end -->`;
  const result = stripFences(body, AXES_DEFAULT);
  assert.ok(result.includes('should appear'));
});

// ---------- loadDialect (integration) ----------

function setupTempRoot() {
  const dir = mkdtempSync(join(tmpdir(), 'tonespeak-test-'));
  const familyDir = join(dir, 'fixture-family', 'dialects');
  mkdirSync(familyDir, { recursive: true });
  cpSync(FIXTURE_PATH, join(familyDir, 'standard.md'));
  return dir;
}

test('loadDialect: full pipeline with defaults', () => {
  const root = setupTempRoot();
  const loaded = loadDialect('fixture-family', 'standard', { root, levelsOverride: { dialects: {}, presets: BUILTIN_PRESETS } });

  assert.equal(loaded.family, 'fixture-family');
  assert.equal(loaded.dialect, 'standard');
  assert.equal(loaded.name, 'tonespeak-fixture');
  assert.equal(loaded.axes.compression, 'high');
  // Frontmatter axes preserved when no overrides.
  assert.equal(loaded.axes.trope_frequency, 'occasional');
  // Reminder extracted and capped at 200 chars.
  assert.ok(loaded.reminder.length <= 200);
  assert.ok(loaded.reminder.startsWith('TONESPEAK fixture active'));
  // Conditional blocks evaluated.
  assert.ok(loaded.skill.includes('Protocols block'));      // protocols=situational
  assert.ok(loaded.skill.includes('Tropes block'));         // trope_frequency=occasional
  assert.ok(loaded.skill.includes('Self-reference block')); // self_reference=rationed
  assert.ok(!loaded.skill.includes('Ultra-compression-only')); // compression=high not ultra
  assert.ok(loaded.skill.includes('Combined AND block'));   // high & occasional
  assert.ok(!loaded.skill.includes('Cadence OR block'));    // cadence=tight, not loose or hard-cap
  assert.ok(!loaded.skill.includes('Flavor-mode block'));   // tone_cap=0.12 not >=0.15
  assert.ok(loaded.skill.includes('Malformed-fence block')); // malformed -> fail open
});

test('loadDialect: lite preset strips trope and self-reference blocks', () => {
  const root = setupTempRoot();
  const loaded = loadDialect('fixture-family', 'standard', {
    root,
    preset: 'lite',
    levelsOverride: { dialects: {}, presets: BUILTIN_PRESETS },
  });

  assert.equal(loaded.axes.trope_frequency, 'off');
  assert.equal(loaded.axes.self_reference, 'off');
  // Lite strips the trope and self-reference blocks
  assert.ok(!loaded.skill.includes('Tropes block'));
  assert.ok(!loaded.skill.includes('Self-reference block'));
  // But preserves other blocks
  assert.ok(loaded.skill.includes('Protocols block'));
});

test('loadDialect: user override raises tone_cap', () => {
  const root = setupTempRoot();
  const loaded = loadDialect('fixture-family', 'standard', {
    root,
    levelsOverride: {
      dialects: { 'fixture-family/standard': { tone_cap: 0.20 } },
      presets: BUILTIN_PRESETS,
    },
  });

  assert.equal(loaded.axes.tone_cap, 0.20);
  // 0.20 >= 0.15, so flavor-mode block now appears
  assert.ok(loaded.skill.includes('Flavor-mode block'));
});

test('loadDialect: user override + lite preset (preset wins over override)', () => {
  const root = setupTempRoot();
  const loaded = loadDialect('fixture-family', 'standard', {
    root,
    preset: 'lite',
    levelsOverride: {
      dialects: { 'fixture-family/standard': { trope_frequency: 'signature' } },
      presets: BUILTIN_PRESETS,
    },
  });

  // User wanted signature tropes; lite preset overrides to off.
  assert.equal(loaded.axes.trope_frequency, 'off');
  assert.ok(!loaded.skill.includes('Tropes block'));
});

test('loadDialect: missing dialect file throws', () => {
  const root = mkdtempSync(join(tmpdir(), 'tonespeak-empty-'));
  assert.throws(
    () => loadDialect('nonexistent', 'nope', { root, levelsOverride: { dialects: {}, presets: BUILTIN_PRESETS } }),
    /not found/
  );
});

// ---------- Axis ordering sanity ----------

test('AXIS_ORDERING: every axis has off-low-high ordering', () => {
  for (const axis of ['compression', 'lexicon_rate', 'trope_frequency', 'self_reference', 'cadence', 'protocols', 'auto_clarity']) {
    assert.ok(Array.isArray(AXIS_ORDERING[axis]), `axis ${axis} ordering`);
    assert.ok(AXIS_ORDERING[axis].length >= 3, `axis ${axis} has at least 3 levels`);
  }
});

// ---------- Real-dialect smoke tests ----------

test('loadDialect: cavespeak loads cleanly with all required pieces', () => {
  const root = join(__dirname, '..');
  const loaded = loadDialect('stylespeak', 'cavespeak', { root });

  assert.equal(loaded.name, 'tonespeak-stylespeak-cavespeak');
  assert.ok(loaded.description.length > 0);
  assert.ok(loaded.reminder.length > 0);
  assert.ok(loaded.reminder.length <= 200, `reminder ${loaded.reminder.length} chars (max 200)`);
  assert.ok(loaded.skill.length > 500, 'skill body should be substantial');

  // Axes match cavespeak's declared defaults
  assert.equal(loaded.axes.compression, 'high');
  assert.equal(loaded.axes.trope_frequency, 'occasional');
  assert.equal(loaded.axes.self_reference, 'rationed');
  assert.equal(loaded.axes.tone_cap, 0.12);

  // Default load includes tropes and self-reference sections
  assert.ok(loaded.skill.includes('Tropes'), 'tropes section should render at default axes');
  assert.ok(loaded.skill.includes('Self-reference'), 'self-reference section should render at default axes');

  // Always present: voice anchor, auto-clarity, boundaries
  assert.ok(loaded.skill.includes('Voice anchor'));
  assert.ok(loaded.skill.includes('Auto-clarity'));
  assert.ok(loaded.skill.includes('Boundaries'));
});

test('loadDialect: cavespeak lite preset strips tropes and self-reference', () => {
  const root = join(__dirname, '..');
  const loaded = loadDialect('stylespeak', 'cavespeak', { root, preset: 'lite' });

  assert.equal(loaded.axes.trope_frequency, 'off');
  assert.equal(loaded.axes.self_reference, 'off');

  // Tropes and self-reference sections should be stripped
  assert.ok(!loaded.skill.match(/^## Tropes/m), 'tropes section should be stripped under lite');
  assert.ok(!loaded.skill.match(/^## Self-reference/m), 'self-reference section should be stripped under lite');

  // But voice anchor, compression rules, auto-clarity, boundaries survive
  assert.ok(loaded.skill.includes('Voice anchor'));
  assert.ok(loaded.skill.includes('Compression rules'));
  assert.ok(loaded.skill.includes('Auto-clarity'));
  assert.ok(loaded.skill.includes('Boundaries'));
});

// ---------- Spacespeak dialect smoke tests ----------

const SPACESPEAK_SHIPPING = [
  { dialect: 'missioncontrol', expected_tone_cap: 0.09 },
  { dialect: 'expanse',      expected_tone_cap: 0.07 },
  { dialect: 'solarclipper', expected_tone_cap: 0.11 },
  { dialect: 'startrek',     expected_tone_cap: 0.17 },
  { dialect: 'starwars',     expected_tone_cap: 0.10 },
  { dialect: 'doctorwho',          expected_tone_cap: 0.22 },
  { dialect: 'firefly',      expected_tone_cap: 0.09 },
  { dialect: 'galactica',    expected_tone_cap: 0.10 },
  { dialect: 'stargate',     expected_tone_cap: 0.11 },
];

for (const { dialect, expected_tone_cap } of SPACESPEAK_SHIPPING) {
  test(`loadDialect: spacespeak/${dialect} loads with required pieces`, () => {
    const root = join(__dirname, '..');
    const loaded = loadDialect('spacespeak', dialect, { root });

    assert.equal(loaded.name, `tonespeak-spacespeak-${dialect}`);
    assert.ok(loaded.description.length > 0, 'description present');
    assert.ok(loaded.reminder.length > 0, 'reminder present');
    assert.ok(loaded.reminder.length <= 200, `reminder ${loaded.reminder.length} chars (max 200)`);
    assert.ok(loaded.skill.length > 800, `skill body should be substantial (got ${loaded.skill.length})`);
    assert.equal(loaded.axes.tone_cap, expected_tone_cap);

    // Family-shared structural pieces (every dialect must embed these)
    assert.ok(loaded.skill.includes('Voice anchor'),       `${dialect}: voice anchor`);
    assert.ok(loaded.skill.includes('Compression rules'),  `${dialect}: compression rules`);
    assert.ok(loaded.skill.includes('Auto-clarity'),       `${dialect}: auto-clarity`);
    assert.ok(loaded.skill.includes('Boundaries'),         `${dialect}: boundaries`);

    // Dialects whose default `protocols` axis is `situational` or `always` surface
    // the Protocol headers block at default load.  Dialects that default protocols
    // to `off` (like `doctorwho`) intentionally hide it.
    if (loaded.axes.protocols !== 'off') {
      assert.ok(loaded.skill.includes('Protocol headers'), `${dialect}: protocol headers expected when axis is ${loaded.axes.protocols}`);
    }
  });

  test(`loadDialect: spacespeak/${dialect} lite preset strips fenced flavor blocks`, () => {
    const root = join(__dirname, '..');
    const loaded = loadDialect('spacespeak', dialect, { root, preset: 'lite' });

    assert.equal(loaded.axes.trope_frequency, 'off');
    assert.equal(loaded.axes.self_reference, 'off');

    // The standalone "## Tropes" and "## Self-reference" sections should be stripped.
    assert.ok(!loaded.skill.match(/^## Tropes\b/m), `${dialect}: tropes section stripped under lite`);
    assert.ok(!loaded.skill.match(/^## Self-reference\b/m), `${dialect}: self-reference section stripped under lite`);

    // Compression and Auto-clarity always survive.
    assert.ok(loaded.skill.includes('Compression rules'));
    assert.ok(loaded.skill.includes('Auto-clarity'));
  });
}

// ---------- Bardspeak dialect smoke tests ----------

const BARDSPEAK_SHIPPING = [
  { dialect: 'tavern',  expected_tone_cap: 0.11 },
  { dialect: 'viking',  expected_tone_cap: 0.10 },
  { dialect: 'dragonlance', expected_tone_cap: 0.13 },
  { dialect: 'dnd',         expected_tone_cap: 0.13 },
  { dialect: 'tolkien',     expected_tone_cap: 0.22 },
];

for (const { dialect, expected_tone_cap } of BARDSPEAK_SHIPPING) {
  test(`loadDialect: bardspeak/${dialect} loads with required pieces`, () => {
    const root = join(__dirname, '..');
    const loaded = loadDialect('bardspeak', dialect, { root });

    assert.equal(loaded.name, `tonespeak-bardspeak-${dialect}`);
    assert.ok(loaded.description.length > 0);
    assert.ok(loaded.reminder.length > 0);
    assert.ok(loaded.reminder.length <= 200, `reminder ${loaded.reminder.length} chars (max 200)`);
    assert.ok(loaded.skill.length > 800, `skill body substantial (got ${loaded.skill.length})`);
    assert.equal(loaded.axes.tone_cap, expected_tone_cap);

    assert.ok(loaded.skill.includes('Voice anchor'));
    assert.ok(loaded.skill.includes('Compression rules'));
    assert.ok(loaded.skill.includes('Auto-clarity'));
    assert.ok(loaded.skill.includes('Boundaries'));
  });

  test(`loadDialect: bardspeak/${dialect} lite preset strips fenced flavor blocks`, () => {
    const root = join(__dirname, '..');
    const loaded = loadDialect('bardspeak', dialect, { root, preset: 'lite' });

    assert.equal(loaded.axes.trope_frequency, 'off');
    assert.equal(loaded.axes.self_reference, 'off');
    assert.ok(!loaded.skill.match(/^## Tropes\b/m), `${dialect}: tropes section stripped under lite`);
    assert.ok(!loaded.skill.match(/^## Self-reference\b/m), `${dialect}: self-reference section stripped under lite`);
    assert.ok(loaded.skill.includes('Compression rules'));
    assert.ok(loaded.skill.includes('Auto-clarity'));
  });
}

// ---------- Stylespeak dialect smoke tests ----------

const STYLESPEAK_SHIPPING = [
  { dialect: 'cavespeak',    expected_tone_cap: 0.12 },
  { dialect: 'noir',         expected_tone_cap: 0.10 },
  { dialect: 'cyberpunk',    expected_tone_cap: 0.11 },
  { dialect: 'steampunk',    expected_tone_cap: 0.16 },
  { dialect: 'pirate',       expected_tone_cap: 0.13 },
  { dialect: 'western',      expected_tone_cap: 0.11 },
  { dialect: 'deadpan',      expected_tone_cap: 0.14 },
  { dialect: 'renfaire',     expected_tone_cap: 0.16 },
  { dialect: 'shakespearean', expected_tone_cap: 0.28 },
  { dialect: 'laconic',      expected_tone_cap: 0.07 },
];

for (const { dialect, expected_tone_cap } of STYLESPEAK_SHIPPING) {
  test(`loadDialect: stylespeak/${dialect} loads with required pieces`, () => {
    const root = join(__dirname, '..');
    const loaded = loadDialect('stylespeak', dialect, { root });

    assert.equal(loaded.name, `tonespeak-stylespeak-${dialect}`);
    assert.ok(loaded.description.length > 0);
    assert.ok(loaded.reminder.length > 0);
    assert.ok(loaded.reminder.length <= 200, `reminder ${loaded.reminder.length} chars (max 200)`);
    assert.ok(loaded.skill.length > 800, `skill body substantial (got ${loaded.skill.length})`);
    assert.equal(loaded.axes.tone_cap, expected_tone_cap);

    assert.ok(loaded.skill.includes('Voice anchor'));
    assert.ok(loaded.skill.includes('Compression rules'));
    assert.ok(loaded.skill.includes('Auto-clarity'));
    assert.ok(loaded.skill.includes('Boundaries'));
  });

  test(`loadDialect: stylespeak/${dialect} lite preset strips fenced flavor blocks`, () => {
    const root = join(__dirname, '..');
    const loaded = loadDialect('stylespeak', dialect, { root, preset: 'lite' });

    assert.equal(loaded.axes.trope_frequency, 'off');
    assert.equal(loaded.axes.self_reference, 'off');
    assert.ok(!loaded.skill.match(/^## Tropes\b/m), `${dialect}: tropes section stripped under lite`);
    assert.ok(!loaded.skill.match(/^## Self-reference\b/m), `${dialect}: self-reference section stripped under lite`);
    assert.ok(loaded.skill.includes('Compression rules'));
    assert.ok(loaded.skill.includes('Auto-clarity'));
  });
}
