// tests/config.test.js
//
// Config schema validation and defaults.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

let tempDir;
let originalConfigDir;

before(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'tonespeak-config-test-'));
  originalConfigDir = process.env.TONESPEAK_CONFIG_DIR;
  process.env.TONESPEAK_CONFIG_DIR = tempDir;
});

after(() => {
  rmSync(tempDir, { recursive: true, force: true });
  if (originalConfigDir === undefined) delete process.env.TONESPEAK_CONFIG_DIR;
  else process.env.TONESPEAK_CONFIG_DIR = originalConfigDir;
});

test('readConfig: returns defaults when no file', async () => {
  const { readConfig, DEFAULT_CONFIG } = await import('../src/lib/config.js');
  const cfg = readConfig();
  assert.equal(cfg.default_mode, DEFAULT_CONFIG.default_mode);
  assert.equal(cfg.tone_cap, 0.12);
  assert.equal(cfg.auto_activate, true);
});

test('writeConfig + readConfig: round-trip', async () => {
  const { writeConfig, readConfig } = await import('../src/lib/config.js');
  writeConfig({ default_mode: 'bardspeak', default_dialect: 'dragonlance', tone_cap: 0.08 });
  const cfg = readConfig();
  assert.equal(cfg.default_mode, 'bardspeak');
  assert.equal(cfg.default_dialect, 'dragonlance');
  assert.equal(cfg.tone_cap, 0.08);
  // Unchanged fields keep their defaults
  assert.equal(cfg.auto_activate, true);
});

test('validateConfig: rejects bad family', async () => {
  const { validateConfig, DEFAULT_CONFIG } = await import('../src/lib/config.js');
  assert.throws(
    () => validateConfig({ ...DEFAULT_CONFIG, default_mode: 'WRONG' }),
    /default_mode/
  );
});

test('validateConfig: rejects out-of-range tone_cap', async () => {
  const { validateConfig, DEFAULT_CONFIG } = await import('../src/lib/config.js');
  assert.throws(
    () => validateConfig({ ...DEFAULT_CONFIG, tone_cap: 1.5 }),
    /tone_cap/
  );
  assert.throws(
    () => validateConfig({ ...DEFAULT_CONFIG, tone_cap: -0.1 }),
    /tone_cap/
  );
});

test('validateConfig: rejects non-boolean toggles', async () => {
  const { validateConfig, DEFAULT_CONFIG } = await import('../src/lib/config.js');
  assert.throws(
    () => validateConfig({ ...DEFAULT_CONFIG, auto_activate: 'yes' }),
    /boolean/
  );
});
