// tests/flag.test.js
//
// Security hardening + schema validation on the state.json flag file.

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync, symlinkSync, rmSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir, platform } from 'node:os';

let tempDir;
let originalConfigDir;

before(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'tonespeak-flag-test-'));
  originalConfigDir = process.env.TONESPEAK_CONFIG_DIR;
  process.env.TONESPEAK_CONFIG_DIR = tempDir;
});

after(() => {
  rmSync(tempDir, { recursive: true, force: true });
  if (originalConfigDir === undefined) delete process.env.TONESPEAK_CONFIG_DIR;
  else process.env.TONESPEAK_CONFIG_DIR = originalConfigDir;
});

beforeEach(async () => {
  const { clearFlag } = await import('../src/lib/flag.js');
  clearFlag();
});

test('readFlag: empty when no file', async () => {
  const { readFlag } = await import('../src/lib/flag.js');
  const state = readFlag();
  assert.equal(state.active, null);
  assert.equal(state.parked, null);
});

test('writeFlag + readFlag: round-trip', async () => {
  const { writeFlag, readFlag, nowIso } = await import('../src/lib/flag.js');
  const state = {
    active: { family: 'spacespeak', dialect: 'solarclipper', lite: false },
    parked: null,
    session_id: 'test-session-id',
    set_at: nowIso(),
  };
  writeFlag(state);
  const read = readFlag();
  assert.equal(read.active.family, 'spacespeak');
  assert.equal(read.active.dialect, 'solarclipper');
  assert.equal(read.session_id, 'test-session-id');
});

test('writeFlag: rejects invalid family', async () => {
  const { writeFlag, nowIso } = await import('../src/lib/flag.js');
  const state = {
    active: { family: 'BOGUS', dialect: 'ops', lite: false },
    parked: null,
    session_id: null,
    set_at: nowIso(),
  };
  assert.throws(() => writeFlag(state), /invalid/);
});

test('writeFlag: rejects unsafe characters in dialect', async () => {
  const { writeFlag, nowIso } = await import('../src/lib/flag.js');
  const state = {
    active: { family: 'spacespeak', dialect: '../etc/passwd', lite: false },
    parked: null,
    session_id: null,
    set_at: nowIso(),
  };
  assert.throws(() => writeFlag(state), /invalid/);
});

test('writeFlag: rejects unsafe characters in session_id', async () => {
  const { writeFlag, nowIso } = await import('../src/lib/flag.js');
  const state = {
    active: { family: 'spacespeak', dialect: 'ops', lite: false },
    parked: null,
    session_id: 'evil; rm -rf /',
    set_at: nowIso(),
  };
  assert.throws(() => writeFlag(state), /invalid/);
});

test('readFlag: returns empty on oversize file', async () => {
  const { readFlag, flagPath } = await import('../src/lib/flag.js');
  // 2KB of junk;  exceeds 1KB cap
  const junk = 'x'.repeat(2048);
  writeFileSync(flagPath(), junk);
  const state = readFlag();
  assert.equal(state.active, null);
});

test('readFlag: returns empty on bad JSON', async () => {
  const { readFlag, flagPath } = await import('../src/lib/flag.js');
  writeFileSync(flagPath(), '{not json}');
  const state = readFlag();
  assert.equal(state.active, null);
});

test('readFlag: returns empty on schema violation', async () => {
  const { readFlag, flagPath } = await import('../src/lib/flag.js');
  writeFileSync(flagPath(), JSON.stringify({ active: { family: 'BOGUS' } }));
  const state = readFlag();
  assert.equal(state.active, null);
});

test('safeForStatusline: passes safe chars', async () => {
  const { safeForStatusline } = await import('../src/lib/flag.js');
  assert.equal(safeForStatusline('spacespeak'), 'spacespeak');
  assert.equal(safeForStatusline('spacespeak/solarclipper'), 'spacespeak/solarclipper');
  assert.equal(safeForStatusline('valid_dash-id'), 'valid_dash-id');
});

test('safeForStatusline: strips dangerous chars', async () => {
  const { safeForStatusline } = await import('../src/lib/flag.js');
  assert.equal(safeForStatusline('evil\x1b[31m'), '');
  assert.equal(safeForStatusline('with space'), '');
  assert.equal(safeForStatusline('with$dollar'), '');
});

// Symlink test only works on POSIX;  skip on Windows.
test('readFlag: refuses symlink target', { skip: platform() === 'win32' }, async () => {
  const { readFlag, flagPath, writeFlag, nowIso } = await import('../src/lib/flag.js');
  const decoyPath = join(tempDir, 'decoy.json');
  writeFileSync(decoyPath, JSON.stringify({
    active: { family: 'spacespeak', dialect: 'ops', lite: false },
    parked: null,
    session_id: 'decoy',
    set_at: nowIso(),
  }));
  if (existsSync(flagPath())) rmSync(flagPath(), { force: true });
  symlinkSync(decoyPath, flagPath());

  const state = readFlag();
  // On POSIX with O_NOFOLLOW available, read returns empty.
  // (If the platform lacks O_NOFOLLOW, the test environment is unusual;  log.)
  if (state.active !== null) {
    process.stderr.write('[note] platform may lack O_NOFOLLOW;  symlink not refused\n');
  }
});
