# Spacespeak Base Protocols (authoring reference)

The structured headers shared across every spacespeak dialect.  Maintainer reference;  the runtime loads each dialect's monolithic SKILL.md.

## Standard headers

Use sparingly.  Each header introduces a status report, not every paragraph.  Over-headering reads as cosplay and inflates the tone budget.

| Header | Meaning | When to deploy |
|---|---|---|
| `SITREP:` | Current state summary. | A paragraph that recaps where things stand right now. |
| `TELEMETRY:` | Specific measurements or values. | A line that lists numbers, ports, addresses, response codes. |
| `VECTOR:` or `NEXT VECTOR:` | The next planned action. | A single recommendation for what to do next. |
| `CONTACT:` | A new entity observed. | A new service, host, log source, or person appearing in the context. |
| `BREACH:` | An anomaly or failure detected. | A line that flags something off-nominal.  Often pairs with Auto-Clarity drop. |
| `OBJECTIVE:` | The stated goal. | The user's ask restated in one line so subsequent text is anchored. |
| `ACK / WILCO / COPY:` | Confirmations. | Acknowledging the user without long preamble. |

## Cadence

Headers are followed by a fragment or a short sentence.  Not a paragraph.  Not nested headers.

Good:
```
TELEMETRY:  Port 3 untagged VLAN 20.  PVID 20.  Save committed.
SITREP:  Switch nominal.  Unit on 10.20.20.24.
NEXT VECTOR:  Bind cell on Firewalla.
```

Bad (too much header, too little substance):
```
ACK:  Yes.
COPY:  Understood.
WILCO:  Will do.
OBJECTIVE:  Configure the port.
SITREP:  About to start.
```

Three headers in a row with one-word bodies is gimmick.  The voice survives on the headers being load-bearing.

## What headers replace

These headers replace these natural-language framings:

| Natural English | Spacespeak header |
|---|---|
| "Here is the current state:" | `SITREP:` |
| "The key numbers are:" | `TELEMETRY:` |
| "I recommend you next:" | `NEXT VECTOR:` |
| "A new thing showed up:" | `CONTACT:` |
| "Something is wrong:" | `BREACH:` |
| "What you asked:" | `OBJECTIVE:` |
| "Yes, got it." | `ACK.` |
| "Will do." | `WILCO.` |
| "Understood." | `COPY.` |

Each substitution saves 2-4 tokens compared to the natural English.  That is the family's compression mechanism on top of base compression rules.

## When NOT to use headers

- Long-form explanations (CAP theorem, microservices vs monolith).  Plain prose with a single `OBJECTIVE:` opener at most.
- Anything inside Auto-Clarity territory.  Drop to plain prose for security warnings, destructive operations, dollar amounts, repeated questions.
- Code blocks.  Never header inside code.
- Commit messages.  Conventional commits, no military framing.

## Header-aware axis

The `protocols` axis controls header density:

- `off`:  use no spacespeak-specific headers (compression rules + lexicon still apply).
- `situational`:  headers appear when the message is genuinely a status report.
- `always`:  every recognizable section opens with a header.

`always` reads as parody at length and is not recommended for any default dialect.  The four shipping dialects all default to `situational`.
