"use strict";
/* Petri Dash: a ring of petri dishes and four dice. The dice say which lab an amoeba escaped from,
   which way it went, and what it looks like. Follow it round the ring (vents shortcut it to the next
   vent, mutation dishes change it as it passes) and be the first to tap the dish it's hiding in. */
var $ = Parlor.$, rnd = Parlor.rnd, store = Parlor.store("petri-dash");

var COLORS = ["pink", "green"], PATTERNS = ["spotted", "striped"], SHAPES = ["blob", "worm"], LABS = ["cyan", "amber", "violet"];
var MUTS = ["colour", "pattern", "shape"];
var AMOEBA_FILL = ["var(--amoeba-a)", "var(--amoeba-b)"], LAB_FILL = ["var(--lab-1)", "var(--lab-2)", "var(--lab-3)"];

/* ===== The ring: 16 amoebas (every look twice), 3 labs, 3 vents, 3 mutation dishes ===== */
function makeRing(){
  for (;;){
    var cards = [];
    for (var k = 0; k < 16; k++) cards.push({ t: "amoeba", c: k & 1, p: (k >> 1) & 1, s: (k >> 2) & 1 });
    for (var j = 0; j < 3; j++){ cards.push({ t: "lab", l: j }); cards.push({ t: "vent" }); cards.push({ t: "mut", m: j }); }
    Parlor.shuffle(cards);
    // keep labs apart from each other and vents apart from each other, so every route is a real route
    var ok = cards.every(function(c, i){ var n = cards[(i + 1) % cards.length]; return !(c.t !== "amoeba" && c.t !== "mut" && n.t === c.t); });
    if (ok) return cards;
  }
}
// follow the escape: returns { answer, steps[{ i, note }] } or null if it never settles (then reroll)
function trace(ring, d){
  var want = { c: d.c, p: d.p, s: d.s }, n = ring.length, i = ring.findIndex(function(c){ return c.t === "lab" && c.l === d.l; }), steps = [];
  for (var guard = 0; guard < 200; guard++){
    i = (i + d.dir + n) % n;
    var card = ring[i];
    if (card.t === "vent"){
      var j = i;
      do { j = (j + d.dir + n) % n; } while (ring[j].t !== "vent");
      steps.push({ i: i, note: "into a vent" }); steps.push({ i: j, note: "out of the next vent" });
      i = j; continue;
    }
    if (card.t === "mut"){
      var key = ["c", "p", "s"][card.m]; want[key] = 1 - want[key];
      steps.push({ i: i, note: "mutates: now " + describe(want) }); continue;
    }
    if (card.t === "amoeba" && card.c === want.c && card.p === want.p && card.s === want.s){ steps.push({ i: i, note: "caught!" }); return { answer: i, steps: steps }; }
    steps.push({ i: i, note: "" });
  }
  return null;
}
function describe(w){ return COLORS[w.c] + " " + PATTERNS[w.p] + " " + SHAPES[w.s]; }

/* ===== Drawing (SVG in a -50..50 box) ===== */
var BLOB = "M-30,-8C-32,-30-6,-36 10,-30C30,-24 36,-4 30,12C24,30 4,34-12,30C-30,26-28,10-30,-8Z";
var WORM = "M-30,14C-22,-12-6,24 8,0S28,-16 32,-14";
function eyes(x, y, r){ return '<circle cx="' + (x - r) + '" cy="' + y + '" r="' + r + '" fill="#fff"/><circle cx="' + (x + r) + '" cy="' + y + '" r="' + r + '" fill="#fff"/>' +
  '<circle cx="' + (x - r + 1) + '" cy="' + (y + 1) + '" r="' + r * .5 + '" fill="#0d1b22"/><circle cx="' + (x + r + 1) + '" cy="' + (y + 1) + '" r="' + r * .5 + '" fill="#0d1b22"/>'; }
