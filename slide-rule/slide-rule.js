"use strict";
/* Slide Rule: robots slide until something stops them; find the fewest moves to the target.
   Boards are generated from a code (walls, targets, starting robots and the target deck), so a
   saved game only needs to store the code and what has happened since. */
var $ = Parlor.$, fmt = Parlor.fmt, store = Parlor.store("slide-rule");

var N = 0, E = 1, S = 2, W = 3;
var BIT = [1, 2, 4, 8], STEP = [-16, 1, 16, -1], ARROW = ["▲", "▶", "▼", "◀"];
var COLORS = ["Red", "Green", "Blue", "Yellow"], CSSCOL = ["var(--bot-red)", "var(--bot-green)", "var(--bot-blue)", "var(--bot-yellow)"];
var SHAPES = ["Circle", "Triangle", "Square", "Star"];
var CENTER = [119, 120, 135, 136];
function rowOf(c){ return c >> 4; } function colOf(c){ return c & 15; }
function neighbor(c, d){
  var r = rowOf(c), k = colOf(c);
  if (d === N) return r > 0 ? c - 16 : -1;
  if (d === S) return r < 15 ? c + 16 : -1;
  if (d === E) return k < 15 ? c + 1 : -1;
  return k > 0 ? c - 1 : -1;
}

/* ===== Board from a code =====
   16×16 cells with a walled-off 2×2 centre. Each 8×8 quarter gets two stub walls on its outer
   edges and four targets, each tucked into an L of walls; one quarter also gets the wild target.
   Every quarter has one target of each colour and one of each shape. */
function makeBoard(code){
  var rand = Parlor.seeded("slide-rule:" + code), walls = new Uint8Array(256);
  function wall(c, d){ walls[c] |= BIT[d]; var n = neighbor(c, d); if (n >= 0) walls[n] |= BIT[(d + 2) % 4]; }
  for (var i = 0; i < 16; i++){ wall(i, N); wall(240 + i, S); wall(i * 16, W); wall(i * 16 + 15, E); }
  wall(119, N); wall(119, W); wall(120, N); wall(120, E); wall(135, S); wall(135, W); wall(136, S); wall(136, E);

  var targets = [], wildQuarter = rand(4);
  for (var q = 0; q < 4; q++){
    var r0 = (q >> 1) * 8, c0 = (q & 1) * 8;
    wall((r0 ? 15 : 0) * 16 + c0 + 1 + rand(6), E);         // stub on the top/bottom edge
    wall((r0 + 1 + rand(6)) * 16 + (c0 ? 15 : 0), S);        // stub on the left/right edge
    var spots = [], want = q === wildQuarter ? 5 : 4, tries = 0;
    while (spots.length < want && tries++ < 500){
      var r = r0 + 1 + rand(6), k = c0 + 1 + rand(6), c = r * 16 + k;
      if (r >= 6 && r <= 9 && k >= 6 && k <= 9) continue;   // keep clear of the centre block
      if (spots.some(function(s){ return Math.abs(rowOf(s) - r) <= 1 && Math.abs(colOf(s) - k) <= 1; })) continue;
      spots.push(c);
    }
    var order = Parlor.shuffle([0, 1, 2, 3], rand);
    spots.forEach(function(c, n){
      wall(c, rand(2) ? N : S); wall(c, rand(2) ? E : W);
      targets.push(n < 4 ? { cell: c, color: order[n], shape: (order[n] + q) % 4 } : { cell: c, color: -1, shape: 4 });
    });
  }
  var robots = [];
  while (robots.length < 4){
    var p = rand(256);
    if (CENTER.indexOf(p) < 0 && robots.indexOf(p) < 0 && !targets.some(function(t){ return t.cell === p; })) robots.push(p);
  }
  var deck = Parlor.shuffle(targets.map(function(_, n){ return n; }), rand);
  return { walls: walls, targets: targets, robots: robots, deck: deck };
}
function slide(walls, robots, r, d){
  var p = robots[r];
  for (;;){
    if (walls[p] & BIT[d]) return p;
    var n = p + STEP[d];
    if (robots.indexOf(n) >= 0) return p;
    p = n;
  }
}

