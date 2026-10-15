/* Scripted full playthrough (used by tools/playthrough.mjs). Only real interactions — no flag edits. */
BTS.Walk = [
  { beat: 'p_room', do: [['interact', 'desk']] },
  { beat: 'p_window', do: [['interact', 'window']] },
  { beat: 'p_go_fair', do: [['exit', 'out'], ['walk', [72, 68.5]]] },
  { beat: 'p_fair', do: [['talk', 'milka'], ['talk', 'pecko'], ['talk', 'mila'], ['walk', [86, 76]], ['talk', 'zajko']] },
  { beat: 'p_game', do: [['observe', 'zajko']] },
  { beat: 'p_night', do: [['walk', [54, 52]], ['walk', [55, 19]], ['exit', 'djordje']] }
];
