"use strict";
/* Cover Story: a word-guessing game for one shared screen, in two modes.
   Teams: two teams race; each spymaster gives clues to their own team.
   Duet:  two players work together; each has their own side of the key and clues for the other.
   The board is built from a 5-letter code, so a phone that enters the same code rebuilds the same
   words and key without any network connection. Duet codes start with D; team codes never do. */
var $ = Parlor.$, rnd = Parlor.rnd, store = Parlor.store("cover-story");

var TEAM = { A: "Red", B: "Blue" };
var CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I or O, which read like 1 and 0
function other(t){ return t === "A" ? "B" : "A"; }
function isDuetCode(code){ return code.charAt(0) === "D"; }

/* ===== Boards from codes ===== */
function newCode(mode){
  var c = mode === "duet" ? "D" : CODE_LETTERS.replace("D", "")[rnd(CODE_LETTERS.length - 1)];
  for (var i = 1; i < 5; i++) c += CODE_LETTERS[rnd(CODE_LETTERS.length)];
  return c;
}
function cleanCode(s){ return String(s || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5); }
function pickWords(rand){ return Parlor.shuffle(WORDS.slice(), rand).slice(0, 25); }
// Teams key roles: "A"/"B" team agents (starting team 9, other 8), "N" bystander (7), "X" assassin (1).
function layout(code){
  var rand = Parlor.seeded("cover-story:" + code);
  var words = pickWords(rand);
  var first = rand(2) ? "B" : "A", second = other(first), key = [], i;
  for (i = 0; i < 9; i++) key.push(first);
  for (i = 0; i < 8; i++) key.push(second);
  for (i = 0; i < 7; i++) key.push("N");
  key.push("X");
  Parlor.shuffle(key, rand);
  return { code: code, words: words, key: key, first: first };
}
/* Duet: each side has 9 agents "G", 3 assassins "X", 13 bystanders "N". The sides overlap like
   the classic two-sided key card: 3 agents are shared, and each side's assassins are an assassin,
   an agent and a bystander on the other side. 15 different agents to find in all. */
var DUET_PAIRS = [["GG",3],["GN",5],["NG",5],["GX",1],["XG",1],["XX",1],["XN",1],["NX",1],["NN",7]];
function duetLayout(code){
  var rand = Parlor.seeded("cover-story-duet:" + code);
  var words = pickWords(rand), pairs = [];
  DUET_PAIRS.forEach(function(p){ for (var i = 0; i < p[1]; i++) pairs.push(p[0]); });
  Parlor.shuffle(pairs, rand);
  return { code: code, words: words,
           key: { A: pairs.map(function(p){ return p[0]; }), B: pairs.map(function(p){ return p[1]; }) } };
}

/* ===== State (saved, so a reload or an accidental swipe-away doesn't lose the game) =====
   game, teams: { mode:"teams", code, revealed[25], turn, over: null|{winner, why} }
   game, duet:  { mode:"duet", code, found[25], miss:{A[25],B[25]}, giver, turns, sudden, guesser,
                  over: null|{win, why, hit} }   miss.A[i]: guessed on A's clues and it was a bystander
   joined: a key opened on a player's phone { code, side ("A"/"B" for duet), done[25] } */
var settings = Object.assign({ mode: "teams", turns: 9 }, store.get("settings") || {});
var game = store.get("game"), joined = store.get("joined");
if (game && !game.mode) game.mode = "teams"; // saved before Duet existed
var lay = null;
var view = "settings", armed = -1;
function relayout(){ lay = !game ? null : game.mode === "duet" ? duetLayout(game.code) : layout(game.code); }
relayout();
function save(){ store.set("game", game); store.set("joined", joined); store.set("settings", settings); }
function duet(){ return game && game.mode === "duet"; }

function newGame(){
  var code = newCode(settings.mode);
  if (settings.mode === "duet"){
    game = { mode: "duet", code: code, found: new Array(25).fill(false),
             miss: { A: new Array(25).fill(false), B: new Array(25).fill(false) },
             giver: "A", turns: settings.turns, sudden: false, guesser: null, over: null };
  } else {
    game = { mode: "teams", code: code, revealed: new Array(25).fill(false), turn: null, over: null };
  }
  relayout();
  if (!duet()) game.turn = lay.first;
  armed = -1;
  save();
  Parlor.requestWake();
  setView("board");
}

