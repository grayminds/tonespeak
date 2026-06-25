# Spacespeak -- voice samples

The spacespeak family ships 9 dialects (default `missioncontrol`).  Each entry below is a one-line description of the voice followed by a real sample:  the opening of that dialect's actual answer to one shared prompt, taken verbatim from the clean benchmark run (Claude Haiku 4.5).  Same question, 9 voices -- read down the page to pick one by feel.

**Shared prompt:**  *Debug a "connection refused" error in a Python HTTP client.  What are the most likely causes and how do I diagnose each?*

The metric line under each name is from `benchmarks/results/` (the honest figures):  tone density against the dialect's cap, length versus default unprompted output and versus a bare "be concise" instruction, and how many load-bearing technical terms survive.  Most dialects run longer than a bare concise instruction;  that length is the voice.  See [../docs/eval-performance.md](../docs/eval-performance.md) for how the numbers are measured.

Each sample is trimmed to its opening (the shared diagnostic checklist that follows is similar across dialects;  the voice lives in the framing).  Full worked examples live in each dialect's own SKILL.md.

---

## missioncontrol  (default)

Apollo / Shuttle / ISS mission control voice.  Calm under pressure, acronym-dense, call-sign disciplined.

`tone 0% (cap 9%)  ·  25% shorter than default  ·  28% longer than "be concise"  ·  keeps 80% of load-bearing terms`

> **TELEMETRY:**  Python HTTP client returns `ConnectionRefusedError` or `ECONNREFUSED`.
>
> **OBJECTIVE:**  Isolate the root cause and restore connectivity.
>
> **Diagnostic sequence:** …

## expanse

Lang Belta sprinkled over hard sci-fi telemetry.  One or two creole tokens per paragraph, never a wall.

`tone 0% (cap 7%)  ·  18% shorter than default  ·  51% longer than "be concise"  ·  keeps 80% of load-bearing terms`

> **TELEMETRY:**  `ECONNREFUSED`.  Service na running or perimeter closed, ke?
>
> Check in order: …

## solarclipper

Solar Clipper / mercantile-maritime voice (Nathan Lowell).  Calm watch-log discipline, specificity over drama, CPJCT and share-rating vocabulary.

`tone 2% (cap 11%)  ·  6% longer than default  ·  75% longer than "be concise"  ·  keeps 60% of load-bearing terms`

> Watch log, connection debug.
>
> `ECONNREFUSED` means the kernel rejected the connection attempt at the TCP layer — nothing listening on that address and port.  Three layers to check, in order.
>
> **Service alive?** …

## startrek

Starfleet bridge officer voice.  Technobabble layered over plain comms.

`tone 0% (cap 17%)  ·  17% shorter than default  ·  30% longer than "be concise"  ·  keeps 60% of load-bearing terms`

> Sickbay:  the patient is the connection layer, and it is refusing.  `ECONNREFUSED` means the client reached the network but found no listener on the target port.  Diagnosis follows.
>
> **Most likely causes, in order:** …

## starwars

Rebel / Imperial military comms.  Tight, squadron-disciplined, slightly dramatic.

`tone 1% (cap 10%)  ·  22% shorter than default  ·  58% longer than "be concise"  ·  keeps 60% of load-bearing terms`

> Copy that, control.
>
> `ECONNREFUSED` on the client means the remote host is either not listening on that port, the firewall is blocking the path, or the service is offline.  Three vectors to check, in order of likelihood.
>
> ## Diagnostic sweep
>
> **1. Service running and bound to the right port?**
>
> SSH to the target host and verify: …

## doctorwho

The Doctor explaining tech to a companion.  Eccentric, slightly manic, warmly competent.

`tone 0% (cap 22%)  ·  7% longer than default  ·  110% longer than "be concise"  ·  keeps 80% of load-bearing terms`

> Right then.  `ECONNREFUSED` on a Python HTTP client—something at that address isn't listening, or something between you and it isn't letting you through.  Let's give it a sonic.  Three read-only checks first, no changes yet.
>
> ## 1. Is the service running? …

## firefly

Frontier laconic, Browncoat casual.  Shiny as approval, gorram as expletive, the verse as production.

`tone 0% (cap 9%)  ·  26% shorter than default  ·  36% longer than "be concise"  ·  keeps 40% of load-bearing terms`

> Captain, `ECONNREFUSED` means the client can't even shake hands with the server.  Service ain't there, ain't listening, or the perimeter's locked down.  Let's narrow it.
>
> **Most likely culprits, in order:** …

## galactica

Battlestar Galactica fleet-command voice.  Calm survival gravitas under existential threat, clipped CIC calls, a prophetic undercurrent.

`tone 1% (cap 10%)  ·  36% shorter than default  ·  4% shorter than "be concise"  ·  keeps 80% of load-bearing terms`

> DRADIS contact:  `ConnectionRefusedError` on the client.  Service unreachable on the target host and port.  Bearing unknown.
>
> Check sequence: …

## stargate

Stargate SG-1 voice.  Modern Air Force team competence with O'Neill deadpan -- crisp military fragments plus one dry understated line.

`tone 0% (cap 11%)  ·  21% shorter than default  ·  19% longer than "be concise"  ·  keeps 60% of load-bearing terms`

> Sitrep, sir:  `connection refused` means the client hit the port but nothing's listening on the other end.  Three vectors to check.
>
> **Service offline.**
>
> `systemctl status <service>` -- is the unit running?  `ps aux | grep <process>` if systemd's not in play.  If it's down, start it.  If it won't stay up, check logs:  `journalctl -u <service> -n 50` or tail the app's log file directly.
>
> **Bound to the wrong interface.**
>
> Service's listening on `127.0.0.1:8080`, but your client's talking to `10.0.0.5:8080`.  Loopback only doesn't answer off-world requests. …
