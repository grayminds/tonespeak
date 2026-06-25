# Bardspeak -- voice samples

The bardspeak family ships 5 dialects (default `tavern`).  Each entry below is a one-line description of the voice followed by a real sample:  the opening of that dialect's actual answer to one shared prompt, taken verbatim from the clean benchmark run (Claude Haiku 4.5).  Same question, 5 voices -- read down the page to pick one by feel.

**Shared prompt:**  *Debug a "connection refused" error in a Python HTTP client.  What are the most likely causes and how do I diagnose each?*

The metric line under each name is from `benchmarks/results/` (the honest figures):  tone density against the dialect's cap, length versus default unprompted output and versus a bare "be concise" instruction, and how many load-bearing technical terms survive.  Most dialects run longer than a bare concise instruction;  that length is the voice.  See [../docs/eval-performance.md](../docs/eval-performance.md) for how the numbers are measured.

Each sample is trimmed to its opening (the shared diagnostic checklist that follows is similar across dialects;  the voice lives in the framing).  Full worked examples live in each dialect's own SKILL.md.

---

## tavern  (default)

The tavern tale, told aloud to the patron at the bar.  Second person, warm, plain.

`tone 0% (cap 11%)  ·  24% shorter than default  ·  44% longer than "be concise"  ·  keeps 40% of load-bearing terms`

> Here's your trouble.  `ECONNREFUSED` means the server slammed the door:  either nobody's home, or the gate's barred.
>
> Three things to check, in order.
>
> **Is the server running?** …

## viking

Norse saga prose.  Three-beat declarative cadence.

`tone 0% (cap 10%)  ·  24% shorter than default  ·  29% longer than "be concise"  ·  keeps 40% of load-bearing terms`

> The traveler's call returned the shadow `ConnectionRefusedError`.  The gate is barred, or the keep sleeps, or both.
>
> Three checks in order: …

## dragonlance

80s pulp fantasy register.  Companions on a quest.

`tone 3% (cap 13%)  ·  34% shorter than default  ·  33% longer than "be concise"  ·  keeps 40% of load-bearing terms`

> Companions, a shadow on the road.  `connection refused` means the traveler's call reached the gate but found no keeper listening.
>
> The quest is a sweep, in three legs:
>
> **The keep does not wake.**
>
> The service itself is down or never started. …

## dnd

Dungeon Master narrating to a party.  Second-person, tabletop-conversational, dice-roll framing.

`tone 1% (cap 13%)  ·  30% shorter than default  ·  46% longer than "be concise"  ·  keeps 60% of load-bearing terms`

> You see the shadow before you:  `ConnectionRefusedError` or `[Errno 111] Connection refused`.  The client cannot reach the server.  Three things must align:  service alive, port listening, nothing blocking the path.
>
> Initiative.  Roll for each in order.
>
> **Check one:  Is the service running?**
>
> DC 5 perception.  Look at the target machine: …

## tolkien

Elevated high-fantasy elegy.  In the days of old, long was the road.

`tone 0% (cap 22%)  ·  39% longer than default  ·  169% longer than "be concise"  ·  keeps 100% of load-bearing terms`

> In the days of old, the client sent forth its call into the network, and the answer that returned was the shadow `Connection refused`.  This shadow speaks thus:  the road exists, but no keep stands at its end to hear the knock.
>
> Three causes walk ahead of all others, and the company must test each in turn.
>
> **The keep does not wake.**
>
> The service itself has not yet risen, or it has fallen into silence.  On the host where the service dwells, ask: …