/* ----- Teams ----- */
function left(t){ var n = 0; lay.key.forEach(function(r, i){ if (r === t && !game.revealed[i]) n++; }); return n; }
function reveal(i){
  if (game.over || game.revealed[i]) return;
  game.revealed[i] = true;
  var role = lay.key[i], t = game.turn;
  if (role === "X") game.over = { winner: other(t), why: TEAM[t] + " found the assassin." };
  else if ((role === "A" || role === "B") && left(role) === 0)
    game.over = { winner: role, why: role === t ? "All agents found." : TEAM[t] + " uncovered " + TEAM[role] + "'s last agent." };
  else if (role !== t) game.turn = other(t);
  if (game.over) Parlor.releaseWake();
  save();
}

/* ----- Duet ----- */
function agentsLeft(){ var n = 0; for (var i = 0; i < 25; i++) if (!game.found[i] && (lay.key.A[i] === "G" || lay.key.B[i] === "G")) n++; return n; }
function sideLeft(s){ var n = 0; for (var i = 0; i < 25; i++) if (!game.found[i] && lay.key[s][i] === "G") n++; return n; }
function judgeSide(){ return game.sudden ? (game.guesser ? other(game.guesser) : null) : game.giver; } // whose key a guess is checked against
function canGuess(i){ var s = judgeSide(); return !game.over && !!s && !game.found[i] && !game.miss[s][i]; }
function duetGuess(i){
  if (!canGuess(i)) return;
  var s = judgeSide(), role = lay.key[s][i];
  if (role === "X") game.over = { win: false, hit: i, why: "That was an assassin on " + s + "'s key." };
  else if (role === "N" && game.sudden) { game.miss[s][i] = true; game.over = { win: false, why: "A bystander in sudden death ends the mission." }; }
  else if (role === "N") { game.miss[s][i] = true; duetEndTurn(); }
  else {
    game.found[i] = true;
    if (!agentsLeft()) game.over = { win: true, why: "All 15 agents found" + (game.sudden ? " in sudden death." : " with " + game.turns + (game.turns === 1 ? " turn" : " turns") + " to spare.") };
    else if (!game.sudden && !sideLeft(s)) duetEndTurn(); // nothing left to find on this key
  }
  if (game.over) Parlor.releaseWake();
  save();
}
function duetEndTurn(){
  if (game.over || game.sudden) return;
  game.turns--;
  if (game.turns <= 0){ game.sudden = true; game.guesser = null; return; }
  var next = other(game.giver);
  if (sideLeft(next)) game.giver = next; // a player whose agents are all found stops giving clues
}

