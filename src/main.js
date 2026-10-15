/* Entry point. */
'use strict';
window.addEventListener('load', function () {
  try { BTS.Game.boot(); } catch (e) { BTS.App.fatal(e); }
});
