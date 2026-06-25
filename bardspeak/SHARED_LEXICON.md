# Bardspeak Shared Lexicon (authoring reference)

The substitution table shared by every bardspeak dialect.  Maintainer reference;  each dialect SKILL.md embeds its own copy (the loader does not stitch shared lexicons at runtime).

## Shared table

| Plain term | Bardspeak | Plain tokens | Dialect tokens | Surplus |
|---|---|---|---|---|
| access point | wifi-weaver | 2 | 1 | -1 (savings) |
| firewall device | packet-warden | 2 | 1 | -1 (savings) |
| firewall (alone) | (keep as firewall) | 1 | 1 | 0 |
| trusted network | trust-realm | 2 | 1 | -1 (savings) |
| quarantine network | ghost-tier | 2 | 1 | -1 (savings) |
| managed switch | wire-court | 2 | 2 | 0 |
| trunk port | many-realm gate | 2 | 3 | 1 |
| VLAN | banner | 1 | 1 | 0 |
| device group | order | 2 | 1 | -1 (savings) |
| IoT device | thrall | 2 | 1 | -1 (savings) |
| smart TV / media | song-thrall | 3 | 1 | -2 (savings) |
| camera | watch-thrall | 1 | 1 | 0 |
| problem | shadow | 1 | 1 | 0 |
| solution | mending | 1 | 1 | 0 |
| complete | sealed | 1 | 1 | 0 |
| migration | march | 1 | 1 | 0 |
| configuration | charter | 1 | 1 | 0 |
| database | data-keep | 1 | 1 | 0 |
| user | traveler | 1 | 1 | 0 |
| approve | "well met" | 1 | 2 | 1 |
| acknowledge | "the realm hears" | 1 | 3 | 2 |
| start | engage / march | 1 | 1 | 0 |

The shared lexicon is net token-positive (more savings than surplus).  The two surplus entries (`many-realm gate` for trunk port, `well met` for approve) are accepted because they carry genre weight in dialogues where their substitution is iconic, but they cost the budget and should not appear casually.

## Dialect-specific lexicon

Each dialect adds its own table on top of the shared one.  Dialect-specific terms encode the franchise / register flavor:

| Dialect | What its extra lexicon does |
|---|---|
| viking | Adds nothing.  The default.  Plain saga prose, just the shared table. |
| dnd | Adds DM-narration vocabulary:  roll for it, perception check, DC 15, nat 20, party, gain XP. |
| tolkien | Adds elegy framing:  "in the days of," "long was the road," "the elder days," "sundered," "of old." |
| dragonlance | Adds 80s-pulp companions vocabulary:  the companions, the quest, the realm, the tavern, the inn, the wizard, the knight, the map, the dragon, Est Sularus oth Mithas. |
| shakespearean | Adds theatrical vocabulary:  hark, lo, yonder, doth, methinks, fie.  Permitted overrides for this dialect only. |

## Authoring principle

Bardspeak's value proposition is "saga discipline with character."  Lexicon must enforce discipline (compress, structure) or character (genre), but never both at the cost of comprehension.

Reject lexicon entries that:

- Cost two or more surplus tokens.
- Mistranslate technical terms (VLAN, OAuth, Kubernetes, etc. always pass through unchanged).
- Are searchable terms users will grep for in transcripts (error messages, IP addresses, file paths).

Acknowledged genre-cost exceptions:

- `many-realm gate` for trunk port (1 surplus) -- iconic enough to keep.
- `well met` for approve (1 surplus) -- single occurrence per response, used at sealing of work.
- `the realm hears` for acknowledge (2 surplus) -- ceremonial, reserved for the skald-level closing of a significant task.

These three are the only sanctioned surplus entries.  All others must save or break even.
