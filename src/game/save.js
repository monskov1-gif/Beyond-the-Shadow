/* Save/Load: versioned JSON in localStorage, 3 manual slots + autosave, checksum, safe handling
   of corrupted/old files, migration, no saving during critical scenes. */
'use strict';
BTS.Save = (function () {
  var PREFIX = 'bts.save.';
  var SLOTS = ['auto', '1', '2', '3'];
  var S = { SLOTS: SLOTS };

  function checksum(str) { return BTS.strHash(str).toString(16); }

  S.canSave = function () {
    if (!BTS.World.loc || !BTS.State.d.beat) return false;
    if (BTS.Cutscene && BTS.Cutscene.running) return false;
    if (BTS.Dialogue && BTS.Dialogue.active) return false;
    if (BTS.Story && BTS.Story.noSave()) return false;
    return true;
  };
  S.snapshot = function () {
    var d = JSON.parse(JSON.stringify(BTS.State.d));
    var p = BTS.World.player;
    d.location = BTS.World.locId;
    d.player = p ? { x: +p.x.toFixed(2), z: +p.z.toFixed(2), dir: p.dir } : null;
    d.env = BTS.Env.serialize();
    d.language = BTS.I18N.lang;
    d.version = BTS.SAVE_VERSION;
    d.savedAt = Date.now();
    return d;
  };
  S.write = function (slot, data) {
    var body = JSON.stringify(data);
    var wrap = JSON.stringify({ v: BTS.SAVE_VERSION, sum: checksum(body), body: body });
    try { localStorage.setItem(PREFIX + slot, wrap); return true; }
    catch (e) { BTS.Log.error('save failed', e); return false; }
  };
  S.save = function (slot, force) {
    if (!force && !S.canSave()) return false;
    var ok = S.write(slot, S.snapshot());
    if (ok) { BTS.State.d.lastSaved = Date.now(); BTS.Events.emit('saved', slot); }
    return ok;
  };
  S.autosave = function () { if (S.canSave()) { S.save('auto', true); BTS.Log.info('autosave'); } };

  /* returns {ok, data, error:'missing'|'corrupt'|'version'} */
  S.read = function (slot) {
    var raw;
    try { raw = localStorage.getItem(PREFIX + slot); } catch (e) { return { ok: false, error: 'corrupt' }; }
    if (!raw) return { ok: false, error: 'missing' };
    try {
      var w = JSON.parse(raw);
      if (!w || typeof w.body !== 'string') return { ok: false, error: 'corrupt' };
      if (checksum(w.body) !== w.sum) return { ok: false, error: 'corrupt' };
      var d = JSON.parse(w.body);
      d = S.migrate(d);
      if (!d) return { ok: false, error: 'version' };
      if (!d.beat || !BTS.Story.hasBeat(d.beat)) return { ok: false, error: 'corrupt' };
      return { ok: true, data: d };
    } catch (e) { return { ok: false, error: 'corrupt' }; }
  };
  S.migrate = function (d) {
    if (!d || typeof d.version !== 'number') return null;
    if (d.version > BTS.SAVE_VERSION) return null;
    if (d.version < 2) { d.map = d.map || {}; d.done = d.done || {}; }
    if (d.version < 3) { d.clueOrder = d.clueOrder || Object.keys(d.clues || {}); d.inventory = (d.inventory || []).map(function (i) { return typeof i === 'string' ? { id: i, state: 'default' } : i; }); }
    // de-duplicate inventory defensively
    var seen = {}; d.inventory = (d.inventory || []).filter(function (i) { if (seen[i.id]) return false; seen[i.id] = 1; return !!BTS.Data.items[i.id]; });
    d.version = BTS.SAVE_VERSION;
    return d;
  };
  S.info = function (slot) {
    var r = S.read(slot);
    if (!r.ok) return r;
    var d = r.data;
    return { ok: true, beat: d.beat, chapter: d.chapter, savedAt: d.savedAt, playtime: d.playtime, location: d.location, objectiveKey: d.objectiveKey };
  };
  S.any = function () { return SLOTS.some(function (s) { return S.read(s).ok; }); };
  S.latest = function () {
    var best = null, bt = 0;
    SLOTS.forEach(function (s) { var r = S.read(s); if (r.ok && (r.data.savedAt || 0) > bt) { bt = r.data.savedAt; best = s; } });
    return best;
  };
  S.erase = function (slot) { try { localStorage.removeItem(PREFIX + slot); } catch (e) { } };
  return S;
})();
