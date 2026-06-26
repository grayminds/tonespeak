# Tonespeak dialect audit

Date:  2026-06-24.  Scope:  all 15 dialects across three families, plus the shared scaffolding.  Goal of the audit:  decide, per dialect, whether it needs expansion (deeper immersion), tightening (efficiency), or both, with the target being a fully immersive experience rather than a word-swap reskin.

## The central finding

Tonespeak's architecture currently treats immersion and efficiency as a tradeoff governed by one number, `tone_cap`.  Lean dialects (expanse 0.07, ops 0.08) compress hard and flavor little;  flavor dialects (who 0.22, shakespeare 0.28) flavor hard and compress little.  Under that model, "fully immersive" reads as "raise the cap and accept the token cost."

That model is wrong, and the project's own best dialects prove it.  The four strongest dialects in the set - expanse, nasa, dnd, clipperspeak - are deeply immersive *and* efficient at the same time.  They achieve immersion through three free channels:

1. **Structural / grammatical signatures.**  Expanse's Lang Belta is "structural, not lexical" - zero copula, `na` before the verb, `ke?` final tag.  These cost almost nothing and read unmistakably Belter.  Word-swaps cost tokens;  grammar does not.
2. **Information-carrying tropes.**  D&D's "DC 20 to debug this race condition" replaces a whole hedging sentence.  The trope *is* the compression.  NASA's go/no-go poll, AOS/LOS, T+ stamps carry real state in genre-true idiom.
3. **Cadence and specificity.**  Clipperspeak's "name the bean and the grinder" - immersion from concrete detail and sentence rhythm, not from a thicker vocabulary table.

The dialects that feel like thin reskins (starwars, and the bardspeak blur cluster of chronicler / tolkien / dragonlance / renfaire) are thin precisely because their immersion lives in the *vocabulary and framing* layer - openers, closers, and a shared generic lexicon - rather than in structure, idiom, and information-carrying tropes.

**So the path to "fully immersive" is not "raise the tone cap."  It is "move immersion out of the vocabulary layer and into the structural, grammatical, and information-carrying layers, where it is genre-true and nearly free."**  Done that way, immersion and efficiency stop being opposed.  This principle should drive every expansion recommendation below.

## Scorecard

Immersion is scored 1-10 against "could a fan tell this dialect from its siblings blindfolded, and does it feel like the world."  Efficiency is the realism of the dialect's compression claim and freedom from token-leaking substitutions.  Verdict:  EXPAND (deepen immersion), TIGHTEN (fix efficiency leaks), BOTH, or KEEP.

| Family | Dialect | Immersion | Efficiency | Verdict | Priority |
|---|---|---|---|---|---|
| cavespeak | cavespeak | 7 | strong | EXPAND (+ minor tighten) | P2 |
| bardspeak | chronicler | 7 | strong | EXPAND | P2 |
| bardspeak | dnd | 9 | good | KEEP (light expand) | P3 |
| bardspeak | dragonlance | 8 | good | EXPAND | P1 |
| bardspeak | renfaire | 7 | leaky | BOTH | P1 |
| bardspeak | shakespeare | 8 | flavor-only (honest) | EXPAND | P2 |
| bardspeak | tolkien | 7 | flavor-only (honest) | EXPAND | P1 |
| spacespeak | ops | 6 (by design) | best in set | KEEP | P3 |
| spacespeak | nasa | 9 | good | KEEP (+ differentiate) | P1 |
| spacespeak | clipperspeak | 9 | good | KEEP (fix dup heading) | P3 |
| spacespeak | expanse | 9 | best in set | KEEP | - |
| spacespeak | firefly | 8 | leaky | TIGHTEN (+ small expand) | P2 |
| spacespeak | startrek | 8 | flavor-leaning (honest) | EXPAND | P2 |
| spacespeak | starwars | 7 | leaky | BOTH | P1 |
| spacespeak | who | 9 | flavor-only (honest) | KEEP (deepen) | P3 |

Gold-standard templates to copy:  **expanse** (structural immersion), **dnd** (information-carrying tropes), **clipperspeak** (specificity + origin-column lexicon), **nasa** (authentic protocol idiom).

## Cross-cutting findings

### 1. Three sibling-blur pairs undercut "pick a dialect by feel"