function amoebaSVG(c, p, s, fill){
  var pat = "url(#" + (p ? "pd-stripes" : "pd-spots") + ")", col = fill || AMOEBA_FILL[c];
  if (s === 0) return '<path d="' + BLOB + '" style="fill:' + col + '"/><path d="' + BLOB + '" fill="' + pat + '"/>' + eyes(2, -8, 6);
  return '<path d="' + WORM + '" style="fill:none;stroke:' + col + ';stroke-width:20;stroke-linecap:round"/><path d="' + WORM + '" fill="none" stroke="' + pat + '" stroke-width="20" stroke-linecap="round"/>' + eyes(30, -16, 5);
}
function labSVG(l){
  return '<path d="M-10,-34H10V-12L28,26Q30,32 24,32H-24Q-30,32-28,26L-10,-12Z" style="fill:' + LAB_FILL[l] + '"/>' +
         '<path d="M-19,12H19L24,26Q25,28 22,28H-22Q-25,28-24,26Z" fill="#fff" opacity=".35"/><rect x="-14" y="-38" width="28" height="6" rx="3" fill="#fff" opacity=".8"/>';
}
function ventSVG(){
  var h = '<circle r="31" fill="#5c7680"/><circle r="31" fill="none" stroke="#a9c3c9" stroke-width="3"/>';
  for (var y = -18; y <= 18; y += 9) h += '<rect x="-20" y="' + (y - 3) + '" width="40" height="6" rx="3" fill="#24353b"/>';
  return h;
}
function mutSVG(m){
  var h = '<circle r="32" fill="#22414a" style="stroke:var(--accent)" stroke-width="3"/>', a = '<path d="M-6,-2H6M2,-6L6,-2 2,2M6,6H-6M-2,2L-6,6-2,10" fill="none" stroke="#ffd23f" stroke-width="2.2" stroke-linecap="round" transform="translate(0,-2)"/>';
  if (m === 0) h += '<circle cx="-17" r="9" style="fill:var(--amoeba-a)"/><circle cx="17" r="9" style="fill:var(--amoeba-b)"/>';
  if (m === 1) h += '<circle cx="-17" r="10" fill="#9fb7bb"/><circle cx="-17" r="10" fill="url(#pd-spots)"/><circle cx="17" r="10" fill="#9fb7bb"/><circle cx="17" r="10" fill="url(#pd-stripes)"/>';
  if (m === 2) h += '<g transform="translate(-17,0) scale(.32)"><path d="' + BLOB + '" fill="#9fb7bb"/></g><g transform="translate(17,0) scale(.32)"><path d="' + WORM + '" fill="none" stroke="#9fb7bb" stroke-width="20" stroke-linecap="round"/></g>';
  return h + a;
}
function cardSVG(c){
  var inner = c.t === "amoeba" ? amoebaSVG(c.c, c.p, c.s) : c.t === "lab" ? labSVG(c.l) : c.t === "vent" ? ventSVG() : mutSVG(c.m);
  return '<svg viewBox="-50 -50 100 100">' + inner + '</svg>';
}
function arrowSVG(dir, col){
  // a curved arrow round the flask: clockwise (dir 1) or anticlockwise (dir -1)
  var d = dir > 0 ? "M-34,-10A36,36 0 0 1 10,-35" : "M34,-10A36,36 0 0 0 -10,-35", tip = dir > 0 ? "M10,-35L0,-42M10,-35L3,-26" : "M-10,-35L0,-42M-10,-35L-3,-26";
  return '<path d="' + d + '" fill="none" style="stroke:' + col + '" stroke-width="7" stroke-linecap="round"/><path d="' + tip + '" fill="none" style="stroke:' + col + '" stroke-width="7" stroke-linecap="round"/>';
}
function diceHTML(d){
  if (!d) return [0, 1, 2, 3].map(function(){ return '<div class="die blank"></div>'; }).join("");
  return '<div class="die"><svg viewBox="-50 -50 100 100"><g transform="translate(0,8) scale(.75)">' + labSVG(d.l) + '</g>' + arrowSVG(d.dir, "#0d1b22") + '</svg></div>' +
    '<div class="die"><svg viewBox="-50 -50 100 100"><circle r="34" style="fill:' + AMOEBA_FILL[d.c] + '"/></svg></div>' +
    '<div class="die"><svg viewBox="-50 -50 100 100"><circle r="34" fill="#55707a"/><circle r="34" fill="url(#' + (d.p ? "pd-stripes" : "pd-spots") + ')"/></svg></div>' +
    '<div class="die"><svg viewBox="-50 -50 100 100">' + (d.s ? '<path d="' + WORM + '" fill="none" stroke="#55707a" stroke-width="20" stroke-linecap="round"/>' : '<path d="' + BLOB + '" fill="#55707a"/>') + '</svg></div>';
}
// spot and stripe patterns, defined once for every SVG on the page
document.body.insertAdjacentHTML("afterbegin", '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' +
  '<pattern id="pd-spots" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="3" fill="#fff" opacity=".75"/><circle cx="11" cy="11" r="3" fill="#fff" opacity=".75"/></pattern>' +
  '<pattern id="pd-stripes" width="11" height="11" patternUnits="userSpaceOnUse" patternTransform="rotate(40)"><rect width="4.5" height="11" fill="#fff" opacity=".6"/></pattern></defs></svg>');

