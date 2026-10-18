"use strict";
/* Triad: 81 cards, each with a count, shape, shading and colour (three options each). Three cards
   form a triad when every one of those four is all the same or all different across the three.
   Turn-based: each player gets a short clock to find one; then the next player's clock starts
   straight away. The clock only stops when someone pauses or the game ends. */
var $ = Parlor.$, fmt = Parlor.fmt, store = Parlor.store("triad");

var GRACE_MS = 800; // time's up with one or two cards picked: this long to finish the triad
var COLOR = ["var(--c1)", "var(--c2)", "var(--c3)"];

/* ===== Cards: id 0–80, one base-3 digit per feature ===== */
function feat(id, k){ return Math.floor(id / Math.pow(3, k)) % 3; } // k: 0 count, 1 shape, 2 shading, 3 colour
function isTriad(a, b, c){
  for (var k = 0; k < 4; k++) if ((feat(a, k) + feat(b, k) + feat(c, k)) % 3) return false;
  return true;
}
function findTriad(cards){
  for (var i = 0; i < cards.length; i++) for (var j = i + 1; j < cards.length; j++) for (var k = j + 1; k < cards.length; k++)
    if (isTriad(cards[i], cards[j], cards[k])) return [i, j, k];
  return null;
}
function cardSVG(id){
  var n = feat(id, 0) + 1, shape = feat(id, 1), shade = feat(id, 2), col = feat(id, 3), xs = [[75], [56, 94], [37, 75, 113]][n - 1];
  var fill = shade === 0 ? COLOR[col] : shade === 1 ? "url(#tr-st" + col + ")" : "none";
  var st = 'style="fill:' + fill + ';stroke:' + COLOR[col] + ';stroke-width:3.2;stroke-linejoin:round"';
  return '<svg viewBox="0 0 150 100" aria-hidden="true">' + xs.map(function(x){
    if (shape === 0) return '<circle cx="' + x + '" cy="50" r="16" ' + st + '/>';
    if (shape === 1) return '<polygon points="' + x + ',31 ' + (x + 18) + ',66 ' + (x - 18) + ',66" ' + st + '/>';
    return '<rect x="' + (x - 15) + '" y="35" width="30" height="30" ' + st + '/>';
  }).join("") + '</svg>';
}
function cardLabel(id){
  var n = feat(id, 0) + 1;
  return n + " " + ["coral", "teal", "gold"][feat(id, 3)] + " " + ["solid", "striped", "outlined"][feat(id, 2)] + " " + ["circle", "triangle", "square"][feat(id, 1)] + (n > 1 ? "s" : "");
}
// stripe fills, one per colour, defined once for every card on the page
document.body.insertAdjacentHTML("afterbegin", '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' +
  [0, 1, 2].map(function(k){ return '<pattern id="tr-st' + k + '" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="2.2" style="fill:' + COLOR[k] + '"/></pattern>'; }).join("") +
  '</defs></svg>');

/* ===== State =====
   game: { players[], scores[], deck[], board[], turn, phase: "play" | "over" }
   Not saved: the clock. After a reload the game comes back paused, and Resume starts a fresh turn. */
var settings = Object.assign({ players: ["", ""], seconds: 30 }, store.get("settings") || {});
var game = store.get("game"), view = "settings", selected = [], grace = false, busy = false, fresh = [];
if (game && game.phase !== "over") game.phase = "play"; // older saves had a "ready" step between turns
function save(){ store.set("settings", settings); store.set("game", game); }
function playing(){ return game && game.phase === "play"; }
function paused(){ return playing() && !clock.running && !grace && !busy; }

