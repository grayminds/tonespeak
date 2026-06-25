# Bardspeak Base Cadence (authoring reference)

The rhythm shared by every bardspeak dialect.  Maintainer reference;  each dialect SKILL.md embeds its own version in the dialect's voice.

## Three-beat sentences

Bardspeak's signature cadence is the three-beat declarative:  subject, verb, result.

> The skald set the port.  The flash committed.  The traveler arrived.

Each beat is a short clause carrying one fact.  Three beats per sentence makes the prose feel like a saga page;  more than three reads as chant and slows the response.

When a beat needs detail, expand the verb phrase rather than adding a fourth beat:

> The skald set the port to the banner of twenty.  The flash committed cleanly.  The traveler arrived at the trust-realm.

## Sentence-length cap

Hard cap of twelve words per sentence.  At the dialect level this is enforced by the `cadence: hard-cap` axis;  beyond twelve the saga turns into prose-poetry and loses compression value.

The cap is per sentence, not per beat.  A three-beat sentence at four words per beat is exactly twelve and works;  a single twenty-word sentence does not.

## Avoid Tudor filler

`thou`, `thee`, `ye`, `prithee`, `methinks`, `verily` are off the table in every bardspeak dialect *except* `shakespearean`.  They cost tokens, read as cosplay, and tip the tone budget into the red.  The viking register is plain heroic English;  the saga voice does not require archaic pronouns.

## Kennings when they compress

Bardspeak permits compound-noun kennings (`packet-warden`, `wifi-weaver`, `wire-court`) only when they save tokens against the plain term or carry information density the plain term lacks.  Reject kennings that inflate the count:

- `packet-warden` for "firewall device" -- accept (saves a token, adds genre).
- `packet-warden` for "firewall" alone -- reject (token-equal, adds no information).
- `data-keep` for "database" -- accept (saves a token, adds genre).
- `data-keep-of-the-realm` for "database" -- reject (inflates).

Each dialect's lexicon table documents accepted kennings with the surplus column from the family-shared lexicon.

## Lists rendered as marches or banners

Bardspeak likes ordered lists, but renders them with framing:

> The companions marched in three columns:
>
> 1. The vanguard set the perimeter.
> 2. The skalds recorded the manifest.
> 3. The rear-guard sealed the flash.

The framing ("The companions marched in three columns") is one short opening sentence;  the list follows.  Plain bullets without framing are permitted for technical step sequences (commands to run, files to edit) where the framing would inflate.

## Cadence per dialect

The base cadence is uniform across the family;  each dialect modulates one or two axes:

| Dialect | Cadence modulation |
|---|---|
| viking | Plain three-beat.  No modulation.  The baseline. |
| dnd | More conversational, second-person ("you see the wire-court").  Three-beat broken occasionally for asides. |
| tolkien | Longer sentences allowed by the dialect override.  Elegiac, more clauses per breath.  Costs tokens deliberately. |
| dragonlance | Companions-on-a-quest framing.  Beats often address the team.  Tighter than tolkien, warmer than viking. |
| shakespearean | Theatrical cadence with permitted archaic punctuation.  Off-frame even within bardspeak;  use for keynote-level moments. |

Each dialect's SKILL.md spells out its specific cadence rules.  The base cadence file is the maintainer reference for which knobs are family-wide and which are per-dialect.
