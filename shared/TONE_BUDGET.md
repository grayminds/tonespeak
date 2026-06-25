# Tone Budget

The hard cap on dialect-flavored content.  Default 12 percent of output tokens.

## The rule

**Tone-flavored tokens must be at or below `tone_cap` of total output tokens**, averaged across the 15-prompt benchmark set in `BENCHMARK_PROMPTS.md`.

`tone_cap` is the eighth axis in `~/.tonespeak/levels.json` (see spec §7.5).  Default value 0.12.  User-tunable in v0.2 via `tonespeak-studio`.  At v0.1 the cap is fixed at the default.

## What counts as tone-flavored

The linter (`evals/lint.js`) counts these as tone-flavored:

- **Lexicon substitutions** that are *longer* than their plain equivalent.  "Trust-realm" (2 words, bardspeak) replacing "trusted network" (2 words) is a wash and does not count.  "Wifi-weaver" (1 word, hyphenated, ~3 tokens) replacing "access point" (2 words, 2 tokens) is a tone substitution that *adds* a token;  the surplus tokens count.
- **Tropes.**  Mammoth, kennings, technobabble flourishes, theatrical asides.  Each trope-marker occurrence and its supporting context counts in full.
- **Self-reference markers.**  "Caveman," "skald tells," "control to ground," "captain's log," "watch log:".  The marker plus the comma counts.
- **Genre-stylized punctuation.**  "Aye, Captain," "Hark!", "Lo,".  Counts the stylized opener and the following comma or exclamation.

## What does not count

- **Compression itself.**  Dropping articles, linking verbs, and filler is not tone;  it is core compression that every dialect shares.  Those saved tokens belong to compression, not tone.
- **Lexicon substitutions that are shorter or the same length** as the plain term.  "Smash" replacing "delete" saves a token;  the saving belongs to compression, the choice belongs to tone, but it does not eat the budget.
- **Code, errors, paths, quoted text.**  See `PRESERVATION.md`.

## How measured

Per dialect, the eval harness:

1. Runs the 15 benchmark prompts (`BENCHMARK_PROMPTS.md`) three ways:  plain (Arm A), "be concise" (Arm B), with the dialect SKILL.md (Arm C).
2. For each Arm C output, computes `tone_tokens = surplus_lexicon_tokens + trope_tokens + self_reference_tokens + flourish_tokens`.
3. Computes `tone_ratio = tone_tokens / total_output_tokens`.
4. Takes the **median** ratio across the 15 prompts.

A dialect passes the budget if its median is `<= tone_cap`.  A dialect's median above `tone_cap` either fails CI or is marked **flavor-only** in README (tolkien, shakespearean, startrek, doctorwho fall here).

## Why a cap at all

The product promise is "tokens saved with character added."  If a dialect adds 30 percent persona content to save 35 percent connective tissue, the user nets 5 percent in exchange for noise.  That defeats the purpose.  Caveman-class compression with restrained tone wins on both axes.

The cap is per dialect by design.  Users who prefer signature flavor over efficiency can raise `tone_cap` in `levels.json` (v0.2 feature) or pick a flavor-only dialect.

## Self-reference subcap

A separate soft rule:  **self-reference markers at most once per response** (linter warns at 2, fails at 3).  Caveman's "caveman" works once per answer;  three times in one answer is gimmick territory.  This subcap is independent of the global `tone_cap` and applies even when the global cap has headroom.
