"use strict";
/* No Echo: a cooperative clue game. One player guesses a mystery word; everyone else gives a
   one-word clue, and clues that match cancel out before the guesser sees them.
   Clues are either typed on this device (passed around, hidden while typing) or written on paper. */
var $ = Parlor.$, rnd = Parlor.rnd, store = Parlor.store("no-echo");

var settings = Object.assign({ players: ["", "", ""], mode: "device", cards: 13 }, store.get("settings") || {});
/* game: { players[], mode, total, left (cards still in the deck, this one included),
           guesser, card[5], word, used[], peeked, clues[{ by, text, out, why }], giver (how many
           have given a clue), verdict: "right" | "wrong" | "pass", guess, phase }
   phase: "pick" → "hide" → ("clues" → "compare", typed mode only) → "guess" → "result" → … → "over"
   The group keeps its own tally; the app runs the cards. */
var game = store.get("game"), view = "settings";
function save(){ store.set("settings", settings); store.set("game", game); }

/* ===== Matching: tolerant of case, punctuation and simple plurals ===== */
function norm(s){ return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }
function same(a, b){
  if (!a || !b) return false;
  if (a === b || a + "s" === b || b + "s" === a || a + "es" === b || b + "es" === a) return true;
  return /y$/.test(a) && a.slice(0, -1) + "ies" === b || /y$/.test(b) && b.slice(0, -1) + "ies" === a;
}
function tooClose(clue, word){ return same(clue, word) || clue.length >= 3 && (clue.indexOf(word) >= 0 || word.indexOf(clue) >= 0); }
function autoCancel(){
  var w = norm(game.word);
  game.clues.forEach(function(c){
    var n = norm(c.text);
    c.out = false; c.why = "";
    if (!n){ c.out = true; c.why = "blank"; }
    else if (tooClose(n, w)){ c.out = true; c.why = "too close"; }
  });
  game.clues.forEach(function(c, i){
    game.clues.forEach(function(d, j){
      if (i !== j && same(norm(c.text), norm(d.text))){ c.out = true; c.why = "match"; }
    });
  });
}

/* ===== Flow ===== */
function givers(){ // everyone but the guesser, starting from the player after them
  var n = game.players.length, out = [];
  for (var k = 1; k < n; k++) out.push((game.guesser + k) % n);
  return out;
}
function newGame(){
  var players = Parlor.playerNames(settings.players);
  game = { players: players, mode: settings.mode, total: settings.cards, left: settings.cards, guesser: 0, used: [] };
  draw();
  Parlor.requestWake();
  setView("game");
}
function draw(){
  var card = [];
  while (card.length < 5){
    var w = WORDS[rnd(WORDS.length)];
    if (game.used.indexOf(w) < 0 && card.indexOf(w) < 0) card.push(w);
  }
  game.used = game.used.concat(card);
  game.card = card; game.word = null; game.peeked = false; game.clues = []; game.giver = 0;
  game.verdict = null; game.guess = ""; game.phase = "pick";
  save();
}
function finishCard(){
  var v = game.verdict;
  game.left--;
  if (v === "wrong" && game.left > 0) game.left--; // a wrong guess costs the next card too
  if (game.left <= 0){ game.phase = "over"; Parlor.releaseWake(); save(); return; }
  game.guesser = (game.guesser + 1) % game.players.length;
  draw();
}