/* ===== State =====
   game: { code, deck[], deckPos, robots[4], start[4] (robots when this target
           was drawn), moves, phase: "think" | "timing" | "demo" | "solved" | "over" } */
var settings = Object.assign({ seconds: 60 }, store.get("settings") || {});
var game = store.get("game"), board = null;
var view = "settings", selected = -1, locked = false;
if (game){ board = makeBoard(game.code); if (game.phase === "timing") game.phase = "demo"; }
function save(){ store.set("settings", settings); store.set("game", game); }
function target(){ return board.targets[game.deck[game.deckPos]]; }
function reached(){ var t = target(); return t.color >= 0 ? game.robots[t.color] === t.cell : game.robots.indexOf(t.cell) >= 0; }

function newGame(){
  var code = ""; for (var i = 0; i < 6; i++) code += "ABCDEFGHJKLMNPQRSTUVWXYZ"[Parlor.rnd(24)];
  board = makeBoard(code);
  game = { code: code, deck: board.deck.slice(),
           deckPos: -1, robots: board.robots.slice(), start: null, moves: 0, phase: "think" };
  nextTarget();
  Parlor.requestWake();
  setView("board");
}
function nextTarget(){
  clock.stop(); selected = -1;
  game.deckPos++;
  if (game.deckPos >= game.deck.length){ game.phase = "over"; Parlor.releaseWake(); save(); return; }
  // a target that is already reached is no puzzle: swap it with a later one, or skip it if it's last
  for (var j = game.deckPos + 1; reached() && j < game.deck.length; j++){
    var t = game.deck[game.deckPos]; game.deck[game.deckPos] = game.deck[j]; game.deck[j] = t;
  }
  if (reached()) return nextTarget();
  game.start = game.robots.slice(); game.moves = 0; game.phase = "think";
  save();
  startSolve();
}
function advance(){ // players keep score themselves; this just moves on to the next target
  if (locked) return;
  if (!reached()) game.robots = game.start.slice(); // robots stay where a successful route left them
  nextTarget();
  render();
}
function moveRobot(r, d){
  if (locked || game.phase === "solved" || game.phase === "over") return;
  var to = slide(board.walls, game.robots, r, d);
  if (to === game.robots[r]) return;
  game.robots[r] = to; game.moves++;
  if (reached()){ game.phase = "solved"; clock.stop(); }
  save(); renderBoard();
}
function resetRobots(){
  if (locked) return;
  game.robots = game.start.slice(); game.moves = 0;
  if (game.phase === "solved") game.phase = "demo";
  save(); renderBoard();
}

/* ===== Timer: starts when the first player calls a number ===== */
var clock = Parlor.countdown({
  onTick: function(left){ var c = $("clock"); c.textContent = fmt(left); c.className = left <= 10 ? "crit" : left <= 20 ? "warn" : ""; },
  onDone: function(){ Parlor.buzzer(); game.phase = "demo"; save(); renderBoard(); }
});

/* ===== Shortest route, worked out in the background as soon as a target is drawn ===== */
var worker = null, solution = { key: "", moves: undefined }, wantSolution = false;
function solveKey(){ return game.code + ":" + game.deckPos + ":" + game.start.join(","); }
function startSolve(){
  var key = solveKey();
  if (solution.key === key) return;
  if (worker) worker.terminate();
  solution = { key: key, moves: undefined }; wantSolution = false;
  try { worker = new Worker("solver.js"); } catch(e){ worker = null; solution.moves = null; return; }
  var t = target();
  worker.onmessage = function(e){ if (solution.key !== key) return; solution.moves = e.data.moves; if (wantSolution) showSolution(); };
  worker.postMessage({ walls: Array.from(board.walls), robots: game.start, target: t.cell, color: t.color });
}
function showSolution(){
  var el = $("solveText"); el.hidden = false;
  if (solution.moves === undefined){ el.textContent = "Working it out…"; return; }
  if (!solution.moves){ el.textContent = "No route found within 30 moves."; return; }
  var steps = solution.moves;
  el.textContent = "Shortest route: " + steps.length + (steps.length === 1 ? " move" : " moves") + ". " +
    steps.map(function(m){ return COLORS[m[0]] + " " + ARROW[m[1]]; }).join(", ");
  // replay it on the board from where the robots started this round
  clock.stop(); game.robots = game.start.slice(); game.moves = 0; game.phase = "demo"; selected = -1;
  locked = true; renderBoard();
  var n = 0;
  (function step(){
    if (n >= steps.length){ locked = false; if (reached()) game.phase = "solved"; save(); renderBoard(); return; }
    var m = steps[n++];
    game.robots[m[0]] = slide(board.walls, game.robots, m[0], m[1]); game.moves++;
    renderBoard();
    setTimeout(step, 650);
  })();
}