/* ===== State =====
   game: { ring[], dice, answer, steps[], missed[], phase, msg, tone }   (players keep score themselves)
   phase: "ready" → "race" → "hit" / "traced" → "ready" … ("miss" from older saves is treated as "race") */
var settings = Object.assign({}, store.get("settings") || {});
var game = store.get("game"), view = "settings", rolling = false, trail = [];
if (game && (game.phase === "miss" || game.phase === "over")) game.phase = game.phase === "miss" ? "race" : "ready"; // saves from the scoring version
function save(){ store.set("settings", settings); store.set("game", game); }

function newGame(){
  game = { ring: makeRing(), dice: null,
           answer: -1, steps: [], missed: [], phase: "ready", msg: "Roll the dice, then race to tap the dish the amoeba escaped to.", tone: "" };
  save(); setView("game");
}
function roll(){
  if (rolling) return;
  rolling = true; trail = []; game.missed = []; game.phase = "ready";
  $("dice").classList.add("tumble");
  var ticks = 0;
  (function spin(){
    var d = { l: rnd(3), dir: rnd(2) ? 1 : -1, c: rnd(2), p: rnd(2), s: rnd(2) };
    $("dice").innerHTML = diceHTML(d);
    if (++ticks < 8) return setTimeout(spin, 80);
    var t = trace(game.ring, d);
    if (!t || t.steps.length > 30) return setTimeout(spin, 80); // loops forever or more than a lap: roll again
    $("dice").classList.remove("tumble"); rolling = false;
    game.dice = d; game.answer = t.answer; game.steps = t.steps;
    game.phase = "race"; game.msg = "<b>Go!</b> Tap the escaped amoeba."; game.tone = "";
    Parlor.requestWake(); save(); renderGame();
  })();
}
function tap(i){
  if (game.phase !== "race") return;
  if (i === game.answer){
    game.phase = "hit"; game.tone = "good"; game.msg = "<b>Caught!</b> Whoever tapped it first takes it. Roll again!";
  } else {
    if (game.missed.indexOf(i) < 0) game.missed.push(i);
    game.tone = "bad"; game.msg = "<b>Wrong dish!</b> The race goes on.";
  }
  save(); renderGame();
}
function showRoute(){
  if (!game.dice || rolling) return;
  var steps = game.steps, n = 0;
  if (game.phase === "race") game.phase = "traced";
  trail = [];
  (function step(){
    if (n >= steps.length){
      game.msg = "It was a <b>" + describe(game.ring[game.answer]) + "</b>. Roll again!"; game.tone = "";
      if (game.phase === "traced") game.phase = "ready";
      save(); return renderGame();
    }
    var s = steps[n++]; trail.push(s.i);
    game.msg = s.note ? "<b>" + s.note.charAt(0).toUpperCase() + s.note.slice(1) + "</b>" : "Searching…";
    renderGame();
    setTimeout(step, s.note ? 650 : 260);
  })();
}

