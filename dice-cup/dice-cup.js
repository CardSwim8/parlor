"use strict";
/* Dice Cup: pick dice, roll them. No rules and no scoring: just the dice, a total, holds and a history.
   Tap a die on the shelf to put it in the cup; tap a die in the cup to hold it (it stays put when you
   roll); press and hold (or right-click, or Delete) to take it out. */
var $ = Parlor.$, rnd = Parlor.rnd, esc = Parlor.esc, store = Parlor.store("dice-cup");

/* ===== Dice types =====
   Every die is a list of faces. A face has t (what it says), v (its number, if it adds to the total)
   and optionally g (a drawn glyph instead of text). shape picks the outline it's drawn with. */
function range(a, b){ var r = []; for (var i = a; i <= b; i++) r.push(i); return r; }
function nums(list){ return list.map(function(n){ return { v: n, t: String(n) }; }); }
var TYPES = {
  d4:   { label: "d4",   shape: "d4",   faces: nums(range(1, 4)) },
  d6:   { label: "d6",   shape: "cube", faces: nums(range(1, 6)), pips: true },
  d8:   { label: "d8",   shape: "d8",   faces: nums(range(1, 8)) },
  d10:  { label: "d10",  shape: "d10",  faces: nums(range(1, 10)) },
  d12:  { label: "d12",  shape: "d12",  faces: nums(range(1, 12)) },
  d20:  { label: "d20",  shape: "d20",  faces: nums(range(1, 20)) },
  d100: { label: "d100", shape: "ball", faces: nums(range(1, 100)) },
  coin: { label: "Coin", shape: "coin", faces: [{ t: "Heads", chip: "Heads" }, { t: "Tails", chip: "Tails" }], sample: 0 },
  d3:   { label: "d3",   shape: "d3",   faces: nums(range(1, 3)) },
  fate: { label: "Fate", shape: "cube", signed: true, sample: 0, faces: [
    { v: 1, t: "+", g: "plus" }, { v: 1, t: "+", g: "plus" }, { v: -1, t: "−", g: "minus" },
    { v: -1, t: "−", g: "minus" }, { v: 0, t: "0", g: "blank" }, { v: 0, t: "0", g: "blank" }] },
  avg:  { label: "Average", shape: "cube", faces: nums([2, 3, 3, 4, 4, 5]) },
  poker: { label: "Poker", shape: "cube", faces: ["9", "10", "J", "Q", "K", "A"].map(function(t){ return { t: t }; }) },
  crown: { label: "Crown & Anchor", shape: "cube", sample: 4, faces: [
    { t: "Spade", g: "spade", chip: "♠︎" }, { t: "Heart", g: "heart", chip: "♥︎" }, { t: "Diamond", g: "diamond", chip: "♦︎" },
    { t: "Club", g: "club", chip: "♣︎" }, { t: "Crown", g: "crown" }, { t: "Anchor", g: "anchor" }] },
  colour: { label: "Colour", shape: "cube", fixed: "ivory", sample: 0, faces: ["Red", "Orange", "Yellow", "Green", "Blue", "Purple"].map(function(t){ return { t: t, g: "swatch" }; }) },
  double: { label: "Doubling cube", shape: "cube", faces: nums([2, 4, 8, 16, 32, 64]) }
};
var STANDARD = ["d4", "d6", "d8", "d10", "d12", "d20", "d100"];
var SPECIALTY = ["coin", "d3", "fate", "avg", "poker", "crown", "colour", "double"];
var COLOURS = ["ivory", "red", "blue", "green", "gold", "purple", "black"];
var MAX_DICE = 60, MAX_HISTORY = 50, SIDE_CHIPS = [2, 5, 7, 14, 16, 24, 30, 50];

function shapeFor(n){ return { 2: "coin", 3: "d3", 4: "d4", 6: "cube", 8: "d8", 10: "d10", 12: "d12", 20: "d20" }[n] || (n >= 30 ? "ball" : "gem"); }
// A die you made: { id, label, sides } or { id, label, faces: [text, ...] }. Built into a type when used.
function buildCustom(c){
  var faces = c.sides ? nums(range(1, c.sides)) : c.faces.map(function(t){
    var n = Number(t); return /^[-+]?\d+(\.\d+)?$/.test(t) && isFinite(n) ? { v: n, t: t } : { t: t };
  });
  return { label: c.label, shape: shapeFor(faces.length), faces: faces, custom: true, sample: c.sides ? undefined : 0 };
}
var customCache = {};
function typeOf(id){
  if (TYPES[id]) return TYPES[id];
  if (!customCache[id]){
    var c = state.customs.filter(function(x){ return x.id === id; })[0];
    if (!c) return null;
    customCache[id] = buildCustom(c);
  }
  return customCache[id];
}
function isNumeric(t){ return t.faces.every(function(f){ return typeof f.v === "number"; }); }
function sampleFace(t){ return t.sample != null ? t.sample : t.faces.length - 1; }
function dieName(t){ return /^d\d+$/.test(t.label) ? t.label : t.label + (t.custom ? "" : " die"); }

