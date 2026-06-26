# Cavespeak response sample (for lint test)

Hand-crafted response designed to hit ~10% tone ratio.  Used by tests/lint.test.js to verify the tone-counting math.

Hand count (verify against lint.js output):

- Word tokens (matches by `/[A-Za-z][A-Za-z0-9'-]*/g`):  19
- Tropes (cavespeak: mammoth):  1 occurrence -> 1 tone token
- Self-reference markers (cavespeak: caveman):  1 occurrence -> 1 tone token
- Lexicon surplus:  0
- Flourish openers:  0
- Total tone tokens:  2
- Tone ratio:  2 / 19 = 0.1053 (10.53%)

Response body (this is the part the lint reads):

---

Port 3 set to VLAN 20 untagged.  Port 8 tagged.  PVID port 3 = 20.  Save to flash.  Test laptop on 10.20.20.24.  Mammoth caught.  Caveman done.