/* ===== Rendering ===== */
function esc(s){ return String(s).replace(/[&<>"]/g, function(ch){ return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]; }); }
function noteHTML(c, tag){
  return '<' + tag + ' class="note-card' + (c.out ? " out" : "") + '" data-i="' + c.i + '"><span class="w">' + esc(c.text || "—") + '</span>' +
         (c.why ? '<span class="why">' + c.why + '</span>' : "") + '<small>' + esc(game.players[c.by]) + '</small></' + tag + '>';
}
function renderGame(){
  var ph = game.phase, g = game.players[game.guesser];
  [].forEach.call(document.querySelectorAll(".screen"), function(s){ s.hidden = s.dataset.phase !== ph; });
  [].forEach.call(document.querySelectorAll(".g"), function(e){ e.textContent = g; });
  [].forEach.call(document.querySelectorAll(".word"), function(e){ e.textContent = game.word || ""; });
  var card = game.total - game.left + 1;
  $("status").innerHTML = ph === "over" ? "" : "Card <b>" + Math.min(card, game.total) + "</b> of " + game.total;

  if (ph === "pick"){
    $("pickNotes").innerHTML = [1, 2, 3, 4, 5].map(function(n){ return '<button class="note-card" data-n="' + (n - 1) + '">' + n + '</button>'; }).join("");
  }
  if (ph === "hide"){
    $("peekBtn").hidden = game.peeked; $("bigWord").hidden = !game.peeked; $("bigWord").textContent = game.word;
    $("toCluesBtn").hidden = !game.peeked;
    $("toCluesBtn").textContent = game.mode === "device" ? "Write clues" : "Clues are ready";
    $("hideText").textContent = !game.peeked ? "" : game.mode === "device"
      ? "Everyone but " + g + " has seen it? Then pass the device around to write your clues."
      : "Each write a one-word clue on paper, without showing each other. Then compare, cross out any that match or are too close, and get ready to show " + g + ".";
  }
  if (ph === "clues"){
    var gv = givers(), now = gv[game.giver];
    $("giverName").textContent = game.players[now];
    $("whoList").innerHTML = gv.map(function(p, k){ return '<span class="' + (k < game.giver ? "done" : k === game.giver ? "now" : "") + '">' + esc(game.players[p]) + (k < game.giver ? " ✓" : "") + '</span>'; }).join("");
  }
  if (ph === "compare"){
    $("compareNotes").innerHTML = game.clues.map(function(c, i){ c.i = i; return noteHTML(c, "button"); }).join("");
  }
  if (ph === "guess"){
    var typed = game.mode === "device";
    $("guessForm").hidden = !typed; $("judgeBtns").hidden = typed; $("guessNotes").hidden = !typed;
    if (typed){
      var shown = game.clues.filter(function(c){ return !c.out; }), gone = game.clues.length - shown.length;
      $("guessNotes").innerHTML = shown.map(function(c, i){ c.i = i; return noteHTML({ text: c.text, by: c.by, i: i }, "div"); }).join("");
      $("guessText").textContent = !shown.length ? "Every clue cancelled out! Take a wild guess, or pass."
        : gone ? gone + (gone === 1 ? " clue was" : " clues were") + " cancelled. You get one guess." : "No clues cancelled. You get one guess.";
    } else {
      $("guessText").textContent = "Show " + g + " the clues that survived. " + g + " gets one guess. How did it go?";
    }
  }
  if (ph === "result"){
    var v = game.verdict;
    $("verdict").textContent = v === "right" ? "Got it!" : v === "wrong" ? "Not quite." : "Passed.";
    $("verdict").className = "verdict " + (v === "right" ? "good" : v === "wrong" ? "bad" : "meh");
    $("resultWord").textContent = game.word;
    $("resultText").textContent = v === "right" ? "Keep this card."
      : v === "wrong" ? (game.guess ? g + ' guessed "' + game.guess + '". ' : "") + (game.left > 1 ? "A wrong guess costs the next card too." : "")
      : "Passing only costs this card.";
    $("overrideBtn").hidden = !(v === "wrong" && game.mode === "device" && game.guess);
    $("nextBtn").textContent = game.left - (v === "wrong" ? 2 : 1) > 0 ? "Next card" : "Finish";
  }
}
function renderSetup(){
  names.render();
  [].forEach.call($("segMode").children, function(b){ b.setAttribute("aria-pressed", String(b.dataset.v === settings.mode)); });
  $("cardsOut").textContent = settings.cards;
  $("savedNote").hidden = !game;
  if (game) $("savedNote").textContent = game.phase === "over" ? "The last game is under the Game tab."
    : "A game in progress (card " + (game.total - game.left + 1) + " of " + game.total + ") is under the Game tab. Changes here apply to the next game.";
}
function render(){
  $("tabs").hidden = !game;
  [].forEach.call($("tabs").children, function(b){ b.setAttribute("aria-selected", String(b.dataset.tab === view)); });
  $("homeLink").hidden = view !== "settings";
  $("setup").hidden = view !== "settings";
  $("gameView").hidden = view !== "game";
  if (view === "settings"){ $("status").textContent = ""; renderSetup(); }
  else renderGame();
}
function setView(v){ view = v; render(); }

/* ===== Events ===== */
var names = Parlor.nameList({ box: $("names"), add: $("addPlayer"), list: function(){ return settings.players; }, min: 3, max: 10, onChange: save });
$("segMode").addEventListener("click", function(e){ var b = e.target.closest("button"); if (!b) return; settings.mode = b.dataset.v; save(); renderSetup(); });
$("minus").addEventListener("click", function(){ settings.cards = Math.max(5, settings.cards - 1); save(); renderSetup(); });
$("plus").addEventListener("click", function(){ settings.cards = Math.min(30, settings.cards + 1); save(); renderSetup(); });
$("start").addEventListener("click", function(){
  if (game && game.phase !== "over" && !confirm("Start a new game? The current one will be lost.")) return;
  newGame();
});
$("againBtn").addEventListener("click", newGame);
$("tabs").addEventListener("click", function(e){ var b = e.target.closest("button"); if (b && b.dataset.tab !== view) setView(b.dataset.tab); });

$("pickNotes").addEventListener("click", function(e){
  var b = e.target.closest("button"); if (!b) return;
  game.word = game.card[+b.dataset.n]; game.phase = "hide"; save(); renderGame();
});
$("peekBtn").addEventListener("click", function(){ game.peeked = true; save(); renderGame(); });
$("toCluesBtn").addEventListener("click", function(){
  game.phase = game.mode === "device" ? "clues" : "guess"; save(); renderGame();
  if (game.phase === "clues") $("clueInput").focus();
});
$("showClue").addEventListener("click", function(){ var s = $("clueInput").classList.toggle("show"); this.textContent = s ? "Hide" : "Show"; });
$("clueForm").addEventListener("submit", function(e){
  e.preventDefault();
  var text = $("clueInput").value.trim();
  if (!text){ $("clueInput").focus(); return; }
  game.clues.push({ by: givers()[game.giver], text: text });
  game.giver++;
  $("clueInput").value = ""; $("clueInput").classList.remove("show"); $("showClue").textContent = "Show";
  if (game.giver >= givers().length){ autoCancel(); game.phase = "compare"; $("clueInput").blur(); }
  save(); renderGame();
  if (game.phase === "clues") $("clueInput").focus();
});
$("compareNotes").addEventListener("click", function(e){
  var b = e.target.closest("button"); if (!b) return;
  var c = game.clues[+b.dataset.i]; c.out = !c.out; c.why = c.out ? "crossed out" : "";
  save(); renderGame();
});
$("toGuessBtn").addEventListener("click", function(){ game.phase = "guess"; save(); renderGame(); $("guessInput").value = ""; });
$("guessForm").addEventListener("submit", function(e){
  e.preventDefault();
  var g = $("guessInput").value.trim(); if (!g) return;
  game.guess = g; game.verdict = same(norm(g), norm(game.word)) ? "right" : "wrong";
  $("guessInput").blur(); game.phase = "result"; save(); renderGame();
});
$("passBtn").addEventListener("click", function(){ game.guess = ""; game.verdict = "pass"; game.phase = "result"; save(); renderGame(); });
$("judgeBtns").addEventListener("click", function(e){
  var b = e.target.closest("button"); if (!b) return;
  game.guess = ""; game.verdict = b.dataset.r; game.phase = "result"; save(); renderGame();
});
$("overrideBtn").addEventListener("click", function(){ game.verdict = "right"; save(); renderGame(); });
$("nextBtn").addEventListener("click", function(){ finishCard(); renderGame(); });
document.addEventListener("visibilitychange", function(){
  if (document.visibilityState === "visible" && game && game.phase !== "over" && view === "game") Parlor.requestWake();
});
document.addEventListener("gesturestart", function(e){ e.preventDefault(); });

render();
Parlor.registerOffline("../");