/* ===== Drawing ===== */
function shapeSVG(shape, color, cx, cy, s){
  var f = 'style="fill:' + (color >= 0 ? CSSCOL[color] : "#fff") + ';stroke:var(--wall);stroke-width:' + (s * .07) + '"';
  if (shape === 0) return '<circle cx="' + cx + '" cy="' + cy + '" r="' + (s * .42) + '" ' + f + '/>';
  if (shape === 1) return '<polygon points="' + [cx, cy - s*.46, cx + s*.47, cy + s*.38, cx - s*.47, cy + s*.38].join(" ") + '" ' + f + '/>';
  if (shape === 2) return '<rect x="' + (cx - s*.37) + '" y="' + (cy - s*.37) + '" width="' + (s*.74) + '" height="' + (s*.74) + '" ' + f + '/>';
  if (shape === 3){
    var pts = [];
    for (var i = 0; i < 10; i++){ var a = Math.PI * i / 5 - Math.PI / 2, rr = i % 2 ? s * .21 : s * .5; pts.push((cx + rr * Math.cos(a)).toFixed(3), (cy + rr * Math.sin(a)).toFixed(3)); }
    return '<polygon points="' + pts.join(" ") + '" ' + f + '/>';
  }
  // the wild target: a four-colour burst
  var h = "", R = s * .48;
  for (var q = 0; q < 4; q++){
    var a0 = q * Math.PI / 2 - Math.PI / 2, a1 = a0 + Math.PI / 2;
    h += '<path d="M' + cx + ' ' + cy + 'L' + (cx + R*Math.cos(a0)).toFixed(3) + ' ' + (cy + R*Math.sin(a0)).toFixed(3) +
         'A' + R + ' ' + R + ' 0 0 1 ' + (cx + R*Math.cos(a1)).toFixed(3) + ' ' + (cy + R*Math.sin(a1)).toFixed(3) + 'Z" style="fill:' + CSSCOL[q] + '"/>';
  }
  return h + '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" style="fill:none;stroke:var(--wall);stroke-width:' + (s*.07) + '"/>';
}
function targetName(t){ return t.color < 0 ? "Any robot" : COLORS[t.color] + " " + SHAPES[t.shape]; }
function drawBoard(){
  var h = '<rect width="16" height="16" style="fill:var(--vellum)"/>', g = "";
  for (var i = 1; i < 16; i++) g += "M0 " + i + "H16M" + i + " 0V16";
  h += '<path d="' + g + '" style="stroke:var(--grid);stroke-width:.03"/>';
  board.targets.forEach(function(t){ h += shapeSVG(t.shape, t.color, colOf(t.cell) + .5, rowOf(t.cell) + .5, .62); });
  h += '<rect x="7" y="7" width="2" height="2" rx=".12" style="fill:var(--surface)"/>';
  if (game.phase !== "over"){ var t = target(); h += shapeSVG(t.shape, t.color, 8, 8, 1.3); }
  var w = "";
  for (var c = 0; c < 256; c++){
    var x = colOf(c), y = rowOf(c), b = board.walls[c];
    if (b & 1) w += "M" + x + " " + y + "h1";
    if (b & 8) w += "M" + x + " " + y + "v1";
    if (y === 15 && (b & 4)) w += "M" + x + " 16h1";
    if (x === 15 && (b & 2)) w += "M16 " + y + "v1";
  }
  h += '<path d="' + w + '" style="fill:none;stroke:var(--wall);stroke-width:.13;stroke-linecap:round"/>';
  $("svg").innerHTML = h;
}
function renderBoard(){
  drawBoard();
  var h = "";
  game.robots.forEach(function(p, r){
    h += '<span class="bot c' + r + (r === selected ? " sel" : "") + '" style="transform:translate(' + colOf(p) * 100 + '%,' + rowOf(p) * 100 + '%)"><i></i></span>';
  });
  if (selected >= 0 && !locked && game.phase !== "solved" && game.phase !== "over"){
    for (var d = 0; d < 4; d++){
      if (slide(board.walls, game.robots, selected, d) === game.robots[selected]) continue;
      var n = game.robots[selected] + STEP[d];
      h += '<span class="hintArrow" style="transform:translate(' + colOf(n) * 100 + '%,' + rowOf(n) * 100 + '%)"><b>' + ARROW[d] + '</b></span>';
    }
  }
  renderBots(h);
  var over = game.phase === "over";
  if (!over){
    var t = target();
    $("chip").innerHTML = shapeSVG(t.shape, t.color, .5, .5, .9);
    $("targetNum").textContent = "Target " + (game.deckPos + 1) + " of " + game.deck.length;
    $("targetName").textContent = targetName(t);
  } else {
    $("chip").innerHTML = ""; $("targetNum").textContent = "All targets played"; $("targetName").textContent = "Game over";
  }
  $("phaseBox").hidden = over;
  var ph = game.phase;
  $("clock").hidden = !(ph === "think" || ph === "timing");
  if (ph === "think"){ $("clock").textContent = fmt(settings.seconds); $("clock").className = ""; }
  $("timerBtn").hidden = !(ph === "think" || ph === "timing");
  $("timerBtn").textContent = ph === "timing" ? "Stop timer" : "Start timer";
  var mv = game.moves + (game.moves === 1 ? " move" : " moves");
  $("phaseText").textContent = {
    think: "Found a route? Call out how many moves, then start the timer.",
    timing: "Anyone can still call a lower number until time runs out.",
    demo: "Lowest call goes first and shows the route on the board. If it fails, reset the robots and the next lowest tries.",
    solved: "Reached in " + mv + "!",
    over: ""
  }[ph];
  $("moveCount").textContent = mv;
  $("resetBtn").disabled = locked;
  $("nextBtn").hidden = over;
  $("nextBtn").textContent = game.deckPos + 1 >= game.deck.length ? "Finish" : "Next target";
  $("solveBtn").hidden = over;
  if (over) $("solveText").hidden = true;
  $("againBtn").hidden = !over;
}
function renderBots(h){
  // keep the robot elements between renders so a move animates as a slide instead of a jump
  var box = $("bots"), bots = box.querySelectorAll(".bot");
  if (bots.length !== 4){ box.innerHTML = h; return; }
  var tmp = document.createElement("div"); tmp.innerHTML = h;
  var fresh = tmp.querySelectorAll(".bot");
  for (var i = 0; i < 4; i++){ bots[i].className = fresh[i].className; bots[i].style.transform = fresh[i].style.transform; }
  box.querySelectorAll(".hintArrow").forEach(function(a){ a.remove(); });
  tmp.querySelectorAll(".hintArrow").forEach(function(a){ box.appendChild(a); });
}