/* ===== State =====
   dice: [{ id, type, c (colour), f (face index, null until rolled), h (held), tilt }] */
var state = Object.assign({
  dice: [{ type: "d6", c: "ivory", f: null, h: false }, { type: "d6", c: "ivory", f: null, h: false }],
  colour: "ivory", mod: 0, customs: [], history: [], sound: true
}, store.get("state") || {});
var nextId = 1;
state.dice = state.dice.filter(function(d){ return typeOf(d.type); });
state.dice.forEach(function(d){ d.id = nextId++; });
function save(){ store.set("state", state); }

/* ===== Drawing a die (SVG, 100×100 box) ===== */
function poly(pts){ return pts.map(function(p){ return p[0].toFixed(1) + " " + p[1].toFixed(1); }).join(" L"); }
function ring(n, r, turn){ var p = []; for (var i = 0; i < n; i++){ var a = (turn + i * 360 / n) * Math.PI / 180; p.push([50 + r * Math.cos(a), 50 + r * Math.sin(a)]); } return p; }
var SHAPES = (function(){
  var hex = [[50, 4], [90, 27], [90, 73], [50, 96], [10, 73], [10, 27]];
  var t20 = [[50, 25], [77, 71], [23, 71]];
  var dec = ring(10, 47, -90), pent = ring(5, 25, -90);
  var oct = ring(8, 46, -67.5), oct2 = ring(8, 33, -67.5);
  var d12lines = pent.map(function(p, i){ return "M" + poly([p, dec[i * 2]]); }).join("");
  var d10o = [[50, 3], [95, 44], [95, 57], [50, 97], [5, 57], [5, 44]], d10i = [[50, 3], [76, 51], [50, 71], [24, 51]];
  return {
    cube: { body: '<rect x="7" y="7" width="86" height="86" rx="17"/>', lines: "", x: 50, y: 50, fs: 46 },
    coin: { body: '<circle cx="50" cy="50" r="45"/>', lines: '<circle class="ln" cx="50" cy="50" r="37"/>', x: 50, y: 50, fs: 34 },
    ball: { body: '<circle cx="50" cy="50" r="46"/>', lines: '<circle class="ln" cx="50" cy="50" r="39" stroke-dasharray="3 9"/>', x: 50, y: 50, fs: 32 },
    d3:   { body: '<path d="M50 10 L92 84 L8 84Z" stroke-width="14" stroke-linejoin="round" style="stroke:var(--body)"/>', lines: "", x: 50, y: 62, fs: 34 },
    d4:   { body: '<path d="M50 4 L97 89 L3 89Z"/>', lines: '<path class="ln" d="M50 17 L85 81 L15 81Z"/>', x: 50, y: 62, fs: 32 },
    d8:   { body: '<path d="M' + poly(hex) + 'Z"/>', lines: '<path class="ln" d="M' + poly([hex[0], hex[2], hex[4]]) + 'Z"/>', x: 50, y: 53, fs: 30 },
    d10:  { body: '<path d="M' + poly(d10o) + 'Z"/>', lines: '<path class="ln" d="M' + poly(d10i) + 'ZM76 51 L95 57M50 71 L50 97M24 51 L5 57"/>', x: 50, y: 46, fs: 26 },
    d12:  { body: '<path d="M' + poly(dec) + 'Z"/>', lines: '<path class="ln" d="M' + poly(pent) + 'Z' + d12lines + '"/>', x: 50, y: 52, fs: 28 },
    d20:  { body: '<path d="M' + poly(hex) + 'Z"/>', lines: '<path class="ln" d="M' + poly(t20) + 'Z' +
            "M" + poly([hex[5], t20[0], hex[1]]) + "M" + poly([hex[0], t20[0]]) +
            "M" + poly([hex[1], t20[1], hex[3]]) + "M" + poly([hex[2], t20[1]]) +
            "M" + poly([hex[3], t20[2], hex[5]]) + "M" + poly([hex[4], t20[2]]) + '"/>', x: 50, y: 58, fs: 25 },
    gem:  { body: '<path d="M' + poly(oct) + 'Z"/>', lines: '<path class="ln" d="M' + poly(oct2) + 'Z"/>', x: 50, y: 50, fs: 28 }
  };
})();
var PIPS = { 1: [[50, 50]], 2: [[29, 29], [71, 71]], 3: [[29, 29], [50, 50], [71, 71]], 4: [[29, 29], [71, 29], [29, 71], [71, 71]],
  5: [[29, 29], [71, 29], [50, 50], [29, 71], [71, 71]], 6: [[29, 27], [71, 27], [29, 50], [71, 50], [29, 73], [71, 73]] };
