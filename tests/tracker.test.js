// tests/tracker.test.js
//
// Smoke tests for trigger parsing.  The tracker hook itself runs as a CLI
// process that reads stdin and writes JSON;  full IO tests land in Phase 7.
//
// We only verify the parseTrigger logic here, which is exported for testing.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTrigger } from '../src/hooks/tracker.js';

test('parseTrigger: /cavespeak', () => {
  const t = parseTrigger('/cavespeak');
  assert.equal(t.kind, 'activate');
  assert.equal(t.family, 'stylespeak');
  assert.equal(t.dialect, 'cavespeak');
  assert.equal(t.lite, false);
});

test('parseTrigger: /bardspeak (defaults to tavern)', () => {
  const t = parseTrigger('/bardspeak');
  assert.equal(t.kind, 'activate');
  assert.equal(t.family, 'bardspeak');
  assert.equal(t.dialect, 'tavern');
});

test('parseTrigger: /bardspeak viking (named, non-default)', () => {
  const t = parseTrigger('/bardspeak viking');
  assert.equal(t.kind, 'activate');
  assert.equal(t.family, 'bardspeak');
  assert.equal(t.dialect, 'viking');
});

test('parseTrigger: /bardspeak dragonlance', () => {
  const t = parseTrigger('/bardspeak dragonlance');
  assert.equal(t.kind, 'activate');
  assert.equal(t.family, 'bardspeak');
  assert.equal(t.dialect, 'dragonlance');
});

test('parseTrigger: /bardspeak grimdark (replaced dialect) returns invalid_dialect', () => {
  // grimdark was replaced by dragonlance in v0.2.2 of the spec.  Confirm the
  // old slug is now rejected by the validator.
  const t = parseTrigger('/bardspeak grimdark');
  assert.equal(t.kind, 'invalid_dialect');
  assert.equal(t.dialect, 'grimdark');
});

test('parseTrigger: /stylespeak renfaire', () => {
  const t = parseTrigger('/stylespeak renfaire');
  assert.equal(t.kind, 'activate');
  assert.equal(t.family, 'stylespeak');
  assert.equal(t.dialect, 'renfaire');
});

test('parseTrigger: /stylespeak (defaults to noir)', () => {
  const t = parseTrigger('/stylespeak');
  assert.equal(t.kind, 'activate');
  assert.equal(t.family, 'stylespeak');
  assert.equal(t.dialect, 'noir');
});

test('parseTrigger: /spacespeak missioncontrol', () => {
  const t = parseTrigger('/spacespeak missioncontrol');
  assert.equal(t.kind, 'activate');
  assert.equal(t.family, 'spacespeak');
  assert.equal(t.dialect, 'missioncontrol');
});

test('parseTrigger: /spacespeak solarclipper lite', () => {
  const t = parseTrigger('/spacespeak solarclipper lite');
  assert.equal(t.kind, 'activate');
  assert.equal(t.family, 'spacespeak');
  assert.equal(t.dialect, 'solarclipper');
  assert.equal(t.lite, true);
});

test('parseTrigger: /spacespeak lite (no dialect named, lite first)', () => {
  const t = parseTrigger('/spacespeak lite');
  assert.equal(t.dialect, 'missioncontrol'); // default
  assert.equal(t.lite, true);
});

test('parseTrigger: invalid dialect', () => {
  const t = parseTrigger('/spacespeak bogusdialect');
  assert.equal(t.kind, 'invalid_dialect');
  assert.equal(t.family, 'spacespeak');
  assert.ok(t.valid.includes('missioncontrol'));
});

test('parseTrigger: /normal', () => {
  const t = parseTrigger('/normal');
  assert.equal(t.kind, 'normal');
});

test('parseTrigger: /tonespeak stats', () => {
  const t = parseTrigger('/tonespeak stats');
  assert.equal(t.kind, 'subcommand');
  assert.equal(t.subcommand, 'stats');
});

test('parseTrigger: /tonespeak park', () => {
  const t = parseTrigger('/tonespeak park');
  assert.equal(t.kind, 'subcommand');
  assert.equal(t.subcommand, 'park');
});

test('parseTrigger: /tonespeak (bare)', () => {
  const t = parseTrigger('/tonespeak');
  assert.equal(t.kind, 'help');
});

test('parseTrigger: /tonespeak <dialect> activates across families', () => {
  const noir = parseTrigger('/tonespeak noir');
  assert.equal(noir.kind, 'activate');
  assert.equal(noir.family, 'stylespeak');
  assert.equal(noir.dialect, 'noir');

  const missioncontrol = parseTrigger('/tonespeak missioncontrol');
  assert.equal(missioncontrol.kind, 'activate');
  assert.equal(missioncontrol.family, 'spacespeak');
  assert.equal(missioncontrol.dialect, 'missioncontrol');

  const viking = parseTrigger('/tonespeak viking');
  assert.equal(viking.family, 'bardspeak');

  const cave = parseTrigger('/tonespeak cavespeak');
  assert.equal(cave.family, 'stylespeak');
  assert.equal(cave.dialect, 'cavespeak');
});

test('parseTrigger: /tonespeak <dialect> lite carries the preset', () => {
  const t = parseTrigger('/tonespeak galactica lite');
  assert.equal(t.kind, 'activate');
  assert.equal(t.family, 'spacespeak');
  assert.equal(t.dialect, 'galactica');
  assert.equal(t.lite, true);
});

test('parseTrigger: /tonespeak <unknown> stays a subcommand (error path)', () => {
  const t = parseTrigger('/tonespeak bogusdialect');
  assert.equal(t.kind, 'subcommand');
  assert.equal(t.subcommand, 'bogusdialect');
});

test('parseTrigger: non-trigger returns null', () => {
  assert.equal(parseTrigger('regular user message'), null);
  assert.equal(parseTrigger(''), null);
  assert.equal(parseTrigger('/unknown-command'), null);
});

test('parseTrigger: case-insensitive command name', () => {
  const t = parseTrigger('/Spacespeak Solarclipper Lite');
  assert.equal(t.kind, 'activate');
  assert.equal(t.family, 'spacespeak');
  assert.equal(t.dialect, 'solarclipper');
  assert.equal(t.lite, true);
});

test('parseTrigger: leading whitespace tolerated', () => {
  const t = parseTrigger('   /spacespeak missioncontrol');
  assert.equal(t.kind, 'activate');
});