/* ===== Rendering ===== */
function cardHTML(i, word, cls, extra){
  return '<button class="tile card' + (word.length >= 7 ? " long" : "") + cls + '" data-i="' + i + '"><span class="w">' + word + '</span>' + (extra || "") + '</button>';
}
function renderBoard(){
  if (duet()) return renderDuetBoard();
  var h = "";
  for (var i = 0; i < 25; i++){
    var cls = "";
    if (game.revealed[i] || game.over) cls += " " + lay.key[i]; // role colours only once it's public
    if (game.revealed[i]) cls += " rv";
    if (i === armed) cls += " armed";
    h += cardHTML(i, lay.words[i], cls);
  }
  $("board").innerHTML = h;
  $("board").classList.toggle("over", !!game.over);
  var t = game.over ? game.over.winner : game.turn;
  $("turn").innerHTML = '<span class="dot ' + t + '"></span>' + TEAM[t] +
    (game.over ? ' wins! <span class="why">' + game.over.why + '</span>' : "'s turn");
  $("chips").innerHTML = '<span class="chip A" aria-label="Red agents left">' + left("A") + '</span>' +
                         '<span class="chip B" aria-label="Blue agents left">' + left("B") + '</span>';
  $("endTurnBtn").hidden = !!game.over;
  $("guesserSeg").hidden = true;
  $("boardFoot").innerHTML = 'Spymasters: open Cover Story on your phone and enter code <b>' + game.code + '</b>';
}
function renderDuetBoard(){
  var h = "", A = lay.key.A, B = lay.key.B;
  for (var i = 0; i < 25; i++){
    var cls = "", tags = "";
    if (game.found[i]) cls = " G rv";
    else if (game.over && game.over.hit === i) cls = " X rv";
    else if (game.miss.A[i] && game.miss.B[i]) cls = " N rv";
    else {
      if (game.miss.A[i]) tags += '<span class="tag a" title="Bystander on A\'s key">A</span>';
      if (game.miss.B[i]) tags += '<span class="tag b" title="Bystander on B\'s key">B</span>';
      if (game.over) cls = " " + (A[i] === "G" || B[i] === "G" ? "G" : A[i] === "X" || B[i] === "X" ? "X" : "N");
      if (!game.over && !canGuess(i)) cls += " spent";
    }
    if (i === armed) cls += " armed";
    h += cardHTML(i, lay.words[i], cls, tags);
  }
  $("board").innerHTML = h;
  $("board").classList.toggle("over", !!game.over);
  var t;
  if (game.over) t = (game.over.win ? "Mission complete! " : "Mission failed. ") + '<span class="why">' + game.over.why + '</span>';
  else if (game.sudden) t = 'Sudden death <span class="why">' + (game.guesser ? "No clues. " + game.guesser + " guesses; any bystander loses." : "Out of turns. Pick who's guessing.") + '</span>';
  else t = '<span class="who">' + game.giver + '</span>' + game.giver + " gives a clue";
  $("turn").innerHTML = t;
  $("chips").innerHTML = '<span class="chip T" aria-label="Turns left">' + Math.max(0, game.turns) + (game.turns === 1 ? " turn" : " turns") + '</span>' +
                         '<span class="chip G" aria-label="Agents left">' + agentsLeft() + " left</span>";
  $("endTurnBtn").hidden = !!game.over || game.sudden;
  $("guesserSeg").hidden = !game.sudden || !!game.over;
  [].forEach.call($("guesserSeg").children, function(b){ b.setAttribute("aria-pressed", String(b.dataset.v === game.guesser)); });
  $("boardFoot").innerHTML = 'Each player: open Cover Story on your phone, enter code <b>' + game.code + '</b> and pick your side. ' +
    'A tagged card was a bystander on that player\'s key, but it can still be an agent on the other.';
}
function keySource(){ // a joined key wins over this device's own board
  if (joined && isDuetCode(joined.code)){
    var d = duetLayout(joined.code);
    return { words: d.words, roles: d.key[joined.side], done: joined.done, own: false, code: joined.code,
             title: '<span class="who">' + joined.side + '</span>Your key: side ' + joined.side,
             note: "tap a card to mark it · show this only to yourself" };
  }
  var k = joined ? layout(joined.code) : (game && !duet()) ? lay : null;
  if (!k) return null;
  return { words: k.words, roles: k.key, done: joined ? joined.done : game.revealed, own: !joined, code: k.code,
           title: '<span class="dot ' + k.first + '"></span>' + TEAM[k.first] + " goes first",
           note: joined ? "tap a card to mark it as found" : "turned cards fade as they're revealed on the board" };
}
function renderKey(){
  var k = keySource(); if (!k) return;
  var h = "";
  for (var i = 0; i < 25; i++) h += cardHTML(i, k.words[i], " " + k.roles[i] + (k.done[i] ? " done" : ""));
  $("key").innerHTML = h;
  $("keyTitle").innerHTML = k.title;
  $("keyFoot").innerHTML = "Key for code <b>" + k.code + "</b> · " + k.note;
  $("closeKeyBtn").hidden = k.own;
}
var MODE_TEXT = {
  teams: { sub: "25 words · 2 teams · 1 assassin",
           credit: "Two teams, 25 words. Each team's spymaster gives one-word clues plus a number; teammates tap the cards they think are theirs. Find all your agents first, and never touch the assassin." },
  duet:  { sub: "25 words · 2 players · 15 agents",
           credit: "Two players on the same side. Each sees their own key; take turns giving one-word clues to your partner. Find all 15 agents before you run out of turns, and avoid the assassins on both keys." }
};
function renderSetup(){
  [].forEach.call($("segMode").children, function(b){ b.setAttribute("aria-pressed", String(b.dataset.v === settings.mode)); });
  $("turnsRow").hidden = settings.mode !== "duet";
  $("turnsOut").textContent = settings.turns;
  $("modeSub").textContent = MODE_TEXT[settings.mode].sub;
  $("credit").textContent = MODE_TEXT[settings.mode].credit;
  $("savedNote").hidden = !game;
  if (game) $("savedNote").textContent = (game.over ? "The last game" : "A game in progress") + " (" + (duet() ? "Duet, " : "") + "code " + game.code + ") is under the Board tab.";
  renderJoin();
}
function renderJoin(){
  var duetCode = isDuetCode(cleanCode($("joinCode").value));
  $("joinSide").hidden = !duetCode;
  $("joinMsg").textContent = duetCode ? "Duet game: pick the side you're playing." : "Enter the code shown under the board to see the key on this device.";
}
function render(){
  var hasKey = !!(joined || (game && !duet())); // a Duet board's keys live only on the players' phones
  $("tabs").hidden = !(game || joined);
  $("boardTab").hidden = !game;
  $("keyTab").hidden = !hasKey;
  [].forEach.call($("tabs").children, function(b){ b.setAttribute("aria-selected", String(b.dataset.tab === view)); });
  $("homeLink").hidden = view !== "settings";
  $("setup").hidden = view !== "settings";
  $("boardView").hidden = view !== "board";
  $("keyView").hidden = view !== "key";
  $("againBtn").hidden = !(game && game.over && view === "board");
  if (view === "settings") renderSetup();
  if (view === "board") renderBoard();
  if (view === "key") renderKey();
}
function setView(v){ armed = -1; view = v; render(); }

