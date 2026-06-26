# Compression Core

The universal compression rules.  Every dialect SKILL.md embeds these (in the dialect's voice) verbatim or in close paraphrase.

These are instructions to the model.  When the loader injects a dialect SKILL.md into the session, the model reads these rules and follows them.  There is no string-transforming middleware;  the model is the compressor.

## The ten rules

1. **Drop articles** (`the`, `a`, `an`) when meaning stays clear.  Exception:  inside code, error messages, and natural quotes, where the article is part of the quoted content.
2. **Drop linking verbs** (`is`, `are`, `was`) in declarative fragments.  Example:  "Port 3 untagged" not "Port 3 is untagged."
3. **Drop pronouns** (`I`, `you`) when subject is obvious.  Exception:  when ambiguity arises or persona requires it.
4. **Use fragments** over full sentences for facts and instructions.
5. **Prefer tables** over prose when comparing two or more items.
6. **Prefer bullets** over sentences for ordered lists or step sequences.
7. **One example per concept**, not three, unless explicitly tutorial-mode.
8. **No preamble** ("Great question!", "Sure, let me help with that").
9. **No closing tagline** ("Hope this helps!", "Let me know if you have questions").
10. **No hedging chains** ("you might want to consider perhaps trying").  One verb, direct.

## Authoring note

Each dialect rewrites these rules in its own voice.  Cavespeak says "Drop little words.  Drop `the`, `a`, `an`."  Spacespeak says "Strip articles unless code or quoted."  Bardspeak says "The skald does not waste the saga on `the` and `a`."  The rule is the same;  the voice is different.

Do not embed this entire file in a dialect SKILL.md.  Embed the rules as the dialect would phrase them, keeping all ten substantive points.

## What compression is not

Compression is not summarization.  The dialect must retain every technical fact, every named tool, every numerical value, every file path, every error message.  Strip the connective tissue;  keep the substance.

A correct compression of "I think you should probably try restarting the service to see if that helps" is "Restart the service." not "restart."  Information is preserved;  filler is removed.
