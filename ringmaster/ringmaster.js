"use strict";
/* Ringmaster: three animals on two podiums. A goal card shows where they should end up; players race
   to call a sequence of commands that gets them there, and the app acts the call out to check it.
   There are only 24 arrangements, so the shortest call between any two is a quick search. */
var $ = Parlor.$, store = Parlor.store("ringmaster");

var ANIMALS = [{ e: "🦭", n: "seal" }, { e: "🐒", n: "monkey" }, { e: "🐩", n: "poodle" }];
var CMDS = [
  { id: "HIP", hint: "left → right" }, { id: "HOP", hint: "right → left" }, { id: "SWAP", hint: "tops trade" },
  { id: "LEFT UP", hint: "left bottom up" }, { id: "RIGHT UP", hint: "right bottom up" }
];

/* ===== Arrangements: "01|2" = left podium seal (bottom) then monkey; right podium poodle ===== */
function parse(s){ var p = s.split("|"); return { L: p[0].split("").map(Number), R: p[1].split("").map(Number) }; }
function str(st){ return st.L.join("") + "|" + st.R.join(""); }
function apply(s, cmd){ // the arrangement after a command, or null if the command can't be done
  var st = parse(s), L = st.L, R = st.R;
  if (cmd === "HIP"){ if (!L.length) return null; R.push(L.pop()); }
  else if (cmd === "HOP"){ if (!R.length) return null; L.push(R.pop()); }
  else if (cmd === "SWAP"){ if (!L.length || !R.length) return null; var t = L[L.length - 1]; L[L.length - 1] = R[R.length - 1]; R[R.length - 1] = t; }
  else if (cmd === "LEFT UP"){ if (L.length < 2) return null; L.push(L.shift()); }
  else if (cmd === "RIGHT UP"){ if (R.length < 2) return null; R.push(R.shift()); }
  return str(st);
}
function allStates(){
  var perms = [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]], out = [];
  perms.forEach(function(p){ for (var k = 0; k <= 3; k++) out.push(p.slice(0, k).join("") + "|" + p.slice(k).join("")); });
  return out;
}
function shortest(from, to){
  var prev = {}, queue = [from]; prev[from] = null;
  for (var i = 0; i < queue.length; i++){
    var s = queue[i];
    if (s === to) break;
    CMDS.forEach(function(c){ var n = apply(s, c.id); if (n && !(n in prev)){ prev[n] = [s, c.id]; queue.push(n); } });
  }
  var path = [];
  for (var at = to; prev[at]; at = prev[at][0]) path.unshift(prev[at][1]);
  return path;
}

/* ===== State =====
   game: { deck[] (arrangements), pos (index of the goal card), total, now, seq[],
           phase: "call" | "act" | "won" | "shown" | "over", msg, tone }
   Players keep score (and track who's sitting out) themselves; the app only checks calls. */
var settings = Object.assign({ cards: 12 }, store.get("settings") || {});
var game = store.get("game"), view = "settings", shown = null, pops = [];
if (game && game.phase === "act"){ game.phase = "call"; game.seq = []; }
function save(){ store.set("settings", settings); store.set("game", game); }
function goal(){ return game.deck[game.pos]; }

function newGame(){
  var deck = Parlor.shuffle(allStates());
  game = { deck: deck, pos: 1, total: Math.min(settings.cards, 23), now: deck[0], seq: [], phase: "call", msg: "", tone: "" };
  shown = null; save(); setView("game");
}
function nextCard(){
  game.now = goal(); game.pos++; game.seq = []; game.msg = ""; game.tone = "";
  game.phase = game.pos > game.total ? "over" : "call";
  shown = null; save(); render();
}
// act a call out on the ring, one command at a time; done(endArrangement or null if a command was impossible)
function act(seq, done){
  var s = game.now, i = 0;
  shown = s; game.phase = "act"; renderGame();
  (function step(){
    if (i >= seq.length) return done(s);
    var before = s; s = apply(s, seq[i]);
    if (!s){ game.msg = seq[i] + " can't be done there."; return done(null, i); }
    pops = moved(before, s); shown = s; renderGame(i);
    i++;
    setTimeout(step, 750);
  })();
}
function moved(a, b){ // animals whose place changed, so they can bounce
  var A = parse(a), B = parse(b), out = [];
  [0, 1, 2].forEach(function(x){
    var pa = A.L.indexOf(x) >= 0 ? "L" + A.L.indexOf(x) : "R" + A.R.indexOf(x);
    var pb = B.L.indexOf(x) >= 0 ? "L" + B.L.indexOf(x) : "R" + B.R.indexOf(x);
    if (pa !== pb) out.push(x);
  });
  return out;
}
function check(){
  if (game.phase !== "call") return;
  if (!game.seq.length){ game.msg = "Tap the commands as they're called out."; game.tone = "bad"; return renderGame(); }
  var seq = game.seq.slice();
  game.msg = "Let's see…"; game.tone = "";
  act(seq, function(end){
    var best = shortest(game.now, goal()).length;
    if (end === goal()){
      game.phase = "won"; game.tone = "good";
      game.msg = "Correct, in " + seq.length + "! The card goes to whoever called it." + (seq.length > best ? " (" + best + " was possible.)" : "");
    } else {
      game.tone = "bad";
      game.msg = (end ? "Not quite. " : game.msg + " ") + "That caller sits out this card.";
      game.seq = []; game.phase = "call";
      setTimeout(function(){ shown = null; renderGame(); }, 900);
    }
    save(); renderGame();
  });
}
function reveal(lead){
  var path = shortest(game.now, goal());
  game.seq = path;
  act(path, function(){
    game.phase = "shown"; game.tone = "";
    game.msg = (lead ? lead + " " : "") + "A shortest call: " + path.join(", ") + " (" + path.length + ").";
    save(); renderGame();
  });
}

