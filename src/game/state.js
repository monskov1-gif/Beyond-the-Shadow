/* Game state: story flags, beats, clues (observations / facts / hypotheses), sketches,
   inventory (unique items with states), NPC fates, map knowledge, completed scenes. */
'use strict';
BTS.State = (function () {
  var S = {};
  S.fresh = function () {
    return {
      version: BTS.SAVE_VERSION, beat: null, flags: {}, clues: {}, clueOrder: [], inventory: [], npc: {}, map: {}, done: {},
      location: null, player: null, env: null, playtime: 0, day: 1, lastSaved: 0, objectiveKey: null, chapter: 'prologue', notes: 0
    };
  };
  S.d = S.fresh();
  S.reset = function () { S.d = S.fresh(); };

  S.flag = function (k) { return !!S.d.flags[k]; };
  S.set = function (k, v) { S.d.flags[k] = v === undefined ? true : v; BTS.Events.emit('flag', k, S.d.flags[k]); };
  S.val = function (k) { return S.d.flags[k]; };
  S.inc = function (k) { S.d.flags[k] = (S.d.flags[k] || 0) + 1; return S.d.flags[k]; };
  S.done = function (k) { return !!S.d.done[k]; };
  S.markDone = function (k) { S.d.done[k] = true; };

  /* clues */
  S.hasClue = function (id) { return !!S.d.clues[id]; };
  S.addClue = function (id, silent) {
    var def = BTS.Data.clues[id];
    if (!def) { BTS.Log.warn('unknown clue', id); return false; }
    if (S.d.clues[id]) return false;
    S.d.clues[id] = { cat: def.cat, t: S.d.playtime, day: S.d.day, isNew: true };
    S.d.clueOrder.push(id);
    if (!silent) BTS.Events.emit('clue', id, def);
    return true;
  };
  S.promote = function (id, cat) { var c = S.d.clues[id]; if (c && c.cat !== cat) { c.cat = cat; c.isNew = true; BTS.Events.emit('clue', id, BTS.Data.clues[id], true); } };
  S.cluesBy = function (cat) { return S.d.clueOrder.filter(function (id) { return S.d.clues[id] && S.d.clues[id].cat === cat; }); };

  /* inventory: unique by id, items carry a state */
  S.hasItem = function (id) { return S.d.inventory.some(function (i) { return i.id === id; }); };
  S.addItem = function (id, state) {
    if (!BTS.Data.items[id]) { BTS.Log.warn('unknown item', id); return false; }
    if (S.hasItem(id)) return false;
    S.d.inventory.push({ id: id, state: state || 'default', isNew: true });
    BTS.Events.emit('item', id, true);
    return true;
  };
  S.removeItem = function (id) { var n = S.d.inventory.length; S.d.inventory = S.d.inventory.filter(function (i) { return i.id !== id; }); if (n !== S.d.inventory.length) BTS.Events.emit('item', id, false); };
  S.itemState = function (id, st) { var it = S.d.inventory.filter(function (i) { return i.id === id; })[0]; if (!it) return null; if (st !== undefined) it.state = st; return it.state; };

  /* npc fates */
  S.npc = function (id) { return S.d.npc[id] || (S.d.npc[id] = { dead: false, stage: 0 }); };
  S.isDead = function (id) { return !!(S.d.npc[id] && S.d.npc[id].dead); };
  S.kill = function (id) { S.npc(id).dead = true; BTS.Events.emit('death', id); };

  S.reveal = function (area) { if (!S.d.map[area]) { S.d.map[area] = true; BTS.Events.emit('map', area); } };
  return S;
})();
