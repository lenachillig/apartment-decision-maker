/*
  Small formatting helpers shared by the engine (explanation texts) and the UI.
  English locale, euro amounts without cents, ISO dates shown as "1 Feb 2027".
*/
(function (AW) {
  'use strict';

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function number(v, digits) {
    if (v === null || v === undefined || !isFinite(v)) return '–';
    const d = digits === undefined ? (Number.isInteger(v) ? 0 : 1) : digits;
    return v.toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  function euro(v) { return v === null || v === undefined ? '–' : number(v, 0) + ' €'; }

  function date(iso) {
    if (!iso) return '–';
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return iso;
    return Number(m[3]) + ' ' + MONTHS[Number(m[2]) - 1] + ' ' + m[1];
  }

  // Whole days between two ISO dates (b - a).
  function daysBetween(a, b) {
    const t = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
    return Math.round((t(b) - t(a)) / 86400000);
  }

  function plural(n, word, pluralWord) { return number(n) + ' ' + (n === 1 ? word : (pluralWord || word + 's')); }

  function percent(v, digits) { return number(v * 100, digits === undefined ? 2 : digits) + ' %'; }

  // Shows an AHP ratio as a readable fraction: 3, 1/3, 1.
  function ratio(v) {
    if (v >= 1) return number(Math.round(v * 100) / 100, Number.isInteger(Math.round(v * 100) / 100) ? 0 : 2);
    const inv = 1 / v;
    const r = Math.round(inv);
    return Math.abs(inv - r) < 1e-9 ? '1/' + r : number(v, 2);
  }

  function withUnit(v, unit) {
    if (v === null || v === undefined) return '–';
    if (unit === '€') return euro(v);
    if (unit === 'm²') return number(v, 1) + ' m²';
    return number(v) + ' ' + unit;
  }

  AW.fmt = { number, euro, date, daysBetween, plural, percent, ratio, withUnit };
})(window.AW = window.AW || {});
