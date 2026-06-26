# Changelog

All notable changes to this project are documented here.  The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project aims to
follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html) from v1.0.0.
Before v1.0.0 the API should be treated as unstable.

## [Unreleased]

## [0.1.1] - 2026-06-25

### Changed

- Deepened genre flavor across 14 dialects, with immersion carried by structure,
  idiom, cadence, and rewritten examples rather than thicker vocabulary:  viking
  (loud mythic saga, alliterative drum-cadence), startrek (the McCoy-Spock bridge
  rivalry and the Worf-Riker-Picard command chain), deadpan (a threaded dry aside
  plus one closer), cyberpunk, western, steampunk, shakespearean, missioncontrol,
  expanse, solarclipper, starwars, doctorwho, galactica, and stargate.

### Tone budget

- Six labeled cap increases for flavor-leaning dialects:  startrek 0.17 -> 0.20,
  viking 0.10 -> 0.15, steampunk 0.16 -> 0.19, starwars 0.10 -> 0.12, doctorwho
  0.22 -> 0.25, stargate 0.11 -> 0.13.  Lean dialects held to protect efficiency.

## [0.1.0] - 2026-06-25

First public release.

### Added

- Three persona families with twenty-four dialects total:  bardspeak (tavern,
  viking, dnd, dragonlance, tolkien), spacespeak (missioncontrol, solarclipper,
  expanse, firefly, startrek, starwars, doctorwho, galactica, stargate), and
  stylespeak (cavespeak, noir, cyberpunk, steampunk, pirate, western, deadpan,
  renfaire, shakespearean, laconic).
- `laconic` (stylespeak):  the highest-compression dialect, where economy itself
  is the voice -- verb-first, no preamble, no hedging, one-line verdicts -- with
  a hard preservation rule for load-bearing technical terms.
- Pure-skill architecture:  two hooks (SessionStart, UserPromptSubmit) plus slash
  commands.  No string-transforming runtime middleware.
- A strict per-dialect tone budget, enforced and measured by the eval harness.
- Slash commands:  `/bardspeak`, `/spacespeak`, `/stylespeak`, `/cavespeak`,
  `/tonespeak` (call any dialect by name;  family auto-resolved), and `/normal`.
  A `lite` preset turns trope frequency and self-reference down.
- A zero-dependency installer (`bin/install.js`) with idempotent install,
  non-interactive flags, and uninstall.
- A three-arm eval harness comparing unprompted, terse, and dialect output, with
  a budget cap and an aggregated markdown report.

### Notes

- The published reduction figures are reported against a terse ("be concise")
  baseline, which is the honest comparison;  per-dialect numbers live in
  `benchmarks/results/`.  A few dialects (tolkien among them) are deliberate
  flavor modes that spend length on voice.

[Unreleased]: https://github.com/grayminds/tonespeak/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/grayminds/tonespeak/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/grayminds/tonespeak/releases/tag/v0.1.0
