/* Data containers filled by the story/data files. */
'use strict';
BTS.Data = BTS.Data || {};
BTS.Data.dialogues = BTS.Data.dialogues || {};
BTS.Data.npcs = BTS.Data.npcs || {};
BTS.Data.talk = BTS.Data.talk || {};
BTS.Data.clues = BTS.Data.clues || {};
BTS.Data.items = BTS.Data.items || {};
BTS.Data.deductions = BTS.Data.deductions || [];
BTS.Data.patternMarks = BTS.Data.patternMarks || [];
BTS.Data.globalInteract = BTS.Data.globalInteract || [];
BTS.Data.credits = [
  { h: 'cred.h_story', k: 'cred.story' },
  { h: 'cred.h_game', k: 'cred.game' },
  { h: 'cred.h_tech', k: 'cred.tech' },
  { h: 'cred.h_art', k: 'cred.art' },
  { h: 'cred.h_sound', k: 'cred.sound' },
  { h: 'cred.h_refs', k: 'cred.refs' },
  { h: 'cred.h_people', k: 'cred.people' }
];
/* helper used by dialogue files: D('id', [...steps]) */
BTS.D = function (id, steps) { if (BTS.Data.dialogues[id]) BTS.Log.warn('duplicate dialogue', id); BTS.Data.dialogues[id] = steps; };
