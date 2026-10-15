'use strict';
(function () {
  function boot() {
    var canvas = document.getElementById('game');
    BTS.Renderer.init(canvas);
    BTS.Textures.build(); BTS.CharSprites.build(); BTS.PropSprites.build();
    BTS.Renderer.uploadAtlas();
    var q = new URLSearchParams(location.search);
    BTS.World.load(q.get('loc') || 'test_render', q.get('spawn') || 'default');
    BTS.Env.set({ time: q.get('time') || 'evening', weather: q.get('weather') || 'clear' }, true);
    var p = BTS.World.player;
    var dj = new BTS.Entity({ id: 'z', kind: 'npc', sheet: 'zajko', x: p.x + 1.5, z: p.z + 0.5 });
    BTS.World.addEntity(dj);
    document.getElementById('boot').style.display = 'none';
    BTS.App.start(function (dt) {
      BTS.World.update(dt, true);
      BTS.Env.update(dt, BTS.Camera.target);
      BTS.Camera.update(dt, BTS.World.player ? [BTS.World.player.x, BTS.World.player.y, BTS.World.player.z] : null);
      BTS.Particles.update(dt, BTS.Camera);
    }, function () {
      BTS.Renderer.beginFrame();
      BTS.World.render(BTS.Renderer, BTS.Env);
      BTS.Particles.render(BTS.Renderer, BTS.Env);
      BTS.Renderer.render(BTS.World, BTS.Env, BTS.Camera);
    });
  }
  window.addEventListener('load', function () { try { boot(); } catch (e) { BTS.App.fatal(e); } });
})();
