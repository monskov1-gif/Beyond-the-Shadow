/* Localization: separate RU/EN dictionaries with stable keys, nested authoring flattened at load,
   {param} formatting, missing/empty/extra key checks, live language switching. */
'use strict';
BTS.Locale = BTS.Locale || {};
BTS.I18N = (function () {
  var I = { lang: 'ru', dicts: {}, missing: {} };
  function flatten(obj, prefix, out) {
    for (var k in obj) {
      var key = prefix ? prefix + '.' + k : k;
      if (obj[k] && typeof obj[k] === 'object' && !Array.isArray(obj[k])) flatten(obj[k], key, out);
      else out[key] = obj[k];
    }
    return out;
  }
  I.load = function () {
    ['ru', 'en'].forEach(function (l) {
      var src = BTS.Locale[l] || {};
      var parts = BTS.Locale[l + '_parts'] || [];
      var flat = flatten(src, '', {});
      parts.forEach(function (p) { flatten(p, '', flat); });
      I.dicts[l] = flat;
    });
    I.lang = BTS.Config.get('language') || 'ru';
    BTS.Log.info('locale keys ru', Object.keys(I.dicts.ru).length, 'en', Object.keys(I.dicts.en).length);
  };
  I.set = function (lang) {
    if (!I.dicts[lang]) return;
    I.lang = lang;
    BTS.Config.set('language', lang);
    document.documentElement.lang = lang;
    BTS.Events.emit('language', lang);
  };
  I.has = function (key) { return I.dicts[I.lang] && I.dicts[I.lang][key] !== undefined; };
  I.t = function (key, params) {
    if (!key) return '';
    var d = I.dicts[I.lang] || {};
    var s = d[key];
    if (s === undefined || s === '') {
      if (!I.missing[key]) { I.missing[key] = true; BTS.Log.warn('missing loc key', I.lang, key); }
      var other = I.dicts[I.lang === 'ru' ? 'en' : 'ru'] || {};
      s = other[key] !== undefined ? other[key] : '[' + key + ']';
    }
    if (params) s = String(s).replace(/\{(\w+)\}/g, function (m, p) { return params[p] !== undefined ? (typeof params[p] === 'string' && I.has(params[p]) ? I.t(params[p]) : params[p]) : m; });
    return s;
  };
  /* validation: missing, empty and extra keys between languages + keys referenced by data */
  I.validate = function (referenced) {
    var ru = I.dicts.ru, en = I.dicts.en, rep = { missingEn: [], missingRu: [], emptyRu: [], emptyEn: [], unreferenced: [], missingRef: [] };
    Object.keys(ru).forEach(function (k) { if (en[k] === undefined) rep.missingEn.push(k); if (ru[k] === '') rep.emptyRu.push(k); });
    Object.keys(en).forEach(function (k) { if (ru[k] === undefined) rep.missingRu.push(k); if (en[k] === '') rep.emptyEn.push(k); });
    if (referenced) referenced.forEach(function (k) { if (ru[k] === undefined || en[k] === undefined) rep.missingRef.push(k); });
    return rep;
  };
  return I;
})();
BTS.t = function (k, p) { return BTS.I18N.t(k, p); };