/* ===== Drawing ===== */
function podsHTML(s, bounce){
  var st = parse(s);
  function pod(side, list, name){
    return '<div class="pod ' + side + '"><div class="stack">' + list.map(function(x){
      return '<div class="animal' + (bounce && bounce.indexOf(x) >= 0 ? " pop" : "") + '" title="' + ANIMALS[x].n + '">' + ANIMALS[x].e + '</div>';
    }).join("") + '</div><div class="drum"></div><div class="nm">' + name + '</div></div>';
  }
  return pod("L", st.L, "Left") + pod("R", st.R, "Right");
}
function renderGame(activeStep){
  var over = game.phase === "over", acting = game.phase === "act";
  $("cardCount").textContent = over ? "That's the show" : "Card " + game.pos + " of " + game.total;
  $("now").innerHTML = podsHTML(shown || game.now, acting ? pops : null);
  $("goal").innerHTML = over ? "" : podsHTML(goal());
  $("goalCap").textContent = over ? "That's the show" : "Goal";
  $("msg").textContent = over ? "" : game.msg; $("msg").className = "msg " + (game.tone || "");
  $("seq").innerHTML = game.seq.length ? game.seq.map(function(c, i){ return '<span class="t' + (acting && i === activeStep ? " now" : "") + '">' + c + '</span>'; }).join("")
    : '<span class="ph">' + (game.phase === "call" ? "Tap the commands as they're called" : "") + '</span>';
  $("cmds").innerHTML = CMDS.map(function(c){ return '<button data-c="' + c.id + '"' + (game.phase !== "call" ? " disabled" : "") + '><b>' + c.id + '</b><span>' + c.hint + '</span></button>'; }).join("");
  $("backBtn").hidden = $("checkBtn").hidden = game.phase !== "call";
  $("showBtn").hidden = game.phase !== "call";
  $("nextBtn").hidden = !(game.phase === "won" || game.phase === "shown");
  $("nextBtn").textContent = game.pos >= game.total ? "Finish" : "Next card";
  $("againBtn").hidden = !over;
  document.querySelector(".desk .box").hidden = over;
}
function renderSetup(){
  $("cardsOut").textContent = settings.cards;
  $("savedNote").hidden = !game;
  if (game) $("savedNote").textContent = game.phase === "over" ? "The last show is under the Ring tab."
    : "A show in progress (card " + game.pos + " of " + game.total + ") is under the Ring tab. Changes here apply to the next game.";
}
function render(){
  $("tabs").hidden = !game;
  [].forEach.call($("tabs").children, function(b){ b.setAttribute("aria-selected", String(b.dataset.tab === view)); });
  $("homeLink").hidden = view !== "settings";
  $("setup").hidden = view !== "settings";
  $("gameView").hidden = view !== "game";
  $("cardCount").hidden = view !== "game";
  if (view === "settings"){ $("againBtn").hidden = true; renderSetup(); }
  else renderGame();
}
function setView(v){ view = v; render(); }

/* ===== Events ===== */
$("minus").addEventListener("click", function(){ settings.cards = Math.max(3, settings.cards - 1); save(); renderSetup(); });
$("plus").addEventListener("click", function(){ settings.cards = Math.min(23, settings.cards + 1); save(); renderSetup(); });
$("start").addEventListener("click", function(){
  if (game && game.phase !== "over" && !confirm("Start a new show? The current one will be lost.")) return;
  newGame();
});
$("againBtn").addEventListener("click", newGame);
$("tabs").addEventListener("click", function(e){ var b = e.target.closest("button"); if (b && b.dataset.tab !== view && game.phase !== "act") setView(b.dataset.tab); });
$("cmds").addEventListener("click", function(e){
  var b = e.target.closest("button"); if (!b || game.phase !== "call") return;
  if (game.seq.length < 12) game.seq.push(b.dataset.c);
  if (game.tone === "bad"){ game.msg = ""; game.tone = ""; }
  save(); renderGame();
});
$("backBtn").addEventListener("click", function(){ game.seq.pop(); save(); renderGame(); });
$("checkBtn").addEventListener("click", check);
$("showBtn").addEventListener("click", function(){ if (game.phase === "call") reveal(""); });
$("nextBtn").addEventListener("click", nextCard);
document.addEventListener("gesturestart", function(e){ e.preventDefault(); });

render();
Parlor.registerOffline("../");
