"use strict";
/* Tumbleword: find words in a 4×4 grid of letter dice. */
var $ = Parlor.$, rnd = Parlor.rnd, fmt = Parlor.fmt, store = Parlor.store("tumbleword");

/* ===== Dice: the standard modern 16-die letter set ===== */
var DICE = ["AAEEGN","ABBJOO","ACHOPS","AFFKPS","AOOTTW","CIMOTU","DEILRX","DELRVY",
            "DISTTY","EEGHNW","EEINSU","EHRTVW","EIOSST","ELRTTY","HIMNQU","HLNNRZ"];
var AMBIG = {M:1,W:1,N:1,Z:1};

/* ===== Dictionary: Wiktionary via Wiktextract, loaded from dict-words.bin + dict-defs.bin =====
   Both files are gzip. Words are front-coded (uppercase letter = length of prefix shared with
   the previous word). Definitions are one per line, same order as words. A line
   "\x01lemma\x02plural of lemma" means: show "plural of lemma — <lemma's definition>". */
var WORDS = null, DEFS = null, DEF_OFF = null, dictPromise = null;
function gunzip(u8){
  if (u8[0] !== 0x1f || u8[1] !== 0x8b) return Promise.resolve(u8); // already unpacked by the server
  return new Promise(function(resolve, reject){
    try {
      fflate.gunzip(u8, function(err, out){ // runs in a background worker, so the page stays responsive
        if (!err) return resolve(out);
        try { resolve(fflate.gunzipSync(u8)); } catch(e){ reject(e); }
      });
    } catch(e){ try { resolve(fflate.gunzipSync(u8)); } catch(e2){ reject(e2); } }
  });
}
function fetchBytes(url){
  return fetch(url).then(function(r){
    if (!r.ok) throw new Error(url + " returned " + r.status);
    return r.arrayBuffer();
  }).then(function(b){ return gunzip(new Uint8Array(b)); });
}
function loadDict(){
  if (dictPromise) return dictPromise;
  dictPromise = Promise.all([fetchBytes("dict-words.bin"), fetchBytes("dict-defs.bin")]).then(function(parts){
    var s = new TextDecoder().decode(parts[0]), out = [], prev = "", i = 0, n = s.length;
    while (i < n){
      var p = s.charCodeAt(i) - 65; i++;
      var j = i;
      while (j < n && s.charCodeAt(j) >= 97) j++;
      var w = prev.slice(0, p) + s.slice(i, j);
      out.push(w); prev = w; i = j;
    }
    var defs = parts[1], off = new Uint32Array(out.length + 1), k = 1;
    for (var q = 0; q < defs.length && k < out.length; q++) if (defs[q] === 10) off[k++] = q + 1;
    off[out.length] = defs.length + 1;
    WORDS = out; DEFS = defs; DEF_OFF = off;
    return WORDS;
  });
  dictPromise.catch(function(){ dictPromise = null; }); // allow a retry later
  return dictPromise;
}
var utf8 = new TextDecoder("utf-8");
function definition(w, depth){
  var W = WORDS, i = lowerBound(W, w);
  if (W[i] !== w) return "";
  var d = utf8.decode(DEFS.subarray(DEF_OFF[i], DEF_OFF[i+1] - 1));
  if (d.charCodeAt(0) === 1){
    var sep = d.indexOf("\x02"), lemma = d.slice(1, sep), lead = d.slice(sep + 1);
    return { lead: lead, text: (depth ? "" : definition(lemma, 1).text) };
  }
  return { lead: "", text: d };
}
function lowerBound(a, x){ var lo=0, hi=a.length; while(lo<hi){ var m=(lo+hi)>>1; if(a[m]<x) lo=m+1; else hi=m; } return lo; }

/* ===== Settings (remembered if the browser allows) ===== */
var settings = { timed: true, seconds: 180, orient: "fixed" };
settings = Object.assign(settings, store.get("settings", ["boggle-settings"]) || {}); // also picks up saves from before the rename
function saveSettings(){ store.set("settings", settings); }

function renderSetup(){
  [].forEach.call($("segTimed").children, function(b){ b.setAttribute("aria-pressed", String(b.dataset.v === (settings.timed?"1":"0"))); });
  [].forEach.call($("segOrient").children, function(b){ b.setAttribute("aria-pressed", String(b.dataset.v === settings.orient)); });
  $("timeRow").hidden = !settings.timed;
  $("timeOut").textContent = fmt(settings.seconds);
}
$("segTimed").addEventListener("click", function(e){ var b=e.target.closest("button"); if(!b) return; settings.timed = b.dataset.v==="1"; saveSettings(); renderSetup(); });
$("segOrient").addEventListener("click", function(e){ var b=e.target.closest("button"); if(!b) return; settings.orient = b.dataset.v; saveSettings(); renderSetup(); });
$("minus").addEventListener("click", function(){ settings.seconds = Math.max(30, settings.seconds - 30); saveSettings(); renderSetup(); });
$("plus").addEventListener("click", function(){ settings.seconds = Math.min(1200, settings.seconds + 30); saveSettings(); renderSetup(); });

