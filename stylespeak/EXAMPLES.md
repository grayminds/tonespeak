# Stylespeak -- voice samples

The stylespeak family ships 10 dialects (default `noir`).  Each entry below is a one-line description of the voice followed by a real sample:  the opening of that dialect's actual answer to one shared prompt, taken verbatim from the clean benchmark run (Claude Haiku 4.5).  Same question, 10 voices -- read down the page to pick one by feel.

**Shared prompt:**  *Debug a "connection refused" error in a Python HTTP client.  What are the most likely causes and how do I diagnose each?*

The metric line under each name is from `benchmarks/results/` (the honest figures):  tone density against the dialect's cap, length versus default unprompted output and versus a bare "be concise" instruction, and how many load-bearing technical terms survive.  Most dialects run longer than a bare concise instruction;  that length is the voice.  See [../docs/eval-performance.md](../docs/eval-performance.md) for how the numbers are measured.

Each sample is trimmed to its opening (the shared diagnostic checklist that follows is similar across dialects;  the voice lives in the framing).  Full worked examples live in each dialect's own SKILL.md.

---

## cavespeak

Caveman-tribal voice.  The baseline dialect for the tonespeak family.

`tone 1% (cap 12%)  ·  43% shorter than default  ·  3% longer than "be concise"  ·  keeps 80% of load-bearing terms`

> Connection refused.  Server not listening or firewall blocking.  Check these in order.
>
> ## Is the server running? …

## noir  (default)

Hardboiled gumshoe register.  The family default.

`tone 0% (cap 10%)  ·  22% shorter than default  ·  30% longer than "be concise"  ·  keeps 60% of load-bearing terms`

> The case: `ConnectionRefusedError` on the client side. Server won't take the call.
>
> Round up the usual suspects, in order: …

## cyberpunk

Neon-noir console-cowboy register.  Tech-noir sibling to noir, but future-tense and wired:  terse, cool, present-tense net-runner working the grid.

`tone 0% (cap 11%)  ·  18% shorter than default  ·  50% longer than "be concise"  ·  keeps 60% of load-bearing terms`

> `ECONNREFUSED` on the client.  Server won't take the call.
>
> Work the grid, in order: …

## steampunk

Victorian engineer-inventor voice.  Ornate but precise 1880s diction, the mechanical metaphor that carries information, courteous address to the reader.

`tone 1% (cap 16%)  ·  18% shorter than default  ·  35% longer than "be concise"  ·  keeps 40% of load-bearing terms`

> A fault in the works:  the client's call returned `connection refused`.  Either the apparatus does not answer, the gate is barred, or the address itself is false.
>
> Three readings are wanted.  Check each in order:
>
> **1. Does the engine run?** …

## pirate

Age-of-sail buccaneer register.  Rakish, salty, confident seafaring command voice -- terse orders, not theme-park cartoon.

`tone 0% (cap 13%)  ·  18% shorter than default  ·  64% longer than "be concise"  ·  keeps 60% of load-bearing terms`

> Bearings:  `ECONNREFUSED` on the client.  Service won't answer the hail.
>
> Sound the depths, in order:
>
> **1. Service not running** …

## western

Classic Western register.  Laconic, plainspoken, stoic frontiersman whose own economy of words is the compression.

`tone 0% (cap 11%)  ·  30% shorter than default  ·  31% longer than "be concise"  ·  keeps 60% of load-bearing terms`

> `ECONNREFUSED` on the client side.  Server won't take the call.  Work it in order.
>
> **First:  is the service running?** …

## deadpan

Deadpan register.  Flat, dry, understated.

`tone 0% (cap 14%)  ·  39% shorter than default  ·  21% longer than "be concise"  ·  keeps 80% of load-bearing terms`

> `ECONNREFUSED` on a socket means nothing is listening at that address, or something between you and it is blocking.  Find out which, in order: …

## renfaire

Renaissance Faire performer voice.  Pseudo-Elizabethan English with a knowing wink.

`tone 1% (cap 16%)  ·  22% shorter than default  ·  52% longer than "be concise"  ·  keeps 40% of load-bearing terms`

> Hail and well met, good traveler.
>
> A `connection refused` shadow means the client's call struck a closed gate.  Either the keep doth not answer, the gate stands barred, or the address itself is phantom.  Let us walk the three labors of diagnosis.
>
> **The labors:** …

## shakespearean

Theatrical pull-quote voice.  Tudor English permitted (overrides base rule).

`tone 1% (cap 28%)  ·  3% shorter than default  ·  67% longer than "be concise"  ·  keeps 60% of load-bearing terms`

> Hark.  The traveler's call returned shadow, and the server doth refuse the passage.  Let us name the culprits and the tests that unmask them.
>
> **The server sleeps or stands not.**
>
> First, verify the keep itself awakens: …

## laconic

The laconic register.  Economy is the voice -- no wasted words, every one load-bearing.

`tone 0% (cap 7%)  ·  63% shorter than default  ·  1% shorter than "be concise"  ·  keeps 80% of load-bearing terms`

> `ECONNREFUSED` means nothing listening on that address/port, or firewall blocks the path.  Check in order: …