var GLYPHS = {
  plus: '<path class="gs" style="stroke-width:12" d="M50 24V76M24 50H76"/>',
  minus: '<path class="gs" style="stroke-width:12" d="M24 50H76"/>',
  blank: '<rect class="blank" x="22" y="22" width="56" height="56" rx="10"/>',
  heart: '<path class="red" d="M50 80C22 60 15 46 21 34C27 22 44 22 50 36C56 22 73 22 79 34C85 46 78 60 50 80Z"/>',
  diamond: '<path class="red" d="M50 15L77 50L50 85L23 50Z"/>',
  spade: '<path class="g" d="M50 16C63 32 81 42 80 57C79 70 64 74 54 65L60 83H40L46 65C36 74 21 70 20 57C19 42 37 32 50 16Z"/>',
  club: '<g class="g"><circle cx="50" cy="33" r="13"/><circle cx="35" cy="55" r="13"/><circle cx="65" cy="55" r="13"/><path d="M46 52L41 83H59L54 52Z"/></g>',
  crown: '<path class="g" d="M21 68L16 31L35 47L50 22L65 47L84 31L79 68Z"/><rect class="g" x="21" y="72" width="58" height="9" rx="3"/>',
  anchor: '<g class="gs"><circle cx="50" cy="24" r="7"/><path d="M50 31V81M36 42H64M23 58C25 74 36 81 50 81C64 81 75 74 77 58M17 64L23 57L29 63M83 64L77 57L71 63"/></g>'
};
// The inside of a die's <svg>: body, shine, facet lines and the face (f = face index, or null for blank)
function dieSVG(t, f){
  var sh = SHAPES[t.shape], face = f == null ? null : t.faces[f], h = "";
  h += '<g class="b">' + sh.body + '</g>';
  if (t.shape === "d3") h += '<path d="M50 10 L92 84 L8 84Z" stroke-width="14" stroke-linejoin="round" style="fill:url(#shine);stroke:none"/>';
  else h += '<g class="s">' + sh.body + '</g>';
  h += sh.lines;
  if (!face) return h;
  if (t.pips && PIPS[face.v]) return h + PIPS[face.v].map(function(p){ return '<circle class="pip" cx="' + p[0] + '" cy="' + p[1] + '" r="8.5"/>'; }).join("");
  if (face.g === "swatch") return h + '<rect class="sw" x="22" y="22" width="56" height="56" rx="12" style="fill:var(--cd-' + face.t.toLowerCase() + ')"/>';
  if (face.g) return h + GLYPHS[face.g];
  var len = face.t.length, fs = len <= 2 ? sh.fs : sh.fs * 2.3 / len; // shrink longer words to fit
  h += '<text x="' + sh.x + '" y="' + sh.y + '" font-size="' + fs.toFixed(1) + '" text-anchor="middle" dominant-baseline="central">' + esc(face.t) + '</text>';
  if ((face.t === "6" || face.t === "9") && t.faces.length > 9 && t.shape !== "cube")
    h += '<path class="ul" d="M' + (sh.x - fs * .28).toFixed(1) + " " + (sh.y + fs * .62).toFixed(1) + "h" + (fs * .56).toFixed(1) + '"/>';
  return h;
}
function faceText(t, f){ var face = t.faces[f]; return face.chip || face.t; }
function faceLabel(t, f){ // spoken
  var face = t.faces[f];
  if (t.signed) return face.v > 0 ? "plus" : face.v < 0 ? "minus" : "blank";
  return face.t;
}

/* ===== Changing what's in the cup ===== */
var fresh = null; // id of a die just added, so it drops in
function addDie(typeId){
  if (state.dice.length >= MAX_DICE){ toast("The cup holds " + MAX_DICE + " dice at most."); return; }
  var t = typeOf(typeId), c = t.fixed || state.colour;
  var d = { id: nextId++, type: typeId, c: c, f: null, h: false, tilt: 0 };
  // keep matching dice together: after the last die of the same type and colour
  var at = -1;
  state.dice.forEach(function(x, i){ if (x.type === typeId && x.c === c) at = i; });
  if (at < 0) state.dice.push(d); else state.dice.splice(at + 1, 0, d);
  fresh = d.id; save(); render();
  buzz(8);
}
function snapshot(){ return JSON.parse(JSON.stringify(state.dice)); }
function restore(snap){ state.dice = snap; save(); render(); }
function removeDie(id){
  var i = state.dice.findIndex(function(d){ return d.id === id; }); if (i < 0) return;
  var snap = snapshot(), t = typeOf(state.dice[i].type);
  state.dice.splice(i, 1); save(); render();
  buzz(15);
  toast("Took out a " + dieName(t) + ".", function(){ restore(snap); });
}
function removeOne(typeId){ // shelf "−": the last one of that type, preferring dice that aren't held
  var pick = -1;
  state.dice.forEach(function(d, i){ if (d.type === typeId && (pick < 0 || !d.h || state.dice[pick].h)) pick = i; });
  if (pick >= 0) removeDie(state.dice[pick].id);
}
function clearAll(){
  if (!state.dice.length) return;
  var snap = snapshot();
  state.dice = []; save(); render();
  toast("Emptied the cup.", function(){ restore(snap); });
}
function toggleHold(id){
  var d = state.dice.filter(function(x){ return x.id === id; })[0]; if (!d) return;
  if (d.f == null){ toast("Roll first, then tap a die to hold it."); return; }
  d.h = !d.h; save(); render(); buzz(8);
}
function releaseAll(){ state.dice.forEach(function(d){ d.h = false; }); save(); render(); }