/* ===== Last board: saved on every roll (overwriting the previous one) =====
   Kept in the browser's local storage, which has no expiry date. (Cookies set by a page are
   limited to 7 days in Safari, so they can't do this.) */
function saveBoard(){
  store.set("last-board", { v: 1, at: Date.now(), orient: boardOrient,
    cells: board.map(function(c){ return [c.letter, c.rot]; }) });
  updateSavedNote(Date.now());
}
function updateSavedNote(at){
  var d = new Date(at);
  $("savedNote").textContent = "Last board (" + d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + ", " +
    d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) + ") is under the Board and Words tabs.";
  $("savedNote").hidden = false;
}
function loadSavedBoard(){
  var d = store.get("last-board", ["boggle-last-board"]);
  return d && d.cells && d.cells.length === 16 ? d : null;
}

/* ===== Board ===== */
var board = [], boardOrient = "fixed"; // board: [{letter:"A"|"Qu", rot:0..3}]
function shake(){
  var order = Parlor.shuffle(DICE.slice());
  board = order.map(function(die){
    var f = die[rnd(6)];
    return { letter: f === "Q" ? "Qu" : f, rot: settings.orient === "random" ? rnd(4) : 0 };
  });
  boardOrient = settings.orient;
  saveBoard();
}
function faceHTML(cell){
  var cls = "face";
  if (cell.letter === "Qu") cls += " qu";
  if (boardOrient === "random" && AMBIG[cell.letter]) cls += " ul";
  return '<span class="'+cls+'" style="transform:rotate('+(cell.rot*90)+'deg)"><span class="ch">'+cell.letter+'</span></span>';
}
function drawGrid(){
  var g = $("grid"), h = "";
  for (var i = 0; i < 16; i++) h += '<div class="tile" data-i="'+i+'">'+faceHTML(board[i])+'</div>';
  g.innerHTML = h;
}
function rollAnimation(done){
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce){ drawGrid(); done(); return; }
  var g = $("grid"), ticks = 0;
  g.classList.add("rolling");
  (function step(){
    var h = "";
    for (var i = 0; i < 16; i++){
      var d = DICE[rnd(16)], f = d[rnd(6)];
      h += '<div class="tile">'+faceHTML({letter: f==="Q"?"Qu":f, rot: settings.orient==="random"?rnd(4):0})+'</div>';
    }
    g.innerHTML = h;
    if (++ticks < 9) setTimeout(step, 70);
    else { g.classList.remove("rolling"); drawGrid(); done(); }
  })();
}

/* ===== Solver (standard rules: 3+ letters, adjacent incl. diagonals, each die once, Qu = 2 letters) ===== */
function solve(){
  var W = WORDS;
  var letters = board.map(function(c){ return c.letter.toLowerCase(); });
  var adj = [];
  for (var i = 0; i < 16; i++){
    var r = i>>2, c = i&3, list = [];
    for (var dr=-1; dr<=1; dr++) for (var dc=-1; dc<=1; dc++){
      if (!dr && !dc) continue;
      var rr=r+dr, cc=c+dc;
      if (rr>=0 && rr<4 && cc>=0 && cc<4) list.push(rr*4+cc);
    }
    adj.push(list);
  }
  var found = new Map(), used = new Array(16).fill(false), path = [];
  function dfs(i, prefix){
    var s = prefix + letters[i];
    var k = lowerBound(W, s);
    if (k >= W.length || W[k].lastIndexOf(s, 0) !== 0) return;
    used[i] = true; path.push(i);
    if (s.length >= 3 && W[k] === s && !found.has(s)) found.set(s, path.slice());
    var a = adj[i];
    for (var n = 0; n < a.length; n++) if (!used[a[n]]) dfs(a[n], s);
    used[i] = false; path.pop();
  }
  for (var i = 0; i < 16; i++) dfs(i, "");
  return found;
}