function renderSetup(){
  $("timeOut").textContent = fmt(settings.seconds);
  $("savedNote").hidden = !game;
  if (game) $("savedNote").textContent = game.phase === "over" ? "The last board is under the Board tab."
    : "A game in progress (target " + (game.deckPos + 1) + " of " + game.deck.length + ") is under the Board tab.";
}
function render(){
  $("tabs").hidden = !game;
  [].forEach.call($("tabs").children, function(b){ b.setAttribute("aria-selected", String(b.dataset.tab === view)); });
  $("homeLink").hidden = view !== "settings";
  $("setup").hidden = view !== "settings";
  $("boardView").hidden = view !== "board";
  if (view === "settings") renderSetup();
  else renderBoard();
  if (view !== "board") $("againBtn").hidden = true;
}
function setView(v){ view = v; render(); }

/* ===== Events ===== */
$("minus").addEventListener("click", function(){ settings.seconds = Math.max(15, settings.seconds - 15); save(); renderSetup(); });
$("plus").addEventListener("click", function(){ settings.seconds = Math.min(300, settings.seconds + 15); save(); renderSetup(); });
$("start").addEventListener("click", function(){
  if (game && game.phase !== "over" && !confirm("Draw a new board? The current game will be lost.")) return;
  newGame();
});
$("againBtn").addEventListener("click", newGame);
$("tabs").addEventListener("click", function(e){ var b = e.target.closest("button"); if (b && b.dataset.tab !== view) setView(b.dataset.tab); });
$("timerBtn").addEventListener("click", function(){
  if (game.phase === "think"){ Parlor.unlockAudio(); game.phase = "timing"; clock.start(settings.seconds); }
  else if (game.phase === "timing"){ clock.stop(); game.phase = "demo"; }
  save(); renderBoard();
});
$("resetBtn").addEventListener("click", resetRobots);
$("nextBtn").addEventListener("click", advance);
$("solveBtn").addEventListener("click", function(){
  if (locked) return;
  if ((game.phase === "think" || game.phase === "timing") && !confirm("Show the shortest route? That gives away this round.")) return;
  wantSolution = true; showSolution();
});

