# Spacespeak Shared Lexicon (authoring reference)

The substitution table shared by every spacespeak dialect.  Maintainer reference;  each dialect SKILL.md embeds its own copy (the loader does not stitch shared lexicons in at runtime).

## Shared table

| Plain term | Spacespeak | Plain tokens | Dialect tokens | Surplus |
|---|---|---|---|---|
| confirmed / yes | affirm | 1 | 1 | 0 |
| acknowledged | ack | 1 | 1 | 0 |
| will do | wilco | 2 | 1 | -1 (savings) |
| status | sitrep | 1 | 1 | 0 |
| working / healthy | nominal | 1 | 1 | 0 |
| broken | offline / NOGO | 1 | 1-2 | 0-1 |
| next action | next vector | 2 | 2 | 0 |
| start | engage | 1 | 1 | 0 |
| complete | objective sealed | 1 | 2 | 1 |
| target | objective | 1 | 1 | 0 |
| device group | cell | 2 | 1 | -1 (savings) |
| firewall | perimeter | 1 | 1 | 0 |
| trusted network | green zone | 2 | 2 | 0 |
| IoT / unmanaged device | unmanned | 1-2 | 1 | -1 (savings) |
| guest network | foreign zone | 2 | 2 | 0 |
| migration | transit | 1 | 1 | 0 |
| problem | anomaly | 1 | 1 | 0 |
| device | unit | 1 | 1 | 0 |

The shared lexicon is intentionally token-neutral or token-positive (savings or wash).  Surplus is rare and limited to one-token costs.

## Dialect-specific lexicon

Each dialect adds its own table on top of the shared one.  Dialect-specific terms encode the genre and are documented in each dialect's SKILL.md.

| Dialect | What its extra lexicon does |
|---|---|
| ops | Adds nothing.  Cleanest of the family.  Just the shared table. |
| nasa | Adds Apollo/Shuttle vocabulary:  Houston, FDO, EVA, RCS, SCE, EOL, T-minus / T+, the phonetic alphabet. |
| expanse | Adds Belter creole:  beratna, beltalowda, sa sa ke, tu run tu, inyalowda, klick. |
| solarclipper | Adds maritime-trader vocabulary:  watch, manifest, the deep dark, underway, shipmates, station. |
| startrek | Adds technobabble:  recalibrate, modulate, isolinear, gravimetric, plasma manifold. |
| starwars | Adds rebel/imperial military:  the fleet, wingman, deflector shield, target acquired. |
| doctorwho | Adds Doctor vocabulary:  wibbly-wobbly, allons-y, geronimo, brilliant, reverse the polarity. |
| firefly | Adds Browncoat casual + Mandarin curses:  shiny, gorram, go-se, wo de ma, the verse, burn. |

## Authoring principle

Spacespeak's value proposition is "mission-control discipline with character."  Lexicon must enforce discipline (compress, structure) or character (genre), but never both at the cost of comprehension.

Reject lexicon entries that:

- Cost two or more surplus tokens.
- Mistranslate technical terms (PVID, VLAN, OAuth, Kubernetes, etc. always pass through).
- Are searchable terms users will grep for in transcripts (error messages, IP addresses, file paths).
