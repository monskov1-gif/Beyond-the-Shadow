# Visual Review / Визуальное ревью

Critic agents review screenshots of key scenes and score each category 0–10 with concrete
evidence (screenshot + what is wrong). Target: every key scene ≥ 7/10 before release.
Raw notes: `docs/critics/`.

## Round 1 (before fixes)

| Category | Score | Main evidence |
|---|---|---|
| Composition | 5 | visible world edges; interiors tiny in a black frame; camera pitch shows mostly roofs |
| Pixel art | 5 | inconsistent texel density; poplar sprite; foliage self-shadow blobs; heavy grain |
| Lighting | 6 | interiors underexposed; lamps don't light the ground; evening too maroon; day lacks warm/cool split |
| Architecture | 5 | flat box bridge; church without apse; maypole unlike reference 5; fair reads Western |
| Horror (narrative) | 7.5 | date/timeline slips, needle logic, unexplained mark (see `docs/critics/round1_text.md`) |
| Localization | 8 | Latin “j” in Cyrillic, RU/EN diary mismatch, term drift |
| Audio | 6 | reverb bypassed bus volumes; no fair crowd; ambience over dialogue |
| UX | 6 | toasts hidden under journal; no pause in dialogue; key rebinding bugs |

### Fixes applied after round 1
- Forest skirts and extended ground hide world edges; interior camera distance and room framing fixed; uniform 16 texels/unit atlas.
- Interior ambient (sky·0.9 + 0.12, exposure ≥ 1.3); point lights now light the ground; warm key / cool fill split; evening grading less red.
- Humped cobble bridge with walkable deck; church apse, fresco, arched portal and belfry; maypole rebuilt after reference 5
  (greenery, ribbons, two wreaths, dancers in white folk dress); fair stalls with licitar hearts, canvas awnings, lantern strings, braziers.
- NPCs populate scenes via schedules; film grain reduced; tree sprites and foliage shadows reworked.
- Camera much closer to the hero (user request): 26 units outside, 21 inside; internal resolution scales with distance so the pixel size stays the same.
- Audio: per-bus reverb sends, limiter, voice categories with limits, fair crowd layer, ambience ducked under dialogue.
- UX: toasts over journal, pause in dialogue, rebinding conflicts handled, hint bar contrast, chapter card no longer overlapped.
- Text: all round-1 localization and timeline issues fixed.
