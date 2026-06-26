// tonespeak/src/lib/home.js
//
// Cross-platform home-directory resolution.  Node's os.homedir() returns
// %USERPROFILE% on Windows and ignores $HOME, even when the user has
// deliberately set $HOME to a non-default location (e.g. a D:-drive home
// where dotfiles and config actually live).  This helper honors $HOME when
// it is set and non-empty, falling back to os.homedir() otherwise.  POSIX
// hosts already resolve homedir() via $HOME, so behavior there is unchanged.
//
// Scope:  use resolveHome() for tonespeak's own data (config.json,
// state.json, sessions/).  Keep os.homedir() for probes of third-party tool
// locations (VSCode extensions, OS-default app data) that themselves use
// %USERPROFILE% on Windows regardless of $HOME.

import { homedir } from 'node:os';

export function resolveHome() {
  const fromEnv = process.env.HOME;
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) {
    return fromEnv;
  }
  return homedir();
}