- **ops vs nasa** (spacespeak's biggest weakness).  Both share TELEMETRY / SITREP / NEXT VECTOR headers and the same 17-term shared table.  On a short task they differ only by NASA's timestamps.  Fix:  make T+/MET/GET stamps and named back-room positions (FLIGHT/FIDO/CAPCOM) *mandatory identity markers* for nasa, and explicitly *forbid* both in ops.  Add a go/no-go polling example to nasa.
- **shakespeare vs renfaire** (both Tudor English, shared word list).  Fix:  split on register - shakespeare = verse + fourth wall intact (you watch a play, closing rhyming couplet mandatory);  renfaire = prose + fourth wall broken (you are at the fair, in on the joke, anachronism collision is the signature).
- **tolkien vs chronicler vs dragonlance** (all third-person, implicit-narrator, drawing the same generic-fantasy shared lexicon of keep/gate/realm/shadow/banner).  Fix:  give each a genre-specific substance lexicon (below) and a positive cadence signature so they stop being differentiated only by sentence length and three signature phrases.

### 2. The bardspeak shared lexicon is the family's immersion bottleneck

Five of six bardspeak dialects draw their entire technical vocabulary from one pool of generic medieval-fantasy kennings.  The franchise flavor lives only in the framing.  dnd is the exception and the template:  17 entries mapping real work to real tabletop mechanics (code review -> insight check, postmortem -> the after-action, escalate -> call the DM).  Every bardspeak dialect needs that depth in its own idiom.

### 3. Efficiency leaks:  substitutions longer than the plain term

These violate the SHARED_LEXICON principle ("reject entries that cost two or more surplus tokens") in dialects that *claim* ~47% efficiency (the flavor-only dialects are out of scope - their cost is disclosed):

- starwars `lock S-foils in attack position` (5 tokens for a 3-token phrase) - the single most expensive entry in the set.  Demote to a once-ever flourish.
- firefly `reckon I will` for "wilco" (+1), `gorram broken` / `gorram thing`.  Demote to optional flavor.
- startrek `conduct a level-N diagnostic` - inherent to technobabble;  startrek is flavor-leaning so acceptable, but flag it.
- cavespeak `grunt yes`, `fire bad`, `rock fix`, `tribe member` - each +1 surplus.  Acceptable at moderate rate but audit usage.
- shared-table `objective sealed` (+1 for "complete"), inherited by all eight spacespeak dialects.  Tighten to `sealed` or `done`.

### 4. Documentation drift in README.md

- README lists 13 dialects;  there are 15.
- README's bardspeak table lists `grimdark`;  the tree has `dragonlance` and `renfaire` instead.  `grimdark` does not exist.
- README's spacespeak table omits `nasa` and `clipperspeak`, both of which exist and are strong.
- Update the README dialect table and the tone-budget table in DIALECT_AUTHORING_GUIDE.md (which also still references grimdark).

### 5. Minor housekeeping

- clipperspeak has a duplicate "Example 4" heading (second should be Example 5).
- starwars Example 3 uses "Stay on target" three times in one response, brushing the tic its own anti-pattern table warns against.

## Per-dialect expansion plans

Each plan favors the free immersion channels (structure, idiom, information-carrying tropes) over vocabulary inflation.

### cavespeak  -  EXPAND (+ minor tighten)
The single baseline dialect is competent but shallow for how much caveman texture is available.  It is all individual fragments;  it has no *world*.
- Add a world layer mapped to information, not decoration:  `the hunt` (active investigation - present, deepen it into a structure:  track -> corner -> kill), `the trail` / `tracks` (logs, traces - "follow the tracks to the leak"), `winter coming` (a deadline / looming risk), `the thaw` (an unblock / resolved incident), `the fire-keeper` (whoever owns on-call / keeps prod alive), `the elder` or `cave-painter` (the senior eng / the docs), `watering hole` (a shared resource / contended dependency).
- Sharpen one cadence rule:  the survival-stakes register.  Caveman speech gets *shorter and flatter* as danger rises, not more decorated.  Make that explicit - it reinforces auto-clarity thematically.
- Tighten:  the four +1 surplus entries are fine individually but the linter should hold them to the moderate rate the axis claims.

### chronicler  -  EXPAND
Own the one register no sibling can take:  authentic Old Norse / Anglo-Saxon saga.
- Add saga cadence tells:  the "men say" / "it is said that" attribution frame;  litotes (understatement for emphasis - "the loss was not slight" for a major outage) as the signature move;  the genealogical naming pattern already hinted at ("the port the third").
- Add a small saga-specific lexicon the others do not share:  `weregild` (the cost/penalty of an incident), `holmgang` (a head-to-head bake-off / A-B test), `the thing` or `moot` (a review / standup), `oath-bound` (a hard SLA).

### dnd  -  KEEP (light expand)
The strongest bardspeak dialect and the family template.  Already information-carrying (the DC scale is the best compression device in the project).
- Add a class/role layer:  `the rogue` (risky manual hotfix), `the cleric` (rollback/recovery owner), `the bard` (docs/comms), `the tank` (on-call).
- Add 5e condition vocabulary for system states:  `stunned` (hung process), `prone` (service down), `poisoned` (slow leak / degradation), `exhausted` (rate-limited), `concentration check` (don't break the long migration).
- Tighten:  flag the noun-substitutions that are longer than plain (`wisdom save`, `insight check`) as flavor cost, not compression.

### dragonlance  -  EXPAND  (P1)
Currently chronicler-plus-a-greeting.  Inject real Krynn texture and a positive cadence.
- Krynn-specific lexicon:  `the Measure` (the runbook / standard / conventions - THE Solamnic concept, and it is missing), `draconian` (a bug that looks fixed but is not - draconians dissolve when killed), `kender` (the curious user who touched something they should not have / scope creep), `the lance` (the one fix that actually works), `the Dark Queen` / `Takhisis` (the root-cause adversary, used rarely).
- Positive cadence (not "looser than chronicler"):  mid-paragraph address to the Companions ("Hold fast, Companions -"), rhetorical-question-then-answer ("Can the keep be roused?  It can."), one earnest emotional line per heavy response.  That is the 80s-pulp tell chronicler never uses.

### renfaire  -  BOTH  (P1)
The "knowing wink" concept is distinctive but asserted, not mechanized, and the lexicon is recycled Tudor filler shared with shakespeare (the leaky, least-efficient lexicon in the family).
- Mechanize the wink (immersion + the single highest-leverage fix):  a cadence rule that pairs one period-frame with one bald modern term per beat - "the wifi-weaver, which is to say the access point, doth not answer."  The self-aware aside *is* the genre.
- Replace function-word filler with faire-craft jargon (more immersive *and* less leaky):  `the joust` (head-to-head comparison), `mud show` (quick demo / hack), `the cast` (team in character), `playing to the back of the house` (over-communicating for clarity), `breaking character` (the auto-clarity drop - thematically perfect), `the privy council` (leadership / approvers).
- Add the call-and-response crowd-work beat ("How fare we, good gentles?  *We fare well!*") as a one-per-response trope.

### shakespeare  -  EXPAND  (flavor-only, efficiency conceded)
Honestly labeled flavor-only;  lean fully into verse mechanics renfaire cannot touch.
- Make the closing rhyming couplet a near-mandatory signature (Shakespeare ends scenes on couplets).  One scanned couplet per response makes it unmistakable and unmistakably not renfaire.
- Add the dramatic aside (parenthetical to the audience) and the rhetorical apostrophe ("O firewall, why barrest thou the gate?") - both Shakespeare-specific theatrical devices.
- Add play-structure framing for long responses:  `Dramatis Personae` (the systems involved), `the turn` (the plot reversal = root cause found).

### tolkien  -  EXPAND  (P1, highest-leverage deepen)
Strip the three signature phrases and tolkien collapses into chronicler with longer sentences.  Add genuine legendarium texture.
- Legendarium lexicon:  `the long defeat` (managing inevitable tech debt / entropy - Galadriel's phrase, maps perfectly), named environments (`Gondor` = prod, the besieged important one;  `the Shire` = dev, safe and small;  `Rohan` / `the Mark` = staging), `the Watchful Peace` (a quiet, incident-free period), `palantir` (a dashboard / observability tool that shows distant truth but can deceive), `mithril` (the rare elegant fix - light and unbreakable), `the One Ring` (the single point of failure / the credential that controls everything - and thematically, you cannot use it safely).
- Cadence:  genealogy/lineage framing ("son of," "of the line of") for dependency chains and version history;  the "some say... but others hold..." dual-attribution frame for competing hypotheses;  a rule that tolkien names *cost* even on success ("the keep was raised, though not without the loss of the morning's work") - the bittersweet register that is uniquely Tolkien.

### ops  -  KEEP
Intentionally genre-free baseline;  succeeds at its role.  Only change:  tighten the shared `objective sealed`.  Do not add genre lexicon - that would break its purpose.  See the ops/nasa differentiation fix above.

### nasa  -  KEEP (+ differentiate from ops)  (P1 for the differentiation)
Near-complete and the most authentic non-fandom dialect.
- Push to 10 with more spoken-loop tells:  "How do you read?" / "Loud and clear" (signal check -> connectivity), the go/no-go *poll* rendered as a checklist (poll each subsystem before deploy - an idiom impossible in ops), "Failure is not an option" reserved as a rare closer.
- Make T+/MET/GET stamps and position callsigns mandatory identity markers (this is the ops/nasa split).

### clipperspeak  -  KEEP
The richest world and the gold standard for lexicon authoring (origin column, anti-trope block, "name the bean" principle).  Fix the duplicate Example 4 heading.  Resist adding more - its risk is bloat, not thinness.

### expanse  -  KEEP
Best-in-class:  most efficient (~52%) and deeply immersive because immersion is structural.  The template for the whole project.  Optional authentic additions within restraint:  `im to im` (peer-to-peer / internal-only), `gut` (good - shorter than "nominal"), one example that stacks `na` + `ke?` + zero-copula in a single dense line.

### firefly  -  TIGHTEN (+ small expand)
Strong and Browncoat-authentic;  the issue is efficiency leaks.
- Trim:  drop `reckon I will` as the wilco substitution;  demote `gorram broken` / `gorram thing` to optional flavor.
- Add short, authentic frontier diction:  `dong ma?` (Mandarin "understand?" - the perfect cheap sentence-final tag, the firefly equivalent of expanse's `ke?`, high-leverage), `humped` (in bad trouble), `powerful` as intensifier.

### startrek  -  EXPAND  (flavor-leaning, efficiency conceded)
Since efficiency is already conceded (technobabble is inherently inflationary), lean fully into immersion to justify the cost.
- Add department-specific voice instead of a flat bridge officer:  Engineering (Scotty/Geordi:  realistic-estimate-then-beat-it), Medical (McCoy:  "I'm a developer, not a DBA," "It's dead, Jim" for a killed process), Tactical (Worf:  blunt risk assessment).  A position axis would make Trek far richer.
- Add red-alert framing for incidents ("Red alert.  Shields up." for a sev-1) and formalize stardate openers (currently only in an example).

### starwars  -  BOTH  (P1, biggest reskin risk)
The only fandom that reads as generic mil-comm with a few quotes.  The fix is additive and uses unused assets.
- Add **droid voice**:  C-3PO probability/doom for risk statements ("The odds of successfully X are approximately 3,720 to 1"), R2 acks.  This alone lifts it ~2 points.
- Add **Imperial/Rebel duality**:  Imperial decree = policy/compliance (parallel to clipperspeak's CPJCT), Vader lines for blunt verdicts.
- Add **Han/smuggler register**:  "Punch it" (start - short, iconic, better than the 3-token "jump to lightspeed"), "Never tell me the odds," "It's a trap!" (for a detected footgun/gotcha).
- Map the Death Star trench run to incident/SPOF postmortems.
- Tighten:  demote `lock S-foils in attack position` to a once-ever flourish;  vary the "Stay on target" tic.

### who  -  KEEP (deepen)
The most voice-perfect fandom (the admire-then-over-explain bimodal cadence is a genuine insight).  Flavor-only and honestly labeled.
- Deepen, do not broaden:  the sonic screwdriver as a read-only diagnostic metaphor ("let me just... sonic it"), "Spoilers" (River Song) for a deferred answer, "bigger on the inside" for a system more complex than it appears, regeneration for a major refactor/version bump.

## Prioritized roadmap

**P1 - immersion gaps and blur (do first).**
1. starwars rebuild (droids + Imperial/Rebel + smuggler register;  demote S-foils).
2. tolkien legendarium lexicon + lineage cadence.
3. dragonlance Krynn texture + positive cadence.
4. renfaire:  mechanize the wink + faire-craft lexicon (also fixes its efficiency leak).
5. ops/nasa differentiation (mandatory stamps + positions for nasa, forbid for ops).

**P2 - depth and efficiency.**
6. chronicler saga register (litotes, "men say," saga lexicon).
7. cavespeak world layer (hunt structure, trail, seasons, roles).
8. shakespeare verse mechanics (mandatory couplet, asides).
9. firefly efficiency trim + `dong ma?`.
10. startrek department voices.

**P3 - polish and housekeeping.**
11. dnd class/condition layer.
12. who deep cuts (sonic, spoilers, bigger-on-the-inside).
13. README + DIALECT_AUTHORING_GUIDE doc drift (15 dialects, drop grimdark, add nasa/clipperspeak).
14. clipperspeak duplicate Example 4 heading;  shared `objective sealed` tighten.

**Architectural recommendation that should frame all of the above:**  add a section to DIALECT_AUTHORING_GUIDE.md codifying the central finding - immersion should come from structural/grammatical signatures, information-carrying tropes, and concrete specificity (the expanse/dnd/clipperspeak model), not from a thicker vocabulary table.  Make "is this immersion free or token-positive?" an explicit authoring checklist item.  That single guideline change is what converts the weak dialects from reskins into fully immersive experiences without breaking the tone budget.
