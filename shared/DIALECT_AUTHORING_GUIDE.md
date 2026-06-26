# Dialect Authoring Guide

How to write a new dialect SKILL.md for tonespeak.  This is the reference document for anyone (maintainer, contributor, or AI agent) building a new dialect file.

## Where the file goes

- Single-dialect family:  `<family>/SKILL.md` (none today;  cavespeak moved into stylespeak as a normal dialect).
- Multi-dialect family:  `<family>/dialects/<dialect>.md`.

The file is **monolithic and self-contained.**  The runtime loader reads exactly this one file (plus applies levels.json overrides and any active preset).  No file stitching at runtime.

## File structure

Every dialect SKILL.md has:

1. **YAML frontmatter** with required fields (see below).
2. **Voice anchor** in one or two paragraphs.  What the voice sounds like.
3. **Compression rules** in dialect voice (the ten rules from `COMPRESSION_CORE.md`).
4. **Preservation block** in dialect voice (what to never compress).
5. **Lexicon table** of plain-term to dialect-term mappings.
6. **Cadence rules** for sentence shape and length.
7. **Tropes section** wrapped in a `when:trope_frequency` marker fence.
8. **Self-reference section** wrapped in a `when:self_reference` marker fence.
9. **Structural protocols section** wrapped in a `when:protocols` marker fence.  (Spacespeak family;  bardspeak has a similar "banner lists" block.)
10. **Auto-Clarity / Boundaries** verbatim from `AUTO_CLARITY.md`, translated into dialect voice.
11. **Examples** showing the dialect on three to five representative prompts.

## Required frontmatter

```yaml
---
name: tonespeak-<family>-<dialect>
description: <one-sentence summary including expected token reduction>
reminder: |
  TONESPEAK <family>/<dialect> active.  <one or two sentences re-stating the most important compression and voice rules.>
axes:
  compression: low | med | high | ultra
  lexicon_rate: sparse | moderate | heavy
  trope_frequency: off | occasional | signature
  self_reference: off | rationed | free
  cadence: loose | tight | hard-cap
  protocols: off | situational | always
  auto_clarity: relaxed | standard | aggressive
  tone_cap: 0.07 - 0.30
---
```

The `reminder` field is what the UserPromptSubmit hook re-injects every turn to anchor the dialect.  Cap it at 200 characters.  Cap the length;  the per-turn reminder must not consume the savings.

The `axes` values are the dialect's **defaults**.  User overrides in `~/.tonespeak/levels.json` and active presets can adjust these at runtime.

## Marker fences

Conditional blocks use:

```markdown
<!-- when:<condition> -->
Block body included only when condition is true after axis merge.
<!-- end -->
```

Condition forms:

- `axis=value` exact match
- `axis>=value` at-or-above ordering
- `axis<=value` at-or-below ordering
- `axis!=value` negation
- `axis>=A & axis<=B` AND join
- `axis=A | axis=B` OR join

Numeric axes (`tone_cap`) compare by numeric value:  `tone_cap>=0.15`.

Malformed condition fails open (block stays).  Loader logs a stderr warning.

## Axis ordering reference

| Axis | Ordering (low → high) |
|---|---|
| compression | low, med, high, ultra |
| lexicon_rate | sparse, moderate, heavy |
| trope_frequency | off, occasional, signature |
| self_reference | off, rationed, free |
| cadence | loose, tight, hard-cap |
| protocols | off, situational, always |
| auto_clarity | relaxed, standard, aggressive |
| tone_cap | numeric 0.0 to 1.0 |

`off`-like values are the lowest in their ordering;  reading "`trope_frequency>=occasional`" means "tropes are on at least at the occasional level."

## Tone budget guidance

Each dialect targets a specific `tone_cap`:

| Cap | Style | Notes |
|---|---|---|
| 0.07 | Lean | expanse |
| 0.08 - 0.10 | Default | missioncontrol, firefly, starwars, viking, noir, galactica |
| 0.11 - 0.14 | Standard | solarclipper, cavespeak, dnd, dragonlance, stargate, cyberpunk, pirate, western, deadpan |
| 0.15 - 0.20 | Flavor-leaning | renfaire, steampunk, startrek |
| 0.20 - 0.30 | Flavor-only | tolkien, doctorwho, shakespearean |

Flavor-only dialects ship with a clear "flavor mode, not efficiency mode" note in their SKILL.md body.

## Immersion should be free, not token-positive (read this before adding lexicon)

The single most important authoring principle, learned from the dialects that work best.  Immersion and efficiency are **not** opposed.  The strongest dialects in the family -- expanse, nasa, dnd, solarclipper -- are deeply immersive AND the most efficient, because their immersion comes from three nearly-free channels:

1. **Structural / grammatical signatures.**  Expanse's Lang Belta is structural, not lexical:  drop the copula, put `na` before the verb, tag with `ke?`.  These read unmistakably alien and cost almost nothing.  A grammar tell is free;  a word-swap is not.
2. **Information-carrying tropes.**  D&D's "DC 20 to debug this race condition" *replaces* a hedging sentence -- the trope IS the compression.  NASA's go/no-go poll and `T+` stamps carry real state in genre-true idiom.  Tolkien's "the long defeat" names tech debt exactly.
3. **Cadence and concrete specificity.**  Solarclipper's "name the bean and the grinder."  Sentence rhythm and precise detail immerse without a thicker vocabulary table.

The dialects that read as thin reskins are thin because their flavor lives in the **vocabulary + framing layer** -- openers, closers, and a pile of word-swaps -- which leaks tokens and burns the `tone_cap`.  When you reach for immersion, reach for structure, idiom, and information-carrying tropes FIRST.  Add a vocabulary substitution only when it is shorter-or-even with the plain term, or rare enough to pay for itself.

**Authoring checklist item:**  for every immersion device you add, ask -- *is this free or token-positive?*  Grammar tells, cadence rules, and tropes that carry information are free;  prefer them.  A lexicon substitution longer than its plain term is token-positive;  justify it as rare flavor or cut it.  Do NOT chase "fully immersive" by raising `tone_cap` -- chase it by moving immersion off the word-swap layer.

## How to test a new dialect

1. Run `node bin/install.js --dry-run --list` to verify the dialect file is discoverable.
2. Run `node evals/three-arm-eval.js --dialect=<family>/<dialect>` to benchmark.  Output to `evals/snapshots/<family>-<dialect>.json`.
3. Run `node evals/lint.js evals/snapshots/<family>-<dialect>.json` to check the tone ratio and anti-pattern fire rate.
4. Tone ratio above declared `tone_cap` either tightens the dialect or relabels it as flavor-only.
5. Anti-pattern hits require a rewrite of the offending dialect section.

## Common authoring mistakes

- **Forgetting Auto-Clarity.**  Without it the dialect produces dangerous terse responses on destructive operations.  Required.
- **Stylizing inside code blocks.**  See `PRESERVATION.md`.  Linter catches this.
- **Lexicon substitutions longer than the plain term.**  Eats the budget;  audit the lexicon for length.
- **Too many tropes in the examples.**  Examples set the tone for the model;  if the examples are three tropes per response, the model will follow.
- **`reminder` field over 200 characters.**  Eats per-turn savings;  hook truncates.