/* ===== Rolling ===== */
var rolling = false;
var reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
function roll(){
  var go = state.dice.filter(function(d){ return !d.h; });
  if (rolling || !go.length) return;
  go.forEach(function(d){ d.f = rnd(typeOf(d.type).faces.length); d.tilt = rnd(21) - 10; });
  logRoll(go); save();
  clatter(go.length); buzz(25);
  if (reduceMotion){ render(); return; }

  rolling = true; render();
  $("results").classList.add("rolling");
  var longest = 0;
  go.forEach(function(d){
    var el = $("tray").querySelector('[data-id="' + d.id + '"]'); if (!el) return;
    var t = typeOf(d.type), svg = el.querySelector("svg"), dur = 480 + rnd(260);
    longest = Math.max(longest, dur);
    el.style.setProperty("--dur", dur + "ms");
    el.classList.add("rolling");
    var flick = setInterval(function(){ svg.innerHTML = dieSVG(t, rnd(t.faces.length)); }, 70);
    setTimeout(function(){ clearInterval(flick); svg.innerHTML = dieSVG(t, d.f); }, dur - 90);
  });
  setTimeout(function(){ rolling = false; render(); }, longest + 20);
}

/* ===== Totals ===== */
function groups(dice){ // dice of the same type and colour, in the order they first appear
  var out = [], byKey = {};
  dice.forEach(function(d){
    var k = d.type + "|" + d.c;
    if (!byKey[k]){ byKey[k] = { type: d.type, c: d.c, t: typeOf(d.type), dice: [] }; out.push(byKey[k]); }
    byKey[k].dice.push(d);
  });
  var colours = {}; // name the colour only when a type comes in more than one
  out.forEach(function(g){ (colours[g.type] = colours[g.type] || {})[g.c] = 1; });
  out.forEach(function(g){ g.showColour = Object.keys(colours[g.type]).length > 1 && !g.t.fixed; });
  return out;
}
function groupName(g){
  var n = g.dice.length, l = g.t.label;
  return /^d\d+$/.test(l) ? (n > 1 ? n : "") + l : l + (n > 1 ? " ×" + n : "");
}
function signed(n){ return n > 0 ? "+" + n : n < 0 ? "−" + Math.abs(n) : "0"; }
function fmtNum(n, allSigned){ return allSigned ? signed(n) : String(n).replace("-", "−"); }
function totals(dice){ // { sum, count (numeric dice), allSigned }
  var sum = 0, count = 0, allSigned = true;
  dice.forEach(function(d){
    var t = typeOf(d.type); if (!isNumeric(t)) return;
    sum += t.faces[d.f].v; count++; if (!t.signed) allSigned = false;
  });
  return { sum: Math.round(sum * 1000) / 1000, count: count, allSigned: allSigned && count > 0 };
}
function summary(dice){ return groups(dice).map(groupName).join(" + "); }

