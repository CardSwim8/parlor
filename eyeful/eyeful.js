"use strict";
/* Eyeful: a busy picture and a letter; write down everything in it starting with that letter.
   Each round's picture is built from a code (objects, sizes, positions, background), so a saved
   game only stores the code. At the end of a round the app shows every object that fits. */
var $ = Parlor.$, rnd = Parlor.rnd, fmt = Parlor.fmt, store = Parlor.store("eyeful");

var settings = Object.assign({ rounds: 8, seconds: 120 }, store.get("settings") || {});
/* game: { rounds, round, seed, letter, used[], phase, left }   (players keep score on their own paper)
   phase: "ready" (picture hidden) → "look" (timer running) → "reveal" (every match shown) → … → "over" */
var game = store.get("game"), view = "settings";
function save(){ store.set("settings", settings); store.set("game", game); }

/* ===== Scenes ===== */
var W = 1600, H = 1000;
function buildScene(seed){
  var rand = Parlor.seeded("eyeful:" + seed), pool = Parlor.shuffle(OBJECTS.slice(), rand), placed = [];
  for (var k = 0; k < pool.length && placed.length < 115; k++){
    var s = 54 + rand(70);
    for (var t = 0; t < 30; t++){
      var x = s * .6 + rand(Math.round(W - s * 1.2)), y = s * .6 + rand(Math.round(H - s * 1.2)), clear = true;
      for (var j = 0; j < placed.length && clear; j++){
        var p = placed[j], dx = p.x - x, dy = p.y - y, min = (p.s + s) * .47;
        if (dx * dx + dy * dy < min * min) clear = false;
      }
      if (clear){ placed.push({ o: pool[k], x: x, y: y, s: s, rot: rand(51) - 25 }); break; }
    }
  }
  return { items: placed, bg: { turn: rand(360), colors: Parlor.shuffle([1, 2, 3, 4, 5], rand), wedges: [12, 16, 20][rand(3)] } };
}
function fits(o, letter){ var l = letter.toLowerCase(); return o.names.some(function(n){ return n.charAt(0) === l; }); }
function letterCounts(scene){
  var c = {};
  scene.items.forEach(function(it){
    var seen = {};
    it.o.names.forEach(function(n){ var l = n.charAt(0).toUpperCase(); if (!seen[l]){ seen[l] = 1; c[l] = (c[l] || 0) + 1; } });
  });
  return c;
}
function pickLetter(scene){
  var c = letterCounts(scene);
  for (var need = 5; need >= 1; need--){
    var ok = Object.keys(c).filter(function(l){ return /[A-Z]/.test(l) && c[l] >= need && game.used.indexOf(l) < 0; });
    if (ok.length) return ok[rnd(ok.length)];
  }
  var any = Object.keys(c).filter(function(l){ return /[A-Z]/.test(l); });
  return any[rnd(any.length)];
}
function sceneSVG(scene, letter, reveal){
  var h = '<rect width="' + W + '" height="' + H + '" style="fill:var(--paper)"/>', b = scene.bg, cx = W / 2, cy = H / 2, R = 1100;
  // kaleidoscope: mirrored wedges and rings in soft jewel tones
  for (var i = 0; i < b.wedges; i++){
    var a0 = (b.turn + i * 360 / b.wedges) * Math.PI / 180, a1 = a0 + Math.PI * 2 / b.wedges;
    h += '<path d="M' + cx + ' ' + cy + 'L' + (cx + R * Math.cos(a0)).toFixed(1) + ' ' + (cy + R * Math.sin(a0)).toFixed(1) +
         'L' + (cx + R * Math.cos(a1)).toFixed(1) + ' ' + (cy + R * Math.sin(a1)).toFixed(1) + 'Z" style="fill:var(--j' + b.colors[i % 2] + ');opacity:.11"/>';
  }
  [170, 360, 560, 780].forEach(function(r, n){ h += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" style="fill:none;stroke:var(--j' + b.colors[2 + n % 3] + ');stroke-width:34;opacity:.12"/>'; });
  scene.items.forEach(function(it, k){
    var hit = reveal && fits(it.o, letter);
    if (hit) h += '<circle class="ring" cx="' + it.x + '" cy="' + it.y + '" r="' + (it.s * .64).toFixed(1) + '"/>';
    h += '<text class="o' + (hit ? " hit" : "") + '" x="' + it.x + '" y="' + it.y + '" font-size="' + it.s + '" text-anchor="middle" dominant-baseline="central" transform="rotate(' + it.rot + ' ' + it.x + ' ' + it.y + ')">' + it.o.e + '</text>';
  });
  return h;
}

/* ===== Flow ===== */
var scene = game && game.seed ? buildScene(game.seed) : null;
function newGame(){
  game = { rounds: settings.rounds, round: 1, seed: null, letter: null, used: [], phase: "ready", left: settings.seconds };
  scene = null; save(); setView("game");
}
function startRound(){
  game.seed = String(Date.now()) + rnd(1e6);
  scene = buildScene(game.seed);
  game.letter = pickLetter(scene); game.used.push(game.letter);
  game.phase = "look"; game.left = settings.seconds;
  Parlor.unlockAudio(); Parlor.requestWake();
  clock.start(game.left);
  save(); renderGame();
  var el = $("letter"); el.classList.remove("spin"); void el.offsetWidth; el.classList.add("spin");
}
function endLook(){ clock.stop(); game.phase = "reveal"; Parlor.releaseWake(); save(); renderGame(); }
function nextRound(){
  if (game.round >= game.rounds){ game.phase = "over"; save(); renderGame(); return; }
  game.round++; game.phase = "ready"; game.letter = null; scene = null; game.seed = null;
  save(); renderGame();
}
var clock = Parlor.countdown({
  onTick: function(left){
    var whole = Math.ceil(left);
    if (whole !== Math.ceil(game.left)){ game.left = left; save(); } else game.left = left;
    var c = $("clock"); c.textContent = fmt(left); c.className = left <= 10 ? "crit" : left <= 30 ? "warn" : "";
  },
  onDone: function(){ Parlor.buzzer(); endLook(); }
});
function togglePause(){
  if (game.phase !== "look") return;
  if (clock.running) clock.pause(); else { Parlor.unlockAudio(); clock.resume(); }
  renderGame();
}

/* ===== Rendering ===== */
function renderGame(){
  var ph = game.phase, over = ph === "over";
  var le = $("letter"); le.textContent = game.letter || "?"; le.classList.toggle("empty", !game.letter || ph === "ready");
  $("roundText").textContent = over ? "Game over" : "Round " + game.round + " of " + game.rounds;
  $("phaseText").textContent = {
    ready: "Paper and pens ready? The picture appears when you start.",
    look: clock.running ? "Write down everything you can find starting with " + game.letter + "." : "Paused.",
    reveal: "Time! Read your lists out and check them against the picture.",
    over: ""
  }[ph];
  $("clock").hidden = ph !== "look";
  if (ph === "look" && !clock.active){ clock.start(game.left); clock.pause(); } // back from a reload: resume by hand
  if (ph === "look") $("clock").textContent = fmt(game.left);
  $("pauseBtn").hidden = !(ph === "look" && view === "game");
  $("pauseBtn").textContent = clock.running ? "Pause" : "Resume";
  $("actionBtn").textContent = { ready: "Start round", look: "Stop early", reveal: game.round >= game.rounds ? "Finish" : "Next round", over: "Play again" }[ph];

  var cover = $("cover");
  if (ph === "ready"){ cover.hidden = false; cover.innerHTML = "Round " + game.round + "<small>The picture stays hidden until the round starts.</small>"; }
  else if (ph === "look" && !clock.running){ cover.hidden = false; cover.innerHTML = "Paused<small>Tap Resume to keep looking.</small>"; }
  else if (over){ cover.hidden = false; cover.innerHTML = "That's all " + game.rounds + " rounds!<small>Add up your scores and play again.</small>"; }
  else cover.hidden = true;
  if (scene && ph !== "ready"){ $("svg").innerHTML = sceneSVG(scene, game.letter, ph === "reveal" || over); }
  else $("svg").innerHTML = "";
  $("scene").classList.toggle("revealed", ph === "reveal");

  $("panel").hidden = ph !== "reveal";
  if (ph === "reveal"){
    var hits = scene.items.filter(function(it){ return fits(it.o, game.letter); });
    $("answerLabel").textContent = "In the picture with " + game.letter + " (" + hits.length + ")";
    $("answers").innerHTML = hits.map(function(it){
      var names = it.o.names.filter(function(n){ return fits({ names: [n] }, game.letter); });
      return '<span>' + it.o.e + " " + Parlor.esc(names.join(" / ")) + '</span>';
    }).join("");
  }
}
function renderSetup(){
  $("roundsOut").textContent = settings.rounds;
  $("timeOut").textContent = fmt(settings.seconds);
  $("savedNote").hidden = !game;
  if (game) $("savedNote").textContent = game.phase === "over" ? "The last game is under the Game tab."
    : "A game in progress (round " + game.round + " of " + game.rounds + ") is under the Game tab. Changes here apply to the next game.";
}
function render(){
  $("tabs").hidden = !game;
  [].forEach.call($("tabs").children, function(b){ b.setAttribute("aria-selected", String(b.dataset.tab === view)); });
  $("homeLink").hidden = view !== "settings";
  $("setup").hidden = view !== "settings";
  $("gameView").hidden = view !== "game";
  if (view === "settings"){ $("pauseBtn").hidden = true; renderSetup(); }
  else renderGame();
}
function setView(v){ view = v; render(); }

/* ===== Events ===== */
$("rMinus").addEventListener("click", function(){ settings.rounds = Math.max(1, settings.rounds - 1); save(); renderSetup(); });
$("rPlus").addEventListener("click", function(){ settings.rounds = Math.min(20, settings.rounds + 1); save(); renderSetup(); });
$("tMinus").addEventListener("click", function(){ settings.seconds = Math.max(30, settings.seconds - 15); save(); renderSetup(); });
$("tPlus").addEventListener("click", function(){ settings.seconds = Math.min(300, settings.seconds + 15); save(); renderSetup(); });
$("start").addEventListener("click", function(){
  if (game && game.phase !== "over" && !confirm("Start a new game? The current one will be lost.")) return;
  newGame();
});
$("tabs").addEventListener("click", function(e){
  var b = e.target.closest("button"); if (!b || b.dataset.tab === view) return;
  if (b.dataset.tab === "settings" && game.phase === "look" && clock.running) togglePause(); // don't let the clock run behind the settings
  setView(b.dataset.tab);
});
$("actionBtn").addEventListener("click", function(){
  var ph = game.phase;
  if (ph === "ready") startRound();
  else if (ph === "look") endLook();
  else if (ph === "reveal") nextRound();
  else newGame();
});
$("pauseBtn").addEventListener("click", togglePause);
$("clock").addEventListener("click", togglePause);
document.addEventListener("visibilitychange", function(){
  if (document.visibilityState === "visible" && game && game.phase === "look" && clock.running) Parlor.requestWake();
});
document.addEventListener("gesturestart", function(e){ e.preventDefault(); });

render();
Parlor.registerOffline("../");