/* ===== Word popover: mini board with path + definition (main board is never touched) ===== */
function miniBoardSVG(path){
  var S = 170, pad = 8, gap = 6, cell = (S - pad*2 - gap*3) / 4, h = "";
  function cx(i){ return pad + (i & 3) * (cell + gap) + cell/2; }
  function cy(i){ return pad + (i >> 2) * (cell + gap) + cell/2; }
  var on = {}; path.forEach(function(idx, n){ on[idx] = n + 1; });
  h += '<rect x="0" y="0" width="'+S+'" height="'+S+'" rx="14" fill="#2a4c9b"/>';
  for (var i = 0; i < 16; i++){
    var x = pad + (i & 3) * (cell + gap), y = pad + (i >> 2) * (cell + gap), L = board[i].letter;
    h += '<rect x="'+x+'" y="'+y+'" width="'+cell+'" height="'+cell+'" rx="7" fill="'+(on[i] ? '#ffd772' : '#f4efe1')+'"/>';
    h += '<text x="'+(x+cell/2)+'" y="'+(y+cell/2+1)+'" text-anchor="middle" dominant-baseline="central" font-family="Futura,Avenir Next,Helvetica Neue,Arial,sans-serif" font-weight="700" font-size="'+(L === "Qu" ? 17 : 21)+'" fill="'+(on[i] ? '#1d1a16' : '#8d8676')+'">'+L+'</text>';
  }
  var pts = path.map(function(i){ return cx(i).toFixed(1) + "," + cy(i).toFixed(1); }).join(" ");
  h += '<polyline points="'+pts+'" fill="none" stroke="#c0392b" stroke-opacity=".55" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>';
  path.forEach(function(idx, n){
    var x = pad + (idx & 3) * (cell + gap), y = pad + (idx >> 2) * (cell + gap);
    h += '<text x="'+(x+5)+'" y="'+(y+11)+'" font-family="Helvetica Neue,Arial,sans-serif" font-size="9" font-weight="700" fill="#7a5a00">'+(n+1)+'</text>';
  });
  return h;
}
var popFor = null, popScroll = 0;
function openPop(btn, w){
  var pop = $("pop");
  popFor = btn;
  popScroll = $("wordsView").scrollTop;
  $("popWord").textContent = w.toUpperCase();
  $("popBoard").innerHTML = miniBoardSVG(results.get(w));
  var d = definition(w, 0), el = $("popDef");
  el.textContent = "";
  if (d && d.lead){ var s = document.createElement("span"); s.className = "lead"; s.textContent = d.lead + (d.text ? " — " : ""); el.appendChild(s); }
  el.appendChild(document.createTextNode(d ? d.text : ""));
  if (!d || (!d.lead && !d.text)) el.textContent = "No definition available.";
  pop.hidden = false;
  // place next to the tapped word, flipping above if there's no room below, clamped to the screen
  var r = btn.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight, vw = innerWidth, vh = innerHeight, m = 12;
  var left = Math.min(Math.max(m, r.left), vw - pw - m);
  var top = r.bottom + 8;
  if (top + ph > vh - m) top = r.top - ph - 8;
  if (top < m) top = Math.max(m, (vh - ph) / 2);
  pop.style.left = left + "px"; pop.style.top = top + "px";
}
function closePop(){ $("pop").hidden = true; popFor = null; }

/* ===== Timer, sound, screen wake ===== */
var unlockAudio = Parlor.unlockAudio, buzzer = Parlor.buzzer, requestWake = Parlor.requestWake, releaseWake = Parlor.releaseWake;
document.addEventListener("visibilitychange", function(){
  if (document.visibilityState === "visible" && phase === "play") requestWake();
});

var clock = Parlor.countdown({
  onTick: function(left){
    var c = $("clock");
    c.textContent = fmt(left);
    c.className = left <= 10 ? "crit" : left <= 30 ? "warn" : "";
  },
  onDone: function(){ buzzer(); endRound(true); }
});
function togglePause(){
  if (phase !== "play" || !clock.active) return;
  if (clock.running) clock.pause(); else { unlockAudio(); clock.resume(); }
  $("pauseCover").hidden = clock.running;
  $("pauseBtn").textContent = clock.running ? "Pause" : "Resume";
}

/* ===== Flow =====
   phase: "idle" (nothing rolled yet), "rolling", "play" (round in progress), "results" (round over)
   view:  "settings", "board", "words" */
var phase = "idle", view = "settings", results = null;

function render(){
  var hasBoard = board.length === 16, live = phase === "play" || phase === "rolling";
  $("tabs").hidden = !hasBoard;
  $("homeLink").hidden = view !== "settings";
  $("boardTab").hidden = !hasBoard;
  $("wordsTab").hidden = !hasBoard || live;          // no peeking at answers mid-round
  [].forEach.call($("tabs").children, function(b){ b.setAttribute("aria-selected", String(b.dataset.tab === view)); });
  $("setup").hidden = view !== "settings";
  $("boardView").hidden = view !== "board";
  $("wordsView").hidden = view !== "words";
  $("clock").hidden = !(live && settings.timed && view === "board");
  $("pauseBtn").hidden = !(phase === "play" && settings.timed && view === "board");
  $("endBtn").hidden = !(live && view === "board");
  $("againBtn").hidden = !(phase === "results" && view !== "settings");
  if (view === "settings") renderSetup();
}
function setView(v){ closePop(); view = v; render(); }