// make sure the table holds a triad: deal three more while it doesn't; no triad and no deck ends the game
function ensureTriad(){
  while (!findTriad(game.board) && game.deck.length){ var more = game.deck.splice(0, 3); fresh = fresh.concat(more); game.board = game.board.concat(more); }
  return !!findTriad(game.board);
}
function newGame(){
  var players = Parlor.playerNames(settings.players), deck = Parlor.shuffle(Array.from({ length: 81 }, function(_, i){ return i; }));
  game = { players: players, scores: players.map(function(){ return 0; }), deck: deck, board: deck.splice(0, 12), turn: 0, phase: "play" };
  fresh = game.board.slice();
  if (!ensureTriad()) game.phase = "over";
  selected = []; save(); setView("game");
  if (playing()){ startTurn(); flash("Go!", game.players[0] + (game.players.length > 1 ? " first" : ""), "var(--c3)"); }
}
function startTurn(){
  selected = []; grace = false;
  Parlor.unlockAudio(); Parlor.requestWake();
  clock.start(settings.seconds);
  renderGame();
}
var clock = Parlor.countdown({
  onTick: function(left){ var c = $("clock"); c.textContent = fmt(left); c.className = left <= 5 ? "crit" : left <= 10 ? "warn" : ""; },
  onDone: function(){
    if (busy) return;
    if (selected.length){ // mid-pick: a moment to finish
      grace = true; renderGame();
      setTimeout(function(){ if (grace){ grace = false; nextTurn(false); } }, GRACE_MS);
    } else nextTurn(false);
  }
});
// hand over to the next player and start their clock at once
function nextTurn(found){
  if (!found) Parlor.buzzer();
  if (game.phase === "over"){ clock.stop(); Parlor.releaseWake(); save(); renderGame(); return flash("Last triad!", "Game over", "var(--good)"); }
  game.turn = (game.turn + 1) % game.players.length;
  save();
  startTurn();
  flash(found ? "Found it!" : "Time's up", game.players.length > 1 ? game.players[game.turn] + "'s turn" : "Go again", found ? "var(--good)" : "var(--accent)");
}
function flash(small, big, color){
  var f = document.createElement("div");
  f.className = "flash"; f.style.setProperty("--fc", color);
  f.innerHTML = "<div><small>" + Parlor.esc(small) + "</small>" + Parlor.esc(big) + "</div>";
  document.body.appendChild(f);
  setTimeout(function(){ f.remove(); }, 1000);
}
function chime(){ Parlor.beep(880, 0, .12); Parlor.beep(1320, .12, .22); }

function pick(i){
  if (!playing() || busy || !(clock.running || grace)) return;
  var at = selected.indexOf(i);
  if (at >= 0) selected.splice(at, 1); else selected.push(i);
  if (selected.length < 3) return renderGame();
  var cards = selected.map(function(s){ return game.board[s]; });
  if (isTriad(cards[0], cards[1], cards[2])){
    busy = true; grace = false; clock.stop(); chime();
    game.scores[game.turn]++;
    renderGame("good");
    setTimeout(function(){
      var spots = selected.slice().sort(function(a, b){ return b - a; });
      if (game.board.length > 12 || !game.deck.length) spots.forEach(function(s){ game.board.splice(s, 1); }); // back down to 12
      else spots.forEach(function(s){ var c = game.deck.shift(); game.board[s] = c; fresh.push(c); });
      if (!ensureTriad()) game.phase = "over";
      busy = false;
      nextTurn(true);
    }, 350);
  } else {
    busy = true; renderGame("bad");
    setTimeout(function(){
      busy = false; selected = [];
      if (grace){ grace = false; return nextTurn(false); } // time had already run out
      renderGame();
    }, 350);
  }
}
function togglePause(){
  if (!playing() || busy || grace) return;
  if (clock.running) clock.pause();
  else if (clock.active){ Parlor.unlockAudio(); clock.resume(); }
  else startTurn(); // back from a reload: a fresh turn for whoever was up
  renderGame();
}

