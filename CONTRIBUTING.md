# Contributing to tonespeak

Thanks for your interest.  tonespeak is a small, dependency-free project;  the
contribution surface is correspondingly simple.

## Setup

```bash
git clone https://github.com/grayminds/tonespeak.git
cd tonespeak
npm test          # 152 pass, 1 skipped (POSIX-only)
```

There are no dependencies to install.  Everything runs on the Node standard
library (Node 18 or newer;  tested on Node 24).

## Ground rules

- **Line endings are LF.**  `.gitattributes` enforces LF in the working tree on
  every platform.  The frontmatter loader is also CRLF-tolerant, but do not rely
  on that;  keep files LF.
- **Run the tests before opening a pull request.**  Use `npm test`, not
  `node --test tests/` (the bare form fails on Node 24;  the quoted glob in the
  npm script is deliberate).
- **Keep the architecture pure-skill.**  The model reads and applies a dialect's
  rules itself.  There is no string-transforming runtime middleware, and adding
  one is out of scope.

## Adding or changing a dialect

A dialect is a single self-contained file at `<family>/dialects/<dialect>.md`.
Read `shared/DIALECT_AUTHORING_GUIDE.md` first.  The core principles:

- A dialect is a style or register, not a proper-noun lookup table.  Immersion
  comes from cadence, grammar, and information-carrying idiom, not a thicker
  word-swap table.
- Every dialect ships the full structure:  eight-axis frontmatter, a voice
  anchor, compression rules, preservation rules, lexicon, fenced trope and
  self-reference blocks (each closed with `<!-- end -->`), auto-clarity triggers
  and boundaries, four canonical examples, and anti-patterns.
- Respect the tone budget.  Each dialect declares a `tone_cap`;  the eval harness
  measures against it.

When you add a dialect, register it in `evals/dialect-config.js` and
`src/hooks/tracker.js`, then add it to the relevant smoke test.

## Measuring a change

The three-arm eval shells out to the `claude` CLI to compare an unprompted arm,
a "be concise" arm, and the dialect arm.  See `evals/README.md`.  Calls run from
an isolated working directory so the model never sees the repository.

## Commit style

Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`).  Keep the subject
under about 72 characters and explain the why in the body when it is not obvious.
