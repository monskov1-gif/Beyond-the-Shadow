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

## Round 2 (after round-1 fixes and the closer camera)

| Category | Score | Evidence (screenshots from the automated run) |
|---|---|---|
| Composition | 5 | fair well framed; foreground roofs and trees hid the hero in several beats; interiors floated in black |
| Pixel art | 6 | strong props (kilims, stove, graves); flat stall canopies; shadow figures as blobs |
| Lighting | 6 | bonfire and lamp pools good; **rain puddles drawn on interior floors**; storm interior blown out; Jaglika's hiding scene near black |
| Architecture | 6 | church exterior matches reference 4 (stone facade, niche, arched door, belfry); church interior bare |
| Animation / staging | 5 | crowd at the fair reads; overlaps during dialogue staging |
| Horror | 6 | release crowd of shadows effective; rite read as murk |
| Audio (code review) | 7 | per-bus reverb, crowd layer, limiter fixed; chase cut the release choir; whisper bypassed SFX volume |
| Localization | 9 | 1431/1431 keys, meaning parity on 84 sampled lines, typography and names consistent |
| UX | 7.5 | pause in dialogue, toasts, captions, rebinding fixed; rite and stalking could be broken by leaving the location |
| Horror & narrative | 8 | consistent timeline and deduction chain; needle logic and the five idle days needed a line each |

Fixes: no puddles indoors; indoor lightning softened; houses between the hero and the bottom of the frame dither-fade; brighter interior fill; bigger rite bonfire light; rite and stalking exits locked and the rite survives re-entering; chapter cards lock controls and hide the location banner; forced freeze cue in the stalking; ≤3 toasts; whisper and murmur routed through their buses; choir plays ≥10 s before the chase; unused SFX wired in; text fixes for the needle and Tihomir; shorter objectives.

## Round 3 (after round-2 fixes, new character art, skirt fix)

| Category | Score | Notes |
|---|---|---|
| Composition | 5 | e_final (stones, centred fire, fanned shadows) the strongest frame; some beat screenshots are taken while the hero is still walking to the place |
| Pixel art | 6 | clean props, roofs, stalls |
| Lighting | 6 | warm interiors now read well; funeral too dark → candles added; wet glare column under the bonfire → fixed |
| Architecture | 6 | good house massing and tiles |
| Animation / staging | 5 | skirts now proportionate in profile |
| Horror | 6 | release (47) "the best image in the game"; stalking fog oppressive |
| Character design | 6 | portraits faithful to the supplied art (Đorđe; Jaglika early is "the best of the set"); sprite eyes of Đorđe hidden by the fringe → fixed; gaunt Jaglika's jacket too dark and wrap read as a beanie → lightened, knot added |

Critic scores for key scenes (before the round-3 fixes): fair 7, release 7, epilogue fair 7, rite 5, church/funeral 4, Jaglika house 4.
The round-3 fixes target exactly the low ones (funeral candles, needle-table candle, wet glare, character readability); they were checked on test screenshots but not re-scored by a fourth critic pass, so the target of ≥7 for every key scene is **not confirmed** for the rite, the funeral and Jaglika's house.
Remaining ideas (not blocking): richer church interior (iconostasis, mourners), stronger framing for the rite climax, more warmth in Jaglika's storage room.