/* ===== Rendering ===== */
var wide = window.matchMedia("(min-aspect-ratio:1/1) and (min-width:700px)");
function renderGame(mark){
  var n = game.board.length, root = document.documentElement.style, over = game.phase === "over";
  root.setProperty("--cols", wide.matches ? Math.ceil(n / 3) : 3);
  root.setProperty("--rows", wide.matches ? 3 : Math.ceil(n / 3));
  $("grid").innerHTML = game.board.map(function(id, i){
    var cls = "card" + (selected.indexOf(i) >= 0 ? " sel" + (mark ? " " + mark : "") : "") + (fresh.indexOf(id) >= 0 ? " new" : "");
    return '<button class="' + cls + '" data-i="' + i + '" aria-label="' + cardLabel(id) + '">' + cardSVG(id) + '</button>';
  }).join("");
  fresh = [];
  $("table").classList.toggle("grace", grace);
  var cover = $("cover"), stopped = paused();
  cover.hidden = !(over || stopped);
  if (over){
    var best = Math.max.apply(null, game.scores), win = game.players.filter(function(_, i){ return game.scores[i] === best; });
    cover.innerHTML = '<div class="who">Game over</div><p>' + (game.players.length > 1 ? Parlor.esc(win.join(" & ")) + (win.length > 1 ? " tie" : " wins") + "!" : best + " triads found.") + '</p>' +
                      (game.players.length > 1 ? '<div class="award">' + Parlor.awardHTML(game.players, game.scores, { disabled: true }) + '</div>' : "") +
                      '<button class="primary" id="coverBtn">Deal again</button>';
  } else if (stopped){
    cover.innerHTML = '<div class="who">Paused</div><p>' + Parlor.esc(game.players[game.turn]) + "'s turn" + (clock.active ? "" : " starts again from the top") + '</p>' +
                      '<button class="primary" id="coverBtn">Resume</button>';
  }
  $("turnBar").hidden = view !== "game" || over;
  $("turnName").textContent = game.players[game.turn];
  if (!clock.active){ $("clock").textContent = fmt(settings.seconds); $("clock").className = ""; }
  if (grace){ $("clock").textContent = "0:00"; $("clock").className = "crit"; }
  $("pauseBtn").hidden = !(view === "game" && playing());
  $("pauseBtn").textContent = stopped ? "Resume" : "Pause";
  $("againBtn").hidden = !(view === "game" && over);
}
function renderSetup(){
  names.render();
  $("timeOut").textContent = fmt(settings.seconds);
  $("savedNote").hidden = !game;
  if (game) $("savedNote").textContent = game.phase === "over" ? "The last game's scores are under the Table tab."
    : "A game in progress is under the Table tab. Changes to players apply to the next game.";
}
function render(){
  $("tabs").hidden = !game;
  [].forEach.call($("tabs").children, function(b){ b.setAttribute("aria-selected", String(b.dataset.tab === view)); });
  $("homeLink").hidden = view !== "settings";
  $("setup").hidden = view !== "settings";
  $("gameView").hidden = view !== "game";
  if (view === "settings"){ $("againBtn").hidden = $("pauseBtn").hidden = $("turnBar").hidden = true; renderSetup(); }
  else renderGame();
}
function setView(v){ view = v; render(); }

/* ===== Events ===== */
var names = Parlor.nameList({ box: $("names"), add: $("addPlayer"), list: function(){ return settings.players; }, min: 1, max: 8, onChange: save });
$("minus").addEventListener("click", function(){ settings.seconds = Math.max(5, settings.seconds - 5); save(); renderSetup(); });
$("plus").addEventListener("click", function(){ settings.seconds = Math.min(180, settings.seconds + 5); save(); renderSetup(); });
$("start").addEventListener("click", function(){
  if (playing() && !confirm("Deal a new game? The current one will be lost.")) return;
  newGame();
});
$("againBtn").addEventListener("click", newGame);
$("tabs").addEventListener("click", function(e){
  var b = e.target.closest("button"); if (!b || b.dataset.tab === view) return;
  if (b.dataset.tab === "settings" && clock.running) clock.pause(); // leaving the table counts as pausing
  setView(b.dataset.tab);
});
$("grid").addEventListener("click", function(e){ var b = e.target.closest("button"); if (b) pick(+b.dataset.i); });
$("cover").addEventListener("click", function(e){
  if (!e.target.closest("#coverBtn")) return;
  if (game.phase === "over") newGame(); else togglePause();
});
$("pauseBtn").addEventListener("click", togglePause);
$("clock").addEventListener("click", togglePause);
wide.addEventListener("change", function(){ if (view === "game") renderGame(); });
document.addEventListener("visibilitychange", function(){
  if (document.visibilityState === "visible" && playing()) Parlor.requestWake();
});
document.addEventListener("gesturestart", function(e){ e.preventDefault(); });

render();
Parlor.registerOffline("../");