// tap a robot to pick it; tap a cell in line with it (or an arrow) to send it that way; or swipe
var down = null;
function cellAt(e){
  var r = $("grid").getBoundingClientRect();
  var k = Math.floor((e.clientX - r.left) / r.width * 16), w = Math.floor((e.clientY - r.top) / r.height * 16);
  return k < 0 || k > 15 || w < 0 || w > 15 ? -1 : w * 16 + k;
}
$("grid").addEventListener("pointerdown", function(e){ down = { x: e.clientX, y: e.clientY, cell: cellAt(e) }; });
$("grid").addEventListener("pointerup", function(e){
  if (!down || !game || game.phase === "over") return;
  var dx = e.clientX - down.x, dy = e.clientY - down.y, start = down; down = null;
  var size = $("grid").getBoundingClientRect().width / 16;
  if (Math.max(Math.abs(dx), Math.abs(dy)) > Math.max(18, size * .5)){
    var r = game.robots.indexOf(start.cell); if (r < 0) r = selected; if (r < 0) return;
    selected = r;
    return moveRobot(r, Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? E : W) : (dy > 0 ? S : N));
  }
  var c = cellAt(e); if (c < 0) return;
  var hit = game.robots.indexOf(c);
  if (hit >= 0){ selected = selected === hit ? -1 : hit; return renderBoard(); }
  if (selected < 0) return;
  var p = game.robots[selected];
  if (rowOf(c) === rowOf(p)) moveRobot(selected, colOf(c) > colOf(p) ? E : W);
  else if (colOf(c) === colOf(p)) moveRobot(selected, rowOf(c) > rowOf(p) ? S : N);
  else { selected = -1; renderBoard(); }
});
document.addEventListener("keydown", function(e){
  if (view !== "board" || !game || e.target.tagName === "INPUT") return;
  var pick = { "1": 0, "2": 1, "3": 2, "4": 3, r: 0, g: 1, b: 2, y: 3 }[e.key.toLowerCase()];
  if (pick !== undefined){ selected = pick; return renderBoard(); }
  var d = { ArrowUp: N, ArrowRight: E, ArrowDown: S, ArrowLeft: W }[e.key];
  if (d !== undefined && selected >= 0){ e.preventDefault(); moveRobot(selected, d); }
});
document.addEventListener("visibilitychange", function(){
  if (document.visibilityState === "visible" && game && game.phase !== "over" && view === "board") Parlor.requestWake();
});
document.addEventListener("gesturestart", function(e){ e.preventDefault(); });

/* ===== Start-up ===== */
if (game && game.phase !== "over") startSolve();
render();
Parlor.registerOffline("../");
