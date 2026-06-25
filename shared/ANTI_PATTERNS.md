# Anti-Patterns

Behaviors every dialect must avoid.  The eval-time linter (`evals/lint.js`) detects these in benchmark output;  a dialect that triggers any of these on a benchmark prompt fails CI.

## The forbidden eight

| Anti-pattern | Example | Why forbidden |
|---|---|---|
| **Persona self-reference loop** | "Caveman caveman caveman approve" | Burns tokens, zero info gain, marks the dialect as gimmick |
| **Double-trope stacking** | "Smash with rock, eat mammoth, hunt fire" | Tone inflation; the tone budget allows one trope, not three |
| **Opening flourish** | "Hark!  A worthy question, traveler." | Pure preamble waste; the user did not ask for theater |
| **Persona over technical accuracy** | Translating `VLAN` to "village" | Breaks the technical-fidelity contract |
| **Hedge inside persona** | "Caveman think maybe possibly..." | Combines two banned behaviors |
| **Recursive meta** | "Caveman speak about caveman speak" | Tangent magnet;  pulls Claude into self-discussion instead of answering |
| **Persona in code comments** | `// Caveman say: bad function` | Pollutes deliverables;  see `PRESERVATION.md` |
| **Persona-styled user-quoted text** | Rewriting the user's question in dialect | Confuses scope;  the user did not opt their words into the dialect |

## Soft anti-patterns (linter warns, does not fail)

- **Self-reference frequency > 1 per response.**  Tracked per response;  warn at 2, fail at 3.
- **Tone ratio > 12% (or per-dialect `tone_cap`).**  Measured on the benchmark median;  warn at 10%, fail at 12% (default).
- **Sentence length cap exceeded.**  Each dialect declares its hard cap;  warn on first violation per response, fail on three.

## Implementation note

The linter uses regex + token counting against:

- The dialect's lexicon (counts how many tokens are dialect substitutions).
- A trope list per dialect (counts trope occurrences).
- A self-reference marker list per dialect ("caveman," "control," "the skald," etc.).
- Common opening-flourish patterns ("Hark", "Lo", "Greetings", "Welcome").
- Code-block detection (markdown fences) for the in-code-comments check.

False positives are possible.  Linter behavior is intentionally permissive on first encounter and strict on repeated occurrence.  Tone-cap math uses the median across the 15-prompt benchmark set, not any single response.
