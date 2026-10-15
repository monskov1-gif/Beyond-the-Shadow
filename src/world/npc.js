/* NPC brain: explicit state machine (idle, walking, talking, working, frightened, suspicious,
   mourning, dead) driven by data schedules, with per-NPC desynchronised timers. */
'use strict';
BTS.Brain = function (npcId) {
  this.npcId = npcId;
  this.state = 'idle';
  this.task = null;
  this.timer = Math.random() * 3;
  this.workT = Math.random() * 2;
  this.repath = 0;
  this.paused = false;   // set by cutscenes
  this.talkTo = null;
};
BTS.Brain.STATES = ['idle', 'walking', 'talking', 'working', 'frightened', 'suspicious', 'mourning', 'dead'];
(function () {
  var B = BTS.Brain.prototype;
  B.setState = function (s) {
    if (BTS.Brain.STATES.indexOf(s) < 0) { BTS.Log.warn('bad npc state', s); return; }
    if (this.state !== s) { this.state = s; this.timer = 0; }
  };
  /* task: {at:[x,z], act:'idle'|'work'|'wander'|'sit'|'look'|'fear'|'mourn'|'pray'|'sketch', dir, radius} */
  B.setTask = function (task, ent, snap) {
    this.task = task;
    if (snap && task && task.at) { ent.x = task.at[0]; ent.z = task.at[1]; ent.path = null; if (task.dir) ent.dir = task.dir; }
    else if (task && task.at) ent.path = null;
  };
  B.update = function (dt, e, world) {
    var anim = e.anim;
    if (this.paused) return;
    this.timer += dt;
    if (this.state === 'dead') { e.hidden = true; return; }
    if (this.state === 'talking') {
      if (this.talkTo) e.faceTo(this.talkTo.x, this.talkTo.z);
      anim && anim.set(BTS.Dialogue && BTS.Dialogue.speakingId === this.npcId ? 'talk' : 'idle');
      return;
    }
    var task = this.task;
    if (!task) { anim && anim.set('idle'); return; }
    var target = task.at;
    if (task.act === 'wander') {
      if (!this.wanderGoal || this.timer > this.wanderWait) {
        var r = task.radius || 2.5, a = Math.random() * 6.283, d = Math.random() * r;
        var gx = task.at[0] + Math.cos(a) * d, gz = task.at[1] + Math.sin(a) * d;
        if (!world.blocked(gx, gz, 0.3)) { this.wanderGoal = [gx, gz]; e.path = world.findPath(e.x, e.z, gx, gz); }
        this.timer = 0; this.wanderWait = 4 + Math.random() * 6;
      }
      target = null;
    }
    var slow = this.state === 'mourning' || task.act === 'mourn' ? 0.55 : 1;
    if (target) {
      var d = Math.hypot(target[0] - e.x, target[1] - e.z);
      if (d > 0.25) {
        this.repath -= dt;
        if (!e.path || this.repath <= 0) { e.path = world.findPath(e.x, e.z, target[0], target[1]) || [target.slice()]; this.repath = 3 + Math.random(); }
      }
    }
    if (e.path && e.path.length) {
      var done = e.followPath(dt, slow);
      if (anim) anim.set(slow < 1 ? 'walk' : 'walk'), anim.speed = slow < 1 ? 0.6 : 1;
      if (this.state !== 'mourning' && this.state !== 'frightened') this.state = 'walking';
      if (!done) return;
    }
    if (anim) anim.speed = 1;
    if (task.dir && !(task.act === 'look')) e.dir = task.dir;
    switch (task.act) {
      case 'work':
        this.state = 'working';
        this.workT += dt;
        anim && anim.set(Math.floor(this.workT / 1.4) % 3 === 0 ? 'idle' : 'interact');
        break;
      case 'look':
        this.state = 'suspicious';
        if (this.timer > 1.2 + Math.random() * 1.5) { this.timer = 0; e.dir = ['left', 'right', 'down', 'up'][Math.floor(Math.random() * 4)]; }
        anim && anim.set('idle');
        break;
      case 'fear': this.state = 'frightened'; anim && anim.set('fear'); break;
      case 'mourn': this.state = 'mourning'; anim && anim.set('weak'); break;
      case 'pray': this.state = 'mourning'; anim && anim.set('kneel'); break;
      case 'sit': this.state = 'idle'; anim && anim.set('sit'); break;
      case 'sketch': this.state = 'working'; anim && anim.set('sketch'); break;
      case 'cower': this.state = 'frightened'; anim && anim.set('cower'); break;
      case 'blank': this.state = 'suspicious'; anim && anim.set('blank'); break;
      case 'lie': this.state = 'idle'; anim && anim.set('lie'); e.solid = false; break;
      default: if (this.state !== 'mourning') this.state = 'idle'; anim && anim.set(this.state === 'mourning' ? 'weak' : 'idle');
    }
  };
})();