/* ===== History ===== */
function logRoll(rolled){
  var all = state.dice.filter(function(d){ return d.f != null; }), tot = totals(all);
  state.history.unshift({
    at: Date.now(),
    dice: all.map(function(d){ return { type: d.type, c: d.c, f: d.f, h: d.h }; }),
    mod: state.mod, total: tot.count ? tot.sum + state.mod : null, signed: tot.allSigned,
    rerolled: rolled.length < all.length ? rolled.length : 0
  });
  state.history.length = Math.min(state.history.length, MAX_HISTORY);
}
function renderHistory(){
  var list = state.history.filter(function(e){ return e.dice.every(function(d){ return typeOf(d.type); }); });
  $("histNote").textContent = list.length ? "Tap a roll to put those dice back in the cup." : "Nothing rolled yet.";
  $("histClear").hidden = !list.length;
  $("histList").innerHTML = list.map(function(e){
    var i = state.history.indexOf(e);
    var what = summary(e.dice) + (e.mod ? " " + signed(e.mod).replace("−", "− ").replace("+", "+ ") : "");
    var faces = groups(e.dice).map(function(g){ return g.dice.map(function(d){ return faceText(g.t, d.f); }).join(" "); }).join(" · ");
    var time = new Date(e.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + (e.rerolled ? " · rerolled " + e.rerolled : "");
    return '<li><button data-h="' + i + '"><span class="what">' + esc(what) + '</span>' +
           '<span class="when">' + (e.total == null ? "" : esc(fmtNum(e.total, e.signed && !e.mod))) + '</span>' +
           '<span class="faces">' + esc(faces) + ' <span class="time">· ' + esc(time) + '</span></span></button></li>';
  }).join("");
}
function restoreHistory(i){
  var e = state.history[i]; if (!e) return;
  var snap = snapshot();
  state.dice = e.dice.filter(function(d){ return typeOf(d.type); }).map(function(d){
    return { id: nextId++, type: d.type, c: d.c, f: d.f, h: false, tilt: rnd(21) - 10 };
  });
  state.mod = e.mod || 0;
  save(); closePop(); render();
  toast("Put that roll back in the cup.", function(){ restore(snap); });
}

/* ===== Rendering ===== */
function fit(n, W, H){ // biggest die size that fits n dice in the tray without scrolling
  for (var s = 136; s > 40; s -= 2){
    var g = Math.round(s * .24), cols = Math.max(1, Math.floor((W + g) / (s + g))), rows = Math.ceil(n / cols);
    if (rows * (s + g) - g <= H) return { s: s, g: g };
  }
  return { s: 40, g: 12 };
}
function dieButton(d, size){
  var t = typeOf(d.type);
  var label = dieName(t) + (d.c !== "ivory" && !t.fixed ? ", " + d.c : "") + (d.f == null ? ", not rolled" : ", " + faceLabel(t, d.f)) + (d.h ? ", held" : "");
  return '<button class="die' + (d.h ? " held" : "") + (d.id === fresh ? " new" : "") + '" data-id="' + d.id + '" data-c="' + d.c +
         '" style="--s:' + size + 'px;--tilt:' + (d.tilt || 0) + 'deg" aria-label="' + esc(label) + '"><svg viewBox="0 0 100 100" aria-hidden="true">' +
         dieSVG(t, d.f) + '</svg></button>';
}
function renderTray(){
  var tray = $("tray"), n = state.dice.length;
  if (!n){
    tray.innerHTML = '<div class="empty"><b>The cup is empty</b><span>Tap a die on the shelf to put it in.</span></div>';
    return;
  }
  var cs = getComputedStyle(tray);
  var W = tray.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  var H = tray.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  var f = fit(n, W, H);
  var anyRolled = state.dice.some(function(d){ return d.f != null; });
  tray.innerHTML = '<div class="dice" style="--g:' + f.g + 'px">' +
    state.dice.map(function(d){ return dieButton(d, f.s); }).join("") + '</div>' +
    '<div class="hint">' + (anyRolled ? "Tap a die to hold it · press and hold to take it out" : "Press and hold a die to take it out") + '</div>';
  fresh = null;
}
function renderResults(){
  var box = $("results");
  box.classList.toggle("rolling", rolling);
  if (rolling) return;
  var rolled = state.dice.filter(function(d){ return d.f != null; }), waiting = state.dice.length - rolled.length;
  var hasNumeric = state.dice.some(function(d){ return isNumeric(typeOf(d.type)); });
  var h = "";
  if (!rolled.length){
    h = '<div class="waiting">' + (state.dice.length ? "Ready when you are: " + esc(summary(state.dice)) + "." : "Add some dice from the shelf.") + '</div>';
  } else {
    var tot = totals(rolled);
    if (tot.count){
      var grand = tot.sum + state.mod;
      h += '<div class="total"><b>' + esc(fmtNum(grand, tot.allSigned && !state.mod)) + '</b><span>' +
           (state.mod ? esc(fmtNum(tot.sum, tot.allSigned)) + " " + (state.mod > 0 ? "+" : "−") + " " + Math.abs(state.mod) : "total") + '</span></div>';
    }
    h += '<ul class="lines">' + groups(rolled).map(function(g){
      var faces = g.dice.map(function(d){
        var face = g.t.faces[d.f], dot = face.g === "swatch" ? '<span class="dot" style="background:var(--cd-' + face.t.toLowerCase() + ')"></span>' : "";
        return '<i' + (d.h ? ' class="held"' : "") + '>' + dot + esc(faceText(g.t, d.f)) + '</i>';
      }).join("");
      var extra = "";
      if (isNumeric(g.t) && g.dice.length > 1){
        var s = totals(g.dice);
        extra = '<span class="sum">= <b>' + esc(fmtNum(s.sum, s.allSigned)) + '</b></span>';
      } else if (!isNumeric(g.t) && g.dice.length > 2){ // tally the symbols
        var tally = {}, order = [];
        g.dice.forEach(function(d){ var k = faceText(g.t, d.f); if (!tally[k]){ tally[k] = 0; order.push(k); } tally[k]++; });
        if (order.length < g.dice.length) extra = '<span class="sum">' + order.map(function(k){ return esc(k) + " ×" + tally[k]; }).join(", ") + '</span>';
      }
      return '<li><span class="what">' + esc(groupName(g)) + (g.showColour ? ' <small>' + g.c + '</small>' : "") + '</span><span class="faces">' + faces + '</span>' + extra + '</li>';
    }).join("") + (waiting ? '<li><span class="sum">+ ' + waiting + " new " + (waiting > 1 ? "dice" : "die") + " not rolled yet</span></li>" : "") + '</ul>';
  }
  if (hasNumeric){
    h += '<div class="mod"><span class="label">Modifier</span><div class="stepper"><button data-mod="-1" aria-label="Modifier down">−</button><output>' +
         esc(signed(state.mod)) + '</output><button data-mod="1" aria-label="Modifier up">+</button></div></div>';
  }
  box.innerHTML = h;
}
function renderControls(){
  var free = state.dice.filter(function(d){ return !d.h; }).length, held = state.dice.length - free;
  var b = $("rollBtn");
  b.disabled = !free || rolling;
  b.textContent = !state.dice.length ? "Roll" : !free ? "All held" : held ? "Roll " + free : "Roll";
  b.setAttribute("aria-label", !free ? "Every die is held" : "Roll " + free + (free > 1 ? " dice" : " die"));
  $("releaseBtn").hidden = !held;
  $("releaseBtn").textContent = "Release " + held;
  $("clearBtn").disabled = !state.dice.length;
  $("soundBtn").setAttribute("aria-pressed", String(state.sound));
  $("soundBtn").textContent = state.sound ? "Sound on" : "Sound off";
}
function shelfItem(id){
  var t = typeOf(id), n = 0;
  state.dice.forEach(function(d){ if (d.type === id) n++; });
  var c = t.fixed || state.colour;
  return '<div class="item"><button class="add' + (n ? " has" : "") + '" data-add="' + esc(id) + '" aria-label="Add a ' + esc(dieName(t)) + (n ? " (" + n + " in the cup)" : "") + '">' +
         '<span class="die" data-c="' + c + '"><svg viewBox="0 0 100 100" aria-hidden="true">' + dieSVG(t, sampleFace(t)) + '</svg></span>' +
         '<span class="lab">' + esc(t.label) + '</span></button>' +
         (n ? '<b class="count" aria-hidden="true">' + n + '</b><button class="minus" data-minus="' + esc(id) + '" aria-label="Take out a ' + esc(dieName(t)) + '">−</button>' : "") + '</div>';
}
function renderShelf(){
  var strip = $("shelf").querySelector(".strip"), top = $("shelf").scrollTop, left = strip ? strip.scrollLeft : 0;
  $("shelf").innerHTML =
    '<h2 class="label">Colour for new dice</h2><div class="colours" role="group" aria-label="Colour for new dice">' +
      COLOURS.map(function(c){ return '<button data-colour="' + c + '" style="--sw:var(--d-' + c + ')" aria-pressed="' + (c === state.colour) + '" aria-label="' + c + '"></button>'; }).join("") + '</div>' +
    '<div class="strip"><h2 class="label">Standard</h2><div class="racks">' + STANDARD.map(shelfItem).join("") + '</div>' +
    '<h2 class="label">Specialty</h2><div class="racks">' + SPECIALTY.map(shelfItem).join("") + '</div>' +
    '<h2 class="label">Your dice</h2><div class="racks">' + state.customs.map(function(c){ return shelfItem(c.id); }).join("") +
      '<div class="item"><button class="add make" id="makeOpen"><span class="plus" aria-hidden="true">+</span><span class="lab">Make a die</span></button></div></div></div>';
  $("shelf").scrollTop = top; $("shelf").querySelector(".strip").scrollLeft = left;
}
function render(){ renderTray(); renderResults(); renderControls(); renderShelf(); }

/* ===== Make a die ===== */
var makeMode = "sides";
function setMakeMode(m){
  makeMode = m;
  [].forEach.call($("makeMode").children, function(b){ b.setAttribute("aria-pressed", String(b.dataset.m === m)); });
  $("sidesBox").hidden = m !== "sides"; $("facesBox").hidden = m !== "faces";
}
function sidesValue(){ var n = Math.round(Number($("sidesIn").value)); return isFinite(n) ? Math.max(2, Math.min(1000, n)) : 6; }
function parseFaces(){ return $("facesIn").value.split(",").map(function(s){ return s.trim().slice(0, 12); }).filter(function(s){ return s; }); }
function renderMine(){
  $("mine").hidden = !state.customs.length;
  $("mine").innerHTML = '<span class="label">On your shelf</span>' + state.customs.map(function(c){
    var desc = c.sides ? c.sides + " sides" : c.faces.join(", ");
    return '<div><span>' + esc(c.label) + ' <small>' + esc(desc) + '</small></span><button data-del="' + esc(c.id) + '">Remove</button></div>';
  }).join("");
}
function makeDie(){
  var c = { id: "c" + Date.now().toString(36) + rnd(1000), label: $("nameIn").value.trim() };
  if (makeMode === "sides"){
    c.sides = sidesValue();
    if (!c.label) c.label = "d" + c.sides;
  } else {
    var faces = parseFaces();
    if (faces.length < 2){ $("facesNote").textContent = "Give it at least two faces, separated by commas."; $("facesIn").focus(); return; }
    c.faces = faces.slice(0, 100);
    if (!c.label) c.label = faces.filter(function(f, i){ return faces.indexOf(f) === i; }).slice(0, 2).join("/") + (faces.length > 2 ? "…" : "");
  }
  state.customs.push(c);
  closePop(); addDie(c.id);
}
function deleteCustom(id){
  var c = state.customs.filter(function(x){ return x.id === id; })[0]; if (!c) return;
  var inCup = state.dice.filter(function(d){ return d.type === id; }).length;
  if (inCup && !confirm("Remove " + c.label + " from your shelf? The " + inCup + " in the cup will go too.")) return;
  state.customs = state.customs.filter(function(x){ return x !== c; });
  state.dice = state.dice.filter(function(d){ return d.type !== id; });
  delete customCache[id];
  save(); renderMine(); render();
}

/* ===== Dialogs and toast ===== */
var openPop = null, lastFocus = null;
function showPop(id){
  closePop();
  lastFocus = document.activeElement;
  openPop = $(id); openPop.hidden = false; $("scrim").hidden = false;
  var first = openPop.querySelector("input:not([hidden]), button:not(.x)");
  if (id === "histPop"){ renderHistory(); openPop.querySelector(".x").focus(); }
  else if (first) first.focus();
}
function closePop(){
  if (!openPop) return;
  openPop.hidden = true; $("scrim").hidden = true; openPop = null;
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
}
var toastTimer = null, toastUndo = null;
function toast(msg, undo){
  $("toastText").textContent = msg;
  toastUndo = undo || null; $("toastUndo").hidden = !undo;
  $("toast").hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(function(){ $("toast").hidden = true; toastUndo = null; }, undo ? 5000 : 2600);
}

/* ===== Sound and touch feedback ===== */
var audio = null, noise = null;
function unlock(){
  try {
    if (!audio){
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      audio = new AC();
      noise = audio.createBuffer(1, Math.floor(audio.sampleRate * .05), audio.sampleRate);
      var ch = noise.getChannelData(0);
      for (var i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / ch.length, 3);
    }
    if (audio.state === "suspended") audio.resume();
  } catch(e){}
}
function clatter(n){ // short filtered clicks: dice knocking together and landing
  if (!state.sound || !audio || !noise) return;
  var hits = Math.min(14, 4 + n * 2), now = audio.currentTime;
  for (var i = 0; i < hits; i++){
    var at = now + Math.pow(Math.random(), .8) * .5, src = audio.createBufferSource(), bp = audio.createBiquadFilter(), g = audio.createGain();
    src.buffer = noise; src.playbackRate.value = .7 + Math.random() * .8;
    bp.type = "bandpass"; bp.frequency.value = 1800 + Math.random() * 2600; bp.Q.value = 4;
    g.gain.value = (.35 + Math.random() * .5) * (1 - (at - now) * 1.1);
    src.connect(bp); bp.connect(g); g.connect(audio.destination); src.start(at);
  }
}
function buzz(ms){ try { if (navigator.vibrate) navigator.vibrate(ms); } catch(e){} }

/* ===== Events ===== */
document.addEventListener("pointerdown", unlock, true);

// Tray: tap holds; press-and-hold (or right-click) takes a die out.
var press = null, ignoreClickUntil = 0;
var tray = $("tray");
tray.addEventListener("pointerdown", function(e){
  var b = e.target.closest(".die"); if (!b || rolling) return;
  var id = +b.dataset.id;
  if (e.button === 2){ ignoreClickUntil = Date.now() + 400; removeDie(id); return; }
  press = { id: id, x: e.clientX, y: e.clientY, timer: setTimeout(function(){
    press = null; ignoreClickUntil = Date.now() + 600; removeDie(id);
  }, 550) };
});
function cancelPress(){ if (press){ clearTimeout(press.timer); press = null; } }
tray.addEventListener("pointermove", function(e){ if (press && Math.abs(e.clientX - press.x) + Math.abs(e.clientY - press.y) > 12) cancelPress(); });
["pointerup", "pointercancel", "pointerleave"].forEach(function(ev){ tray.addEventListener(ev, cancelPress); });
tray.addEventListener("contextmenu", function(e){ e.preventDefault(); });
tray.addEventListener("click", function(e){
  var b = e.target.closest(".die"); if (!b || rolling || Date.now() < ignoreClickUntil) return;
  toggleHold(+b.dataset.id);
});
tray.addEventListener("keydown", function(e){
  var b = e.target.closest(".die"); if (!b) return;
  if (e.key === "Delete" || e.key === "Backspace"){
    e.preventDefault();
    var next = b.nextElementSibling || b.previousElementSibling, nextId = next && next.dataset.id;
    removeDie(+b.dataset.id);
    var f = nextId && tray.querySelector('[data-id="' + nextId + '"]'); if (f) f.focus();
  }
});

$("shelf").addEventListener("click", function(e){
  var b = e.target.closest("button"); if (!b) return;
  if (b.dataset.add){ addDie(b.dataset.add); var again = $("shelf").querySelector('[data-add="' + b.dataset.add + '"]'); if (again) again.focus(); }
  else if (b.dataset.minus){ removeOne(b.dataset.minus); var add = $("shelf").querySelector('[data-add="' + b.dataset.minus + '"]'); if (add) add.focus(); }
  else if (b.dataset.colour){ state.colour = b.dataset.colour; save(); renderShelf(); $("shelf").querySelector('[data-colour="' + state.colour + '"]').focus(); }
  else if (b.id === "makeOpen"){ renderMine(); setMakeMode(makeMode); $("facesNote").textContent = "Repeat a face to make it come up more often. If every face is a number, they're added to the total."; showPop("makePop"); }
});
$("results").addEventListener("click", function(e){
  var b = e.target.closest("[data-mod]"); if (!b) return;
  state.mod = Math.max(-99, Math.min(99, state.mod + +b.dataset.mod)); save(); renderResults();
  var again = $("results").querySelector('[data-mod="' + b.dataset.mod + '"]'); if (again) again.focus();
});
$("rollBtn").addEventListener("click", roll);
$("releaseBtn").addEventListener("click", releaseAll);
$("clearBtn").addEventListener("click", clearAll);
$("soundBtn").addEventListener("click", function(){ state.sound = !state.sound; save(); renderControls(); if (state.sound){ unlock(); clatter(2); } });
$("histBtn").addEventListener("click", function(){ showPop("histPop"); });
$("histList").addEventListener("click", function(e){ var b = e.target.closest("[data-h]"); if (b) restoreHistory(+b.dataset.h); });
$("histClear").addEventListener("click", function(){ state.history = []; save(); renderHistory(); });

$("makeMode").addEventListener("click", function(e){ var b = e.target.closest("button"); if (b) setMakeMode(b.dataset.m); });
$("sideChips").innerHTML = SIDE_CHIPS.map(function(n){ return '<button data-n="' + n + '">d' + n + '</button>'; }).join("");
$("sideChips").addEventListener("click", function(e){ var b = e.target.closest("button"); if (b) $("sidesIn").value = b.dataset.n; });
$("sMinus").addEventListener("click", function(){ $("sidesIn").value = Math.max(2, sidesValue() - 1); });
$("sPlus").addEventListener("click", function(){ $("sidesIn").value = Math.min(1000, sidesValue() + 1); });
$("sidesIn").addEventListener("change", function(){ $("sidesIn").value = sidesValue(); });
$("makeBtn").addEventListener("click", makeDie);
$("mine").addEventListener("click", function(e){ var b = e.target.closest("[data-del]"); if (b) deleteCustom(b.dataset.del); });
["makePop", "histPop"].forEach(function(id){
  $(id).addEventListener("click", function(e){ if (e.target.closest("[data-close]")) closePop(); });
  $(id).addEventListener("keydown", function(e){ if (e.key === "Enter" && e.target.tagName === "INPUT" && id === "makePop") makeDie(); });
});
$("scrim").addEventListener("click", closePop);
$("toastUndo").addEventListener("click", function(){ var u = toastUndo; $("toast").hidden = true; toastUndo = null; if (u) u(); });

// Space or R rolls (unless you're typing or a dialog is open); Escape closes a dialog.
document.addEventListener("keydown", function(e){
  if (e.key === "Escape"){ closePop(); return; }
  if (openPop || e.metaKey || e.ctrlKey || e.altKey) return;
  var tag = e.target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return;
  if (e.key === "r" || e.key === "R" || (e.key === " " && tag !== "BUTTON")){ e.preventDefault(); roll(); }
});
document.addEventListener("gesturestart", function(e){ e.preventDefault(); });

// Re-fit the dice when the tray changes size (rotation, window resize)
var lastSize = "";
function refit(){ var s = tray.clientWidth + "x" + tray.clientHeight; if (s !== lastSize && !rolling){ lastSize = s; renderTray(); } }
if (window.ResizeObserver) new ResizeObserver(refit).observe(tray); else window.addEventListener("resize", refit);

render();
Parlor.registerOffline("../");
