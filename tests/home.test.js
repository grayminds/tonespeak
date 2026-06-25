// tests/home.test.js
//
// resolveHome() must prefer $HOME when set, fall back to os.homedir().

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homedir } from 'node:os';

import { resolveHome } from '../src/lib/home.js';

test('resolveHome: returns $HOME when set and non-empty', () => {
  const original = process.env.HOME;
  process.env.HOME = '/tmp/fake-home';
  try {
    assert.equal(resolveHome(), '/tmp/fake-home');
  } finally {
    if (original === undefined) delete process.env.HOME;
    else process.env.HOME = original;
  }
});

test('resolveHome: falls back to os.homedir() when $HOME unset', () => {
  const original = process.env.HOME;
  delete process.env.HOME;
  try {
    assert.equal(resolveHome(), homedir());
  } finally {
    if (original !== undefined) process.env.HOME = original;
  }
});

test('resolveHome: falls back when $HOME is empty or whitespace', () => {
  const original = process.env.HOME;
  process.env.HOME = '   ';
  try {
    assert.equal(resolveHome(), homedir());
  } finally {
    if (original === undefined) delete process.env.HOME;
    else process.env.HOME = original;
  }
});