function startRound(){
  closePop();
  unlockAudio(); requestWake();
  phase = "rolling"; results = null; view = "board";
  $("clock").className = ""; $("clock").textContent = settings.timed ? fmt(settings.seconds) : "";
  $("pauseBtn").textContent = "Pause"; $("pauseCover").hidden = true;
  shake();
  render();
  rollAnimation(function(){ phase = "play"; render(); if (settings.timed) clock.start(settings.seconds); });
  loadDict().catch(function(){}); // make sure the dictionary is ready by the end of the round
}
function endRound(timeUp){
  phase = "results"; clock.stop(); releaseWake();
  $("pauseCover").hidden = true;
  render();
  showResults();
}
function showResults(){
  results = null;
  $("wordsTab").textContent = "Words (…)";
  $("wordHint").textContent = "Loading dictionary…";
  $("wordList").innerHTML = "";
  $("wordSearch").value = ""; $("wordSearch").hidden = true;
  var forBoard = board;
  loadDict().then(function(){
    if (board !== forBoard) return; // a new roll happened meanwhile
    results = solve();
    var words = Array.from(results.keys()).sort();
    $("wordsTab").textContent = "Words (" + words.length + ")";
    $("wordList").innerHTML = words.map(function(w){
      return '<li><button data-w="'+w+'">'+w.toUpperCase()+'</button></li>';
    }).join("");
    $("wordSearch").hidden = !words.length;
    hintWords();
  }, function(err){
    $("wordsTab").textContent = "Words";
    $("wordHint").textContent = location.protocol === "file:"
      ? "The dictionary can't load when this page is opened as a local file. Open it from its website instead."
      : "The dictionary couldn't load (" + (err && err.message || "network error") + "). Check your connection and reopen the Words tab.";
  });
}

$("start").addEventListener("click", startRound);
$("againBtn").addEventListener("click", startRound);
$("endBtn").addEventListener("click", function(){ if (phase === "play") endRound(false); });
$("pauseBtn").addEventListener("click", togglePause);
$("clock").addEventListener("click", togglePause);
$("pauseCover").addEventListener("click", togglePause);
$("tabs").addEventListener("click", function(e){
  var b = e.target.closest("button"); if (!b || b.dataset.tab === view) return;
  if ((phase === "play" || phase === "rolling") && b.dataset.tab === "settings"){
    if (!confirm("End this round and go to settings?")) return;
    if (phase === "rolling") return;
    endRound(false);
  }
  if (b.dataset.tab === "words" && phase === "results" && !results && !dictPromise) showResults(); // retry after a failed load
  setView(b.dataset.tab);
});
$("wordList").addEventListener("click", function(e){
  var b = e.target.closest("button"); if (!b || !results) return;
  e.stopPropagation();
  if (popFor === b) { closePop(); return; }
  openPop(b, b.dataset.w);
});
function hintWords(){
  var all = $("wordList").children, shown = 0;
  for (var i = 0; i < all.length; i++) if (!all[i].hidden) shown++;
  $("wordHint").textContent = !all.length ? "No words found on this board."
    : !shown ? "No words match."
    : shown < all.length ? shown + " of " + all.length + " words. Tap a word to see its path and definition."
    : "Tap a word to see its path and definition.";
}
$("wordSearch").addEventListener("input", function(){
  var q = this.value.trim().toLowerCase(), all = $("wordList").children;
  closePop();
  for (var i = 0; i < all.length; i++) all[i].hidden = q !== "" && all[i].firstChild.dataset.w.indexOf(q) < 0;
  hintWords();
});
$("popClose").addEventListener("click", closePop);
$("pop").addEventListener("click", function(e){ e.stopPropagation(); });
document.addEventListener("click", function(){ if (!$("pop").hidden) closePop(); });
$("wordsView").addEventListener("scroll", function(){
  // close once the list has really moved, so the popover never floats over the wrong word
  if (!$("pop").hidden && Math.abs($("wordsView").scrollTop - popScroll) > 24) closePop();
}, { passive: true });
window.addEventListener("resize", closePop);
document.addEventListener("gesturestart", function(e){ e.preventDefault(); });

/* ===== Start-up: settings first; the last board (if any) waits behind the Board and Words tabs ===== */
(function(){
  var saved = loadSavedBoard();
  if (saved){
    board = saved.cells.map(function(c){ return { letter: c[0], rot: c[1] }; });
    boardOrient = saved.orient === "random" ? "random" : "fixed";
    drawGrid();
    phase = "results";
    updateSavedNote(saved.at);
    showResults();
  }
  render();
  loadDict().catch(function(){});
})();

Parlor.registerOffline("../");