/* ===== Events ===== */
$("segMode").addEventListener("click", function(e){ var b = e.target.closest("button"); if (!b) return; settings.mode = b.dataset.v; save(); renderSetup(); });
$("turnsMinus").addEventListener("click", function(){ settings.turns = Math.max(4, settings.turns - 1); save(); renderSetup(); });
$("turnsPlus").addEventListener("click", function(){ settings.turns = Math.min(15, settings.turns + 1); save(); renderSetup(); });
$("start").addEventListener("click", function(){
  if (game && !game.over && !confirm("Start a new board? The current game will be lost.")) return;
  newGame();
});
$("againBtn").addEventListener("click", function(){ settings.mode = game.mode; newGame(); });
$("tabs").addEventListener("click", function(e){
  var b = e.target.closest("button"); if (!b || b.dataset.tab === view) return;
  if (b.dataset.tab === "key" && !joined && !confirm("Show the key? Only spymasters should look.")) return;
  setView(b.dataset.tab);
});
// first tap picks a card, second tap on the same card turns it over, so a stray touch costs nothing
$("board").addEventListener("click", function(e){
  var b = e.target.closest("button"); if (!b || game.over) return;
  e.stopPropagation();
  var i = +b.dataset.i, open = duet() ? canGuess(i) : !game.revealed[i];
  if (!open) { armed = -1; }
  else if (armed === i) { armed = -1; if (duet()) duetGuess(i); else reveal(i); }
  else armed = i;
  render(); // the whole page, so the top bar picks up "New game" when a guess ends the game
});
document.addEventListener("click", function(){ if (armed >= 0){ armed = -1; if (view === "board") renderBoard(); } });
$("endTurnBtn").addEventListener("click", function(e){
  e.stopPropagation(); armed = -1;
  if (duet()) { duetEndTurn(); save(); }
  else if (!game.over) { game.turn = other(game.turn); save(); }
  renderBoard();
});
$("guesserSeg").addEventListener("click", function(e){
  var b = e.target.closest("button"); if (!b) return;
  e.stopPropagation(); armed = -1; game.guesser = b.dataset.v; save(); renderBoard();
});
$("key").addEventListener("click", function(e){
  var b = e.target.closest("button"); if (!b || !joined) return; // own key mirrors the board instead
  var i = +b.dataset.i;
  joined.done[i] = !joined.done[i]; save(); renderKey();
});
$("closeKeyBtn").addEventListener("click", function(){ joined = null; save(); setView(game ? "board" : "settings"); });
var joinSide = null;
function openKey(code, side){
  code = cleanCode(code);
  if (code.length !== 5){ $("joinMsg").textContent = "Codes are 5 letters, shown under the board."; return false; }
  if (isDuetCode(code) && !side){ $("joinMsg").textContent = "Duet game: pick side A or B first."; return false; }
  if (!isDuetCode(code)) side = undefined;
  var same = joined && joined.code === code && joined.side === side;
  joined = same ? joined : { code: code, side: side, done: new Array(25).fill(false) };
  save(); setView("key");
  return true;
}
$("joinCode").addEventListener("input", function(){ var c = cleanCode(this.value); if (c !== this.value) this.value = c; renderJoin(); });
$("joinSide").addEventListener("click", function(e){
  var b = e.target.closest("button"); if (!b) return;
  joinSide = b.dataset.v;
  [].forEach.call(this.children, function(x){ x.setAttribute("aria-pressed", String(x === b)); });
});
$("joinForm").addEventListener("submit", function(e){
  e.preventDefault();
  if (openKey($("joinCode").value, joinSide)) { $("joinCode").value = ""; $("joinCode").blur(); }
});
document.addEventListener("visibilitychange", function(){
  if (document.visibilityState === "visible" && game && !game.over && view === "board") Parlor.requestWake();
});
document.addEventListener("gesturestart", function(e){ e.preventDefault(); });

/* ===== Start-up: a link ending in #CODE opens that key straight away (Duet codes ask for a side) ===== */
(function(){
  var h = cleanCode(location.hash);
  if (h.length === 5){
    history.replaceState(null, "", location.pathname);
    if (!isDuetCode(h)) return openKey(h);
    $("joinCode").value = h;
  }
  render();
})();

Parlor.registerOffline("../");
