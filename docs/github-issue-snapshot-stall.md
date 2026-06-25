# GitHub issue draft -- Claude Code shell-snapshot stall (Windows + Git Bash)

> Paste each section below into the matching field at https://github.com/anthropics/claude-code/issues/new?template=bug_report.yml
>
> Suggested title:  `[BUG] First Skill-tool inline-bash per session stalls 60-70s on Windows + Git Bash (shell snapshot SIGTERM)`

---

## Preflight Checklist

- [x] Searched existing issues.  Prior reports of the same symptom exist (#15756, #19585), both auto-closed for inactivity with the github-actions message "Please file a new issue and reference this one if it's relevant."  Filing this fresh per that guidance.
- [x] Single bug report
- [x] Using latest version (2.1.148)

---

## What's Wrong?

On Windows with Git Bash as the bash provider, the first slash command per session that uses inline-bash preprocessing (`` !`...` `` in a command body) hangs for 60-70 seconds before responding.  Every subsequent inline-bash command in the same session runs in 2-4 seconds.

Tracing the debug log shows the stall is in Claude Code's shell-snapshot creation step, not in the user's bash command itself.  The user's bash exits in milliseconds;  Claude Code's snapshot script is what hangs.

This affects every plugin author who ships slash commands with `` !`...` `` bodies on Windows, since the very first invocation any user runs costs over a minute regardless of which command it is.

## What Should Happen?

First inline-bash invocation should complete in roughly the same time as subsequent ones (2-4 seconds), or the snapshot creation should be backgrounded at session start instead of blocking the first command.

If the snapshot script is going to fail on a given platform, Claude Code should detect the hang faster (current timeout fires at ~14s but tool dispatch still waits another ~42s before giving up) or skip the snapshot entirely on platforms where it consistently fails.

## Error Messages/Logs

Debug log excerpt from the first inline-bash invocation, showing the 56-second tool_dispatch with a shell-snapshot SIGTERM in the middle:

```
[INFO]  [Stall] tool_dispatch_start tool=Skill toolUseId=toolu_xxx permissionDecisionMs=1649
[DEBUG] Creating shell snapshot for bash (D:\codetools\git\bin\bash.exe)
[DEBUG] Shell config file not found: C:\Users\michael\.bashrc, creating snapshot with Claude Code defaults only
[DEBUG] Snapshots directory: C:\Users\michael\.claude\shell-snapshots
[DEBUG] Creating snapshot at: ...\snapshot-bash-xxx.sh
                                                  -- ~14s gap --
[DEBUG] Shell snapshot creation failed: Command failed: D:\codetools\git\bin\bash.exe -c -l SNAPSHOT_FILE=...
[DEBUG] - Error signal: SIGTERM
[DEBUG] - Error killed: true
                                                  -- ~42s silent gap --
[WARN]  [Stall] tool_dispatch_end tool=Skill toolUseId=toolu_xxx outcome=ok durationMs=57837
```

Repeated three times across two probes (one exit 0, one exit 1).  Tool dispatch took 57,837 ms on the first probe and 56,021 ms on the second.  Exit code did not affect duration.  Both stalls fit the same pattern:  SIGTERM at the 10-second snapshot timeout plus a ~42-second silent gap before tool dispatch returns.

## Steps to Reproduce

1.  On Windows with Git Bash configured as the bash provider (`CLAUDE_CODE_GIT_BASH_PATH=D:\codetools\git\bin\bash.exe` or similar), create two probe slash commands.

    `~/.claude/commands/_probe_pass.md`:
    ```markdown
    ---
    description: probe - exit 0
    allowed-tools: ["Bash"]
    ---

    !`echo "pass-output" && exit 0`
    ```

    `~/.claude/commands/_probe_fail.md`:
    ```markdown
    ---
    description: probe - exit 1
    allowed-tools: ["Bash"]
    ---

    !`echo "fail-output" && exit 1`
    ```

2.  Start a fresh interactive session:  `claude`

3.  Run `/_probe_pass`.  Observe wall-clock time of ~60-70 seconds.

4.  Run `/_probe_pass` again.  Observe wall-clock time of 2-4 seconds.

5.  Run `/_probe_fail`.  Observe 2-4 seconds.  (Confirms exit code is not the variable.)

6.  Optional:  capture the debug trace with `claude -p --debug-file /tmp/probe.log "/_probe_pass"` and grep for `tool_dispatch`, `snapshot creation`, `SIGTERM`.

## Claude Model

Opus

## Is this a regression?

No, this never worked.  Same symptom reported on earlier versions in #15756 (Dec 2025) and #19585 (Jan 2026, "30-90 second delay per Bash command on Windows").  Both were auto-closed as stale rather than fixed.

## Last Working Version

(blank -- bug appears to have existed since at least v2.0.x per the closed reports above)

## Claude Code Version

2.1.148 (Claude Code)

## Platform

Anthropic API

## Operating System

Windows

## Terminal/Shell

PowerShell

## Additional Information

### Related issues

Direct prior reports of the same symptom (both auto-closed as stale, not fixed):
- #15756 -- Native UI mode hangs on shell snapshot creation with SIGTERM timeout on Windows
- #19585 -- Shell snapshot creation causes 30-90 second delay per Bash command on Windows, only PC reboot helps

Related open issues on the Windows + Git Bash snapshot surface (different angles, same underlying area):
- #19057 -- `~/.bashrc` presence triggers bloated snapshots with `set -o onecmd` on Windows + Git Bash
- #46015 -- Windows Git Bash process crash (exit 4294967295) after successful shell snapshot
- #57435 -- Shell snapshot generated by login shell, stripping inherited PATH on Windows + Git Bash

The `.bashrc`-gating workaround proposed on #19585 (skip init for non-interactive shells) does NOT apply to my case:  my system has no `~/.bashrc` at all (debug log: `Shell config file not found: C:\Users\michael\.bashrc, creating snapshot with Claude Code defaults only`).  The snapshot script still hangs without one.

### Misdiagnosis pattern to watch for

The user-visible symptom can easily look like an exit-code asymmetry (success path fast, failure path slow), because the failure path often happens to be the first inline-bash of a fresh session in casual testing.  In reality the cost is purely first-command-of-session and exit code is irrelevant.  Worth noting so other users do not chase a phantom exit-code bug in their own plugin code.

### Discovery context

Surfaced while debugging the tonespeak plugin (https://github.com/grayminds/tonespeak), which uses `` !`bash "$HOME/.tonespeak/bin/dispatch" <family> $ARGUMENTS` `` in every command body.  The same pattern would affect any plugin using inline-bash preprocessing in its slash command bodies.

### Environment

- Claude Code 2.1.148, native Windows install (not WSL)
- Git for Windows bash at `D:\codetools\git\bin\bash.exe`
- No `.bashrc` present (debug log notes `Shell config file not found`, falls back to defaults)
- Working directory on a junctioned NTFS path (Synology Drive sync target);  unclear whether that contributes

### Plugin author workarounds (until upstream fix)

- Document the one-time first-command cost in the plugin README.
- Have the SessionStart hook print a banner advising users to expect a delay on their first slash-command invocation.
- Avoid inline-bash entirely in command bodies;  do the work in hooks (which use a different execution path) and have the command body be prompt text only.
