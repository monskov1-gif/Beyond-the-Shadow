/* Character definitions: appearance for sprite/portrait painters + identity data. */
'use strict';
BTS.Data = BTS.Data || {};
(function () {
  var h = BTS.Col.hex;
  var SKIN = h('e3b48f'), SKIN2 = h('d29e78'), SKIN_PALE = h('d8bfa8'), SKIN_OLD = h('cfa98a');
  BTS.Data.characters = {
    /* Đorđe after the supplied art: thick black shaggy hair, pale tired face, grey eyes, charcoal hoodie-jacket, black backpack */
    djordje: { body: 'teen', skin: h('dcc3ae'), hair: h('17151a'), hairStyle: 'shaggy', topColor: h('3c3e46'), sleeve: h('35373e'), hood: h('2a2b31'), bottomColor: h('25272e'), shoes: h('1d1b1f'), backpack: h('2c2a33'), eyes: h('2a3038'), brows: true, portrait: { face: 'boy', eyes: h('7c858e'), hair: 'shaggy', outfit: 'hoodie', under: h('1e1e24'), acc: ['strap'], bg: h('4a5266'), heavyLids: 0.5, bags: 0.6, lookY: 0.01, faceTweak: { chinY: 1.2, jawX: 0.48, nose: 0.9, eye: 1.05 }, browCol: h('1a181c') } },
    djordje_young: { body: 'small', skin: h('dcc3ae'), hair: h('17151a'), hairStyle: 'shaggy', topColor: h('7a8a6a'), bottomColor: h('3a3a44'), shoes: h('3b2a20'), blush: true, portrait: { face: 'small', eyes: h('7c858e'), hair: 'shaggy', hairOpt: { fringe: -0.08, len: 0.45 }, outfit: 'sweater', bg: h('7a6a50'), sepia: 0.25, blush: 0.8, browCol: h('2a262a') } },
    zajko: { body: 'child', skin: SKIN2, hair: h('7a4a26'), hairStyle: 'short', topColor: h('a8402f'), sleeve: h('9a3a2a'), bottomColor: h('4a3c30'), shoes: h('2c2320'), blush: true, brows: true, portrait: { face: 'boy', eyes: h('4a6a42'), freckles: true, hair: 'short', hairOpt: { messy: 1, fringe: -0.42, volume: 0.06 }, outfit: 'sweater', outfitOpt: { underCollar: true }, under: h('d8d0bc'), bg: h('5a6a4a'), blush: 0.7 } },
    lisa: { body: 'woman', skin: SKIN, hair: h('8e3e22'), hairStyle: 'ponytail', topColor: h('3c5246'), coat: true, bottomColor: h('2c3442'), shoes: h('2a201a'), strap: h('5a3a24'), bagSide: true, brows: true, portrait: { face: 'woman', eyes: h('6a5a32'), hair: 'ponytail', outfit: 'coat', under: h('d8cfbe'), acc: [{ type: 'earrings', kind: 'pearl' }], bg: h('5a5a6e'), faceTweak: { age: 0.1 } } },
    /* Jaglika after the supplied art. Early (fair .. chapter 5): a lively granny — copper bob, big grey-blue glasses,
       teal beads and earrings, purple turtleneck, green coat. Late (chapter 6 on): gaunt, navy head-wrap, star earrings, plum zip jacket. */
    jaglika: { body: 'old', skin: h('e2bea6'), hair: h('b8542a'), hairStyle: 'bob', glasses: true, glassesCol: h('8ea6b2'), beads: h('2f8a86'), earring: h('2f8a86'), collar: h('5a2a78'), topColor: h('1f4a2a'), sleeve: h('1a4024'), coat: true, bottomType: 'skirt', bottomColor: h('2a2a30'), shoes: h('1c1618'), wrinkles: true, eyes: h('2a1e1a'), portrait: { face: 'old', eyes: h('5a4a40'), hair: 'bob', outfit: 'coat', outfitOpt: { turtle: true, open: 0.5 }, under: h('5a2a78'), acc: ['glasses', 'beads', 'earrings'], jewel: h('2f8a86'), glassesCol: h('8ea6b2'), bg: h('6a5a48'), mood: { curve: 0.025 }, teeth: true, lipCol: h('b86a62'), age: 0.8 } },
    jaglika_late: { body: 'old', skin: h('cdb6a8'), hair: h('1c2a44'), hairStyle: 'turban', scarf: h('1c2a46'), earring: h('6a7a9a'), topColor: h('4c2c40'), sleeve: h('422636'), zip: h('b39aa0'), bottomType: 'skirt', bottomColor: h('1e1a1e'), shoes: h('141012'), wrinkles: true, eyes: h('7a8ca0'), portrait: { face: 'old', eyes: h('8ea0b4'), hair: 'wrap', outfit: 'zipjacket', acc: [{ type: 'earrings', kind: 'star' }], jewel: h('7080a8'), bg: h('3a3e52'), gaunt: 1, age: 1, heavyLids: 0.6, browCol: h('6a5c5c'), mouthCurve: -0.02, lipCol: h('a07672') } },
    pecko: { body: 'woman', skin: SKIN, hair: h('4a3022'), hairStyle: 'scarf', scarf: h('c8b48a'), scarfPattern: h('a04030'), topColor: h('46607a'), bottomType: 'skirt', bottomColor: h('3a4e66'), apron: h('d8d0bc'), shoes: h('2a2018'), portrait: { face: 'woman', eyes: h('5a4632'), hair: 'scarf', hairOpt: { tie: 'nape' }, outfit: 'dress', outfitOpt: { apron: true, neck: 0.3 }, under: h('46607a'), bg: h('7a6650'), blush: 0.5, faceTweak: { age: 0.25 } } },
    gvozdin: { body: 'big', skin: SKIN2, hair: h('2a2220'), hairStyle: 'short', beard: h('2e2420'), topColor: h('6e6a5e'), apron: h('5a3a24'), bottomColor: h('2e2c2a'), shoes: h('1e1814'), brows: true, portrait: { face: 'man', eyes: h('3a3028'), hair: 'short', hairOpt: { front: -0.7 }, beard: 'full', outfit: 'smith', apron: h('5a3a24'), bg: h('6a4a3a'), stout: 0.3, faceTweak: { sh: 1.25, neck: 0.58 }, browThick: 1.3 } },
    gorazd: { body: 'big', skin: SKIN2, hair: h('3a2a20'), hairStyle: 'short', hat: 'cap', hatColor: h('3a3632'), mustache: h('2a1e18'), topColor: h('7a3a2e'), vest: h('3e3428'), bottomColor: h('34302a'), shoes: h('221a14'), brows: true, portrait: { face: 'man', eyes: h('3a3028'), hair: 'short', hairOpt: { front: -0.75 }, hat: 'flatcap', mustache: 'thick', outfit: 'shirtvest', bg: h('5a5446'), stubble: h('3a2a20'), faceTweak: { sh: 1.2, age: 0.35, jawX: 0.6 }, browThick: 1.3, heavyLids: 0.4 } },
    jessica: { body: 'woman', skin: h('ecc4a2'), hair: h('d4b46a'), hairStyle: 'short', topColor: h('c8963a'), coat: true, bottomColor: h('3a4a5a'), shoes: h('5a4a3a'), backpack: h('3a5a4a'), camera: true, blush: true, portrait: { face: 'woman', eyes: h('4a7a9a'), freckles: true, hair: 'pixie', outfit: 'coat', under: h('e8e2d4'), acc: ['camera'], bg: h('5a6a7a'), blush: 0.5, faceTweak: { chinY: 1.2 } } },
    milka: { body: 'old', skin: SKIN_OLD, hair: h('d0ccc4'), hairStyle: 'scarf', scarf: h('e2dccb'), scarfPattern: h('8a2a2a'), topColor: h('2e2a2c'), vest: h('5a2a28'), bottomType: 'skirt', bottomColor: h('2a2628'), shoes: h('1a1416'), wrinkles: true, portrait: { face: 'old', eyes: h('2a2020'), hair: 'wavy', hairCol: h('2c2422'), grey: 0.55, outfit: 'dress', outfitOpt: { lace: true, cardigan: true, neck: 0.3 }, top: h('3a2a34'), under: h('22181e'), acc: [{ type: 'brooch', x: -0.25, y: 2.45 }, { type: 'earrings', kind: 'pearl' }], bg: h('6a5a44'), sepia: 0.35, stout: 1, browStraight: true, browThick: 1.6, browCol: h('2a2220'), mouthCurve: -0.015, lipCol: h('a0605a'), faceTweak: { lip: 1.15, nose: 0.85, noseW: 0.9, fw: 1.04, age: 0.75 } } },
    sava: { body: 'man', skin: SKIN, hair: h('6a6660'), hairStyle: 'short', beard: h('8a857c'), hat: 'kamilavka', hatColor: h('17141a'), topColor: h('1c1a1e'), bottomType: 'skirt', bottomColor: h('1c1a1e'), cross: true, shoes: h('121014'), portrait: { face: 'oldman', eyes: h('4a4038'), hair: 'priest', beard: 'long', hat: 'kamilavka', outfit: 'cassock', acc: ['cross'], bg: h('5a4a3a'), hy: 50, age: 0.6 } },
    dragan: { body: 'big', skin: SKIN2, hair: h('3a3028'), hairStyle: 'bald', mustache: h('3a3028'), topColor: h('d6d0c2'), vest: h('1e1e22'), bottomColor: h('26262a'), shoes: h('141414'), portrait: { face: 'man', eyes: h('3a3028'), hair: 'bald', mustache: 'walrus', outfit: 'shirtvest', under: h('dcd6c8'), bg: h('6a5040'), stout: 0.6, faceTweak: { sh: 1.2, age: 0.4 } } },
    stana: { body: 'woman', skin: SKIN, hair: h('5a4434'), hairStyle: 'bun', topColor: h('a06a6a'), bottomType: 'skirt', bottomColor: h('3e3438'), shoes: h('2a2020'), portrait: { face: 'woman', eyes: h('5a4632'), hair: 'bun', outfit: 'dress', outfitOpt: { cardigan: true }, top: h('8a5a5a'), under: h('e2d8c8'), acc: [{ type: 'brooch', x: -0.3, y: 2.4, stone: [40, 90, 120] }], bg: h('6a5a5a'), faceTweak: { age: 0.45 } } },
    tihomir: { body: 'old', skin: SKIN_OLD, hair: h('b8b4ac'), hairStyle: 'short', hat: 'cap', hatColor: h('4a4238'), mustache: h('c8c4bc'), topColor: h('5a4a38'), coat: true, bottomColor: h('3a342c'), shoes: h('221c16'), wrinkles: true, portrait: { face: 'oldman', eyes: h('4a4a44'), hair: 'short', hairOpt: { front: -0.6 }, hat: 'flatcap', mustache: 'walrus', outfit: 'coat', under: h('cfc6b0'), bg: h('4e4a44'), age: 1, heavyLids: 0.5 } },
    /* Gorazd after he has taken his cap off (same man, receding crop) */
    gorazd_bare: { body: 'big', skin: SKIN2, hair: h('3a2a20'), hairStyle: 'short', mustache: h('2a1e18'), topColor: h('7a3a2e'), vest: h('3e3428'), bottomColor: h('34302a'), shoes: h('221a14'), brows: true, portrait: { face: 'man', eyes: h('3a3028'), hair: 'crop', mustache: 'thick', outfit: 'shirtvest', bg: h('5a5446'), stubble: h('3a2a20'), faceTweak: { sh: 1.2, age: 0.35, jawX: 0.6 }, browThick: 1.3, heavyLids: 0.4 } },
    /* Zajko's parents: Zlatko (mother) and Jablan (father); he has their red-brown hair */
    zlatko: { body: 'woman', skin: SKIN, hair: h('8a4426'), hairStyle: 'bun', topColor: h('e4dccb'), embroidery: h('a8322a'), bottomType: 'skirt', bottomColor: h('4a3a30'), apron: h('6a5a7a'), shoes: h('2a2020'), brows: true, portrait: { face: 'woman', eyes: h('4a6a42'), hair: 'bun', outfit: 'blouse', outfitOpt: { apron: true }, apron: h('6a5a7a'), freckles: true, bg: h('6a6a50'), blush: 0.4, faceTweak: { age: 0.3 } } },
    jablan: { body: 'man', skin: SKIN2, hair: h('7e4224'), hairStyle: 'short', beard: h('7a4024'), topColor: h('6a7480'), vest: h('4a3a2a'), bottomColor: h('3a3630'), shoes: h('2a2018'), brows: true, portrait: { face: 'man', eyes: h('4a6a42'), hair: 'short', hairOpt: { messy: 0.5, front: -0.62 }, beard: 'short', outfit: 'shirtvest', under: h('6a7480'), vest: h('4a3a2a'), freckles: true, bg: h('56604e'), faceTweak: { age: 0.35, sh: 1.12 } } },
    vesna: { body: 'woman', skin: SKIN, hair: h('3a2418'), hairStyle: 'braid', ribbon: h('b03030'), topColor: h('e2dccc'), embroidery: h('b03030'), bottomType: 'skirt', bottomColor: h('8a2a28'), skirtBand: h('e2c060'), shoes: h('2a2020'), portrait: { face: 'woman', eyes: h('4a3424'), hair: 'braid', outfit: 'blouse', outfitOpt: { vest: false }, bg: h('6a5a4a'), blush: 0.5 } },
    radoje: { body: 'man', skin: SKIN2, hair: h('3a2e24'), hairStyle: 'short', hat: 'brim', hatColor: h('2e2a26'), beard: h('3a2e24'), topColor: h('8a7a5a'), vest: h('c8b89a'), bottomColor: h('3a342c'), shoes: h('2a2018'), portrait: { face: 'man', eyes: h('3a3028'), hair: 'short', hat: 'brim', beard: 'short', outfit: 'shirtvest', under: h('cfc4ac'), bg: h('5a5040'), faceTweak: { age: 0.45 } } },
    mila: { body: 'child', skin: SKIN, hair: h('6a4024'), hairStyle: 'braid', topColor: h('e6e0d0'), embroidery: h('c03838'), bottomType: 'skirt', bottomColor: h('e6e0d0'), skirtBand: h('c03838'), shoes: h('5a4030'), hat: 'wreath', blush: true, portrait: { face: 'girl', eyes: h('4a3424'), hair: 'braid', hat: 'wreath', outfit: 'blouse', bg: h('6a7a5a'), blush: 0.8 } },
    luka: { body: 'child', skin: SKIN2, hair: h('3a2a1a'), hairStyle: 'short', hat: 'cap', hatColor: h('3a4a6a'), topColor: h('6a7a4a'), bottomColor: h('3a3a3a'), shoes: h('2a2018'), blush: true, portrait: { face: 'boy', eyes: h('4a3424'), hair: 'short', hairOpt: { fringe: -0.45 }, hat: 'peaked', outfit: 'sweater', bg: h('5a6a5a'), blush: 0.6, freckles: false } },
    baka: { body: 'old', skin: SKIN_OLD, hair: h('dcd8d0'), hairStyle: 'scarf', scarf: h('ece6d6'), scarfPattern: h('3a5a8a'), topColor: h('5a4a5a'), shawl: h('8a6a4a'), bottomType: 'skirt', bottomColor: h('3a2e34'), shoes: h('1e1818'), wrinkles: true, portrait: { face: 'old', eyes: h('5a6a7a'), hair: 'scarf', hairOpt: { tie: 'chin' }, outfit: 'dress', outfitOpt: { shawl: true }, bg: h('7a6a50'), mood: { curve: 0.025 }, age: 1, sepia: 0.15 } },
    /* crowd villagers for the fair and streets */
    vil_man1: { body: 'man', skin: SKIN2, hair: h('2a2420'), hairStyle: 'short', topColor: h('e0dacb'), vest: h('2a2a2e'), bottomColor: h('2a2a2a'), shoes: h('1a1410'), mustache: h('2a2420') },
    vil_man2: { body: 'adult', skin: SKIN, hair: h('5a4a3a'), hairStyle: 'short', hat: 'brim', hatColor: h('4a4034'), topColor: h('5a6a7a'), bottomColor: h('3a3a34'), shoes: h('2a2018') },
    vil_woman1: { body: 'woman', skin: SKIN, hair: h('3a2a22'), hairStyle: 'bun', topColor: h('e4dece'), embroidery: h('2a4a8a'), bottomType: 'skirt', bottomColor: h('2a3a5a'), shoes: h('2a2020'), apron: h('8a2a2a') },
    vil_woman2: { body: 'woman', skin: SKIN, hair: h('6a4a2a'), hairStyle: 'scarf', scarf: h('8a3a3a'), topColor: h('4a5a3a'), bottomType: 'skirt', bottomColor: h('3a3430'), shoes: h('2a2020') },
    vil_old: { body: 'old', skin: SKIN_OLD, hair: h('c8c4bc'), hairStyle: 'short', hat: 'cap', hatColor: h('2a2a2a'), topColor: h('3a3a3e'), coat: true, bottomColor: h('2a2a2e'), shoes: h('1a1a1a'), wrinkles: true, mustache: h('c8c4bc') },
    vil_boy: { body: 'child', skin: SKIN, hair: h('8a6a3a'), hairStyle: 'messy', topColor: h('3a5a7a'), bottomColor: h('3a3a3a'), shoes: h('2a2018'), blush: true },
    dancer1: { body: 'woman', skin: SKIN, hair: h('4a2e1e'), hairStyle: 'long', hat: 'wreath', topColor: h('ece6d8'), vest: h('9a2626'), embroidery: h('b83030'), bottomType: 'skirt', bottomColor: h('ece6d8'), skirtBand: h('b83030'), shoes: h('d8d0c0') },
    dancer2: { body: 'woman', skin: SKIN2, hair: h('6a4024'), hairStyle: 'braid', hat: 'wreath', topColor: h('ece6d8'), vest: h('23406e'), embroidery: h('2a4a8a'), bottomType: 'skirt', bottomColor: h('e2dccc'), skirtBand: h('2a4a8a'), shoes: h('d8d0c0') },
    jaglika_needle: { body: 'old', skin: h('e2bea6'), hair: h('b8542a'), hairStyle: 'bob', glasses: true, glassesCol: h('8ea6b2'), beads: h('2f8a86'), earring: h('2f8a86'), collar: h('5a2a78'), topColor: h('1f4a2a'), sleeve: h('1a4024'), coat: true, bottomType: 'skirt', bottomColor: h('2a2a30'), shoes: h('1c1618'), wrinkles: true, eyes: h('2a1e1a'), needle: true, portrait: false },
    jaglika_needle_late: { body: 'old', skin: h('cdb6a8'), hair: h('1c2a44'), hairStyle: 'turban', scarf: h('1c2a46'), earring: h('6a7a9a'), topColor: h('4c2c40'), sleeve: h('422636'), zip: h('b39aa0'), bottomType: 'skirt', bottomColor: h('1e1a1e'), shoes: h('141012'), wrinkles: true, eyes: h('7a8ca0'), needle: true, portrait: false }
  };

  /* identity: display-name keys, portrait id, voice pitch for murmur sfx */
  BTS.Data.people = {
    djordje: { name: 'name.djordje', age: 13, voice: 1.1 },
    zajko: { name: 'name.zajko', age: 12, voice: 1.3 },
    lisa: { name: 'name.lisa', age: 32, voice: 1.0 },
    jaglika: { name: 'name.jaglika', voice: 0.7 },
    pecko: { name: 'name.pecko', voice: 1.0 },
    gvozdin: { name: 'name.gvozdin', voice: 0.75 },
    gorazd: { name: 'name.gorazd', voice: 0.7 },
    jessica: { name: 'name.jessica', voice: 1.15 },
    milka: { name: 'name.milka', voice: 0.85 },
    sava: { name: 'name.sava', voice: 0.8 },
    dragan: { name: 'name.dragan', voice: 0.75 },
    stana: { name: 'name.stana', voice: 0.95 },
    tihomir: { name: 'name.tihomir', voice: 0.7 },
    vesna: { name: 'name.vesna', voice: 1.1 },
    radoje: { name: 'name.radoje', voice: 0.8 },
    mila: { name: 'name.mila', voice: 1.4 },
    luka: { name: 'name.luka', voice: 1.35 },
    baka: { name: 'name.baka', voice: 0.85 },
    zlatko: { name: 'name.zlatko', voice: 1.0 },
    jablan: { name: 'name.jablan', voice: 0.8 },
    gorazd_bare: { name: 'name.gorazd', voice: 0.7 },
    djordje_young: { name: 'name.djordje', age: 4, voice: 1.4 },
    djordje_child: { name: 'name.djordje', age: 4, voice: 1.4 },
    jaglika_late: { name: 'name.jaglika', voice: 0.7 },
    villager: { name: 'name.villager', voice: 0.9 }
  };
})();
