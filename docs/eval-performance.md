# Eval performance:  the wrong way and the better way

A record of how the three-arm eval harness was made fast, and why the obvious
fixes were the wrong ones.  The short version:  benchmarking 24 dialects was
bound by **process-creation churn**, not by compute or API concurrency, and the
fix was to stop spawning processes rather than to spawn them more cleverly.

## The symptom

Running the full benchmark (24 dialects x 15 prompts x 3 arms = 1080 calls) was
slow, and worse, it froze the whole Windows desktop -- input lag, stalled
Explorer -- while Task Manager showed CPU sitting around 54 percent.  A frozen
desktop at half-idle CPU is the tell:  the cores were not busy computing, they
were waiting on something that does not parallelize.

## The wrong way #1:  a process per call

The harness shelled out to the `claude` CLI for every arm:

```js
spawnSync(CLAUDE_BIN, ['--print', '--bare', '--model', model, ...], { ... });
```

That is one fresh `claude.exe` -- a heavy Node binary -- launched, run, and torn
down for each of the 1080 calls.  Two costs dominate, and neither shows up as
CPU load:

- **Cold start.**  Each call pays the full CLI startup (~30 seconds wall-clock
  per call in practice;  about 24 minutes per dialect, and the original serial
  audit actually spanned roughly 7.5 hours).  Nothing is cached between calls.
- **Process creation is kernel-heavy on Windows.**  Spawning a process takes
  global kernel locks (object manager, handle and PEB setup, the image loader),
  and Defender's real-time scanner inspects every executable launch.  Both are
  largely serialized system-wide.

So the work was bound by serialized OS machinery, and the CPU graph never showed
it because the cost lands in kernel and interrupt time, not user-mode compute.

## The wrong way #2:  throw parallelism at it

The intuitive fix -- "I have cores, run the dialects in parallel" -- made it
worse.  Running six dialect groups at once produced roughly sixty
Claude-spawned processes (the eval shells, their child `node` processes, and the
`claude.exe` they each spawned in a tight loop).  At that point a plain `grep`
could not even get scheduled;  status commands timed out after two minutes.

This is Amdahl's law biting from the wrong side.  Parallelism only speeds up the
parallelizable fraction.  The serial fraction here -- process creation, the AV
minifilter, the single filesystem and NVMe stack, the Win32 input queue -- does
not get more lanes when you add cores or callers.  More parallel spawners just
arrive faster at the same serialized gates, lengthening the queue.  Adding
concurrency past a small number made the whole system slower, and starved the
foreground UI thread of scheduler slices (the desktop freeze).

The machine has about 20 logical threads;  the workload had ~60 runnable
processes plus everything else.  Oversubscribed, and on the expensive kind of
work -- process churn, not steady compute.

## The tempting wrong fix:  exclude from Defender

The single biggest per-spawn amplifier was Defender scanning each new
executable, so the tempting fix was a Defender exclusion for `node.exe` and the
toolchain folders.  This was rejected, correctly.

A `node.exe` process exclusion tells Defender to ignore all file activity Node
performs -- which on a developer workstation is the single most likely malware
execution path (an untrusted npm dependency, for one).  It buys speed by
spending security.  Folder exclusions are milder but still leave anything
dropped there unscanned.  The scanning was a real cost, but it was an amplifier
of the disease, not the disease.  Fix the spawning and the scan cost becomes a
rounding error;  Defender stays intact.

## The better way:  no process per call

`claude --print --bare` is a thin wrapper over a single Anthropic API call with
no system prompt.  So the harness calls the API directly (`--api`):  one
long-lived Node process makes HTTP requests, and the three arms of each prompt
fire concurrently.

```js
const res = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
  body: JSON.stringify({ model, max_tokens: 4096, system: systemPrompt, messages: [{ role: 'user', content: prompt }] }),
});
```

The concurrency moves to the network layer, which does not touch the serialized
process-creation gate or the AV scanner.

| | CLI (`spawnSync` per call) | `--api` (direct HTTP) |
|---|---|---|
| Processes for a full run | ~1080 `claude.exe` launches | 1 Node process |
| Per 3-arm prompt | ~90 s (cold starts) | ~5 s (concurrent HTTP) |
| Full 24-dialect run | ~4.5 to ~9 hours | ~30 minutes |
| Desktop impact | system-wide UI stalls | none |
| Defender | scans every spawn | nothing to change |
| Working directory | leaks into the model (cwd contamination) | none -- no process, no cwd |

Three more things fell out of the change for free:

- **No cwd contamination.**  The bare CLI ran in the repo directory, and the
  model sometimes noticed the project files and answered "I am in the tonespeak
  directory" instead of the prompt.  A direct API call has no working directory,
  so the problem disappears without the temp-sandbox workaround.
- **The measurement stays valid.**  `--bare` strips system prompt, memory, and
  hooks;  a no-system-prompt API call is the same thing.  All three arms share
  the substrate, so the reduction ratios -- the actual metric -- are unchanged.
- **No security tradeoff.**  The speed comes from not spawning processes, not
  from telling the AV scanner to look away.

## The general principle

Rapid short-lived process spawning is bound by serialized OS machinery, not by
cores.  Parallelizing it just crowds the gates.  When a fan-out is process-heavy:

1. First ask whether the processes are necessary at all.  Here, 1080 CLI spawns
   collapsed to in-process HTTP calls.
2. If the work is genuinely process-bound, cap concurrency at a small number
   (one or two at a time).  The serial gates absorb a trickle fine;  a flood is
   what tips the system over.
3. Prefer in-process concurrency (async I/O, threads) over process fan-out for
   I/O-bound work.  A compute-bound job parallelized across cores pegs the CPU
   and keeps the desktop usable;  a process-spawn loop does the opposite.

Reach for `node evals/three-arm-eval.js --all --api` for any full run.  The CLI
path remains for cases that genuinely need to exercise the installed `claude`
binary end to end.
