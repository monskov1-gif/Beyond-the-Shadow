/* English dictionary: UI, names, places, shared strings. Dialogue lives in locale/en_*.js */
'use strict';
BTS.Locale = BTS.Locale || {};
BTS.Locale.en_parts = BTS.Locale.en_parts || [];
BTS.Locale.en = {
  ui: {
    subtitle: 'Beyond the Shadows', new_game: 'New Game', 'continue': 'Continue', load: 'Load', save: 'Save', settings: 'Settings',
    language: 'Language', credits: 'Credits', exit: 'Quit', resume: 'Resume', journal: 'Journal', map: 'Map', inventory: 'Items', observe: 'Watch a shadow', pause: 'Pause',
    paused: 'Paused', main_menu: 'Main Menu', back: 'Back', close: 'Close', yes: 'Yes', no: 'No', objective: 'Goal:', thought: 'Đorđe’s thoughts',
    confirm_new: 'Start a new game? The autosave will be overwritten as you play.', confirm_exit: 'Quit the game?', confirm_menu: 'Return to the main menu? Unsaved progress since the last checkpoint will be lost.',
    confirm_overwrite: 'Overwrite this save?', save_blocked: 'You can’t save right now: a scene or conversation is in progress.', save_failed: 'Could not save (browser storage unavailable).',
    slot: 'Slot {n}', slot_auto: 'Autosave', slot_empty: 'empty', slot_corrupt: 'file damaged or outdated', playtime: '{m} min',
    toast_obs: 'New observation: {name}', toast_fact: 'Confirmed fact: {name}', toast_hyp: 'New hypothesis: {name}', toast_promoted: 'Entry confirmed: {name}',
    toast_item: 'Received: {name}', toast_saved: 'Game saved', toast_autosaved: 'Autosave', toast_map: 'Added to the map: {name}',
    goodbye: 'Thank you for playing', goodbye_text: 'You can close this browser tab. Progress and settings are saved.', back_to_menu: 'Back to the main menu',
    made_with: 'custom engine · WebGL2 · WebAudio', the_end: 'The End'
  },
  set: {
    language: 'Язык / Language', lang_ru: 'Русский', lang_en: 'English', audio: 'Sound', master: 'Master volume', music: 'Music', sfx: 'Effects', ambience: 'Ambience', ui: 'Interface',
    text: 'Text', text_speed: 'Text speed', speed_slow: 'slow', speed_normal: 'normal', speed_fast: 'fast', speed_instant: 'instant',
    subtitles: 'Sound captions', on: 'on', off: 'off', video: 'Display', fullscreen: 'Fullscreen', scale: 'Resolution / pixel scale',
    scale_auto: 'auto', scale_270: '270 lines (large)', scale_360: '360 lines', scale_450: '450 lines', scale_540: '540 lines (small)',
    effects: 'Effects quality', fx_low: 'low', fx_medium: 'medium', fx_high: 'high', dev: 'Developer mode (FPS)',
    ui_size: 'Interface size', size_s: 'small', size_m: 'normal', size_l: 'large', size_xl: 'extra large', touch: 'Touch controls',
    controls: 'Controls', press_key: '…press a key (Esc to cancel)', reset_keys: 'Reset keys'
  },
  touch: { act: 'Act', observe: 'Shadow', run: 'Run', rotate: 'Turn your device sideways to see more of the village.' },
  key: { up: 'Up', down: 'Down', left: 'Left', right: 'Right', run: 'Run', interact: 'Act / continue', observe: 'Watch a shadow', journal: 'Journal', map: 'Map', inventory: 'Items', pause: 'Pause / back' },
  verb: { examine: 'Examine', talk: 'Talk', enter: 'Enter', go: 'Go', take: 'Take', open: 'Open', sit: 'Sit', hide: 'Hide', use: 'Use', read: 'Read', listen: 'Listen', look: 'Look', pray: 'Stand a while', leave: 'Leave' },
  jr: {
    tab_obs: 'Observations', tab_fact: 'Facts', tab_hyp: 'Hypotheses', tab_sketch: 'Sketches', tab_tasks: 'Tasks', tab_hint: '← → to turn sections',
    cat_obs: 'observation', cat_fact: 'fact', cat_hyp: 'hypothesis', cat_sketch: 'sketch',
    empty_obs: 'Nothing written down yet.', empty_fact: 'No confirmed facts yet.', empty_hyp: 'No hypotheses yet. Try linking two entries.', empty_sketch: 'No sketches yet. Press F to study the shadow of a person nearby.',
    link: 'Link two entries', cancel_link: 'Cancel linking', link_hint: 'Choose two entries you think belong together. Selected: {n} of 2.',
    link_fail: 'Đorđe stares at the two entries for a long time. No — together they don’t say anything yet. (Not sure what to link? Press “?”.)', link_known: 'Đorđe has already written this connection down.', link_notyet: 'Something is missing. One more confirmation is needed.',
    current: 'Now', hint_try: 'Hint: link “{a}” and “{b}”. Tap both entries — they are highlighted.', hint_half: 'Hint: “{a}” connects to something you haven’t found yet. Follow your goal — the clue will turn up.', hint_none: 'Nothing to link right now. You need new clues. Goal: {obj}'
  },
  map: { legend: '← → village / outskirts. The red dot is Đorđe.', unknown: 'This place is not on the map yet.', you: 'Đorđe', north: 'N ↑' },
  inv: { empty: 'Empty pockets.', state: 'Condition:', use: 'Useful for:' },
  cap: { bell: 'A bell tolls', thunder: 'Thunder', whisper: 'Indistinct whispering', dog: 'A dog barks', knock: 'Knocking', tear: 'A crack, like cloth tearing', release: 'A sigh of many voices', scream: 'A distant scream', crow: 'A crow caws', shutter: 'A shutter bangs', steps: 'Someone’s footsteps' },
  name: {
    djordje: 'Đorđe', zajko: 'Zajko', lisa: 'Lisa', jaglika: 'Jaglika', pecko: 'Pečko', gvozdin: 'Gvozdin', gorazd: 'Gorazd', jessica: 'Jessica', milka: 'Granny Milka',
    sava: 'Father Sava', dragan: 'Dragan', stana: 'Stana', tihomir: 'Tihomir', vesna: 'Vesna', radoje: 'Radoje', mila: 'Mila', luka: 'Luka', baka: 'Grandmother', villager: 'Villager'
  },
  loc: {
    village: 'Pakleštica', djordje_house: 'Đorđe’s House', zajko_house: 'Pečko and Gvozdin’s House', kafana: 'Dragan’s Kafana', guesthouse: 'Stana’s Guesthouse', church: 'Church of the Holy Archangel',
    gorazd_house: 'Gorazd’s House', tihomir_house: 'Tihomir’s House', jaglika_house: 'Jaglika’s House', outskirts: 'Outskirts', memory: 'Nine Years Ago', test_render: 'Render test', test_collision: 'Collision test'
  },
  area: { hill: 'The hill and Đorđe’s house', church: 'Church and graveyard', center: 'Square with the well', west: 'West street', east: 'East street', south: 'Southern yards and fields', fair: 'Fair meadow', jaglika: 'House by the forest', slope: 'The slope',
    milka: 'Granny Milka’s house', zajko: 'Zajko’s house', kafana: 'Kafana', guest: 'Guesthouse', tihomir: 'Bell-ringer’s house', gorazd: 'Gorazd’s house', forest: 'Forest path', river: 'The river', fields: 'Fields', viewpoint: 'Lookout rock', mill: 'Old mill' },
  chap: {
    prologue: 'Prologue. The Fair', ch1: 'Chapter 1. Changes', ch2: 'Chapter 2. The First Deaths', ch3: 'Chapter 3. The Pattern', ch4: 'Chapter 4. Gorazd and Jessica',
    ch5: 'Chapter 5. Lisa', ch6: 'Chapter 6. Watching', ch7: 'Chapter 7. Jaglika’s House', ch8: 'Chapter 8. The Legend', ch9: 'Chapter 9. The Silent Bell', ch10: 'Chapter 10. The Rite', ch11: 'Chapter 11. Release', epilogue: 'Epilogue'
  },
  date: { jun28: 'June 28', jun29: 'June 29', jul02: 'July 2', jul09: 'July 9', jul14: 'July 14', jul20: 'July 20', jul27: 'July 27', jul29: 'July 29', jul30: 'July 30', aug01: 'August 1',
    aug12: 'August 12', aug15: 'August 15', aug27: 'August 27', aug30: 'August 30', sep01: 'September 1', sep04: 'September 4', sep08: 'September 8', sep11: 'September 11', sep15: 'September 15', sep17: 'September 17',
    sep19: 'September 19', sep20: 'September 20', sep21: 'September 21', sep26: 'September 26', sep28: 'September 28', sep29: 'September 29', oct01: 'October 1', oct02: 'October 2', next_june: 'June, the following year' },
  cred: {
    h_story: 'Story', story: 'Based on the screenplay “Beyond the Shadows”.', h_game: 'Game', game: 'Design, programming, writing and localization — Claude (Anthropic), following the project brief.',
    h_tech: 'Technology', tech: 'Custom engine: WebGL2 renderer, WebAudio synthesizer, dialogue, save and localization systems.\nNo third-party engines or libraries.',
    h_art: 'Art', art: 'Every texture, sprite, portrait and icon is painted procedurally by the game’s code.', h_sound: 'Sound and music', sound: 'All music and sound is synthesized in real time.',
    h_refs: 'References', refs: 'HD-2D-style light and depth; rural Serbia; a stone church; a festival maypole.', h_people: 'Characters',
    people: 'Đorđe · Zajko · Lisa · Jaglika · Pečko · Gvozdin · Gorazd · Jessica · Granny Milka · Father Sava · Dragan · Stana · Tihomir · Vesna · Radoje',
    thanks: 'Thank you for staying until the end.'
  },
  sk: { pattern: { t: 'Village plan', d: 'Crosses — houses where someone died, with the dates. Red circles — where and when I saw Jaglika.' }, legend: '× — death   ○ — Jaglika', note_lag: 'the shadow lags' },
  obj: {}
};