/* ===== Rendering ===== */
function renderGame(){
  var n = game.ring.length;
  $("dishes").innerHTML = game.ring.map(function(c, i){
    var a = -Math.PI / 2 + i * 2 * Math.PI / n, x = 50 + 44 * Math.cos(a), y = 50 + 43 * Math.sin(a);
    var cls = "dish" + (trail.indexOf(i) >= 0 ? " trail" : "") + (game.missed.indexOf(i) >= 0 ? " miss" : "") +
              ((game.phase === "hit" || game.phase === "ready" && trail.length) && i === game.answer ? " hit" : "");
    return '<button class="' + cls + '" data-i="' + i + '" style="left:' + x.toFixed(2) + '%;top:' + y.toFixed(2) + '%" aria-label="' + (c.t === "amoeba" ? describe(c) : c.t) + '">' + cardSVG(c) + '</button>';
  }).join("");
  if (!rolling) $("dice").innerHTML = diceHTML(game.dice);
  $("rollBtn").hidden = !(game.phase === "ready" || game.phase === "hit");
  $("rollBtn").textContent = game.dice ? "Roll again" : "Roll";
  $("msg").innerHTML = game.msg; $("msg").className = "msg " + (game.tone || "");
  $("traceBtn").hidden = !game.dice;
  $("againBtn").hidden = true;
}
function renderSetup(){
  $("savedNote").hidden = !game;
  if (game) $("savedNote").textContent = "Your lab is under the Lab tab. Opening a new lab shuffles the ring.";
}
function render(){
  $("tabs").hidden = !game;
  [].forEach.call($("tabs").children, function(b){ b.setAttribute("aria-selected", String(b.dataset.tab === view)); });
  $("homeLink").hidden = view !== "settings";
  $("setup").hidden = view !== "settings";
  $("gameView").hidden = view !== "game";
  if (view === "settings"){ $("againBtn").hidden = true; renderSetup(); }
  else renderGame();
}
function setView(v){ view = v; render(); }

/* ===== Setup illustrations ===== */
$("heroDish").innerHTML = '<svg viewBox="-50 -50 100 100"><g transform="translate(-14,-10) scale(.5)">' + amoebaSVG(0, 0, 0) + '</g><g transform="translate(14,14) scale(.5) rotate(-20)">' + amoebaSVG(1, 1, 1) + '</g></svg>';
$("rules").innerHTML = [
  [labSVG(0), "The lab die says where the amoeba escaped from and which way round the ring it went."],
  [amoebaSVG(0, 1, 0), "The other three dice say its colour, pattern and shape. Find the first dish it reaches that matches."],
  [ventSVG(), "Vents: it slips in and comes out of the next vent along, skipping the dishes between."],
  [mutSVG(0), "Mutation dishes change it as it passes: colour, pattern or shape flips to the other kind."]
].map(function(r){ return '<li><svg viewBox="-50 -50 100 100">' + r[0] + '</svg><span>' + r[1] + '</span></li>'; }).join("");

/* ===== Events ===== */
$("start").addEventListener("click", function(){
  if (game && !confirm("Open a new lab? The ring will be reshuffled.")) return;
  newGame();
});
$("againBtn").addEventListener("click", newGame);
$("tabs").addEventListener("click", function(e){ var b = e.target.closest("button"); if (b && b.dataset.tab !== view) setView(b.dataset.tab); });
$("rollBtn").addEventListener("click", roll);
$("traceBtn").addEventListener("click", showRoute);
$("dishes").addEventListener("click", function(e){ var b = e.target.closest("button"); if (b) tap(+b.dataset.i); });
document.addEventListener("visibilitychange", function(){
  if (document.visibilityState === "visible" && game && view === "game") Parlor.requestWake();
});
document.addEventListener("gesturestart", function(e){ e.preventDefault(); });

render();
Parlor.registerOffline("../");
