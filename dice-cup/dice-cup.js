"use strict";
/* Dice Cup: pick dice, roll them. No rules and no scoring, just the dice.
   Two tabs: Roll (the tray: tap a die to hold it, then roll the rest) and Dice (choose what's in the
   cup, in which colour, and make your own dice). */
var $ = Parlor.$, rnd = Parlor.rnd, esc = Parlor.esc, store = Parlor.store("dice-cup");

/* ===== Dice types =====
   Every die is a list of faces. A face has t (what it says), optionally v (its number, for pips) and
   g (a drawn glyph instead of text). shape picks the outline it's drawn with; desc explains the
   less familiar ones on the Dice tab. */
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
  coin: { label: "Coin", shape: "coin", sample: 0, faces: [{ t: "Heads" }, { t: "Tails" }],
          desc: "Heads or tails." },
  d3:   { label: "d3",   shape: "d3",   faces: nums(range(1, 3)),
          desc: "Numbered 1 to 3, for a one-in-three chance." },
  fate: { label: "Fate", shape: "cube", signed: true, sample: 0, faces: [
    { t: "+", g: "plus" }, { t: "+", g: "plus" }, { t: "−", g: "minus" }, { t: "−", g: "minus" }, { t: "blank", g: "blank" }, { t: "blank", g: "blank" }],
          desc: "Also called Fudge dice. Two plus, two minus and two blank faces. Fate and Fudge role-playing games roll four and add them up, giving −4 to +4." },
  avg:  { label: "Average", shape: "cube", faces: nums([2, 3, 3, 4, 4, 5]),
          desc: "Faces 2, 3, 3, 4, 4, 5: a d6 without the 1 and 6, so rolls stay near the middle. Common in war games." },
  poker: { label: "Poker", shape: "cube", faces: ["9", "10", "J", "Q", "K", "A"].map(function(t){ return { t: t }; }),
          desc: "Faces 9, 10, J, Q, K and A. Roll five and read them as a poker hand." },
  crown: { label: "Crown & Anchor", shape: "cube", sample: 4, faces: [
    { t: "Spade", g: "spade" }, { t: "Heart", g: "heart" }, { t: "Diamond", g: "diamond" },
    { t: "Club", g: "club" }, { t: "Crown", g: "crown" }, { t: "Anchor", g: "anchor" }],
          desc: "Spade, heart, diamond, club, crown and anchor, from an old sailors' betting game. Usually rolled three at a time." },
  colour: { label: "Colour", shape: "cube", fixed: "ivory", sample: 0, faces: ["Red", "Orange", "Yellow", "Green", "Blue", "Purple"].map(function(t){ return { t: t, g: "swatch" }; }),
          desc: "Six colours instead of numbers. Handy for picking a colour, a player or a category at random." }
};
var STANDARD = ["d4", "d6", "d8", "d10", "d12", "d20", "d100"];
var SPECIALTY = ["coin", "d3", "fate", "avg", "poker", "crown", "colour"];
var COLOURS = ["ivory", "red", "blue", "green", "gold", "purple", "black"];
var MAX_DICE = 60, SIDE_CHIPS = [2, 5, 7, 14, 16, 24, 30, 50];

