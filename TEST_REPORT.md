# Test Report / Отчёт о тестировании

All tests run headless in Chromium (Playwright) with software WebGL (SwiftShader). Commands are in `tools/`.

## 1. Build and data validation
`node tools/validate.mjs` loads the game page and checks the story, dialogue and locale data.

| Check | Result |
|---|---|
| Page loads, no script errors | ✅ `page errors: []` |
| Locale keys RU / EN | ✅ 1441 keys each, 0 missing, 0 empty, 0 dangling references |
| Dialogues referenced by story beats exist | ✅ 240 dialogues |

## 2. Full playthroughs (prologue → epilogue → credits)
`node tools/playthrough.mjs <ru|en>` starts a **new game** and plays it with a bot that uses only the real interaction paths (walk via navigation, interact, talk, exits, journal links, shadow observation, the stalking and rite minigames). No flags are set by hand. Text speed is instant and the game runs at 2× speed.

| Run | Beats reached | Result | Missing keys | Page errors |
|---|---|---|---|---|
| RU (first full run, before the chapter-card fix) | stopped at `c2_bell` | ❌ hang: a dialogue could start on top of another while a chapter card was shown → **fixed** (controls locked during cards, overlapping dialogues queued) | — | — |
| RU (after the fix) | every beat in order up to `e_final` and the credits | ✅ (bot did not register the credits screen → harness fixed) | 0 | 0 |
| EN | all beats, credits | ✅ PLAYTHROUGH COMPLETE | 0 | 0 |
| RU, final (after all critic fixes, new character art, mobile controls, skirt fix) | all beats, credits | ✅ PLAYTHROUGH COMPLETE | 0 | 0 |

The finale (rite minigame → release → epilogue → “The End” → credits) was reached in every complete run.

## 3. Save / load
`node tools/savetest.mjs <beat>`: play to a beat, save to slot 2, **reload the page**, load the slot, verify, check a corrupted slot, keep playing.

| Beat | State restored (beat, location, inventory, clue count) | No duplicate items | Dead characters stay gone | Corrupted slot detected | Continue after load |
|---|---|---|---|---|---|
| `c2_house` | ✅ (5 items, 17 clues) | ✅ | ✅ (Pečko, Gvozdin) | ✅ | ✅ (bot harness fixed to skip steps already done before the save) |
| `c7_wait` | see section 7 | | | | |

Saving is blocked (with a message) during cutscenes, dialogues, chapter cards and `noSave` beats; the autosave runs after key events.

## 4. Language
* Full playthroughs in both languages (above).
* **Switch during play:** started in RU, switched to EN in the middle of the first dialogue: the current line and the objective switched immediately (“A room on the hill. Evening…”, “Goal: Take the sketchbook from the desk”). The next line was in EN, and switching back to RU was also instant. 0 missing keys, 0 errors.
* Round-2 localization critic: 9/10, meaning parity on 84 sampled lines, typography and names consistent; all its issues fixed.

## 5. Phones and tablets
Emulated phone 844×390 (touch, `isMobile`, DPR 2):
* Touch controls appear automatically; the UI scales to the screen (root font 12.5 px at this size).
* A real touch drag on the virtual joystick (CDP touch events) moved Đorđe from x = 12.4 to x = 15.5 ✅.
* Menu, dialogue box and buttons fit the screen; the version label no longer overlaps the menu on low screens.

## 6. Critics
Nine critic categories in two full rounds, plus a third visual round and a key-scene check. Scores and fixes are in `VISUAL_REVIEW.md`; raw notes are in `docs/critics/`.

## 7. Known issues and notes
* The bot's screenshots for some beats show the hero still walking to the place (screenshots are taken at the start of the beat).
* FPS in headless runs (10–14) reflects software rendering, not real hardware.
* Human playtime was not measured. Estimate: 1.5–2 hours (about 9,700 words of Russian text, plus exploration).
* The `c7_wait` save test crashed the headless browser while several heavy tests ran in parallel. It is being re-run on its own; the result is recorded below.
