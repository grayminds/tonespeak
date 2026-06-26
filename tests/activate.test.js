// tests/activate.test.js
//
// Smoke tests for the SessionStart hook.  Spawns the script as a subprocess
// and verifies basic stdout behavior.  Also unit-tests the pure
// applySessionBoundary() function for session-scoped state management.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, cpSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { applySessionBoundary } from '../src/hooks/activate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ACTIVATE = join(__dirname, '..', 'src', 'hooks', 'activate.js');
const FIXTURE = join(__dirname, 'fixtures', 'fixture-dialect.md');

let tempDir;

before(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'tonespeak-activate-test-'));
});

after(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function runActivate(stdinJson, env = {}) {
  return spawnSync(process.execPath, [ACTIVATE], {
    input: stdinJson,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    timeout: 5000,
  });
}

test('activate: exits cleanly with empty config', () => {
  // auto_activate=true by default;  but with no dialect files at the real path,
  // it falls back to STANDALONE_FALLBACK.
  const result = runActivate(JSON.stringify({ session_id: 'smoke-test-1' }), {
    TONESPEAK_CONFIG_DIR: tempDir,
  });
  assert.equal(result.status, 0, `exit status ${result.status};  stderr: ${result.stderr}`);
  // Either emits a real dialect skill or the fallback;  both are valid.
  assert.ok(result.stdout.length > 0, 'expected some stdout');
});

test('activate: respects auto_activate=false', () => {
  // Write a config with auto_activate=false
  const cfgPath = join(tempDir, 'config.json');
  writeFileSync(cfgPath, JSON.stringify({
    default_mode: 'spacespeak',
    default_dialect: 'ops',
    default_lite: false,
    tone_cap: 0.12,
    statusline_enabled: true,
    telemetry_enabled: true,
    auto_activate: false,
  }, null, 2));

  const result = runActivate(JSON.stringify({ session_id: 'smoke-test-2' }), {
    TONESPEAK_CONFIG_DIR: tempDir,
  });
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), '');
});

// ---------- applySessionBoundary unit tests ----------
//
// Session-scoped activation:  on a new session_id, reset state.active per
// auto_activate (seed defaults if true, clear if false).  Always preserve
// state.parked so cross-session /tonespeak resume continues to work.

const CFG_AUTO = Object.freeze({
  auto_activate: true,
  default_mode: 'spacespeak',
  default_dialect: 'ops',
  default_lite: false,
});

const CFG_MANUAL = Object.freeze({
  auto_activate: false,
  default_mode: 'spacespeak',
  default_dialect: 'ops',
  default_lite: false,
});

test('applySessionBoundary: new session + auto_activate seeds defaults', () => {
  const state = {
    active: { family: 'bardspeak', dialect: 'tolkien', lite: false },
    parked: null,
    session_id: 'old-session',
    set_at: '2026-05-20T00:00:00Z',
  };
  const next = applySessionBoundary(state, 'new-session', CFG_AUTO);
  assert.notEqual(next, state);
  assert.deepEqual(next.active, { family: 'spacespeak', dialect: 'ops', lite: false });
  assert.equal(next.session_id, 'new-session');
});

test('applySessionBoundary: new session + manual clears active, preserves parked', () => {
  const state = {
    active: { family: 'bardspeak', dialect: 'tolkien', lite: false },
    parked: { family: 'spacespeak', dialect: 'doctorwho', lite: false },
    session_id: 'old-session',
    set_at: '2026-05-20T00:00:00Z',
  };
  const next = applySessionBoundary(state, 'new-session', CFG_MANUAL);
  assert.notEqual(next, state);
  assert.equal(next.active, null);
  assert.deepEqual(next.parked, { family: 'spacespeak', dialect: 'doctorwho', lite: false });
  assert.equal(next.session_id, 'new-session');
});

test('applySessionBoundary: same session_id returns same state object (no rewrite)', () => {
  const state = {
    active: { family: 'spacespeak', dialect: 'ops', lite: false },
    parked: null,
    session_id: 'session-A',
    set_at: '2026-05-20T00:00:00Z',
  };
  const next = applySessionBoundary(state, 'session-A', CFG_AUTO);
  assert.equal(next, state);
});

test('applySessionBoundary: null sessionId returns same state object (cannot detect boundary)', () => {
  const state = {
    active: { family: 'spacespeak', dialect: 'ops', lite: false },
    parked: null,
    session_id: 'session-A',
    set_at: '2026-05-20T00:00:00Z',
  };
  const next = applySessionBoundary(state, null, CFG_AUTO);
  assert.equal(next, state);
});

test('applySessionBoundary: first session ever + manual stays clean', () => {
  const state = { active: null, parked: null, session_id: null, set_at: null };
  const next = applySessionBoundary(state, 'first-session', CFG_MANUAL);
  assert.notEqual(next, state);
  assert.equal(next.active, null);
  assert.equal(next.session_id, 'first-session');
});

test('applySessionBoundary: first session ever + auto seeds defaults', () => {
  const state = { active: null, parked: null, session_id: null, set_at: null };
  const next = applySessionBoundary(state, 'first-session', CFG_AUTO);
  assert.notEqual(next, state);
  assert.deepEqual(next.active, { family: 'spacespeak', dialect: 'ops', lite: false });
  assert.equal(next.session_id, 'first-session');
});