function shapeFor(n){ return { 2: "coin", 3: "d3", 4: "d4", 6: "cube", 8: "d8", 10: "d10", 12: "d12", 20: "d20" }[n] || (n >= 30 ? "ball" : "gem"); }
// A die you made: { id, label, sides } or { id, label, faces: [text, ...] }. Built into a type when used.
function buildCustom(c){
  var faces = c.sides ? nums(range(1, c.sides)) : c.faces.map(function(t){ return { t: t }; });
  return { label: c.label, shape: shapeFor(faces.length), faces: faces, custom: true, sample: c.sides ? undefined : 0,
           desc: c.sides ? "Numbered 1 to " + c.sides + "." : "Faces: " + c.faces.join(", ") + "." };
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
function sampleFace(t){ return t.sample != null ? t.sample : t.faces.length - 1; }
function dieName(t){ return /^d\d+$/.test(t.label) ? t.label : t.label + (t.custom ? "" : " die"); }

/* ===== State =====
   dice: [{ id, type, c (colour), f (face index, null until rolled), h (held), tilt }]
   view: "roll" or "dice" (the tab showing) */
var state = Object.assign({
  dice: [{ type: "d6", c: "ivory", f: null, h: false }, { type: "d6", c: "ivory", f: null, h: false }],
  colour: "ivory", customs: [], sound: true, view: "roll"
}, store.get("state") || {});
delete state.history; delete state.mod; // kept by an earlier version
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
function faceLabel(t, f){ // spoken
  var face = t.faces[f];
  return t.signed ? face.g : face.t;
}

/* ===== Changing what's in the cup ===== */
var fresh = []; // dice added since the tray was last shown, so they drop in
function count(typeId){ return state.dice.filter(function(d){ return d.type === typeId; }).length; }
function addDie(typeId){
  if (state.dice.length >= MAX_DICE){ toast("The cup holds " + MAX_DICE + " dice at most."); return; }
  var t = typeOf(typeId), c = t.fixed || state.colour;
  var d = { id: nextId++, type: typeId, c: c, f: null, h: false, tilt: 0 };
  // keep matching dice together: after the last die of the same type and colour
  var at = -1;
  state.dice.forEach(function(x, i){ if (x.type === typeId && x.c === c) at = i; });
  if (at < 0) state.dice.push(d); else state.dice.splice(at + 1, 0, d);
  fresh.push(d.id); save(); render();
  buzz(8);
}
function removeOne(typeId){ // the last one of that type, preferring dice that aren't held
  var pick = -1;
  state.dice.forEach(function(d, i){ if (d.type === typeId && (pick < 0 || !d.h || state.dice[pick].h)) pick = i; });
  if (pick < 0) return;
  state.dice.splice(pick, 1); save(); render();
}
function clearAll(){
  if (!state.dice.length) return;
  var snap = JSON.parse(JSON.stringify(state.dice));
  state.dice = []; save(); render();
  toast("Emptied the cup.", function(){ state.dice = snap; save(); render(); });
}
function toggleHold(id){
  var d = state.dice.filter(function(x){ return x.id === id; })[0]; if (!d) return;
  if (d.f == null){ toast("Roll first, then tap a die to hold it."); return; }
  d.h = !d.h; save(); render(); buzz(8);
}
function releaseAll(){ state.dice.forEach(function(d){ d.h = false; }); save(); render(); }
// what's in the cup, e.g. "2d6 + d20 + Coin ×2"
function summary(){
  var order = [], n = {};
  state.dice.forEach(function(d){ if (!n[d.type]){ n[d.type] = 0; order.push(d.type); } n[d.type]++; });
  return order.map(function(id){
    var l = typeOf(id).label;
    return /^d\d+$/.test(l) ? (n[id] > 1 ? n[id] : "") + l : l + (n[id] > 1 ? " ×" + n[id] : "");
  }).join(" + ");
}

/* ===== Rolling ===== */
var rolling = false;
var reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
function roll(){
  var go = state.dice.filter(function(d){ return !d.h; });
  if (rolling || !go.length || state.view !== "roll") return;
  go.forEach(function(d){ d.f = rnd(typeOf(d.type).faces.length); d.tilt = rnd(21) - 10; });
  save(); clatter(go.length); buzz(25);
  if (reduceMotion){ render(); announce(); return; }

  rolling = true; render();
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
  setTimeout(function(){ rolling = false; render(); announce(); }, longest + 20);
}
function announce(){ // for screen readers: what came up
  $("said").textContent = "Rolled. " + state.dice.map(function(d){
    var t = typeOf(d.type); return dieName(t) + " " + (d.f == null ? "not rolled" : faceLabel(t, d.f)) + (d.h ? " (held)" : "");
  }).join(", ") + ".";
}

/* ===== Rendering ===== */
function fit(n, W, H){ // biggest die size that fits n dice in the tray without scrolling
  for (var s = 150; s > 40; s -= 2){
    var g = Math.round(s * .24), cols = Math.max(1, Math.floor((W + g) / (s + g))), rows = Math.ceil(n / cols);
    if (rows * (s + g) - g <= H) return { s: s, g: g };
  }
  return { s: 40, g: 12 };
}
function dieButton(d, size){
  var t = typeOf(d.type);
  var label = dieName(t) + (d.c !== "ivory" && !t.fixed ? ", " + d.c : "") + (d.f == null ? ", not rolled" : ", " + faceLabel(t, d.f)) + (d.h ? ", held" : "");
  return '<button class="die' + (d.h ? " held" : "") + (fresh.indexOf(d.id) >= 0 ? " new" : "") + '" data-id="' + d.id + '" data-c="' + d.c +
         '" style="--s:' + size + 'px;--tilt:' + (d.tilt || 0) + 'deg" aria-label="' + esc(label) + '"><svg viewBox="0 0 100 100" aria-hidden="true">' +
         dieSVG(t, d.f) + '</svg></button>';
}
function renderTray(){
  var tray = $("tray"), n = state.dice.length;
  if (!n){
    tray.innerHTML = '<div class="empty"><b>The cup is empty</b><button class="ghost strong" data-goto="dice">Choose dice</button></div>';
    return;
  }
  var cs = getComputedStyle(tray);
  var W = tray.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  var H = tray.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  var f = fit(n, W, H);
  var anyRolled = state.dice.some(function(d){ return d.f != null; });
  tray.innerHTML = '<div class="dice" style="--g:' + f.g + 'px">' + state.dice.map(function(d){ return dieButton(d, f.s); }).join("") + '</div>' +
    (anyRolled ? '<div class="hint">Tap a die to hold it for the next roll</div>' : "");
  fresh = [];
}
function renderControls(){
  var free = state.dice.filter(function(d){ return !d.h; }).length, held = state.dice.length - free;
  var b = $("rollBtn");
  b.disabled = !free || rolling;
  b.textContent = !state.dice.length ? "Roll" : !free ? "All held" : held ? "Roll " + free : "Roll";
  b.setAttribute("aria-label", !free ? "Every die is held" : "Roll " + free + (free > 1 ? " dice" : " die"));
  $("releaseBtn").hidden = !held;
  $("releaseBtn").textContent = "Release " + held;
  $("soundBtn").setAttribute("aria-pressed", String(state.sound));
}
function card(id, wide){
  var t = typeOf(id), n = count(id), name = dieName(t);
  return '<div class="card ' + (wide ? "wide" : "small") + (n ? " has" : "") + '">' +
    '<button class="pick" data-add="' + esc(id) + '" aria-label="Add a ' + esc(name) + '"><span class="die" data-c="' + (t.fixed || state.colour) + '">' +
      '<svg viewBox="0 0 100 100" aria-hidden="true">' + dieSVG(t, sampleFace(t)) + '</svg></span></button>' +
    '<div class="info"><b>' + esc(t.label) + '</b>' + (wide && t.desc ? '<p>' + esc(t.desc) + '</p>' : "") +
      (t.custom ? '<button class="del" data-del="' + esc(id) + '">Remove from shelf</button>' : "") + '</div>' +
    '<div class="count"><button data-minus="' + esc(id) + '" aria-label="One fewer ' + esc(name) + '"' + (n ? "" : " disabled") + '>−</button>' +
      '<output>' + n + '</output><button data-add="' + esc(id) + '" aria-label="One more ' + esc(name) + ', ' + n + ' in the cup">+</button></div></div>';
}
function renderShelf(){
  $("cupSummary").textContent = state.dice.length ? summary() : "Nothing yet. Tap a die below to add it.";
  $("clearBtn").disabled = !state.dice.length;
  $("colours").innerHTML = COLOURS.map(function(c){
    return '<button data-colour="' + c + '" style="--sw:var(--d-' + c + ')" aria-pressed="' + (c === state.colour) + '" aria-label="' + c + '" title="' + c + '"></button>';
  }).join("");
  $("standard").innerHTML = STANDARD.map(function(id){ return card(id, false); }).join("");
  $("specialty").innerHTML = SPECIALTY.map(function(id){ return card(id, true); }).join("");
  $("custom").innerHTML = state.customs.map(function(c){ return card(c.id, true); }).join("") +
    '<button class="card make" id="makeOpen"><span class="plus" aria-hidden="true">+</span><span><b>Make a die</b><p>Any number of sides, or faces you write yourself.</p></span></button>';
}
function render(){
  var v = state.view;
  [].forEach.call($("tabs").children, function(b){ b.setAttribute("aria-selected", String(b.dataset.tab === v)); });
  $("rollView").hidden = v !== "roll"; $("diceView").hidden = v !== "dice";
  renderControls();
  if (v === "roll") renderTray(); else renderShelf();
}
function setView(v){ if (rolling) return; state.view = v; save(); render(); }

/* ===== Make a die ===== */
var makeMode = "sides";
function setMakeMode(m){
  makeMode = m;
  [].forEach.call($("makeMode").children, function(b){ b.setAttribute("aria-pressed", String(b.dataset.m === m)); });
  $("sidesBox").hidden = m !== "sides"; $("facesBox").hidden = m !== "faces";
}
function sidesValue(){ var n = Math.round(Number($("sidesIn").value)); return isFinite(n) ? Math.max(2, Math.min(1000, n)) : 6; }
function parseFaces(){ return $("facesIn").value.split(",").map(function(s){ return s.trim().slice(0, 12); }).filter(function(s){ return s; }); }
var FACES_NOTE = "Repeat a face to make it come up more often.";
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
  var inCup = count(id);
  if (inCup && !confirm("Remove " + c.label + " from your shelf? The " + inCup + " in the cup will go too.")) return;
  state.customs = state.customs.filter(function(x){ return x !== c; });
  state.dice = state.dice.filter(function(d){ return d.type !== id; });
  delete customCache[id];
  save(); render();
}

