// tests/dispatch.test.js
//
// dispatch.js bridge between slash commands and tracker.js's dispatch core.
// We test buildPrompt() directly and the dispatchTrigger() pipeline by
// shelling out to dispatch.js so the exit-code contract is verified.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { buildPrompt } from '../src/cmd/dispatch.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DISPATCH_JS = join(__dirname, '..', 'src', 'cmd', 'dispatch.js');

let tempDir;
let originalConfigDir;
let originalState;

before(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'tonespeak-dispatch-test-'));
  originalConfigDir = process.env.TONESPEAK_CONFIG_DIR;
  originalState = process.env.TONESPEAK_STATE;
  process.env.TONESPEAK_CONFIG_DIR = tempDir;
  process.env.TONESPEAK_STATE = join(tempDir, 'state.json');
});

after(() => {
  rmSync(tempDir, { recursive: true, force: true });
  if (originalConfigDir === undefined) delete process.env.TONESPEAK_CONFIG_DIR;
  else process.env.TONESPEAK_CONFIG_DIR = originalConfigDir;
  if (originalState === undefined) delete process.env.TONESPEAK_STATE;
  else process.env.TONESPEAK_STATE = originalState;
});

// ---------- buildPrompt unit tests ----------

test('buildPrompt: single token becomes /token', () => {
  assert.equal(buildPrompt(['normal']), '/normal');
});

test('buildPrompt: family + dialect', () => {
  assert.equal(buildPrompt(['spacespeak', 'missioncontrol']), '/spacespeak missioncontrol');
});

test('buildPrompt: family + dialect + lite', () => {
  assert.equal(buildPrompt(['spacespeak', 'missioncontrol', 'lite']), '/spacespeak missioncontrol lite');
});

test('buildPrompt: empty args returns null', () => {
  assert.equal(buildPrompt([]), null);
});

test('buildPrompt: trims trailing empty tokens', () => {
  assert.equal(buildPrompt(['cavespeak', '', '']), '/cavespeak');
});

// ---------- End-to-end CLI tests ----------

function runDispatch(args) {
  try {
    const stdout = execFileSync('node', [DISPATCH_JS, ...args], {
      env: { ...process.env },
      encoding: 'utf8',
    });
    return { stdout, code: 0 };
  } catch (err) {
    return { stdout: err.stdout?.toString() || '', code: err.status ?? 1 };
  }
}

test('CLI: /spacespeak missioncontrol activates and exits 0', () => {
  const r = runDispatch(['spacespeak', 'missioncontrol']);
  assert.equal(r.code, 0);
  assert.match(r.stdout, /Tonespeak active: spacespeak\/missioncontrol/);
});

test('CLI: /spacespeak missioncontrol lite activates with lite preset', () => {
  const r = runDispatch(['spacespeak', 'missioncontrol', 'lite']);
  assert.equal(r.code, 0);
  assert.match(r.stdout, /spacespeak\/missioncontrol.*lite preset/);
});

test('CLI: /bardspeak dragonlance activates (new dialect)', () => {
  const r = runDispatch(['bardspeak', 'dragonlance']);
  assert.equal(r.code, 0);
  assert.match(r.stdout, /bardspeak\/dragonlance/);
});

test('CLI: /bardspeak grimdark rejected as invalid_dialect (exit 1)', () => {
  const r = runDispatch(['bardspeak', 'grimdark']);
  assert.equal(r.code, 1);
  assert.match(r.stdout, /Unknown bardspeak dialect "grimdark"/);
});

test('CLI: /normal deactivates and exits 0', () => {
  runDispatch(['spacespeak', 'missioncontrol']); // seed an active state
  const r = runDispatch(['normal']);
  assert.equal(r.code, 0);
  assert.match(r.stdout, /Tonespeak deactivated/);
});

test('CLI: /tonespeak park with no active state exits 1', () => {
  runDispatch(['normal']); // clear state
  const r = runDispatch(['tonespeak', 'park']);
  assert.equal(r.code, 1);
  assert.match(r.stdout, /Nothing to park/);
});

test('CLI: park + resume round-trip', () => {
  runDispatch(['spacespeak', 'missioncontrol']); // activate
  const park = runDispatch(['tonespeak', 'park']);
  assert.equal(park.code, 0);
  assert.match(park.stdout, /parked: spacespeak\/missioncontrol/);

  const resume = runDispatch(['tonespeak', 'resume']);
  assert.equal(resume.code, 0);
  assert.match(resume.stdout, /resumed: spacespeak\/missioncontrol/);
});

test('CLI: /tonespeak stats returns stub message', () => {
  const r = runDispatch(['tonespeak', 'stats']);
  assert.equal(r.code, 0);
  assert.match(r.stdout, /stats are not implemented yet/);
});

test('CLI: /tonespeak with no subcommand prints help', () => {
  const r = runDispatch(['tonespeak']);
  assert.equal(r.code, 0);
  assert.match(r.stdout, /tonespeak triggers/);
});

test('CLI: /tonespeak bogus exits 1 with unknown_subcommand', () => {
  const r = runDispatch(['tonespeak', 'bogus']);
  assert.equal(r.code, 1);
  assert.match(r.stdout, /Unknown \/tonespeak subcommand "bogus"/);
});

test('CLI: empty argv exits 2', () => {
  const r = runDispatch([]);
  assert.equal(r.code, 2);
});
