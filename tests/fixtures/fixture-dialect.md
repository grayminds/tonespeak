---
name: tonespeak-fixture
description: Test fixture for loader axis-merge and marker-fence behavior.  Not a real dialect.
reminder: |
  TONESPEAK fixture active.  Compress.  Drop articles, linking verbs, filler.
axes:
  compression: high
  lexicon_rate: heavy
  trope_frequency: occasional
  self_reference: rationed
  cadence: tight
  protocols: situational
  auto_clarity: standard
  tone_cap: 0.12
---

# tonespeak fixture dialect

Voice anchor.  Universal.  Always present.

<!-- when:protocols>=situational -->
## Protocols block (conditional on protocols >= situational)

This text appears only when protocols axis is situational or always.
<!-- end -->

<!-- when:trope_frequency>=occasional -->
## Tropes block (conditional on trope_frequency >= occasional)

This text appears only when trope_frequency is occasional or signature.
<!-- end -->

<!-- when:self_reference>=rationed -->
## Self-reference block (conditional on self_reference >= rationed)

This text appears only when self_reference is rationed or free.
<!-- end -->

<!-- when:compression=ultra -->
## Ultra-compression-only block

Only appears at compression=ultra.
<!-- end -->

<!-- when:compression>=high & trope_frequency>=occasional -->
## Combined AND block

High compression plus occasional tropes.
<!-- end -->

<!-- when:cadence=loose | cadence=hard-cap -->
## Cadence OR block

Either loose or hard-cap, not tight.
<!-- end -->

<!-- when:tone_cap>=0.15 -->
## Flavor-mode block (numeric axis)

Visible only when tone_cap >= 0.15.
<!-- end -->

<!-- when:malformed condition -->
## Malformed-fence block

Loader fails open;  this block should be included with a stderr warning.
<!-- end -->

End of fixture.
