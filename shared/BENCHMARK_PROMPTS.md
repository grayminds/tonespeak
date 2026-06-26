# Benchmark Prompts

Fifteen prompts covering the realistic span of Claude Code usage.  Every dialect runs against this set in the three-arm eval (`evals/three-arm-eval.js`).

The canonical machine-readable form is `benchmarks/prompts.json`.  This file is the human-readable companion with the same content.

## Prompt set

| # | Prompt | Expected technical keywords |
|---|---|---|
| 1 | Explain why a React component re-renders unexpectedly. | useState, useEffect, props, memo, dependency array |
| 2 | Debug a `connection refused` error in a Python HTTP client. | ECONNREFUSED, port, firewall, timeout, requests, urllib |
| 3 | Write a 5-step migration plan for moving Postgres from on-prem to RDS. | pg_dump, replication slot, cutover, parameter group, downtime |
| 4 | Review the following PR diff for security issues. (60-line diff) | SQL injection, XSS, secret in commit, missing validation, CSRF |
| 5 | Explain the tradeoffs between microservices and monolith. | latency, deploy cadence, network failure, transaction, coupling |
| 6 | Generate a runbook entry for "high CPU on web-tier." | top, perf, flame graph, scale-out, ASG, restart, alert threshold |
| 7 | Draft a Slack message announcing a 30-minute maintenance window. | timestamp, impact, services affected, contact, rollback plan |
| 8 | Write a postmortem summary for a 3-hour outage caused by DNS misconfiguration. | DNS, TTL, propagation, blast radius, MTTR, action items |
| 9 | Compare REST vs GraphQL for a mobile-first API. | over-fetch, n+1, caching, schema, subscription, payload size |
| 10 | Configure a VLAN trunk port on a managed switch. | trunk, tagged, untagged, PVID, native VLAN, allowed VLANs |
| 11 | Explain git rebase vs merge. | linear history, conflict, merge commit, fast-forward, force-push |
| 12 | Refactor this callback pyramid into async/await. (snippet) | async, await, try/catch, Promise.all, parallelism |
| 13 | Write a Conventional Commit message for "fix null deref in auth middleware." | fix(scope), type, scope, body, breaking change |
| 14 | Implement a React error boundary with logging hook. | componentDidCatch, getDerivedStateFromError, fallback UI, sentry |
| 15 | Explain the CAP theorem in one paragraph. | consistency, availability, partition tolerance, CP, AP, network |

## Eval mechanics

Each prompt × each dialect × three arms = 585 invocations per full benchmark cycle.

| Arm | Invocation |
|---|---|
| A (baseline) | `claude -p "<prompt>"` |
| B (concise) | `claude -p --system-prompt "Answer concisely." "<prompt>"` |
| C (dialect) | `claude -p --system-prompt "$(cat <dialect-skill.md>)" "<prompt>"` |

Token counts via tiktoken `o200k_base` approximation;  ratios are meaningful, absolute counts are approximate.

The honest delta for any dialect is **Arm C vs Arm B**, not Arm C vs Arm A.  Reporting Arm-C-vs-Arm-A inflates the savings number by counting the "be concise" instruction's contribution as the dialect's contribution.

## Correctness check

For each Arm C output, the linter verifies that at least 60 percent of the prompt's expected technical keywords appear in the response.  Below 60 percent triggers a regression flag for that (dialect, prompt) pair.  Manual review on flagged pairs;  if Arm A also missed the keywords the regression is on Claude, not the dialect.

## How to extend

New benchmark prompts must:

- Be realistic Claude Code asks (debugging, design, runbook, review, refactor).
- Have at least 3 verifiable technical keywords.
- Not depend on Claude having access to tools, files, or the internet.
- Be answerable in 100-600 tokens by plain Claude (skip very short or very long prompts).

Add to `benchmarks/prompts.json` and re-derive Arm-A and Arm-B baselines before relying on the new prompt's deltas.