/* ===== Dialog and toast ===== */
var openPop = null, lastFocus = null;
function showPop(id){
  lastFocus = document.activeElement;
  openPop = $(id); openPop.hidden = false; $("scrim").hidden = false;
  var first = openPop.querySelector("button:not(.x)"); if (first) first.focus();
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
document.addEventListener("click", function(e){ var b = e.target.closest("[data-goto]"); if (b) setView(b.dataset.goto); });
$("tabs").addEventListener("click", function(e){ var b = e.target.closest("button"); if (b && b.dataset.tab !== state.view) setView(b.dataset.tab); });

var tray = $("tray");
tray.addEventListener("click", function(e){ var b = e.target.closest(".die"); if (b && !rolling) toggleHold(+b.dataset.id); });
$("rollBtn").addEventListener("click", roll);
$("releaseBtn").addEventListener("click", releaseAll);
$("soundBtn").addEventListener("click", function(){ state.sound = !state.sound; save(); renderControls(); if (state.sound){ unlock(); clatter(2); } });

$("diceView").addEventListener("click", function(e){
  var b = e.target.closest("button"); if (!b) return;
  var inCount = !!b.closest(".count"), refocus = null;
  if (b.dataset.add){ addDie(b.dataset.add); refocus = (inCount ? ".count " : ".pick") + '[data-add="' + b.dataset.add + '"]'; }
  else if (b.dataset.minus){
    removeOne(b.dataset.minus);
    refocus = count(b.dataset.minus) ? '.count [data-minus="' + b.dataset.minus + '"]' : '.count [data-add="' + b.dataset.minus + '"]';
  }
  else if (b.dataset.colour){ state.colour = b.dataset.colour; save(); renderShelf(); refocus = '[data-colour="' + state.colour + '"]'; }
  else if (b.dataset.del) deleteCustom(b.dataset.del);
  else if (b.id === "clearBtn") clearAll();
  else if (b.id === "makeOpen"){ setMakeMode(makeMode); $("facesNote").textContent = FACES_NOTE; showPop("makePop"); }
  var f = refocus && $("diceView").querySelector(refocus); if (f) f.focus();
});

$("makeMode").addEventListener("click", function(e){ var b = e.target.closest("button"); if (b) setMakeMode(b.dataset.m); });
$("sideChips").innerHTML = SIDE_CHIPS.map(function(n){ return '<button data-n="' + n + '">d' + n + '</button>'; }).join("");
$("sideChips").addEventListener("click", function(e){ var b = e.target.closest("button"); if (b) $("sidesIn").value = b.dataset.n; });
$("sMinus").addEventListener("click", function(){ $("sidesIn").value = Math.max(2, sidesValue() - 1); });
$("sPlus").addEventListener("click", function(){ $("sidesIn").value = Math.min(1000, sidesValue() + 1); });
$("sidesIn").addEventListener("change", function(){ $("sidesIn").value = sidesValue(); });
$("makeBtn").addEventListener("click", makeDie);
$("makePop").addEventListener("click", function(e){ if (e.target.closest("[data-close]")) closePop(); });
$("makePop").addEventListener("keydown", function(e){ if (e.key === "Enter" && e.target.tagName === "INPUT") makeDie(); });
$("scrim").addEventListener("click", closePop);
$("toastUndo").addEventListener("click", function(){ var u = toastUndo; $("toast").hidden = true; toastUndo = null; if (u) u(); });

// Space or R rolls on the Roll tab (unless you're typing or the dialog is open); Escape closes the dialog.
document.addEventListener("keydown", function(e){
  if (e.key === "Escape"){ closePop(); return; }
  if (openPop || e.metaKey || e.ctrlKey || e.altKey) return;
  var tag = e.target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return;
  if (e.key === "r" || e.key === "R" || (e.key === " " && tag !== "BUTTON")){ e.preventDefault(); roll(); }
});
document.addEventListener("gesturestart", function(e){ e.preventDefault(); });

// Re-fit the dice when the tray changes size (rotation, window resize, switching tabs)
var lastSize = "";
function refit(){ var s = tray.clientWidth + "x" + tray.clientHeight; if (s !== lastSize && !rolling && state.view === "roll"){ lastSize = s; renderTray(); } }
if (window.ResizeObserver) new ResizeObserver(refit).observe(tray); else window.addEventListener("resize", refit);

render();
Parlor.registerOffline("../");
