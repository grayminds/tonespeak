// tonespeak/src/lib/config.js
//
// Persistent user preferences at ~/.tonespeak/config.json.
//
// Schema:
//   default_mode:        "cavespeak" | "bardspeak" | "spacespeak"
//   default_dialect:     family-appropriate dialect slug
//   default_lite:        boolean
//   tone_cap:            number 0..1
//   statusline_enabled:  boolean
//   telemetry_enabled:   boolean
//   auto_activate:       boolean
//
// Config is separate from ~/.tonespeak/state.json (mutable session state) and
// from ~/.tonespeak/levels.json (per-axis tone overrides).  See spec §7.4, §7.5.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { resolveHome } from './home.js';

export const DEFAULT_CONFIG = Object.freeze({
  default_mode: 'spacespeak',
  default_dialect: 'missioncontrol',
  default_lite: false,
  tone_cap: 0.12,
  statusline_enabled: true,
  telemetry_enabled: true,
  auto_activate: true,
});

export const VALID_FAMILIES = Object.freeze(['bardspeak', 'spacespeak', 'stylespeak']);

export function getConfigDir() {
  return process.env.TONESPEAK_CONFIG_DIR || join(resolveHome(), '.tonespeak');
}

export function configPath() {
  return process.env.TONESPEAK_CONFIG || join(getConfigDir(), 'config.json');
}

export function ensureConfigDir() {
  const dir = getConfigDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  return dir;
}

export function readConfig() {
  const path = configPath();
  if (!existsSync(path)) return { ...DEFAULT_CONFIG };

  try {
    const raw = readFileSync(path, 'utf8');
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch (err) {
    process.stderr.write(`[tonespeak] config.json unreadable (${err.message});  using defaults\n`);
    return { ...DEFAULT_CONFIG };
  }
}

export function writeConfig(partial) {
  ensureConfigDir();
  const current = readConfig();
  const merged = { ...current, ...partial };
  validateConfig(merged);
  writeFileSync(configPath(), JSON.stringify(merged, null, 2) + '\n', { mode: 0o600 });
  return merged;
}

export function validateConfig(cfg) {
  if (!VALID_FAMILIES.includes(cfg.default_mode)) {
    throw new Error(`default_mode must be one of ${VALID_FAMILIES.join(', ')}`);
  }
  if (typeof cfg.default_dialect !== 'string' || !cfg.default_dialect.length) {
    throw new Error('default_dialect must be a non-empty string');
  }
  if (typeof cfg.tone_cap !== 'number' || cfg.tone_cap < 0 || cfg.tone_cap > 1) {
    throw new Error('tone_cap must be a number in [0, 1]');
  }
  for (const key of ['default_lite', 'statusline_enabled', 'telemetry_enabled', 'auto_activate']) {
    if (typeof cfg[key] !== 'boolean') {
      throw new Error(`${key} must be a boolean`);
    }
  }
  return true;
}
